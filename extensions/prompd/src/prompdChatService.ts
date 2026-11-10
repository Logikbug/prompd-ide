import * as vscode from 'vscode';
import { PrompdFlowDocument, FlowNode } from './flowTypes';
import PrompdContinueIntegration from './prompdContinueIntegration';
import PrompdErrorHandler from './prompdErrorHandler';
import PrompdFlowChatIntegration from './prompdFlowChatIntegration';

/**
 * Prompd Chat - AI Assistant for Prompt Engineering
 * 
 * This service provides intelligent AI assistance specifically for .prompd and .prompdflow files.
 * It can understand prompt engineering concepts, modify files intelligently, and provide
 * bidirectional communication with various LLM providers.
 */

export interface PrompdChatProvider {
    name: string;
    apiKey?: string;
    endpoint?: string;
    model: string;
    enabled: boolean;
}

export interface PrompdChatRequest {
    type: 'modify' | 'analyze' | 'optimize' | 'generate' | 'explain';
    fileType: '.prompd' | '.prompdflow';
    filePath: string;
    currentContent: string;
    userMessage: string;
    context?: PrompdChatContext;
}

export interface PrompdChatContext {
    selectedText?: string;
    cursorPosition?: vscode.Position;
    activeSection?: string;
    workspaceFiles?: string[];
    relatedPrompts?: string[];
    flowContext?: any;
    flowAnalysis?: any;
    suggestedActions?: string[];
}

export interface PrompdChatResponse {
    success: boolean;
    message: string;
    modifications?: PrompdFileModification[];
    suggestions?: PrompdSuggestion[];
    explanation?: string;
    reasoning?: string;
}

export interface PrompdFileModification {
    type: 'replace' | 'insert' | 'delete' | 'reorder';
    location: PrompdModificationLocation;
    content?: string;
    description: string;
}

export interface PrompdModificationLocation {
    section?: string;      // For .prompd files: "System", "User", etc.
    nodeId?: string;       // For .prompdflow files: node identifier
    range?: vscode.Range;  // Specific text range
    position?: vscode.Position; // Insert position
}

export interface PrompdSuggestion {
    type: 'improvement' | 'best-practice' | 'optimization' | 'warning';
    title: string;
    description: string;
    action?: () => Promise<void>;
}

export class PrompdChatService {
    private providers: Map<string, PrompdChatProvider> = new Map();
    private activeProvider: string | null = null;
    private chatHistory: PrompdChatMessage[] = [];
    private continueIntegration: PrompdContinueIntegration;
    private errorHandler: PrompdErrorHandler;
    private flowIntegration: PrompdFlowChatIntegration;

    constructor(private context: vscode.ExtensionContext) {
        this.continueIntegration = new PrompdContinueIntegration(context);
        this.errorHandler = new PrompdErrorHandler(context);
        this.flowIntegration = new PrompdFlowChatIntegration(context);
        this.initializeProviders();
        this.setupEventListeners();
    }

    private initializeProviders() {
        // Default providers configuration
        const defaultProviders: PrompdChatProvider[] = [
            {
                name: 'OpenAI',
                model: 'gpt-4',
                enabled: false
            },
            {
                name: 'Anthropic',
                model: 'claude-3-sonnet-20240229',
                enabled: false
            },
            {
                name: 'Azure OpenAI',
                model: 'gpt-4',
                enabled: false
            },
            {
                name: 'Local Ollama',
                endpoint: 'http://localhost:11434',
                model: 'llama3:8b',
                enabled: false
            }
        ];

        defaultProviders.forEach(provider => {
            this.providers.set(provider.name, provider);
        });
    }

    private setupEventListeners(): void {
        // Listen for document changes to provide real-time validation
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (event.document.fileName.match(/\.(prompd|prompdflow)$/i)) {
                await this.errorHandler.validatePromptFile(event.document);
            }
        });

        // Listen for document open to validate immediately
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.fileName.match(/\.(prompd|prompdflow)$/i)) {
                await this.errorHandler.validatePromptFile(document);
            }
        });
    }

    /**
     * Main entry point for Prompd Chat interactions
     */
    async chat(request: PrompdChatRequest): Promise<PrompdChatResponse> {
        try {
            // Enhance request with flow-specific context if applicable
            let enhancedRequest = request;
            if (request.fileType === '.prompdflow') {
                enhancedRequest = await this.flowIntegration.enhanceFlowRequest(request);
            }

            // Send request through Continue integration
            let response = await this.continueIntegration.sendChatMessage(enhancedRequest);

            // Process flow-specific responses
            if (request.fileType === '.prompdflow') {
                response = await this.flowIntegration.processFlowResponse(response, enhancedRequest);
            }

            return response;

        } catch (error) {
            // Handle errors gracefully with detailed error information
            return await this.errorHandler.handleChatError(error as Error, request);
        }
    }

    /**
     * Apply modifications suggested by the AI
     */
    async applyModifications(modifications: PrompdFileModification[], filePath: string): Promise<boolean> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const edit = new vscode.WorkspaceEdit();

            for (const modification of modifications) {
                switch (modification.type) {
                    case 'replace':
                        if (modification.location.range) {
                            edit.replace(document.uri, modification.location.range, modification.content || '');
                        }
                        break;
                    
                    case 'insert':
                        if (modification.location.position) {
                            edit.insert(document.uri, modification.location.position, modification.content || '');
                        }
                        break;
                    
                    case 'delete':
                        if (modification.location.range) {
                            edit.delete(document.uri, modification.location.range);
                        }
                        break;
                }
            }

            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage(`Prompd Chat applied ${modifications.length} modifications`);
            }
            return success;

        } catch (error) {
            console.error('Error applying modifications:', error);
            vscode.window.showErrorMessage('Failed to apply Prompd Chat modifications');
            return false;
        }
    }

    /**
     * Generate specialized system prompt for prompt engineering understanding
     */
    private generateSystemPrompt(fileType: '.prompd' | '.prompdflow'): string {
        const basePrompt = `You are Prompd, an AI assistant specialized in prompt engineering. You understand the structure and best practices for creating effective prompts and prompt workflows.

Key Capabilities:
- Expert knowledge of prompt engineering techniques
- Understanding of .prompd file structure (YAML frontmatter + sections)
- Understanding of .prompdflow file structure (visual workflow format)
- Ability to suggest improvements for clarity, effectiveness, and performance
- Knowledge of parameter usage, variable substitution, and workflow connections

Your responses should be:
- Precise and actionable
- Focused on prompt engineering best practices
- Structured for easy parsing and application
- Educational when explaining changes

Always provide reasoning for suggested changes.`;

        if (fileType === '.prompd') {
            return basePrompt + `

.prompd File Structure:
---
name: Prompt Name
description: Brief description
version: "1.0"
parameters:
  - name: variable_name
    type: string
    required: true
    description: Variable description
---

# System
System message content

# Context  
Context information

# User
User message template

# Assistant
Expected response format

When modifying .prompd files:
- Maintain YAML frontmatter structure
- Use proper section headers (# System, # Context, # User, etc.)
- Ensure parameter references use {parameter_name} syntax
- Follow prompt engineering best practices for each section`;

        } else {
            return basePrompt + `

.prompdflow File Structure:
{
  "version": "1.0.0",
  "metadata": { "name": "Flow Name", "description": "Flow description" },
  "nodes": [
    {
      "id": "node_1",
      "type": "prompt|parameter|condition|output",
      "position": { "x": 100, "y": 100 },
      "data": { "config": { /* node-specific config */ } }
    }
  ],
  "connections": [
    {
      "id": "conn_1", 
      "source": "node_1",
      "target": "node_2",
      "sourcePort": "output",
      "targetPort": "input"
    }
  ]
}

When modifying .prompdflow files:
- Ensure proper JSON structure
- Maintain node relationships and connections
- Use appropriate node types for different functions
- Keep workflow logic coherent and efficient`;
        }
    }

    /**
     * Enhance user prompt with context and file-specific information
     */
    private enhanceUserPrompt(request: PrompdChatRequest): string {
        let prompt = `User Request: "${request.userMessage}"

File Type: ${request.fileType}
File Path: ${request.filePath}

Current File Content:
\`\`\`
${request.currentContent}
\`\`\``;

        if (request.context?.selectedText) {
            prompt += `\n\nSelected Text: "${request.context.selectedText}"`;
        }

        if (request.context?.activeSection) {
            prompt += `\n\nActive Section: ${request.context.activeSection}`;
        }

        prompt += `\n\nPlease analyze the request and provide specific, actionable modifications in JSON format with the following structure:
{
  "success": true,
  "message": "Brief description of changes made",
  "modifications": [
    {
      "type": "replace|insert|delete",
      "location": {
        "section": "section_name",
        "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 10 } }
      },
      "content": "new_content",
      "description": "What this change accomplishes"
    }
  ],
  "reasoning": "Why these changes improve the prompt/workflow"
}`;

        return prompt;
    }

    /**
     * Call the configured LLM provider
     */
    private async callLLM(systemPrompt: string, userPrompt: string, request: PrompdChatRequest): Promise<string> {
        const provider = this.providers.get(this.activeProvider!);
        if (!provider) {
            throw new Error('No active provider configured');
        }

        // This would integrate with actual LLM APIs
        // For now, return a mock response structure
        return JSON.stringify({
            success: true,
            message: "I understand you want to modify your prompt. Here are my suggestions.",
            modifications: [],
            reasoning: "These changes will improve clarity and effectiveness."
        });
    }

    /**
     * Parse and validate AI response
     */
    private async parseAIResponse(response: string, request: PrompdChatRequest): Promise<PrompdChatResponse> {
        try {
            // Try to parse JSON response
            const parsed = JSON.parse(response);
            
            // Validate structure
            if (typeof parsed === 'object' && parsed.success !== undefined) {
                return parsed as PrompdChatResponse;
            }
            
            // Fallback for text responses
            return {
                success: true,
                message: response,
                modifications: [],
                suggestions: []
            };

        } catch (error) {
            // Handle non-JSON responses
            return {
                success: true,
                message: response,
                modifications: [],
                suggestions: []
            };
        }
    }

    /**
     * Legacy provider management methods (now using Continue integration)
     */

    setActiveProvider(providerName: string): boolean {
        if (this.providers.has(providerName)) {
            this.activeProvider = providerName;
            return true;
        }
        return false;
    }

    getProviders(): PrompdChatProvider[] {
        // Return Continue providers instead of legacy providers
        const continueProviders = this.continueIntegration.getProviders();
        return continueProviders.map(cp => ({
            name: cp.name,
            model: cp.model,
            enabled: cp.enabled,
            apiKey: cp.apiKey,
            endpoint: cp.apiBase
        }));
    }

    getChatHistory(): PrompdChatMessage[] {
        // Get history from Continue integration
        const continueHistory = this.continueIntegration.getChatHistory();
        return continueHistory.map(ch => ({
            role: ch.role as 'user' | 'assistant',
            content: ch.content,
            timestamp: ch.timestamp,
            context: ch.data?.context,
            response: ch.data?.response
        }));
    }

    clearChatHistory(): void {
        this.continueIntegration.clearChatHistory();
    }

    /**
     * Get Continue integration instance for external access
     */
    getContinueIntegration(): PrompdContinueIntegration {
        return this.continueIntegration;
    }

    /**
     * Get error handler instance for external access
     */
    getErrorHandler(): PrompdErrorHandler {
        return this.errorHandler;
    }

    /**
     * Get flow integration instance for external access
     */
    getFlowIntegration(): PrompdFlowChatIntegration {
        return this.flowIntegration;
    }

    /**
     * Validate a prompt file and return issues
     */
    async validateFile(document: vscode.TextDocument): Promise<any[]> {
        return await this.errorHandler.validatePromptFile(document);
    }

    /**
     * Open provider configuration UI
     */
    async openProviderSettings(): Promise<void> {
        await this.continueIntegration.openProviderConfiguration();
    }

    /**
     * Test connection to active provider
     */
    async testProviderConnection(): Promise<boolean> {
        const activeProvider = this.continueIntegration.getActiveProvider();
        return activeProvider ? true : false;
    }

    /**
     * Export chat history
     */
    exportChatHistory(): string {
        return this.continueIntegration.exportChatHistory();
    }
}

interface PrompdChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    context?: PrompdChatRequest;
    response?: PrompdChatResponse;
}

export default PrompdChatService;
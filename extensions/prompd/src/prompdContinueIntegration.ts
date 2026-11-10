import * as vscode from 'vscode';
import { PrompdChatRequest, PrompdChatResponse, PrompdFileModification } from './prompdChatService';

/**
 * Prompd Continue Integration Service
 * 
 * Integrates with Continue extension for AI-powered IDE assistance
 * Provides a unified interface for LLM interactions without depending on Copilot APIs
 */

export interface ContinueProvider {
    id: string;
    name: string;
    provider: string; // openai, anthropic, ollama, etc.
    model: string;
    apiKey?: string;
    apiBase?: string;
    enabled: boolean;
    maxTokens?: number;
    temperature?: number;
}

export interface ContinueConfig {
    providers: ContinueProvider[];
    activeProvider?: string;
    systemPrompts?: Map<string, string>;
    contextLength?: number;
    streamResponses?: boolean;
}

export class PrompdContinueIntegration {
    private config: ContinueConfig;
    private continueExtension: vscode.Extension<any> | undefined;
    private isInitialized: boolean = false;
    private chatHistory: ChatMessage[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Prompd Continue Integration');
        this.config = this.loadConfiguration();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            // Check if Continue extension is available
            this.continueExtension = vscode.extensions.getExtension('continue.continue');
            
            if (!this.continueExtension) {
                this.outputChannel.appendLine('Continue extension not found. Installing recommended setup...');
                await this.promptContinueInstallation();
            } else if (!this.continueExtension.isActive) {
                await this.continueExtension.activate();
                this.outputChannel.appendLine('Continue extension activated');
            }

            this.isInitialized = true;
            this.setupEventListeners();
            
        } catch (error) {
            this.outputChannel.appendLine(`Failed to initialize Continue integration: ${error}`);
            this.isInitialized = false;
        }
    }

    private loadConfiguration(): ContinueConfig {
        const storedConfig = this.context.globalState.get<ContinueConfig>('prompd.continueConfig');
        
        if (storedConfig) {
            return storedConfig;
        }

        // Default configuration with multiple provider options
        return {
            providers: [
                {
                    id: 'openai-gpt4',
                    name: 'OpenAI GPT-4',
                    provider: 'openai',
                    model: 'gpt-4-turbo-preview',
                    enabled: false,
                    maxTokens: 4096,
                    temperature: 0.7
                },
                {
                    id: 'anthropic-claude',
                    name: 'Anthropic Claude 3',
                    provider: 'anthropic',
                    model: 'claude-3-sonnet-20240229',
                    enabled: false,
                    maxTokens: 4096,
                    temperature: 0.7
                },
                {
                    id: 'ollama-local',
                    name: 'Local Ollama',
                    provider: 'ollama',
                    model: 'llama3:latest',
                    apiBase: 'http://localhost:11434',
                    enabled: false,
                    maxTokens: 2048,
                    temperature: 0.7
                },
                {
                    id: 'azure-openai',
                    name: 'Azure OpenAI',
                    provider: 'azure',
                    model: 'gpt-4',
                    enabled: false,
                    maxTokens: 4096,
                    temperature: 0.7
                },
                {
                    id: 'google-gemini',
                    name: 'Google Gemini',
                    provider: 'google',
                    model: 'gemini-pro',
                    enabled: false,
                    maxTokens: 4096,
                    temperature: 0.7
                }
            ],
            contextLength: 8192,
            streamResponses: true
        };
    }

    private setupEventListeners(): void {
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('prompd.continue')) {
                this.reloadConfiguration();
            }
        });

        // Listen for Continue extension events if available
        if (this.continueExtension?.exports) {
            const continueApi = this.continueExtension.exports;
            
            if (continueApi.onDidReceiveMessage) {
                continueApi.onDidReceiveMessage((message: any) => {
                    this.handleContinueMessage(message);
                });
            }
        }
    }

    /**
     * Send a chat message through Continue integration
     */
    public async sendChatMessage(request: PrompdChatRequest): Promise<PrompdChatResponse> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const activeProvider = this.getActiveProvider();
        if (!activeProvider) {
            return {
                success: false,
                message: 'No AI provider configured. Please configure a provider in settings.',
                suggestions: [{
                    type: 'warning',
                    title: 'Configure AI Provider',
                    description: 'Set up an AI provider to use Prompd Chat',
                    action: async () => await this.openProviderConfiguration()
                }]
            };
        }

        try {
            // Build context-aware prompt
            const prompt = this.buildPrompt(request);
            
            // Send to Continue or direct API
            const response = await this.callLLM(prompt, activeProvider, request);
            
            // Parse and validate response
            const parsedResponse = this.parseResponse(response, request);
            
            // Add to chat history
            this.addToHistory('user', request.userMessage, request);
            this.addToHistory('assistant', parsedResponse.message, parsedResponse);
            
            return parsedResponse;
            
        } catch (error) {
            this.outputChannel.appendLine(`Chat error: ${error}`);
            return this.handleError(error);
        }
    }

    /**
     * Build context-aware prompt for the LLM
     */
    private buildPrompt(request: PrompdChatRequest): string {
        const systemPrompt = this.getSystemPrompt(request.fileType);
        
        let prompt = systemPrompt + '\n\n';
        prompt += `Task: ${request.type}\n`;
        prompt += `User Message: ${request.userMessage}\n\n`;
        
        // Add file content
        prompt += `Current File (${request.fileType}):\n`;
        prompt += '```\n' + request.currentContent + '\n```\n\n';
        
        // Add context if available
        if (request.context) {
            if (request.context.selectedText) {
                prompt += `Selected Text: "${request.context.selectedText}"\n`;
            }
            if (request.context.activeSection) {
                prompt += `Active Section: ${request.context.activeSection}\n`;
            }
            if (request.context.workspaceFiles?.length) {
                prompt += `Related Files: ${request.context.workspaceFiles.join(', ')}\n`;
            }
        }
        
        // Add response format instructions
        prompt += '\n' + this.getResponseFormatInstructions(request.type);
        
        return prompt;
    }

    /**
     * Get system prompt for specific file type
     */
    private getSystemPrompt(fileType: '.prompd' | '.prompdflow'): string {
        const basePrompt = `You are Prompd Assistant, an expert in prompt engineering and workflow optimization.
Your role is to help users create, optimize, and debug prompts and prompt workflows.

Core Capabilities:
- Deep understanding of prompt engineering best practices
- Expertise in .prompd file structure (YAML frontmatter + markdown sections)
- Expertise in .prompdflow file structure (JSON-based visual workflows)
- Ability to identify and fix common prompt issues
- Knowledge of parameter usage, variables, and data flow
- Understanding of LLM behavior and optimization techniques`;

        if (fileType === '.prompd') {
            return basePrompt + `

.prompd File Structure:
- YAML frontmatter with metadata and parameters
- Markdown sections: # System, # Context, # User, # Assistant
- Variable substitution using {parameter_name} syntax
- Support for conditional logic and templates

Focus on:
- Clarity and specificity in prompts
- Proper parameter definition and usage
- Effective system/context separation
- Output format specifications`;
        } else {
            return basePrompt + `

.prompdflow File Structure:
- JSON-based workflow definition
- Node types: prompt, parameter, condition, transform, output
- Connection-based data flow
- Support for branching and loops

Focus on:
- Workflow efficiency and logic
- Proper node connections
- Data transformation between steps
- Error handling and validation`;
        }
    }

    /**
     * Get response format instructions based on request type
     */
    private getResponseFormatInstructions(type: string): string {
        switch (type) {
            case 'modify':
                return `Provide specific modifications in JSON format:
{
  "message": "Brief description of changes",
  "modifications": [
    {
      "type": "replace|insert|delete",
      "location": { "section": "name", "range": {...} },
      "content": "new content",
      "description": "what this changes"
    }
  ],
  "reasoning": "why these changes improve the prompt"
}`;

            case 'analyze':
                return `Provide analysis in JSON format:
{
  "message": "Analysis summary",
  "issues": ["issue1", "issue2"],
  "strengths": ["strength1", "strength2"],
  "suggestions": [
    {
      "type": "improvement",
      "title": "Suggestion title",
      "description": "Detailed suggestion"
    }
  ]
}`;

            case 'optimize':
                return `Provide optimizations with before/after comparisons and reasoning.`;

            case 'explain':
                return `Provide clear explanation of the prompt/workflow logic and purpose.`;

            case 'generate':
                return `Generate a complete prompt/workflow based on requirements.`;

            default:
                return `Provide a helpful response in a clear, structured format.`;
        }
    }

    /**
     * Call LLM through Continue or direct API
     */
    private async callLLM(
        prompt: string, 
        provider: ContinueProvider,
        request: PrompdChatRequest
    ): Promise<string> {
        // Try Continue extension first
        if (this.continueExtension?.exports?.sendMessage) {
            return await this.callThroughContinue(prompt, provider);
        }
        
        // Fallback to direct API call
        return await this.callDirectAPI(prompt, provider);
    }

    /**
     * Call through Continue extension
     */
    private async callThroughContinue(prompt: string, provider: ContinueProvider): Promise<string> {
        const continueApi = this.continueExtension!.exports;
        
        const message = {
            role: 'user',
            content: prompt,
            provider: provider.id,
            options: {
                temperature: provider.temperature,
                maxTokens: provider.maxTokens,
                stream: this.config.streamResponses
            }
        };
        
        const response = await continueApi.sendMessage(message);
        return response.content || response.text || JSON.stringify(response);
    }

    /**
     * Direct API call to LLM provider
     */
    private async callDirectAPI(prompt: string, provider: ContinueProvider): Promise<string> {
        const endpoint = this.getAPIEndpoint(provider);
        const headers = this.getAPIHeaders(provider);
        const body = this.getAPIBody(prompt, provider);
        
        // Use VS Code's built-in fetch equivalent
        const https = require('https');
        const http = require('http');
        const url = require('url');
        
        const responsePromise = new Promise<any>((resolve, reject) => {
            const parsedUrl = url.parse(endpoint);
            const requestModule = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                method: 'POST',
                headers,
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path
            };
            
            const req = requestModule.request(options, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            resolve(data);
                        }
                    } else {
                        reject(new Error(`API call failed: ${res.statusMessage}`));
                    }
                });
            });
            
            req.on('error', reject);
            req.write(JSON.stringify(body));
            req.end();
        });
        
        const data = await responsePromise;
        return this.extractResponseContent(data, provider);
    }

    /**
     * Get API endpoint for provider
     */
    private getAPIEndpoint(provider: ContinueProvider): string {
        switch (provider.provider) {
            case 'openai':
                return provider.apiBase || 'https://api.openai.com/v1/chat/completions';
            case 'anthropic':
                return provider.apiBase || 'https://api.anthropic.com/v1/messages';
            case 'ollama':
                return `${provider.apiBase || 'http://localhost:11434'}/api/generate`;
            case 'azure':
                return `${provider.apiBase}/openai/deployments/${provider.model}/chat/completions?api-version=2024-02-15-preview`;
            case 'google':
                return `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent`;
            default:
                throw new Error(`Unknown provider: ${provider.provider}`);
        }
    }

    /**
     * Get API headers for provider
     */
    private getAPIHeaders(provider: ContinueProvider): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        
        switch (provider.provider) {
            case 'openai':
                headers['Authorization'] = `Bearer ${provider.apiKey}`;
                break;
            case 'anthropic':
                headers['x-api-key'] = provider.apiKey || '';
                headers['anthropic-version'] = '2023-06-01';
                break;
            case 'azure':
                headers['api-key'] = provider.apiKey || '';
                break;
            case 'google':
                headers['x-goog-api-key'] = provider.apiKey || '';
                break;
        }
        
        return headers;
    }

    /**
     * Get API request body for provider
     */
    private getAPIBody(prompt: string, provider: ContinueProvider): any {
        switch (provider.provider) {
            case 'openai':
            case 'azure':
                return {
                    model: provider.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: provider.temperature || 0.7,
                    max_tokens: provider.maxTokens || 4096
                };
            
            case 'anthropic':
                return {
                    model: provider.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: provider.maxTokens || 4096,
                    temperature: provider.temperature || 0.7
                };
            
            case 'ollama':
                return {
                    model: provider.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: provider.temperature || 0.7,
                        num_predict: provider.maxTokens || 2048
                    }
                };
            
            case 'google':
                return {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: provider.temperature || 0.7,
                        maxOutputTokens: provider.maxTokens || 4096
                    }
                };
            
            default:
                throw new Error(`Unknown provider: ${provider.provider}`);
        }
    }

    /**
     * Extract response content from API response
     */
    private extractResponseContent(data: any, provider: ContinueProvider): string {
        switch (provider.provider) {
            case 'openai':
            case 'azure':
                return data.choices?.[0]?.message?.content || '';
            
            case 'anthropic':
                return data.content?.[0]?.text || '';
            
            case 'ollama':
                return data.response || '';
            
            case 'google':
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            default:
                return JSON.stringify(data);
        }
    }

    /**
     * Parse LLM response into structured format
     */
    private parseResponse(response: string, request: PrompdChatRequest): PrompdChatResponse {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(response);
            
            // Validate and ensure proper structure
            return {
                success: true,
                message: parsed.message || response,
                modifications: this.validateModifications(parsed.modifications),
                suggestions: parsed.suggestions || [],
                explanation: parsed.explanation,
                reasoning: parsed.reasoning
            };
            
        } catch {
            // Fallback for non-JSON responses
            return {
                success: true,
                message: response,
                modifications: [],
                suggestions: []
            };
        }
    }

    /**
     * Validate and fix modification structure
     */
    private validateModifications(modifications: any[]): PrompdFileModification[] {
        if (!Array.isArray(modifications)) {
            return [];
        }
        
        return modifications.filter(mod => {
            return mod.type && mod.location && mod.description;
        }).map(mod => ({
            type: mod.type,
            location: mod.location,
            content: mod.content,
            description: mod.description
        }));
    }

    /**
     * Handle errors gracefully
     */
    private handleError(error: any): PrompdChatResponse {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        return {
            success: false,
            message: `Error: ${errorMessage}`,
            suggestions: [
                {
                    type: 'warning',
                    title: 'Check Configuration',
                    description: 'Verify your AI provider settings and API keys',
                    action: async () => await this.openProviderConfiguration()
                },
                {
                    type: 'warning',
                    title: 'View Logs',
                    description: 'Check the output panel for detailed error information',
                    action: async () => this.outputChannel.show()
                }
            ]
        };
    }

    /**
     * Add message to chat history
     */
    private addToHistory(role: 'user' | 'assistant', content: string, data?: any): void {
        this.chatHistory.push({
            role,
            content,
            timestamp: new Date(),
            data
        });
        
        // Limit history size
        if (this.chatHistory.length > 100) {
            this.chatHistory = this.chatHistory.slice(-50);
        }
    }

    /**
     * Open provider configuration UI
     */
    public async openProviderConfiguration(): Promise<void> {
        const providers = this.config.providers;
        
        const selected = await vscode.window.showQuickPick(
            providers.map(p => ({
                label: p.name,
                description: `${p.provider} - ${p.model}`,
                detail: p.enabled ? '✓ Configured' : 'Not configured',
                provider: p
            })),
            {
                placeHolder: 'Select an AI provider to configure',
                title: 'Configure AI Provider for Prompd Chat'
            }
        );
        
        if (selected) {
            await this.configureProvider(selected.provider);
        }
    }

    /**
     * Configure a specific provider
     */
    private async configureProvider(provider: ContinueProvider): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: `Enter API key for ${provider.name}`,
            password: true,
            placeHolder: 'sk-...',
            ignoreFocusOut: true
        });
        
        if (!apiKey) {
            return;
        }
        
        // Update provider configuration
        provider.apiKey = apiKey;
        provider.enabled = true;
        
        // Set as active if no other provider is active
        if (!this.config.activeProvider) {
            this.config.activeProvider = provider.id;
        }
        
        // Save configuration
        await this.saveConfiguration();
        
        // Test connection
        const success = await this.testProviderConnection(provider);
        if (success) {
            vscode.window.showInformationMessage(`${provider.name} configured successfully!`);
        } else {
            vscode.window.showErrorMessage(`Failed to connect to ${provider.name}. Please check your API key.`);
        }
    }

    /**
     * Test provider connection
     */
    private async testProviderConnection(provider: ContinueProvider): Promise<boolean> {
        try {
            const testPrompt = 'Say "Hello from Prompd!" if you can hear me.';
            const response = await this.callDirectAPI(testPrompt, provider);
            return response.toLowerCase().includes('hello from prompd');
        } catch (error) {
            this.outputChannel.appendLine(`Connection test failed: ${error}`);
            return false;
        }
    }

    /**
     * Save configuration to global state
     */
    private async saveConfiguration(): Promise<void> {
        await this.context.globalState.update('prompd.continueConfig', this.config);
    }

    /**
     * Reload configuration
     */
    private async reloadConfiguration(): Promise<void> {
        this.config = this.loadConfiguration();
    }

    /**
     * Prompt for Continue installation
     */
    private async promptContinueInstallation(): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            'Continue extension is recommended for enhanced AI assistance. Would you like to install it?',
            'Install Continue',
            'Use Direct API',
            'Cancel'
        );
        
        if (choice === 'Install Continue') {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', 'continue.continue');
        } else if (choice === 'Use Direct API') {
            await this.openProviderConfiguration();
        }
    }

    /**
     * Handle messages from Continue extension
     */
    private handleContinueMessage(message: any): void {
        this.outputChannel.appendLine(`Continue message: ${JSON.stringify(message)}`);
    }

    /**
     * Get active provider
     */
    public getActiveProvider(): ContinueProvider | undefined {
        if (!this.config.activeProvider) {
            return this.config.providers.find(p => p.enabled);
        }
        return this.config.providers.find(p => p.id === this.config.activeProvider && p.enabled);
    }

    /**
     * Get all configured providers
     */
    public getProviders(): ContinueProvider[] {
        return this.config.providers;
    }

    /**
     * Get chat history
     */
    public getChatHistory(): ChatMessage[] {
        return this.chatHistory;
    }

    /**
     * Clear chat history
     */
    public clearChatHistory(): void {
        this.chatHistory = [];
    }

    /**
     * Export chat history
     */
    public exportChatHistory(): string {
        return JSON.stringify(this.chatHistory, null, 2);
    }
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    data?: any;
}

export default PrompdContinueIntegration;
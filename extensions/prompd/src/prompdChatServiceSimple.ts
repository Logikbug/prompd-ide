import * as vscode from 'vscode';
import { PrompdCliIntegration, PrompdExecutionResult } from './prompdCliIntegration';

/**
 * Prompd Chat Service with CLI Integration
 * Uses real LLM execution via prompd CLI
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
    fileType: '.prompd' | '.pdflow' | 'general';
    filePath: string;
    currentContent: string;
    userMessage: string;
    context?: any;
}

export interface PrompdChatResponse {
    success: boolean;
    message: string;
    modifications?: any[];
    suggestions?: any[];
    explanation?: string;
    reasoning?: string;
    tokenUsage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    provider?: string;
    model?: string;
    sessionTokens?: Map<string, any>;
}

export class PrompdChatServiceSimple {
    private cliIntegration: PrompdCliIntegration;
    private activeProvider: string = 'openai';
    private activeModel: string = 'gpt-4';
    private cliAvailable: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        console.log('🔧 Prompd Chat Service with CLI integration initialized');
        this.cliIntegration = new PrompdCliIntegration(context);
        this.initializeCli();
    }

    private async initializeCli() {
        console.log('🚀 Initializing CLI integration...');
        try {
            this.cliAvailable = await this.cliIntegration.testCliAvailability();
            console.log(`🔍 CLI availability test completed: ${this.cliAvailable}`);
            if (this.cliAvailable) {
                console.log('✅ Prompd CLI is available and ready');
            } else {
                console.log('⚠️ Prompd CLI not available, using fallback responses');
                console.log('💡 Check the "Prompd CLI" output channel for detailed error information');
            }
        } catch (error) {
            console.error('❌ Error during CLI initialization:', error);
            this.cliAvailable = false;
        }
    }

    /**
     * Enhanced chat implementation with CLI integration
     */
    async chat(request: PrompdChatRequest): Promise<PrompdChatResponse> {
        console.log('💬 Chat request received:', request.userMessage);
        console.log('📁 File type:', request.fileType);
        console.log('🗂️ Context:', request.context);
        
        if (this.cliAvailable) {
            return this.chatWithCli(request);
        } else {
            return this.generateContextualResponse(request);
        }
    }

    /**
     * Chat using CLI integration for real LLM responses
     */
    private async chatWithCli(request: PrompdChatRequest): Promise<PrompdChatResponse> {
        try {
            // Build context for CLI execution
            const context = {
                ...request.context,
                filePath: request.filePath,
                fileContent: request.currentContent,
                fileType: request.fileType,
                languageId: request.context?.languageId,
                selectedText: request.context?.selectedText,
                errorMessage: request.context?.errorMessage,
                projectPath: vscode.workspace.rootPath,
                preferredLanguage: 'typescript'
            };

            // Execute with intent detection
            const result = await this.cliIntegration.chatWithIntent(
                request.userMessage,
                context,
                this.activeProvider,
                this.activeModel
            );

            if (result.success) {
                const sessionTokens = this.cliIntegration.getSessionTokenUsage();
                return {
                    success: true,
                    message: result.response,
                    explanation: `Generated using ${this.activeProvider}/${this.activeModel} (${result.executionTime}ms)`,
                    tokenUsage: result.tokenUsage,
                    provider: result.provider,
                    model: result.model,
                    sessionTokens: sessionTokens
                };
            } else {
                return {
                    success: false,
                    message: `LLM execution failed: ${result.error}`,
                    explanation: 'Falling back to contextual response',
                    provider: result.provider,
                    model: result.model
                };
            }
        } catch (error) {
            console.error('CLI chat error:', error);
            return {
                success: false,
                message: `Chat error: ${error}`,
                explanation: 'Falling back to contextual response'
            };
        }
    }

    private generateContextualResponse(request: PrompdChatRequest): PrompdChatResponse {
        const { userMessage, fileType, context } = request;
        const lowerMessage = userMessage.toLowerCase();
        
        // Handle different file types and contexts
        if (fileType === '.prompd') {
            return this.handlePrompdFileChat(request);
        } else if (fileType === '.pdflow') {
            return this.handlePrompdFlowChat(request);
        } else if (context?.fileName) {
            return this.handleFileSpecificChat(request);
        } else {
            return this.handleGeneralChat(request);
        }
    }

    private handlePrompdFileChat(request: PrompdChatRequest): PrompdChatResponse {
        const suggestions = [
            {
                type: 'improvement',
                title: 'Optimize Prompt',
                description: 'I can help optimize your prompt for better effectiveness'
            },
            {
                type: 'improvement', 
                title: 'Add Parameters',
                description: 'I can help add flexible parameters to your prompt'
            }
        ];

        return {
            success: true,
            message: `I can see you're working with a .prompd file. I can help you optimize prompts, add parameters, improve structure, or explain prompt engineering concepts. What would you like me to help with?`,
            suggestions
        };
    }

    private handlePrompdFlowChat(request: PrompdChatRequest): PrompdChatResponse {
        const suggestions = [
            {
                type: 'improvement',
                title: 'Optimize Workflow',
                description: 'I can help optimize your workflow for better performance'
            },
            {
                type: 'improvement',
                title: 'Fix Connections',
                description: 'I can help debug node connections and data flow'
            }
        ];

        return {
            success: true,
            message: `I can see you're working with a .pdflow file. I can help optimize workflows, fix node connections, add new steps, or debug execution flow. What would you like me to help with?`,
            suggestions
        };
    }

    private handleFileSpecificChat(request: PrompdChatRequest): PrompdChatResponse {
        const fileName = request.context?.fileName?.split(/[\\/]/).pop() || 'this file';
        const fileExt = fileName.split('.').pop()?.toLowerCase();
        const languageId = request.context?.languageId;
        
        let fileTypeDescription = 'file';
        let capabilities: string[] = [];
        
        switch (fileExt) {
            case 'ts':
            case 'js':
                fileTypeDescription = 'TypeScript/JavaScript file';
                capabilities = ['code analysis', 'refactoring suggestions', 'bug detection', 'performance optimization'];
                break;
            case 'py':
                fileTypeDescription = 'Python file';
                capabilities = ['code review', 'optimization', 'debugging help', 'best practices'];
                break;
            case 'md':
                fileTypeDescription = 'Markdown file';
                capabilities = ['content improvement', 'formatting help', 'documentation structure'];
                break;
            case 'json':
                fileTypeDescription = 'JSON file';
                capabilities = ['structure validation', 'formatting', 'schema suggestions'];
                break;
            default:
                capabilities = ['general analysis', 'content review', 'suggestions'];
        }

        const suggestions = [
            {
                type: 'improvement',
                title: 'Analyze File',
                description: `Analyze the current ${fileTypeDescription} for improvements`
            },
            {
                type: 'info',
                title: 'Explain Code',
                description: 'Explain what this code does and how it works'
            }
        ];

        return {
            success: true,
            message: `I can see you're working with ${fileName} (${fileTypeDescription}). I can help with ${capabilities.join(', ')}. What would you like me to analyze or help you with?`,
            suggestions
        };
    }

    private handleGeneralChat(request: PrompdChatRequest): PrompdChatResponse {
        const message = request.userMessage.toLowerCase();
        const context = request.context;
        
        // Check if they're asking about the project
        if (message.includes('project') || message.includes('files') || message.includes('workspace')) {
            return this.handleProjectInquiry(request);
        }
        
        // General programming/development questions
        if (message.includes('code') || message.includes('programming') || message.includes('develop')) {
            return this.handleDevelopmentChat(request);
        }
        
        const suggestions = [
            {
                type: 'info',
                title: 'Analyze Project',
                description: 'I can help analyze your project structure and files'
            },
            {
                type: 'improvement',
                title: 'Development Help',
                description: 'I can assist with coding questions and best practices'
            },
            {
                type: 'info',
                title: 'Prompt Engineering',
                description: 'I can help you create and optimize prompts for AI'
            }
        ];

        return {
            success: true,
            message: `Hello! I'm your Prompd AI assistant. I can help you with prompt engineering, analyze your project files, assist with development questions, or just have a general conversation. What would you like to explore?`,
            suggestions
        };
    }

    private handleProjectInquiry(request: PrompdChatRequest): PrompdChatResponse {
        const projectInfo = request.context?.projectInfo;
        const workspaceFiles = request.context?.workspaceFiles || [];
        
        let message = `I can see your project`;
        
        if (projectInfo?.name) {
            message += ` "${projectInfo.name}"`;
        }
        
        if (projectInfo?.description) {
            message += `: ${projectInfo.description}`;
        }
        
        if (workspaceFiles.length > 0) {
            const fileTypes = new Set(workspaceFiles.map((f: string) => f.split('.').pop()?.toLowerCase()));
            message += `\n\nI found ${workspaceFiles.length} files including: ${Array.from(fileTypes).join(', ')} files.`;
        }
        
        message += `\n\nI can help analyze specific files, explain project structure, or assist with development tasks. What would you like to explore?`;

        return {
            success: true,
            message,
            suggestions: [
                {
                    type: 'info',
                    title: 'File Analysis',
                    description: 'Analyze specific files in your project'
                },
                {
                    type: 'info',
                    title: 'Project Structure',
                    description: 'Review and improve project organization'
                }
            ]
        };
    }

    private handleDevelopmentChat(request: PrompdChatRequest): PrompdChatResponse {
        return {
            success: true,
            message: `I'm here to help with your development questions! I can assist with coding problems, review your code, suggest improvements, explain concepts, or help with debugging. What specific development challenge are you facing?`,
            suggestions: [
                {
                    type: 'info',
                    title: 'Code Review',
                    description: 'Review and improve your code'
                },
                {
                    type: 'info',
                    title: 'Debugging Help',
                    description: 'Help debug and fix issues'
                },
                {
                    type: 'info',
                    title: 'Best Practices',
                    description: 'Suggest development best practices'
                }
            ]
        };
    }

    /**
     * Apply modifications (simplified)
     */
    async applyModifications(modifications: any[], filePath: string): Promise<boolean> {
        vscode.window.showInformationMessage('Apply modifications feature will be implemented');
        return true;
    }

    /**
     * Get available providers from CLI or defaults
     */
    async getProviders(): Promise<PrompdChatProvider[]> {
        if (this.cliAvailable) {
            try {
                const providerNames = await this.cliIntegration.getAvailableProviders();
                return providerNames.map(name => ({
                    name,
                    model: 'default',
                    enabled: true
                }));
            } catch (error) {
                console.warn('Failed to get providers from CLI:', error);
            }
        }
        
        return [
            { name: 'openai', model: 'gpt-4', enabled: true },
            { name: 'anthropic', model: 'claude-3-sonnet', enabled: true },
            { name: 'local', model: 'llama2', enabled: true }
        ];
    }

    /**
     * Get available models for active provider
     */
    async getModels(provider?: string): Promise<string[]> {
        const targetProvider = provider || this.activeProvider;
        
        if (this.cliAvailable) {
            try {
                return await this.cliIntegration.getAvailableModels(targetProvider);
            } catch (error) {
                console.warn(`Failed to get models for ${targetProvider}:`, error);
            }
        }
        
        // Fallback defaults
        switch (targetProvider.toLowerCase()) {
            case 'openai':
                return ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
            case 'anthropic':
                return ['claude-3-sonnet', 'claude-3-haiku', 'claude-3-opus'];
            case 'local':
                return ['llama2', 'codellama', 'mistral'];
            default:
                return ['default'];
        }
    }

    /**
     * Get chat history (simplified)
     */
    getChatHistory(): any[] {
        return [];
    }

    /**
     * Clear chat history (simplified)
     */
    clearChatHistory(): void {
        console.log('Chat history cleared');
    }

    /**
     * Export chat history (simplified)
     */
    exportChatHistory(): string {
        return JSON.stringify({ messages: [] }, null, 2);
    }

    /**
     * Get Continue integration (simplified - returns null)
     */
    getContinueIntegration(): any {
        return {
            openProviderConfiguration: async () => {
                vscode.window.showInformationMessage('Provider configuration will be implemented');
            }
        };
    }

    /**
     * Set active provider and model
     */
    setActiveProvider(providerName: string, model?: string): boolean {
        console.log('Set active provider:', providerName, 'model:', model);
        this.activeProvider = providerName;
        if (model) {
            this.activeModel = model;
        }
        return true;
    }

    /**
     * Get session token usage for all providers
     */
    getSessionTokenUsage(): Map<string, any> {
        return this.cliIntegration.getSessionTokenUsage();
    }

    /**
     * Reset session token usage
     */
    resetSessionTokenUsage(provider?: string): void {
        this.cliIntegration.resetSessionTokenUsage(provider);
    }

    /**
     * Get token usage for specific provider
     */
    getProviderTokenUsage(provider: string): any {
        const sessionTokens = this.cliIntegration.getSessionTokenUsage();
        return sessionTokens.get(provider) || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }

    /**
     * Get current provider and model with API key status
     */
    getCurrentProviderInfo(): { provider: string; model: string; available: boolean; apiKeyConfigured?: boolean; setupInstructions?: string } {
        let apiKeyConfigured = false;
        let setupInstructions = '';
        
        if (this.cliAvailable) {
            const apiKeyStatus = this.cliIntegration.getApiKeyStatus();
            apiKeyConfigured = apiKeyStatus[this.activeProvider] || false;
            setupInstructions = this.cliIntegration.getSetupInstructions(this.activeProvider);
        }
        
        return {
            provider: this.activeProvider,
            model: this.activeModel,
            available: this.cliAvailable,
            apiKeyConfigured,
            setupInstructions
        };
    }
}

export default PrompdChatServiceSimple;
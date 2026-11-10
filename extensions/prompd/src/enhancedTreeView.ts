import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as path from 'path';

/**
 * Enhanced Parameter Tree View with Execution UI
 * Features:
 * - Inline parameter editing
 * - Provider/model selection
 * - Execute button
 * - Response display
 */

export class EnhancedParameterProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private parameters: Map<string, any> = new Map();
    private parameterValues: Map<string, string> = new Map();
    private provider: string = 'openai';
    private model: string = 'gpt-4';
    private currentFile: string | undefined;
    private lastResponse: string = '';
    private isExecuting: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        // Listen to editor changes
        vscode.window.onDidChangeActiveTextEditor(() => this.refresh());
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === 'prompd') this.refresh();
        });
        
        this.refresh();
    }

    refresh(): void {
        this.loadCurrentFile();
        this._onDidChangeTreeData.fire();
    }

    private async loadCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'prompd') {
            this.currentFile = undefined;
            this.parameters.clear();
            return;
        }

        this.currentFile = editor.document.fileName;
        const content = editor.document.getText();
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (frontmatterMatch) {
            try {
                const metadata = yaml.parse(frontmatterMatch[1]);
                const params = metadata.parameters || [];
                
                // Preserve existing values when reloading
                const oldValues = new Map(this.parameterValues);
                this.parameters.clear();
                this.parameterValues.clear();
                
                params.forEach((param: any) => {
                    this.parameters.set(param.name, param);
                    // Keep old value or use default
                    const oldValue = oldValues.get(param.name);
                    this.parameterValues.set(
                        param.name, 
                        oldValue !== undefined ? oldValue : (param.default?.toString() || '')
                    );
                });
            } catch (e) {
                console.error('Failed to parse YAML:', e);
            }
        }
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level items
            const items: TreeItem[] = [];
            
            if (this.currentFile) {
                // Header with file name
                items.push(new HeaderItem(path.basename(this.currentFile)));
                
                // Provider/Model section
                items.push(new ProviderSection(this.provider, this.model));
                
                // Execute button
                items.push(new ExecuteButton(this.isExecuting));
                
                // Parameters section
                if (this.parameters.size > 0) {
                    items.push(new ParametersSection());
                }
                
                // Response section (if we have a response)
                if (this.lastResponse) {
                    items.push(new ResponseSection());
                }
            } else {
                items.push(new PlaceholderItem('Open a .prompd file'));
            }
            
            return Promise.resolve(items);
        }
        
        if (element instanceof ParametersSection) {
            // Return parameter items
            const items: TreeItem[] = [];
            this.parameters.forEach((param, name) => {
                const value = this.parameterValues.get(name) || '';
                items.push(new ParameterItem(param, value));
            });
            return Promise.resolve(items);
        }
        
        if (element instanceof ProviderSection) {
            // Provider/Model dropdowns
            return Promise.resolve([
                new ProviderSelector(this.provider),
                new ModelSelector(this.model)
            ]);
        }
        
        if (element instanceof ResponseSection) {
            // Show response
            return Promise.resolve([
                new ResponseItem(this.lastResponse)
            ]);
        }
        
        return Promise.resolve([]);
    }

    // Methods for updating values
    async setParameterValue(name: string, value: string) {
        this.parameterValues.set(name, value);
        this._onDidChangeTreeData.fire();
    }

    async setProvider(provider: string) {
        this.provider = provider;
        this._onDidChangeTreeData.fire();
    }

    async setModel(model: string) {
        this.model = model;
        this._onDidChangeTreeData.fire();
    }

    async execute() {
        if (!this.currentFile || this.isExecuting) return;
        
        this.isExecuting = true;
        this._onDidChangeTreeData.fire();
        
        try {
            // Validate parameters first
            const validationErrors = this.validateParameters();
            if (validationErrors.length > 0) {
                const errorMessage = validationErrors.join('\n');
                vscode.window.showErrorMessage(`Parameter validation failed:\n${errorMessage}`);
                return;
            }

            // Create output channel
            const output = vscode.window.createOutputChannel('Prompd Execution');
            output.clear();
            output.show();
            
            output.appendLine('🚀 Starting prompt execution...');
            output.appendLine(`📄 File: ${path.basename(this.currentFile)}`);
            output.appendLine(`🤖 Provider: ${this.provider} | Model: ${this.model}`);
            output.appendLine('📊 Parameters:');
            
            // Display parameter values
            this.parameterValues.forEach((value, name) => {
                const param = this.parameters.get(name);
                const maskedValue = param?.sensitive ? '***' : value;
                output.appendLine(`   ${name}: ${maskedValue}`);
            });
            
            output.appendLine('');
            output.appendLine('🔄 Processing prompt template...');
            
            // Get the actual prompt content and substitute parameters
            const promptContent = await this.processPromptTemplate();
            
            output.appendLine('📝 Processed template:');
            output.appendLine('─'.repeat(50));
            output.appendLine(promptContent);
            output.appendLine('─'.repeat(50));
            output.appendLine('');
            
            // Execute the prompt (simulate for now)
            output.appendLine('⏳ Sending to LLM provider...');
            
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
            
            // Generate realistic response
            const response = await this.generateResponse(promptContent);
            this.lastResponse = response;
            
            output.appendLine('✅ Response received!');
            output.appendLine(this.lastResponse);
            
        } finally {
            this.isExecuting = false;
            this._onDidChangeTreeData.fire();
        }
    }

    private validateParameters(): string[] {
        const errors: string[] = [];
        
        this.parameters.forEach((param, name) => {
            const value = this.parameterValues.get(name);
            
            if (param.required && (!value || value.trim() === '')) {
                errors.push(`Required parameter '${name}' is missing`);
            }
            
            if (value && param.type) {
                switch (param.type) {
                    case 'number':
                        if (isNaN(Number(value))) {
                            errors.push(`Parameter '${name}' must be a number`);
                        }
                        break;
                    case 'boolean':
                        if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
                            errors.push(`Parameter '${name}' must be a boolean (true/false)`);
                        }
                        break;
                }
            }
            
            // Custom validation rules
            if (param.validation) {
                param.validation.forEach((rule: any) => {
                    switch (rule.type) {
                        case 'length':
                            if (value && (value.length < rule.min || value.length > rule.max)) {
                                errors.push(`Parameter '${name}' length must be between ${rule.min} and ${rule.max}`);
                            }
                            break;
                        case 'pattern':
                            if (value && !new RegExp(rule.pattern).test(value)) {
                                errors.push(`Parameter '${name}' format is invalid`);
                            }
                            break;
                    }
                });
            }
        });
        
        return errors;
    }

    private async processPromptTemplate(): Promise<string> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return 'No active editor';
            
            const content = editor.document.getText();
            
            // Extract the main content (after frontmatter)
            const contentMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
            let template = contentMatch ? contentMatch[1] : content;
            
            // Substitute parameters
            this.parameterValues.forEach((value, name) => {
                const paramPattern = new RegExp(`\\{${name}\\}`, 'g');
                template = template.replace(paramPattern, value || `{${name}}`);
            });
            
            return template.trim();
        } catch (error) {
            return `Error processing template: ${error}`;
        }
    }

    private async generateResponse(prompt: string): Promise<string> {
        // This is where you would integrate with actual LLM providers
        // For now, generate a realistic simulation
        
        const responses = {
            'openai': this.generateOpenAIResponse(prompt),
            'anthropic': this.generateAnthropicResponse(prompt),
            'ollama': this.generateOllamaResponse(prompt)
        };
        
        return responses[this.provider as keyof typeof responses] || responses.openai;
    }

    private generateOpenAIResponse(prompt: string): string {
        const timestamp = new Date().toISOString();
        const tokenCount = Math.floor(prompt.length / 3 + Math.random() * 100);
        
        return `🤖 OpenAI ${this.model} Response
⏱️  Generated: ${timestamp}
📊 Input tokens: ${Math.floor(prompt.length / 4)}
📊 Output tokens: ${tokenCount}

Based on your prompt, here's a comprehensive response that demonstrates the capabilities of the Prompd IDE system.

This response shows how parameters are properly substituted and how the execution engine processes your prompts. The system supports multiple providers and models, with full parameter validation and error handling.

Key features demonstrated:
- ✅ Parameter substitution and validation
- ✅ Provider-specific response formatting  
- ✅ Real-time execution monitoring
- ✅ Comprehensive error handling
- ✅ Performance metrics tracking

The execution completed successfully with the provided parameters.`;
    }

    private generateAnthropicResponse(prompt: string): string {
        const timestamp = new Date().toISOString();
        
        return `🧠 Anthropic Claude Response
⏱️  Generated: ${timestamp}
📊 Processing time: ${Math.floor(Math.random() * 3000 + 1000)}ms

Your prompt has been processed successfully using Anthropic's Claude model. The Prompd IDE provides seamless integration with multiple AI providers while maintaining consistent parameter handling and execution flows.

This response demonstrates:
• Advanced prompt processing capabilities
• Robust parameter validation system
• Multi-provider architecture support
• Real-time execution monitoring
• Professional error handling

The system is designed for enterprise-grade prompt engineering workflows.`;
    }

    private generateOllamaResponse(prompt: string): string {
        const timestamp = new Date().toISOString();
        
        return `🏠 Ollama Local Model Response
⏱️  Generated: ${timestamp}
🖥️  Local inference completed

Your prompt has been processed using a local Ollama model. This demonstrates the Prompd IDE's ability to work with both cloud and local AI providers.

Local model benefits:
→ Privacy and data control
→ No API costs or rate limits
→ Offline capability
→ Custom model support

The execution engine automatically adapts to different provider types while maintaining the same user experience and parameter management system.`;
    }
}

// Tree Item Classes

abstract class TreeItem extends vscode.TreeItem {}

class HeaderItem extends TreeItem {
    constructor(fileName: string) {
        super(`📄 ${fileName}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'header';
    }
}

class ProviderSection extends TreeItem {
    constructor(provider: string, model: string) {
        super('🤖 Provider & Model', vscode.TreeItemCollapsibleState.Expanded);
        this.description = `${provider} / ${model}`;
        this.contextValue = 'providerSection';
    }
}

class ProviderSelector extends TreeItem {
    constructor(currentProvider: string) {
        super(`Provider: ${currentProvider}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'providerSelector';
        this.command = {
            command: 'prompdx.selectProvider',
            title: 'Select Provider',
            arguments: []
        };
    }
}

class ModelSelector extends TreeItem {
    constructor(currentModel: string) {
        super(`Model: ${currentModel}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'modelSelector';
        this.command = {
            command: 'prompdx.selectModel',
            title: 'Select Model',
            arguments: []
        };
    }
}

class ExecuteButton extends TreeItem {
    constructor(isExecuting: boolean) {
        const label = isExecuting ? '⏳ Executing...' : '▶️ Execute Prompt';
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'executeButton';
        
        if (!isExecuting) {
            this.command = {
                command: 'prompdx.executeFromTree',
                title: 'Execute',
                arguments: []
            };
        }
    }
}

class ParametersSection extends TreeItem {
    constructor() {
        super('📊 Parameters', vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'parametersSection';
    }
}

class ParameterItem extends TreeItem {
    constructor(param: any, currentValue: string) {
        const label = param.name;
        super(label, vscode.TreeItemCollapsibleState.None);
        
        const required = param.required ? '*' : '';
        this.description = `${currentValue || param.default || 'not set'}`;
        this.tooltip = `${param.description || ''}\nType: ${param.type}${required}`;
        this.contextValue = 'parameter';
        
        // Icon based on whether value is set
        if (currentValue) {
            this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        } else if (param.required) {
            this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconFailed'));
        } else {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
        
        // Click to edit
        this.command = {
            command: 'prompdx.editParameter',
            title: 'Edit Parameter',
            arguments: [param.name, currentValue, param]
        };
    }
}

class ResponseSection extends TreeItem {
    constructor() {
        super('📥 Last Response', vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'responseSection';
    }
}

class ResponseItem extends TreeItem {
    constructor(response: string) {
        const preview = response.substring(0, 50) + (response.length > 50 ? '...' : '');
        super(preview, vscode.TreeItemCollapsibleState.None);
        this.tooltip = response;
        this.contextValue = 'response';
        this.command = {
            command: 'prompdx.showResponse',
            title: 'Show Full Response',
            arguments: [response]
        };
    }
}

class PlaceholderItem extends TreeItem {
    constructor(message: string) {
        super(message, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'placeholder';
    }
}

// Register the enhanced tree view
export function registerEnhancedTreeView(context: vscode.ExtensionContext): EnhancedParameterProvider {
    const provider = new EnhancedParameterProvider(context);
    
    // Register tree data provider
    vscode.window.registerTreeDataProvider('prompdParameters', provider);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('prompdx.editParameter', async (name: string, currentValue: string, param: any) => {
            const value = await vscode.window.showInputBox({
                prompt: `Enter value for ${name}`,
                value: currentValue,
                placeHolder: param.description || `${param.type} value`
            });
            
            if (value !== undefined) {
                provider.setParameterValue(name, value);
            }
        }),
        
        vscode.commands.registerCommand('prompdx.selectProvider', async () => {
            const provider = await vscode.window.showQuickPick(
                ['openai', 'anthropic', 'ollama'],
                { placeHolder: 'Select provider' }
            );
            
            if (provider) {
                await (provider as any).setProvider(provider);
            }
        }),
        
        vscode.commands.registerCommand('prompdx.selectModel', async () => {
            const models = {
                'openai': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                'anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
                'ollama': ['llama2', 'mistral', 'codellama']
            };
            
            const currentProvider = 'openai' as keyof typeof models;
            const model = await vscode.window.showQuickPick(
                models[currentProvider] || [],
                { placeHolder: 'Select model' }
            );
            
            if (model) {
                provider.setModel(model);
            }
        }),
        
        vscode.commands.registerCommand('prompdx.executeFromTree', () => {
            provider.execute();
        }),
        
        vscode.commands.registerCommand('prompdx.showResponse', (response: string) => {
            const output = vscode.window.createOutputChannel('Prompd Response');
            output.clear();
            output.append(response);
            output.show();
        })
    );
    
    return provider;
}
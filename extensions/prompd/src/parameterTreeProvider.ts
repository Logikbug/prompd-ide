import * as vscode from 'vscode';
import * as path from 'path';
// Import types and functions from extension
export interface ParameterInfo {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    default?: any;
    value?: string;
}

export class ParameterTreeItem extends vscode.TreeItem {
    constructor(
        public readonly parameter: ParameterInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent?: ParameterSectionItem
    ) {
        super(`${parameter.name}${parameter.required ? ' *' : ''}`, collapsibleState);
        
        this.contextValue = 'parameter';
        this.tooltip = this.generateTooltip();
        this.description = this.generateDescription();
        this.iconPath = this.getIcon();
        
        // Add command to edit parameter
        this.command = {
            command: 'prompdx.editParameter',
            title: 'Edit Parameter',
            arguments: [this]
        };
    }

    private generateTooltip(): string {
        const lines = [`${this.parameter.name} (${this.parameter.type})`];
        if (this.parameter.description) {
            lines.push(this.parameter.description);
        }
        if (this.parameter.required) {
            lines.push('Required');
        }
        if (this.parameter.default !== undefined) {
            lines.push(`Default: ${this.parameter.default}`);
        }
        return lines.join('\n');
    }

    private generateDescription(): string {
        if (this.parameter.value !== undefined && this.parameter.value !== '') {
            return this.parameter.value;
        }
        if (this.parameter.default !== undefined) {
            return `${this.parameter.default} (default)`;
        }
        return `${this.parameter.type}`;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.parameter.required && (!this.parameter.value || this.parameter.value === '')) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('errorForeground'));
        }
        if (this.parameter.value !== undefined && this.parameter.value !== '') {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiGreen'));
        }
        return new vscode.ThemeIcon('symbol-parameter');
    }
}

export class ProviderSectionItem extends vscode.TreeItem {
    constructor(
        public provider: string,
        public model: string
    ) {
        super('Provider & Model', vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'providerSection';
        this.description = `${provider} | ${model}`;
        this.iconPath = new vscode.ThemeIcon('server');
        this.tooltip = `Provider: ${provider}\nModel: ${model}`;
    }
}

export class ParameterSectionItem extends vscode.TreeItem {
    constructor(public readonly parameters: ParameterInfo[]) {
        super(`Parameters (${parameters.length})`, 
              parameters.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'parameterSection';
        this.iconPath = new vscode.ThemeIcon('symbol-parameter');
        
        const filled = parameters.filter(p => p.value !== undefined && p.value !== '').length;
        const required = parameters.filter(p => p.required).length;
        this.description = `${filled}/${parameters.length} filled${required > 0 ? `, ${required} required` : ''}`;
    }
}

export class ActionItem extends vscode.TreeItem {
    constructor(
        public readonly actionType: 'execute' | 'executeAdhoc' | 'configure',
        label: string,
        icon: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = actionType;
        this.iconPath = new vscode.ThemeIcon(icon);
        
        const commandMap = {
            'execute': 'prompdx.executeFromTree',
            'executeAdhoc': 'prompdx.executeAdhoc',
            'configure': 'prompdx.configure'
        };
        
        this.command = {
            command: commandMap[actionType as keyof typeof commandMap] || `prompdx.${actionType}`,
            title: label,
            arguments: [this]
        };
    }
}

export class ParameterTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private parameters: ParameterInfo[] = [];
    private provider: string = 'openai';
    private model: string = 'gpt-4';
    private currentFile?: string;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Root level
            return Promise.resolve(this.getRootItems());
        }

        if (element instanceof ParameterSectionItem) {
            return Promise.resolve(
                element.parameters.map(param => new ParameterTreeItem(param, vscode.TreeItemCollapsibleState.None, element))
            );
        }

        return Promise.resolve([]);
    }

    private getRootItems(): vscode.TreeItem[] {
        const items: vscode.TreeItem[] = [];

        // Provider section
        items.push(new ProviderSectionItem(this.provider, this.model));

        // Parameters section
        if (this.parameters.length > 0) {
            items.push(new ParameterSectionItem(this.parameters));
        }

        // Actions section
        items.push(new ActionItem('execute', 'Execute .prompd File', 'play'));
        items.push(new ActionItem('executeAdhoc', 'Execute Adhoc Prompt', 'edit'));
        items.push(new ActionItem('configure', 'Configure Provider', 'settings-gear'));

        return items;
    }

    async updateFromActiveEditor(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        
        if (editor && editor.document.languageId === 'prompd') {
            this.currentFile = editor.document.fileName;
            
            // Extract parameters from the file
            const content = editor.document.getText();
            const extractedParams = await this.extractParametersFromContent(content);
            
            // Merge with existing values
            this.parameters = extractedParams.map(param => {
                const existing = this.parameters.find(p => p.name === param.name);
                return {
                    ...param,
                    value: existing?.value || param.default?.toString() || ''
                };
            });
        } else {
            this.currentFile = undefined;
            this.parameters = [];
        }

        this.refresh();
    }

    private async extractParametersFromContent(content: string): Promise<ParameterInfo[]> {
        // This should use the same logic as your existing extractParameters function
        try {
            const yaml = require('yaml');
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) {
                return [];
            }

            const metadata = yaml.parse(frontmatterMatch[1]);
            return metadata.parameters || [];
        } catch {
            return [];
        }
    }

    // Parameter management methods
    setParameterValue(parameterName: string, value: string): void {
        const param = this.parameters.find(p => p.name === parameterName);
        if (param) {
            param.value = value;
            this.refresh();
        }
    }

    getParameterValues(): Record<string, string> {
        const values: Record<string, string> = {};
        this.parameters.forEach(param => {
            values[param.name] = param.value || param.default?.toString() || '';
        });
        return values;
    }

    // Provider/Model management
    setProvider(provider: string): void {
        this.provider = provider;
        this.refresh();
    }

    setModel(model: string): void {
        this.model = model;
        this.refresh();
    }

    getProvider(): string {
        return this.provider;
    }

    getModel(): string {
        return this.model;
    }

    getCurrentFile(): string | undefined {
        return this.currentFile;
    }

    getParameters(): ParameterInfo[] {
        return this.parameters;
    }
}

export class ParameterTreeView {
    private treeView: vscode.TreeView<vscode.TreeItem>;
    private provider: ParameterTreeDataProvider;

    constructor(private context: vscode.ExtensionContext) {
        this.provider = new ParameterTreeDataProvider(context);
        
        this.treeView = vscode.window.createTreeView('prompdxParametersNative', {
            treeDataProvider: this.provider,
            showCollapseAll: true,
            canSelectMany: false
        });

        this.registerCommands();
        this.setupEventListeners();
        
        // Initial update
        this.provider.updateFromActiveEditor();
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('prompdx.editParameter', async (item: ParameterTreeItem) => {
                const value = await vscode.window.showInputBox({
                    prompt: `Enter value for ${item.parameter.name}`,
                    value: item.parameter.value || item.parameter.default?.toString() || '',
                    placeHolder: item.parameter.description || `${item.parameter.type} value`,
                    validateInput: (value) => {
                        if (item.parameter.required && (!value || value.trim() === '')) {
                            return 'This parameter is required';
                        }
                        return undefined;
                    }
                });
                
                if (value !== undefined) {
                    this.provider.setParameterValue(item.parameter.name, value);
                }
            }),

            vscode.commands.registerCommand('prompdx.executeFromTree', async () => {
                const currentFile = this.provider.getCurrentFile();
                if (!currentFile) {
                    vscode.window.showErrorMessage('No .prompd file is open');
                    return;
                }

                // Import dynamically to avoid circular dependency
                const { executeAndCaptureResponse } = await import('./extension');
                await executeAndCaptureResponse(
                    currentFile,
                    this.provider.getProvider(),
                    this.provider.getModel(),
                    this.provider.getParameterValues()
                );
            }),

            vscode.commands.registerCommand('prompdx.executeAdhoc', async () => {
                const prompt = await vscode.window.showInputBox({
                    prompt: 'Enter your adhoc prompt',
                    placeHolder: 'You can use {parameter_name} syntax...',
                    valueSelection: undefined
                });

                if (!prompt) return;

                // Create temp file similar to webview implementation
                const tempContent = `---
name: adhoc-prompt
description: Temporary adhoc prompt
parameters: []
---

${prompt}`;

                const randomBytes = require('crypto').randomBytes;
                const randomId = randomBytes(16).toString('hex');
                const tempUri = vscode.Uri.file(path.join(require('os').tmpdir(), `prompd-adhoc-${randomId}.prompd`));
                
                await vscode.workspace.fs.writeFile(tempUri, Buffer.from(tempContent));
                
                try {
                    const { executeAndCaptureResponse } = await import('./extension');
                    await executeAndCaptureResponse(
                        tempUri.fsPath,
                        this.provider.getProvider(),
                        this.provider.getModel(),
                        this.provider.getParameterValues()
                    );
                } finally {
                    // Clean up
                    try {
                        await vscode.workspace.fs.delete(tempUri);
                    } catch {}
                }
            }),

            vscode.commands.registerCommand('prompdx.configure', async () => {
                const provider = await vscode.window.showQuickPick(
                    ['openai', 'anthropic', 'ollama'],
                    { placeHolder: 'Select LLM provider' }
                );

                if (!provider) return;

                const models = {
                    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
                    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
                    ollama: ['llama2', 'mistral', 'codellama', 'mixtral']
                };

                const model = await vscode.window.showQuickPick(
                    models[provider as keyof typeof models],
                    { placeHolder: `Select ${provider} model` }
                );

                if (!model) return;

                this.provider.setProvider(provider);
                this.provider.setModel(model);
            }),

            vscode.commands.registerCommand('prompdx.refreshParameters', () => {
                this.provider.updateFromActiveEditor();
            })
        );
    }

    private setupEventListeners(): void {
        // Update when active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.provider.updateFromActiveEditor();
        });

        // Update when .prompd files are saved
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === 'prompd') {
                this.provider.updateFromActiveEditor();
            }
        });
    }

    dispose(): void {
        this.treeView.dispose();
    }
}
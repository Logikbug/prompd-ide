import * as vscode from 'vscode';
import * as yaml from 'yaml';

/**
 * Parameters Provider for Execute Sidebar
 * Shows editable parameter table bound to .prompd file
 */

interface Parameter {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    default?: any;
    value?: any;
}

class ParameterItem extends vscode.TreeItem {
    constructor(
        public readonly parameter: Parameter,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(parameter.name, collapsibleState);
        
        this.description = this.getDescription();
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = `parameter.${parameter.required ? 'required' : 'optional'}`;
        this.command = {
            command: 'prompd.editParameter',
            title: 'Edit Parameter',
            arguments: [parameter]
        };
    }

    private getDescription(): string {
        const value = this.parameter.value ?? this.parameter.default ?? '';
        const type = this.parameter.type;
        const req = this.parameter.required ? '*' : '';
        return `${req}${type}: ${value}`;
    }

    private getTooltip(): string {
        const lines = [
            `Parameter: ${this.parameter.name}`,
            `Type: ${this.parameter.type}`,
            `Required: ${this.parameter.required ? 'Yes' : 'No'}`
        ];
        
        if (this.parameter.description) {
            lines.push(`Description: ${this.parameter.description}`);
        }
        
        if (this.parameter.default !== undefined) {
            lines.push(`Default: ${this.parameter.default}`);
        }
        
        if (this.parameter.value !== undefined) {
            lines.push(`Current Value: ${this.parameter.value}`);
        }
        
        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.parameter.required) {
            return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('errorForeground'));
        } else {
            return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('descriptionForeground'));
        }
    }
}

export class ParametersProvider implements vscode.TreeDataProvider<ParameterItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ParameterItem | undefined | null | void> = new vscode.EventEmitter<ParameterItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ParameterItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private parameters: Parameter[] = [];
    private currentDocument: vscode.TextDocument | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.watchActiveEditor();
        this.registerCommands();
    }

    public static create(context: vscode.ExtensionContext): ParametersProvider {
        return new ParametersProvider(context);
    }

    private watchActiveEditor() {
        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.languageId === 'prompd') {
                this.loadParametersFromDocument(editor.document);
            } else {
                this.clearParameters();
            }
        });

        // Watch for document changes
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.languageId === 'prompd' && e.document === this.currentDocument) {
                this.loadParametersFromDocument(e.document);
            }
        });

        // Load current editor if it's a .prompd file
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document && activeEditor.document.languageId === 'prompd') {
                this.loadParametersFromDocument(activeEditor.document);
            } else {
                // No active editor or not a prompd file, clear parameters
                this.clearParameters();
            }
        } catch (error) {
            console.error('Error loading initial editor:', error);
            this.clearParameters();
        }
    }

    private registerCommands() {
        const editParameterCommand = vscode.commands.registerCommand('prompd.editParameter', async (parameter: Parameter) => {
            await this.editParameter(parameter);
        });

        const addParameterCommand = vscode.commands.registerCommand('prompd.addParameter', async () => {
            await this.addParameter();
        });

        const runWithParametersCommand = vscode.commands.registerCommand('prompd.runWithParameters', async () => {
            await this.runWithParameters();
        });

        this.context.subscriptions.push(editParameterCommand, addParameterCommand, runWithParametersCommand);
    }

    private async loadParametersFromDocument(document: vscode.TextDocument) {
        this.currentDocument = document;
        
        try {
            const text = document.getText();
            const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
            
            if (frontmatterMatch) {
                const metadata = yaml.parse(frontmatterMatch[1]);
                this.parameters = metadata.parameters || [];
            } else {
                this.parameters = [];
            }
        } catch (error) {
            console.error('Error parsing parameters:', error);
            this.parameters = [];
        }
        
        this.refresh();
    }

    private clearParameters() {
        this.currentDocument = undefined;
        this.parameters = [];
        this.refresh();
    }

    private async editParameter(parameter: Parameter) {
        const newValue = await vscode.window.showInputBox({
            title: `Edit Parameter: ${parameter.name}`,
            prompt: `Enter value for ${parameter.name} (${parameter.type})`,
            value: parameter.value?.toString() || parameter.default?.toString() || '',
            placeHolder: parameter.description || `Enter ${parameter.type} value`,
            validateInput: (value) => {
                if (parameter.required && !value.trim()) {
                    return 'This parameter is required';
                }
                return this.validateParameterValue(value, parameter.type);
            }
        });

        if (newValue !== undefined) {
            parameter.value = this.convertValue(newValue, parameter.type);
            this.refresh();
        }
    }

    private async addParameter() {
        if (!this.currentDocument) {
            vscode.window.showErrorMessage('Open a .prompd file to add parameters');
            return;
        }

        const name = await vscode.window.showInputBox({
            title: 'Add Parameter',
            prompt: 'Enter parameter name',
            validateInput: (value) => {
                if (!value.trim()) return 'Parameter name required';
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) return 'Invalid parameter name';
                if (this.parameters.find(p => p.name === value)) return 'Parameter already exists';
                return null;
            }
        });

        if (!name) return;

        const type = await vscode.window.showQuickPick(
            ['string', 'number', 'boolean', 'enum', 'array'],
            { title: 'Select parameter type' }
        );

        if (!type) return;

        const newParameter: Parameter = {
            name,
            type,
            required: false,
            description: `${name} parameter`
        };

        // Add to current parameters and update document
        this.parameters.push(newParameter);
        await this.updateDocumentParameters();
    }

    private async runWithParameters() {
        if (!this.currentDocument) {
            vscode.window.showErrorMessage('No .prompd file open');
            return;
        }

        // Check if all required parameters have values
        const missingRequired = this.parameters.filter(p => p.required && !p.value && !p.default);
        if (missingRequired.length > 0) {
            vscode.window.showErrorMessage(`Missing required parameters: ${missingRequired.map(p => p.name).join(', ')}`);
            return;
        }

        // Execute the prompt with current parameter values
        vscode.window.showInformationMessage('🚀 Executing prompt with parameters...');
        
        // This would integrate with the actual execution engine
        console.log('Executing with parameters:', this.parameters);
    }

    private async updateDocumentParameters() {
        if (!this.currentDocument) return;

        const editor = vscode.window.visibleTextEditors.find(e => e.document === this.currentDocument);
        if (!editor) return;

        const text = this.currentDocument.getText();
        const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
        
        if (frontmatterMatch) {
            try {
                const metadata = yaml.parse(frontmatterMatch[1]);
                metadata.parameters = this.parameters;
                const newFrontmatter = yaml.stringify(metadata);
                const newText = text.replace(/^---\n[\s\S]*?\n---/, `---\n${newFrontmatter}---`);
                
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                
                await editor.edit(editBuilder => {
                    editBuilder.replace(fullRange, newText);
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error updating parameters: ${error}`);
            }
        }
    }

    private validateParameterValue(value: string, type: string): string | null {
        switch (type) {
            case 'number':
                if (value.trim() && isNaN(Number(value))) {
                    return 'Must be a valid number';
                }
                break;
            case 'boolean':
                if (value.trim() && !['true', 'false'].includes(value.toLowerCase())) {
                    return 'Must be true or false';
                }
                break;
        }
        return null;
    }

    private convertValue(value: string, type: string): any {
        switch (type) {
            case 'number':
                return value.trim() ? Number(value) : undefined;
            case 'boolean':
                return value.toLowerCase() === 'true';
            case 'array':
                try {
                    return JSON.parse(value);
                } catch {
                    return value.split(',').map(s => s.trim());
                }
            default:
                return value;
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ParameterItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ParameterItem): Thenable<ParameterItem[]> {
        try {
            if (!element) {
                if (!this.parameters || this.parameters.length === 0) {
                    return Promise.resolve([]);
                }
                return Promise.resolve(
                    this.parameters.map(param => new ParameterItem(param))
                );
            }
            return Promise.resolve([]);
        } catch (error) {
            console.error('Error in getChildren:', error);
            return Promise.resolve([]);
        }
    }
}
import * as vscode from 'vscode';
import * as yaml from 'yaml';

export class SimpleParameterProvider implements vscode.TreeDataProvider<ParameterItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ParameterItem | undefined | null | void> = new vscode.EventEmitter<ParameterItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ParameterItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private parameters: any[] = [];

    constructor() {
        // Update when active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => this.refresh());
        
        // Update when document is saved
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === 'prompd') {
                this.refresh();
            }
        });
        
        // Initial load
        this.refresh();
    }

    refresh(): void {
        this.loadParameters();
        this._onDidChangeTreeData.fire();
    }

    private async loadParameters() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'prompd') {
            this.parameters = [];
            return;
        }

        const content = editor.document.getText();
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (frontmatterMatch) {
            try {
                const metadata = yaml.parse(frontmatterMatch[1]);
                this.parameters = metadata.parameters || [];
            } catch {
                this.parameters = [];
            }
        }
    }

    getTreeItem(element: ParameterItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ParameterItem): Thenable<ParameterItem[]> {
        if (!element) {
            // Root level - return parameters
            return Promise.resolve(
                this.parameters.map(param => new ParameterItem(param))
            );
        }
        return Promise.resolve([]);
    }
}

class ParameterItem extends vscode.TreeItem {
    constructor(
        public readonly parameter: any
    ) {
        super(parameter.name, vscode.TreeItemCollapsibleState.None);
        
        const required = parameter.required ? ' *' : '';
        const defaultVal = parameter.default ? ` = ${parameter.default}` : '';
        
        this.description = `${parameter.type}${required}${defaultVal}`;
        this.tooltip = parameter.description || `${parameter.name} (${parameter.type})`;
        this.contextValue = 'parameter';
        
        // Icon based on type
        switch(parameter.type) {
            case 'string':
                this.iconPath = new vscode.ThemeIcon('symbol-string');
                break;
            case 'number':
                this.iconPath = new vscode.ThemeIcon('symbol-number');
                break;
            case 'boolean':
                this.iconPath = new vscode.ThemeIcon('symbol-boolean');
                break;
            case 'array':
                this.iconPath = new vscode.ThemeIcon('symbol-array');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('symbol-parameter');
        }
    }
}
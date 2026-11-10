import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Prompd IDE Workbench Implementation
 * Based on the Figma design - Professional prompt engineering environment
 */

export class PrompdWorkbench {
    private static instance: PrompdWorkbench;
    private variablesProvider: VariablesProvider;
    private workspaceFilesProvider: WorkspaceFilesProvider;
    private workspaceTemplatesProvider: WorkspaceTemplatesProvider;
    private parametersWebview: vscode.WebviewPanel | undefined;
    private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();

    private constructor(private context: vscode.ExtensionContext) {
        this.variablesProvider = new VariablesProvider();
        this.workspaceFilesProvider = new WorkspaceFilesProvider(context);
        this.workspaceTemplatesProvider = new WorkspaceTemplatesProvider(context);
        this.initializeWorkbench();
    }

    public static activate(context: vscode.ExtensionContext): PrompdWorkbench {
        if (!PrompdWorkbench.instance) {
            PrompdWorkbench.instance = new PrompdWorkbench(context);
        }
        return PrompdWorkbench.instance;
    }

    private initializeWorkbench() {
        // Re-register with our enhanced providers (views already exist from extension activation)
        try {
            vscode.window.registerTreeDataProvider('prompdVariables', this.variablesProvider);
            vscode.window.registerTreeDataProvider('prompdFiles', this.workspaceFilesProvider);
            vscode.window.registerTreeDataProvider('prompdTemplates', this.workspaceTemplatesProvider);
            console.log('✅ Enhanced providers registered');
        } catch (error) {
            console.log('⚠️ Views already registered, using enhanced providers');
        }
        
        // Create status bar items
        this.createStatusBar();
        
        // Register commands
        this.registerCommands();
        
        // Initialize parameters panel
        this.initializeParametersPanel();
    }

    private createStatusBar() {
        // Token counter - disabled to reduce status bar clutter
        // const tokenStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        // tokenStatus.text = '$(symbol-misc) 142 tokens';
        // tokenStatus.tooltip = 'System and User token count';
        // tokenStatus.show();
        // this.statusBarItems.set('tokens', tokenStatus);

        // Run button - disabled to reduce status bar clutter
        // const runButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
        // runButton.text = '$(run) Run';
        // runButton.command = 'prompd.runPrompt';
        // runButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        // runButton.tooltip = 'Execute current prompt';
        // runButton.show();
        // this.statusBarItems.set('run', runButton);

        // Ready indicator - disabled to reduce status bar clutter  
        // const readyStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        // readyStatus.text = '$(check) Ready';
        // readyStatus.color = '#4CAF50';
        // readyStatus.tooltip = 'Prompd IDE is ready';
        // readyStatus.show();
        // this.statusBarItems.set('ready', readyStatus);
    }

    private registerCommands() {
        // Run command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('prompd.runPrompt', () => this.runPrompt())
        );

        // Run section command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('prompd.runSection', () => this.runSection())
        );

        // Add variable command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('prompd.addVariable', () => this.addVariable())
        );

        // Parameter commands now handled by ParametersProvider

        // Show console command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('prompd.showConsole', () => this.showConsole())
        );

        // Create from template command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('prompd.createFromTemplate', (templateName: string) => this.createFromTemplate(templateName))
        );
    }

    private async runPrompt() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Update status - disabled since status bar items are disabled
        // const runButton = this.statusBarItems.get('run');
        // if (runButton) {
        //     runButton.text = '$(sync~spin) Running...';
        // }

        // Get the prompt content
        const content = editor.document.getText();
        
        // Extract variables
        const variables = this.extractVariables(content);
        this.variablesProvider.updateVariables(variables);

        // Create output channel
        const output = vscode.window.createOutputChannel('Prompd Execution');
        output.clear();
        output.show();

        output.appendLine('═══════════════════════════════════════════');
        output.appendLine('  PROMPD EXECUTION STARTED');
        output.appendLine('═══════════════════════════════════════════');
        output.appendLine('');
        output.appendLine(`📄 File: ${path.basename(editor.document.fileName)}`);
        output.appendLine(`⏱️  Time: ${new Date().toISOString()}`);
        output.appendLine('');
        output.appendLine('📊 DETECTED VARIABLES:');
        variables.forEach(v => {
            output.appendLine(`   • ${v.name} (${v.type}) - ${v.usage}`);
        });
        output.appendLine('');
        output.appendLine('🔄 PROCESSING...');
        
        // Simulate execution
        await new Promise(resolve => setTimeout(resolve, 2000));

        output.appendLine('');
        output.appendLine('✅ EXECUTION COMPLETE');
        output.appendLine('');
        output.appendLine('📤 RESPONSE:');
        output.appendLine('─'.repeat(50));
        output.appendLine('This is a sample response demonstrating the Prompd IDE');
        output.appendLine('execution environment with professional output formatting.');
        output.appendLine('─'.repeat(50));

        // Update token count - disabled since status bar items are disabled
        // const tokenStatus = this.statusBarItems.get('tokens');
        // if (tokenStatus) {
        //     tokenStatus.text = '$(symbol-misc) 247 tokens';
        // }

        // Reset run button - disabled since status bar items are disabled
        // if (runButton) {
        //     runButton.text = '$(run) Run';
        // }
    }

    private async runSection() {
        // Run only the selected section
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            vscode.window.showWarningMessage('Please select a section to run');
            return;
        }

        vscode.window.showInformationMessage(`Running section: ${selectedText.substring(0, 50)}...`);
    }

    private extractVariables(content: string): VariableInfo[] {
        const variables: VariableInfo[] = [];
        
        // Extract {{variable}} pattern
        const doubleBracePattern = /\{\{(\w+)\}\}/g;
        let match: RegExpExecArray | null;
        while ((match = doubleBracePattern.exec(content)) !== null) {
            variables.push({
                name: match[1],
                type: 'string',
                usage: 'User section',
                line: content.substring(0, match.index).split('\n').length
            });
        }

        // Extract {variable} pattern
        const singleBracePattern = /\{(\w+)\}/g;
        let singleMatch: RegExpExecArray | null;
        while ((singleMatch = singleBracePattern.exec(content)) !== null) {
            if (!variables.find(v => v.name === singleMatch![1])) {
                variables.push({
                    name: singleMatch[1],
                    type: 'string',
                    usage: 'User section',
                    line: content.substring(0, singleMatch.index).split('\n').length
                });
            }
        }

        return variables;
    }

    private initializeParametersPanel() {
        // This would be shown in the bottom panel
        vscode.commands.registerCommand('prompd.showParameters', () => {
            if (this.parametersWebview) {
                this.parametersWebview.reveal();
            } else {
                this.parametersWebview = vscode.window.createWebviewPanel(
                    'prompdParameters',
                    'Parameters',
                    vscode.ViewColumn.Two,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                this.parametersWebview.webview.html = this.getParametersHtml();
                
                this.parametersWebview.onDidDispose(() => {
                    this.parametersWebview = undefined;
                });
            }
        });
    }

    private getParametersHtml(): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    background: #1e1e1e;
                    color: #cccccc;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 0;
                    margin: 0;
                }
                .parameters-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .parameters-table th {
                    background: #2d2d30;
                    padding: 8px 12px;
                    text-align: left;
                    border-bottom: 1px solid #3e3e42;
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #999;
                }
                .parameters-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #2d2d30;
                }
                .type-select, .default-input {
                    background: #3c3c3c;
                    color: #ccc;
                    border: 1px solid #555;
                    padding: 4px 8px;
                    border-radius: 3px;
                    width: 100%;
                }
                .checkbox {
                    width: 18px;
                    height: 18px;
                    accent-color: #007acc;
                }
                .add-parameter {
                    margin: 12px;
                    padding: 8px 16px;
                    background: #007acc;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .add-parameter:hover {
                    background: #005a9e;
                }
            </style>
        </head>
        <body>
            <table class="parameters-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Default</th>
                        <th>Required</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>audience</td>
                        <td><select class="type-select"><option>string</option><option>number</option><option>enum</option></select></td>
                        <td><input class="default-input" value="general" /></td>
                        <td><input type="checkbox" class="checkbox" /></td>
                        <td>Target audience for the content</td>
                    </tr>
                    <tr>
                        <td>tone</td>
                        <td><select class="type-select"><option>enum</option><option>string</option></select></td>
                        <td><input class="default-input" value="neutral" /></td>
                        <td><input type="checkbox" class="checkbox" /></td>
                        <td>Writing tone (neutral, formal, casual)</td>
                    </tr>
                    <tr>
                        <td>max_tokens</td>
                        <td><select class="type-select"><option>number</option></select></td>
                        <td><input class="default-input" value="800" /></td>
                        <td><input type="checkbox" class="checkbox" checked /></td>
                        <td>Maximum number of tokens</td>
                    </tr>
                </tbody>
            </table>
            <button class="add-parameter">+ Add Parameter</button>
        </body>
        </html>`;
    }

    private async addVariable() {
        const name = await vscode.window.showInputBox({
            prompt: 'Variable name',
            placeHolder: 'my_variable'
        });
        
        if (name) {
            vscode.window.showInformationMessage(`Added variable: ${name}`);
            this.variablesProvider.refresh();
        }
    }

    // addParameter method removed - now handled by ParametersProvider

    private showConsole() {
        vscode.commands.executeCommand('workbench.action.output.toggleOutput');
    }

    private async createFromTemplate(templateName: string) {
        // Create a new .prompd file from template
        const fileName = await vscode.window.showInputBox({
            prompt: `Enter filename for ${templateName}`,
            placeHolder: 'my-prompt.prompd',
            value: `${templateName.toLowerCase().replace(/\s+/g, '-')}.prompd`
        });

        if (!fileName) return;

        const templateContent = this.getTemplateContent(templateName);
        
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
            const filePath = vscode.Uri.joinPath(workspaceRoot, fileName);
            
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(templateContent));
            
            // Open the new file
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
            
            vscode.window.showInformationMessage(`Created ${fileName} from ${templateName} template`);
        } else {
            vscode.window.showErrorMessage('No workspace folder is open');
        }
    }

    private getTemplateContent(templateName: string): string {
        const templates: { [key: string]: string } = {
            'Blog Post Writer': `---
title: "Blog Post Writer"
description: "Generate engaging blog posts on any topic"
parameters:
  - name: topic
    type: string
    required: true
    description: "The main topic or subject of the blog post"
  - name: audience
    type: string
    default: "general"
    description: "Target audience (general, technical, beginner, expert)"
  - name: tone
    type: string
    default: "conversational"
    description: "Writing tone (conversational, formal, casual, professional)"
  - name: length
    type: string
    default: "medium"
    description: "Post length (short, medium, long)"
---

# Blog Post Writer

You are a professional blog writer creating engaging content.

## Topic
Write a {{length}} blog post about: {{topic}}

## Audience & Tone
- Target audience: {{audience}}
- Writing tone: {{tone}}
- Make it engaging and informative
- Include relevant examples and insights

## Requirements
- Create an attention-grabbing headline
- Write a compelling introduction
- Structure content with clear sections
- Include actionable takeaways
- End with a strong conclusion`,

            'Product Description': `---
title: "Product Description Generator"
description: "Create compelling product descriptions for e-commerce"
parameters:
  - name: product_name
    type: string
    required: true
    description: "Name of the product"
  - name: features
    type: string
    required: true
    description: "Key features and specifications"
  - name: target_market
    type: string
    default: "general consumers"
    description: "Target market or customer segment"
  - name: style
    type: string
    default: "persuasive"
    description: "Writing style (persuasive, informative, casual, luxury)"
---

# Product Description Generator

Create a compelling product description that converts browsers into buyers.

## Product Information
Product: {{product_name}}
Key Features: {{features}}
Target Market: {{target_market}}

## Writing Style
Style: {{style}}

## Requirements
- Highlight key benefits and features
- Address customer pain points
- Use persuasive language
- Include technical specifications if relevant
- Create urgency or desire
- Keep it scannable with bullet points
- End with a clear call-to-action`,

            'JSON Parser': `---
title: "JSON Data Parser"
description: "Process and analyze JSON data structures"
parameters:
  - name: json_data
    type: string
    required: true
    description: "JSON data to process"
  - name: task
    type: string
    default: "analyze"
    description: "Task to perform (analyze, transform, extract, validate)"
  - name: output_format
    type: string
    default: "summary"
    description: "Output format (summary, table, list, structured)"
---

# JSON Data Parser

Process and analyze JSON data with intelligent parsing and formatting.

## Input Data
\`\`\`json
{{json_data}}
\`\`\`

## Task
{{task}} the provided JSON data

## Output Requirements
- Format: {{output_format}}
- Identify data structure and types
- Extract key insights or patterns
- Highlight any data quality issues
- Provide clear, organized results
- Include relevant statistics if applicable`,

            'Document Analyzer': `---
title: "Document Analyzer"
description: "Comprehensive analysis of documents and content"
parameters:
  - name: document_content
    type: string
    required: true
    description: "Content of the document to analyze"
  - name: analysis_type
    type: string
    default: "comprehensive"
    description: "Type of analysis (comprehensive, summary, themes, sentiment, structure)"
  - name: focus_areas
    type: string
    default: "key points, insights, recommendations"
    description: "Specific areas to focus the analysis on"
---

# Document Analyzer

Perform intelligent analysis of documents to extract insights and key information.

## Document Content
{{document_content}}

## Analysis Parameters
- Analysis Type: {{analysis_type}}
- Focus Areas: {{focus_areas}}

## Analysis Requirements
- Identify main themes and topics
- Extract key insights and findings
- Summarize important points
- Analyze document structure and organization
- Provide actionable recommendations
- Highlight any gaps or areas for improvement
- Present findings in clear, organized format`
        };

        return templates[templateName] || `---
title: "${templateName}"
description: "Custom prompt template"
parameters:
  - name: input
    type: string
    required: true
    description: "Input for the prompt"
---

# ${templateName}

{{input}}
`;
    }
}


// Variables Provider (Right Sidebar)
class VariablesProvider implements vscode.TreeDataProvider<VariableItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<VariableItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private variables: VariableInfo[] = [];

    getTreeItem(element: VariableItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: VariableItem): Thenable<VariableItem[]> {
        if (!element) {
            return Promise.resolve([
                new VariableItem('DETECTED VARIABLES', 'header', vscode.TreeItemCollapsibleState.Expanded),
                ...this.variables.map(v => new VariableItem(
                    `{{${v.name}}}`,
                    'variable',
                    vscode.TreeItemCollapsibleState.None,
                    v.usage
                ))
            ]);
        }
        return Promise.resolve([]);
    }

    updateVariables(variables: VariableInfo[]) {
        this.variables = variables;
        this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

class VariableItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        
        if (contextValue === 'variable') {
            this.iconPath = new vscode.ThemeIcon('symbol-variable');
            this.description = description || 'Used';
            this.tooltip = `Variable: ${label}\nUsage: ${description}`;
        } else if (contextValue === 'header') {
            this.iconPath = new vscode.ThemeIcon('symbol-misc');
        }
    }
}

interface VariableInfo {
    name: string;
    type: string;
    usage: string;
    line: number;
}

// Workspace Files Provider - Shows actual workspace files with click to open
class WorkspaceFilesProvider implements vscode.TreeDataProvider<WorkspaceFileItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<WorkspaceFileItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {
        // Watch for workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.refresh();
        });
    }

    getTreeItem(element: WorkspaceFileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkspaceFileItem): Promise<WorkspaceFileItem[]> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        if (!element) {
            // Root level - show workspace structure
            try {
                const items = await this.getDirectoryContents(workspaceRoot);
                return items;
            } catch (error) {
                console.error('Error reading workspace:', error);
                return [];
            }
        } else if (element.isDirectory) {
            // Show directory contents
            try {
                const items = await this.getDirectoryContents(element.resourceUri!.fsPath);
                return items;
            } catch (error) {
                console.error('Error reading directory:', error);
                return [];
            }
        }

        return [];
    }

    private async getDirectoryContents(dirPath: string): Promise<WorkspaceFileItem[]> {
        const items: WorkspaceFileItem[] = [];
        
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            // Sort: directories first, then files
            entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of entries) {
                // Skip hidden files and common build directories
                if (entry.name.startsWith('.') || 
                    entry.name === 'node_modules' || 
                    entry.name === 'out' || 
                    entry.name === 'dist') {
                    continue;
                }

                const fullPath = path.join(dirPath, entry.name);
                const isDirectory = entry.isDirectory();
                
                items.push(new WorkspaceFileItem(
                    entry.name,
                    vscode.Uri.file(fullPath),
                    isDirectory,
                    isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    this.context
                ));
            }
        } catch (error) {
            console.error('Error reading directory contents:', error);
        }

        return items;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

class WorkspaceFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly isDirectory: boolean,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private readonly context: vscode.ExtensionContext
    ) {
        super(label, collapsibleState);
        
        this.resourceUri = resourceUri;
        this.contextValue = isDirectory ? 'directory' : 'file';
        
        if (!isDirectory) {
            // Make files clickable to open
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [resourceUri]
            };
        }

        // Set appropriate icons
        if (isDirectory) {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else {
            const ext = path.extname(label).toLowerCase();
            switch (ext) {
                case '.prompd':
                    this.iconPath = {
                        light: vscode.Uri.joinPath(this.context.extensionUri, 'icons', 'prompd-chat-icon.svg'),
                        dark: vscode.Uri.joinPath(this.context.extensionUri, 'icons', 'prompd-chat-icon.svg')
                    };
                    break;
                case '.prompdflow':
                    this.iconPath = {
                        light: vscode.Uri.joinPath(this.context.extensionUri, 'icons', 'prompd-workflow-icon.svg'),
                        dark: vscode.Uri.joinPath(this.context.extensionUri, 'icons', 'prompd-workflow-icon.svg')
                    };
                    break;
                case '.js':
                case '.ts':
                    this.iconPath = new vscode.ThemeIcon('symbol-class');
                    break;
                case '.json':
                    this.iconPath = new vscode.ThemeIcon('settings-gear');
                    break;
                case '.md':
                    this.iconPath = new vscode.ThemeIcon('markdown');
                    break;
                default:
                    this.iconPath = new vscode.ThemeIcon('file');
            }
        }

        this.tooltip = this.resourceUri.fsPath;
    }
}

// Workspace Templates Provider - Shows predefined templates
class WorkspaceTemplatesProvider implements vscode.TreeDataProvider<TemplateItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TemplateItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    getTreeItem(element: TemplateItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TemplateItem): Thenable<TemplateItem[]> {
        if (!element) {
            return Promise.resolve([
                new TemplateItem('Content Generation', 'category', vscode.TreeItemCollapsibleState.Expanded),
                new TemplateItem('Data Processing', 'category', vscode.TreeItemCollapsibleState.Expanded),
                new TemplateItem('Analysis & Research', 'category', vscode.TreeItemCollapsibleState.Expanded),
                new TemplateItem('Creative Writing', 'category', vscode.TreeItemCollapsibleState.Expanded)
            ]);
        }

        switch (element.label) {
            case 'Content Generation':
                return Promise.resolve([
                    new TemplateItem('Blog Post Writer', 'template', vscode.TreeItemCollapsibleState.None, 'Create engaging blog posts'),
                    new TemplateItem('Product Description', 'template', vscode.TreeItemCollapsibleState.None, 'Generate product descriptions'),
                    new TemplateItem('Email Newsletter', 'template', vscode.TreeItemCollapsibleState.None, 'Create email newsletters'),
                    new TemplateItem('Social Media Post', 'template', vscode.TreeItemCollapsibleState.None, 'Write social media content')
                ]);
            case 'Data Processing':
                return Promise.resolve([
                    new TemplateItem('JSON Parser', 'template', vscode.TreeItemCollapsibleState.None, 'Process JSON data'),
                    new TemplateItem('CSV Analyzer', 'template', vscode.TreeItemCollapsibleState.None, 'Analyze CSV files'),
                    new TemplateItem('XML Transformer', 'template', vscode.TreeItemCollapsibleState.None, 'Transform XML data'),
                    new TemplateItem('Data Summarizer', 'template', vscode.TreeItemCollapsibleState.None, 'Summarize datasets')
                ]);
            case 'Analysis & Research':
                return Promise.resolve([
                    new TemplateItem('Document Analyzer', 'template', vscode.TreeItemCollapsibleState.None, 'Analyze documents'),
                    new TemplateItem('Sentiment Analysis', 'template', vscode.TreeItemCollapsibleState.None, 'Analyze sentiment'),
                    new TemplateItem('Research Summary', 'template', vscode.TreeItemCollapsibleState.None, 'Create research summaries'),
                    new TemplateItem('Comparative Analysis', 'template', vscode.TreeItemCollapsibleState.None, 'Compare multiple sources')
                ]);
            case 'Creative Writing':
                return Promise.resolve([
                    new TemplateItem('Story Generator', 'template', vscode.TreeItemCollapsibleState.None, 'Generate creative stories'),
                    new TemplateItem('Character Creator', 'template', vscode.TreeItemCollapsibleState.None, 'Create character profiles'),
                    new TemplateItem('Dialogue Writer', 'template', vscode.TreeItemCollapsibleState.None, 'Write natural dialogue'),
                    new TemplateItem('Poetry Generator', 'template', vscode.TreeItemCollapsibleState.None, 'Generate poetry')
                ]);
            default:
                return Promise.resolve([]);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

class TemplateItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        
        this.contextValue = contextValue;
        this.description = description;

        if (contextValue === 'template') {
            this.iconPath = new vscode.ThemeIcon('file-code');
            this.command = {
                command: 'prompd.createFromTemplate',
                title: 'Create from Template',
                arguments: [label]
            };
        } else if (contextValue === 'category') {
            this.iconPath = new vscode.ThemeIcon('folder-library');
        }

        this.tooltip = description || label;
    }
}

export function activateWorkbench(context: vscode.ExtensionContext) {
    return PrompdWorkbench.activate(context);
}
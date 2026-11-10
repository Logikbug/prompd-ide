import * as vscode from 'vscode';

/**
 * Custom WYSIWYG Prompt Builder Editor
 * 
 * Features:
 * - Visual header editor (metadata)
 * - Section-based editing (System, Context, User, Response)
 * - Drag & drop reordering
 * - Live parameter integration
 * - Real-time preview
 */

export class PromptBuilderProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new PromptBuilderProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            PromptBuilderProvider.viewType, 
            provider
        );
        return providerRegistration;
    }

    private static readonly viewType = 'prompdx.promptBuilder';

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        
        // Setup webview options
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async (e) => {
            switch (e.type) {
                case 'save':
                    isUpdatingFromWebview = true;
                    const result = await this.saveDocument(document, e.content);
                    setTimeout(() => { isUpdatingFromWebview = false; }, 100);
                    return result;
                case 'addSection':
                    return this.addSection(document, e.sectionType, e.insertIndex);
                case 'updateSection':
                    return this.updateSection(document, e.sectionIndex, e.content);
                case 'deleteSection':
                    return this.deleteSection(document, e.sectionIndex);
                case 'reorderSections':
                    return this.reorderSections(document, e.oldIndex, e.newIndex);
            }
        });

        // Update webview when document changes - but only if the change comes from outside the webview
        let isUpdatingFromWebview = false;
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && !isUpdatingFromWebview) {
                // Only refresh if it's a major change, not during typing
                const hasStructuralChanges = e.contentChanges.some(change => 
                    change.text.includes('---') || change.text.includes('# ')
                );
                if (hasStructuralChanges) {
                    this.updateWebview(webviewPanel.webview, document);
                }
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        const parsedPrompt = this.parsePromptDocument(document.getText());

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Builder</title>
    <script src="https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            overflow-x: hidden;
        }
        
        .prompt-builder {
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .header-section {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .header-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }
        
        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
        }
        
        .field-group {
            display: flex;
            flex-direction: column;
        }
        
        .field-label {
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 5px;
            color: var(--vscode-descriptionForeground);
        }
        
        .field-input {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .field-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .parameters-section {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .section {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
            transition: all 0.2s ease;
        }
        
        .section:hover {
            border-color: var(--vscode-focusBorder);
        }
        
        .section-header {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 12px 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
        }
        
        .section-type {
            font-weight: 600;
            font-size: 14px;
        }
        
        .section-actions {
            display: flex;
            gap: 8px;
        }
        
        .section-btn {
            background: transparent;
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-button-foreground);
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            min-width: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .section-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .section-btn.maximize {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .section-btn.maximize:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .section-content {
            padding: 15px;
        }
        
        .section.maximized {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            background: var(--vscode-editor-background);
            margin: 0;
            border-radius: 0;
            display: flex;
            flex-direction: column;
        }
        
        .section.maximized .section-header {
            background: var(--vscode-titleBar-activeBackground);
            color: var(--vscode-titleBar-activeForeground);
            padding: 16px 20px;
            border-bottom: 1px solid var(--vscode-titleBar-border);
        }
        
        .section.maximized .section-content {
            flex: 1;
            padding: 20px;
            overflow: auto;
        }
        
        .section.maximized .monaco-editor-wrapper {
            height: calc(100vh - 120px);
            min-height: calc(100vh - 120px);
        }
        
        .section.collapsed .section-content {
            display: none;
        }
        
        .main-content.has-maximized {
            overflow: hidden;
            pointer-events: none;
        }
        
        body.has-maximized {
            overflow: hidden;
        }
        
        .loading-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-progressBar-background);
            border-top: 2px solid var(--vscode-progressBar-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .success-message {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
            display: flex;
            align-items: center;
        }
        
        .success-message::before {
            content: "✓";
            margin-right: 8px;
            color: var(--vscode-charts-green);
            font-weight: bold;
        }
        
        .editor-container {
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            min-height: 120px;
            background: var(--vscode-editor-background);
            position: relative;
        }
        
        .monaco-editor-wrapper {
            min-height: 120px;
            height: 120px;
            resize: vertical;
            overflow: hidden;
        }
        
        .wysiwyg-editor {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            min-height: 120px;
            padding: 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: 14px;
            line-height: 1.5;
            resize: vertical;
            overflow-y: auto;
            white-space: pre-wrap;
            
            /* Prevent unwanted formatting */
            -webkit-user-modify: read-write-plaintext-only;
        }
        
        .wysiwyg-editor:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        /* Markdown formatting in editors */
        .wysiwyg-editor h1, .wysiwyg-editor h2, .wysiwyg-editor h3,
        .wysiwyg-editor h4, .wysiwyg-editor h5, .wysiwyg-editor h6 {
            font-weight: bold;
            margin: 0.5em 0;
            color: var(--vscode-textPreformat-foreground);
        }

        .wysiwyg-editor h1 { font-size: 1.8em; }
        .wysiwyg-editor h2 { font-size: 1.5em; }
        .wysiwyg-editor h3 { font-size: 1.3em; }
        .wysiwyg-editor h4 { font-size: 1.1em; }

        .wysiwyg-editor strong, .wysiwyg-editor b {
            font-weight: bold;
            color: var(--vscode-textPreformat-foreground);
        }

        .wysiwyg-editor em, .wysiwyg-editor i {
            font-style: italic;
            color: var(--vscode-textLink-foreground);
        }

        .wysiwyg-editor code {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 3px;
            padding: 2px 4px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            color: var(--vscode-textPreformat-foreground);
        }

        .wysiwyg-editor pre {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 8px 12px;
            overflow-x: auto;
            margin: 0.5em 0;
        }

        .wysiwyg-editor blockquote {
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding-left: 12px;
            margin: 0.5em 0;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .wysiwyg-editor ul, .wysiwyg-editor ol {
            margin: 0.5em 0;
            padding-left: 20px;
        }

        .wysiwyg-editor li {
            margin: 0.2em 0;
        }

        .wysiwyg-editor a {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
        }

        .wysiwyg-editor a:hover {
            color: var(--vscode-textLink-activeForeground);
        }
        
        .add-section-area {
            text-align: center;
            padding: 20px;
            border: 2px dashed var(--vscode-input-border);
            border-radius: 8px;
            margin-bottom: 15px;
            transition: all 0.2s ease;
        }
        
        .add-section-area:hover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-editor-inactiveSelectionBackground);
        }
        
        .add-section-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 5px;
        }
        
        .add-section-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .variable-tag {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            font-family: monospace;
        }
        
        .preview-pane {
            position: fixed;
            right: 0;
            top: 0;
            bottom: 0;
            width: var(--preview-width, 400px);
            background: var(--vscode-editor-background);
            border-left: 1px solid var(--vscode-panel-border);
            overflow-y: auto;
            z-index: 1000;
            transition: width 0.3s ease;
        }
        
        .preview-pane.collapsed {
            width: 40px;
        }
        
        .preview-pane.resizable:not(.collapsed) {
            min-width: 200px;
            max-width: 80vw;
        }
        
        .main-content {
            transition: margin-right 0.3s ease;
            margin-right: var(--preview-width, 400px);
        }
        
        .main-content.preview-collapsed {
            margin-right: 40px;
        }
        
        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorGroupHeader-tabsBackground);
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        .preview-pane.collapsed .preview-header {
            padding: 8px 4px;
            border-bottom: none;
        }
        
        .preview-title {
            font-weight: 600;
            color: var(--vscode-tab-activeForeground);
            white-space: nowrap;
            font-size: 13px;
        }
        
        .preview-pane.collapsed .preview-title {
            display: none;
        }
        
        .preview-toggle {
            background: none;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 6px;
            border-radius: 3px;
            font-size: 14px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .preview-toggle:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        .preview-body {
            padding: 16px;
            height: calc(100% - 49px);
            overflow-y: auto;
        }
        
        .preview-pane.collapsed .preview-body {
            display: none;
        }
        
        .preview-pane.collapsed .resize-handle {
            display: none;
        }
        
        .resize-handle {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: transparent;
            cursor: col-resize;
            z-index: 1001;
        }
        
        .resize-handle:hover {
            background: var(--vscode-focusBorder);
        }
        
        .resize-handle:active {
            background: var(--vscode-focusBorder);
        }
        
        .preview-content {
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            line-height: 1.6;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            white-space: pre-wrap;
            overflow-x: auto;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 16px;
            min-height: 200px;
        }
    </style>
</head>
<body>
    <div class="main-content" id="main-content">
        <div class="prompt-builder">
        <!-- Header Section -->
        <div class="header-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div class="header-title">📋 Prompt Metadata</div>
                <div>
                    <button class="section-btn" onclick="collapseAllSections()" title="Collapse All Sections">📁 Collapse All</button>
                    <button class="section-btn" onclick="expandAllSections()" title="Expand All Sections">📂 Expand All</button>
                </div>
            </div>
            <div class="metadata-grid">
                <div class="field-group">
                    <label class="field-label">Name</label>
                    <input type="text" class="field-input" id="prompt-name" value="${parsedPrompt.metadata.name || ''}" placeholder="my-awesome-prompt">
                </div>
                <div class="field-group">
                    <label class="field-label">Description</label>
                    <input type="text" class="field-input" id="prompt-description" value="${parsedPrompt.metadata.description || ''}" placeholder="What does this prompt do?">
                </div>
                <div class="field-group">
                    <label class="field-label">Version</label>
                    <input type="text" class="field-input" id="prompt-version" value="${parsedPrompt.metadata.version || '1.0.0'}" placeholder="1.0.0">
                </div>
            </div>
        </div>

        <!-- Parameters Section -->
        <div class="parameters-section">
            <div class="header-title">🔧 Parameters</div>
            <div id="parameters-list">
                ${parsedPrompt.parameters.map((param: any, index: number) => `
                    <div class="parameter-item" data-index="${index}">
                        <input type="text" placeholder="Parameter name" value="${param.name || ''}" class="field-input" style="margin-bottom: 5px;">
                        <select class="field-input" style="margin-bottom: 5px;">
                            <option value="string" ${param.type === 'string' ? 'selected' : ''}>String</option>
                            <option value="integer" ${param.type === 'integer' ? 'selected' : ''}>Integer</option>
                            <option value="float" ${param.type === 'float' ? 'selected' : ''}>Float</option>
                            <option value="boolean" ${param.type === 'boolean' ? 'selected' : ''}>Boolean</option>
                            <option value="array" ${param.type === 'array' ? 'selected' : ''}>Array</option>
                            <option value="object" ${param.type === 'object' ? 'selected' : ''}>Object</option>
                        </select>
                        <input type="text" placeholder="Description" value="${param.description || ''}" class="field-input">
                    </div>
                `).join('')}
            </div>
            <button class="add-section-btn" onclick="addParameter()">+ Add Parameter</button>
        </div>

        <!-- Sections -->
        <div id="sections-container">
            ${parsedPrompt.sections.map((section: any, index: number) => `
                <div class="section" data-index="${index}" id="section-${index}">
                    <div class="section-header" onclick="toggleSection(${index})">
                        <span class="section-type">${section.type}</span>
                        <div class="section-actions" onclick="event.stopPropagation()">
                            <button class="section-btn" onclick="maximizeSection(${index})" title="Maximize Section">⛶</button>
                            <button class="section-btn" onclick="toggleSection(${index})" title="Collapse/Expand">−</button>
                            <button class="section-btn" onclick="moveSection(${index}, -1)" title="Move Up">↑</button>
                            <button class="section-btn" onclick="moveSection(${index}, 1)" title="Move Down">↓</button>
                            <button class="section-btn" onclick="deleteSection(${index})" title="Delete Section">×</button>
                        </div>
                    </div>
                    <div class="section-content">
                        <div class="editor-container">
                            <div class="monaco-editor-wrapper" id="editor-${index}" data-section="${index}"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Add Section Area -->
        <div class="add-section-area">
            <div>Add a new section:</div>
            <button class="add-section-btn" onclick="addSection('System')">📋 System</button>
            <button class="add-section-btn" onclick="addSection('Context')">🔄 Context</button>
            <button class="add-section-btn" onclick="addSection('User')">👤 User</button>
            <button class="add-section-btn" onclick="addSection('Response')">💬 Response</button>
            <button class="add-section-btn" onclick="addSection('Custom')">⚙️ Custom</button>
        </div>
    </div>
    </div>

    <!-- Live Preview -->
    <div class="preview-pane resizable" id="preview-pane">
        <div class="resize-handle" id="resize-handle"></div>
        <div class="preview-header">
            <div class="preview-title">📄 Live Preview</div>
            <button class="preview-toggle" id="preview-toggle" title="Toggle Preview">
                <span id="toggle-icon">−</span>
            </button>
        </div>
        <div class="preview-body">
            <div class="preview-content" id="live-preview">
                Loading preview...
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Monaco Editor instances
        const editors = new Map();
        let monacoReady = false;
        
        // Load Monaco Editor
        require.config({ 
            paths: { 'vs': 'https://unpkg.com/monaco-editor@0.44.0/min/vs' },
            'vs/nls': { availableLanguages: { '*': 'en' } }
        });
        
        require(['vs/editor/editor.main'], function () {
            monacoReady = true;
            initializeCustomLanguage();
            initializeEditors();
        });
        
        // Initialize custom prompt template language
        function initializeCustomLanguage() {
            // Register custom language for prompt templates
            monaco.languages.register({ id: 'prompt-template' });
            
            // Define syntax highlighting rules
            monaco.languages.setMonarchTokensProvider('prompt-template', {
                tokenizer: {
                    root: [
                        // Variable references {variable}
                        [/\\{[a-zA-Z_][a-zA-Z0-9_]*\\}/, 'variable'],
                        
                        // Parameter references {{parameter}}
                        [/\\{\\{[a-zA-Z_][a-zA-Z0-9_]*\\}\\}/, 'parameter'],
                        
                        // Template functions {function(arg)}
                        [/\\{[a-zA-Z_][a-zA-Z0-9_]*\\([^)]*\\)\\}/, 'function'],
                        
                        // Comments # comment
                        [/#.*$/, 'comment'],
                        
                        // Strings in quotes
                        [/"([^"\\\\]|\\\\.)*$/, 'string.invalid'],  // non-terminated string
                        [/"/, 'string', '@string_double'],
                        [/'/, 'string', '@string_single'],
                        
                        // Keywords for common prompt elements
                        [/\\b(system|user|assistant|context|instruction|example|output|format|style|tone|role)\\b/i, 'keyword'],
                        
                        // Numbers
                        [/\\b\\d+(\\.\\d+)?\\b/, 'number'],
                        
                        // Markdown-style headers
                        [/^#{1,6}\\s.*$/, 'markup.heading'],
                        
                        // Markdown-style bold/italic
                        [/\\*\\*([^*]|\\*(?!\\*))*\\*\\*/, 'markup.bold'],
                        [/\\*([^*])*\\*/, 'markup.italic'],
                        
                        // URLs
                        [/https?:\\/\\/[^\\s]+/, 'string.link'],
                    ],
                    
                    string_double: [
                        [/[^\\\\"]+/, 'string'],
                        [/\\\\./, 'string.escape.invalid'],
                        [/"/, 'string', '@pop']
                    ],
                    
                    string_single: [
                        [/[^\\\\']+/, 'string'],
                        [/\\\\./, 'string.escape.invalid'],
                        [/'/, 'string', '@pop']
                    ]
                }
            });
            
            // Define color theme for prompt templates
            monaco.editor.defineTheme('prompt-theme', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'variable', foreground: '4FC1FF', fontStyle: 'bold' },
                    { token: 'parameter', foreground: 'FFD700', fontStyle: 'bold' },
                    { token: 'function', foreground: 'FF6B6B', fontStyle: 'bold' },
                    { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
                    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                    { token: 'string', foreground: 'CE9178' },
                    { token: 'string.link', foreground: '3794FF', fontStyle: 'underline' },
                    { token: 'number', foreground: 'B5CEA8' },
                    { token: 'markup.heading', foreground: '569CD6', fontStyle: 'bold' },
                    { token: 'markup.bold', fontStyle: 'bold' },
                    { token: 'markup.italic', fontStyle: 'italic' },
                ],
                colors: {
                    'editor.background': '#1E1E1E',
                    'editor.foreground': '#D4D4D4'
                }
            });
            
            // Configure IntelliSense completion provider with better triggering
            monaco.languages.registerCompletionItemProvider('prompt-template', {
                triggerCharacters: ['{', ' '],
                provideCompletionItems: (model, position) => {
                    const line = model.getLineContent(position.lineNumber);
                    const lineUpToPosition = line.substring(0, position.column - 1);
                    
                    // Only show suggestions in specific contexts
                    const isInVariable = lineUpToPosition.includes('{') && !lineUpToPosition.includes('}');
                    const isStartOfLine = lineUpToPosition.trim() === '';
                    const isAfterSpace = lineUpToPosition.endsWith(' ');
                    
                    if (!isInVariable && !isStartOfLine && !isAfterSpace) {
                        return { suggestions: [] };
                    }
                    
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };
                    
                    const suggestions = [];
                    
                    // Only show variable suggestions when typing '{'
                    if (isInVariable || lineUpToPosition.endsWith('{')) {
                        suggestions.push({
                            label: 'variable',
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: '\${1:variable}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Insert a variable reference',
                            range: range
                        });
                        
                        suggestions.push({
                            label: '{parameter}',
                            kind: monaco.languages.CompletionItemKind.Field,
                            insertText: '{\${1:parameter}}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Insert a parameter reference',
                            range: range
                        });
                    }
                    
                    // Only show phrase suggestions at start of line or after spaces
                    if (isStartOfLine || isAfterSpace) {
                        const keywords = [
                            'You are a helpful assistant',
                            'Please analyze the following',
                            'Based on the context provided',
                            'Generate a response that',
                            'Your task is to'
                        ];
                        
                        keywords.forEach(keyword => {
                            if (keyword.toLowerCase().startsWith(word.word.toLowerCase())) {
                                suggestions.push({
                                    label: keyword,
                                    kind: monaco.languages.CompletionItemKind.Text,
                                    insertText: keyword,
                                    documentation: 'Common prompt phrase',
                                    range: range,
                                    sortText: '0' + keyword // Higher priority
                                });
                            }
                        });
                    }
                    
                    return { suggestions: suggestions };
                }
            });
            
            // Configure hover provider for variables and parameters
            monaco.languages.registerHoverProvider('prompt-template', {
                provideHover: (model, position) => {
                    const word = model.getWordAtPosition(position);
                    if (word) {
                        const line = model.getLineContent(position.lineNumber);
                        const varMatch = line.match(/\\{([^}]+)\\}/);
                        const paramMatch = line.match(/\\{\\{([^}]+)\\}\\}/);
                        
                        if (varMatch) {
                            return {
                                range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                                contents: [
                                    { value: '**Variable Reference**' },
                                    { value: 'This references a variable that will be substituted at runtime.' }
                                ]
                            };
                        }
                        
                        if (paramMatch) {
                            return {
                                range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                                contents: [
                                    { value: '**Parameter Reference**' },
                                    { value: 'This references a parameter defined in the frontmatter.' }
                                ]
                            };
                        }
                    }
                    return null;
                }
            });
        }
        
        // Initialize Monaco editors for each section
        function initializeEditors() {
            const sections = ${JSON.stringify(parsedPrompt.sections)};
            
            sections.forEach((section, index) => {
                const editorContainer = document.getElementById('editor-' + index);
                if (editorContainer && !editors.has(index)) {
                    const editor = monaco.editor.create(editorContainer, {
                        value: section.content || '',
                        language: 'prompt-template',
                        theme: document.body.classList.contains('vscode-dark') ? 'prompt-theme' : 'vs',
                        fontSize: 14,
                        lineHeight: 1.5,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        tabSize: 2,
                        insertSpaces: true,
                        folding: true,
                        lineNumbers: 'on',
                        glyphMargin: false,
                        contextmenu: true,
                        mouseWheelZoom: true,
                        multiCursorModifier: 'ctrlCmd',
                        formatOnPaste: true,
                        formatOnType: true,
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: 'on',
                        quickSuggestions: {
                            other: true,
                            comments: false,
                            strings: true
                        },
                        quickSuggestionsDelay: 500,
                        parameterHints: {
                            enabled: true
                        },
                        suggest: {
                            showKeywords: true,
                            showSnippets: true,
                            showConstants: false,
                            showFunctions: false,
                            showMethods: false,
                            filterGraceful: true
                        },
                        renderLineHighlight: 'line',
                        selectionHighlight: true,
                        occurrencesHighlight: true,
                        codeLens: false,
                        bracketMatching: 'always',
                        showFoldingControls: 'mouseover'
                    });
                    
                    // Store editor instance
                    editors.set(index, editor);
                    
                    // Enable live preview updates (without saving to disk)
                    let previewUpdateTimeout;
                    editor.onDidChangeModelContent(() => {
                        clearTimeout(previewUpdateTimeout);
                        previewUpdateTimeout = setTimeout(() => {
                            updatePreview(generatePromptContent());
                        }, 500);
                    });
                    
                    // Handle resize
                    const resizeObserver = new ResizeObserver(() => {
                        editor.layout();
                    });
                    resizeObserver.observe(editorContainer);
                }
            });
        }

        // Simple markdown parser for real-time formatting
        function parseMarkdown(text) {
            return text
                // Headers
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                // Bold and italic
                .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
                .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
                .replace(/__([^_]+)__/g, '<strong>$1</strong>')
                .replace(/_([^_]+)_/g, '<em>$1</em>')
                // Inline code
                .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                // Code blocks
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                // Blockquotes
                .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
                // Lists
                .replace(/^\\* (.*$)/gm, '<li>$1</li>')
                .replace(/^- (.*$)/gm, '<li>$1</li>')
                .replace(/^\\d+\\. (.*$)/gm, '<li>$1</li>')
                // Links
                .replace(/\\[([^\\]]+)\\]\\(([^\\)]+)\\)/g, '<a href="$2">$1</a>');
        }

        // Real-time markdown rendering for contenteditable elements
        function enableMarkdownFormatting(element) {
            let isFormatting = false;
            
            // Prevent HTML paste and clean input
            element.addEventListener('paste', function(e) {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                const cleanText = text.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
                document.execCommand('insertText', false, cleanText);
            });
            
            element.addEventListener('input', function() {
                if (isFormatting) return;
                
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                const cursorOffset = range.startOffset;
                
                isFormatting = true;
                
                // Get plain text content
                const plainText = element.textContent || element.innerText;
                
                // Apply markdown formatting
                element.innerHTML = parseMarkdown(plainText);
                
                // Restore cursor position (approximately)
                try {
                    const textNodes = getTextNodes(element);
                    let currentOffset = 0;
                    for (let node of textNodes) {
                        if (currentOffset + node.textContent.length >= cursorOffset) {
                            const newRange = document.createRange();
                            newRange.setStart(node, Math.min(cursorOffset - currentOffset, node.textContent.length));
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                            break;
                        }
                        currentOffset += node.textContent.length;
                    }
                } catch (e) {
                    // Cursor restoration failed, place at end
                    const newRange = document.createRange();
                    newRange.selectNodeContents(element);
                    newRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
                
                isFormatting = false;
                scheduleAutoSave();
            });
        }

        function getTextNodes(element) {
            const textNodes = [];
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            return textNodes;
        }

        // Initialize markdown formatting for all editors
        function initializeMarkdownEditors() {
            const editors = document.querySelectorAll('.wysiwyg-editor');
            editors.forEach(enableMarkdownFormatting);
        }

        function addSection(type) {
            const sectionsContainer = document.getElementById('sections-container');
            const newIndex = sectionsContainer.children.length;
            
            vscode.postMessage({
                type: 'addSection',
                sectionType: type,
                insertIndex: newIndex
            });
            
            // Reinitialize markdown editors after DOM update
            setTimeout(() => {
                initializeMarkdownEditors();
            }, 100);
        }

        function deleteSection(index) {
            if (confirm('Delete this section?')) {
                vscode.postMessage({
                    type: 'deleteSection',
                    sectionIndex: index
                });
            }
        }

        function moveSection(index, direction) {
            const newIndex = index + direction;
            if (newIndex >= 0) {
                vscode.postMessage({
                    type: 'reorderSections',
                    oldIndex: index,
                    newIndex: newIndex
                });
            }
        }

        function addParameter() {
            // Add parameter logic
            const paramsList = document.getElementById('parameters-list');
            const newParam = document.createElement('div');
            newParam.className = 'parameter-item';
            newParam.innerHTML = \`
                <input type="text" placeholder="Parameter name" class="field-input" style="margin-bottom: 5px;">
                <select class="field-input" style="margin-bottom: 5px;">
                    <option value="string">String</option>
                    <option value="integer">Integer</option>
                    <option value="float">Float</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array</option>
                    <option value="object">Object</option>
                </select>
                <input type="text" placeholder="Description" class="field-input">
            \`;
            paramsList.appendChild(newParam);
        }

        // Section maximize/minimize functionality
        function maximizeSection(index) {
            const section = document.getElementById('section-' + index);
            const body = document.body;
            const mainContent = document.getElementById('main-content');
            
            if (section.classList.contains('maximized')) {
                // Restore
                section.classList.remove('maximized');
                body.classList.remove('has-maximized');
                mainContent.classList.remove('has-maximized');
                
                // Update button
                const maxBtn = section.querySelector('.section-actions button[title="Maximize Section"]');
                if (maxBtn) {
                    maxBtn.innerHTML = '⛶';
                    maxBtn.title = 'Maximize Section';
                }
                
                // Restore editor layout
                setTimeout(() => {
                    const editor = editors.get(index);
                    if (editor) {
                        editor.layout();
                    }
                }, 100);
            } else {
                // Maximize
                section.classList.add('maximized');
                body.classList.add('has-maximized');
                mainContent.classList.add('has-maximized');
                
                // Update button
                const maxBtn = section.querySelector('.section-actions button[title="Maximize Section"]');
                if (maxBtn) {
                    maxBtn.innerHTML = '🗗';
                    maxBtn.title = 'Restore Section';
                }
                
                // Resize editor for full screen
                setTimeout(() => {
                    const editor = editors.get(index);
                    if (editor) {
                        editor.layout();
                        editor.focus();
                    }
                }, 100);
            }
        }

        function toggleSection(index) {
            const section = document.getElementById('section-' + index);
            const toggleBtn = section.querySelector('.section-actions button[title="Collapse/Expand"]');
            
            if (section.classList.contains('collapsed')) {
                // Expand
                section.classList.remove('collapsed');
                if (toggleBtn) {
                    toggleBtn.innerHTML = '−';
                    toggleBtn.title = 'Collapse/Expand';
                }
                
                // Resize editor after expansion
                setTimeout(() => {
                    const editor = editors.get(index);
                    if (editor) {
                        editor.layout();
                    }
                }, 100);
            } else {
                // Collapse  
                section.classList.add('collapsed');
                if (toggleBtn) {
                    toggleBtn.innerHTML = '+';
                    toggleBtn.title = 'Collapse/Expand';
                }
            }
        }

        function collapseAllSections() {
            const sections = document.querySelectorAll('.section');
            sections.forEach((section, index) => {
                section.classList.add('collapsed');
                const toggleBtn = section.querySelector('.section-actions button[title="Collapse/Expand"]');
                if (toggleBtn) {
                    toggleBtn.innerHTML = '+';
                    toggleBtn.title = 'Collapse/Expand';
                }
            });
        }

        function expandAllSections() {
            const sections = document.querySelectorAll('.section');
            sections.forEach((section, index) => {
                section.classList.remove('collapsed');
                const toggleBtn = section.querySelector('.section-actions button[title="Collapse/Expand"]');
                if (toggleBtn) {
                    toggleBtn.innerHTML = '−';
                    toggleBtn.title = 'Collapse/Expand';
                }
                
                // Resize editors after expansion
                setTimeout(() => {
                    const editor = editors.get(index);
                    if (editor) {
                        editor.layout();
                    }
                }, 100);
            });
        }

        // Auto-save functionality with better debouncing
        let globalSaveTimeout;
        function scheduleAutoSave() {
            clearTimeout(globalSaveTimeout);
            globalSaveTimeout = setTimeout(() => {
                saveDocument();
            }, 2000); // Increased delay to prevent frequent updates
        }

        function saveDocument() {
            const content = generatePromptContent();
            vscode.postMessage({
                type: 'save',
                content: content
            });
            updatePreview(content);
        }

        function generatePromptContent() {
            // Generate .prompd content from the visual editor
            const name = document.getElementById('prompt-name').value;
            const description = document.getElementById('prompt-description').value;
            const version = document.getElementById('prompt-version').value;

            let content = '---\\n';
            content += \`name: \${name}\\n\`;
            content += \`description: \${description}\\n\`;
            content += \`version: \${version}\\n\`;
            content += 'parameters: []\\n'; // TODO: Add parameter parsing
            content += '---\\n\\n';

            // Add sections
            const sections = document.querySelectorAll('.section');
            sections.forEach((section, index) => {
                const type = section.querySelector('.section-type').textContent;
                const cleanContent = getContentFromMonacoEditor(index);
                
                content += \`# \${type}\\n\\n\`;
                if (cleanContent && cleanContent.trim()) {
                    content += cleanContent.trim();
                    content += '\\n\\n';
                } else {
                    content += '\\n\\n';
                }
            });

            return content;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function cleanContentFromEditor(contentEl) {
            // Get plain text content from contenteditable element (fallback)
            let content = contentEl.textContent || contentEl.innerText || '';
            
            // Clean the content thoroughly
            return content
                .replace(/^\\s+|\\s+$/g, '')         // Remove leading/trailing whitespace
                .replace(/\\u00A0/g, ' ')            // Replace non-breaking spaces with regular spaces
                .replace(/\\n\\s*\\n/g, '\\n\\n')     // Normalize multiple line breaks
                .replace(/^\\s*["""]|["""]\\s*$/g, '') // Remove smart quotes at start/end
                .replace(/^\\s*"|"\\s*$/g, '')        // Remove regular quotes at start/end
                .replace(/\\t/g, '    ')             // Convert tabs to spaces
                .replace(/\\r\\n/g, '\\n')            // Normalize line endings
                .replace(/\\r/g, '\\n')               // Convert CR to LF
                .trim();
        }
        
        function getContentFromMonacoEditor(sectionIndex) {
            const editor = editors.get(sectionIndex);
            if (editor) {
                return editor.getValue() || '';
            }
            
            // Fallback to contenteditable if Monaco not available
            const contentEl = document.querySelector('[data-section="' + sectionIndex + '"]');
            return contentEl ? cleanContentFromEditor(contentEl) : '';
        }

        function updatePreview(content) {
            const preview = document.getElementById('live-preview');
            
            // Parse content into sections and make them clickable
            const sections = content.split(/^# (.*$)/gm);
            let html = '';
            
            // Add frontmatter section if it exists
            const frontmatterMatch = content.match(/^---\\n([\\s\\S]*?)\\n---/);
            if (frontmatterMatch) {
                html += '<div class="preview-section" data-section="frontmatter" style="margin-bottom: 20px; padding: 12px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); cursor: pointer; border-radius: 4px;">' +
                    '<h4 style="margin: 0 0 8px 0; color: var(--vscode-textLink-foreground);">📋 Metadata</h4>' +
                    '<pre style="margin: 0; font-size: 11px; white-space: pre-wrap;">' + escapeHtml(frontmatterMatch[0]) + '</pre>' +
                    '</div>';
            }
            
            // Add content sections
            for (let i = 1; i < sections.length; i += 2) {
                const sectionTitle = sections[i];
                const sectionContent = sections[i + 1] || '';
                
                if (sectionTitle && sectionTitle.trim()) {
                    const sectionId = sectionTitle.toLowerCase().replace(/\\s+/g, '-');
                    html += '<div class="preview-section" data-section="' + sectionId + '" style="margin-bottom: 20px; padding: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); cursor: pointer; border-radius: 4px; transition: background-color 0.2s;">' +
                        '<h3 style="margin: 0 0 12px 0; color: var(--vscode-textLink-foreground); border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 8px;"># ' + escapeHtml(sectionTitle) + '</h3>' +
                        '<div style="white-space: pre-wrap; line-height: 1.5;">' + parseMarkdown(escapeHtml(sectionContent.trim())) + '</div>' +
                        '</div>';
                }
            }
            
            // If no sections found, show raw content
            if (html === '') {
                html = '<div style="white-space: pre-wrap; line-height: 1.5;">' + parseMarkdown(escapeHtml(content)) + '</div>';
            }
            
            preview.innerHTML = html;
            
            // Add click handlers to sections
            preview.querySelectorAll('.preview-section').forEach(section => {
                section.addEventListener('click', () => {
                    const sectionName = section.dataset.section;
                    jumpToSection(sectionName);
                });
                
                // Add hover effect
                section.addEventListener('mouseenter', () => {
                    section.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                });
                
                section.addEventListener('mouseleave', () => {
                    section.style.backgroundColor = section.dataset.section === 'frontmatter' ? 
                        'var(--vscode-textBlockQuote-background)' : 'var(--vscode-editor-background)';
                });
            });
        }
        
        // Jump to section functionality  
        function jumpToSection(sectionName) {
            // Handle frontmatter/metadata section
            if (sectionName === 'frontmatter') {
                const headerSection = document.querySelector('.header-section');
                if (headerSection) {
                    highlightAndScroll(headerSection);
                }
                return;
            }
            
            // Find matching content sections
            const sections = document.querySelectorAll('.section');
            const searchName = sectionName.replace(/-/g, ' ').toLowerCase();
            
            for (let section of sections) {
                const sectionTypeElement = section.querySelector('.section-type');
                if (sectionTypeElement) {
                    const sectionType = sectionTypeElement.textContent.trim().toLowerCase();
                    
                    // Improved matching logic
                    if (sectionType === searchName || 
                        sectionType.includes(searchName) || 
                        searchName.includes(sectionType) ||
                        // Also try exact word matching
                        sectionType.split(' ').some(word => searchName.includes(word)) ||
                        searchName.split(' ').some(word => sectionType.includes(word))) {
                        
                        highlightAndScroll(section);
                        
                        // Focus the content editor
                        const editor = section.querySelector('.wysiwyg-editor');
                        if (editor) {
                            // Small delay to ensure scroll completes first
                            setTimeout(() => {
                                editor.focus();
                                // Place cursor at the end
                                const range = document.createRange();
                                const selection = window.getSelection();
                                range.selectNodeContents(editor);
                                range.collapse(false);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            }, 300);
                        }
                        break;
                    }
                }
            }
        }
        
        // Utility function for consistent highlight and scroll behavior
        function highlightAndScroll(element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Highlight briefly
            const originalBackground = element.style.backgroundColor;
            element.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            element.style.transition = 'background-color 0.3s ease';
            
            setTimeout(() => {
                element.style.backgroundColor = originalBackground;
            }, 1500);
        }

        // Preview state management using CSS custom properties
        function setPreviewWidth(width) {
            document.documentElement.style.setProperty('--preview-width', width);
            localStorage.setItem('prompdPreviewWidth', width);
        }
        
        function getPreviewWidth() {
            return localStorage.getItem('prompdPreviewWidth') || '400px';
        }

        // Preview toggle functionality
        function togglePreview() {
            const previewPane = document.getElementById('preview-pane');
            const mainContent = document.getElementById('main-content');
            const toggleIcon = document.getElementById('toggle-icon');
            
            if (previewPane.classList.contains('collapsed')) {
                // Expanding - restore previous width
                previewPane.classList.remove('collapsed');
                mainContent.classList.remove('preview-collapsed');
                setPreviewWidth(getPreviewWidth());
                toggleIcon.textContent = '−';
            } else {
                // Collapsing - classes handle the rest
                previewPane.classList.add('collapsed');
                mainContent.classList.add('preview-collapsed');
                toggleIcon.textContent = '+';
            }
        }

        // Set up preview resizing
        let isResizing = false;
        let startX = 0;
        let startWidth = 400;
        
        const resizeHandle = document.getElementById('resize-handle');
        const previewPane = document.getElementById('preview-pane');
        const mainContent = document.querySelector('.main-content');
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(previewPane).width, 10);
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        });
        
        function handleResize(e) {
            if (!isResizing || previewPane.classList.contains('collapsed')) return;
            
            const newWidth = startWidth + (startX - e.clientX);
            const minWidth = 200;
            const maxWidth = window.innerWidth * 0.8;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setPreviewWidth(newWidth + 'px');
            }
        }
        
        function stopResize() {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
        }

        // Set up preview toggle
        document.getElementById('preview-toggle').addEventListener('click', togglePreview);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to exit maximize mode
            if (e.key === 'Escape') {
                const maximizedSection = document.querySelector('.section.maximized');
                if (maximizedSection) {
                    const index = parseInt(maximizedSection.dataset.index);
                    maximizeSection(index);
                    e.preventDefault();
                }
            }
            
            // Ctrl+Shift+M to collapse all
            if (e.ctrlKey && e.shiftKey && e.key === 'M') {
                collapseAllSections();
                e.preventDefault();
            }
            
            // Ctrl+Shift+E to expand all  
            if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                expandAllSections();
                e.preventDefault();
            }
        });

        // Auto-save on blur disabled to prevent destructive changes
        // document.addEventListener('blur', saveDocument, true);

        // Initialize fallback editors if Monaco doesn't load
        setTimeout(() => {
            if (!monacoReady) {
                console.log('Monaco Editor failed to load, using fallback contenteditable editors');
                document.addEventListener('input', scheduleAutoSave);
                initializeMarkdownEditors();
            }
        }, 5000);

        // Initialize preview width from storage
        setPreviewWidth(getPreviewWidth());

        // Initial preview - show current content
        updatePreview(generatePromptContent());
    </script>
</body>
</html>`;
    }

    private parsePromptDocument(content: string): ParsedPrompt {
        // Parse existing .prompd file into editable structure
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        const metadata: any = {};
        const parameters: any[] = [];

        if (frontmatterMatch) {
            try {
                const yaml = require('yaml');
                const parsed = yaml.parse(frontmatterMatch[1]);
                Object.assign(metadata, parsed);
                if (parsed.parameters) {
                    parameters.push(...parsed.parameters);
                }
            } catch (error) {
                console.error('Error parsing YAML:', error);
            }
        }

        // Parse sections
        const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        const sections: PromptSection[] = [];
        
        const sectionMatches = contentWithoutFrontmatter.split(/^# (.+)$/gm);
        for (let i = 1; i < sectionMatches.length; i += 2) {
            const type = sectionMatches[i].trim();
            const sectionContent = sectionMatches[i + 1]?.trim() || '';
            sections.push({ type, content: sectionContent });
        }

        return { metadata, parameters, sections };
    }

    private async saveDocument(document: vscode.TextDocument, content: string) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
        );
        await vscode.workspace.applyEdit(edit);
    }

    private async updateWebview(webview: vscode.Webview, document: vscode.TextDocument) {
        webview.html = this.getHtmlForWebview(webview, document);
    }

    private async addSection(document: vscode.TextDocument, sectionType: string, insertIndex: number) {
        // Add section logic
        console.log('Adding section:', sectionType, 'at index:', insertIndex);
    }

    private async updateSection(document: vscode.TextDocument, sectionIndex: number, content: string) {
        // Update section logic
        console.log('Updating section:', sectionIndex, 'with:', content);
    }

    private async deleteSection(document: vscode.TextDocument, sectionIndex: number) {
        // Delete section logic
        console.log('Deleting section:', sectionIndex);
    }

    private async reorderSections(document: vscode.TextDocument, oldIndex: number, newIndex: number) {
        // Reorder sections logic
        console.log('Reordering sections:', oldIndex, 'to', newIndex);
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

interface ParsedPrompt {
    metadata: any;
    parameters: any[];
    sections: PromptSection[];
}

interface PromptSection {
    type: string;
    content: string;
}
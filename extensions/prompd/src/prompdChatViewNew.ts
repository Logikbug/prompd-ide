import * as vscode from 'vscode';
import PrompdChatServiceSimple, { PrompdChatRequest, PrompdChatResponse, PrompdChatProvider } from './prompdChatServiceSimple';

/**
 * Redesigned Prompd Chat View Provider
 * 
 * New layout with bottom-docked textarea, sliding history drawer,
 * and improved conversation display
 */

export class PrompdChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prompdChat.chatView';
    private _view?: vscode.WebviewView;
    private chatService: PrompdChatServiceSimple;

    constructor(private readonly context: vscode.ExtensionContext) {
        console.log('🎯 PrompdChatViewProvider constructor called');
        this.chatService = new PrompdChatServiceSimple(context);
        console.log('✅ PrompdChatViewProvider initialized successfully');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleChatMessage(data.message);
                    break;
                case 'toggleHistory':
                    this.toggleHistoryDrawer();
                    break;
                case 'selectProvider':
                    this.selectProvider(data.provider);
                    break;
                case 'selectModel':
                    this.selectModel(data.model);
                    break;
                case 'loadHistory':
                    this.loadHistoryItems();
                    break;
                case 'clearHistory':
                    this.clearChatHistory();
                    break;
                case 'requestContext':
                    this.updateContextInfo();
                    break;
                case 'openExplorer':
                    this.openExplorer();
                    break;
            }
        });

        // Update the view when active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateContextInfo();
        });
    }

    private async handleChatMessage(message: string) {
        const activeEditor = vscode.window.activeTextEditor;
        let filePath = '';
        let fileExtension: '.prompd' | '.prompdflow' | 'general' = 'general';
        let currentContent = '';

        // Check if there's an active file
        if (activeEditor) {
            filePath = activeEditor.document.fileName;
            currentContent = activeEditor.document.getText();
            
            // Determine file type
            if (filePath.toLowerCase().endsWith('.prompd')) {
                fileExtension = '.prompd';
            } else if (filePath.toLowerCase().endsWith('.prompdflow')) {
                fileExtension = '.prompdflow';
            }
            // For any other file type, we'll use 'general' mode
        }

        // Show typing indicator
        this.showTypingIndicator(true);

        try {
            const request: PrompdChatRequest = {
                type: this.determineRequestType(message, fileExtension),
                fileType: fileExtension as any, // Will handle 'general' in service
                filePath: filePath,
                currentContent: currentContent,
                userMessage: message,
                context: await this.buildContext(activeEditor, message)
            };

            const response = await this.chatService.chat(request);
            this.displayChatResponse(response, request);

        } catch (error) {
            console.error('Chat error:', error);
            this.showMessage('Sorry, I encountered an error processing your request', 'error');
        } finally {
            this.showTypingIndicator(false);
        }
    }


    private determineRequestType(message: string, fileType: string): 'modify' | 'analyze' | 'optimize' | 'generate' | 'explain' {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('optimize') || lowerMessage.includes('improve')) {
            return 'optimize';
        } else if (lowerMessage.includes('explain') || lowerMessage.includes('what') || lowerMessage.includes('how')) {
            return 'explain';
        } else if (lowerMessage.includes('analyze') || lowerMessage.includes('review')) {
            return 'analyze';
        } else if (lowerMessage.includes('create') || lowerMessage.includes('generate') || lowerMessage.includes('make')) {
            return 'generate';
        } else {
            return fileType === 'general' ? 'analyze' : 'modify';
        }
    }

    private async buildContext(editor: vscode.TextEditor | undefined, message: string): Promise<any> {
        const context: any = {};
        
        if (editor) {
            context.selectedText = this.getSelectedText(editor);
            context.cursorPosition = editor.selection.active;
            context.fileName = editor.document.fileName;
            context.languageId = editor.document.languageId;
        }
        
        // Add workspace context
        context.workspaceFiles = await this.getWorkspaceContext(message);
        context.projectInfo = await this.getProjectInfo();
        
        return context;
    }

    private async getWorkspaceContext(message: string): Promise<string[]> {
        try {
            // Get relevant files based on the user's message
            const workspaceFiles = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,md,json,prompd,prompdflow}', 
                '**/node_modules/**', 
                20
            );
            return workspaceFiles.map(file => vscode.workspace.asRelativePath(file));
        } catch (error) {
            return [];
        }
    }

    private async getProjectInfo(): Promise<any> {
        try {
            // Look for project files that give context about the project
            const packageJson = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 1);
            const readme = await vscode.workspace.findFiles('**/README.md', '**/node_modules/**', 1);
            
            const projectInfo: any = {};
            
            if (packageJson.length > 0) {
                const content = await vscode.workspace.fs.readFile(packageJson[0]);
                try {
                    const pkg = JSON.parse(content.toString());
                    projectInfo.name = pkg.name;
                    projectInfo.description = pkg.description;
                    projectInfo.dependencies = Object.keys(pkg.dependencies || {});
                } catch {}
            }
            
            if (readme.length > 0) {
                const content = await vscode.workspace.fs.readFile(readme[0]);
                projectInfo.readme = content.toString().substring(0, 500); // First 500 chars
            }
            
            return projectInfo;
        } catch (error) {
            return {};
        }
    }

    private getSelectedText(editor: vscode.TextEditor): string | undefined {
        const selection = editor.selection;
        if (selection.isEmpty) return undefined;
        return editor.document.getText(selection);
    }

    private displayChatResponse(response: PrompdChatResponse, request: PrompdChatRequest) {
        this._view?.webview.postMessage({
            type: 'chatResponse',
            response: response,
            request: request,
            timestamp: new Date().toISOString()
        });
    }

    private showMessage(message: string, type: 'info' | 'warning' | 'error' | 'success') {
        this._view?.webview.postMessage({
            type: 'showMessage',
            message: message,
            messageType: type
        });
    }

    private showTypingIndicator(show: boolean) {
        this._view?.webview.postMessage({
            type: 'typingIndicator',
            show: show
        });
    }

    private async updateContextInfo() {
        const activeEditor = vscode.window.activeTextEditor;
        const providers = await this.chatService.getProviders();
        const currentProviderInfo = this.chatService.getCurrentProviderInfo();
        const models = await this.chatService.getModels();
        const hasConfiguredProvider = providers.some(p => p.enabled);
        
        const contextInfo = {
            hasActiveFile: !!activeEditor,
            fileName: activeEditor?.document.fileName,
            isPromptFile: activeEditor?.document.fileName.match(/\.(prompd|prompdflow)$/i) !== null,
            fileType: this.getFileTypeDescription(activeEditor),
            providers: providers,
            models: models,
            currentProvider: currentProviderInfo.provider,
            currentModel: currentProviderInfo.model,
            cliAvailable: currentProviderInfo.available,
            apiKeyConfigured: currentProviderInfo.apiKeyConfigured,
            setupInstructions: currentProviderInfo.setupInstructions,
            hasConfiguredProvider: hasConfiguredProvider,
            activeProvider: currentProviderInfo.provider,
            canChat: hasConfiguredProvider || currentProviderInfo.available
        };

        this._view?.webview.postMessage({
            type: 'updateContext',
            context: contextInfo
        });
    }

    private getFileTypeDescription(editor: vscode.TextEditor | undefined): string {
        if (!editor) {
            return 'No file open - general chat available';
        }
        
        const fileName = editor.document.fileName;
        if (fileName.toLowerCase().endsWith('.prompd')) {
            return 'Prompd file - prompt engineering assistance';
        } else if (fileName.toLowerCase().endsWith('.prompdflow')) {
            return 'Prompd workflow - flow optimization assistance';  
        } else {
            const ext = fileName.split('.').pop()?.toUpperCase() || 'Unknown';
            return `${ext} file - code analysis and general chat`;
        }
    }

    private clearChatHistory() {
        this.chatService.clearChatHistory();
        this._view?.webview.postMessage({ type: 'clearHistory' });
    }

    private loadHistoryItems() {
        const history = this.chatService.getChatHistory();
        this._view?.webview.postMessage({
            type: 'historyLoaded',
            history: history
        });
    }

    private toggleHistoryDrawer() {
        this._view?.webview.postMessage({ type: 'toggleHistoryDrawer' });
    }

    private async selectProvider(provider: string) {
        console.log('🔄 Switching to provider:', provider);
        this.chatService.setActiveProvider(provider);
        
        // Get models for the new provider
        const models = await this.chatService.getModels(provider);
        
        // Update the webview with new models
        this._view?.webview.postMessage({
            type: 'providerChanged',
            provider: provider,
            models: models
        });

        // Update context info
        this.updateContextInfo();
    }

    private selectModel(model: string) {
        console.log('🔄 Switching to model:', model);
        const currentInfo = this.chatService.getCurrentProviderInfo();
        this.chatService.setActiveProvider(currentInfo.provider, model);
        
        // Update context info
        this.updateContextInfo();
    }

    private openExplorer() {
        console.log('📁 Opening Explorer sidebar');
        vscode.commands.executeCommand('workbench.view.explorer');
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompd Chat</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Header */
        .chat-header {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            background: var(--vscode-sideBar-background);
            min-height: 40px;
            flex-shrink: 0;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
        }

        .prompd-icon {
            width: 16px;
            height: 16px;
            background: linear-gradient(135deg, #0078d4, #00bcf2);
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
        }

        .title-text {
            font-weight: 600;
            font-size: 13px;
        }

        /* Conversation Area */
        .conversation-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding-bottom: 350px; /* Space for taller input area */
        }

        .conversation-history {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        /* Message Styling */
        .message {
            display: flex;
            gap: 8px;
            max-width: 100%;
        }

        .message.user {
            flex-direction: row-reverse;
        }

        .avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            margin-top: 2px;
        }

        .avatar.user {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .avatar.assistant {
            background: linear-gradient(135deg, #0078d4, #00bcf2);
            color: white;
        }

        .message-bubble {
            padding: 8px 12px;
            border-radius: 12px;
            line-height: 1.4;
            word-wrap: break-word;
            max-width: 85%;
            font-size: 13px;
        }

        .message.user .message-bubble {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-bottom-right-radius: 4px;
        }

        .message.assistant .message-bubble {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-bottom-left-radius: 4px;
        }

        .message-time {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
            opacity: 0.7;
        }

        .message.user .message-time {
            text-align: right;
        }

        .copy-button {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            margin-top: 8px;
            margin-bottom: 4px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            transition: background-color 0.15s ease;
            max-width: 120px;
        }

        .copy-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .copy-button svg {
            flex-shrink: 0;
        }

        .message.user .copy-button {
            align-self: flex-end;
        }

        /* Welcome State */
        .welcome-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            text-align: center;
            padding: 20px;
        }

        .welcome-icon {
            font-size: 48px;
            margin-bottom: 12px;
            opacity: 0.6;
        }

        .welcome-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
        }

        .welcome-subtitle {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
        }

        .welcome-action {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            font-weight: 500;
            border-bottom: 1px solid transparent;
            transition: all 0.2s ease;
        }

        .welcome-action:hover {
            color: var(--vscode-textLink-activeForeground);
            border-bottom: 1px solid var(--vscode-textLink-activeForeground);
            text-decoration: none;
        }

        /* Bottom Input Area */
        .input-area {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-sideBar-border);
            padding: 12px;
            z-index: 100;
        }

        /* Provider/Model Controls */
        .controls-row {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
        }

        .provider-select, .model-select {
            flex: 1;
            padding: 4px 8px;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            color: var(--vscode-dropdown-foreground);
            font-size: 12px;
        }

        .history-toggle {
            background: transparent;
            color: var(--vscode-foreground);
            border: none;
            font-size: 14px;
            padding: 3px;
            border-radius: 4px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            transition: background-color 0.2s;
        }

        .history-toggle:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .status-indicator {
            font-size: 14px;
            padding: 3px;
            border-radius: 50%;
            cursor: help;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            transition: background-color 0.2s;
        }
        .status-indicator:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        /* Input Row */
        .input-row {
            position: relative;
            display: flex;
            align-items: flex-end;
        }

        .prompt-input {
            flex: 1;
            min-height: 250px;
            max-height: 300px;
            padding: 12px 40px 12px 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 13px;
            line-height: 1.4;
            resize: none;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .prompt-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .prompt-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .send-button {
            position: absolute;
            right: 8px;
            bottom: 8px;
            width: 28px;
            height: 28px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-size: 14px;
        }

        .send-button:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
            transform: scale(1.05);
        }

        .send-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            transform: none;
        }

        /* History Drawer */
        .history-drawer {
            position: fixed;
            bottom: 320px;
            left: 0;
            right: 0;
            height: 200px;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            transform: translateY(100%);
            transition: transform 0.3s ease;
            z-index: 50;
            overflow: hidden;
            box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
        }

        .history-drawer.open {
            transform: translateY(0);
        }

        .history-header {
            padding: 8px 12px;
            background: var(--vscode-sideBarSectionHeader-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }

        .history-list {
            height: calc(200px - 40px);
            overflow-y: auto;
            padding: 8px;
        }

        .history-item {
            padding: 6px 8px;
            margin-bottom: 4px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            line-height: 1.3;
            transition: background-color 0.2s;
        }

        .history-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .history-item-text {
            color: var(--vscode-foreground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .history-item-time {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            margin-top: 2px;
        }

        /* Typing Indicator */
        .typing-indicator {
            display: none;
            padding: 8px 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            font-size: 12px;
        }

        .typing-indicator.visible {
            display: block;
        }

        .typing-dots {
            display: inline-flex;
            gap: 2px;
            margin-left: 4px;
        }

        .typing-dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: var(--vscode-descriptionForeground);
            animation: typing 1.4s ease-in-out infinite;
        }

        .typing-dot:nth-child(1) { animation-delay: 0ms; }
        .typing-dot:nth-child(2) { animation-delay: 160ms; }
        .typing-dot:nth-child(3) { animation-delay: 320ms; }

        @keyframes typing {
            0%, 60%, 100% { transform: scale(0.8); opacity: 0.4; }
            30% { transform: scale(1); opacity: 1; }
        }

        /* Scrollbar */
        .conversation-history::-webkit-scrollbar,
        .history-list::-webkit-scrollbar {
            width: 4px;
        }

        .conversation-history::-webkit-scrollbar-track,
        .history-list::-webkit-scrollbar-track {
            background: transparent;
        }

        .conversation-history::-webkit-scrollbar-thumb,
        .history-list::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 2px;
        }

        .conversation-history::-webkit-scrollbar-thumb:hover,
        .history-list::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }

        /* Responsive */
        @media (max-height: 400px) {
            .history-drawer {
                height: 150px;
            }
            .input-area {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="chat-header">
        <div class="header-title">
            <div class="prompd-icon">P</div>
            <span class="title-text">Prompd Chat</span>
        </div>
    </div>

    <!-- Conversation Area -->
    <div class="conversation-area">
        <!-- Welcome State -->
        <div class="welcome-state" id="welcomeState">
            <div class="welcome-icon">💬</div>
            <div class="welcome-title">Ready to help!</div>
            <div class="welcome-subtitle">
                <a href="#" onclick="openExplorer()" class="welcome-action">Open Explorer</a> to browse your files or ask a question below
            </div>
        </div>

        <!-- Conversation History -->
        <div class="conversation-history" id="conversationHistory" style="display: none;">
            <!-- Messages will be inserted here -->
        </div>

        <!-- Typing Indicator -->
        <div class="typing-indicator" id="typingIndicator">
            AI is thinking<span class="typing-dots">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </span>
        </div>
    </div>

    <!-- Bottom Input Area -->
    <div class="input-area">
        <!-- Provider/Model Controls -->
        <div class="controls-row">
            <select class="provider-select" id="providerSelect">
                <option value="">Select Provider</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="local">Local Model</option>
            </select>
            <select class="model-select" id="modelSelect">
                <option value="">Select Model</option>
                <option value="gpt-4">GPT-4</option>
                <option value="claude-3">Claude 3</option>
                <option value="llama3">Llama 3</option>
            </select>
            <button class="history-toggle" onclick="toggleHistory()" id="historyToggle" title="Chat History">
                📓
            </button>
        </div>

        <!-- Input Row -->
        <div class="input-row">
            <textarea 
                id="promptInput" 
                class="prompt-input" 
                placeholder="Ask me to optimize your prompt, add parameters, debug workflows..."
                rows="1"
            ></textarea>
            <button id="sendButton" class="send-button" onclick="sendMessage()" disabled>
                →
            </button>
        </div>
    </div>

    <!-- History Drawer -->
    <div class="history-drawer" id="historyDrawer">
        <div class="history-header">
            Prompt History
        </div>
        <div class="history-list" id="historyList">
            <div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); font-size: 12px;">
                No prompts sent yet
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentContext = null;
        let conversationStarted = false;
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            setupTextarea();
            setupProviderControls();
            requestContext();
        });
        
        function setupTextarea() {
            const input = document.getElementById('promptInput');
            const sendButton = document.getElementById('sendButton');
            
            // Update send button state on input
            input.addEventListener('input', function(e) {
                const hasContent = e.target.value.trim().length > 0;
                sendButton.disabled = !hasContent || !isConfigured();
            });
            
            // Enter to send (Shift+Enter for new line)
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
        
        function setupProviderControls() {
            const providerSelect = document.getElementById('providerSelect');
            const modelSelect = document.getElementById('modelSelect');
            
            providerSelect.addEventListener('change', function(e) {
                vscode.postMessage({
                    type: 'selectProvider',
                    provider: e.target.value
                });
                updateModelOptions(e.target.value);
            });
            
            modelSelect.addEventListener('change', function(e) {
                vscode.postMessage({
                    type: 'selectModel',
                    model: e.target.value
                });
            });
        }
        
        function updateModelOptions(provider, models = null) {
            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = '<option value="">Select Model</option>';
            
            // Use provided models or defaults
            let availableModels = models;
            if (!availableModels) {
                const defaultModels = {
                    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                    anthropic: ['claude-3-sonnet', 'claude-3-haiku', 'claude-3-opus'],
                    local: ['llama3', 'mistral', 'codellama']
                };
                availableModels = defaultModels[provider] || [];
            }
            
            availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        }
        
        function sendMessage() {
            const input = document.getElementById('promptInput');
            const message = input.value.trim();
            
            if (!message || !isConfigured()) return;
            
            // Start conversation if needed
            if (!conversationStarted) {
                startConversation();
            }
            
            // Add user message
            addMessage(message, 'user');
            
            // Clear input
            input.value = '';
            document.getElementById('sendButton').disabled = true;
            
            // Send to extension
            vscode.postMessage({
                type: 'sendMessage',
                message: message
            });
        }
        
        function startConversation() {
            conversationStarted = true;
            document.getElementById('welcomeState').style.display = 'none';
            document.getElementById('conversationHistory').style.display = 'flex';
        }
        
        function addMessage(content, type, timestamp = null) {
            const container = document.getElementById('conversationHistory');
            
            const message = document.createElement('div');
            message.className = \`message \${type}\`;
            
            const avatar = document.createElement('div');
            avatar.className = \`avatar \${type}\`;
            if (type === 'user') {
                avatar.textContent = 'U';
            } else {
                avatar.innerHTML = '<div class="prompd-icon">P</div>';
            }
            
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            bubble.textContent = content;
            
            // Create copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = '' +
                '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">' +
                    '<path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>' +
                    '<path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>' +
                '</svg>' +
                'Copy';
            copyButton.title = 'Copy message';
            copyButton.onclick = (e) => {
                e.stopPropagation();
                const textToCopy = bubble.textContent || bubble.innerText;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = copyButton.innerHTML;
                    copyButton.innerHTML = '' +
                        '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">' +
                            '<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>' +
                        '</svg>' +
                        'Copied!';
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                    }, 2000);
                }).catch(() => {
                    const originalText = copyButton.innerHTML;
                    copyButton.textContent = 'Copy failed';
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                    }, 2000);
                });
            };

            const time = document.createElement('div');
            time.className = 'message-time';
            time.textContent = timestamp || new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const messageContent = document.createElement('div');
            messageContent.appendChild(bubble);
            messageContent.appendChild(copyButton);
            messageContent.appendChild(time);
            
            message.appendChild(avatar);
            message.appendChild(messageContent);
            
            container.appendChild(message);
            container.scrollTop = container.scrollHeight;
        }
        
        function toggleHistory() {
            const drawer = document.getElementById('historyDrawer');
            const toggle = document.getElementById('historyToggle');
            
            if (drawer.classList.contains('open')) {
                drawer.classList.remove('open');
                toggle.textContent = '📓';
                toggle.title = 'Chat History';
            } else {
                drawer.classList.add('open');
                toggle.textContent = '✕';
                toggle.title = 'Close History';
                loadHistory();
            }
        }
        
        function loadHistory() {
            vscode.postMessage({ type: 'loadHistory' });
        }
        
        function showTypingIndicator(show) {
            const indicator = document.getElementById('typingIndicator');
            if (show) {
                indicator.classList.add('visible');
                if (!conversationStarted) {
                    startConversation();
                }
            } else {
                indicator.classList.remove('visible');
            }
        }
        
        function updateContext(context) {
            currentContext = context;
            updateProviderSelections(context);
            updateUI();
        }

        function updateProviderSelections(context) {
            const providerSelect = document.getElementById('providerSelect');
            const modelSelect = document.getElementById('modelSelect');
            
            // Update providers
            if (context.providers) {
                providerSelect.innerHTML = '<option value="">Select Provider</option>';
                context.providers.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.name;
                    option.textContent = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
                    if (provider.name === context.currentProvider) {
                        option.selected = true;
                    }
                    providerSelect.appendChild(option);
                });
            }
            
            // Update models for current provider
            if (context.models && context.currentProvider) {
                updateModelOptions(context.currentProvider, context.models);
                if (context.currentModel) {
                    modelSelect.value = context.currentModel;
                }
            }
        }
        
        function updateUI() {
            const sendButton = document.getElementById('sendButton');
            const input = document.getElementById('promptInput');
            
            // Show CLI and API key status (icon only, details in tooltip)
            if (currentContext?.cliAvailable) {
                if (currentContext.apiKeyConfigured) {
                    updateStatusIndicator('🟢', 'Ready: CLI available with API key configured');
                } else {
                    updateStatusIndicator('🟡', \`Setup needed: API key required for \${currentContext.currentProvider}\`);
                }
            } else {
                updateStatusIndicator('🟡', 'Fallback mode: CLI not available, using mock responses');
            }
            
            const canChatWithLLM = currentContext?.cliAvailable && currentContext?.apiKeyConfigured;
            
            if (!currentContext?.canChat && !canChatWithLLM) {
                input.disabled = true;
                input.placeholder = "Select an AI provider and configure API key to start chatting";
            } else if (!canChatWithLLM && currentContext?.cliAvailable) {
                input.disabled = false;
                input.placeholder = \`API key needed for \${currentContext.currentProvider}. Using fallback mode for now...\`;
            } else if (currentContext.isPromptFile) {
                input.disabled = false;
                input.placeholder = "Ask me to optimize your prompt, add parameters, debug workflows...";
            } else if (currentContext.hasActiveFile) {
                input.disabled = false;
                input.placeholder = \`Ask about \${currentContext.fileName ? currentContext.fileName.split(/[\\\\\\/]/).pop() : 'this file'} or use #Context ./path/file.ext...\`;
            } else {
                input.disabled = false;
                input.placeholder = "Ask about your project or use #Context ./path/file.ext for specific files...";
            }
        }

        function updateStatusIndicator(status, tooltip) {
            let indicator = document.getElementById('statusIndicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'statusIndicator';
                indicator.className = 'status-indicator';
                document.querySelector('.controls-row').appendChild(indicator);
            }
            indicator.textContent = status;
            indicator.title = tooltip;
        }
        
        function isConfigured() {
            return currentContext && currentContext.hasConfiguredProvider; // Only need provider, not specific file
        }
        
        function requestContext() {
            vscode.postMessage({ type: 'requestContext' });
        }

        function openExplorer() {
            vscode.postMessage({ type: 'openExplorer' });
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'chatResponse':
                    showTypingIndicator(false);
                    addMessage(message.response.message, 'assistant', message.timestamp);
                    break;
                    
                case 'typingIndicator':
                    showTypingIndicator(message.show);
                    break;
                    
                case 'updateContext':
                    updateContext(message.context);
                    break;
                    
                case 'historyLoaded':
                    displayHistory(message.history);
                    break;
                    
                case 'showMessage':
                    if (conversationStarted) {
                        addMessage(message.message, 'assistant');
                    }
                    break;
                    
                case 'providerChanged':
                    updateModelOptions(message.provider, message.models);
                    break;
                    
                case 'toggleHistoryDrawer':
                    toggleHistory();
                    break;
            }
        });
        
        function displayHistory(history) {
            const historyList = document.getElementById('historyList');
            
            if (!history || history.length === 0) {
                historyList.innerHTML = 
                    '<div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); font-size: 12px;">' +
                        'No prompts sent yet' +
                    '</div>';
                return;
            }
            
            historyList.innerHTML = history.map((item, index) => 
                '<div class="history-item" onclick="selectHistoryItem(' + index + ')">' +
                    '<div class="history-item-text">' + (item.content || item.message || 'Message') + '</div>' +
                    '<div class="history-item-time">' + new Date(item.timestamp || Date.now()).toLocaleString() + '</div>' +
                '</div>'
            ).join('');
        }
        
        function selectHistoryItem(index) {
            const input = document.getElementById('promptInput');
            // Could load the selected history item back into the input
            console.log('Selected history item:', index);
        }
    </script>
</body>
</html>`;
    }
}
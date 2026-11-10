import * as vscode from 'vscode';
import PrompdChatServiceSimple, { PrompdChatRequest, PrompdChatResponse, PrompdChatProvider } from './prompdChatServiceSimple';

/**
 * Prompd Chat View Provider
 * 
 * Creates a dedicated sidebar view for the Prompd AI assistant
 * Provides an intuitive chat interface for interacting with prompt files
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
                case 'applyModifications':
                    await this.applyModifications(data.modifications, data.filePath);
                    break;
                case 'configureProvider':
                    await this.configureProvider(data.provider);
                    break;
                case 'clearHistory':
                    this.clearChatHistory();
                    break;
                case 'exportChat':
                    await this.exportChatHistory();
                    break;
                case 'loadHistory':
                    this.sendHistoryToWebview();
                    break;
                case 'loadHistoryItem':
                    this.loadHistoryItem(data.itemId);
                    break;
                case 'requestContext':
                    this.updateContextInfo();
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
        if (!activeEditor) {
            this.showMessage('Please open a .prompd or .pdflow file first', 'error');
            return;
        }

        const filePath = activeEditor.document.fileName;
        const fileExtension = filePath.toLowerCase().endsWith('.prompd') ? '.prompd' : 
                             filePath.toLowerCase().endsWith('.pdflow') ? '.pdflow' : null;

        if (!fileExtension) {
            this.showMessage('Prompd Chat only works with .prompd and .pdflow files', 'warning');
            return;
        }

        // Show typing indicator
        this.showTypingIndicator(true);

        try {
            const request: PrompdChatRequest = {
                type: 'modify', // Auto-detect based on message content
                fileType: fileExtension,
                filePath: filePath,
                currentContent: activeEditor.document.getText(),
                userMessage: message,
                context: {
                    selectedText: this.getSelectedText(activeEditor),
                    cursorPosition: activeEditor.selection.active,
                    activeSection: this.detectActiveSection(activeEditor),
                    workspaceFiles: await this.getWorkspacePromptFiles()
                }
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

    private async applyModifications(modifications: any[], filePath: string) {
        const success = await this.chatService.applyModifications(modifications, filePath);
        if (success) {
            this.showMessage('Changes applied successfully!', 'success');
        }
    }

    private async configureProvider(providerData: any) {
        // Use Continue integration for provider configuration
        await this.chatService.getContinueIntegration().openProviderConfiguration();
        
        // Update context after configuration
        setTimeout(() => {
            this.updateContextInfo();
        }, 1000);
    }

    private async showProviderSetup(provider: PrompdChatProvider) {
        const panel = vscode.window.createWebviewPanel(
            'prompdProviderSetup',
            `Configure ${provider.name}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getProviderSetupHtml(provider);
        
        panel.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'saveProvider') {
                // Save provider configuration
                await this.context.globalState.update(`prompd.provider.${provider.name}`, data.config);
                this.chatService.setActiveProvider(provider.name);
                panel.dispose();
                this.showMessage(`${provider.name} configured successfully!`, 'success');
                this.updateContextInfo();
            }
        });
    }

    private getSelectedText(editor: vscode.TextEditor): string | undefined {
        const selection = editor.selection;
        if (selection.isEmpty) return undefined;
        return editor.document.getText(selection);
    }

    private detectActiveSection(editor: vscode.TextEditor): string | undefined {
        const position = editor.selection.active;
        const document = editor.document;
        
        // Look backwards from cursor to find the nearest section header
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text.trim();
            if (line.startsWith('# ')) {
                return line.substring(2).trim();
            }
        }
        return undefined;
    }

    private async getWorkspacePromptFiles(): Promise<string[]> {
        const files = await vscode.workspace.findFiles('**/*.{prompd,prompdflow}', '**/node_modules/**', 50);
        return files.map(file => file.fsPath);
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
        const hasConfiguredProvider = providers.some((p: any) => p.enabled && (p.apiKey || p.name.toLowerCase().includes('local')));
        
        const contextInfo = {
            hasActiveFile: !!activeEditor,
            fileName: activeEditor?.document.fileName,
            isPromptFile: activeEditor?.document.fileName.match(/\.(prompd|prompdflow)$/i) !== null,
            providers: providers,
            hasConfiguredProvider: hasConfiguredProvider,
            activeProvider: providers.find((p: any) => p.enabled)?.name || 'None'
        };

        this._view?.webview.postMessage({
            type: 'updateContext',
            context: contextInfo
        });
    }

    private clearChatHistory() {
        this.chatService.clearChatHistory();
        this._view?.webview.postMessage({ type: 'clearHistory' });
    }

    private async exportChatHistory() {
        const content = this.chatService.exportChatHistory();
        
        const uri = await vscode.window.showSaveDialog({
            filters: { 'JSON': ['json'] },
            defaultUri: vscode.Uri.file('prompd-chat-history.json')
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage('Chat history exported successfully');
        }
    }

    private sendHistoryToWebview() {
        const history = this.chatService.getChatHistory();
        const groupedHistory = this.groupHistoryByConversation(history);
        this._view?.webview.postMessage({
            type: 'historyLoaded',
            historyItems: groupedHistory.map((conversation, index) => ({
                id: `conversation-${index}`,
                userMessage: conversation.userMessage?.content || 'No message',
                assistantMessage: conversation.assistantMessage?.content || 'No response',
                timestamp: conversation.userMessage?.timestamp || new Date(),
                fileContext: conversation.userMessage?.context?.filePath || undefined
            }))
        });
    }

    private groupHistoryByConversation(history: any[]): Array<{userMessage?: any, assistantMessage?: any}> {
        const conversations: Array<{userMessage?: any, assistantMessage?: any}> = [];
        let currentConversation: {userMessage?: any, assistantMessage?: any} = {};
        
        for (const item of history) {
            if (item.role === 'user') {
                if (currentConversation.userMessage) {
                    conversations.push(currentConversation);
                    currentConversation = {};
                }
                currentConversation.userMessage = item;
            } else if (item.role === 'assistant') {
                currentConversation.assistantMessage = item;
            }
        }
        
        if (currentConversation.userMessage) {
            conversations.push(currentConversation);
        }
        
        return conversations;
    }

    private loadHistoryItem(itemId: string) {
        const history = this.chatService.getChatHistory();
        const groupedHistory = this.groupHistoryByConversation(history);
        const conversationIndex = parseInt(itemId.replace('conversation-', ''));
        const conversation = groupedHistory[conversationIndex];
        
        if (conversation) {
            this._view?.webview.postMessage({
                type: 'historyItemLoaded',
                historyItem: {
                    userMessage: conversation.userMessage?.content || '',
                    assistantMessage: conversation.assistantMessage?.content || '',
                    timestamp: conversation.userMessage?.timestamp || new Date(),
                    fileContext: conversation.userMessage?.context?.filePath || undefined
                }
            });
        }
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
            position: relative;
        }

        /* Main Layout */
        .chat-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        .conversation-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding: 0 0 200px 0; /* Space for bottom input area */
        }

        .history-sidebar {
            width: 280px;
            background: var(--vscode-sideBar-background);
            border-left: 1px solid var(--vscode-sideBar-border);
            display: flex;
            flex-direction: column;
            transition: width 0.2s ease;
        }

        .history-sidebar.collapsed {
            width: 0;
            overflow: hidden;
        }

        .history-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBarSectionHeader-background);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .history-title {
            font-weight: 600;
            font-size: 13px;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }

        .history-actions {
            display: flex;
            gap: 4px;
        }

        .history-action {
            background: none;
            border: none;
            color: var(--vscode-sideBarSectionHeader-foreground);
            cursor: pointer;
            padding: 4px;
            border-radius: 3px;
            opacity: 0.8;
            transition: all 0.2s ease;
        }

        .history-action:hover {
            opacity: 1;
            background: var(--vscode-toolbar-hoverBackground);
        }

        .history-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }

        .history-item {
            padding: 8px 12px;
            margin-bottom: 4px;
            border-radius: 6px;
            cursor: pointer;
            border-left: 3px solid transparent;
            transition: all 0.2s ease;
        }

        .history-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .history-item.active {
            background: var(--vscode-list-activeSelectionBackground);
            border-left-color: var(--vscode-focusBorder);
        }

        .history-item-title {
            font-size: 12px;
            font-weight: 500;
            color: var(--vscode-list-activeSelectionForeground);
            margin-bottom: 2px;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .history-item-meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .history-toggle {
            background: none;
            border: none;
            color: var(--vscode-button-foreground);
            cursor: pointer;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 11px;
            opacity: 0.8;
            transition: all 0.2s ease;
        }

        .history-toggle:hover {
            opacity: 1;
            background: var(--vscode-button-secondaryHoverBackground);
        }

        /* Header Section */
        .chat-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            background: var(--vscode-sideBar-background);
            min-height: 48px;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
        }

        .prompd-icon {
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #0078d4, #00bcf2);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: bold;
        }

        .title-text {
            font-weight: 600;
            font-size: 14px;
        }

        .status-badge {
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
        }

        .status-badge.connected {
            background: rgba(0, 128, 0, 0.15);
            color: var(--vscode-terminal-ansiGreen);
        }

        .status-badge.disconnected {
            background: rgba(255, 0, 0, 0.15);
            color: var(--vscode-errorForeground);
        }

        .header-actions {
            display: flex;
            gap: 4px;
        }

        .header-button {
            width: 24px;
            height: 24px;
            background: none;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-icon-foreground);
            opacity: 0.7;
            transition: all 0.2s ease;
        }

        .header-button:hover {
            background: var(--vscode-toolbar-hoverBackground);
            opacity: 1;
        }

        /* Context Info */
        .context-banner {
            padding: 8px 16px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .context-banner.warning {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
        }

        .context-banner.success {
            background: rgba(0, 128, 0, 0.15);
            color: var(--vscode-terminal-ansiGreen);
        }

        /* Chat Messages */
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            scroll-behavior: smooth;
        }

        .message-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .message {
            display: flex;
            gap: 8px;
            max-width: 100%;
        }

        .message.user {
            flex-direction: row-reverse;
        }

        .avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
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

        .message-content {
            flex: 1;
            min-width: 0;
        }

        .message.user .message-content {
            text-align: right;
        }

        .message-bubble {
            padding: 12px 16px;
            border-radius: 16px;
            line-height: 1.4;
            word-wrap: break-word;
            position: relative;
            max-width: 85%;
            display: inline-block;
        }

        .message.user .message-bubble {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            margin-left: auto;
            border-bottom-right-radius: 6px;
        }

        .message.assistant .message-bubble {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-bottom-left-radius: 6px;
        }

        .message-timestamp {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
            opacity: 0.7;
        }

        .message.user .message-timestamp {
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

        /* Suggestion Cards */
        .suggestion-cards {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 12px;
        }

        .suggestion-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .suggestion-card:hover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-hoverBackground);
        }

        .suggestion-title {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
            color: var(--vscode-foreground);
        }

        .suggestion-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.3;
        }

        .modification-preview {
            background: var(--vscode-textCodeBlock-background);
            border-radius: 6px;
            padding: 10px 12px;
            margin-top: 12px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }

        .modification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .modification-count {
            font-size: 12px;
            color: var(--vscode-textLink-foreground);
            font-weight: 600;
        }

        .apply-all-button {
            padding: 4px 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            font-weight: 500;
        }

        .apply-all-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .modification-item {
            font-size: 12px;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .modification-item:last-child {
            border-bottom: none;
        }

        .modification-type {
            color: var(--vscode-textLink-foreground);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 10px;
        }

        /* Typing Indicator */
        .typing-indicator {
            display: none;
        }

        .typing-indicator.visible {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            margin-bottom: 8px;
        }

        .typing-dots {
            display: flex;
            gap: 4px;
        }

        .typing-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--vscode-descriptionForeground);
            animation: typing 1.4s ease-in-out infinite;
        }

        .typing-dot:nth-child(1) { animation-delay: 0ms; }
        .typing-dot:nth-child(2) { animation-delay: 160ms; }
        .typing-dot:nth-child(3) { animation-delay: 320ms; }

        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-10px); opacity: 1; }
        }

        .typing-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        /* Welcome Screen */
        .welcome-screen {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 16px;
            text-align: center;
        }

        .welcome-icon {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #0078d4, #00bcf2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 28px;
            margin-bottom: 16px;
        }

        .welcome-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .welcome-subtitle {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
            margin-bottom: 24px;
        }

        .setup-button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .setup-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .capability-list {
            margin-top: 24px;
            text-align: left;
            max-width: 280px;
        }

        .capability-list h4 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-foreground);
        }

        .capability-list ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .capability-list li {
            padding: 4px 0;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .capability-list li::before {
            content: '✨';
            font-size: 12px;
        }

        /* Input Section */
        .input-section {
            border-top: 1px solid var(--vscode-sideBar-border);
            background: var(--vscode-sideBar-background);
        }

        .quick-suggestions {
            padding: 12px 16px 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .quick-suggestion {
            padding: 4px 8px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 12px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .quick-suggestion:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
        }

        .input-container {
            padding: 8px 16px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .input-wrapper {
            position: relative;
            display: flex;
            align-items: flex-end;
            gap: 8px;
        }

        .message-input {
            flex: 1;
            min-height: 36px;
            max-height: 120px;
            padding: 10px 40px 10px 12px;
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

        .message-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .message-input::placeholder {
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
            opacity: 0.7;
        }

        .send-button:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
            opacity: 1;
            transform: scale(1.05);
        }

        .send-button:disabled {
            opacity: 0.3;
            cursor: not-allowed;
            transform: none;
        }

        .input-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding-top: 4px;
        }

        .keyboard-hint {
            opacity: 0.7;
        }

        .char-count {
            opacity: 0.5;
        }

        .char-count.warning {
            color: var(--vscode-inputValidation-warningForeground);
            opacity: 1;
        }

        /* Scrollbar Styling */
        .chat-messages::-webkit-scrollbar {
            width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }

        /* Empty State */
        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 16px;
            text-align: center;
            opacity: 0.8;
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .empty-state-text {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            line-height: 1.5;
        }

        /* Responsive adjustments */
        @media (max-width: 300px) {
            .message-bubble {
                max-width: 95%;
            }
            
            .input-container {
                padding: 8px 12px 12px;
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
            <div class="status-badge disconnected" id="statusBadge">offline</div>
        </div>
        <div class="header-actions">
            <button class="history-toggle" onclick="toggleHistory()" id="historyToggle" title="Toggle chat history">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1zM3 3h10v10H3V3z"/>
                    <path d="M5 5h6v1H5V5zm0 2h6v1H5V7zm0 2h4v1H5V9z"/>
                </svg>
            </button>
            <button class="header-button" onclick="clearHistory()" title="Clear conversation">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 1.152l.557 10.034A2 2 0 0 0 5.046 16h5.908a2 2 0 0 0 1.993-1.814l.557-10.034A.58.58 0 0 0 13.494 2.5H11Zm-2 3a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Zm-3 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Zm5 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z"/>
                </svg>
            </button>
            <button class="header-button" onclick="exportHistory()" title="Export conversation">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                </svg>
            </button>
        </div>
    </div>

    <!-- Main Chat Area -->
    <div class="chat-main">
        <!-- Chat Content -->
        <div class="chat-content">
            <!-- Context Banner -->
    <div class="context-banner warning" id="contextBanner" style="display: none;">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
        </svg>
        <span id="contextText">No .prompd or .prompdflow file open</span>
    </div>

    <!-- Welcome Screen -->
    <div class="welcome-screen" id="welcomeScreen">
        <div class="welcome-icon">🤖</div>
        <div class="welcome-title">Welcome to Prompd Chat</div>
        <div class="welcome-subtitle">
            Your AI assistant for professional prompt engineering.<br>
            Get started by configuring an AI provider.
        </div>
        <button class="setup-button" onclick="configureProvider()">Configure AI Provider</button>
        
        <div class="capability-list">
            <h4>What I can help you with:</h4>
            <ul>
                <li>Optimize prompt effectiveness</li>
                <li>Improve structure and clarity</li>
                <li>Add parameters and variables</li>
                <li>Design workflow connections</li>
                <li>Explain concepts and techniques</li>
                <li>Generate prompts from descriptions</li>
            </ul>
        </div>
    </div>

    <!-- Chat Messages -->
    <div class="chat-messages" id="chatMessages" style="display: none;">
        <!-- Messages will be inserted here -->
    </div>

    <!-- Typing Indicator -->
    <div class="typing-indicator" id="typingIndicator">
        <div class="avatar assistant">
            <div class="prompd-icon">P</div>
        </div>
        <div>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <div class="typing-text">Prompd is thinking...</div>
        </div>
    </div>

    <!-- Empty State -->
    <div class="empty-state" id="emptyState" style="display: none;">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-text">
            Start a conversation by asking me about your prompt or workflow.<br>
            I'm here to help you create better prompts!
        </div>
    </div>

    <!-- Input Section -->
    <div class="input-section">
        <!-- Quick Suggestions -->
        <div class="quick-suggestions" id="quickSuggestions">
            <button class="quick-suggestion" onclick="sendQuickMessage('Optimize this prompt for better results')">
                ⚡ Optimize
            </button>
            <button class="quick-suggestion" onclick="sendQuickMessage('Add parameters to make this flexible')">
                🔧 Add Parameters
            </button>
            <button class="quick-suggestion" onclick="sendQuickMessage('Explain what this prompt does')">
                📖 Explain
            </button>
            <button class="quick-suggestion" onclick="sendQuickMessage('Improve the structure and organization')">
                🏗️ Structure
            </button>
        </div>

        <!-- Input Container -->
        <div class="input-container">
            <div class="input-wrapper">
                <textarea 
                    id="messageInput" 
                    class="message-input" 
                    placeholder="Ask me to optimize your prompt, add parameters, explain concepts..."
                    rows="1"
                    disabled
                ></textarea>
                <button id="sendButton" class="send-button" onclick="sendMessage()" disabled>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M15.854.146a.5.5 0 0 1 .11.54L13.026 8.74a.5.5 0 0 1-.708.396L8.49 7.89l-.777 2.334a.5.5 0 0 1-.948 0L5.988 7.89 2.16 9.136a.5.5 0 0 1-.708-.396L.514.686A.5.5 0 0 1 1.146.146l14.708 0z"/>
                    </svg>
                </button>
            </div>
            <div class="input-footer">
                <span class="keyboard-hint">Press Enter to send, Shift+Enter for new line</span>
                <span class="char-count" id="charCount">0 / 2000</span>
            </div>
        </div>
        </div>
        
        <!-- History Sidebar -->
        <div class="history-sidebar collapsed" id="historySidebar">
            <div class="history-header">
                <span class="history-title">Chat History</span>
                <div class="history-actions">
                    <button class="history-action" onclick="clearHistory()" title="Clear all history">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 1.152l.557 10.034A2 2 0 0 0 5.046 16h5.908a2 2 0 0 0 1.993-1.814l.557-10.034A.58.58 0 0 0 13.494 2.5H11Zm-2 3a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Zm-3 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Zm5 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z"/>
                        </svg>
                    </button>
                    <button class="history-action" onclick="exportHistory()" title="Export history">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="history-list" id="historyList">
                <div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); font-size: 12px;">
                    No chat history yet
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let isConfigured = false;
        let conversationStarted = false;
        
        // Initialize UI
        document.addEventListener('DOMContentLoaded', function() {
            setupTextarea();
            setupKeyboardShortcuts();
            updateCharCount();
        });
        
        // Enhanced textarea handling
        function setupTextarea() {
            const input = document.getElementById('messageInput');
            const charCount = document.getElementById('charCount');
            const sendButton = document.getElementById('sendButton');
            
            // Auto-resize textarea
            input.addEventListener('input', function(e) {
                // Reset height to calculate new height
                e.target.style.height = 'auto';
                const newHeight = Math.min(e.target.scrollHeight, 120);
                e.target.style.height = newHeight + 'px';
                
                // Update character count
                updateCharCount();
                
                // Update send button state
                const hasContent = e.target.value.trim().length > 0;
                sendButton.style.opacity = hasContent && isConfigured ? '1' : '0.7';
            });
            
            // Focus handling
            input.addEventListener('focus', function() {
                input.style.borderColor = 'var(--vscode-focusBorder)';
            });
            
            input.addEventListener('blur', function() {
                input.style.borderColor = 'var(--vscode-input-border)';
            });
        }
        
        function setupKeyboardShortcuts() {
            const input = document.getElementById('messageInput');
            
            input.addEventListener('keydown', function(e) {
                // Send on Enter (Shift+Enter for new line)
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
                
                // Quick commands
                if (e.key === 'ArrowUp' && e.ctrlKey) {
                    e.preventDefault();
                    // Could implement command history here
                }
            });
        }
        
        function updateCharCount() {
            const input = document.getElementById('messageInput');
            const charCount = document.getElementById('charCount');
            const currentLength = input.value.length;
            const maxLength = 2000;
            
            charCount.textContent = \`\${currentLength} / \${maxLength}\`;
            
            if (currentLength > maxLength * 0.9) {
                charCount.classList.add('warning');
            } else {
                charCount.classList.remove('warning');
            }
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message || !isConfigured) return;
            
            // Show chat messages area if first message
            if (!conversationStarted) {
                startConversation();
            }
            
            // Add user message to chat
            addMessage(message, 'user');
            
            // Clear input and reset height
            input.value = '';
            input.style.height = 'auto';
            updateCharCount();
            
            // Send to extension
            vscode.postMessage({
                type: 'sendMessage',
                message: message
            });
        }
        
        function sendQuickMessage(message) {
            const input = document.getElementById('messageInput');
            input.value = message;
            input.focus();
            updateCharCount();
            sendMessage();
        }
        
        function startConversation() {
            conversationStarted = true;
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('chatMessages').style.display = 'flex';
        }
        
        function addMessage(content, type, data = null) {
            const container = document.getElementById('chatMessages');
            
            // Create message group
            const messageGroup = document.createElement('div');
            messageGroup.className = 'message-group';
            
            // Create message
            const message = document.createElement('div');
            message.className = \`message \${type}\`;
            
            // Create avatar
            const avatar = document.createElement('div');
            avatar.className = \`avatar \${type}\`;
            if (type === 'user') {
                avatar.textContent = 'You'[0];
            } else {
                const icon = document.createElement('div');
                icon.className = 'prompd-icon';
                icon.textContent = 'P';
                avatar.appendChild(icon);
            }
            
            // Create message content
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            const messageBubble = document.createElement('div');
            messageBubble.className = 'message-bubble';
            
            // Add content based on type
            if (type === 'assistant' && data?.modifications?.length > 0) {
                messageBubble.innerHTML = \`
                    <div>\${content}</div>
                    <div class="modification-preview">
                        <div class="modification-header">
                            <span class="modification-count">\${data.modifications.length} suggested changes</span>
                            <button class="apply-all-button" onclick="applyModifications(\${JSON.stringify(data.modifications)}, '\${data.filePath}')">
                                Apply All
                            </button>
                        </div>
                        \${data.modifications.slice(0, 3).map(mod => \`
                            <div class="modification-item">
                                <span class="modification-type">\${mod.type}</span> \${mod.description}
                            </div>
                        \`).join('')}
                        \${data.modifications.length > 3 ? \`<div class="modification-item">+ \${data.modifications.length - 3} more changes</div>\` : ''}
                    </div>
                \`;
            } else if (type === 'assistant' && data?.suggestions?.length > 0) {
                messageBubble.innerHTML = content;
                
                // Add suggestion cards
                const suggestionCards = document.createElement('div');
                suggestionCards.className = 'suggestion-cards';
                
                data.suggestions.forEach(suggestion => {
                    const card = document.createElement('div');
                    card.className = 'suggestion-card';
                    card.innerHTML = \`
                        <div class="suggestion-title">\${suggestion.title}</div>
                        <div class="suggestion-description">\${suggestion.description}</div>
                    \`;
                    card.onclick = () => {
                        if (suggestion.action) {
                            suggestion.action();
                        }
                    };
                    suggestionCards.appendChild(card);
                });
                
                messageBubble.appendChild(suggestionCards);
            } else {
                messageBubble.textContent = content;
            }
            
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
                const textToCopy = messageBubble.textContent || messageBubble.innerText;
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

            // Create timestamp
            const timestamp = document.createElement('div');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Assemble message
            messageContent.appendChild(messageBubble);
            messageContent.appendChild(copyButton);
            messageContent.appendChild(timestamp);
            
            message.appendChild(avatar);
            message.appendChild(messageContent);
            
            messageGroup.appendChild(message);
            container.appendChild(messageGroup);
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }
        
        function applyModifications(modifications, filePath) {
            vscode.postMessage({
                type: 'applyModifications',
                modifications: modifications,
                filePath: filePath
            });
        }
        
        function configureProvider() {
            vscode.postMessage({
                type: 'configureProvider'
            });
        }
        
        function clearHistory() {
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            conversationStarted = false;
            
            // Show welcome screen again
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.getElementById('chatMessages').style.display = 'none';
            
            vscode.postMessage({ type: 'clearHistory' });
        }
        
        function exportHistory() {
            vscode.postMessage({ type: 'exportChat' });
        }
        
        function toggleHistory() {
            const sidebar = document.getElementById('historySidebar');
            const isCollapsed = sidebar.classList.contains('collapsed');
            
            if (isCollapsed) {
                sidebar.classList.remove('collapsed');
                // Load history when shown
                vscode.postMessage({ type: 'loadHistory' });
            } else {
                sidebar.classList.add('collapsed');
            }
        }
        
        function loadHistoryItems(historyItems) {
            const historyList = document.getElementById('historyList');
            
            if (!historyItems || historyItems.length === 0) {
                historyList.innerHTML = 
                    '<div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); font-size: 12px;">' +
                        'No chat history yet' +
                    '</div>';
                return;
            }
            
            historyList.innerHTML = historyItems.map(item => 
                '<div class="history-item" onclick="loadHistoryItem(\\'' + item.id + '\\')>"' +
                    '<div class="history-item-title">' + item.userMessage + '</div>' +
                    '<div class="history-item-meta">' +
                        '<span>📅 ' + new Date(item.timestamp).toLocaleDateString() + '</span>' +
                        (item.fileContext ? '<span>📄 ' + item.fileContext.split('/').pop() + '</span>' : '') +
                    '</div>' +
                '</div>'
            ).join('');
        }
        
        function loadHistoryItem(itemId) {
            vscode.postMessage({ 
                type: 'loadHistoryItem', 
                itemId: itemId 
            });
        }
        
        function showTypingIndicator(show) {
            const indicator = document.getElementById('typingIndicator');
            
            if (show) {
                indicator.classList.add('visible');
                if (!conversationStarted) {
                    startConversation();
                }
                
                // Scroll to show typing indicator
                const container = document.getElementById('chatMessages');
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            } else {
                indicator.classList.remove('visible');
            }
        }
        
        function updateContext(context) {
            const contextBanner = document.getElementById('contextBanner');
            const contextText = document.getElementById('contextText');
            const welcomeScreen = document.getElementById('welcomeScreen');
            const messageInput = document.getElementById('messageInput');
            const sendButton = document.getElementById('sendButton');
            const quickSuggestions = document.getElementById('quickSuggestions');
            const statusBadge = document.getElementById('statusBadge');
            
            isConfigured = context.hasConfiguredProvider;
            
            // Update status badge
            if (isConfigured) {
                statusBadge.textContent = 'online';
                statusBadge.className = 'status-badge connected';
            } else {
                statusBadge.textContent = 'offline';
                statusBadge.className = 'status-badge disconnected';
            }
            
            if (!context.hasConfiguredProvider) {
                contextBanner.style.display = 'flex';
                contextBanner.className = 'context-banner warning';
                contextText.textContent = 'Configure an AI provider to start using Prompd Chat';
                welcomeScreen.style.display = 'flex';
                messageInput.disabled = true;
                sendButton.disabled = true;
                updateQuickSuggestions([]);
            } else if (!context.isPromptFile) {
                contextBanner.style.display = 'flex';
                contextBanner.className = 'context-banner warning';
                contextText.textContent = 'Open a .prompd or .prompdflow file to get started';
                if (!conversationStarted) {
                    document.getElementById('emptyState').style.display = 'flex';
                    welcomeScreen.style.display = 'none';
                }
                messageInput.disabled = true;
                sendButton.disabled = true;
                updateQuickSuggestions([]);
            } else {
                const fileName = context.fileName.split(/[\\\\/]/).pop();
                contextBanner.style.display = 'flex';
                contextBanner.className = 'context-banner success';
                contextText.innerHTML = \`
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                    Ready to help with \${fileName}
                \`;
                welcomeScreen.style.display = 'none';
                if (!conversationStarted) {
                    document.getElementById('emptyState').style.display = 'flex';
                }
                messageInput.disabled = false;
                sendButton.disabled = false;
                
                // Update quick suggestions based on file type
                const suggestions = context.fileName.endsWith('.prompdflow') 
                    ? ['⚡ Optimize workflow', '🔗 Fix connections', '➕ Add step', '📊 Analyze flow']
                    : ['⚡ Optimize', '🔧 Add Parameters', '📖 Explain', '🏗️ Structure'];
                updateQuickSuggestions(suggestions);
            }
        }
        
        function updateQuickSuggestions(suggestions) {
            const container = document.getElementById('quickSuggestions');
            container.innerHTML = '';
            
            suggestions.forEach(suggestion => {
                const button = document.createElement('button');
                button.className = 'quick-suggestion';
                button.textContent = suggestion;
                button.onclick = () => sendQuickMessage(getQuickMessageText(suggestion));
                container.appendChild(button);
            });
            
            container.style.display = suggestions.length > 0 ? 'flex' : 'none';
        }
        
        function getQuickMessageText(suggestion) {
            const messageMap = {
                '⚡ Optimize': 'Optimize this prompt for better results',
                '🔧 Add Parameters': 'Add parameters to make this prompt more flexible',
                '📖 Explain': 'Explain what this prompt does and how it works',
                '🏗️ Structure': 'Improve the structure and organization of this prompt',
                '⚡ Optimize workflow': 'Optimize this workflow for better performance',
                '🔗 Fix connections': 'Fix any connection issues in this workflow',
                '➕ Add step': 'Add a new step to improve this workflow',
                '📊 Analyze flow': 'Analyze this workflow and suggest improvements'
            };
            
            return messageMap[suggestion] || suggestion;
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'chatResponse':
                    showTypingIndicator(false);
                    addMessage(message.response.message, 'assistant', {
                        modifications: message.response.modifications,
                        suggestions: message.response.suggestions,
                        filePath: message.request.filePath
                    });
                    break;
                    
                case 'showMessage':
                    if (!conversationStarted) {
                        startConversation();
                    }
                    addMessage(message.message, message.messageType || 'assistant');
                    break;
                    
                case 'typingIndicator':
                    showTypingIndicator(message.show);
                    break;
                    
                case 'updateContext':
                    updateContext(message.context);
                    break;
                    
                case 'clearHistory':
                    // History already cleared in UI
                    break;
                
                case 'historyLoaded':
                    loadHistoryItems(message.historyItems);
                    break;
                
                case 'historyItemLoaded':
                    // Load the selected conversation into the chat
                    const chatMessages = document.getElementById('chatMessages');
                    chatMessages.innerHTML = '';
                    
                    if (message.historyItem.userMessage && message.historyItem.assistantMessage) {
                        addMessage(message.historyItem.userMessage, 'user');
                        addMessage(message.historyItem.assistantMessage, 'assistant');
                        
                        // Show chat messages, hide welcome
                        document.getElementById('welcomeScreen').style.display = 'none';
                        document.getElementById('chatMessages').style.display = 'block';
                        conversationStarted = true;
                    }
                    break;
            }
        });
        
        // Initialize on load
        window.addEventListener('load', function() {
            // Request initial context
            vscode.postMessage({ type: 'requestContext' });
        });
    </script>
</body>
</html>`;
    }

    private getProviderSetupHtml(provider: PrompdChatProvider): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure ${provider.name}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 24px;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
        }
        
        input, select {
            width: 100%;
            padding: 8px 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: inherit;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .button-group {
            display: flex;
            gap: 12px;
            margin-top: 32px;
        }
        
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
        
        .primary-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .primary-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .secondary-button {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .description {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .warning {
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>Configure ${provider.name}</h1>
    
    <div class="warning">
        <strong>Security Note:</strong> Your API keys are stored securely in VS Code's global state and never sent to external servers except to your chosen AI provider.
    </div>
    
    <form id="providerForm">
        <div class="form-group">
            <label for="apiKey">API Key:</label>
            <input type="password" id="apiKey" required>
            <div class="description">Enter your ${provider.name} API key</div>
        </div>
        
        ${provider.endpoint ? `
        <div class="form-group">
            <label for="endpoint">Endpoint:</label>
            <input type="url" id="endpoint" value="${provider.endpoint}">
            <div class="description">Custom endpoint URL (leave default for standard service)</div>
        </div>
        ` : ''}
        
        <div class="form-group">
            <label for="model">Model:</label>
            <select id="model">
                ${this.getModelOptions(provider)}
            </select>
            <div class="description">Select the model to use for Prompd Chat</div>
        </div>
        
        <div class="button-group">
            <button type="submit" class="primary-button">Save & Test Connection</button>
            <button type="button" class="secondary-button" onclick="window.close()">Cancel</button>
        </div>
    </form>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('providerForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const config = {
                apiKey: document.getElementById('apiKey').value,
                model: document.getElementById('model').value,
                endpoint: document.getElementById('endpoint')?.value,
                enabled: true
            };
            
            vscode.postMessage({
                type: 'saveProvider',
                config: config
            });
        });
    </script>
</body>
</html>`;
    }

    private getModelOptions(provider: PrompdChatProvider): string {
        const models: Record<string, string[]> = {
            'OpenAI': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            'Anthropic': ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
            'Azure OpenAI': ['gpt-4', 'gpt-4-32k', 'gpt-35-turbo'],
            'Local Ollama': ['llama3:8b', 'llama3:70b', 'codellama:7b', 'mistral:7b']
        };

        const providerModels = models[provider.name] || [provider.model];
        
        return providerModels.map((model: string) => 
            `<option value="${model}" ${model === provider.model ? 'selected' : ''}>${model}</option>`
        ).join('');
    }
}
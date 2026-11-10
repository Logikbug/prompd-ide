import * as vscode from 'vscode';
import PrompdChatService from './prompdChatService';

/**
 * Prompd Chat History View Provider
 * 
 * Displays chat history in a dedicated tree view for easy navigation and search
 */

interface ChatHistoryItem {
    id: string;
    timestamp: Date;
    userMessage: string;
    assistantMessage: string;
    fileContext?: string;
    modifications?: any[];
}

export class PrompdChatHistoryProvider implements vscode.TreeDataProvider<ChatHistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChatHistoryItem | undefined | null | void> = new vscode.EventEmitter<ChatHistoryItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChatHistoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private chatHistory: ChatHistoryItem[] = [];
    private chatService: PrompdChatService;

    constructor(private context: vscode.ExtensionContext) {
        this.chatService = new PrompdChatService(context);
        this.loadChatHistory();
    }

    private loadChatHistory(): void {
        // Load chat history from global state
        const savedHistory = this.context.globalState.get<ChatHistoryItem[]>('prompd.chatHistory', []);
        this.chatHistory = savedHistory.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
        }));
        this.refresh();
    }

    private saveChatHistory(): void {
        // Save chat history to global state
        this.context.globalState.update('prompd.chatHistory', this.chatHistory);
    }

    public addChatInteraction(userMessage: string, assistantMessage: string, fileContext?: string, modifications?: any[]): void {
        const item: ChatHistoryItem = {
            id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            userMessage: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''),
            assistantMessage: assistantMessage.substring(0, 200) + (assistantMessage.length > 200 ? '...' : ''),
            fileContext,
            modifications
        };

        this.chatHistory.unshift(item); // Add to beginning
        
        // Keep only last 100 interactions
        if (this.chatHistory.length > 100) {
            this.chatHistory = this.chatHistory.slice(0, 100);
        }

        this.saveChatHistory();
        this.refresh();
    }

    public clearHistory(): void {
        this.chatHistory = [];
        this.saveChatHistory();
        this.refresh();
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChatHistoryItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.userMessage, vscode.TreeItemCollapsibleState.None);
        
        // Set icon based on context
        if (element.fileContext?.endsWith('.prompdflow')) {
            item.iconPath = new vscode.ThemeIcon('type-hierarchy');
        } else if (element.fileContext?.endsWith('.prompd')) {
            item.iconPath = new vscode.ThemeIcon('file-text');
        } else {
            item.iconPath = new vscode.ThemeIcon('comment-discussion');
        }

        // Set description with timestamp
        item.description = element.timestamp.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Set tooltip with full context
        item.tooltip = new vscode.MarkdownString();
        item.tooltip.appendMarkdown(`**User:** ${element.userMessage}\n\n`);
        item.tooltip.appendMarkdown(`**Prompd:** ${element.assistantMessage}\n\n`);
        if (element.fileContext) {
            item.tooltip.appendMarkdown(`**File:** \`${element.fileContext}\`\n\n`);
        }
        if (element.modifications && element.modifications.length > 0) {
            item.tooltip.appendMarkdown(`**Modifications:** ${element.modifications.length} changes suggested\n\n`);
        }
        item.tooltip.appendMarkdown(`**Time:** ${element.timestamp.toLocaleString()}`);

        // Set command to show details
        item.command = {
            command: 'prompd.chatHistory.showDetail',
            title: 'Show Chat Details',
            arguments: [element]
        };

        return item;
    }

    getChildren(element?: ChatHistoryItem): Thenable<ChatHistoryItem[]> {
        if (!element) {
            // Group by date
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const oneWeekAgo = new Date(today);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            // For now, return flat list. Could implement grouping later.
            return Promise.resolve(this.chatHistory);
        }

        return Promise.resolve([]);
    }

    public showChatDetail(item: ChatHistoryItem): void {
        const panel = vscode.window.createWebviewPanel(
            'prompdChatDetail',
            'Chat History Detail',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getChatDetailHtml(item);
    }

    private getChatDetailHtml(item: ChatHistoryItem): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat History Detail</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        
        .timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        
        .file-context {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            display: inline-block;
            margin-top: 8px;
        }
        
        .message-section {
            margin: 24px 0;
            padding: 16px;
            border-radius: 8px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        
        .user-message {
            background: var(--vscode-input-background);
            border-left-color: var(--vscode-button-background);
        }
        
        .assistant-message {
            background: var(--vscode-textCodeBlock-background);
            border-left-color: var(--vscode-textLink-foreground);
        }
        
        .message-label {
            font-weight: 600;
            font-size: 0.9em;
            color: var(--vscode-textLink-foreground);
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        
        .message-content {
            white-space: pre-wrap;
        }
        
        .modifications {
            margin-top: 24px;
            padding: 16px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
        }
        
        .modifications-header {
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-textLink-foreground);
        }
        
        .modification-item {
            padding: 8px 12px;
            margin: 8px 0;
            background: var(--vscode-editor-background);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        
        .modification-type {
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.8em;
            color: var(--vscode-textLink-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Chat Interaction</h1>
        <div class="timestamp">${item.timestamp.toLocaleString()}</div>
        ${item.fileContext ? `<div class="file-context">📄 ${item.fileContext}</div>` : ''}
    </div>
    
    <div class="message-section user-message">
        <div class="message-label">Your Question</div>
        <div class="message-content">${item.userMessage}</div>
    </div>
    
    <div class="message-section assistant-message">
        <div class="message-label">Prompd's Response</div>
        <div class="message-content">${item.assistantMessage}</div>
    </div>
    
    ${item.modifications && item.modifications.length > 0 ? `
    <div class="modifications">
        <div class="modifications-header">🔧 Suggested Changes (${item.modifications.length})</div>
        ${item.modifications.map(mod => `
            <div class="modification-item">
                <div class="modification-type">${mod.type}</div>
                <div>${mod.description}</div>
            </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;
    }

    public static register(context: vscode.ExtensionContext): PrompdChatHistoryProvider {
        const provider = new PrompdChatHistoryProvider(context);
        
        // Register the tree view
        const treeView = vscode.window.createTreeView('prompdChatHistory', {
            treeDataProvider: provider,
            showCollapseAll: true
        });

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('prompd.chatHistory.refresh', () => provider.refresh()),
            vscode.commands.registerCommand('prompd.chatHistory.clear', () => {
                vscode.window.showWarningMessage(
                    'Are you sure you want to clear all chat history?',
                    'Clear History', 'Cancel'
                ).then(choice => {
                    if (choice === 'Clear History') {
                        provider.clearHistory();
                        vscode.window.showInformationMessage('Chat history cleared');
                    }
                });
            }),
            vscode.commands.registerCommand('prompd.chatHistory.showDetail', (item: ChatHistoryItem) => {
                provider.showChatDetail(item);
            }),
            vscode.commands.registerCommand('prompd.chatHistory.export', async () => {
                const uri = await vscode.window.showSaveDialog({
                    filters: { 'JSON': ['json'] },
                    defaultUri: vscode.Uri.file(`prompd-chat-history-${new Date().toISOString().split('T')[0]}.json`)
                });

                if (uri) {
                    const history = provider.getChatHistory();
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(history, null, 2), 'utf8'));
                    vscode.window.showInformationMessage('Chat history exported successfully');
                }
            })
        );

        context.subscriptions.push(treeView);
        return provider;
    }

    public getChatHistory(): ChatHistoryItem[] {
        return this.chatHistory;
    }
}
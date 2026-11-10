import * as vscode from 'vscode';

/**
 * Native Quick Prompt Implementation
 * Sleek chat interface with execution history in sidebar
 */

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    prompdAction?: PrompdAction;
}

interface PrompdAction {
    type: 'section-content';
    section: string;
    content: string;
    filePath?: string;
}

class ChatMessageItem extends vscode.TreeItem {
    constructor(
        public readonly message: ChatMessage,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(ChatMessageItem.formatLabel(message), collapsibleState);
        
        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = this.getIcon();
        this.contextValue = message.prompdAction ? 
            `chatMessage.${message.type}.prompdAction` : 
            `chatMessage.${message.type}`;
    }

    private static formatLabel(message: ChatMessage): string {
        const maxLength = 60;
        const content = message.content.replace(/\n/g, ' ').trim();
        return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    }

    private getTooltip(): string {
        const time = this.message.timestamp.toLocaleTimeString();
        return `${this.message.type.toUpperCase()} [${time}]\n\n${this.message.content}`;
    }

    private getDescription(): string {
        return this.message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.message.prompdAction) {
            return new vscode.ThemeIcon('wand', new vscode.ThemeColor('charts.orange'));
        }
        
        switch (this.message.type) {
            case 'user': return new vscode.ThemeIcon('person');
            case 'assistant': return new vscode.ThemeIcon('robot');
            case 'system': return new vscode.ThemeIcon('info');
            default: return new vscode.ThemeIcon('comment');
        }
    }
}

class ChatHistoryProvider implements vscode.TreeDataProvider<ChatMessageItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChatMessageItem | undefined | null | void> = new vscode.EventEmitter<ChatMessageItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChatMessageItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private chatHistory: ChatMessage[]) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChatMessageItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ChatMessageItem): Thenable<ChatMessageItem[]> {
        if (!element) {
            // Return messages in reverse chronological order (newest first)
            return Promise.resolve(
                this.chatHistory
                    .slice()
                    .reverse()
                    .map(message => new ChatMessageItem(message))
            );
        }
        return Promise.resolve([]);
    }
}

export class QuickPrompt {
    private static instance: QuickPrompt;
    private statusBarItem: vscode.StatusBarItem;
    private chatHistory: ChatMessage[] = [];
    private historyProvider: ChatHistoryProvider;
    private isExecuting: boolean = false;

    private constructor(private context: vscode.ExtensionContext) {
        this.historyProvider = new ChatHistoryProvider(this.chatHistory);
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.setupStatusBar();
        this.setupHistoryView();
        this.registerCommands();
        this.addWelcomeMessage();
    }

    public static activate(context: vscode.ExtensionContext): QuickPrompt {
        if (!QuickPrompt.instance) {
            QuickPrompt.instance = new QuickPrompt(context);
        }
        return QuickPrompt.instance;
    }

    private setupStatusBar() {
        this.statusBarItem.text = "$(comment-discussion) Quick Chat";
        this.statusBarItem.tooltip = "Start a quick chat with AI";
        this.statusBarItem.command = 'prompd.quickPrompt';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.show();
        
        this.context.subscriptions.push(this.statusBarItem);
    }

    private setupHistoryView() {
        // Register the tree data provider
        // History provider removed - functionality integrated into main chat view
        
        // Register tree view commands
        vscode.commands.registerCommand('prompd.refreshHistory', () => {
            this.historyProvider.refresh();
        });

        vscode.commands.registerCommand('prompd.clearHistory', () => {
            this.chatHistory.length = 0;
            this.historyProvider.refresh();
            this.addWelcomeMessage();
        });

        vscode.commands.registerCommand('prompd.copyMessage', (item: ChatMessageItem) => {
            vscode.env.clipboard.writeText(item.message.content);
            vscode.window.showInformationMessage('Message copied to clipboard');
        });

        vscode.commands.registerCommand('prompd.saveChat', async () => {
            await this.saveChatAsPrompdFile();
        });

        vscode.commands.registerCommand('prompd.acceptPrompdAction', async (message: ChatMessage) => {
            await this.acceptPrompdAction(message);
        });

        vscode.commands.registerCommand('prompd.retryPrompdAction', async (message: ChatMessage) => {
            await this.retryPrompdAction(message);
        });
    }

    private addWelcomeMessage() {
        const welcomeMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: '👋 Welcome to Quick Chat! Click the status bar button or use Ctrl+Shift+P → "Quick Prompt" to start chatting.',
            timestamp: new Date()
        };
        this.chatHistory.push(welcomeMessage);
        this.historyProvider.refresh();
    }

    private registerCommands() {
        // Main quick prompt command
        const quickPromptCommand = vscode.commands.registerCommand('prompd.quickPrompt', async () => {
            await this.showQuickPrompt();
        });

        this.context.subscriptions.push(quickPromptCommand);
    }

    private async showQuickPrompt() {
        if (this.isExecuting) {
            vscode.window.showWarningMessage('A prompt is already executing. Please wait...');
            return;
        }

        // Show input box with multiline support
        const prompt = await vscode.window.showInputBox({
            title: '💬 Quick Chat',
            prompt: 'What would you like to ask?',
            placeHolder: 'Ask anything... (e.g., "Explain async/await in TypeScript")',
            value: '',
            ignoreFocusOut: true,
            validateInput: (value) => {
                return value.trim().length === 0 ? 'Please enter a message' : null;
            }
        });

        if (!prompt) {
            return; // User cancelled
        }

        await this.executePrompt(prompt);
    }

    private async executePrompt(prompt: string) {
        this.isExecuting = true;
        this.updateStatusBar(true);

        // Check if this is a .prompd file editing request
        const prompdCommand = this.parsePrompdCommand(prompt);

        // Add user message to history
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: prompt,
            timestamp: new Date()
        };
        this.chatHistory.push(userMessage);
        this.historyProvider.refresh();

        try {
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "💭 Thinking...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Processing your message..." });
                
                // Generate AI response (with .prompd file integration if needed)
                const response = await this.generateStructuredResponse(prompt, progress, prompdCommand);
                
                progress.report({ increment: 100, message: "Complete!" });
                
                // Add assistant response to history
                const assistantMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    type: 'assistant',
                    content: response.content,
                    timestamp: new Date(),
                    prompdAction: response.action
                };
                this.chatHistory.push(assistantMessage);
                this.historyProvider.refresh();

                // Show completion notification with actions
                const action = await vscode.window.showInformationMessage(
                    '✅ Response received!', 
                    'Continue Chat',
                    'Save Chat',
                    'Clear History'
                );
                
                switch (action) {
                    case 'Continue Chat':
                        setTimeout(() => this.showQuickPrompt(), 100);
                        break;
                    case 'Save Chat':
                        await this.saveChatAsPrompdFile();
                        break;
                    case 'Clear History':
                        vscode.commands.executeCommand('prompd.clearHistory');
                        break;
                }
            });

        } catch (error) {
            // Add error message to history
            const errorMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'system',
                content: `❌ Error: ${error}`,
                timestamp: new Date()
            };
            this.chatHistory.push(errorMessage);
            this.historyProvider.refresh();
            vscode.window.showErrorMessage(`Chat error: ${error}`);
        } finally {
            this.isExecuting = false;
            this.updateStatusBar(false);
        }
    }

    private parsePrompdCommand(prompt: string): PrompdAction | null {
        const activeEditor = vscode.window.activeTextEditor;
        
        // Only parse if a .prompd file is open
        if (!activeEditor || activeEditor.document.languageId !== 'prompd') {
            return null;
        }

        const promptLower = prompt.toLowerCase();
        
        // Parse section targeting: "in the [section] section"
        const sectionMatches = promptLower.match(/in the (user|system|context|response|assistant) section/);
        if (!sectionMatches) {
            return null;
        }

        const section = sectionMatches[1];
        
        // Extract the requested content after section specification
        const contentPart = prompt.replace(/in the .* section,?\s*/i, '').trim();
        
        return {
            type: 'section-content',
            section: section,
            content: contentPart,
            filePath: activeEditor.document.uri.fsPath
        };
    }

    private async generateStructuredResponse(
        prompt: string, 
        progress: vscode.Progress<{increment?: number, message?: string}>, 
        prompdCommand: PrompdAction | null
    ): Promise<{content: string, action?: PrompdAction}> {
        
        if (prompdCommand) {
            // Handle .prompd section request
            progress.report({ increment: 25, message: "Generating section content..." });
            
            const sectionContent = await this.generateSectionContent(prompdCommand.content, prompdCommand.section);
            
            const responseContent = `I'll help you create content for the **${prompdCommand.section}** section.

**Generated Content:**
\`\`\`
${sectionContent}
\`\`\`

Click **Accept** below to add this to your .prompd file, or **Retry** to generate different content.`;

            return {
                content: responseContent,
                action: {
                    type: 'section-content',
                    section: prompdCommand.section,
                    content: sectionContent,
                    filePath: prompdCommand.filePath
                }
            };
        } else {
            // Regular chat response
            const response = await this.simulateAIResponse(prompt, progress);
            return { content: response };
        }
    }

    private async generateSectionContent(request: string, section: string): Promise<string> {
        // Simulate content generation based on the request and section type
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const requestLower = request.toLowerCase();
        
        if (section === 'system') {
            if (requestLower.includes('xml')) {
                return `You are an expert XML data processor. You excel at parsing, validating, and transforming XML documents. Always provide clear explanations of your XML processing steps and handle edge cases gracefully.

## Guidelines:
- Parse XML using proper namespaces and validation
- Handle malformed XML with informative error messages  
- Provide structured output formats
- Consider performance for large XML files`;
            } else {
                return `You are a helpful AI assistant specialized in ${request}. Provide accurate, detailed responses while maintaining clarity and helpfulness.`;
            }
        } else if (section === 'user') {
            if (requestLower.includes('xml')) {
                return `Process the following XML data and extract the key information:

## Requirements:
- Parse all XML elements and attributes
- Validate the XML structure
- Extract meaningful data points
- Present results in a clear, structured format

## XML Data:
{{xml_input}}

Please provide:
1. A summary of the XML structure
2. Key data extracted
3. Any validation issues found
4. Suggested improvements or transformations`;
            } else {
                return `Please ${request}.

Provide detailed, step-by-step instructions and examples where helpful.`;
            }
        } else if (section === 'context') {
            return `Context for ${request}:
- Current task requirements
- Expected output format  
- Key considerations and constraints`;
        } else {
            return `Generated content for ${section} section: ${request}`;
        }
    }

    private async acceptPrompdAction(message: ChatMessage) {
        if (!message.prompdAction) return;

        const action = message.prompdAction;
        const editor = vscode.window.visibleTextEditors.find(e => 
            e.document.uri.fsPath === action.filePath && e.document.languageId === 'prompd'
        );

        if (!editor) {
            vscode.window.showErrorMessage('The .prompd file is no longer open');
            return;
        }

        try {
            // Find the section in the document and replace/add content
            const document = editor.document;
            const text = document.getText();
            const sectionHeader = `# ${action.section.charAt(0).toUpperCase() + action.section.slice(1)}`;
            
            let newText: string;
            const sectionIndex = text.indexOf(sectionHeader);
            
            if (sectionIndex !== -1) {
                // Replace existing section
                const nextSectionIndex = text.indexOf('# ', sectionIndex + sectionHeader.length);
                const endIndex = nextSectionIndex !== -1 ? nextSectionIndex : text.length;
                
                newText = text.substring(0, sectionIndex + sectionHeader.length) + 
                         '\n\n' + action.content + '\n\n' + 
                         text.substring(endIndex);
            } else {
                // Add new section
                newText = text + '\n\n' + sectionHeader + '\n\n' + action.content + '\n';
            }

            // Apply the edit
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );

            await editor.edit(editBuilder => {
                editBuilder.replace(fullRange, newText);
            });

            vscode.window.showInformationMessage(`✅ Added content to ${action.section} section`);

            // Update the message to remove the action (mark as accepted)
            message.prompdAction = undefined;
            this.historyProvider.refresh();

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update .prompd file: ${error}`);
        }
    }

    private async retryPrompdAction(message: ChatMessage) {
        if (!message.prompdAction) return;

        const action = message.prompdAction;
        
        // Re-run the generation with the same request
        const newContent = await this.generateSectionContent(action.content, action.section);
        
        // Update the action with new content
        action.content = newContent;
        
        // Update the message content to show the new result
        message.content = `I'll help you create content for the **${action.section}** section.

**Generated Content (Retry):**
\`\`\`
${newContent}
\`\`\`

Click **Accept** below to add this to your .prompd file, or **Retry** to generate different content.`;

        this.historyProvider.refresh();
        vscode.window.showInformationMessage('🔄 Generated new content');
    }

    private async simulateAIResponse(prompt: string, progress: vscode.Progress<{increment?: number, message?: string}>): Promise<string> {
        // Simulate processing steps
        const steps = [
            { delay: 200, increment: 25, message: "Understanding your question..." },
            { delay: 400, increment: 35, message: "Generating response..." },
            { delay: 300, increment: 25, message: "Refining answer..." },
            { delay: 150, increment: 15, message: "Finalizing..." }
        ];

        for (const step of steps) {
            await new Promise(resolve => setTimeout(resolve, step.delay));
            progress.report({ increment: step.increment, message: step.message });
        }

        // Generate contextual response
        const promptLower = prompt.toLowerCase();
        
        if (promptLower.includes('typescript') || promptLower.includes('async') || promptLower.includes('await')) {
            return `**Async/Await in TypeScript** 🚀

Async/await makes asynchronous code look synchronous:

\`\`\`typescript
async function fetchUserData(id: number): Promise<User> {
    try {
        const response = await fetch(\`/api/users/\${id}\`);
        const user = await response.json();
        return user;
    } catch (error) {
        throw new Error(\`Failed to fetch user: \${error}\`);
    }
}
\`\`\`

**Key benefits:**
• Cleaner than callbacks/promises
• Better error handling with try/catch
• Sequential-looking asynchronous code`;

        } else if (promptLower.includes('explain') || promptLower.includes('what is')) {
            return `I'd be happy to explain! 📚

${prompt.replace(/explain|what is/gi, 'This topic')} is an important concept that involves several key aspects:

**Core Principles:**
• Clear understanding of fundamentals
• Practical application examples
• Best practices to follow

**Implementation:**
• Step-by-step approach
• Real-world use cases
• Common pitfalls to avoid

Would you like me to dive deeper into any specific aspect?`;

        } else if (promptLower.includes('code') || promptLower.includes('function') || promptLower.includes('class')) {
            return `Here's a code example for your request: 💻

\`\`\`typescript
// Generated based on your prompt
class PromptHandler {
    private history: string[] = [];

    public async processPrompt(input: string): Promise<string> {
        // Add to history
        this.history.push(input);
        
        // Process the input
        const result = await this.analyze(input);
        
        return result;
    }

    private async analyze(input: string): Promise<string> {
        // Your analysis logic here
        return \`Processed: \${input}\`;
    }
}
\`\`\`

This provides a solid foundation you can build upon!`;

        } else if (promptLower.includes('help') || promptLower.includes('how')) {
            return `I'm here to help! 🤝

Here's how I can assist you:

**💡 Code Help:**
• Explain programming concepts
• Debug code issues
• Suggest best practices
• Generate code examples

**🛠️ VS Code Extensions:**
• Extension development
• API usage
• Configuration tips
• Troubleshooting

**📝 Prompt Engineering:**
• Writing effective prompts
• Structuring conversations
• Template creation

Just ask me anything specific you'd like help with!`;

        } else {
            return `Thanks for your message! 💬

"${prompt}"

I understand you're asking about this topic. Here's my response:

This is a great question that touches on several important aspects. In practice, this involves understanding the core concepts, applying them effectively, and following established patterns.

**Key considerations:**
• Context and requirements
• Best practices in the field
• Practical implementation steps

**Next steps:**
• Try implementing a small example
• Explore related concepts
• Ask follow-up questions as needed

Feel free to ask for more specific details on any aspect!`;
        }
    }

    private async saveChatAsPrompdFile() {
        if (this.chatHistory.length === 0) {
            vscode.window.showWarningMessage('No chat history to save');
            return;
        }

        const fileName = await vscode.window.showInputBox({
            title: 'Save Chat History',
            prompt: 'Enter filename (without extension)',
            value: `chat-${new Date().toISOString().split('T')[0]}`,
            validateInput: (value) => {
                if (!value.trim()) return 'Filename required';
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Use only letters, numbers, hyphens, and underscores';
                return null;
            }
        });

        if (!fileName) return;

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Format chat history as a prompt file
        const timestamp = new Date().toISOString().split('T')[0];
        const chatContent = this.chatHistory
            .filter(msg => msg.type !== 'system')
            .map(msg => {
                const role = msg.type === 'user' ? 'Human' : 'Assistant';
                const time = msg.timestamp.toLocaleTimeString();
                return `## ${role} [${time}]\n\n${msg.content}\n`;
            })
            .join('\n');

        const content = `---
name: ${fileName}
description: Chat history saved from Quick Prompt
version: 1.0.0
created: ${timestamp}
type: conversation
parameters: []
---

# Conversation History

This file contains a conversation history from the Quick Prompt feature.

${chatContent}

---

*Total messages: ${this.chatHistory.filter(m => m.type !== 'system').length}*
*Saved on: ${new Date().toLocaleString()}*`;

        const filePath = vscode.Uri.joinPath(workspaceFolder.uri, `${fileName}.prompd`);
        
        try {
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage(`💾 Chat saved as ${fileName}.prompd`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save chat: ${error}`);
        }
    }

    private updateStatusBar(isExecuting: boolean) {
        if (isExecuting) {
            this.statusBarItem.text = "$(loading~spin) Thinking...";
            this.statusBarItem.tooltip = "AI is processing your message...";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = "$(comment-discussion) Quick Chat";
            this.statusBarItem.tooltip = "Start a quick chat with AI";
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
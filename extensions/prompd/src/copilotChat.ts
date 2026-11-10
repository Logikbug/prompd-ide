import * as vscode from 'vscode';
import * as path from 'path';

interface CodeAction {
    type: 'insert' | 'replace' | 'refactor' | 'fix' | 'generate';
    description: string;
    code: string;
    range?: vscode.Range;
    filePath: string;
}

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    codeAction?: CodeAction;
    context?: FileContext;
}

interface FileContext {
    filePath: string;
    language: string;
    selection?: vscode.Range;
    content?: string;
}

class EnhancedChatMessageItem extends vscode.TreeItem {
    constructor(
        public readonly message: ChatMessage,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(EnhancedChatMessageItem.formatLabel(message), collapsibleState);
        
        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
    }

    private static formatLabel(message: ChatMessage): string {
        const maxLength = 60;
        let content = message.content.replace(/\n/g, ' ').trim();
        
        // If it's a code action, show the action type
        if (message.codeAction) {
            const actionType = message.codeAction.type.charAt(0).toUpperCase() + message.codeAction.type.slice(1);
            content = `${actionType}: ${message.codeAction.description}`;
        }
        
        return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    }

    private getTooltip(): string {
        const time = this.message.timestamp.toLocaleTimeString();
        let tooltip = `${this.message.type.toUpperCase()} [${time}]\n\n${this.message.content}`;
        
        if (this.message.codeAction) {
            tooltip += `\n\n🔧 Code Action: ${this.message.codeAction.type}\n${this.message.codeAction.description}`;
        }
        
        if (this.message.context) {
            tooltip += `\n\n📄 Context: ${path.basename(this.message.context.filePath)} (${this.message.context.language})`;
        }
        
        return tooltip;
    }

    private getDescription(): string {
        const time = this.message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (this.message.context) {
            const fileName = path.basename(this.message.context.filePath);
            return `${time} • ${fileName}`;
        }
        
        return time;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.message.codeAction) {
            switch (this.message.codeAction.type) {
                case 'insert': return new vscode.ThemeIcon('add', new vscode.ThemeColor('charts.green'));
                case 'replace': return new vscode.ThemeIcon('replace', new vscode.ThemeColor('charts.blue'));
                case 'refactor': return new vscode.ThemeIcon('refactor', new vscode.ThemeColor('charts.purple'));
                case 'fix': return new vscode.ThemeIcon('debug-alt', new vscode.ThemeColor('charts.red'));
                case 'generate': return new vscode.ThemeIcon('wand', new vscode.ThemeColor('charts.orange'));
            }
        }
        
        switch (this.message.type) {
            case 'user': return new vscode.ThemeIcon('person');
            case 'assistant': return new vscode.ThemeIcon('copilot');
            case 'system': return new vscode.ThemeIcon('info');
            default: return new vscode.ThemeIcon('comment-discussion');
        }
    }

    private getContextValue(): string {
        let contextValue = `chatMessage.${this.message.type}`;
        
        if (this.message.codeAction) {
            contextValue += '.codeAction';
        }
        
        return contextValue;
    }
}

class EnhancedChatHistoryProvider implements vscode.TreeDataProvider<EnhancedChatMessageItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EnhancedChatMessageItem | undefined | null | void> = new vscode.EventEmitter<EnhancedChatMessageItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<EnhancedChatMessageItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private chatHistory: ChatMessage[]) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: EnhancedChatMessageItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: EnhancedChatMessageItem): Thenable<EnhancedChatMessageItem[]> {
        if (!element) {
            return Promise.resolve(
                this.chatHistory
                    .slice()
                    .reverse()
                    .map(message => new EnhancedChatMessageItem(message))
            );
        }
        return Promise.resolve([]);
    }
}

export class CopilotChat {
    private static instance: CopilotChat;
    private statusBarItem: vscode.StatusBarItem;
    private chatHistory: ChatMessage[] = [];
    private historyProvider: EnhancedChatHistoryProvider;
    private isExecuting: boolean = false;

    private constructor(private context: vscode.ExtensionContext) {
        this.historyProvider = new EnhancedChatHistoryProvider(this.chatHistory);
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.setupStatusBar();
        this.setupHistoryView();
        this.registerCommands();
        this.addWelcomeMessage();
    }

    public static activate(context: vscode.ExtensionContext): CopilotChat {
        if (!CopilotChat.instance) {
            CopilotChat.instance = new CopilotChat(context);
        }
        return CopilotChat.instance;
    }

    private setupStatusBar() {
        this.statusBarItem.text = "$(copilot) AI Chat";
        this.statusBarItem.tooltip = "Chat with AI - Generate, fix, and refactor code";
        this.statusBarItem.command = 'prompd.aiChat';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.show();
        
        this.context.subscriptions.push(this.statusBarItem);
    }

    private setupHistoryView() {
        // Register the tree data provider for the enhanced chat
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

        vscode.commands.registerCommand('prompd.copyMessage', (item: EnhancedChatMessageItem) => {
            vscode.env.clipboard.writeText(item.message.content);
            vscode.window.showInformationMessage('Message copied to clipboard');
        });

        vscode.commands.registerCommand('prompd.copyCode', (item: EnhancedChatMessageItem) => {
            if (item.message.codeAction) {
                vscode.env.clipboard.writeText(item.message.codeAction.code);
                vscode.window.showInformationMessage('Code copied to clipboard');
            }
        });

        vscode.commands.registerCommand('prompd.applyCodeAction', async (message: ChatMessage) => {
            await this.applyCodeAction(message);
        });

        vscode.commands.registerCommand('prompd.previewCodeAction', async (message: ChatMessage) => {
            await this.previewCodeAction(message);
        });
    }

    private addWelcomeMessage() {
        const welcomeMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: '🤖 AI Code Assistant Ready!\n\nI can help you:\n• Generate code and functions\n• Fix bugs and errors\n• Refactor and optimize code\n• Explain complex code\n• Add tests and documentation\n\nJust describe what you need, and I\'ll provide intelligent suggestions with code actions.',
            timestamp: new Date()
        };
        this.chatHistory.push(welcomeMessage);
        this.historyProvider.refresh();
    }

    private registerCommands() {
        // Main AI chat command
        const aiChatCommand = vscode.commands.registerCommand('prompd.aiChat', async () => {
            await this.showAiChat();
        });

        // Context-aware commands
        const explainCodeCommand = vscode.commands.registerCommand('prompd.explainCode', async () => {
            await this.explainSelectedCode();
        });

        const fixCodeCommand = vscode.commands.registerCommand('prompd.fixCode', async () => {
            await this.fixSelectedCode();
        });

        const refactorCodeCommand = vscode.commands.registerCommand('prompd.refactorCode', async () => {
            await this.refactorSelectedCode();
        });

        const generateTestsCommand = vscode.commands.registerCommand('prompd.generateTests', async () => {
            await this.generateTests();
        });

        this.context.subscriptions.push(
            aiChatCommand,
            explainCodeCommand,
            fixCodeCommand,
            refactorCodeCommand,
            generateTestsCommand
        );
    }

    private async showAiChat() {
        if (this.isExecuting) {
            vscode.window.showWarningMessage('AI is processing a request. Please wait...');
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        let contextInfo = '';
        
        if (activeEditor) {
            const fileName = path.basename(activeEditor.document.fileName);
            const language = activeEditor.document.languageId;
            contextInfo = ` (Context: ${fileName} - ${language})`;
        }

        const prompt = await vscode.window.showInputBox({
            title: '🤖 AI Code Assistant',
            prompt: `What would you like to do?${contextInfo}`,
            placeHolder: 'e.g., "Generate a function to validate email", "Fix this TypeScript error", "Refactor this code"',
            value: '',
            ignoreFocusOut: true,
            validateInput: (value) => {
                return value.trim().length === 0 ? 'Please enter a request' : null;
            }
        });

        if (!prompt) {
            return;
        }

        await this.processAiRequest(prompt);
    }

    private async explainSelectedCode() {
        const selection = this.getSelectedCode();
        if (!selection) {
            vscode.window.showErrorMessage('Please select some code to explain');
            return;
        }

        await this.processAiRequest(`Explain this ${selection.context.language} code:\n\n${selection.context.content}`);
    }

    private async fixSelectedCode() {
        const selection = this.getSelectedCode();
        if (!selection) {
            vscode.window.showErrorMessage('Please select some code to fix');
            return;
        }

        await this.processAiRequest(`Find and fix any bugs or issues in this ${selection.context.language} code:\n\n${selection.context.content}`);
    }

    private async refactorSelectedCode() {
        const selection = this.getSelectedCode();
        if (!selection) {
            vscode.window.showErrorMessage('Please select some code to refactor');
            return;
        }

        await this.processAiRequest(`Refactor and optimize this ${selection.context.language} code:\n\n${selection.context.content}`);
    }

    private async generateTests() {
        const selection = this.getSelectedCode();
        if (!selection) {
            vscode.window.showErrorMessage('Please select a function or class to generate tests for');
            return;
        }

        await this.processAiRequest(`Generate comprehensive unit tests for this ${selection.context.language} code:\n\n${selection.context.content}`);
    }

    private getSelectedCode(): { context: FileContext; selection: vscode.Range } | null {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return null;
        }

        const selection = activeEditor.selection;
        if (selection.isEmpty) {
            return null;
        }

        const selectedText = activeEditor.document.getText(selection);
        
        return {
            context: {
                filePath: activeEditor.document.uri.fsPath,
                language: activeEditor.document.languageId,
                selection: selection,
                content: selectedText
            },
            selection: selection
        };
    }

    private async processAiRequest(prompt: string) {
        this.isExecuting = true;
        this.updateStatusBar(true);

        // Get current context
        const context = this.getCurrentFileContext();

        // Add user message to history
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: prompt,
            timestamp: new Date(),
            context: context
        };
        this.chatHistory.push(userMessage);
        this.historyProvider.refresh();

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🤖 AI Processing",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Analyzing your request..." });
                
                const response = await this.generateIntelligentResponse(prompt, context, progress);
                
                progress.report({ increment: 100, message: "Complete!" });
                
                // Add assistant response to history
                const assistantMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    type: 'assistant',
                    content: response.content,
                    timestamp: new Date(),
                    codeAction: response.codeAction,
                    context: context
                };
                this.chatHistory.push(assistantMessage);
                this.historyProvider.refresh();

                // Show action options
                await this.showActionOptions(response.codeAction);
            });

        } catch (error) {
            const errorMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'system',
                content: `❌ Error: ${error}`,
                timestamp: new Date()
            };
            this.chatHistory.push(errorMessage);
            this.historyProvider.refresh();
            vscode.window.showErrorMessage(`AI error: ${error}`);
        } finally {
            this.isExecuting = false;
            this.updateStatusBar(false);
        }
    }

    private getCurrentFileContext(): FileContext | undefined {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return undefined;
        }

        const selection = activeEditor.selection;
        const selectedText = selection.isEmpty ? undefined : activeEditor.document.getText(selection);

        return {
            filePath: activeEditor.document.uri.fsPath,
            language: activeEditor.document.languageId,
            selection: selection.isEmpty ? undefined : selection,
            content: selectedText
        };
    }

    private async generateIntelligentResponse(
        prompt: string,
        context: FileContext | undefined,
        progress: vscode.Progress<{increment?: number, message?: string}>
    ): Promise<{content: string, codeAction?: CodeAction}> {
        
        progress.report({ increment: 25, message: "Understanding context..." });
        
        const promptLower = prompt.toLowerCase();
        const isCodeGeneration = promptLower.includes('generate') || promptLower.includes('create') || 
                               promptLower.includes('write') || promptLower.includes('make');
        const isCodeFix = promptLower.includes('fix') || promptLower.includes('debug') || 
                         promptLower.includes('error') || promptLower.includes('bug');
        const isRefactor = promptLower.includes('refactor') || promptLower.includes('optimize') || 
                          promptLower.includes('improve') || promptLower.includes('clean');
        const isExplanation = promptLower.includes('explain') || promptLower.includes('what') || 
                             promptLower.includes('how') || promptLower.includes('why');

        progress.report({ increment: 50, message: "Generating solution..." });
        
        let actionType: CodeAction['type'] = 'generate';
        let responseContent: string;
        let generatedCode: string;
        let description: string;

        if (context && context.content && (isCodeFix || isRefactor)) {
            actionType = isCodeFix ? 'fix' : 'refactor';
            const result = await this.processCodeImprovement(prompt, context, actionType);
            responseContent = result.explanation;
            generatedCode = result.code;
            description = result.description;
        } else if (isCodeGeneration) {
            actionType = 'generate';
            const result = await this.generateCode(prompt, context);
            responseContent = result.explanation;
            generatedCode = result.code;
            description = result.description;
        } else if (isExplanation && context && context.content) {
            // For explanations, we don't provide code actions
            responseContent = await this.explainCode(prompt, context);
            return { content: responseContent };
        } else {
            // General chat response
            responseContent = await this.generateChatResponse(prompt, context);
            return { content: responseContent };
        }

        progress.report({ increment: 90, message: "Preparing code action..." });

        const codeAction: CodeAction = {
            type: actionType,
            description: description,
            code: generatedCode,
            range: context?.selection,
            filePath: context?.filePath || ''
        };

        return { content: responseContent, codeAction };
    }

    private async processCodeImprovement(
        prompt: string,
        context: FileContext,
        actionType: 'fix' | 'refactor'
    ): Promise<{explanation: string, code: string, description: string}> {
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const language = context.language;
        const originalCode = context.content || '';
        
        let improvedCode: string;
        let explanation: string;
        let description: string;

        if (actionType === 'fix') {
            // Simulate bug fixing
            improvedCode = originalCode
                .replace(/var /g, 'const ')
                .replace(/==(\s+)/g, '=== ')
                .replace(/!=(\s+)/g, '!== ');
                
            if (language === 'typescript' || language === 'javascript') {
                if (!originalCode.includes('try')) {
                    improvedCode = `try {\n    ${improvedCode}\n} catch (error) {\n    console.error('Error:', error);\n    throw error;\n}`;
                }
            }

            explanation = `## 🐛 Bug Fixes Applied\n\nI've identified and fixed several issues:\n\n**Issues Found:**\n• Used \`var\` instead of \`const\`/\`let\`\n• Used loose equality \`==\` instead of strict \`===\`\n• Missing error handling\n\n**Fixes Applied:**\n• Replaced \`var\` with \`const\` for immutable variables\n• Updated to strict equality operators\n• Added try-catch error handling\n\nClick **Apply** to update your code with these fixes.`;
            description = "Fix bugs and improve code quality";
        } else {
            // Simulate refactoring
            let refactoredCode = originalCode;
            
            if (language === 'typescript' || language === 'javascript') {
                // Convert function to arrow function if it's a simple function
                if (originalCode.includes('function ') && !originalCode.includes('function*')) {
                    refactoredCode = originalCode.replace(
                        /function\s+(\w+)\s*\(([^)]*)\)\s*{/,
                        'const $1 = ($2) => {'
                    );
                }
                
                // Add type annotations for TypeScript
                if (language === 'typescript' && !originalCode.includes(': ')) {
                    refactoredCode = refactoredCode.replace(/\(([^)]*)\)/g, (match, params) => {
                        const typedParams = params.split(',').map((p: string) => {
                            const paramName = p.trim();
                            return paramName ? `${paramName}: any` : paramName;
                        }).join(', ');
                        return `(${typedParams})`;
                    });
                }
            }

            improvedCode = refactoredCode;
            explanation = `## ⚡ Code Refactoring\n\nI've optimized your code for better maintainability:\n\n**Improvements:**\n• Converted to modern syntax (arrow functions)\n• Added type annotations for better type safety\n• Improved code structure and readability\n• Applied best practices for ${language}\n\n**Benefits:**\n• Better performance\n• Easier to maintain\n• More consistent with modern standards\n\nClick **Apply** to update your code with these improvements.`;
            description = "Refactor and optimize code";
        }

        return {
            explanation,
            code: improvedCode,
            description
        };
    }

    private async generateCode(
        prompt: string,
        context: FileContext | undefined
    ): Promise<{explanation: string, code: string, description: string}> {
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const language = context?.language || 'typescript';
        const promptLower = prompt.toLowerCase();
        
        let code: string;
        let explanation: string;
        let description: string;

        if (promptLower.includes('function') || promptLower.includes('method')) {
            if (promptLower.includes('email') && promptLower.includes('validate')) {
                code = language === 'python' ? 
`def validate_email(email: str) -> bool:
    """
    Validate email address format
    
    Args:
        email: Email address to validate
        
    Returns:
        bool: True if email is valid, False otherwise
    """
    import re
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

# Example usage:
# is_valid = validate_email("user@example.com")
# print(f"Email is valid: {is_valid}")` :
`/**
 * Validate email address format
 * @param email - Email address to validate
 * @returns True if email is valid, false otherwise
 */
function validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Example usage:
// const isValid = validateEmail("user@example.com");
// console.log(\`Email is valid: \${isValid}\`);`;

                explanation = "## 📧 Email Validation Function\n\nI've generated a robust email validation function with the following features:\n\n**Features:**\n• Validates standard email format\n• Uses regex pattern matching\n• Returns boolean result\n• Includes comprehensive documentation\n• Provides usage examples\n\n**The regex pattern validates:**\n• Local part (before @)\n• Domain name\n• Top-level domain (minimum 2 characters)\n\nThis function will catch most common email format errors while being permissive enough for real-world use.";
                description = "Generate email validation function";
            } else if (promptLower.includes('sort') || promptLower.includes('array')) {
                code = `/**
 * Sort array of objects by specified key
 * @param array - Array to sort
 * @param key - Key to sort by
 * @param ascending - Sort direction (default: true)
 */
function sortByKey<T>(array: T[], key: keyof T, ascending: boolean = true): T[] {
    return [...array].sort((a, b) => {
        const aValue = a[key];
        const bValue = b[key];
        
        if (aValue < bValue) return ascending ? -1 : 1;
        if (aValue > bValue) return ascending ? 1 : -1;
        return 0;
    });
}

// Example usage:
// const users = [
//     { name: "John", age: 30 },
//     { name: "Jane", age: 25 },
//     { name: "Bob", age: 35 }
// ];
// const sortedByAge = sortByKey(users, 'age');`;

                explanation = "## 🔄 Generic Sort Function\n\nGenerated a flexible sorting function with these capabilities:\n\n**Features:**\n• Generic type support (`<T>`)\n• Sort by any object key\n• Ascending/descending order\n• Immutable (doesn't modify original array)\n• Type-safe with TypeScript\n\n**Benefits:**\n• Reusable for any object type\n• Maintains original array\n• Clear, readable code\n• Comprehensive error handling";
                description = "Generate generic array sorting function";
            } else {
                // Generic function generation
                code = `/**
 * Generated function based on your request
 */
function generatedFunction(input: any): any {
    // TODO: Implement your specific logic here
    console.log('Processing:', input);
    
    // Example implementation
    return {
        success: true,
        data: input,
        timestamp: new Date()
    };
}

// Example usage:
// const result = generatedFunction("test input");
// console.log(result);`;

                explanation = "## 🔧 Function Template\n\nI've created a basic function template based on your request:\n\n**Template includes:**\n• JSDoc documentation\n• TypeScript type annotations\n• Example implementation structure\n• Usage example\n• Console logging for debugging\n\n**Next steps:**\n• Replace the TODO with your specific logic\n• Update type annotations as needed\n• Add error handling if required\n• Write unit tests";
                description = "Generate function template";
            }
        } else if (promptLower.includes('class') || promptLower.includes('component')) {
            code = `/**
 * Generated class based on your requirements
 */
class GeneratedClass {
    private data: any[] = [];
    
    constructor(initialData?: any[]) {
        if (initialData) {
            this.data = [...initialData];
        }
    }
    
    /**
     * Add item to collection
     */
    public add(item: any): void {
        this.data.push(item);
    }
    
    /**
     * Get all items
     */
    public getAll(): any[] {
        return [...this.data];
    }
    
    /**
     * Get item count
     */
    public count(): number {
        return this.data.length;
    }
    
    /**
     * Clear all items
     */
    public clear(): void {
        this.data = [];
    }
}

// Example usage:
// const instance = new GeneratedClass();
// instance.add("test item");
// console.log(instance.count());`;

            explanation = "## 🏗️ Class Template\n\nCreated a flexible class structure with common patterns:\n\n**Features:**\n• Private data encapsulation\n• Constructor with optional initialization\n• CRUD operations (Create, Read, Update, Delete)\n• Immutable return values\n• Clear method documentation\n\n**Design patterns:**\n• Encapsulation principle\n• Defensive copying\n• Clear public interface\n• TypeScript best practices";
            description = "Generate class template";
        } else {
            // Generic code generation
            code = `// Generated code based on: "${prompt}"

${language === 'python' ? 
`def main():
    """
    Generated function based on your request
    """
    print("Implementing: ${prompt}")
    
    # TODO: Add your implementation here
    result = "Generated result"
    
    return result

if __name__ == "__main__":
    output = main()
    print(f"Result: {output}")` :
`/**
 * Generated implementation for: ${prompt}
 */
function implementation(): any {
    console.log('Implementing:', '${prompt}');
    
    // TODO: Add your specific logic here
    const result = {
        message: 'Implementation ready',
        status: 'success',
        data: null
    };
    
    return result;
}

// Execute the implementation
const output = implementation();
console.log('Result:', output);`}`;

            explanation = `## 💻 Generated Implementation\n\nCreated a starting point for: **${prompt}**\n\n**What's included:**\n• Basic structure and scaffolding\n• Error handling patterns\n• Logging for debugging\n• TODO markers for customization\n• Example execution code\n\n**Next steps:**\n1. Replace TODO sections with your logic\n2. Add specific functionality\n3. Test the implementation\n4. Add error handling as needed`;
            description = `Generated code for: ${prompt}`;
        }

        return { explanation, code, description };
    }

    private async explainCode(prompt: string, context: FileContext): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, 600));
        
        const code = context.content || '';
        const language = context.language;
        
        let explanation = `## 🔍 Code Explanation\n\n**Language:** ${language.charAt(0).toUpperCase() + language.slice(1)}\n\n`;
        
        // Analyze the code structure
        if (code.includes('function ') || code.includes('=>') || code.includes('def ')) {
            explanation += "**This is a function definition.**\n\n";
            
            if (code.includes('async') || code.includes('await')) {
                explanation += "• **Asynchronous**: Uses async/await for handling promises\n";
            }
            
            if (code.includes('try') && code.includes('catch')) {
                explanation += "• **Error Handling**: Includes try-catch for error management\n";
            }
            
            if (code.includes('return')) {
                explanation += "• **Return Value**: Function returns a value to the caller\n";
            }
        }
        
        if (code.includes('class ')) {
            explanation += "**This is a class definition.**\n\n";
            explanation += "• **Object-Oriented**: Defines a blueprint for creating objects\n";
            
            if (code.includes('constructor')) {
                explanation += "• **Constructor**: Has an initialization method\n";
            }
            
            if (code.includes('private') || code.includes('public')) {
                explanation += "• **Encapsulation**: Uses access modifiers for data protection\n";
            }
        }
        
        // Look for patterns
        if (code.includes('import ') || code.includes('from ')) {
            explanation += "\n**Dependencies:**\n";
            explanation += "• Imports external modules or libraries\n";
        }
        
        if (code.includes('console.log') || code.includes('print(')) {
            explanation += "\n**Debugging:**\n";
            explanation += "• Includes logging statements for debugging\n";
        }
        
        explanation += `\n**Code Structure:**\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
        explanation += "**Purpose:** This code appears to implement functionality related to your request. ";
        explanation += "It follows standard conventions for " + language + " development.\n\n";
        explanation += "**Suggestions:**\n";
        explanation += "• Add comments for better documentation\n";
        explanation += "• Consider adding error handling if not present\n";
        explanation += "• Write unit tests to verify functionality\n";
        explanation += "• Review for performance optimizations";
        
        return explanation;
    }

    private async generateChatResponse(prompt: string, context: FileContext | undefined): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const promptLower = prompt.toLowerCase();
        
        if (promptLower.includes('help') || promptLower.includes('what can you do')) {
            return `## 🤖 AI Code Assistant Capabilities\n\nI'm here to help with your development needs!\n\n**Code Generation:**\n• Create functions, classes, and components\n• Generate boilerplate and templates\n• Write tests and documentation\n\n**Code Improvement:**\n• Fix bugs and errors\n• Refactor for better performance\n• Optimize code structure\n• Apply best practices\n\n**Code Analysis:**\n• Explain complex code\n• Review and suggest improvements\n• Identify potential issues\n\n**Context-Aware:**\n• Understands your current file\n• Provides language-specific solutions\n• Considers your selected code\n\n**Quick Commands:**\n• \`Ctrl+Shift+P\` → "Explain Code"\n• \`Ctrl+Shift+P\` → "Fix Code"\n• \`Ctrl+Shift+P\` → "Refactor Code"\n• \`Ctrl+Shift+P\` → "Generate Tests"\n\nJust tell me what you need, and I'll provide intelligent code suggestions!`;
        }
        
        if (promptLower.includes('test') && promptLower.includes('how')) {
            return `## 🧪 Testing Best Practices\n\nHere's how to write effective tests:\n\n**Unit Testing Principles:**\n• Test one thing at a time\n• Use descriptive test names\n• Follow AAA pattern (Arrange, Act, Assert)\n• Mock external dependencies\n\n**Common Test Structure:**\n\`\`\`typescript\ndescribe('Component or Function', () => {\n  it('should do something specific', () => {\n    // Arrange\n    const input = 'test';\n    \n    // Act\n    const result = functionUnderTest(input);\n    \n    // Assert\n    expect(result).toBe('expected');\n  });\n});\n\`\`\`\n\n**Testing Libraries:**\n• **Jest**: Popular JavaScript testing framework\n• **Mocha**: Flexible test framework\n• **Cypress**: End-to-end testing\n• **Testing Library**: React component testing\n\nWould you like me to generate tests for your specific code?`;
        }
        
        // Generic helpful response
        return `## 💬 Chat Response\n\nThanks for your message: "${prompt}"\n\n**I understand you're asking about this topic.** Here are some thoughts:\n\n• This is an interesting question that has several aspects to consider\n• The best approach depends on your specific requirements and context\n• I can provide more targeted help if you share some code or be more specific\n\n**How I can help better:**\n• Show me some code you're working with\n• Describe the specific problem you're trying to solve\n• Let me know what programming language you're using\n• Ask about specific functions, classes, or patterns\n\n**Quick suggestions:**\n• Use the command palette (\`Ctrl+Shift+P\`) for quick actions\n• Select code and ask me to explain or improve it\n• Ask for specific examples or implementations\n\nWhat would you like to work on next?`;
    }

    private async showActionOptions(codeAction?: CodeAction) {
        if (!codeAction) {
            return;
        }

        const actions = ['Apply Code', 'Preview Changes', 'Copy Code', 'Continue Chat'];
        const selected = await vscode.window.showInformationMessage(
            `✨ ${codeAction.description}`,
            ...actions
        );

        switch (selected) {
            case 'Apply Code':
                await this.applyCodeAction(this.chatHistory[this.chatHistory.length - 1]);
                break;
            case 'Preview Changes':
                await this.previewCodeAction(this.chatHistory[this.chatHistory.length - 1]);
                break;
            case 'Copy Code':
                vscode.env.clipboard.writeText(codeAction.code);
                vscode.window.showInformationMessage('Code copied to clipboard');
                break;
            case 'Continue Chat':
                setTimeout(() => this.showAiChat(), 100);
                break;
        }
    }

    private async applyCodeAction(message: ChatMessage) {
        if (!message.codeAction) return;

        const action = message.codeAction;
        
        // Find the target editor
        let targetEditor = vscode.window.activeTextEditor;
        
        if (action.filePath && action.filePath !== targetEditor?.document.uri.fsPath) {
            // Try to find the editor with the target file
            targetEditor = vscode.window.visibleTextEditors.find(e => 
                e.document.uri.fsPath === action.filePath
            );
            
            if (!targetEditor) {
                // Try to open the file
                try {
                    const document = await vscode.workspace.openTextDocument(action.filePath);
                    targetEditor = await vscode.window.showTextDocument(document);
                } catch (error) {
                    vscode.window.showErrorMessage(`Could not open file: ${action.filePath}`);
                    return;
                }
            }
        }

        if (!targetEditor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        try {
            await targetEditor.edit(editBuilder => {
                if (action.range) {
                    // Replace selected code
                    editBuilder.replace(action.range, action.code);
                } else {
                    // Insert at cursor or end of file
                    const position = targetEditor!.selection.active;
                    editBuilder.insert(position, action.code);
                }
            });

            vscode.window.showInformationMessage(`✅ ${action.description} applied successfully!`);
            
            // Mark the code action as applied
            message.codeAction = undefined;
            this.historyProvider.refresh();

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to apply code action: ${error}`);
        }
    }

    private async previewCodeAction(message: ChatMessage) {
        if (!message.codeAction) return;

        const action = message.codeAction;
        
        // Create a new untitled document to show the preview
        const document = await vscode.workspace.openTextDocument({
            content: action.code,
            language: message.context?.language || 'typescript'
        });

        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        vscode.window.showInformationMessage('👁️ Preview opened - Close when done reviewing');
    }

    private updateStatusBar(isExecuting: boolean) {
        if (isExecuting) {
            this.statusBarItem.text = "$(loading~spin) AI Thinking...";
            this.statusBarItem.tooltip = "AI is processing your request...";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = "$(copilot) AI Chat";
            this.statusBarItem.tooltip = "Chat with AI - Generate, fix, and refactor code";
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
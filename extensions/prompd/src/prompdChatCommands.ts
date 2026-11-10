import * as vscode from 'vscode';
import PrompdChatServiceSimple, { PrompdChatRequest } from './prompdChatServiceSimple';

/**
 * Prompd Chat Commands
 * 
 * Provides command palette and context menu integration for Prompd Chat
 * Enables quick access to AI assistance from anywhere in the IDE
 */

export class PrompdChatCommands {
    private chatService: PrompdChatServiceSimple;

    constructor(context: vscode.ExtensionContext) {
        console.log('⚡ PrompdChatCommands constructor called');
        this.chatService = new PrompdChatServiceSimple(context);
        this.registerCommands(context);
        console.log('✅ PrompdChatCommands initialized successfully');
    }

    private registerCommands(context: vscode.ExtensionContext) {
        // Main chat commands
        context.subscriptions.push(
            vscode.commands.registerCommand('prompd.chat.optimize', () => this.optimizePrompt()),
            vscode.commands.registerCommand('prompd.chat.explain', () => this.explainPrompt()),
            vscode.commands.registerCommand('prompd.chat.addParameters', () => this.addParameters()),
            vscode.commands.registerCommand('prompd.chat.improveStructure', () => this.improveStructure()),
            vscode.commands.registerCommand('prompd.chat.generateFromDescription', () => this.generateFromDescription()),
            vscode.commands.registerCommand('prompd.chat.askCustom', () => this.askCustomQuestion()),
            
            // Workflow-specific commands  
            vscode.commands.registerCommand('prompd.chat.optimizeWorkflow', () => this.optimizeWorkflow()),
            vscode.commands.registerCommand('prompd.chat.addWorkflowStep', () => this.addWorkflowStep()),
            vscode.commands.registerCommand('prompd.chat.fixConnections', () => this.fixConnections()),
            
            // Context menu commands
            vscode.commands.registerCommand('prompd.chat.improveSelection', () => this.improveSelection()),
            vscode.commands.registerCommand('prompd.chat.explainSelection', () => this.explainSelection()),
            
            // Quick actions
            vscode.commands.registerCommand('prompd.chat.quickFix', () => this.quickFix()),
            vscode.commands.registerCommand('prompd.chat.showSuggestions', () => this.showSuggestions())
        );
    }

    /**
     * Optimize the current prompt for better effectiveness
     */
    private async optimizePrompt() {
        const request = await this.buildRequest(
            'optimize',
            'Please analyze this prompt and optimize it for better effectiveness, clarity, and results. Focus on improving the structure, wording, and instructions.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Explain what the prompt does and how it works
     */
    private async explainPrompt() {
        const request = await this.buildRequest(
            'explain',
            'Please explain what this prompt does, how it works, and provide suggestions for improvement. Break down each section and explain the prompt engineering techniques being used.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Add parameters to make the prompt more flexible
     */
    private async addParameters() {
        const request = await this.buildRequest(
            'modify',
            'Please add parameters to this prompt to make it more flexible and reusable. Identify parts that could be parameterized and add appropriate parameter definitions to the frontmatter.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Improve the overall structure of the prompt
     */
    private async improveStructure() {
        const request = await this.buildRequest(
            'modify',
            'Please improve the structure and organization of this prompt. Consider adding or reorganizing sections like System, Context, Instructions, Examples, and Output Format for better clarity and effectiveness.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Generate a new prompt from a description
     */
    private async generateFromDescription() {
        const description = await vscode.window.showInputBox({
            prompt: 'Describe the prompt you want to create',
            placeHolder: 'e.g., "A prompt to analyze customer feedback and extract sentiment"',
            ignoreFocusOut: true
        });

        if (!description) return;

        const request = await this.buildRequest(
            'generate',
            `Please create a new professional prompt based on this description: "${description}". Include appropriate sections, parameters, and follow prompt engineering best practices.`
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Ask a custom question about the prompt
     */
    private async askCustomQuestion() {
        const question = await vscode.window.showInputBox({
            prompt: 'What would you like to know or change about this prompt?',
            placeHolder: 'e.g., "Make this prompt more concise", "Add error handling", "Explain the Chain-of-Thought technique"',
            ignoreFocusOut: true
        });

        if (!question) return;

        const request = await this.buildRequest('modify', question);
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Optimize workflow for better performance and clarity
     */
    private async optimizeWorkflow() {
        const request = await this.buildRequest(
            'optimize',
            'Please analyze this prompdflow workflow and optimize it for better performance, clarity, and maintainability. Look for redundant nodes, improve connections, and suggest better organization.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Add a new step to the workflow
     */
    private async addWorkflowStep() {
        const stepDescription = await vscode.window.showInputBox({
            prompt: 'Describe the workflow step you want to add',
            placeHolder: 'e.g., "Add a validation step before the final output"',
            ignoreFocusOut: true
        });

        if (!stepDescription) return;

        const request = await this.buildRequest(
            'modify',
            `Please add a new workflow step: "${stepDescription}". Create the appropriate node, configure it properly, and connect it to the existing workflow in the most logical place.`
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Fix workflow connections and dependencies
     */
    private async fixConnections() {
        const request = await this.buildRequest(
            'modify',
            'Please analyze the workflow connections and fix any issues. Ensure proper data flow, remove circular dependencies, and optimize the connection paths.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Improve selected text
     */
    private async improveSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showWarningMessage('Please select some text first');
            return;
        }

        const selectedText = editor.document.getText(editor.selection);
        const request = await this.buildRequest(
            'modify',
            `Please improve this selected text for better clarity and effectiveness: "${selectedText}". Focus on the specific selection while maintaining context with the rest of the prompt.`
        );
        
        if (request) {
            request.context!.selectedText = selectedText;
            await this.executeRequest(request);
        }
    }

    /**
     * Explain selected text
     */
    private async explainSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showWarningMessage('Please select some text first');
            return;
        }

        const selectedText = editor.document.getText(editor.selection);
        const request = await this.buildRequest(
            'explain',
            `Please explain this selected part of the prompt: "${selectedText}". What purpose does it serve and how does it contribute to the overall prompt effectiveness?`
        );
        
        if (request) {
            request.context!.selectedText = selectedText;
            await this.executeRequest(request);
        }
    }

    /**
     * Quick fix for common issues
     */
    private async quickFix() {
        const request = await this.buildRequest(
            'optimize',
            'Please perform a quick analysis and fix any common issues in this prompt such as unclear instructions, missing parameters, poor structure, or ineffective wording.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Show AI suggestions for the current file
     */
    private async showSuggestions() {
        const request = await this.buildRequest(
            'analyze',
            'Please analyze this prompt and provide specific suggestions for improvement. Focus on actionable recommendations that would make this prompt more effective.'
        );
        
        if (request) {
            await this.executeRequest(request);
        }
    }

    /**
     * Build a chat request from the current context
     */
    private async buildRequest(type: 'modify' | 'analyze' | 'optimize' | 'generate' | 'explain', message: string): Promise<PrompdChatRequest | null> {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showWarningMessage('Please open a .prompd or .pdflow file first');
            return null;
        }

        const filePath = editor.document.fileName;
        const fileExtension = filePath.toLowerCase().endsWith('.prompd') ? '.prompd' : 
                             filePath.toLowerCase().endsWith('.pdflow') ? '.pdflow' : null;

        if (!fileExtension) {
            vscode.window.showWarningMessage('Prompd Chat only works with .prompd and .pdflow files');
            return null;
        }

        return {
            type: type,
            fileType: fileExtension,
            filePath: filePath,
            currentContent: editor.document.getText(),
            userMessage: message,
            context: {
                selectedText: editor.selection.isEmpty ? undefined : editor.document.getText(editor.selection),
                cursorPosition: editor.selection.active,
                activeSection: await this.detectActiveSection(editor),
                workspaceFiles: await this.getWorkspacePromptFiles()
            }
        };
    }

    /**
     * Execute the request and show results
     */
    private async executeRequest(request: PrompdChatRequest) {
        try {
            // Show progress indicator
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Prompd Chat is analyzing your request...',
                    cancellable: false
                },
                async (progress) => {
                    progress.report({ increment: 50 });
                    
                    const response = await this.chatService.chat(request);
                    
                    progress.report({ increment: 100 });
                    
                    if (response.success) {
                        await this.showResponse(response, request);
                    } else {
                        vscode.window.showErrorMessage(`Prompd Chat: ${response.message}`);
                    }
                }
            );
        } catch (error) {
            console.error('Prompd Chat error:', error);
            vscode.window.showErrorMessage('Prompd Chat encountered an error. Please try again.');
        }
    }

    /**
     * Show the AI response to the user
     */
    private async showResponse(response: any, request: PrompdChatRequest) {
        // Create a dedicated output channel for chat responses
        const outputChannel = vscode.window.createOutputChannel('Prompd Chat Response');
        outputChannel.clear();
        
        outputChannel.appendLine(`🤖 Prompd Chat Response`);
        outputChannel.appendLine(`File: ${request.filePath}`);
        outputChannel.appendLine(`Request: ${request.userMessage}`);
        outputChannel.appendLine(`\n${response.message}`);
        
        if (response.reasoning) {
            outputChannel.appendLine(`\n💡 Reasoning: ${response.reasoning}`);
        }

        if (response.modifications && response.modifications.length > 0) {
            outputChannel.appendLine(`\n🔧 Suggested Modifications:`);
            response.modifications.forEach((mod: any, index: number) => {
                outputChannel.appendLine(`${index + 1}. ${mod.type}: ${mod.description}`);
            });

            // Ask user if they want to apply changes
            const choice = await vscode.window.showInformationMessage(
                `Prompd Chat has ${response.modifications.length} suggestions. Would you like to apply them?`,
                'Apply Changes', 'View Details', 'Cancel'
            );

            if (choice === 'Apply Changes') {
                const success = await this.chatService.applyModifications(response.modifications, request.filePath);
                if (success) {
                    vscode.window.showInformationMessage('Changes applied successfully! 🎉');
                }
            } else if (choice === 'View Details') {
                outputChannel.show();
            }
        } else {
            outputChannel.show();
        }

        if (response.suggestions && response.suggestions.length > 0) {
            // Show suggestions as quick picks
            interface SuggestionItem extends vscode.QuickPickItem {
                suggestion: any;
            }
            
            const suggestionItems: SuggestionItem[] = response.suggestions.map((suggestion: any) => ({
                label: `💡 ${suggestion.title}`,
                description: suggestion.description,
                suggestion: suggestion
            }));

            const selectedSuggestion = await vscode.window.showQuickPick(suggestionItems, {
                placeHolder: 'Additional suggestions from Prompd Chat'
            });

            if (selectedSuggestion?.suggestion?.action) {
                await selectedSuggestion.suggestion.action();
            }
        }
    }

    /**
     * Detect the active section in a .prompd file
     */
    private async detectActiveSection(editor: vscode.TextEditor): Promise<string | undefined> {
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

    /**
     * Get workspace prompt files for context
     */
    private async getWorkspacePromptFiles(): Promise<string[]> {
        const files = await vscode.workspace.findFiles('**/*.{prompd,prompdflow}', '**/node_modules/**', 50);
        return files.map(file => file.fsPath);
    }
}
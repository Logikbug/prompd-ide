import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { PromptBuilderProvider } from './promptBuilder';
import { registerEnhancedTreeView } from './enhancedTreeView';
import { PromptCanvasProvider } from './promptCanvas';
import { activateWorkbench } from './prompdWorkbench';
import { QuickPrompt } from './quickPrompt';
import { CopilotChat } from './copilotChat';
import { ParametersProvider } from './parametersProvider';
import { PrompdChatViewProvider } from './prompdChatViewNew';
import { PrompdChatCommands } from './prompdChatCommands';
import { PrompdProjectService } from './projectService';
import { ProjectWorkspaceProvider } from './projectEditor';
import { ProjectExplorerProvider } from './projectExplorer';
import { ProjectPicker } from './projectPicker';

/**
 * Minimal Prompd Extension - Just the essentials
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 prompd IDE is now active - Professional Prompt Engineering Environment');
    console.log('📊 Extension activating - registering views and components...');

    // Create project explorer provider
    const projectExplorerProvider = new ProjectExplorerProvider();
    
    // Register views immediately to avoid registration errors
    registerViews(context, projectExplorerProvider);

    // Activate the main Prompd Workbench (implements Figma design)
    activateWorkbench(context);

    // Register the debug command
    context.subscriptions.push(
        vscode.commands.registerCommand('prompdx.debugPrompt', debugPrompt)
    );

    // Debug adapter removed - not needed for minimal extension

    // Register custom WYSIWYG editor
    context.subscriptions.push(
        PromptBuilderProvider.register(context)
    );

    // Register enhanced parameter tree view with execution UI
    registerEnhancedTreeView(context);
    
    // Register prompt canvas for visual chaining (.pdflow files)
    context.subscriptions.push(
        PromptCanvasProvider.register(context)
    );

    // Register project workspace provider for .prompdproj files
    context.subscriptions.push(
        ProjectWorkspaceProvider.register(context)
    );

    // Copilot chat disabled to reduce status bar clutter
    // CopilotChat.activate(context);

    // Initialize new Prompd Chat AI Assistant
    console.log('🤖 Initializing Prompd Chat AI Assistant...');
    const prompdChatProvider = new PrompdChatViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(PrompdChatViewProvider.viewType, prompdChatProvider)
    );
    console.log('✅ Prompd Chat View registered successfully');

    // Initialize Prompd Chat Commands
    console.log('⚡ Initializing Prompd Chat Commands...');
    const prompdChatCommands = new PrompdChatCommands(context);
    context.subscriptions.push({ dispose: () => {} }); // Commands handle their own cleanup
    console.log('✅ Prompd Chat Commands registered successfully');

    // Initialize Prompd Project Service for .prompdproj files
    console.log('📁 Initializing Prompd Project Service...');
    const projectService = PrompdProjectService.getInstance();
    
    // Register custom editor for .prompdproj files that opens as workspace
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('prompdproj', {
            async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
                // This shouldn't be called - we intercept before content is shown
                return 'Loading Prompd project...';
            }
        })
    );

    // Register command to handle .prompdproj files
    context.subscriptions.push(
        vscode.commands.registerCommand('prompd.openProjectFile', async (uri: vscode.Uri) => {
            await projectService.openProject(uri);
        })
    );

    // Intercept .prompdproj file opens and redirect to project opening
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.uri.fsPath.toLowerCase().endsWith('.pdproj')) {
                // Close the text document
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                
                // Open as project instead
                await projectService.openProject(document.uri);
            }
        })
    );
    
    console.log('✅ Prompd Project Service registered successfully');

    // Initialize Project Picker for "Open Project" functionality
    console.log('📁 Initializing Project Picker...');
    const projectPicker = new ProjectPicker();
    
    // Register "Open Project" command to replace "Open Folder"
    context.subscriptions.push(
        vscode.commands.registerCommand('prompd.openProject', async () => {
            await projectPicker.showOpenProjectDialog();
        })
    );

    // Override default "Open Folder" with "Open Project"
    context.subscriptions.push(
        vscode.commands.registerCommand('workbench.action.files.openFolder', async () => {
            await projectPicker.showOpenProjectDialog();
        })
    );

    // Also override "Open Recent" to be project-aware
    context.subscriptions.push(
        vscode.commands.registerCommand('workbench.action.openRecent', async () => {
            await projectPicker.showOpenProjectDialog();
        })
    );

    console.log('✅ Project Picker registered - Open Folder is now Open Project');

    // Register project explorer refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('prompd.refreshProjectExplorer', () => {
            const explorer = projectExplorerProvider;
            if (explorer) {
                explorer.refresh();
            }
        })
    );

    // Register test command to verify extension is working
    context.subscriptions.push(
        vscode.commands.registerCommand('prompd.test.showMessage', () => {
            vscode.window.showInformationMessage('🎉 Prompd Extension is working! Chat sidebar should be visible in the activity bar.');
        })
    );

    // Welcome message removed - no more startup toast
}

function registerViews(context: vscode.ExtensionContext, projectExplorerProvider: ProjectExplorerProvider) {
    // Simple tree data providers to ensure views exist
    
    const variablesProvider = {
        getTreeItem: (element: any) => element,
        getChildren: () => []
    };

    const snippetsProvider = {
        getTreeItem: (element: any) => element,
        getChildren: () => []
    };

    const quickHistoryProvider = {
        getTreeItem: (element: any) => element,
        getChildren: () => []
    };

    const realParametersProvider = ParametersProvider.create(context);

    const flowCanvasProvider = {
        getTreeItem: (element: any) => element,
        getChildren: () => []
    };

    const templatesProvider = {
        getTreeItem: (element: any) => element,
        getChildren: () => []
    };

    // Register ALL views immediately to prevent registration errors
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('prompdVariables', variablesProvider),
        vscode.window.registerTreeDataProvider('prompdSnippets', snippetsProvider),
        // Quick history provider removed - functionality integrated into main chat view
        vscode.window.registerTreeDataProvider('prompdParameters', realParametersProvider),
        vscode.window.registerTreeDataProvider('prompdFlowCanvas', flowCanvasProvider),
        vscode.window.registerTreeDataProvider('prompdFiles', projectExplorerProvider),
        vscode.window.registerTreeDataProvider('prompdTemplates', templatesProvider)
    );
    
    console.log('✅ Views registered: all prompd sidebar views including workspace files and templates');
}

async function debugPrompt() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'prompd') {
        vscode.window.showErrorMessage('Please open a .prompd file to debug');
        return;
    }

    // Create output channel for debugging info
    const outputChannel = vscode.window.createOutputChannel('Prompt Debugger');
    outputChannel.clear();
    outputChannel.show();

    const fileName = vscode.workspace.asRelativePath(editor.document.fileName);
    const content = editor.document.getText();

    outputChannel.appendLine('🚀 Prompd Debugger Started');
    outputChannel.appendLine(`📄 File: ${fileName}`);
    outputChannel.appendLine('');

    try {
        // Parse parameters from the file
        const parameters = await extractParameters(content);
        
        if (parameters.length > 0) {
            outputChannel.appendLine('📊 Parameters Found:');
            parameters.forEach(param => {
                const required = param.required ? ' (required)' : '';
                const defaultVal = param.default ? ` [default: ${param.default}]` : '';
                outputChannel.appendLine(`   • ${param.name}: ${param.type}${required}${defaultVal}`);
                if (param.description) {
                    outputChannel.appendLine(`     "${param.description}"`);
                }
            });
        } else {
            outputChannel.appendLine('📊 No parameters defined in this prompt');
        }

        outputChannel.appendLine('');
        outputChannel.appendLine('✅ Parameter parsing successful!');
        outputChannel.appendLine('🎯 Next: Add parameter input dialogs, execution...');

    } catch (error) {
        outputChannel.appendLine(`❌ Error parsing parameters: ${error}`);
    }
}

async function extractParameters(content: string): Promise<Parameter[]> {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
        return [];
    }

    try {
        const metadata = yaml.parse(frontmatterMatch[1]);
        return metadata.parameters || [];
    } catch (error) {
        throw new Error(`Invalid YAML frontmatter: ${error}`);
    }
}

interface Parameter {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    default?: any;
}

// Debug adapter removed for minimal extension

export function deactivate() {
    // Clean up
}
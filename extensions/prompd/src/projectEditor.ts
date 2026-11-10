import * as vscode from 'vscode';
import { PrompdProjectService } from './projectService';

/**
 * Custom editor for .prompdproj files that immediately opens as a workspace
 * instead of showing file contents (similar to Visual Studio .sln behavior)
 */
export class ProjectWorkspaceProvider implements vscode.CustomTextEditorProvider {
    
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ProjectWorkspaceProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'prompdx.projectWorkspace',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
        return providerRegistration;
    }

    constructor(private readonly context: vscode.ExtensionContext) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        
        // Immediately hide the webview panel
        webviewPanel.dispose();
        
        // Open as project workspace instead
        const projectService = PrompdProjectService.getInstance();
        
        try {
            console.log(`Opening .prompdproj file as workspace: ${document.uri.fsPath}`);
            await projectService.openProject(document.uri);
        } catch (error) {
            console.error('Failed to open project workspace:', error);
            vscode.window.showErrorMessage(`Failed to open project: ${error}`);
            
            // Fall back to showing the file content in a regular text editor
            const textDoc = await vscode.workspace.openTextDocument(document.uri);
            await vscode.window.showTextDocument(textDoc);
        }
    }
}
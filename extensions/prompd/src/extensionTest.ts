import * as vscode from 'vscode';

/**
 * Minimal test extension to verify basic functionality
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('🧪 Test Extension Activated');
    
    // Create a simple tree data provider
    const treeProvider = {
        getTreeItem: (element: any) => element,
        getChildren: () => [{ label: 'Test Item', collapsibleState: vscode.TreeItemCollapsibleState.None }]
    };

    // Register the test view
    vscode.window.createTreeView('prompdChat.chatView', { 
        treeDataProvider: treeProvider
    });
    
    console.log('✅ Test view registered');
    
    vscode.window.showInformationMessage('Test extension loaded successfully!');
}

export function deactivate() {
    console.log('🧪 Test Extension Deactivated');
}
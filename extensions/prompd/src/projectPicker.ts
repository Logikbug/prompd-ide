import * as vscode from 'vscode';
import * as path from 'path';
import { PrompdProjectService } from './projectService';

/**
 * Custom project picker that prioritizes .pdproj files
 * and allows creating new projects in folders
 */
export class ProjectPicker {
    private projectService: PrompdProjectService;

    constructor() {
        this.projectService = PrompdProjectService.getInstance();
    }

    /**
     * Shows the Open Project dialog
     */
    public async showOpenProjectDialog(): Promise<void> {
        const options: vscode.QuickPickItem[] = [
            {
                label: '$(folder-opened) Browse for Existing Project',
                description: 'Select a folder containing a .pdproj file',
                detail: 'Open an existing Prompd project'
            },
            {
                label: '$(file-add) Create New Project',
                description: 'Create a new .pdproj file in a folder',
                detail: 'Initialize a new Prompd project in an existing folder'
            },
            {
                label: '$(folder) Open Recent Projects',
                description: 'Choose from recently opened projects',
                detail: 'Quick access to your recent Prompd projects'
            }
        ];

        const selection = await vscode.window.showQuickPick(options, {
            title: 'Open Prompd Project',
            placeHolder: 'Choose how to open or create a project',
            ignoreFocusOut: true
        });

        if (!selection) return;

        switch (selection.label) {
            case '$(folder-opened) Browse for Existing Project':
                await this.browseForProject();
                break;
            case '$(file-add) Create New Project':
                await this.createNewProject();
                break;
            case '$(folder) Open Recent Projects':
                await this.showRecentProjects();
                break;
        }
    }

    /**
     * Browse for existing .pdproj files or folders
     */
    private async browseForProject(): Promise<void> {
        // First, try to find .pdproj files
        const pdprojFiles = await vscode.window.showOpenDialog({
            title: 'Select Prompd Project File',
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Prompd Projects': ['pdproj'],
                'All Files': ['*']
            },
            openLabel: 'Open Project'
        });

        if (pdprojFiles && pdprojFiles.length > 0) {
            await this.projectService.openProject(pdprojFiles[0]);
            return;
        }

        // If no .pdproj file selected, allow folder selection
        const folderSelection = await vscode.window.showInformationMessage(
            'No .pdproj file selected. Would you like to browse folders instead?',
            'Browse Folders',
            'Cancel'
        );

        if (folderSelection === 'Browse Folders') {
            const folders = await vscode.window.showOpenDialog({
                title: 'Select Project Folder',
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Open Folder'
            });

            if (folders && folders.length > 0) {
                await this.openFolderAsProject(folders[0]);
            }
        }
    }

    /**
     * Create a new project in a selected folder
     */
    private async createNewProject(): Promise<void> {
        const folders = await vscode.window.showOpenDialog({
            title: 'Select Folder for New Project',
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Create Project Here'
        });

        if (!folders || folders.length === 0) return;

        const folderUri = folders[0];
        const folderName = path.basename(folderUri.fsPath);

        // Check if .pdproj already exists
        try {
            const existingFiles = await vscode.workspace.fs.readDirectory(folderUri);
            const hasPdproj = existingFiles.some(([name]) => name.endsWith('.pdproj'));
            
            if (hasPdproj) {
                const action = await vscode.window.showWarningMessage(
                    'This folder already contains a .pdproj file.',
                    'Open Existing',
                    'Create New Anyway',
                    'Cancel'
                );

                if (action === 'Open Existing') {
                    const pdprojFile = existingFiles.find(([name]) => name.endsWith('.pdproj'));
                    if (pdprojFile) {
                        const projectUri = vscode.Uri.joinPath(folderUri, pdprojFile[0]);
                        await this.projectService.openProject(projectUri);
                        return;
                    }
                } else if (action === 'Cancel') {
                    return;
                }
            }
        } catch (error) {
            console.warn('Could not check existing files:', error);
        }

        // Get project details from user
        const projectName = await vscode.window.showInputBox({
            title: 'New Prompd Project',
            prompt: 'Enter project name',
            value: folderName,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Project name is required';
                }
                return null;
            }
        });

        if (!projectName) return;

        const projectDescription = await vscode.window.showInputBox({
            title: 'New Prompd Project',
            prompt: 'Enter project description (optional)',
            placeHolder: 'A brief description of this project'
        });

        const author = await vscode.window.showInputBox({
            title: 'New Prompd Project',
            prompt: 'Enter author name (optional)',
            placeHolder: 'Project author'
        });

        // Create the .prompdproj file
        await this.createProjectFile(folderUri, projectName, projectDescription, author);
    }

    /**
     * Show recent projects (placeholder for now)
     */
    private async showRecentProjects(): Promise<void> {
        vscode.window.showInformationMessage(
            'Recent projects feature coming soon! For now, use "Browse for Existing Project".'
        );
    }

    /**
     * Open a folder as a project (check for .pdproj or offer to create one)
     */
    private async openFolderAsProject(folderUri: vscode.Uri): Promise<void> {
        try {
            // Look for .pdproj files in the folder
            const files = await vscode.workspace.fs.readDirectory(folderUri);
            const pdprojFiles = files.filter(([name]) => name.endsWith('.pdproj'));

            if (pdprojFiles.length > 0) {
                // Found .pdproj file(s)
                if (pdprojFiles.length === 1) {
                    const projectUri = vscode.Uri.joinPath(folderUri, pdprojFiles[0][0]);
                    await this.projectService.openProject(projectUri);
                } else {
                    // Multiple .pdproj files - let user choose
                    const options = pdprojFiles.map(([name]) => ({
                        label: name,
                        description: 'Prompd project file'
                    }));

                    const selection = await vscode.window.showQuickPick(options, {
                        title: 'Multiple Projects Found',
                        placeHolder: 'Select which project to open'
                    });

                    if (selection) {
                        const projectUri = vscode.Uri.joinPath(folderUri, selection.label);
                        await this.projectService.openProject(projectUri);
                    }
                }
            } else {
                // No .pdproj file found - offer to create one or open as folder
                const action = await vscode.window.showInformationMessage(
                    `No .pdproj file found in "${path.basename(folderUri.fsPath)}". Would you like to create one?`,
                    'Create Project File',
                    'Open as Folder',
                    'Cancel'
                );

                if (action === 'Create Project File') {
                    const folderName = path.basename(folderUri.fsPath);
                    await this.createProjectFile(folderUri, folderName);
                } else if (action === 'Open as Folder') {
                    // Open as regular workspace folder
                    await vscode.commands.executeCommand('vscode.openFolder', folderUri);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open folder: ${error}`);
        }
    }

    /**
     * Creates a new .pdproj file in the specified folder
     */
    private async createProjectFile(
        folderUri: vscode.Uri, 
        name: string, 
        description?: string, 
        author?: string
    ): Promise<void> {
        const projectFileName = `${name.toLowerCase().replace(/\s+/g, '-')}.pdproj`;
        const projectUri = vscode.Uri.joinPath(folderUri, projectFileName);

        const projectContent = `# Prompd Project Configuration
name: "${name}"
version: "1.0.0"
description: "${description || `Prompd project: ${name}`}"
author: "${author || 'Unknown'}"
created: "${new Date().toISOString().split('T')[0]}"

# Available workflows in this project
workflows:
  - name: "example-workflow"
    file: "example.prompd"
    description: "Example workflow to get started"
    category: "general"
    inputs:
      - name: "input_text"
        type: "string"
        required: true
        description: "Input text for the workflow"
    outputs:
      - name: "result"
        type: "text"
        description: "Processed output"

# Project dependencies
dependencies:
  providers:
    - name: "openai"
      version: ">=4.0.0"
      required: true
      models: ["gpt-4o-mini", "gpt-4"]

# File exclusions
exclusions:
  directories:
    - "node_modules"
    - ".git"
    - "__pycache__"
    - ".vscode"
    - "dist"
    - "build"
  patterns:
    - "*.log"
    - "*.tmp"
    - "*.cache"
  files:
    - ".DS_Store"
    - "Thumbs.db"

# Project settings
settings:
  defaults:
    provider: "openai"
    model: "gpt-4o-mini"
    temperature: 0.7
    max_tokens: 2000
  
  output:
    directory: "output"
    timestamp: true
    include_metadata: true

# Development environment
environment:
  variables:
    PROJECT_NAME: "\${name}"
    OUTPUT_DIR: "\${settings.output.directory}"
`;

        try {
            await vscode.workspace.fs.writeFile(projectUri, Buffer.from(projectContent, 'utf8'));
            
            vscode.window.showInformationMessage(
                `Created new Prompd project: ${projectFileName}`,
                'Open Project'
            ).then(action => {
                if (action === 'Open Project') {
                    this.projectService.openProject(projectUri);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create project file: ${error}`);
        }
    }
}
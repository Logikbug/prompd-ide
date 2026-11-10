import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';

/**
 * Interface for workflow definitions in project files
 */
export interface IPrompdWorkflow {
    name: string;
    file: string;
    description?: string;
    category?: string;
    complexity?: 'basic' | 'intermediate' | 'advanced';
    inputs?: Array<{
        name: string;
        type: string;
        required?: boolean;
        default?: any;
        description?: string;
    }>;
    outputs?: Array<{
        name: string;
        type: string;
        description?: string;
    }>;
}

/**
 * Interface for project dependencies
 */
export interface IPrompdDependencies {
    providers?: Array<{
        name: string;
        version?: string;
        required?: boolean;
        models?: string[];
    }>;
    tools?: Array<{
        name: string;
        description?: string;
        optional?: boolean;
    }>;
    python?: string[];
    npm?: string[];
}

/**
 * Main interface for parsed project configuration
 */
export interface IPrompdProject {
    name: string;
    version: string;
    description?: string;
    author?: string;
    created?: string;
    
    workflows?: IPrompdWorkflow[];
    advanced_workflows?: IPrompdWorkflow[];
    flow_workflows?: IPrompdWorkflow[];
    
    dependencies?: IPrompdDependencies;
    exclusions?: {
        directories?: string[];
        patterns?: string[];
        files?: string[];
    };
    settings?: any;
    
    // Raw project data for extensions
    [key: string]: any;
}

/**
 * Service for handling Prompd project files (.pdproj)
 * Similar to how Visual Studio handles .sln files
 */
export class PrompdProjectService {
    private static instance: PrompdProjectService;
    private currentProject: IPrompdProject | undefined;

    private constructor() {}

    public static getInstance(): PrompdProjectService {
        if (!PrompdProjectService.instance) {
            PrompdProjectService.instance = new PrompdProjectService();
        }
        return PrompdProjectService.instance;
    }

    /**
     * Opens a Prompd project by parsing the .pdproj file and opening the workspace
     */
    public async openProject(projectUri: vscode.Uri): Promise<void> {
        console.log(`Opening Prompd project: ${projectUri.toString()}`);
        
        try {
            // Parse the project file
            const project = await this.parseProjectFile(projectUri);
            this.currentProject = project;
            
            // Get the project directory (directory containing the .pdproj file)
            const projectDir = vscode.Uri.file(path.dirname(projectUri.fsPath));
            
            // Show notification
            vscode.window.showInformationMessage(`Opening Prompd project: ${project.name}`);
            
            // Open the project directory as a workspace
            await vscode.commands.executeCommand('vscode.openFolder', projectDir, {
                forceNewWindow: false
            });
            
            // After workspace opens, show project information
            setTimeout(() => {
                this.showProjectWelcome(project);
            }, 2000);
            
            console.log(`Successfully opened Prompd project workspace: ${project.name}`);
            
        } catch (error) {
            console.error(`Failed to open Prompd project: ${error}`);
            vscode.window.showErrorMessage(`Failed to open project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    /**
     * Parses a .pdproj file and returns the project configuration
     */
    public async parseProjectFile(projectUri: vscode.Uri): Promise<IPrompdProject> {
        console.log(`Parsing Prompd project file: ${projectUri.toString()}`);
        
        try {
            // Read the project file
            const fileContent = await vscode.workspace.fs.readFile(projectUri);
            const projectText = Buffer.from(fileContent).toString('utf8');
            
            // Parse YAML content
            const projectData = yaml.parse(projectText) as any;
            
            // Validate required fields
            if (!projectData.name) {
                throw new Error('Project file must contain a "name" field');
            }
            if (!projectData.version) {
                throw new Error('Project file must contain a "version" field');
            }
            
            // Convert to IPrompdProject format
            const project: IPrompdProject = {
                name: projectData.name,
                version: projectData.version,
                description: projectData.description,
                author: projectData.author,
                created: projectData.created,
                workflows: projectData.workflows || [],
                advanced_workflows: projectData.advanced_workflows || [],
                flow_workflows: projectData.flow_workflows || [],
                dependencies: projectData.dependencies || {},
                exclusions: projectData.exclusions || {},
                settings: projectData.settings || {},
                ...projectData // Include any additional fields
            };
            
            console.log(`Successfully parsed project: ${project.name} v${project.version}`);
            return project;
            
        } catch (error) {
            console.error(`Failed to parse project file: ${error}`);
            throw new Error(`Failed to parse project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Shows a welcome message with project information
     */
    private async showProjectWelcome(project: IPrompdProject): Promise<void> {
        const workflowCount = (project.workflows?.length || 0) + 
                             (project.advanced_workflows?.length || 0) + 
                             (project.flow_workflows?.length || 0);

        const message = `**${project.name}** v${project.version}\n\n` +
                       `${project.description || 'Prompd Project'}\n\n` +
                       `📋 **${workflowCount} workflows available**\n` +
                       `👤 **Author:** ${project.author || 'Unknown'}\n\n` +
                       `This project workspace is now open in Prompd IDE.`;

        const selection = await vscode.window.showInformationMessage(
            `Welcome to ${project.name}!`,
            { detail: message },
            'Show Workflows',
            'Project Settings',
            'OK'
        );

        if (selection === 'Show Workflows') {
            await this.showWorkflowsQuickPick(project);
        } else if (selection === 'Project Settings') {
            // Open the .pdproj file for editing
            const projectFile = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (projectFile) {
                const pdprojFiles = await vscode.workspace.findFiles('*.pdproj', null, 1);
                if (pdprojFiles.length > 0) {
                    await vscode.window.showTextDocument(pdprojFiles[0]);
                }
            }
        }
    }

    /**
     * Shows available workflows in a quick pick
     */
    private async showWorkflowsQuickPick(project: IPrompdProject): Promise<void> {
        const items: vscode.QuickPickItem[] = [];

        // Add basic workflows
        if (project.workflows) {
            project.workflows.forEach(workflow => {
                items.push({
                    label: `$(symbol-method) ${workflow.name}`,
                    description: workflow.description,
                    detail: `Category: ${workflow.category || 'General'} | File: ${workflow.file}`
                });
            });
        }

        // Add advanced workflows
        if (project.advanced_workflows) {
            project.advanced_workflows.forEach(workflow => {
                items.push({
                    label: `$(rocket) ${workflow.name}`,
                    description: workflow.description,
                    detail: `Advanced | Category: ${workflow.category || 'General'} | File: ${workflow.file}`
                });
            });
        }

        // Add flow workflows
        if (project.flow_workflows) {
            project.flow_workflows.forEach(workflow => {
                items.push({
                    label: `$(type-hierarchy) ${workflow.name}`,
                    description: workflow.description,
                    detail: `Visual Flow | File: ${workflow.file}`
                });
            });
        }

        if (items.length === 0) {
            vscode.window.showInformationMessage('No workflows found in this project.');
            return;
        }

        const selection = await vscode.window.showQuickPick(items, {
            title: `${project.name} - Available Workflows`,
            placeHolder: 'Select a workflow to open'
        });

        if (selection) {
            // Extract filename from detail
            const match = selection.detail?.match(/File: (.+?)(?:\s|$)/);
            if (match) {
                const filename = match[1];
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const filePath = vscode.Uri.joinPath(workspaceFolder.uri, filename);
                    try {
                        await vscode.window.showTextDocument(filePath);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Could not open workflow file: ${filename}`);
                    }
                }
            }
        }
    }

    /**
     * Gets the currently active project (if any)
     */
    public getCurrentProject(): IPrompdProject | undefined {
        return this.currentProject;
    }

    /**
     * Checks if a URI points to a valid Prompd project file
     */
    public isProjectFile(uri: vscode.Uri): boolean {
        return uri.fsPath.toLowerCase().endsWith('.pdproj');
    }
}
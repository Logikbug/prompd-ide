import * as vscode from 'vscode';
import * as path from 'path';
import { PrompdProjectService, IPrompdProject } from './projectService';

/**
 * Tree item for the project explorer
 */
export class ProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri?: vscode.Uri,
        public readonly contextValue?: string,
        public readonly project?: IPrompdProject
    ) {
        super(label, collapsibleState);
        
        if (resourceUri) {
            this.resourceUri = resourceUri;
            this.tooltip = resourceUri.fsPath;
        }
        
        if (contextValue) {
            this.contextValue = contextValue;
        }

        // Set appropriate icons
        if (contextValue === 'project') {
            this.iconPath = new vscode.ThemeIcon('folder-library');
            this.description = project?.version || '';
        } else if (contextValue === 'workflow-folder') {
            this.iconPath = new vscode.ThemeIcon('symbol-misc');
        } else if (contextValue === 'workflow') {
            this.iconPath = new vscode.ThemeIcon('symbol-method');
        } else if (contextValue === 'file') {
            this.iconPath = vscode.ThemeIcon.File;
            this.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [resourceUri]
            };
        } else if (contextValue === 'folder') {
            this.iconPath = vscode.ThemeIcon.Folder;
        }
    }
}

/**
 * Project Explorer Tree Data Provider
 * Shows project name as root with organized file structure
 */
export class ProjectExplorerProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined | null | void> = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectService: PrompdProjectService;
    private currentProject: IPrompdProject | undefined;

    constructor() {
        this.projectService = PrompdProjectService.getInstance();
        this.refresh();
        
        // Watch for workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this.loadProject();
        this._onDidChangeTreeData.fire();
    }

    private async loadProject(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.currentProject = undefined;
            return;
        }

        try {
            // Look for .prompdproj file in workspace
            const prompdprojFiles = await vscode.workspace.findFiles('*.prompdproj', null, 1);
            if (prompdprojFiles.length > 0) {
                this.currentProject = await this.projectService.parseProjectFile(prompdprojFiles[0]);
                console.log(`Loaded project for explorer: ${this.currentProject.name}`);
            } else {
                this.currentProject = undefined;
            }
        } catch (error) {
            console.error('Failed to load project for explorer:', error);
            this.currentProject = undefined;
        }
    }

    getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const workspaceRoot = workspaceFolders[0].uri;

        if (!element) {
            // Root level - show project name or workspace folder name
            if (this.currentProject) {
                return [new ProjectTreeItem(
                    this.currentProject.name,
                    vscode.TreeItemCollapsibleState.Expanded,
                    workspaceRoot,
                    'project',
                    this.currentProject
                )];
            } else {
                return [new ProjectTreeItem(
                    path.basename(workspaceRoot.fsPath),
                    vscode.TreeItemCollapsibleState.Expanded,
                    workspaceRoot,
                    'folder'
                )];
            }
        }

        if (element.contextValue === 'project') {
            // Project level - show organized structure
            const items: ProjectTreeItem[] = [];

            // Add workflows section if available
            if (this.currentProject && this.hasWorkflows(this.currentProject)) {
                items.push(new ProjectTreeItem(
                    'Workflows',
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined,
                    'workflow-folder'
                ));
            }

            // Add files and folders from workspace
            const children = await this.getWorkspaceChildren(workspaceRoot);
            items.push(...children);

            return items;
        }

        if (element.contextValue === 'workflow-folder') {
            // Workflows section - show all available workflows
            if (!this.currentProject) return [];

            const workflows: ProjectTreeItem[] = [];

            // Add basic workflows
            if (this.currentProject.workflows) {
                this.currentProject.workflows.forEach(workflow => {
                    workflows.push(new ProjectTreeItem(
                        `${workflow.name}`,
                        vscode.TreeItemCollapsibleState.None,
                        vscode.Uri.joinPath(workspaceRoot, workflow.file),
                        'workflow'
                    ));
                });
            }

            // Add advanced workflows
            if (this.currentProject.advanced_workflows) {
                this.currentProject.advanced_workflows.forEach(workflow => {
                    workflows.push(new ProjectTreeItem(
                        `${workflow.name} (Advanced)`,
                        vscode.TreeItemCollapsibleState.None,
                        vscode.Uri.joinPath(workspaceRoot, workflow.file),
                        'workflow'
                    ));
                });
            }

            // Add flow workflows
            if (this.currentProject.flow_workflows) {
                this.currentProject.flow_workflows.forEach(workflow => {
                    workflows.push(new ProjectTreeItem(
                        `${workflow.name} (Flow)`,
                        vscode.TreeItemCollapsibleState.None,
                        vscode.Uri.joinPath(workspaceRoot, workflow.file),
                        'workflow'
                    ));
                });
            }

            return workflows;
        }

        if (element.contextValue === 'folder' && element.resourceUri) {
            // Regular folder - show its contents
            return await this.getWorkspaceChildren(element.resourceUri);
        }

        return [];
    }

    private hasWorkflows(project: IPrompdProject): boolean {
        return !!(
            (project.workflows && project.workflows.length > 0) ||
            (project.advanced_workflows && project.advanced_workflows.length > 0) ||
            (project.flow_workflows && project.flow_workflows.length > 0)
        );
    }

    private async getWorkspaceChildren(folderUri: vscode.Uri): Promise<ProjectTreeItem[]> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(folderUri);
            const items: ProjectTreeItem[] = [];

            // Sort entries: directories first, then files
            entries.sort((a, b) => {
                if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory) {
                    return -1;
                }
                if (a[1] !== vscode.FileType.Directory && b[1] === vscode.FileType.Directory) {
                    return 1;
                }
                return a[0].localeCompare(b[0]);
            });

            for (const [name, type] of entries) {
                // Skip hidden files and common ignore patterns
                if (name.startsWith('.') && name !== '.prompdproj') {
                    continue;
                }
                if (this.shouldExclude(name)) {
                    continue;
                }

                const childUri = vscode.Uri.joinPath(folderUri, name);
                
                if (type === vscode.FileType.Directory) {
                    items.push(new ProjectTreeItem(
                        name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        childUri,
                        'folder'
                    ));
                } else {
                    items.push(new ProjectTreeItem(
                        name,
                        vscode.TreeItemCollapsibleState.None,
                        childUri,
                        'file'
                    ));
                }
            }

            return items;
        } catch (error) {
            console.error(`Failed to read directory ${folderUri.fsPath}:`, error);
            return [];
        }
    }

    private shouldExclude(name: string): boolean {
        const excludePatterns = [
            'node_modules',
            '.git',
            '__pycache__',
            '.vscode',
            'dist',
            'build',
            'out',
            '.tmp',
            'coverage'
        ];
        
        return excludePatterns.includes(name) || 
               name.endsWith('.log') || 
               name.endsWith('.tmp') ||
               name.endsWith('.cache');
    }
}
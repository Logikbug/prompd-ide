/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { IWindowOpenable } from 'vs/platform/window/common/window';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';

export const IPrompdProjectService = createDecorator<IPrompdProjectService>('prompdProjectService');

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
 * Interface for project exclusion patterns
 */
export interface IPrompdExclusions {
	directories?: string[];
	patterns?: string[];
	files?: string[];
}

/**
 * Interface for project settings
 */
export interface IPrompdProjectSettings {
	defaults?: {
		provider?: string;
		model?: string;
		temperature?: number;
		max_tokens?: number;
	};
	output?: {
		directory?: string;
		timestamp?: boolean;
		include_metadata?: boolean;
		formats?: string[];
	};
	execution?: {
		parallel_limit?: number;
		timeout_minutes?: number;
		retry_attempts?: number;
		auto_save?: boolean;
	};
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
	exclusions?: IPrompdExclusions;
	settings?: IPrompdProjectSettings;
	
	// Raw project data for extensions
	[key: string]: any;
}

/**
 * Service for handling Prompd project files (.prompdproj)
 * Similar to how Visual Studio handles .sln files
 */
export interface IPrompdProjectService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Opens a Prompd project by parsing the .prompdproj file and opening the workspace
	 */
	openProject(projectUri: URI): Promise<void>;
	
	/**
	 * Parses a .prompdproj file and returns the project configuration
	 */
	parseProjectFile(projectUri: URI): Promise<IPrompdProject>;
	
	/**
	 * Gets the currently active project (if any)
	 */
	getCurrentProject(): IPrompdProject | undefined;
	
	/**
	 * Checks if a URI points to a valid Prompd project file
	 */
	isProjectFile(uri: URI): boolean;
}

export class PrompdProjectService extends Disposable implements IPrompdProjectService {
	declare readonly _serviceBrand: undefined;
	
	private _currentProject: IPrompdProject | undefined;
	
	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IHostService private readonly hostService: IHostService,
		@ILogService private readonly logService: ILogService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();
	}
	
	/**
	 * Simple YAML parser for project files
	 * Handles basic YAML structures needed for .prompdproj files
	 */
	private parseYaml(content: string): any {
		const lines = content.split('\n');
		const result: any = {};
		const stack: any[] = [{ obj: result, indent: -1 }];
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			
			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}
			
			// Calculate indentation
			const indent = line.length - line.trimLeft().length;
			
			// Handle arrays
			if (trimmed.startsWith('- ')) {
				const value = trimmed.substring(2).trim();
				const current = stack[stack.length - 1];
				
				if (!Array.isArray(current.obj)) {
					current.obj = [];
				}
				
				if (value.includes(':')) {
					// Array of objects
					const obj: any = {};
					this.parseKeyValue(value, obj);
					current.obj.push(obj);
				} else {
					// Array of strings
					current.obj.push(this.parseValue(value));
				}
				continue;
			}
			
			// Handle key-value pairs
			if (trimmed.includes(':')) {
				// Adjust stack based on indentation
				while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
					stack.pop();
				}
				
				const current = stack[stack.length - 1];
				const [key, value] = trimmed.split(':', 2);
				const cleanKey = key.trim();
				const cleanValue = value?.trim() || '';
				
				if (cleanValue === '' || cleanValue === '|' || cleanValue === '>') {
					// Object or multiline string
					const newObj: any = {};
					current.obj[cleanKey] = newObj;
					stack.push({ obj: newObj, indent });
				} else {
					// Simple key-value
					current.obj[cleanKey] = this.parseValue(cleanValue);
				}
			}
		}
		
		return result;
	}
	
	private parseKeyValue(line: string, obj: any): void {
		const [key, value] = line.split(':', 2);
		if (key && value !== undefined) {
			obj[key.trim()] = this.parseValue(value.trim());
		}
	}
	
	private parseValue(value: string): any {
		// Remove quotes
		if ((value.startsWith('"') && value.endsWith('"')) || 
			(value.startsWith("'") && value.endsWith("'"))) {
			return value.slice(1, -1);
		}
		
		// Boolean values
		if (value === 'true') return true;
		if (value === 'false') return false;
		
		// Null/undefined
		if (value === 'null' || value === '~' || value === '') return null;
		
		// Numbers
		const num = Number(value);
		if (!isNaN(num) && isFinite(num)) {
			return num;
		}
		
		// Default to string
		return value;
	}
	
	async openProject(projectUri: URI): Promise<void> {
		this.logService.info(`Opening Prompd project: ${projectUri.toString()}`);
		
		try {
			// Parse the project file
			const project = await this.parseProjectFile(projectUri);
			this._currentProject = project;
			
			// Get the project directory (directory containing the .prompdproj file)
			const projectDir = projectUri.with({ path: projectUri.path.substring(0, projectUri.path.lastIndexOf('/')) });
			
			// Create workspace configuration
			const workspaceConfig: IWindowOpenable = {
				workspaceUri: projectDir,
				label: project.name || 'Prompd Project'
			};
			
			// Show notification
			this.notificationService.info(`Opening Prompd project: ${project.name}`);
			
			// Open the project directory as a workspace
			await this.hostService.openWindow([workspaceConfig], {
				forceNewWindow: false,
				forceReuseWindow: true
			});
			
			this.logService.info(`Successfully opened Prompd project workspace: ${project.name}`);
			
		} catch (error) {
			this.logService.error(`Failed to open Prompd project: ${error}`);
			this.notificationService.error(`Failed to open project: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}
	
	async parseProjectFile(projectUri: URI): Promise<IPrompdProject> {
		this.logService.info(`Parsing Prompd project file: ${projectUri.toString()}`);
		
		try {
			// Read the project file
			const fileContent = await this.fileService.readFile(projectUri);
			const projectText = fileContent.value.toString();
			
			// Parse YAML content
			const projectData = this.parseYaml(projectText) as any;
			
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
			
			this.logService.info(`Successfully parsed project: ${project.name} v${project.version}`);
			return project;
			
		} catch (error) {
			this.logService.error(`Failed to parse project file: ${error}`);
			throw new Error(`Failed to parse project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	
	getCurrentProject(): IPrompdProject | undefined {
		return this._currentProject;
	}
	
	isProjectFile(uri: URI): boolean {
		return uri.path.toLowerCase().endsWith('.prompdproj');
	}
	
	override dispose(): void {
		this._currentProject = undefined;
		super.dispose();
	}
}
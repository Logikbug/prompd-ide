/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { IOpener, IOpenerService } from 'vs/platform/opener/common/opener';
import { Disposable } from 'vs/base/common/lifecycle';
import { IPrompdProjectService } from 'vs/workbench/services/prompd/browser/prompdProjectService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * Custom opener that intercepts .prompdproj files and opens them as project workspaces
 * instead of text files (similar to how Visual Studio handles .sln files)
 */
export class PrompdProjectOpener extends Disposable implements IOpener {
	
	constructor(
		@IPrompdProjectService private readonly projectService: IPrompdProjectService,
		@IOpenerService private readonly openerService: IOpenerService
	) {
		super();
		
		// Register this opener with higher priority for .prompdproj files
		this._register(openerService.registerOpener(this));
	}
	
	/**
	 * Checks if this opener can handle the given resource
	 */
	async open(resource: URI): Promise<boolean> {
		// Only handle .prompdproj files
		if (!this.projectService.isProjectFile(resource)) {
			return false;
		}
		
		try {
			// Open as a project workspace instead of a file
			await this.projectService.openProject(resource);
			return true;
		} catch (error) {
			console.error('Failed to open Prompd project:', error);
			// Fall back to default behavior (open as text file)
			return false;
		}
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { EditorAssociation, EditorAssociations, IEditorAssociationsRegistry } from 'vs/workbench/services/editor/common/editorAssociationService';
import { PrompdEditorInput, PrompdFlowEditorInput } from './prompdEditors';
import { URI } from 'vs/base/common/uri';

/**
 * Register file associations for .prompd, .prompdflow, and .prompdproj files
 * .prompdproj files open project workspaces instead of text editors
 */
export function registerPrompdFileAssociations(): void {
	const editorAssociationsRegistry = Registry.as<IEditorAssociationsRegistry>('workbench.editor.editorAssociations');

	// Associate .prompd files with our Prompt Builder
	editorAssociationsRegistry.registerEditorAssociation({
		viewType: 'prompd.promptBuilder',
		filenamePattern: '*.prompd',
		displayName: 'Prompd Builder',
		priority: 'builtin'
	}, (resource: URI) => {
		return new PrompdEditorInput(resource, undefined as any);
	});

	// Associate .prompdflow files with our Flow Canvas
	editorAssociationsRegistry.registerEditorAssociation({
		viewType: 'prompd.flowCanvas', 
		filenamePattern: '*.prompdflow',
		displayName: 'Prompd Flow Canvas',
		priority: 'builtin'
	}, (resource: URI) => {
		return new PrompdFlowEditorInput(resource, undefined as any);
	});

	// .prompdproj files are handled by PrompdProjectOpener to open as workspaces
	// No editor association needed - they are opened as project workspaces instead

	console.log('✅ Prompd file associations registered');
}
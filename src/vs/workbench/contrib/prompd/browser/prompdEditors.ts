/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { EditorInputCapabilities, IEditorInput, IResourceEditorInput } from 'vs/workbench/common/editor';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { URI } from 'vs/base/common/uri';
import { IFileService } from 'vs/platform/files/common/files';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IModelService } from 'vs/editor/common/services/model';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { PrompdBuilder } from './prompdBuilder';
import { PrompdWorkflowEditor } from './prompdWorkflowEditor';
import { IPrompdService } from 'vs/platform/prompd/common/prompd';
import { IPrompdExecutionService } from 'vs/workbench/services/prompd/browser/prompdExecutionService';
import { IPrompdWorkflowExecutionService } from 'vs/workbench/services/prompd/browser/prompdWorkflowExecutionService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as DOM from 'vs/base/browser/dom';

/**
 * Editor input for .prompd files (Prompt Builder)
 */
export class PrompdEditorInput extends Disposable implements IEditorInput {
	static readonly ID = 'prompd.promptBuilderInput';
	
	readonly capabilities = EditorInputCapabilities.CanSplitInGroup;
	
	constructor(
		public readonly resource: URI,
		@IFileService private readonly fileService: IFileService
	) {
		super();
	}

	get typeId(): string {
		return PrompdEditorInput.ID;
	}

	getName(): string {
		return this.resource.path.split('/').pop() || 'Untitled';
	}

	getDescription(): string {
		return 'Prompt Builder';
	}

	getTitle(): string {
		return this.getName();
	}

	matches(otherInput: IEditorInput): boolean {
		return otherInput instanceof PrompdEditorInput && otherInput.resource.toString() === this.resource.toString();
	}

	async resolve(): Promise<any> {
		// Load file content if needed
		return null;
	}
}

/**
 * Editor input for .prompdproj files (Project Editor)
 */
export class PrompdProjectEditorInput extends Disposable implements IEditorInput {
	static readonly ID = 'prompd.projectEditorInput';
	
	readonly capabilities = EditorInputCapabilities.CanSplitInGroup;
	
	constructor(
		public readonly resource: URI,
		@IFileService private readonly fileService: IFileService
	) {
		super();
	}

	get typeId(): string {
		return PrompdProjectEditorInput.ID;
	}

	getName(): string {
		return this.resource.path.split('/').pop() || 'Untitled';
	}

	getDescription(): string {
		return 'Prompd Project';
	}

	getTitle(): string {
		return this.getName();
	}

	matches(otherInput: IEditorInput): boolean {
		return otherInput instanceof PrompdProjectEditorInput && otherInput.resource.toString() === this.resource.toString();
	}

	async resolve(): Promise<any> {
		// Load project content if needed
		return null;
	}
}

/**
 * Editor input for .prompdflow files (Flow Canvas)
 */
export class PrompdFlowEditorInput extends Disposable implements IEditorInput {
	static readonly ID = 'prompd.flowCanvasInput';
	
	readonly capabilities = EditorInputCapabilities.CanSplitInGroup;
	
	constructor(
		public readonly resource: URI,
		@IFileService private readonly fileService: IFileService
	) {
		super();
	}

	get typeId(): string {
		return PrompdFlowEditorInput.ID;
	}

	getName(): string {
		return this.resource.path.split('/').pop() || 'Untitled';
	}

	getDescription(): string {
		return 'Flow Canvas';
	}

	getTitle(): string {
		return this.getName();
	}

	matches(otherInput: IEditorInput): boolean {
		return otherInput instanceof PrompdFlowEditorInput && otherInput.resource.toString() === this.resource.toString();
	}

	async resolve(): Promise<any> {
		// Load flow content if needed
		return null;
	}
}

/**
 * Native Prompt Builder Editor Pane
 */
export class PrompdBuilderPane extends EditorPane {
	static readonly ID = 'prompd.promptBuilderPane';

	private prompdBuilder?: PrompdBuilder;
	private container?: HTMLElement;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IPrompdService private readonly prompdService: IPrompdService,
		@IPrompdExecutionService private readonly executionService: IPrompdExecutionService,
		@IContextViewService private readonly contextViewService: IContextViewService
	) {
		super(PrompdBuilderPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this.container = DOM.append(parent, DOM.$('.prompd-builder-pane'));
		this.container.style.cssText = 'width: 100%; height: 100%; overflow: hidden;';
	}

	async setInput(input: IEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		
		if (input instanceof PrompdEditorInput) {
			// Dispose previous builder
			this.prompdBuilder?.dispose();
			
			// Create new prompt builder instance
			if (this.container) {
				this.container.innerHTML = '';
				this.prompdBuilder = new PrompdBuilder(
					this.container,
					this.themeService,
					this.instantiationService,
					this.prompdService,
					this.executionService,
					this.contextViewService
				);
			}
		}
	}

	layout(dimension: DOM.Dimension): void {
		// Handle layout changes
		if (this.container) {
			this.container.style.width = `${dimension.width}px`;
			this.container.style.height = `${dimension.height}px`;
		}
	}

	dispose(): void {
		this.prompdBuilder?.dispose();
		super.dispose();
	}
}

/**
 * Native Flow Canvas Editor Pane  
 */
export class PrompdFlowCanvasPane extends EditorPane {
	static readonly ID = 'prompd.flowCanvasPane';

	private workflowEditor?: PrompdWorkflowEditor;
	private container?: HTMLElement;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IPrompdService private readonly prompdService: IPrompdService,
		@IPrompdWorkflowExecutionService private readonly workflowExecutionService: IPrompdWorkflowExecutionService
	) {
		super(PrompdFlowCanvasPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this.container = DOM.append(parent, DOM.$('.prompd-flow-canvas-pane'));
		this.container.style.cssText = 'width: 100%; height: 100%; overflow: hidden;';
	}

	async setInput(input: IEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		
		if (input instanceof PrompdFlowEditorInput) {
			// Dispose previous editor
			this.workflowEditor?.dispose();
			
			// Create new workflow editor instance
			if (this.container) {
				this.container.innerHTML = '';
				this.workflowEditor = new PrompdWorkflowEditor(
					'flow-canvas-editor',
					this.group,
					this.telemetryService,
					this.themeService,
					this.storageService,
					this.instantiationService,
					this.prompdService,
					undefined as any, // contextKeyService
					this.workflowExecutionService
				);
				
				this.workflowEditor.create(this.container);
			}
		}
	}

	layout(dimension: DOM.Dimension): void {
		// Handle layout changes
		if (this.container) {
			this.container.style.width = `${dimension.width}px`;
			this.container.style.height = `${dimension.height}px`;
		}
		this.workflowEditor?.layout(dimension);
	}

	dispose(): void {
		this.workflowEditor?.dispose();
		super.dispose();
	}
}

/**
 * Factory for creating .prompd editor inputs
 */
export class PrompdEditorInputFactory {
	static readonly ID = 'prompd.promptBuilderInputFactory';

	canResolve(input: IResourceEditorInput): boolean {
		return input.resource.path.endsWith('.prompd');
	}

	createEditorInput(input: IResourceEditorInput): PrompdEditorInput {
		return new PrompdEditorInput(input.resource, undefined as any);
	}
}

/**
 * Native Project Editor Pane
 */
export class PrompdProjectPane extends EditorPane {
	static readonly ID = 'prompd.projectPane';

	private container?: HTMLElement;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IPrompdService private readonly prompdService: IPrompdService
	) {
		super(PrompdProjectPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this.container = DOM.append(parent, DOM.$('.prompd-project-pane'));
		this.container.style.cssText = 'width: 100%; height: 100%; overflow: auto; padding: 16px;';
		
		// Add project editor UI
		const header = DOM.append(this.container, DOM.$('.project-header'));
		header.innerHTML = '<h2>Prompd Project Configuration</h2>';
		
		const content = DOM.append(this.container, DOM.$('.project-content'));
		content.innerHTML = `
			<div class="project-section">
				<h3>Project Information</h3>
				<p>Edit project metadata, workflows, dependencies, and file exclusions.</p>
			</div>
			<div class="project-section">
				<h3>Exposed Workflows</h3>
				<p>Configure workflows that are exposed to the IDE.</p>
			</div>
			<div class="project-section">
				<h3>Dependencies</h3>
				<p>Manage project dependencies and requirements.</p>
			</div>
			<div class="project-section">
				<h3>File Exclusions</h3>
				<p>Configure files and patterns to exclude from project operations.</p>
			</div>
		`;
	}

	async setInput(input: IEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		
		if (input instanceof PrompdProjectEditorInput) {
			// Load and display project configuration
			console.log('Loading project configuration from:', input.resource.toString());
		}
	}

	layout(dimension: DOM.Dimension): void {
		if (this.container) {
			this.container.style.width = `${dimension.width}px`;
			this.container.style.height = `${dimension.height}px`;
		}
	}
}

/**
 * Factory for creating .prompdflow editor inputs  
 */
export class PrompdFlowEditorInputFactory {
	static readonly ID = 'prompd.flowCanvasInputFactory';

	canResolve(input: IResourceEditorInput): boolean {
		return input.resource.path.endsWith('.prompdflow');
	}

	createEditorInput(input: IResourceEditorInput): PrompdFlowEditorInput {
		return new PrompdFlowEditorInput(input.resource, undefined as any);
	}
}

/**
 * Factory for creating .prompdproj editor inputs  
 */
export class PrompdProjectEditorInputFactory {
	static readonly ID = 'prompd.projectEditorInputFactory';

	canResolve(input: IResourceEditorInput): boolean {
		return input.resource.path.endsWith('.prompdproj');
	}

	createEditorInput(input: IResourceEditorInput): PrompdProjectEditorInput {
		return new PrompdProjectEditorInput(input.resource, undefined as any);
	}
}
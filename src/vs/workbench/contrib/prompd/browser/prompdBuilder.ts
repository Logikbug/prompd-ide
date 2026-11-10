/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IEditorPane } from 'vs/workbench/common/editor';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IPrompdService } from 'vs/platform/prompd/common/prompd';
import { IPrompdExecutionService } from 'vs/workbench/services/prompd/browser/prompdExecutionService';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { createMonacoEditor } from 'vs/editor/browser/widget/codeEditor/codeEditor';
import { Button } from 'vs/base/browser/ui/button/button';
import { attachButtonStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as DOM from 'vs/base/browser/dom';

interface PromptSection {
	type: 'system' | 'user' | 'assistant' | 'context';
	content: string;
	editor?: ICodeEditor;
	container?: HTMLElement;
}

interface PromptParameter {
	name: string;
	type: 'string' | 'number' | 'boolean' | 'array' | 'object';
	value: any;
	description?: string;
	required?: boolean;
}

/**
 * Native Prompt Builder for Prompd IDE
 * Provides a visual interface for building complex prompts with parameters
 */
export class PrompdBuilder extends Disposable {
	private container!: HTMLElement;
	private sections: PromptSection[] = [];
	private parameters: PromptParameter[] = [];
	private sectionsContainer!: HTMLElement;
	private parametersContainer!: HTMLElement;
	private previewContainer!: HTMLElement;
	private toolbarContainer!: HTMLElement;
	
	constructor(
		private readonly parent: HTMLElement,
		@IThemeService private readonly themeService: IThemeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IPrompdService private readonly prompdService: IPrompdService,
		@IPrompdExecutionService private readonly executionService: IPrompdExecutionService,
		@IContextViewService private readonly contextViewService: IContextViewService
	) {
		super();
		this.create();
	}

	private create(): void {
		this.container = DOM.append(this.parent, DOM.$('.prompd-builder'));
		this.container.style.cssText = `
			width: 100%;
			height: 100%;
			display: grid;
			grid-template-columns: 1fr 300px;
			grid-template-rows: auto 1fr auto;
			gap: 1px;
			background: var(--vscode-panel-border);
		`;

		// Create toolbar
		this.createToolbar();
		
		// Create main sections area
		this.createSectionsArea();
		
		// Create parameters panel
		this.createParametersPanel();
		
		// Create preview area
		this.createPreviewArea();
		
		// Initialize with default sections
		this.initializeDefaultSections();
	}

	private createToolbar(): void {
		this.toolbarContainer = DOM.append(this.container, DOM.$('.prompd-builder-toolbar'));
		this.toolbarContainer.style.cssText = `
			grid-column: 1 / -1;
			padding: 8px;
			background: var(--vscode-editor-background);
			border-bottom: 1px solid var(--vscode-panel-border);
			display: flex;
			gap: 8px;
			align-items: center;
		`;

		// Add section buttons
		const addSectionBtn = this.createToolbarButton('➕ Add Section', () => this.showAddSectionMenu());
		const addParamBtn = this.createToolbarButton('🔧 Add Parameter', () => this.addParameter());
		const clearBtn = this.createToolbarButton('🗑️ Clear All', () => this.clearAll());
		const saveBtn = this.createToolbarButton('💾 Save Template', () => this.saveTemplate());
		const loadBtn = this.createToolbarButton('📁 Load Template', () => this.loadTemplate());
		const executeBtn = this.createToolbarButton('▶️ Execute', () => this.executePrompt());
		
		// Template selector
		const templateLabel = DOM.append(this.toolbarContainer, DOM.$('label'));
		templateLabel.textContent = 'Template:';
		templateLabel.style.marginLeft = 'auto';
		
		const templates = ['Blank', 'Q&A', 'Code Generation', 'Analysis', 'Creative Writing'];
		const templateSelect = new SelectBox(templates, 0, this.contextViewService);
		templateSelect.render(this.toolbarContainer);
		attachSelectBoxStyler(templateSelect, this.themeService);
		
		templateSelect.onDidSelect(e => {
			this.loadPredefinedTemplate(templates[e.index]);
		});
	}

	private createToolbarButton(label: string, onClick: () => void): Button {
		const button = new Button(this.toolbarContainer);
		button.label = label;
		button.onDidClick(onClick);
		attachButtonStyler(button, this.themeService);
		return button;
	}

	private createSectionsArea(): void {
		this.sectionsContainer = DOM.append(this.container, DOM.$('.prompd-builder-sections'));
		this.sectionsContainer.style.cssText = `
			grid-column: 1;
			grid-row: 2;
			padding: 12px;
			background: var(--vscode-editor-background);
			overflow-y: auto;
		`;
	}

	private createParametersPanel(): void {
		this.parametersContainer = DOM.append(this.container, DOM.$('.prompd-builder-parameters'));
		this.parametersContainer.style.cssText = `
			grid-column: 2;
			grid-row: 2;
			padding: 12px;
			background: var(--vscode-sideBar-background);
			border-left: 1px solid var(--vscode-panel-border);
			overflow-y: auto;
		`;

		const title = DOM.append(this.parametersContainer, DOM.$('h3'));
		title.textContent = 'Parameters';
		title.style.cssText = `
			margin: 0 0 12px 0;
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-foreground);
		`;
	}

	private createPreviewArea(): void {
		this.previewContainer = DOM.append(this.container, DOM.$('.prompd-builder-preview'));
		this.previewContainer.style.cssText = `
			grid-column: 1 / -1;
			grid-row: 3;
			padding: 12px;
			background: var(--vscode-editor-background);
			border-top: 1px solid var(--vscode-panel-border);
			max-height: 200px;
			overflow-y: auto;
		`;

		const title = DOM.append(this.previewContainer, DOM.$('h4'));
		title.textContent = 'Preview';
		title.style.cssText = `
			margin: 0 0 8px 0;
			font-size: 12px;
			font-weight: 600;
			color: var(--vscode-descriptionForeground);
		`;

		const preview = DOM.append(this.previewContainer, DOM.$('.preview-content'));
		preview.style.cssText = `
			padding: 8px;
			background: var(--vscode-textBlockQuote-background);
			border: 1px solid var(--vscode-textBlockQuote-border);
			border-radius: 4px;
			white-space: pre-wrap;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
		`;
	}

	private initializeDefaultSections(): void {
		// Add default system prompt section
		this.addSection('system', 'You are a helpful AI assistant. You provide clear, accurate, and helpful responses.');
		
		// Add default user prompt section
		this.addSection('user', '{{user_input}}');
		
		// Update preview
		this.updatePreview();
	}

	private addSection(type: 'system' | 'user' | 'assistant' | 'context', content: string = ''): void {
		const section: PromptSection = { type, content };
		
		// Create section container
		const sectionDiv = DOM.append(this.sectionsContainer, DOM.$('.prompt-section'));
		sectionDiv.style.cssText = `
			margin-bottom: 16px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			overflow: hidden;
		`;
		section.container = sectionDiv;

		// Section header
		const header = DOM.append(sectionDiv, DOM.$('.section-header'));
		header.style.cssText = `
			padding: 8px;
			background: var(--vscode-list-hoverBackground);
			display: flex;
			justify-content: space-between;
			align-items: center;
			cursor: move;
		`;

		const typeLabel = DOM.append(header, DOM.$('span'));
		typeLabel.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Prompt';
		typeLabel.style.cssText = `
			font-weight: 600;
			color: var(--vscode-foreground);
		`;

		// Section controls
		const controls = DOM.append(header, DOM.$('.section-controls'));
		controls.style.cssText = 'display: flex; gap: 4px;';

		const deleteBtn = DOM.append(controls, DOM.$('button'));
		deleteBtn.textContent = '❌';
		deleteBtn.title = 'Delete Section';
		deleteBtn.style.cssText = `
			background: none;
			border: none;
			cursor: pointer;
			padding: 2px 6px;
			color: var(--vscode-errorForeground);
		`;
		deleteBtn.onclick = () => this.removeSection(section);

		// Create Monaco editor for section content
		const editorContainer = DOM.append(sectionDiv, DOM.$('.section-editor'));
		editorContainer.style.cssText = 'height: 150px;';

		// Create a simple textarea for now (Monaco editor would be more complex to instantiate)
		const textarea = DOM.append(editorContainer, DOM.$('textarea')) as HTMLTextAreaElement;
		textarea.value = content;
		textarea.style.cssText = `
			width: 100%;
			height: 100%;
			padding: 8px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: none;
			resize: vertical;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
		`;
		
		textarea.oninput = () => {
			section.content = textarea.value;
			this.updatePreview();
		};

		this.sections.push(section);
		this.updatePreview();
	}

	private removeSection(section: PromptSection): void {
		const index = this.sections.indexOf(section);
		if (index > -1) {
			this.sections.splice(index, 1);
			section.container?.remove();
			section.editor?.dispose();
			this.updatePreview();
		}
	}

	private addParameter(): void {
		const param: PromptParameter = {
			name: `param_${this.parameters.length + 1}`,
			type: 'string',
			value: '',
			description: 'Parameter description',
			required: false
		};

		// Create parameter UI
		const paramDiv = DOM.append(this.parametersContainer, DOM.$('.parameter-item'));
		paramDiv.style.cssText = `
			margin-bottom: 12px;
			padding: 8px;
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
		`;

		// Parameter name
		const nameInput = DOM.append(paramDiv, DOM.$('input')) as HTMLInputElement;
		nameInput.type = 'text';
		nameInput.value = param.name;
		nameInput.placeholder = 'Parameter name';
		nameInput.style.cssText = `
			width: 100%;
			margin-bottom: 4px;
			padding: 4px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
		`;
		nameInput.oninput = () => {
			param.name = nameInput.value;
			this.updatePreview();
		};

		// Parameter type
		const typeSelect = DOM.append(paramDiv, DOM.$('select')) as HTMLSelectElement;
		['string', 'number', 'boolean', 'array', 'object'].forEach(t => {
			const option = DOM.append(typeSelect, DOM.$('option')) as HTMLOptionElement;
			option.value = t;
			option.textContent = t;
		});
		typeSelect.value = param.type;
		typeSelect.style.cssText = `
			width: 100%;
			margin-bottom: 4px;
			padding: 4px;
			background: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
		`;
		typeSelect.onchange = () => {
			param.type = typeSelect.value as any;
			this.updatePreview();
		};

		// Parameter value
		const valueInput = DOM.append(paramDiv, DOM.$('input')) as HTMLInputElement;
		valueInput.type = 'text';
		valueInput.placeholder = 'Default value';
		valueInput.style.cssText = `
			width: 100%;
			margin-bottom: 4px;
			padding: 4px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
		`;
		valueInput.oninput = () => {
			param.value = valueInput.value;
			this.updatePreview();
		};

		// Delete button
		const deleteBtn = DOM.append(paramDiv, DOM.$('button'));
		deleteBtn.textContent = 'Remove';
		deleteBtn.style.cssText = `
			width: 100%;
			padding: 4px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 2px;
			cursor: pointer;
		`;
		deleteBtn.onclick = () => {
			const idx = this.parameters.indexOf(param);
			if (idx > -1) {
				this.parameters.splice(idx, 1);
				paramDiv.remove();
				this.updatePreview();
			}
		};

		this.parameters.push(param);
		this.updatePreview();
	}

	private updatePreview(): void {
		const previewContent = this.previewContainer.querySelector('.preview-content');
		if (!previewContent) return;

		let prompt = '';
		
		// Build prompt from sections
		this.sections.forEach(section => {
			if (section.content) {
				prompt += `[${section.type.toUpperCase()}]\n${section.content}\n\n`;
			}
		});

		// Replace parameters
		this.parameters.forEach(param => {
			const regex = new RegExp(`\\{\\{${param.name}\\}\\}`, 'g');
			prompt = prompt.replace(regex, param.value || `<${param.name}>`);
		});

		previewContent.textContent = prompt.trim() || 'No content yet. Add sections to build your prompt.';
	}

	private showAddSectionMenu(): void {
		// Simple implementation - in production would use context menu
		const types: Array<'system' | 'user' | 'assistant' | 'context'> = ['system', 'user', 'assistant', 'context'];
		const selected = prompt('Enter section type (system/user/assistant/context):') as any;
		if (types.includes(selected)) {
			this.addSection(selected);
		}
	}

	private clearAll(): void {
		if (confirm('Clear all sections and parameters?')) {
			this.sections = [];
			this.parameters = [];
			this.sectionsContainer.innerHTML = '';
			const title = this.parametersContainer.querySelector('h3');
			this.parametersContainer.innerHTML = '';
			if (title) this.parametersContainer.appendChild(title);
			this.updatePreview();
		}
	}

	private async saveTemplate(): Promise<void> {
		const template = {
			sections: this.sections.map(s => ({ type: s.type, content: s.content })),
			parameters: this.parameters
		};
		
		// In production, would use file dialog
		const name = prompt('Template name:');
		if (name) {
			localStorage.setItem(`prompd_template_${name}`, JSON.stringify(template));
			alert(`Template "${name}" saved!`);
		}
	}

	private async loadTemplate(): Promise<void> {
		// In production, would use file dialog
		const name = prompt('Template name to load:');
		if (name) {
			const saved = localStorage.getItem(`prompd_template_${name}`);
			if (saved) {
				const template = JSON.parse(saved);
				this.clearAll();
				template.sections?.forEach((s: any) => this.addSection(s.type, s.content));
				// Parameters would need more complex restoration
				alert(`Template "${name}" loaded!`);
			}
		}
	}

	private loadPredefinedTemplate(templateName: string): void {
		this.clearAll();
		
		switch (templateName) {
			case 'Q&A':
				this.addSection('system', 'You are a knowledgeable assistant. Answer questions accurately and concisely.');
				this.addSection('user', '{{question}}');
				break;
			
			case 'Code Generation':
				this.addSection('system', 'You are an expert programmer. Generate clean, efficient, and well-documented code.');
				this.addSection('user', 'Language: {{language}}\nTask: {{task}}\nRequirements: {{requirements}}');
				break;
			
			case 'Analysis':
				this.addSection('system', 'You are an analytical assistant. Provide thorough analysis with clear insights.');
				this.addSection('context', '{{context}}');
				this.addSection('user', 'Analyze the following: {{input}}');
				break;
			
			case 'Creative Writing':
				this.addSection('system', 'You are a creative writer. Generate engaging and original content.');
				this.addSection('user', 'Style: {{style}}\nTopic: {{topic}}\nTone: {{tone}}');
				break;
			
			default:
				this.initializeDefaultSections();
		}
	}

	private async executePrompt(): Promise<void> {
		// Get the compiled prompt
		const previewContent = this.previewContainer.querySelector('.preview-content');
		const prompt = previewContent?.textContent || '';
		
		if (!prompt || prompt === 'No content yet. Add sections to build your prompt.') {
			alert('Please build a prompt first');
			return;
		}

		// Get first available provider
		const providers = this.executionService.getProviders();
		if (providers.length === 0) {
			alert('No execution providers available');
			return;
		}

		try {
			const result = await this.executionService.executePrompt(prompt, providers[0], {
				temperature: 0.7,
				maxTokens: 2048
			});
			
			// Show result in a simple dialog (in production would be better UI)
			alert(`Execution Result:\n\n${result.response}\n\nTokens: ${result.tokensUsed.total}\nTime: ${result.executionTime}ms`);
		} catch (error: any) {
			alert(`Execution failed: ${error.message}`);
		}
	}

	public getPrompt(): string {
		const previewContent = this.previewContainer.querySelector('.preview-content');
		return previewContent?.textContent || '';
	}

	public setPrompt(sections: PromptSection[], parameters: PromptParameter[]): void {
		this.clearAll();
		sections.forEach(s => this.addSection(s.type, s.content));
		parameters.forEach(p => this.parameters.push(p));
		this.updatePreview();
	}
}
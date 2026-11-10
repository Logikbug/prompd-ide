/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IPrompdExecutionService } from 'vs/workbench/services/prompd/browser/prompdExecutionService';
import { Button } from 'vs/base/browser/ui/button/button';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import * as DOM from 'vs/base/browser/dom';

interface NodeConfiguration {
	id: string;
	type: string;
	label: string;
	config: Record<string, any>;
}

/**
 * Node Configuration Dialog System
 * Provides specialized configuration interfaces for different node types
 */
export class NodeConfigurationManager extends Disposable {
	private overlay?: HTMLElement;
	private modal?: HTMLElement;
	private currentNode?: NodeConfiguration;
	private onConfigurationComplete?: (config: NodeConfiguration) => void;

	constructor(
		private readonly parent: HTMLElement,
		@IThemeService private readonly themeService: IThemeService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IPrompdExecutionService private readonly executionService: IPrompdExecutionService
	) {
		super();
	}

	/**
	 * Show configuration dialog for a specific node
	 */
	public configureNode(
		node: NodeConfiguration,
		onComplete: (config: NodeConfiguration) => void
	): void {
		this.currentNode = { ...node };
		this.onConfigurationComplete = onComplete;
		this.showConfigurationModal();
	}

	private showConfigurationModal(): void {
		if (!this.currentNode) return;

		// Create overlay
		this.overlay = DOM.append(this.parent, DOM.$('.node-config-overlay'));
		this.overlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 10000;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		// Create modal
		this.modal = DOM.append(this.overlay, DOM.$('.node-config-modal'));
		this.modal.style.cssText = `
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
			min-width: 600px;
			max-width: 800px;
			max-height: 80vh;
			overflow: auto;
		`;

		// Prevent closing when clicking on modal content
		this.modal.onclick = (e) => e.stopPropagation();
		
		// Close when clicking overlay
		this.overlay.onclick = () => this.closeModal();

		// Render configuration based on node type
		this.renderNodeConfiguration();
	}

	private renderNodeConfiguration(): void {
		if (!this.modal || !this.currentNode) return;

		// Clear existing content
		this.modal.innerHTML = '';

		// Header
		const header = DOM.append(this.modal, DOM.$('.config-header'));
		header.style.cssText = `
			padding: 20px;
			border-bottom: 1px solid var(--vscode-panel-border);
		`;

		const title = DOM.append(header, DOM.$('h2'));
		title.textContent = `Configure ${this.currentNode.type.charAt(0).toUpperCase() + this.currentNode.type.slice(1)} Node`;
		title.style.cssText = `
			margin: 0;
			color: var(--vscode-foreground);
			font-size: 18px;
		`;

		// Content area
		const content = DOM.append(this.modal, DOM.$('.config-content'));
		content.style.cssText = `
			padding: 20px;
		`;

		// Render specific configuration based on node type
		switch (this.currentNode.type) {
			case 'prompt':
				this.renderPromptNodeConfig(content);
				break;
			case 'llm':
				this.renderLLMNodeConfig(content);
				break;
			case 'transform':
				this.renderTransformNodeConfig(content);
				break;
			case 'condition':
				this.renderConditionNodeConfig(content);
				break;
			case 'api':
				this.renderAPINodeConfig(content);
				break;
			case 'parameters':
				this.renderParametersNodeConfig(content);
				break;
			default:
				this.renderGenericNodeConfig(content);
		}

		// Footer with action buttons
		this.renderFooter();
	}

	private renderPromptNodeConfig(container: HTMLElement): void {
		// Node Label
		this.createFormField(container, 'Label', 'text', this.currentNode!.label, (value) => {
			this.currentNode!.label = value;
		});

		// Prompt Template
		this.createFormField(container, 'Prompt Template', 'textarea', this.currentNode!.config.prompt || '', (value) => {
			this.currentNode!.config.prompt = value;
		}, 'Enter your prompt template. Use {{variableName}} for parameters.');

		// System Prompt
		this.createFormField(container, 'System Prompt (Optional)', 'textarea', this.currentNode!.config.systemPrompt || '', (value) => {
			this.currentNode!.config.systemPrompt = value;
		}, 'System instructions for the AI model.');

		// Examples
		const examplesContainer = this.createSection(container, 'Examples (Optional)');
		const examples = this.currentNode!.config.examples || [];
		
		examples.forEach((example: any, index: number) => {
			const exampleDiv = DOM.append(examplesContainer, DOM.$('.example-pair'));
			exampleDiv.style.cssText = `
				margin-bottom: 12px;
				padding: 12px;
				border: 1px solid var(--vscode-input-border);
				border-radius: 4px;
			`;

			this.createFormField(exampleDiv, `Example ${index + 1} - Input`, 'text', example.input, (value) => {
				examples[index].input = value;
			});

			this.createFormField(exampleDiv, `Example ${index + 1} - Output`, 'text', example.output, (value) => {
				examples[index].output = value;
			});
		});

		// Add example button
		const addExampleBtn = new Button(examplesContainer);
		addExampleBtn.label = '+ Add Example';
		attachButtonStyler(addExampleBtn, this.themeService);
		addExampleBtn.onDidClick(() => {
			examples.push({ input: '', output: '' });
			this.currentNode!.config.examples = examples;
			this.renderNodeConfiguration(); // Re-render to show new example
		});
	}

	private renderLLMNodeConfig(container: HTMLElement): void {
		// Node Label
		this.createFormField(container, 'Label', 'text', this.currentNode!.label, (value) => {
			this.currentNode!.label = value;
		});

		// Provider Selection
		const providers = this.executionService.getProviders();
		const providerOptions = providers.map(p => ({ value: p.id, label: p.name }));
		this.createDropdown(container, 'AI Provider', providerOptions, this.currentNode!.config.provider || 'openai', (value) => {
			this.currentNode!.config.provider = value;
			// Re-render to update model options
			this.renderNodeConfiguration();
		});

		// Model Selection (based on selected provider)
		const selectedProvider = providers.find(p => p.id === this.currentNode!.config.provider);
		if (selectedProvider) {
			const modelOptions = selectedProvider.models.map(m => ({ value: m.id, label: m.name }));
			this.createDropdown(container, 'Model', modelOptions, this.currentNode!.config.model || modelOptions[0]?.value, (value) => {
				this.currentNode!.config.model = value;
			});
		}

		// Temperature
		this.createFormField(container, 'Temperature', 'number', this.currentNode!.config.temperature || 0.7, (value) => {
			this.currentNode!.config.temperature = parseFloat(value);
		}, 'Controls randomness (0.0 - 2.0)', { min: 0, max: 2, step: 0.1 });

		// Max Tokens
		this.createFormField(container, 'Max Tokens', 'number', this.currentNode!.config.maxTokens || 2048, (value) => {
			this.currentNode!.config.maxTokens = parseInt(value);
		}, 'Maximum response length', { min: 1, max: 32000 });
	}

	private renderTransformNodeConfig(container: HTMLElement): void {
		// Node Label
		this.createFormField(container, 'Label', 'text', this.currentNode!.label, (value) => {
			this.currentNode!.label = value;
		});

		// Transform Type
		const transformTypes = [
			{ value: 'javascript', label: 'JavaScript Function' },
			{ value: 'regex', label: 'Regular Expression' },
			{ value: 'template', label: 'Template Substitution' },
			{ value: 'json-extract', label: 'JSON Path Extraction' },
			{ value: 'text-cleanup', label: 'Text Cleanup' }
		];

		this.createDropdown(container, 'Transform Type', transformTypes, this.currentNode!.config.transformType || 'javascript', (value) => {
			this.currentNode!.config.transformType = value;
		});

		// Transform Code/Pattern
		const label = this.currentNode!.config.transformType === 'regex' ? 'Regular Expression Pattern' : 
					  this.currentNode!.config.transformType === 'template' ? 'Template' :
					  this.currentNode!.config.transformType === 'json-extract' ? 'JSONPath Expression' :
					  'JavaScript Function';

		this.createFormField(container, label, 'textarea', this.currentNode!.config.transform || '', (value) => {
			this.currentNode!.config.transform = value;
		}, this.getTransformPlaceholder());
	}

	private renderConditionNodeConfig(container: HTMLElement): void {
		// Node Label
		this.createFormField(container, 'Label', 'text', this.currentNode!.label, (value) => {
			this.currentNode!.label = value;
		});

		// Condition Type
		const conditionTypes = [
			{ value: 'javascript', label: 'JavaScript Expression' },
			{ value: 'contains', label: 'Contains Text' },
			{ value: 'regex', label: 'Regular Expression Match' },
			{ value: 'equals', label: 'Equals Value' },
			{ value: 'length', label: 'Length Comparison' }
		];

		this.createDropdown(container, 'Condition Type', conditionTypes, this.currentNode!.config.conditionType || 'javascript', (value) => {
			this.currentNode!.config.conditionType = value;
		});

		// Condition Expression
		this.createFormField(container, 'Condition', 'textarea', this.currentNode!.config.condition || '', (value) => {
			this.currentNode!.config.condition = value;
		}, 'Expression that evaluates to true/false');
	}

	private renderAPINodeConfig(container: HTMLElement): void {
		// Node Label
		this.createFormField(container, 'Label', 'text', this.currentNode!.label, (value) => {
			this.currentNode!.label = value;
		});

		// HTTP Method
		const methods = [
			{ value: 'GET', label: 'GET' },
			{ value: 'POST', label: 'POST' },
			{ value: 'PUT', label: 'PUT' },
			{ value: 'DELETE', label: 'DELETE' }
		];

		this.createDropdown(container, 'HTTP Method', methods, this.currentNode!.config.method || 'POST', (value) => {
			this.currentNode!.config.method = value;
		});

		// Endpoint URL
		this.createFormField(container, 'Endpoint URL', 'text', this.currentNode!.config.endpoint || '', (value) => {
			this.currentNode!.config.endpoint = value;
		}, 'https://api.example.com/endpoint');

		// Headers
		this.createFormField(container, 'Headers (JSON)', 'textarea', 
			JSON.stringify(this.currentNode!.config.headers || {}, null, 2), (value) => {
			try {
				this.currentNode!.config.headers = JSON.parse(value);
			} catch (e) {
				console.warn('Invalid JSON in headers:', e);
			}
		}, '{"Content-Type": "application/json", "Authorization": "Bearer {{token}}"}');

		// Request Body (for POST/PUT)
		if (['POST', 'PUT'].includes(this.currentNode!.config.method)) {
			this.createFormField(container, 'Request Body (JSON)', 'textarea', 
				JSON.stringify(this.currentNode!.config.body || {}, null, 2), (value) => {
				try {
					this.currentNode!.config.body = JSON.parse(value);
				} catch (e) {
					console.warn('Invalid JSON in request body:', e);
				}
			}, '{"data": "{{input}}", "options": {...}}');
		}
	}

	private renderParametersNodeConfig(container: HTMLElement): void {
		// Node Label
		this.createFormField(container, 'Label', 'text', this.currentNode!.label, (value) => {
			this.currentNode!.label = value;
		});

		// Parameters JSON
		this.createFormField(container, 'Parameters (JSON)', 'textarea', 
			JSON.stringify(this.currentNode!.config.parameters || {}, null, 2), (value) => {
			try {
				this.currentNode!.config.parameters = JSON.parse(value);
			} catch (e) {
				console.warn('Invalid JSON in parameters:', e);
			}
		}, '{"userName": "John", "maxResults": 10, "includeDetails": true}');
	}

	private renderGenericNodeConfig(container: HTMLElement): void {
		// Node Label
		this.createFormField(container, 'Label', 'text', this.currentNode!.label, (value) => {
			this.currentNode!.label = value;
		});

		// Generic configuration as JSON
		this.createFormField(container, 'Configuration (JSON)', 'textarea', 
			JSON.stringify(this.currentNode!.config, null, 2), (value) => {
			try {
				this.currentNode!.config = JSON.parse(value);
			} catch (e) {
				console.warn('Invalid JSON in configuration:', e);
			}
		}, 'Node-specific configuration as JSON object');
	}

	private createFormField(
		container: HTMLElement, 
		label: string, 
		type: string, 
		value: any, 
		onChange: (value: string) => void,
		placeholder?: string,
		attrs?: Record<string, any>
	): void {
		const fieldDiv = DOM.append(container, DOM.$('.form-field'));
		fieldDiv.style.cssText = `margin-bottom: 16px;`;

		const labelEl = DOM.append(fieldDiv, DOM.$('label'));
		labelEl.textContent = label;
		labelEl.style.cssText = `
			display: block;
			margin-bottom: 4px;
			font-weight: 600;
			color: var(--vscode-foreground);
		`;

		let input: HTMLInputElement | HTMLTextAreaElement;
		if (type === 'textarea') {
			input = DOM.append(fieldDiv, DOM.$('textarea')) as HTMLTextAreaElement;
			input.rows = 4;
		} else {
			input = DOM.append(fieldDiv, DOM.$('input')) as HTMLInputElement;
			input.type = type;
		}

		input.value = value?.toString() || '';
		input.placeholder = placeholder || '';
		input.style.cssText = `
			width: 100%;
			padding: 8px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			font-family: var(--vscode-font-family);
		`;

		// Apply additional attributes
		if (attrs) {
			Object.entries(attrs).forEach(([key, val]) => {
				(input as any)[key] = val;
			});
		}

		input.oninput = () => onChange(input.value);
	}

	private createDropdown(
		container: HTMLElement,
		label: string,
		options: Array<{ value: string; label: string }>,
		value: string,
		onChange: (value: string) => void
	): void {
		const fieldDiv = DOM.append(container, DOM.$('.form-field'));
		fieldDiv.style.cssText = `margin-bottom: 16px;`;

		const labelEl = DOM.append(fieldDiv, DOM.$('label'));
		labelEl.textContent = label;
		labelEl.style.cssText = `
			display: block;
			margin-bottom: 4px;
			font-weight: 600;
			color: var(--vscode-foreground);
		`;

		const select = DOM.append(fieldDiv, DOM.$('select')) as HTMLSelectElement;
		select.style.cssText = `
			width: 100%;
			padding: 8px;
			background: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
			border-radius: 4px;
		`;

		options.forEach(option => {
			const optionEl = DOM.append(select, DOM.$('option')) as HTMLOptionElement;
			optionEl.value = option.value;
			optionEl.textContent = option.label;
		});

		select.value = value;
		select.onchange = () => onChange(select.value);
	}

	private createSection(container: HTMLElement, title: string): HTMLElement {
		const section = DOM.append(container, DOM.$('.config-section'));
		section.style.cssText = `margin-bottom: 20px;`;

		const titleEl = DOM.append(section, DOM.$('h3'));
		titleEl.textContent = title;
		titleEl.style.cssText = `
			margin: 0 0 12px 0;
			color: var(--vscode-foreground);
			font-size: 14px;
			font-weight: 600;
		`;

		return section;
	}

	private renderFooter(): void {
		if (!this.modal) return;

		const footer = DOM.append(this.modal, DOM.$('.config-footer'));
		footer.style.cssText = `
			padding: 20px;
			border-top: 1px solid var(--vscode-panel-border);
			display: flex;
			justify-content: flex-end;
			gap: 12px;
		`;

		// Cancel button
		const cancelBtn = new Button(footer);
		cancelBtn.label = 'Cancel';
		attachButtonStyler(cancelBtn, this.themeService);
		cancelBtn.onDidClick(() => this.closeModal());

		// Save button
		const saveBtn = new Button(footer);
		saveBtn.label = 'Save Configuration';
		attachButtonStyler(saveBtn, this.themeService);
		saveBtn.onDidClick(() => this.saveConfiguration());
	}

	private saveConfiguration(): void {
		if (this.currentNode && this.onConfigurationComplete) {
			this.onConfigurationComplete(this.currentNode);
		}
		this.closeModal();
	}

	private closeModal(): void {
		if (this.overlay) {
			this.overlay.remove();
			this.overlay = undefined;
			this.modal = undefined;
		}
	}

	private getTransformPlaceholder(): string {
		const type = this.currentNode!.config.transformType;
		switch (type) {
			case 'javascript':
				return 'function transform(input) {\n  // Process the input\n  return input.toUpperCase();\n}';
			case 'regex':
				return '/pattern/flags - e.g., /\\d+/g to extract numbers';
			case 'template':
				return 'Hello {{name}}, your score is {{score}}';
			case 'json-extract':
				return '$.data.results[*].name - JSONPath expression';
			default:
				return 'Enter transformation logic...';
		}
	}

	dispose(): void {
		this.closeModal();
		super.dispose();
	}
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IPrompdService } from 'vs/platform/prompd/common/prompd';
import { PrompdService } from 'vs/workbench/services/prompd/browser/prompdService';
import { IPrompdExecutionService, PrompdExecutionService } from 'vs/workbench/services/prompd/browser/prompdExecutionService';
import { IPrompdWorkflowExecutionService, PrompdWorkflowExecutionService } from 'vs/workbench/services/prompd/browser/prompdWorkflowExecutionService';
import { IPrompdProjectService, PrompdProjectService } from 'vs/workbench/services/prompd/browser/prompdProjectService';
import { PrompdWorkflowEditor } from './prompdWorkflowEditor';
import { PROMPD_LANGUAGE_ID, PROMPDFLOW_LANGUAGE_ID, prompdLanguageConfig, prompdflowLanguageConfig, prompdMonarchLanguage } from '../common/prompdLanguage';
import { registerPrompdCommands, registerPrompdMenus, registerPrompdKeybindings } from './prompdCommands';
import { PrompdBuilderPane, PrompdFlowCanvasPane, PrompdEditorInputFactory, PrompdFlowEditorInputFactory, PrompdEditorInput, PrompdFlowEditorInput } from './prompdEditors';
import { PrompdProjectOpener } from './prompdProjectOpener';
import * as monaco from 'vs/editor/editor.api';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ViewContainer, IViewContainersRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions, IViewsService } from 'vs/workbench/common/views';
import { Codicon } from 'vs/base/common/codicons';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Disposable } from 'vs/base/common/lifecycle';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions, EditorInputWithOptions, IEditorInputFactoryRegistry, IEditorResolverService } from 'vs/workbench/common/editor';
import { registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IFileService } from 'vs/platform/files/common/files';

// Register the prompd services
registerSingleton(IPrompdService, PrompdService, true);
registerSingleton(IPrompdExecutionService, PrompdExecutionService, true);
registerSingleton(IPrompdWorkflowExecutionService, PrompdWorkflowExecutionService, true);
registerSingleton(IPrompdProjectService, PrompdProjectService, true);

// Create view container for Prompd
const PROMPD_CONTAINER_ID = 'workbench.view.prompd';

const prompdViewContainer: ViewContainer = {
	id: PROMPD_CONTAINER_ID,
	title: { value: localize('prompd', 'Prompd'), original: 'Prompd' },
	icon: Codicon.robot,
	order: 100,
	ctorDescriptor: new SyncDescriptor(PrompdViewContainer)
};

// Register view container
Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
	.registerViewContainer(prompdViewContainer, ViewContainerLocation.Sidebar);

class PrompdViewContainer extends Disposable {
	constructor() {
		super();
		// Initialize prompd view container
	}
}

// Prompd workbench contribution
class PrompdWorkbenchContribution extends Disposable implements IWorkbenchContribution {
	
	private projectOpener: PrompdProjectOpener;
	
	constructor(
		@IPrompdService private readonly prompdService: IPrompdService,
		@IViewsService private readonly viewsService: IViewsService,
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IPrompdProjectService private readonly projectService: IPrompdProjectService
	) {
		super();
		
		// Initialize project opener to handle .prompdproj files
		this.projectOpener = this._register(this.instantiationService.createInstance(PrompdProjectOpener));
		
		this.initializePrompd();
	}

	private initializePrompd(): void {
		// Initialize prompd workbench integration
		console.log('Prompd workbench contribution initialized');
		
		// Register prompd languages
		this.registerPrompdLanguages();
		
		// Register native commands, menus, and keybindings
		registerPrompdCommands();
		registerPrompdMenus();
		registerPrompdKeybindings();
		
		// Register editor resolvers for .prompd and .prompdflow files
		this.registerEditorResolvers();
		
		// Create default views for prompd container
		this.registerPrompdViews();
	}
	
	private registerPrompdLanguages(): void {
		// Register .prompd language
		monaco.languages.register({
			id: PROMPD_LANGUAGE_ID,
			extensions: ['.prompd'],
			aliases: ['Prompd', 'prompd'],
			mimetypes: ['text/x-prompd', 'application/x-prompd']
		});
		
		// Set language configuration for .prompd
		monaco.languages.setLanguageConfiguration(PROMPD_LANGUAGE_ID, prompdLanguageConfig);
		
		// Set monarch tokenizer for syntax highlighting
		monaco.languages.setMonarchTokensProvider(PROMPD_LANGUAGE_ID, prompdMonarchLanguage as any);
		
		// Register .prompdflow language (JSON-based)
		monaco.languages.register({
			id: PROMPDFLOW_LANGUAGE_ID,
			extensions: ['.prompdflow'],
			aliases: ['Prompd Flow', 'prompdflow'],
			mimetypes: ['application/json', 'application/x-prompdflow']
		});
		
		// Set language configuration for .prompdflow
		monaco.languages.setLanguageConfiguration(PROMPDFLOW_LANGUAGE_ID, prompdflowLanguageConfig);
		
		// Use JSON tokenizer for .prompdflow files
		monaco.languages.setMonarchTokensProvider(PROMPDFLOW_LANGUAGE_ID, monaco.languages.getLanguages().find(l => l.id === 'json')?.loader as any);
		
		console.log('Prompd languages registered:', PROMPD_LANGUAGE_ID, PROMPDFLOW_LANGUAGE_ID);
	}
	
	private registerEditorResolvers(): void {
		// Register .prompd file resolver
		this.editorResolverService.registerEditor(
			'*.prompd',
			{
				id: 'prompd.promptBuilder',
				label: 'Prompd Builder',
				priority: 'builtin'
			},
			{
				singlePerResource: true,
				canSupportResource: (resource) => resource.path.endsWith('.prompd')
			},
			{
				createEditorInput: ({ resource }) => {
					return { editor: new PrompdEditorInput(resource, this.instantiationService.invokeFunction(accessor => accessor.get(IFileService))) };
				}
			}
		);

		// Register .prompdflow file resolver
		this.editorResolverService.registerEditor(
			'*.prompdflow',
			{
				id: 'prompd.flowCanvas',
				label: 'Prompd Flow Canvas',
				priority: 'builtin'
			},
			{
				singlePerResource: true,
				canSupportResource: (resource) => resource.path.endsWith('.prompdflow')
			},
			{
				createEditorInput: ({ resource }) => {
					return { editor: new PrompdFlowEditorInput(resource, this.instantiationService.invokeFunction(accessor => accessor.get(IFileService))) };
				}
			}
		);

		console.log('✅ Prompd editor resolvers registered');
	}

	private registerPrompdViews(): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		
		// Register Chat view
		viewsRegistry.registerViews([{
			id: 'prompd.chat',
			name: { value: localize('prompd.chat', 'Chat'), original: 'Chat' },
			containerID: PROMPD_CONTAINER_ID,
			canToggleVisibility: true,
			order: 1,
			ctorDescriptor: new SyncDescriptor(PrompdChatView)
		}]);

		// Register Execute view
		viewsRegistry.registerViews([{
			id: 'prompd.execute',
			name: { value: localize('prompd.execute', 'Execute'), original: 'Execute' },
			containerID: PROMPD_CONTAINER_ID,
			canToggleVisibility: true,
			order: 2,
			ctorDescriptor: new SyncDescriptor(PrompdExecuteView)
		}]);

		// Register Workflow view
		viewsRegistry.registerViews([{
			id: 'prompd.workflow', 
			name: { value: localize('prompd.workflow', 'Workflow'), original: 'Workflow' },
			containerID: PROMPD_CONTAINER_ID,
			canToggleVisibility: true,
			order: 3,
			ctorDescriptor: new SyncDescriptor(PrompdWorkflowView)
		}]);
	}
}

// Native prompd view implementations
import { ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { Button } from 'vs/base/browser/ui/button/button';
import { renderFormattedText } from 'vs/base/browser/formattedTextRenderer';

class PrompdChatView extends ViewPane {
	private chatContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private messagesContainer!: HTMLElement;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IPrompdService private readonly prompdService: IPrompdService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, telemetryService, themeService);
	}

	protected renderBody(container: HTMLElement): void {
		this.chatContainer = container;
		
		// Messages container
		this.messagesContainer = document.createElement('div');
		this.messagesContainer.className = 'prompd-chat-messages';
		this.messagesContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 8px;
			border-bottom: 1px solid var(--vscode-panel-border);
		`;
		container.appendChild(this.messagesContainer);

		// Input container
		this.inputContainer = document.createElement('div');
		this.inputContainer.className = 'prompd-chat-input';
		this.inputContainer.style.cssText = `
			padding: 8px;
			border-top: 1px solid var(--vscode-panel-border);
		`;
		
		const textarea = document.createElement('textarea');
		textarea.placeholder = 'Type your message here...';
		textarea.style.cssText = `
			width: 100%;
			height: 60px;
			resize: none;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			padding: 8px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		`;
		
		const sendButton = new Button(this.inputContainer, { title: 'Send Message' });
		sendButton.label = 'Send';
		sendButton.style.cssText = `margin-top: 4px; float: right;`;
		attachButtonStyler(sendButton, this.themeService);
		
		this.inputContainer.appendChild(textarea);
		container.appendChild(this.inputContainer);

		// Add welcome message
		this.addMessage('system', 'Welcome to Prompd Chat! Start a conversation to test your prompts.');
	}

	private addMessage(type: 'user' | 'assistant' | 'system', content: string): void {
		const messageDiv = document.createElement('div');
		messageDiv.className = `prompd-message prompd-message-${type}`;
		messageDiv.style.cssText = `
			margin-bottom: 12px;
			padding: 8px;
			border-radius: 4px;
			background: ${type === 'user' ? 'var(--vscode-editor-selectionBackground)' : 'var(--vscode-editor-background)'};
			border: 1px solid var(--vscode-panel-border);
		`;

		const avatar = document.createElement('div');
		avatar.textContent = type === 'user' ? '👤' : type === 'assistant' ? '🤖' : 'ℹ️';
		avatar.style.cssText = `
			display: inline-block;
			margin-right: 8px;
			font-size: 16px;
		`;

		const contentDiv = document.createElement('div');
		contentDiv.style.cssText = `display: inline-block; vertical-align: top; max-width: calc(100% - 32px);`;
		
		const formattedContent = renderFormattedText(content, {
			inline: false,
			renderCodeSegments: true
		});
		contentDiv.appendChild(formattedContent);

		messageDiv.appendChild(avatar);
		messageDiv.appendChild(contentDiv);
		this.messagesContainer.appendChild(messageDiv);
		
		// Scroll to bottom
		this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
	}
}

class PrompdExecuteView extends ViewPane {
	private executeContainer!: HTMLElement;
	private promptTextarea!: HTMLTextAreaElement;
	private responseDiv!: HTMLElement;
	private providerSelect!: HTMLSelectElement;
	private modelSelect!: HTMLSelectElement;
	private executeButton!: Button;
	private isExecuting = false;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IPrompdService private readonly prompdService: IPrompdService,
		@IPrompdExecutionService private readonly executionService: IPrompdExecutionService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, telemetryService, themeService);
	}

	protected renderBody(container: HTMLElement): void {
		this.executeContainer = container;
		container.style.cssText = 'display: flex; flex-direction: column; height: 100%;';
		
		// Provider section
		const providerSection = document.createElement('div');
		providerSection.className = 'prompd-provider-section';
		providerSection.style.cssText = `padding: 12px; border-bottom: 1px solid var(--vscode-panel-border);`;
		
		const providerLabel = document.createElement('label');
		providerLabel.textContent = 'Provider';
		providerLabel.style.cssText = `
			display: block;
			font-weight: 600;
			margin-bottom: 4px;
			color: var(--vscode-foreground);
		`;
		
		this.providerSelect = document.createElement('select');
		this.providerSelect.style.cssText = `
			width: 100%;
			height: 24px;
			background: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
		`;
		
		// Populate providers from execution service
		const providers = this.executionService.getProviders();
		providers.forEach(provider => {
			const option = document.createElement('option');
			option.value = provider.id;
			option.textContent = provider.name;
			this.providerSelect.appendChild(option);
		});
		
		this.providerSelect.onchange = () => this.updateModels();
		
		providerSection.appendChild(providerLabel);
		providerSection.appendChild(this.providerSelect);
		container.appendChild(providerSection);
		
		// Model section
		const modelSection = document.createElement('div');
		modelSection.className = 'prompd-model-section';
		modelSection.style.cssText = `padding: 12px; border-bottom: 1px solid var(--vscode-panel-border);`;
		
		const modelLabel = document.createElement('label');
		modelLabel.textContent = 'Model';
		modelLabel.style.cssText = `
			display: block;
			font-weight: 600;
			margin-bottom: 4px;
			color: var(--vscode-foreground);
		`;
		
		this.modelSelect = document.createElement('select');
		this.modelSelect.style.cssText = `
			width: 100%;
			height: 24px;
			background: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
		`;
		
		modelSection.appendChild(modelLabel);
		modelSection.appendChild(this.modelSelect);
		container.appendChild(modelSection);

		// Prompt input section
		const promptSection = document.createElement('div');
		promptSection.style.cssText = `padding: 12px; flex: 0 0 200px;`;
		
		const promptLabel = document.createElement('label');
		promptLabel.textContent = 'Prompt';
		promptLabel.style.cssText = `
			display: block;
			font-weight: 600;
			margin-bottom: 4px;
			color: var(--vscode-foreground);
		`;
		
		this.promptTextarea = document.createElement('textarea');
		this.promptTextarea.placeholder = 'Enter your prompt here...';
		this.promptTextarea.style.cssText = `
			width: 100%;
			height: 150px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			padding: 8px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			resize: vertical;
		`;
		
		promptSection.appendChild(promptLabel);
		promptSection.appendChild(this.promptTextarea);
		container.appendChild(promptSection);

		// Execute button
		const buttonContainer = document.createElement('div');
		buttonContainer.style.cssText = `padding: 0 12px 12px 12px;`;
		
		this.executeButton = new Button(buttonContainer, { title: 'Execute Prompt' });
		this.executeButton.label = '▶ Execute';
		this.executeButton.style.cssText = `width: 100%;`;
		attachButtonStyler(this.executeButton, this.themeService);
		
		this.executeButton.onDidClick(() => this.executePrompt());

		container.appendChild(buttonContainer);

		// Response section
		const responseSection = document.createElement('div');
		responseSection.style.cssText = `flex: 1; overflow-y: auto; padding: 12px; border-top: 1px solid var(--vscode-panel-border);`;
		
		const responseLabel = document.createElement('label');
		responseLabel.textContent = 'Response';
		responseLabel.style.cssText = `
			display: block;
			font-weight: 600;
			margin-bottom: 8px;
			color: var(--vscode-foreground);
		`;
		
		this.responseDiv = document.createElement('div');
		this.responseDiv.style.cssText = `
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 12px;
			min-height: 100px;
			white-space: pre-wrap;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
		`;
		this.responseDiv.textContent = 'Response will appear here...';
		
		responseSection.appendChild(responseLabel);
		responseSection.appendChild(this.responseDiv);
		container.appendChild(responseSection);

		// Initialize models for default provider
		this.updateModels();
	}

	private updateModels(): void {
		const providerId = this.providerSelect.value;
		const providers = this.executionService.getProviders();
		const provider = providers.find(p => p.id === providerId);
		
		// Clear existing options
		this.modelSelect.innerHTML = '';
		
		if (provider) {
			provider.models.forEach(model => {
				const option = document.createElement('option');
				option.value = model.id;
				option.textContent = model.name;
				this.modelSelect.appendChild(option);
			});
		}
	}

	private async executePrompt(): Promise<void> {
		if (this.isExecuting) return;
		
		const prompt = this.promptTextarea.value.trim();
		if (!prompt) {
			this.responseDiv.textContent = 'Please enter a prompt.';
			return;
		}

		this.isExecuting = true;
		this.executeButton.enabled = false;
		this.executeButton.label = '⏳ Executing...';
		this.responseDiv.textContent = 'Executing prompt...';

		try {
			const providerId = this.providerSelect.value;
			const modelId = this.modelSelect.value;
			const providers = this.executionService.getProviders();
			const provider = providers.find(p => p.id === providerId);

			if (!provider) {
				throw new Error('Provider not found');
			}

			const result = await this.executionService.executePrompt(prompt, provider, {
				model: modelId,
				temperature: 0.7,
				maxTokens: 2048
			});

			// Display result
			this.responseDiv.innerHTML = '';
			
			// Add metadata
			const metadata = document.createElement('div');
			metadata.style.cssText = `
				margin-bottom: 12px;
				padding: 8px;
				background: var(--vscode-textBlockQuote-background);
				border-left: 3px solid var(--vscode-textLink-foreground);
				font-size: 12px;
				color: var(--vscode-descriptionForeground);
			`;
			metadata.innerHTML = `
				<strong>Provider:</strong> ${provider.name} | 
				<strong>Model:</strong> ${result.model} | 
				<strong>Tokens:</strong> ${result.tokensUsed.total} | 
				<strong>Time:</strong> ${result.executionTime}ms
				${result.cost ? ` | <strong>Cost:</strong> $${result.cost.toFixed(4)}` : ''}
			`;
			this.responseDiv.appendChild(metadata);

			// Add response
			const responseText = document.createElement('div');
			responseText.textContent = result.response;
			this.responseDiv.appendChild(responseText);

		} catch (error: any) {
			this.responseDiv.innerHTML = `<span style="color: var(--vscode-errorForeground);">Error: ${error.message}</span>`;
		} finally {
			this.isExecuting = false;
			this.executeButton.enabled = true;
			this.executeButton.label = '▶ Execute';
		}
	}
}

class PrompdWorkflowView extends ViewPane {
	private workflowContainer!: HTMLElement;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IPrompdService private readonly prompdService: IPrompdService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, telemetryService, themeService);
	}

	protected renderBody(container: HTMLElement): void {
		this.workflowContainer = container;
		
		// Create native workflow editor instance
		const editorContainer = document.createElement('div');
		editorContainer.className = 'prompd-workflow-editor-container';
		editorContainer.style.cssText = `
			width: 100%;
			height: calc(100% - 60px);
			position: relative;
		`;
		
		// Instantiate the native workflow editor component
		const workflowEditor = new PrompdWorkflowEditor(
			'workflow-view-editor',
			null as any, // Group will be injected
			this.telemetryService,
			this.themeService,
			null as any, // Storage service
			this.instantiationService,
			this.prompdService,
			this.contextKeyService
		);
		
		// Create the editor in our container
		workflowEditor.create(editorContainer);
		container.appendChild(editorContainer);

		// Workflow controls
		const controlsContainer = document.createElement('div');
		controlsContainer.style.cssText = `
			padding: 12px;
			border-top: 1px solid var(--vscode-panel-border);
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			background: var(--vscode-editor-background);
		`;
		
		const newFlowButton = new Button(controlsContainer, { title: 'Create New Flow' });
		newFlowButton.label = '+ New Flow';
		attachButtonStyler(newFlowButton, this.themeService);
		
		const openFlowButton = new Button(controlsContainer, { title: 'Open Flow' });
		openFlowButton.label = '📁 Open';
		attachButtonStyler(openFlowButton, this.themeService);
		
		const saveFlowButton = new Button(controlsContainer, { title: 'Save Flow' });
		saveFlowButton.label = '💾 Save';
		attachButtonStyler(saveFlowButton, this.themeService);
		
		newFlowButton.onDidClick(async () => {
			const flow = await this.prompdService.createFlow();
			console.log('Created new flow:', flow.name);
		});

		container.appendChild(controlsContainer);
	}
}

// Register the workbench contribution
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(PrompdWorkbenchContribution, LifecyclePhase.Restored);

// Register native custom editors
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		PrompdBuilderPane,
		PrompdBuilderPane.ID,
		localize('prompdBuilder', 'Prompd Builder')
	),
	[
		new SyncDescriptor(PrompdEditorInputFactory)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		PrompdFlowCanvasPane,
		PrompdFlowCanvasPane.ID,
		localize('prompdFlowCanvas', 'Prompd Flow Canvas')
	),
	[
		new SyncDescriptor(PrompdFlowEditorInputFactory)
	]
);
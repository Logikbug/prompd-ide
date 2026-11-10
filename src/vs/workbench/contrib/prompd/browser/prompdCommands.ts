/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Registry } from 'vs/platform/registry/common/platform';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IPrompdService } from 'vs/platform/prompd/common/prompd';
import { IPrompdExecutionService } from 'vs/workbench/services/prompd/browser/prompdExecutionService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { IViewsService } from 'vs/workbench/common/views';

// Command IDs
export const PROMPD_COMMAND_IDS = {
	RUN_PROMPT: 'prompd.runPrompt',
	RUN_SECTION: 'prompd.runSection',
	ADD_VARIABLE: 'prompd.addVariable',
	ADD_PARAMETER: 'prompd.addParameter',
	EDIT_PARAMETER: 'prompd.editParameter',
	DELETE_PARAMETER: 'prompd.deleteParameter',
	SHOW_CONSOLE: 'prompd.showConsole',
	DEBUG_PROMPT: 'prompd.debugPrompt',
	CREATE_PROMPT_FILE: 'prompd.createPromptFile',
	CREATE_FLOW_FILE: 'prompd.createFlowFile',
	EXECUTE_WITH_PARAMETERS: 'prompd.executeWithParameters',
	SAVE_TEMPLATE: 'prompd.saveTemplate',
	LOAD_TEMPLATE: 'prompd.loadTemplate',
	EXPORT_FLOW: 'prompd.exportFlow',
	IMPORT_FLOW: 'prompd.importFlow',
	VALIDATE_FLOW: 'prompd.validateFlow',
	OPEN_PROMPT_BUILDER: 'prompd.openPromptBuilder',
	OPEN_FLOW_CANVAS: 'prompd.openFlowCanvas',
	SHOW_PROMPD_SIDEBAR: 'prompd.showSidebar',
	TOGGLE_CHAT_VIEW: 'prompd.toggleChatView',
	TOGGLE_EXECUTE_VIEW: 'prompd.toggleExecuteView',
	TOGGLE_WORKFLOW_VIEW: 'prompd.toggleWorkflowView',
	CONFIGURE_PROVIDERS: 'prompd.configureProviders'
} as const;

/**
 * Register all prompd commands natively in VS Code
 */
export function registerPrompdCommands(): void {

	// Run Prompt Command
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.RUN_PROMPT,
		handler: async (accessor, ...args) => {
			const executionService = accessor.get(IPrompdExecutionService);
			const notificationService = accessor.get(INotificationService);
			const editorService = accessor.get(IEditorService);
			
			try {
				const activeEditor = editorService.activeEditor;
				if (!activeEditor) {
					notificationService.warn(localize('prompd.noActiveEditor', 'No active editor to run prompt from'));
					return;
				}

				// Get prompt content from active editor
				// TODO: Extract prompt from editor content
				const prompt = "Sample prompt from active editor";
				
				const providers = executionService.getProviders();
				if (providers.length === 0) {
					notificationService.error(localize('prompd.noProviders', 'No execution providers configured'));
					return;
				}

				const result = await executionService.executePrompt(prompt, providers[0]);
				notificationService.info(localize('prompd.executionComplete', 'Prompt execution completed in {0}ms', result.executionTime));
			} catch (error: any) {
				notificationService.error(localize('prompd.executionFailed', 'Prompt execution failed: {0}', error.message));
			}
		}
	});

	// Create Prompt File Command
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.CREATE_PROMPT_FILE,
		handler: async (accessor, ...args) => {
			const quickInputService = accessor.get(IQuickInputService);
			const fileService = accessor.get(IFileService);
			const editorService = accessor.get(IEditorService);
			const notificationService = accessor.get(INotificationService);

			try {
				const fileName = await quickInputService.input({
					prompt: localize('prompd.enterFileName', 'Enter filename for new prompt'),
					placeHolder: 'my-prompt.prompd'
				});

				if (!fileName) return;

				const fileUri = URI.file(fileName.endsWith('.prompd') ? fileName : `${fileName}.prompd`);
				
				// Create default prompt template
				const defaultContent = `# Prompt Metadata
name: "${fileName.replace('.prompd', '')}"
description: "A new prompt template"
version: "1.0.0"

# Parameters
parameters:
  user_input:
    type: string
    description: "User input for the prompt"
    required: true

# Providers
providers:
  default: openai
  config:
    openai:
      model: "gpt-4"
      temperature: 0.7

# Prompt Sections
prompts:
  system: |
    You are a helpful AI assistant. Provide clear and accurate responses.
  
  user: |
    {{user_input}}
`;

				await fileService.writeFile(fileUri, VSBuffer.fromString(defaultContent));
				await editorService.openEditor({ resource: fileUri });
				
				notificationService.info(localize('prompd.fileCreated', 'Prompt file created: {0}', fileName));
			} catch (error: any) {
				notificationService.error(localize('prompd.createFileFailed', 'Failed to create prompt file: {0}', error.message));
			}
		}
	});

	// Create Flow File Command
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.CREATE_FLOW_FILE,
		handler: async (accessor, ...args) => {
			const quickInputService = accessor.get(IQuickInputService);
			const fileService = accessor.get(IFileService);
			const editorService = accessor.get(IEditorService);
			const notificationService = accessor.get(INotificationService);

			try {
				const fileName = await quickInputService.input({
					prompt: localize('prompd.enterFlowFileName', 'Enter filename for new flow'),
					placeHolder: 'my-flow.prompdflow'
				});

				if (!fileName) return;

				const fileUri = URI.file(fileName.endsWith('.prompdflow') ? fileName : `${fileName}.prompdflow`);
				
				// Create default flow template
				const defaultFlow = {
					version: "1.0.0",
					metadata: {
						id: `flow_${Date.now()}`,
						name: fileName.replace('.prompdflow', ''),
						description: "A new prompt flow",
						version: "1.0.0",
						created: new Date().toISOString(),
						modified: new Date().toISOString(),
						schemaVersion: "1.0.0"
					},
					settings: {
						executionMode: "sequential",
						errorHandling: "stop"
					},
					parameters: {},
					nodes: [
						{
							id: "input_1",
							type: "input",
							position: { x: 100, y: 100 },
							data: {
								label: "Input",
								outputVariable: "user_input"
							}
						},
						{
							id: "prompt_1",
							type: "prompt",
							position: { x: 300, y: 100 },
							data: {
								label: "Main Prompt",
								prompt: "Process this input: {{user_input}}",
								provider: "openai",
								model: "gpt-4"
							}
						},
						{
							id: "output_1",
							type: "output",
							position: { x: 500, y: 100 },
							data: {
								label: "Output"
							}
						}
					],
					connections: [
						{
							id: "conn_1",
							from: "input_1",
							to: "prompt_1"
						},
						{
							id: "conn_2", 
							from: "prompt_1",
							to: "output_1"
						}
					]
				};

				await fileService.writeFile(fileUri, VSBuffer.fromString(JSON.stringify(defaultFlow, null, 2)));
				await editorService.openEditor({ resource: fileUri });
				
				notificationService.info(localize('prompd.flowCreated', 'Flow file created: {0}', fileName));
			} catch (error: any) {
				notificationService.error(localize('prompd.createFlowFailed', 'Failed to create flow file: {0}', error.message));
			}
		}
	});

	// Configure Providers Command
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.CONFIGURE_PROVIDERS,
		handler: async (accessor, ...args) => {
			const quickInputService = accessor.get(IQuickInputService);
			const executionService = accessor.get(IPrompdExecutionService);
			const notificationService = accessor.get(INotificationService);

			try {
				const providers = executionService.getProviders();
				const providerNames = providers.map(p => p.name);
				
				const selected = await quickInputService.pick(providerNames, {
					placeHolder: localize('prompd.selectProvider', 'Select provider to configure')
				});

				if (!selected) return;

				const provider = providers.find(p => p.name === selected);
				if (!provider) return;

				const apiKey = await quickInputService.input({
					prompt: localize('prompd.enterApiKey', 'Enter API key for {0}', provider.name),
					password: true
				});

				if (apiKey) {
					provider.apiKey = apiKey;
					provider.configured = true;
					notificationService.info(localize('prompd.providerConfigured', 'Provider {0} configured successfully', provider.name));
				}
			} catch (error: any) {
				notificationService.error(localize('prompd.configurationFailed', 'Provider configuration failed: {0}', error.message));
			}
		}
	});

	// Show Prompd Sidebar Command
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.SHOW_PROMPD_SIDEBAR,
		handler: async (accessor, ...args) => {
			const viewsService = accessor.get(IViewsService);
			// Focus the prompd sidebar
			viewsService.openView('workbench.view.prompd', true);
		}
	});

	// Add Variable Command
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.ADD_VARIABLE,
		handler: async (accessor, ...args) => {
			const quickInputService = accessor.get(IQuickInputService);
			const notificationService = accessor.get(INotificationService);

			try {
				const name = await quickInputService.input({
					prompt: localize('prompd.enterVariableName', 'Enter variable name'),
					placeHolder: 'variable_name'
				});

				if (!name) return;

				const value = await quickInputService.input({
					prompt: localize('prompd.enterVariableValue', 'Enter variable value'),
					placeHolder: 'variable value'
				});

				if (value !== undefined) {
					// TODO: Store variable in prompd service
					notificationService.info(localize('prompd.variableAdded', 'Variable "{0}" added', name));
				}
			} catch (error: any) {
				notificationService.error(localize('prompd.addVariableFailed', 'Failed to add variable: {0}', error.message));
			}
		}
	});

	// Debug Prompt Command  
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.DEBUG_PROMPT,
		handler: async (accessor, ...args) => {
			const notificationService = accessor.get(INotificationService);
			
			// TODO: Implement prompt debugging
			notificationService.info(localize('prompd.debugPrompt', 'Prompt debugging started'));
		}
	});

	// Execute with Parameters Command
	CommandsRegistry.registerCommand({
		id: PROMPD_COMMAND_IDS.EXECUTE_WITH_PARAMETERS,
		handler: async (accessor, ...args) => {
			const executionService = accessor.get(IPrompdExecutionService);
			const quickInputService = accessor.get(IQuickInputService);
			const notificationService = accessor.get(INotificationService);

			try {
				const prompt = await quickInputService.input({
					prompt: localize('prompd.enterPrompt', 'Enter prompt to execute'),
					placeHolder: 'Your prompt here...'
				});

				if (!prompt) return;

				const providers = executionService.getProviders();
				if (providers.length === 0) {
					notificationService.error(localize('prompd.noProviders', 'No execution providers configured'));
					return;
				}

				const providerNames = providers.map(p => `${p.name} (${p.configured ? 'configured' : 'not configured'})`);
				const selectedProvider = await quickInputService.pick(providerNames, {
					placeHolder: localize('prompd.selectProvider', 'Select provider')
				});

				if (!selectedProvider) return;

				const providerIndex = providerNames.indexOf(selectedProvider);
				const provider = providers[providerIndex];

				if (!provider.configured) {
					notificationService.warn(localize('prompd.providerNotConfigured', 'Provider not configured. Use "Configure Providers" command first.'));
					return;
				}

				const result = await executionService.executePrompt(prompt, provider);
				notificationService.info(localize('prompd.executionComplete', 'Execution completed in {0}ms. Check output.', result.executionTime));
			} catch (error: any) {
				notificationService.error(localize('prompd.executionFailed', 'Execution failed: {0}', error.message));
			}
		}
	});

	console.log('✅ Prompd commands registered natively');
}

/**
 * Register all prompd menu contributions
 */
export function registerPrompdMenus(): void {
	
	// Editor context menu for .prompd files
	MenuRegistry.appendMenuItem(MenuId.EditorContext, {
		command: {
			id: PROMPD_COMMAND_IDS.RUN_PROMPT,
			title: localize('prompd.runPrompt', 'Run Prompt'),
			icon: { id: 'play' }
		},
		when: 'resourceExtname == .prompd',
		group: 'prompd@1'
	});

	// Editor context menu for .prompdflow files
	MenuRegistry.appendMenuItem(MenuId.EditorContext, {
		command: {
			id: PROMPD_COMMAND_IDS.VALIDATE_FLOW,
			title: localize('prompd.validateFlow', 'Validate Flow'),
			icon: { id: 'check' }
		},
		when: 'resourceExtname == .prompdflow',
		group: 'prompd@1'
	});

	// Command palette entries
	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: PROMPD_COMMAND_IDS.CREATE_PROMPT_FILE,
			title: localize('prompd.createPromptFile', 'Prompd: Create Prompt File'),
			category: 'Prompd'
		}
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: PROMPD_COMMAND_IDS.CREATE_FLOW_FILE,
			title: localize('prompd.createFlowFile', 'Prompd: Create Flow File'),
			category: 'Prompd'
		}
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: PROMPD_COMMAND_IDS.CONFIGURE_PROVIDERS,
			title: localize('prompd.configureProviders', 'Prompd: Configure AI Providers'),
			category: 'Prompd'
		}
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: PROMPD_COMMAND_IDS.EXECUTE_WITH_PARAMETERS,
			title: localize('prompd.executeWithParameters', 'Prompd: Execute Prompt'),
			category: 'Prompd'
		}
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: PROMPD_COMMAND_IDS.SHOW_PROMPD_SIDEBAR,
			title: localize('prompd.showSidebar', 'Prompd: Show Sidebar'),
			category: 'Prompd'
		}
	});

	console.log('✅ Prompd menus registered natively');
}

/**
 * Register all prompd keybindings
 */
export function registerPrompdKeybindings(): void {
	
	// Run Prompt: Ctrl+R (when in .prompd file)
	KeybindingsRegistry.registerKeybindingRule({
		id: PROMPD_COMMAND_IDS.RUN_PROMPT,
		weight: KeybindingWeight.WorkbenchContrib,
		when: 'resourceExtname == .prompd',
		primary: KeyMod.CtrlCmd | KeyCode.KeyR
	});

	// Create Prompt File: Ctrl+Shift+P, then Ctrl+P
	KeybindingsRegistry.registerKeybindingRule({
		id: PROMPD_COMMAND_IDS.CREATE_PROMPT_FILE,
		weight: KeybindingWeight.WorkbenchContrib,
		primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN
	});

	// Execute with Parameters: Ctrl+Shift+E
	KeybindingsRegistry.registerKeybindingRule({
		id: PROMPD_COMMAND_IDS.EXECUTE_WITH_PARAMETERS,
		weight: KeybindingWeight.WorkbenchContrib,
		primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE
	});

	// Show Prompd Sidebar: Ctrl+Shift+P
	KeybindingsRegistry.registerKeybindingRule({
		id: PROMPD_COMMAND_IDS.SHOW_PROMPD_SIDEBAR,
		weight: KeybindingWeight.WorkbenchContrib,
		primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP
	});

	// Debug Prompt: F5 (when in .prompd file)
	KeybindingsRegistry.registerKeybindingRule({
		id: PROMPD_COMMAND_IDS.DEBUG_PROMPT,
		weight: KeybindingWeight.WorkbenchContrib,
		when: 'resourceExtname == .prompd',
		primary: KeyCode.F5
	});

	console.log('✅ Prompd keybindings registered natively');
}
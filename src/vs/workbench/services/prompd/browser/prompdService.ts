/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IPrompdService, IPrompdFlow, IPrompdNode } from 'vs/platform/prompd/common/prompd';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';

export class PrompdService extends Disposable implements IPrompdService {

	declare readonly _serviceBrand: undefined;

	private nodeIdCounter = 0;
	private flowIdCounter = 0;

	constructor(
		@IFileService private readonly fileService: IFileService
	) {
		super();
	}

	async createFlow(): Promise<IPrompdFlow> {
		return {
			id: `flow_${this.flowIdCounter++}`,
			name: 'New Flow',
			description: 'A new prompt flow',
			version: '1.0.0',
			tags: [],
			author: 'Prompd IDE',
			createdAt: new Date().toISOString(),
			nodes: [],
			connections: [],
			variables: [],
			globalSettings: {
				defaultProvider: 'openai',
				defaultModel: 'gpt-4',
				timeout: 30000,
				maxRetries: 3
			}
		};
	}

	async loadFlow(uri: string): Promise<IPrompdFlow | null> {
		try {
			const fileUri = URI.parse(uri);
			const content = await this.fileService.readFile(fileUri);
			const flowData = JSON.parse(content.value.toString());
			return flowData as IPrompdFlow;
		} catch (error) {
			console.error('Failed to load flow:', error);
			return null;
		}
	}

	async saveFlow(flow: IPrompdFlow, uri?: string): Promise<void> {
		try {
			const content = JSON.stringify(flow, null, 2);
			const fileUri = uri ? URI.parse(uri) : URI.file(`${flow.name}.prompdflow`);
			await this.fileService.writeFile(fileUri, Buffer.from(content));
		} catch (error) {
			console.error('Failed to save flow:', error);
			throw error;
		}
	}

	async executeFlow(flow: IPrompdFlow): Promise<any> {
		// TODO: Implement flow execution logic
		console.log('Executing flow:', flow.name);
		return { status: 'success', message: 'Flow executed successfully' };
	}

	async validateFlow(flow: IPrompdFlow): Promise<{ valid: boolean; errors: any[] }> {
		const errors: any[] = [];

		// Basic validation
		if (!flow.nodes || flow.nodes.length === 0) {
			errors.push({ message: 'Flow must contain at least one node', location: { type: 'flow' } });
		}

		// Validate connections
		for (const connection of flow.connections) {
			const sourceNode = flow.nodes.find(n => n.id === connection.sourceNodeId);
			const targetNode = flow.nodes.find(n => n.id === connection.targetNodeId);

			if (!sourceNode) {
				errors.push({ 
					message: `Connection source node not found: ${connection.sourceNodeId}`, 
					location: { type: 'connection', identifier: connection.id } 
				});
			}

			if (!targetNode) {
				errors.push({ 
					message: `Connection target node not found: ${connection.targetNodeId}`, 
					location: { type: 'connection', identifier: connection.id } 
				});
			}
		}

		return { valid: errors.length === 0, errors };
	}

	getNodeTypes(): string[] {
		return [
			'prompt',
			'parameter', 
			'parameters',
			'condition',
			'transformer',
			'output',
			'api',
			'validator',
			'aggregator'
		];
	}

	createNode(type: string, position: { x: number; y: number }): IPrompdNode {
		const nodeId = `node_${this.nodeIdCounter++}`;
		
		return {
			id: nodeId,
			type: type,
			position: position,
			data: {
				label: type.charAt(0).toUpperCase() + type.slice(1) + ' Node',
				description: this.getNodeDescription(type),
				enabled: true,
				config: this.getDefaultNodeConfig(type)
			},
			inputPorts: (type !== 'parameter' && type !== 'parameters') ? [
				{ id: 'input', name: 'Input', dataType: 'any', required: false }
			] : [],
			outputPorts: type !== 'output' ? [
				{ id: 'output', name: 'Output', dataType: 'any', required: false }
			] : [],
			metadata: {
				collapsed: false,
				breakpoint: false
			}
		};
	}

	private getNodeDescription(type: string): string {
		const descriptions: { [key: string]: string } = {
			'prompt': 'Executes AI prompts with specified model and settings',
			'parameter': 'Defines a single input parameter with type and validation',
			'parameters': 'Defines multiple parameters from JSON/YAML configuration',
			'condition': 'Controls flow based on conditional logic',
			'transformer': 'Transforms data using custom code or functions',
			'output': 'Outputs results in specified format',
			'api': 'Makes external API calls',
			'validator': 'Validates data against specified rules',
			'aggregator': 'Combines multiple inputs into single output'
		};
		return descriptions[type] || `A ${type} node for processing`;
	}

	private getDefaultNodeConfig(type: string): any {
		const configs: { [key: string]: any } = {
			'prompt': {
				type: 'prompt',
				template: 'Enter your prompt template here...',
				parameters: [],
				provider: { name: 'openai' },
				model: { name: 'gpt-4' },
				executionSettings: {},
				outputFormat: 'text',
				timeout: 30000
			},
			'parameter': {
				type: 'parameter',
				parameterName: 'newParam',
				dataType: 'string',
				defaultValue: '',
				required: false,
				sensitive: false,
				validation: []
			},
			'parameters': {
				type: 'parameters',
				parameters: '{\n  "userName": "string",\n  "temperature": "number",\n  "enableLogging": "boolean"\n}',
				parsedParameters: {},
				bindingMode: 'yaml'
			}
		};
		return configs[type] || { type };
	}
}
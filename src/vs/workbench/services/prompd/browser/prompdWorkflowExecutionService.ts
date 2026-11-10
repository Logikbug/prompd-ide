/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IPrompdExecutionService, ExecutionResult } from './prompdExecutionService';
import { ILogService } from 'vs/platform/log/common/log';

export interface FlowNode {
	id: string;
	type: string;
	x: number;
	y: number;
	label: string;
	config?: any;
}

export interface FlowConnection {
	from: string;
	to: string;
	fromPort?: string;
	toPort?: string;
}

export interface WorkflowDefinition {
	id: string;
	name: string;
	description?: string;
	nodes: FlowNode[];
	connections: FlowConnection[];
	variables?: Record<string, any>;
	metadata?: {
		version: string;
		created: Date;
		modified: Date;
		tags?: string[];
	};
}

export interface WorkflowExecutionResult {
	workflowId: string;
	executionId: string;
	status: 'running' | 'completed' | 'failed' | 'cancelled';
	startTime: Date;
	endTime?: Date;
	duration?: number;
	results: Record<string, any>;
	logs: WorkflowExecutionLog[];
	errors?: string[];
	tokensUsed?: number;
	estimatedCost?: number;
}

export interface WorkflowExecutionLog {
	timestamp: Date;
	level: 'info' | 'warn' | 'error' | 'debug';
	message: string;
	nodeId?: string;
	data?: any;
}

export interface WorkflowExecutionOptions {
	timeout?: number;
	maxRetries?: number;
	dryRun?: boolean;
	debugMode?: boolean;
	parallelExecution?: boolean;
	variables?: Record<string, any>;
}

export const IPrompdWorkflowExecutionService = Symbol('IPrompdWorkflowExecutionService');

export interface IPrompdWorkflowExecutionService {
	readonly _serviceBrand: undefined;

	/**
	 * Event fired when a workflow execution starts
	 */
	readonly onExecutionStarted: Event<WorkflowExecutionResult>;

	/**
	 * Event fired when a workflow execution completes
	 */
	readonly onExecutionCompleted: Event<WorkflowExecutionResult>;

	/**
	 * Event fired when a workflow execution fails
	 */
	readonly onExecutionFailed: Event<WorkflowExecutionResult>;

	/**
	 * Event fired when a workflow execution is cancelled
	 */
	readonly onExecutionCancelled: Event<WorkflowExecutionResult>;

	/**
	 * Execute a complete workflow
	 */
	executeWorkflow(workflow: WorkflowDefinition, options?: WorkflowExecutionOptions): Promise<WorkflowExecutionResult>;

	/**
	 * Execute a single node within a workflow
	 */
	executeNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<any>;

	/**
	 * Validate a workflow definition
	 */
	validateWorkflow(workflow: WorkflowDefinition): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;

	/**
	 * Cancel a running workflow execution
	 */
	cancelExecution(executionId: string): Promise<boolean>;

	/**
	 * Get the status of a workflow execution
	 */
	getExecutionStatus(executionId: string): Promise<WorkflowExecutionResult | null>;

	/**
	 * List all active workflow executions
	 */
	listActiveExecutions(): Promise<WorkflowExecutionResult[]>;

	/**
	 * Export workflow to different formats for production use
	 */
	exportWorkflow(workflow: WorkflowDefinition, format: 'json' | 'yaml' | 'script' | 'api'): Promise<string>;

	/**
	 * Generate deployment configuration for different environments
	 */
	generateDeploymentConfig(workflow: WorkflowDefinition, environment: 'local' | 'cloud' | 'docker' | 'kubernetes'): Promise<any>;
}

export class PrompdWorkflowExecutionService extends Disposable implements IPrompdWorkflowExecutionService {
	declare readonly _serviceBrand: undefined;

	private readonly _onExecutionStarted = this._register(new Emitter<WorkflowExecutionResult>());
	readonly onExecutionStarted = this._onExecutionStarted.event;

	private readonly _onExecutionCompleted = this._register(new Emitter<WorkflowExecutionResult>());
	readonly onExecutionCompleted = this._onExecutionCompleted.event;

	private readonly _onExecutionFailed = this._register(new Emitter<WorkflowExecutionResult>());
	readonly onExecutionFailed = this._onExecutionFailed.event;

	private readonly _onExecutionCancelled = this._register(new Emitter<WorkflowExecutionResult>());
	readonly onExecutionCancelled = this._onExecutionCancelled.event;

	private activeExecutions = new Map<string, WorkflowExecutionResult>();

	constructor(
		@IPrompdExecutionService private readonly executionService: IPrompdExecutionService,
		@ILogService private readonly logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();
	}

	async executeWorkflow(workflow: WorkflowDefinition, options?: WorkflowExecutionOptions): Promise<WorkflowExecutionResult> {
		const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const startTime = new Date();
		
		const executionResult: WorkflowExecutionResult = {
			workflowId: workflow.id,
			executionId,
			status: 'running',
			startTime,
			results: {},
			logs: [],
			tokensUsed: 0,
			estimatedCost: 0
		};

		this.activeExecutions.set(executionId, executionResult);
		this._onExecutionStarted.fire(executionResult);

		try {
			// Validate workflow before execution
			const validation = await this.validateWorkflow(workflow);
			if (!validation.valid) {
				throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
			}

			// Log execution start
			this.addLog(executionResult, 'info', `Starting workflow execution: ${workflow.name}`, undefined, { workflow: workflow.id, options });

			// Build execution graph from nodes and connections
			const executionGraph = this.buildExecutionGraph(workflow);
			
			// Execute nodes in topological order
			const context = { ...workflow.variables, ...options?.variables };
			const nodeResults = await this.executeGraph(executionGraph, context, executionResult, options);

			// Set final results
			executionResult.results = nodeResults;
			executionResult.status = 'completed';
			executionResult.endTime = new Date();
			executionResult.duration = executionResult.endTime.getTime() - executionResult.startTime.getTime();

			this.addLog(executionResult, 'info', `Workflow execution completed successfully in ${executionResult.duration}ms`);
			this._onExecutionCompleted.fire(executionResult);

		} catch (error) {
			executionResult.status = 'failed';
			executionResult.endTime = new Date();
			executionResult.duration = executionResult.endTime.getTime() - executionResult.startTime.getTime();
			executionResult.errors = [error instanceof Error ? error.message : String(error)];

			this.addLog(executionResult, 'error', `Workflow execution failed: ${error}`, undefined, { error });
			this._onExecutionFailed.fire(executionResult);
		} finally {
			this.activeExecutions.delete(executionId);
		}

		return executionResult;
	}

	async executeNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<any> {
		this.logService.info(`Executing node: ${node.type}:${node.id}`);

		switch (node.type) {
			case 'prompt':
				return await this.executePromptNode(node, context, options);
			case 'llm':
				return await this.executeLLMNode(node, context, options);
			case 'transform':
				return await this.executeTransformNode(node, context, options);
			case 'condition':
				return await this.executeConditionNode(node, context, options);
			case 'loop':
				return await this.executeLoopNode(node, context, options);
			case 'api':
				return await this.executeAPINode(node, context, options);
			case 'output':
				return await this.executeOutputNode(node, context, options);
			case 'parameters':
				return await this.executeParametersNode(node, context, options);
			default:
				throw new Error(`Unknown node type: ${node.type}`);
		}
	}

	private async executePromptNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<string> {
		const config = node.config || {};
		let prompt = config.template || config.content || '';

		// Replace variables in prompt template
		for (const [key, value] of Object.entries(context)) {
			prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
		}

		return prompt;
	}

	private async executeLLMNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<ExecutionResult> {
		const config = node.config || {};
		const prompt = context._prompt || config.prompt || '';
		
		const provider = config.provider || 'openai';
		const model = config.model || 'gpt-3.5-turbo';

		const executionOptions = {
			model,
			temperature: config.temperature || 0.7,
			maxTokens: config.maxTokens || 1000,
			topP: config.topP || 1,
			presencePenalty: config.presencePenalty || 0,
			frequencyPenalty: config.frequencyPenalty || 0
		};

		return await this.executionService.executePrompt(prompt, provider as any, executionOptions);
	}

	private async executeTransformNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<any> {
		const config = node.config || {};
		const input = context._input || '';

		switch (config.type) {
			case 'uppercase':
				return String(input).toUpperCase();
			case 'lowercase':  
				return String(input).toLowerCase();
			case 'trim':
				return String(input).trim();
			case 'json_parse':
				return JSON.parse(String(input));
			case 'json_stringify':
				return JSON.stringify(input, null, config.indent || 0);
			case 'regex_replace':
				return String(input).replace(new RegExp(config.pattern, config.flags || 'g'), config.replacement || '');
			case 'split':
				return String(input).split(config.delimiter || '\n');
			case 'join':
				return Array.isArray(input) ? input.join(config.delimiter || '\n') : input;
			case 'custom':
				// Execute custom JavaScript transformation
				const func = new Function('input', 'context', config.code || 'return input;');
				return func(input, context);
			default:
				return input;
		}
	}

	private async executeConditionNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<boolean> {
		const config = node.config || {};
		const left = this.resolveValue(config.left, context);
		const right = this.resolveValue(config.right, context);
		const operator = config.operator || '===';

		switch (operator) {
			case '===': return left === right;
			case '!==': return left !== right;
			case '>': return left > right;
			case '>=': return left >= right;
			case '<': return left < right;
			case '<=': return left <= right;
			case 'contains': return String(left).includes(String(right));
			case 'startswith': return String(left).startsWith(String(right));
			case 'endswith': return String(left).endsWith(String(right));
			case 'regex': return new RegExp(String(right)).test(String(left));
			case 'custom':
				const func = new Function('left', 'right', 'context', config.code || 'return left === right;');
				return func(left, right, context);
			default:
				return false;
		}
	}

	private async executeLoopNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<any[]> {
		const config = node.config || {};
		const items = this.resolveValue(config.items, context) || [];
		const results = [];

		if (!Array.isArray(items)) {
			throw new Error(`Loop node ${node.id}: items must be an array`);
		}

		for (let i = 0; i < items.length; i++) {
			const itemContext = {
				...context,
				_item: items[i],
				_index: i,
				_isFirst: i === 0,
				_isLast: i === items.length - 1
			};

			// TODO: Execute connected subgraph for each item
			results.push(items[i]);
		}

		return results;
	}

	private async executeAPINode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<any> {
		const config = node.config || {};
		const url = this.interpolateString(config.url || '', context);
		const method = config.method || 'GET';
		const headers = { ...config.headers };
		const body = config.body ? this.interpolateString(config.body, context) : undefined;

		// Replace variables in headers
		for (const [key, value] of Object.entries(headers)) {
			headers[key] = this.interpolateString(String(value), context);
		}

		const response = await fetch(url, {
			method,
			headers,
			body: body && method !== 'GET' ? body : undefined
		});

		if (!response.ok) {
			throw new Error(`API call failed: ${response.status} ${response.statusText}`);
		}

		const contentType = response.headers.get('content-type');
		if (contentType?.includes('application/json')) {
			return await response.json();
		} else {
			return await response.text();
		}
	}

	private async executeOutputNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<any> {
		const config = node.config || {};
		const output = this.resolveValue(config.value, context);
		
		// In production, this might write to a file, database, or API
		this.logService.info(`Output from node ${node.id}:`, output);
		return output;
	}

	private async executeParametersNode(node: FlowNode, context: Record<string, any>, options?: WorkflowExecutionOptions): Promise<Record<string, any>> {
		const config = node.config || {};
		return config.parameters || {};
	}

	private resolveValue(value: any, context: Record<string, any>): any {
		if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
			const key = value.slice(2, -2).trim();
			return context[key];
		}
		return value;
	}

	private interpolateString(template: string, context: Record<string, any>): string {
		return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
			const value = context[key.trim()];
			return value !== undefined ? String(value) : match;
		});
	}

	private buildExecutionGraph(workflow: WorkflowDefinition): Map<string, FlowNode[]> {
		const graph = new Map<string, FlowNode[]>();
		const nodeMap = new Map(workflow.nodes.map(node => [node.id, node]));

		// Initialize graph with all nodes
		for (const node of workflow.nodes) {
			graph.set(node.id, []);
		}

		// Build dependencies based on connections
		for (const connection of workflow.connections) {
			const dependencies = graph.get(connection.to) || [];
			const fromNode = nodeMap.get(connection.from);
			if (fromNode) {
				dependencies.push(fromNode);
				graph.set(connection.to, dependencies);
			}
		}

		return graph;
	}

	private async executeGraph(
		graph: Map<string, FlowNode[]>, 
		initialContext: Record<string, any>,
		execution: WorkflowExecutionResult,
		options?: WorkflowExecutionOptions
	): Promise<Record<string, any>> {
		const executed = new Set<string>();
		const results: Record<string, any> = { ...initialContext };

		const executeNodeRecursive = async (nodeId: string): Promise<any> => {
			if (executed.has(nodeId)) {
				return results[nodeId];
			}

			const dependencies = graph.get(nodeId) || [];
			
			// Execute all dependencies first
			for (const dep of dependencies) {
				await executeNodeRecursive(dep.id);
			}

			// Find the actual node
			const node = [...graph.keys()].find(id => id === nodeId);
			if (!node) {
				throw new Error(`Node not found: ${nodeId}`);
			}

			// Get the node object (this is a simplified approach)
			const nodeObj = dependencies.length > 0 ? dependencies[0] : null;
			if (!nodeObj) {
				// Find node in original workflow
				// This needs to be improved to properly find the node
				throw new Error(`Could not find node object for: ${nodeId}`);
			}

			this.addLog(execution, 'info', `Executing node: ${nodeObj.type}:${nodeObj.id}`);

			try {
				const result = await this.executeNode(nodeObj, results, options);
				results[nodeId] = result;
				executed.add(nodeId);

				// Track tokens and costs
				if (result && typeof result === 'object' && 'tokensUsed' in result) {
					execution.tokensUsed = (execution.tokensUsed || 0) + result.tokensUsed;
					execution.estimatedCost = (execution.estimatedCost || 0) + (result.estimatedCost || 0);
				}

				this.addLog(execution, 'info', `Node completed: ${nodeObj.type}:${nodeObj.id}`, nodeObj.id, { result });
				return result;
			} catch (error) {
				this.addLog(execution, 'error', `Node failed: ${nodeObj.type}:${nodeObj.id} - ${error}`, nodeObj.id, { error });
				throw error;
			}
		};

		// Execute all nodes
		for (const nodeId of graph.keys()) {
			await executeNodeRecursive(nodeId);
		}

		return results;
	}

	private addLog(execution: WorkflowExecutionResult, level: WorkflowExecutionLog['level'], message: string, nodeId?: string, data?: any): void {
		execution.logs.push({
			timestamp: new Date(),
			level,
			message,
			nodeId,
			data
		});
		this.logService.info(`[${execution.executionId}] ${message}`);
	}

	async validateWorkflow(workflow: WorkflowDefinition): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for required fields
		if (!workflow.name || workflow.name.trim() === '') {
			errors.push('Workflow name is required');
		}

		if (!workflow.nodes || workflow.nodes.length === 0) {
			errors.push('Workflow must have at least one node');
		}

		// Check for disconnected nodes
		const connectedNodes = new Set<string>();
		for (const conn of workflow.connections) {
			connectedNodes.add(conn.from);
			connectedNodes.add(conn.to);
		}

		const disconnectedNodes = workflow.nodes.filter(node => !connectedNodes.has(node.id));
		if (disconnectedNodes.length > 1) {
			warnings.push(`Found ${disconnectedNodes.length} disconnected nodes: ${disconnectedNodes.map(n => n.id).join(', ')}`);
		}

		// Check for circular dependencies
		if (this.hasCircularDependency(workflow)) {
			errors.push('Workflow contains circular dependencies');
		}

		// Validate node configurations
		for (const node of workflow.nodes) {
			const nodeErrors = await this.validateNodeConfiguration(node);
			errors.push(...nodeErrors);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	private hasCircularDependency(workflow: WorkflowDefinition): boolean {
		const visited = new Set<string>();
		const recursionStack = new Set<string>();

		const dfs = (nodeId: string): boolean => {
			visited.add(nodeId);
			recursionStack.add(nodeId);

			// Find all outgoing connections
			const outgoing = workflow.connections.filter(conn => conn.from === nodeId);
			for (const conn of outgoing) {
				if (!visited.has(conn.to)) {
					if (dfs(conn.to)) return true;
				} else if (recursionStack.has(conn.to)) {
					return true; // Circular dependency found
				}
			}

			recursionStack.delete(nodeId);
			return false;
		};

		for (const node of workflow.nodes) {
			if (!visited.has(node.id)) {
				if (dfs(node.id)) return true;
			}
		}

		return false;
	}

	private async validateNodeConfiguration(node: FlowNode): Promise<string[]> {
		const errors: string[] = [];
		const config = node.config || {};

		switch (node.type) {
			case 'llm':
				if (!config.provider) {
					errors.push(`LLM node ${node.id}: provider is required`);
				}
				if (!config.model) {
					errors.push(`LLM node ${node.id}: model is required`);
				}
				break;
			case 'api':
				if (!config.url) {
					errors.push(`API node ${node.id}: URL is required`);
				}
				break;
			case 'transform':
				if (!config.type) {
					errors.push(`Transform node ${node.id}: transformation type is required`);
				}
				break;
		}

		return errors;
	}

	async cancelExecution(executionId: string): Promise<boolean> {
		const execution = this.activeExecutions.get(executionId);
		if (!execution) {
			return false;
		}

		execution.status = 'cancelled';
		execution.endTime = new Date();
		execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

		this.addLog(execution, 'info', 'Workflow execution cancelled by user');
		this._onExecutionCancelled.fire(execution);
		this.activeExecutions.delete(executionId);

		return true;
	}

	async getExecutionStatus(executionId: string): Promise<WorkflowExecutionResult | null> {
		return this.activeExecutions.get(executionId) || null;
	}

	async listActiveExecutions(): Promise<WorkflowExecutionResult[]> {
		return Array.from(this.activeExecutions.values());
	}

	async exportWorkflow(workflow: WorkflowDefinition, format: 'json' | 'yaml' | 'script' | 'api'): Promise<string> {
		switch (format) {
			case 'json':
				return JSON.stringify(workflow, null, 2);
			
			case 'yaml':
				// Simple YAML export (in production, use a proper YAML library)
				return this.convertToYaml(workflow);
			
			case 'script':
				return this.generateExecutionScript(workflow);
			
			case 'api':
				return this.generateAPIDefinition(workflow);
			
			default:
				throw new Error(`Unsupported export format: ${format}`);
		}
	}

	private convertToYaml(workflow: WorkflowDefinition): string {
		// Simplified YAML conversion
		let yaml = `name: ${workflow.name}\n`;
		yaml += `id: ${workflow.id}\n`;
		if (workflow.description) yaml += `description: ${workflow.description}\n`;
		yaml += `nodes:\n`;
		
		for (const node of workflow.nodes) {
			yaml += `  - id: ${node.id}\n`;
			yaml += `    type: ${node.type}\n`;
			yaml += `    label: ${node.label}\n`;
			if (node.config && Object.keys(node.config).length > 0) {
				yaml += `    config:\n`;
				for (const [key, value] of Object.entries(node.config)) {
					yaml += `      ${key}: ${JSON.stringify(value)}\n`;
				}
			}
		}

		yaml += `connections:\n`;
		for (const conn of workflow.connections) {
			yaml += `  - from: ${conn.from}\n`;
			yaml += `    to: ${conn.to}\n`;
		}

		return yaml;
	}

	private generateExecutionScript(workflow: WorkflowDefinition): string {
		let script = `#!/usr/bin/env node\n`;
		script += `// Auto-generated execution script for workflow: ${workflow.name}\n`;
		script += `// Generated on: ${new Date().toISOString()}\n\n`;
		script += `const { PrompdWorkflowExecutionService } = require('@prompd/workflow-engine');\n\n`;
		script += `const workflow = ${JSON.stringify(workflow, null, 2)};\n\n`;
		script += `async function executeWorkflow() {\n`;
		script += `  const service = new PrompdWorkflowExecutionService();\n`;
		script += `  try {\n`;
		script += `    const result = await service.executeWorkflow(workflow);\n`;
		script += `    console.log('Workflow completed:', result);\n`;
		script += `  } catch (error) {\n`;
		script += `    console.error('Workflow failed:', error);\n`;
		script += `    process.exit(1);\n`;
		script += `  }\n`;
		script += `}\n\n`;
		script += `executeWorkflow();\n`;
		
		return script;
	}

	private generateAPIDefinition(workflow: WorkflowDefinition): string {
		const api = {
			openapi: '3.0.0',
			info: {
				title: `${workflow.name} API`,
				description: workflow.description || `Auto-generated API for workflow: ${workflow.name}`,
				version: '1.0.0'
			},
			paths: {
				[`/workflows/${workflow.id}/execute`]: {
					post: {
						summary: `Execute workflow: ${workflow.name}`,
						requestBody: {
							content: {
								'application/json': {
									schema: {
										type: 'object',
										properties: {
											variables: {
												type: 'object',
												description: 'Input variables for the workflow'
											},
											options: {
												type: 'object',
												properties: {
													timeout: { type: 'integer' },
													maxRetries: { type: 'integer' },
													debugMode: { type: 'boolean' }
												}
											}
										}
									}
								}
							}
						},
						responses: {
							'200': {
								description: 'Workflow execution completed',
								content: {
									'application/json': {
										schema: {
											type: 'object',
											properties: {
												executionId: { type: 'string' },
												status: { type: 'string' },
												results: { type: 'object' },
												duration: { type: 'integer' },
												tokensUsed: { type: 'integer' },
												estimatedCost: { type: 'number' }
											}
										}
									}
								}
							}
						}
					}
				}
			}
		};

		return JSON.stringify(api, null, 2);
	}

	async generateDeploymentConfig(workflow: WorkflowDefinition, environment: 'local' | 'cloud' | 'docker' | 'kubernetes'): Promise<any> {
		switch (environment) {
			case 'local':
				return {
					type: 'local',
					executable: 'node',
					script: `workflow-${workflow.id}.js`,
					environment: {
						NODE_ENV: 'production'
					}
				};

			case 'docker':
				return {
					dockerfile: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY workflow-${workflow.id}.js ./
EXPOSE 3000
CMD ["node", "workflow-${workflow.id}.js"]`,
					'docker-compose.yml': `version: '3.8'
services:
  workflow-${workflow.id}:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped`
				};

			case 'kubernetes':
				return {
					deployment: {
						apiVersion: 'apps/v1',
						kind: 'Deployment',
						metadata: {
							name: `workflow-${workflow.id}`,
							labels: {
								app: `workflow-${workflow.id}`
							}
						},
						spec: {
							replicas: 2,
							selector: {
								matchLabels: {
									app: `workflow-${workflow.id}`
								}
							},
							template: {
								metadata: {
									labels: {
										app: `workflow-${workflow.id}`
									}
								},
								spec: {
									containers: [{
										name: 'workflow',
										image: `prompd/workflow-${workflow.id}:latest`,
										ports: [{
											containerPort: 3000
										}],
										env: [{
											name: 'NODE_ENV',
											value: 'production'
										}]
									}]
								}
							}
						}
					},
					service: {
						apiVersion: 'v1',
						kind: 'Service',
						metadata: {
							name: `workflow-${workflow.id}-service`
						},
						spec: {
							selector: {
								app: `workflow-${workflow.id}`
							},
							ports: [{
								protocol: 'TCP',
								port: 80,
								targetPort: 3000
							}],
							type: 'LoadBalancer'
						}
					}
				};

			case 'cloud':
				return {
					platform: 'aws-lambda',
					runtime: 'nodejs18.x',
					handler: `workflow-${workflow.id}.handler`,
					timeout: 300,
					memorySize: 1024,
					environment: {
						NODE_ENV: 'production'
					},
					triggers: [{
						type: 'api-gateway',
						path: `/workflows/${workflow.id}/execute`,
						method: 'POST'
					}]
				};

			default:
				throw new Error(`Unsupported deployment environment: ${environment}`);
		}
	}
}
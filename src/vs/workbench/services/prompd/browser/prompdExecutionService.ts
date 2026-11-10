/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event, Emitter } from 'vs/base/common/event';
import { CancellationToken } from 'vs/base/common/cancellation';

export interface IPrompdExecutionService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Execute a prompt with the specified provider
	 */
	executePrompt(prompt: string, provider: PromptProvider, options?: ExecutionOptions): Promise<ExecutionResult>;
	
	/**
	 * Execute a workflow of connected prompts
	 */
	executeWorkflow(workflow: PromptWorkflow, options?: ExecutionOptions): Promise<WorkflowResult>;
	
	/**
	 * Stream execution results
	 */
	streamExecution(prompt: string, provider: PromptProvider, options?: StreamOptions): AsyncIterable<string>;
	
	/**
	 * Get available providers
	 */
	getProviders(): PromptProvider[];
	
	/**
	 * Add custom provider
	 */
	registerProvider(provider: PromptProvider): void;
	
	/**
	 * Event fired when execution starts
	 */
	onDidStartExecution: Event<ExecutionEvent>;
	
	/**
	 * Event fired when execution completes
	 */
	onDidCompleteExecution: Event<ExecutionEvent>;
	
	/**
	 * Event fired on execution error
	 */
	onDidExecutionError: Event<ExecutionError>;
}

export const IPrompdExecutionService = createDecorator<IPrompdExecutionService>('prompdExecutionService');

export interface PromptProvider {
	id: string;
	name: string;
	type: 'openai' | 'anthropic' | 'google' | 'azure' | 'local' | 'custom';
	models: ModelConfig[];
	apiKey?: string;
	endpoint?: string;
	configured: boolean;
}

export interface ModelConfig {
	id: string;
	name: string;
	maxTokens: number;
	contextWindow: number;
	costPer1kTokens?: {
		input: number;
		output: number;
	};
}

export interface ExecutionOptions {
	model?: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	stopSequences?: string[];
	systemPrompt?: string;
	parameters?: Record<string, any>;
	timeout?: number;
}

export interface StreamOptions extends ExecutionOptions {
	onChunk?: (chunk: string) => void;
	onComplete?: (fullResponse: string) => void;
	onError?: (error: Error) => void;
}

export interface ExecutionResult {
	prompt: string;
	response: string;
	provider: string;
	model: string;
	tokensUsed: {
		prompt: number;
		completion: number;
		total: number;
	};
	executionTime: number;
	cost?: number;
	metadata?: Record<string, any>;
}

export interface PromptWorkflow {
	id: string;
	name: string;
	nodes: WorkflowNode[];
	connections: WorkflowConnection[];
}

export interface WorkflowNode {
	id: string;
	type: 'prompt' | 'transform' | 'condition' | 'loop' | 'api' | 'output';
	data: {
		prompt?: string;
		provider?: string;
		model?: string;
		transform?: string;
		condition?: string;
		[key: string]: any;
	};
}

export interface WorkflowConnection {
	from: string;
	to: string;
	condition?: string;
}

export interface WorkflowResult {
	workflowId: string;
	results: Map<string, ExecutionResult>;
	totalTime: number;
	totalCost?: number;
	success: boolean;
	errors?: string[];
}

export interface ExecutionEvent {
	id: string;
	type: 'start' | 'complete' | 'error';
	timestamp: number;
	data?: any;
}

export interface ExecutionError {
	message: string;
	code?: string;
	provider?: string;
	details?: any;
}

/**
 * Native prompt execution service for Prompd IDE
 */
export class PrompdExecutionService extends Disposable implements IPrompdExecutionService {
	readonly _serviceBrand: undefined;

	private providers: Map<string, PromptProvider> = new Map();
	private activeExecutions: Map<string, CancellationToken> = new Map();
	
	private readonly _onDidStartExecution = this._register(new Emitter<ExecutionEvent>());
	readonly onDidStartExecution = this._onDidStartExecution.event;
	
	private readonly _onDidCompleteExecution = this._register(new Emitter<ExecutionEvent>());
	readonly onDidCompleteExecution = this._onDidCompleteExecution.event;
	
	private readonly _onDidExecutionError = this._register(new Emitter<ExecutionError>());
	readonly onDidExecutionError = this._onDidExecutionError.event;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.initializeProviders();
	}

	private initializeProviders(): void {
		// Initialize built-in providers
		this.providers.set('openai', {
			id: 'openai',
			name: 'OpenAI',
			type: 'openai',
			configured: false,
			models: [
				{
					id: 'gpt-4-turbo-preview',
					name: 'GPT-4 Turbo',
					maxTokens: 4096,
					contextWindow: 128000,
					costPer1kTokens: { input: 0.01, output: 0.03 }
				},
				{
					id: 'gpt-4',
					name: 'GPT-4',
					maxTokens: 8192,
					contextWindow: 8192,
					costPer1kTokens: { input: 0.03, output: 0.06 }
				},
				{
					id: 'gpt-3.5-turbo',
					name: 'GPT-3.5 Turbo',
					maxTokens: 4096,
					contextWindow: 16385,
					costPer1kTokens: { input: 0.0005, output: 0.0015 }
				}
			]
		});

		this.providers.set('anthropic', {
			id: 'anthropic',
			name: 'Anthropic',
			type: 'anthropic',
			configured: false,
			models: [
				{
					id: 'claude-3-opus-20240229',
					name: 'Claude 3 Opus',
					maxTokens: 4096,
					contextWindow: 200000,
					costPer1kTokens: { input: 0.015, output: 0.075 }
				},
				{
					id: 'claude-3-sonnet-20240229',
					name: 'Claude 3 Sonnet',
					maxTokens: 4096,
					contextWindow: 200000,
					costPer1kTokens: { input: 0.003, output: 0.015 }
				},
				{
					id: 'claude-3-haiku-20240307',
					name: 'Claude 3 Haiku',
					maxTokens: 4096,
					contextWindow: 200000,
					costPer1kTokens: { input: 0.00025, output: 0.00125 }
				}
			]
		});

		// Load provider configurations from storage
		this.loadProviderConfigs();
	}

	private loadProviderConfigs(): void {
		const configs = this.storageService.get('prompd.providers', StorageScope.PROFILE, '{}');
		try {
			const parsed = JSON.parse(configs);
			Object.entries(parsed).forEach(([id, config]: [string, any]) => {
				if (this.providers.has(id)) {
					const provider = this.providers.get(id)!;
					provider.apiKey = config.apiKey;
					provider.endpoint = config.endpoint;
					provider.configured = !!config.apiKey;
				}
			});
		} catch (e) {
			this.logService.error('Failed to load provider configs', e);
		}
	}

	async executePrompt(prompt: string, provider: PromptProvider, options?: ExecutionOptions): Promise<ExecutionResult> {
		const executionId = this.generateExecutionId();
		const startTime = Date.now();

		// Fire start event
		this._onDidStartExecution.fire({
			id: executionId,
			type: 'start',
			timestamp: startTime,
			data: { prompt, provider: provider.id }
		});

		try {
			// Validate provider
			if (!provider.configured) {
				throw new Error(`Provider ${provider.name} is not configured`);
			}

			// Build the request based on provider type
			let response: string;
			let tokensUsed = { prompt: 0, completion: 0, total: 0 };

			switch (provider.type) {
				case 'openai':
					response = await this.executeOpenAI(prompt, provider, options);
					tokensUsed = this.estimateTokens(prompt, response);
					break;
				
				case 'anthropic':
					response = await this.executeAnthropic(prompt, provider, options);
					tokensUsed = this.estimateTokens(prompt, response);
					break;
				
				case 'google':
					response = await this.executeGoogle(prompt, provider, options);
					tokensUsed = this.estimateTokens(prompt, response);
					break;
				
				default:
					// Mock response for development
					response = `[Mock Response from ${provider.name}]\n\nPrompt received: "${prompt}"\n\nThis is a simulated response. To use real AI providers, configure API keys in settings.`;
					tokensUsed = this.estimateTokens(prompt, response);
			}

			const result: ExecutionResult = {
				prompt,
				response,
				provider: provider.id,
				model: options?.model || provider.models[0].id,
				tokensUsed,
				executionTime: Date.now() - startTime,
				cost: this.calculateCost(tokensUsed, provider, options?.model)
			};

			// Fire complete event
			this._onDidCompleteExecution.fire({
				id: executionId,
				type: 'complete',
				timestamp: Date.now(),
				data: result
			});

			return result;

		} catch (error: any) {
			// Fire error event
			this._onDidExecutionError.fire({
				message: error.message,
				provider: provider.id,
				details: error
			});
			throw error;
		}
	}

	async executeWorkflow(workflow: PromptWorkflow, options?: ExecutionOptions): Promise<WorkflowResult> {
		const startTime = Date.now();
		const results = new Map<string, ExecutionResult>();
		const errors: string[] = [];
		let totalCost = 0;

		try {
			// Topologically sort nodes based on connections
			const sortedNodes = this.topologicalSort(workflow.nodes, workflow.connections);

			// Execute nodes in order
			for (const node of sortedNodes) {
				try {
					if (node.type === 'prompt' && node.data.prompt) {
						const provider = this.providers.get(node.data.provider || 'openai');
						if (provider) {
							// Replace variables in prompt with results from previous nodes
							const processedPrompt = this.processPromptVariables(node.data.prompt, results);
							
							const result = await this.executePrompt(processedPrompt, provider, {
								...options,
								model: node.data.model || options?.model
							});
							
							results.set(node.id, result);
							if (result.cost) totalCost += result.cost;
						}
					} else if (node.type === 'transform' && node.data.transform) {
						// Apply transformation to previous results
						const transformed = this.applyTransform(node.data.transform, results);
						results.set(node.id, {
							prompt: node.data.transform,
							response: transformed,
							provider: 'transform',
							model: 'none',
							tokensUsed: { prompt: 0, completion: 0, total: 0 },
							executionTime: 0
						});
					}
				} catch (nodeError: any) {
					errors.push(`Node ${node.id}: ${nodeError.message}`);
					this.logService.error(`Workflow execution error at node ${node.id}`, nodeError);
				}
			}

			return {
				workflowId: workflow.id,
				results,
				totalTime: Date.now() - startTime,
				totalCost,
				success: errors.length === 0,
				errors: errors.length > 0 ? errors : undefined
			};

		} catch (error: any) {
			this.logService.error('Workflow execution failed', error);
			throw error;
		}
	}

	async *streamExecution(prompt: string, provider: PromptProvider, options?: StreamOptions): AsyncIterable<string> {
		// Mock streaming for now
		const response = await this.executePrompt(prompt, provider, options);
		const words = response.response.split(' ');
		
		for (const word of words) {
			yield word + ' ';
			await this.delay(50); // Simulate streaming delay
		}
	}

	getProviders(): PromptProvider[] {
		return Array.from(this.providers.values());
	}

	registerProvider(provider: PromptProvider): void {
		this.providers.set(provider.id, provider);
		this.saveProviderConfigs();
	}

	private async executeOpenAI(prompt: string, provider: PromptProvider, options?: ExecutionOptions): Promise<string> {
		// TODO: Implement actual OpenAI API call
		// For now, return mock response
		return `[OpenAI Response - ${options?.model || 'gpt-4'}]\n\n${this.generateMockResponse(prompt)}`;
	}

	private async executeAnthropic(prompt: string, provider: PromptProvider, options?: ExecutionOptions): Promise<string> {
		// TODO: Implement actual Anthropic API call
		// For now, return mock response
		return `[Anthropic Response - ${options?.model || 'claude-3-opus'}]\n\n${this.generateMockResponse(prompt)}`;
	}

	private async executeGoogle(prompt: string, provider: PromptProvider, options?: ExecutionOptions): Promise<string> {
		// TODO: Implement actual Google API call
		// For now, return mock response
		return `[Google Response - ${options?.model || 'gemini-pro'}]\n\n${this.generateMockResponse(prompt)}`;
	}

	private generateMockResponse(prompt: string): string {
		const responses = [
			"Based on your prompt, here's a comprehensive analysis...",
			"I understand you're asking about this topic. Let me explain...",
			"That's an interesting question. Here's what I think...",
			"Let me break this down for you step by step..."
		];
		return responses[Math.floor(Math.random() * responses.length)] + 
			`\n\nYour prompt was: "${prompt}"\n\n` +
			"This is a simulated response for development purposes. Configure real API providers in settings to get actual AI responses.";
	}

	private estimateTokens(prompt: string, response: string): { prompt: number; completion: number; total: number } {
		// Rough estimation: 1 token ≈ 4 characters
		const promptTokens = Math.ceil(prompt.length / 4);
		const completionTokens = Math.ceil(response.length / 4);
		return {
			prompt: promptTokens,
			completion: completionTokens,
			total: promptTokens + completionTokens
		};
	}

	private calculateCost(tokens: { prompt: number; completion: number; total: number }, provider: PromptProvider, modelId?: string): number {
		const model = provider.models.find(m => m.id === modelId) || provider.models[0];
		if (!model.costPer1kTokens) return 0;
		
		const inputCost = (tokens.prompt / 1000) * model.costPer1kTokens.input;
		const outputCost = (tokens.completion / 1000) * model.costPer1kTokens.output;
		return inputCost + outputCost;
	}

	private topologicalSort(nodes: WorkflowNode[], connections: WorkflowConnection[]): WorkflowNode[] {
		// Simple topological sort for DAG
		const sorted: WorkflowNode[] = [];
		const visited = new Set<string>();
		const nodeMap = new Map(nodes.map(n => [n.id, n]));

		const visit = (nodeId: string) => {
			if (visited.has(nodeId)) return;
			visited.add(nodeId);
			
			// Visit dependencies first
			const deps = connections.filter(c => c.to === nodeId);
			deps.forEach(dep => visit(dep.from));
			
			const node = nodeMap.get(nodeId);
			if (node) sorted.push(node);
		};

		nodes.forEach(n => visit(n.id));
		return sorted;
	}

	private processPromptVariables(prompt: string, results: Map<string, ExecutionResult>): string {
		// Replace {{nodeId.output}} with actual results
		return prompt.replace(/\{\{(\w+)\.output\}\}/g, (match, nodeId) => {
			const result = results.get(nodeId);
			return result ? result.response : match;
		});
	}

	private applyTransform(transform: string, results: Map<string, ExecutionResult>): string {
		// Simple transform implementation
		// TODO: Implement more sophisticated transformations
		return `Transformed: ${Array.from(results.values()).map(r => r.response).join('\n')}`;
	}

	private saveProviderConfigs(): void {
		const configs: Record<string, any> = {};
		this.providers.forEach((provider, id) => {
			if (provider.configured) {
				configs[id] = {
					apiKey: provider.apiKey,
					endpoint: provider.endpoint
				};
			}
		});
		this.storageService.store('prompd.providers', JSON.stringify(configs), StorageScope.PROFILE, StorageTarget.USER);
	}

	private generateExecutionId(): string {
		return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
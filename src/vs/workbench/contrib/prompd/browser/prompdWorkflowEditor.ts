/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IEditorInput } from 'vs/workbench/common/editor';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IPrompdService } from 'vs/platform/prompd/common/prompd';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import * as DOM from 'vs/base/browser/dom';
import { NodeConfigurationManager } from './prompdNodeConfiguration';
import { IPrompdWorkflowExecutionService, WorkflowDefinition } from 'vs/workbench/services/prompd/browser/prompdWorkflowExecutionService';

interface FlowNode {
	id: string;
	type: string;
	x: number;
	y: number;
	label: string;
	config?: any;
}

interface FlowConnection {
	from: string;
	to: string;
	fromPort?: string;
	toPort?: string;
}

interface PrompdFlow {
	nodes: FlowNode[];
	connections: FlowConnection[];
}

/**
 * Native workflow editor for prompd IDE
 * Replaces the webview-based implementation with native VS Code components
 */
export class PrompdWorkflowEditor extends EditorPane {
	static readonly ID = 'prompdWorkflowEditor';

	private container!: HTMLElement;
	private canvas!: HTMLCanvasElement;
	private ctx!: CanvasRenderingContext2D;
	private nodes: Map<string, FlowNode> = new Map();
	private connections: FlowConnection[] = [];
	private selectedNode: string | null = null;
	private draggedNode: string | null = null;
	private dragOffset = { x: 0, y: 0 };
	private panOffset = { x: 0, y: 0 };
	private zoom = 1;
	private isPanning = false;
	private lastMousePos = { x: 0, y: 0 };
	private nodeIdCounter = 0;
	private nodeConfigManager!: NodeConfigurationManager;

	constructor(
		id: string,
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IPrompdService private readonly prompdService: IPrompdService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IPrompdWorkflowExecutionService private readonly workflowExecutionService: IPrompdWorkflowExecutionService
	) {
		super(id, group, telemetryService, themeService, storageService);
	}

	create(parent: HTMLElement): void {
		this.createEditor(parent);
	}

	protected createEditor(parent: HTMLElement): void {
		console.log('🚀 Creating workflow editor in parent:', parent);
		this.container = DOM.append(parent, DOM.$('.prompd-workflow-editor'));
		this.container.style.cssText = 'width: 100%; height: 100%; position: relative; overflow: hidden;';
		console.log('✅ Workflow editor container created:', this.container);

		// Create toolbar
		const toolbar = DOM.append(this.container, DOM.$('.workflow-toolbar'));
		toolbar.style.cssText = `
			position: absolute;
			top: 10px;
			left: 10px;
			z-index: 100;
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 8px;
			display: flex;
			gap: 8px;
		`;

		this.createToolbarButtons(toolbar);

		// Create node palette
		const palette = DOM.append(this.container, DOM.$('.node-palette'));
		palette.style.cssText = `
			position: absolute;
			top: 10px;
			right: 10px;
			width: 200px;
			z-index: 100;
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 8px;
		`;

		this.createNodePalette(palette);

		// Create canvas
		this.canvas = DOM.append(this.container, DOM.$('canvas')) as HTMLCanvasElement;
		console.log('✅ Canvas created:', this.canvas);
		this.canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
		this.ctx = this.canvas.getContext('2d')!;

		// Set canvas size
		this.resizeCanvas();
		window.addEventListener('resize', () => this.resizeCanvas());

		// Initialize node configuration manager
		this.nodeConfigManager = new NodeConfigurationManager(this.container);

		// Setup event handlers
		this.setupEventHandlers();

		// Initial render
		this.render();
		
		console.log('✅ Workflow editor setup complete');
	}

	private createToolbarButtons(toolbar: HTMLElement): void {
		const buttons = [
			{ icon: '⬜', tooltip: 'Add Prompt Node', action: () => this.addNode('prompt') },
			{ icon: '🔄', tooltip: 'Add Transform Node', action: () => this.addNode('transform') },
			{ icon: '⚡', tooltip: 'Add API Node', action: () => this.addNode('api') },
			{ icon: '🔀', tooltip: 'Add Condition Node', action: () => this.addNode('condition') },
			{ icon: '➕', tooltip: 'Zoom In', action: () => this.changeZoom(0.1) },
			{ icon: '➖', tooltip: 'Zoom Out', action: () => this.changeZoom(-0.1) },
			{ icon: '🔄', tooltip: 'Reset View', action: () => this.resetView() },
			{ icon: '▶️', tooltip: 'Execute Flow', action: () => this.executeFlow() },
		];

		console.log('🔧 Creating toolbar buttons:', buttons.length);

		buttons.forEach(btn => {
			const button = DOM.append(toolbar, DOM.$('button'));
			button.textContent = btn.icon;
			button.title = btn.tooltip;
			button.style.cssText = `
				padding: 4px 8px;
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border: none;
				border-radius: 2px;
				cursor: pointer;
			`;
			button.onclick = btn.action;
		});
	}

	private createNodePalette(palette: HTMLElement): void {
		const title = DOM.append(palette, DOM.$('div'));
		title.textContent = 'Node Types';
		title.style.cssText = 'font-weight: bold; margin-bottom: 8px;';

		const nodeTypes = [
			{ type: 'prompt', label: '📝 Prompt', color: '#4CAF50' },
			{ type: 'llm', label: '🤖 LLM', color: '#2196F3' },
			{ type: 'transform', label: '🔄 Transform', color: '#FF9800' },
			{ type: 'condition', label: '🔀 Condition', color: '#9C27B0' },
			{ type: 'loop', label: '🔁 Loop', color: '#00BCD4' },
			{ type: 'api', label: '⚡ API', color: '#FFC107' },
			{ type: 'output', label: '📤 Output', color: '#8BC34A' },
			{ type: 'parameters', label: '📊 Parameters (JSON)', color: '#3F51B5' }
		];

		nodeTypes.forEach(nodeType => {
			const item = DOM.append(palette, DOM.$('.palette-item'));
			item.textContent = nodeType.label;
			item.style.cssText = `
				padding: 8px;
				margin: 4px 0;
				background: ${nodeType.color}22;
				border: 1px solid ${nodeType.color};
				border-radius: 4px;
				cursor: move;
				user-select: none;
			`;
			item.draggable = true;
			item.ondragstart = (e) => {
				console.log('🚀 Drag started:', nodeType.type, nodeType.color);
				e.dataTransfer!.setData('nodeType', nodeType.type);
				e.dataTransfer!.setData('nodeColor', nodeType.color);
				e.dataTransfer!.effectAllowed = 'copy';
			};
		});
	}

	private setupEventHandlers(): void {
		console.log('🔌 Setting up event handlers for canvas:', this.canvas);
		
		// Mouse events
		this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
		this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
		this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
		this.canvas.addEventListener('wheel', this.onWheel.bind(this));
		this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));

		// Drag and drop - add more debugging
		this.canvas.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'copy';
			console.log('📍 Drag over canvas');
		});
		this.canvas.addEventListener('dragenter', (e) => {
			e.preventDefault();
			console.log('🎯 Drag enter canvas');
		});
		this.canvas.addEventListener('dragleave', (e) => {
			console.log('🚪 Drag leave canvas');
		});
		this.canvas.addEventListener('drop', this.onDrop.bind(this));

		// Also add drag/drop to the container in case canvas isn't receiving events
		this.container.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'copy';
			console.log('📍 Drag over container');
		});
		this.container.addEventListener('drop', (e) => {
			console.log('🎯 Drop on container - forwarding to onDrop');
			this.onDrop(e);
		});

		// Keyboard events
		this.container.addEventListener('keydown', this.onKeyDown.bind(this));
		this.container.tabIndex = 0;
		
		console.log('✅ Event handlers setup complete');
	}

	private onMouseDown(e: MouseEvent): void {
		const pos = this.getMousePos(e);
		const node = this.getNodeAt(pos.x, pos.y);

		if (e.button === 0) { // Left click
			if (node) {
				this.selectedNode = node.id;
				this.draggedNode = node.id;
				this.dragOffset = {
					x: pos.x - node.x,
					y: pos.y - node.y
				};
			} else {
				this.selectedNode = null;
			}
		} else if (e.button === 1 || e.spaceKey) { // Middle click or space
			this.isPanning = true;
			this.lastMousePos = pos;
			this.canvas.style.cursor = 'grab';
		}

		this.render();
	}

	private onMouseMove(e: MouseEvent): void {
		const pos = this.getMousePos(e);

		if (this.draggedNode && this.nodes.has(this.draggedNode)) {
			const node = this.nodes.get(this.draggedNode)!;
			node.x = pos.x - this.dragOffset.x;
			node.y = pos.y - this.dragOffset.y;
			this.render();
		} else if (this.isPanning) {
			this.panOffset.x += pos.x - this.lastMousePos.x;
			this.panOffset.y += pos.y - this.lastMousePos.y;
			this.lastMousePos = pos;
			this.render();
		}
	}

	private onMouseUp(e: MouseEvent): void {
		this.draggedNode = null;
		this.isPanning = false;
		this.canvas.style.cursor = 'default';
	}

	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.05 : 0.05;
		this.changeZoom(delta);
	}

	private onDoubleClick(e: MouseEvent): void {
		const pos = this.getMousePos(e);
		const node = this.getNodeAt(pos.x, pos.y);
		if (node) {
			this.configureNode(node);
		}
	}

	private onDrop(e: DragEvent): void {
		e.preventDefault();
		console.log('🎯 Drop event triggered', e);
		
		const nodeType = e.dataTransfer!.getData('nodeType');
		const nodeColor = e.dataTransfer!.getData('nodeColor');
		
		console.log('📦 Drop data:', { nodeType, nodeColor });
		
		if (nodeType) {
			const pos = this.getMousePos(e);
			console.log('📍 Drop position:', pos);
			
			this.addNodeAt(nodeType, pos.x, pos.y, nodeColor);
			console.log('✅ Node added at position:', pos);
		} else {
			console.log('❌ No nodeType in drop data');
		}
	}

	private onKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Delete' && this.selectedNode) {
			this.deleteNode(this.selectedNode);
		} else if (e.key === ' ') {
			e.preventDefault();
			this.isPanning = true;
			this.canvas.style.cursor = 'grab';
		}
	}

	private getMousePos(e: MouseEvent | DragEvent): { x: number; y: number } {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left - this.panOffset.x) / this.zoom,
			y: (e.clientY - rect.top - this.panOffset.y) / this.zoom
		};
	}

	private getNodeAt(x: number, y: number): FlowNode | null {
		for (const node of this.nodes.values()) {
			if (x >= node.x - 50 && x <= node.x + 50 &&
				y >= node.y - 30 && y <= node.y + 30) {
				return node;
			}
		}
		return null;
	}

	private addNode(type: string): void {
		const centerX = this.canvas.width / 2 / this.zoom - this.panOffset.x / this.zoom;
		const centerY = this.canvas.height / 2 / this.zoom - this.panOffset.y / this.zoom;
		this.addNodeAt(type, centerX, centerY);
	}

	private addNodeAt(type: string, x: number, y: number, color?: string): void {
		const id = 'node_' + (this.nodeIdCounter++);
		const node: FlowNode = {
			id,
			type,
			x,
			y,
			label: type.charAt(0).toUpperCase() + type.slice(1) + ' Node'
		};
		this.nodes.set(id, node);
		this.render();
	}

	private deleteNode(nodeId: string): void {
		this.nodes.delete(nodeId);
		this.connections = this.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
		this.selectedNode = null;
		this.render();
	}

	private async configureNode(node: FlowNode): Promise<void> {
		console.log('🔧 Configuring node:', node);
		
		try {
			const config = await this.nodeConfigManager.openConfigurationDialog(node.type, node.config || {});
			if (config) {
				// Update node configuration
				node.config = config;
				console.log('✅ Node configuration updated:', node.id, config);
				
				// Re-render to show any visual changes
				this.render();
			}
		} catch (error) {
			console.error('❌ Error configuring node:', error);
		}
	}

	private changeZoom(delta: number): void {
		this.zoom = Math.max(0.1, Math.min(3, this.zoom + delta));
		this.render();
	}

	private resetView(): void {
		this.zoom = 1;
		this.panOffset = { x: 0, y: 0 };
		this.render();
	}

	private async executeFlow(): Promise<void> {
		const flow: PrompdFlow = {
			nodes: Array.from(this.nodes.values()),
			connections: this.connections
		};

		// Convert to workflow definition format
		const workflow: WorkflowDefinition = {
			id: `workflow_${Date.now()}`,
			name: 'Untitled Workflow',
			description: 'Workflow executed from canvas',
			nodes: flow.nodes.map(node => ({
				id: node.id,
				type: node.type,
				x: node.x,
				y: node.y,
				label: node.label,
				config: node.config
			})),
			connections: flow.connections,
			metadata: {
				version: '1.0.0',
				created: new Date(),
				modified: new Date(),
				tags: ['canvas-execution']
			}
		};

		console.log('🚀 Executing workflow:', workflow);

		try {
			// Validate workflow before execution
			const validation = await this.workflowExecutionService.validateWorkflow(workflow);
			if (!validation.valid) {
				console.error('❌ Workflow validation failed:', validation.errors);
				// TODO: Show validation errors in UI
				return;
			}

			if (validation.warnings.length > 0) {
				console.warn('⚠️ Workflow warnings:', validation.warnings);
			}

			// Execute the workflow
			const result = await this.workflowExecutionService.executeWorkflow(workflow, {
				debugMode: true,
				timeout: 30000 // 30 second timeout
			});

			console.log('✅ Workflow execution completed:', result);
			// TODO: Show execution results in UI panel

		} catch (error) {
			console.error('❌ Workflow execution failed:', error);
			// TODO: Show error in UI
		}
	}

	private resizeCanvas(): void {
		this.canvas.width = this.container.clientWidth;
		this.canvas.height = this.container.clientHeight;
		this.render();
	}

	private render(): void {
		const ctx = this.ctx;
		
		// Clear canvas
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Apply transformations
		ctx.save();
		ctx.translate(this.panOffset.x, this.panOffset.y);
		ctx.scale(this.zoom, this.zoom);

		// Draw grid
		this.drawGrid();

		// Draw connections
		this.connections.forEach(conn => this.drawConnection(conn));

		// Draw nodes
		this.nodes.forEach(node => this.drawNode(node));

		ctx.restore();
	}

	private drawGrid(): void {
		const ctx = this.ctx;
		const gridSize = 20;
		const width = this.canvas.width / this.zoom;
		const height = this.canvas.height / this.zoom;
		const offsetX = -this.panOffset.x / this.zoom;
		const offsetY = -this.panOffset.y / this.zoom;

		ctx.strokeStyle = '#333333';
		ctx.lineWidth = 0.5;

		for (let x = offsetX % gridSize; x < width + offsetX; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, offsetY);
			ctx.lineTo(x, height + offsetY);
			ctx.stroke();
		}

		for (let y = offsetY % gridSize; y < height + offsetY; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(offsetX, y);
			ctx.lineTo(width + offsetX, y);
			ctx.stroke();
		}
	}

	private drawNode(node: FlowNode): void {
		const ctx = this.ctx;
		const isSelected = node.id === this.selectedNode;

		// Node colors by type
		const colors: Record<string, string> = {
			prompt: '#4CAF50',
			llm: '#2196F3',
			transform: '#FF9800',
			condition: '#9C27B0',
			loop: '#00BCD4',
			api: '#FFC107',
			output: '#8BC34A',
			parameters: '#3F51B5'
		};

		const color = colors[node.type] || '#666666';

		// Draw node rectangle
		ctx.fillStyle = color + '33';
		ctx.strokeStyle = isSelected ? '#FFFFFF' : color;
		ctx.lineWidth = isSelected ? 3 : 2;
		ctx.beginPath();
		ctx.roundRect(node.x - 50, node.y - 30, 100, 60, 8);
		ctx.fill();
		ctx.stroke();

		// Draw label
		ctx.fillStyle = '#FFFFFF';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(node.label, node.x, node.y);

		// Draw ports
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(node.x - 50, node.y, 5, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(node.x + 50, node.y, 5, 0, Math.PI * 2);
		ctx.fill();

		// Draw configuration indicator if node is configured
		if (node.config && Object.keys(node.config).length > 0) {
			ctx.fillStyle = '#00FF00';
			ctx.beginPath();
			ctx.arc(node.x + 35, node.y - 20, 4, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	private drawConnection(conn: FlowConnection): void {
		const fromNode = this.nodes.get(conn.from);
		const toNode = this.nodes.get(conn.to);
		if (!fromNode || !toNode) return;

		const ctx = this.ctx;
		ctx.strokeStyle = '#888888';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(fromNode.x + 50, fromNode.y);
		
		// Draw bezier curve
		const cp1x = fromNode.x + 100;
		const cp1y = fromNode.y;
		const cp2x = toNode.x - 100;
		const cp2y = toNode.y;
		ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toNode.x - 50, toNode.y);
		ctx.stroke();

		// Draw arrow
		const angle = Math.atan2(toNode.y - cp2y, toNode.x - 50 - cp2x);
		ctx.save();
		ctx.translate(toNode.x - 50, toNode.y);
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-10, -5);
		ctx.lineTo(-10, 5);
		ctx.closePath();
		ctx.fillStyle = '#888888';
		ctx.fill();
		ctx.restore();
	}

	async setInput(input: IEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		// TODO: Load flow from input
	}

	layout(dimension: DOM.Dimension): void {
		// Handle layout changes
		this.resizeCanvas();
	}

	override dispose(): void {
		this.nodeConfigManager?.dispose();
		super.dispose();
	}
}
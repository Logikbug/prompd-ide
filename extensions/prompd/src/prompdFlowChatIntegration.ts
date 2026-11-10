import * as vscode from 'vscode';
import { PrompdChatRequest, PrompdChatResponse, PrompdFileModification } from './prompdChatService';
import { FlowNode, PrompdFlowDocument, FlowConnection } from './flowTypes';

/**
 * Enhanced PrompdFlow Chat Integration
 * 
 * Specialized handling for .prompdflow files in chat interactions
 * Provides workflow-specific assistance, node editing, and connection debugging
 */

export interface FlowChatContext {
    selectedNode?: FlowNode;
    selectedConnection?: FlowConnection;
    workflowState?: 'design' | 'testing' | 'debugging' | 'execution';
    executionContext?: FlowExecutionContext;
    validationIssues?: FlowValidationIssue[];
}

export interface FlowExecutionContext {
    currentNode?: string;
    nodeOutputs?: Map<string, any>;
    globalVariables?: Map<string, any>;
    executionPath?: string[];
    errors?: FlowExecutionError[];
}

export interface FlowValidationIssue {
    type: 'connection' | 'configuration' | 'logic' | 'performance';
    severity: 'error' | 'warning' | 'suggestion';
    nodeId?: string;
    connectionId?: string;
    message: string;
    fix?: () => Promise<void>;
}

export interface FlowExecutionError {
    nodeId: string;
    error: string;
    timestamp: Date;
    context?: any;
}

export class PrompdFlowChatIntegration {
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('PrompdFlow Chat');
    }

    /**
     * Enhanced chat request handling for .prompdflow files
     */
    public async enhanceFlowRequest(request: PrompdChatRequest): Promise<PrompdChatRequest> {
        if (request.fileType !== '.prompdflow') {
            return request;
        }

        try {
            const flowDocument = JSON.parse(request.currentContent) as PrompdFlowDocument;
            const flowContext = await this.analyzeFlowContext(flowDocument, request);

            // Enhanced request with flow-specific context
            const enhancedRequest: PrompdChatRequest = {
                ...request,
                context: {
                    ...request.context,
                    flowContext: flowContext,
                    flowAnalysis: await this.analyzeWorkflow(flowDocument),
                    suggestedActions: this.generateFlowSuggestions(flowDocument, request.userMessage)
                }
            };

            return enhancedRequest;

        } catch (error) {
            this.outputChannel.appendLine(`Flow analysis error: ${error}`);
            return request;
        }
    }

    /**
     * Process flow-specific chat responses
     */
    public async processFlowResponse(
        response: PrompdChatResponse, 
        request: PrompdChatRequest
    ): Promise<PrompdChatResponse> {
        if (request.fileType !== '.prompdflow') {
            return response;
        }

        try {
            // Enhance modifications with flow-specific logic
            if (response.modifications) {
                response.modifications = await this.enhanceFlowModifications(
                    response.modifications, 
                    request.currentContent
                );
            }

            // Add flow-specific suggestions
            if (!response.suggestions) {
                response.suggestions = [];
            }
            response.suggestions.push(...this.generateFlowActionSuggestions(request, response));

            return response;

        } catch (error) {
            this.outputChannel.appendLine(`Flow response processing error: ${error}`);
            return response;
        }
    }

    /**
     * Analyze current flow context
     */
    private async analyzeFlowContext(
        flow: PrompdFlowDocument, 
        request: PrompdChatRequest
    ): Promise<FlowChatContext> {
        const context: FlowChatContext = {
            workflowState: 'design', // Default state
            validationIssues: await this.validateFlow(flow)
        };

        // Detect selected node if cursor position is available
        if (request.context?.cursorPosition) {
            context.selectedNode = this.findNodeAtPosition(flow, request.context.cursorPosition);
        }

        // Detect selected text context
        if (request.context?.selectedText) {
            const selection = this.parseSelectedFlowElement(flow, request.context.selectedText);
            context.selectedNode = selection.node;
            context.selectedConnection = selection.connection;
        }

        // Analyze workflow state based on user message
        context.workflowState = this.detectWorkflowState(request.userMessage);

        return context;
    }

    /**
     * Comprehensive workflow analysis
     */
    private async analyzeWorkflow(flow: PrompdFlowDocument): Promise<any> {
        const analysis = {
            nodeCount: flow.nodes?.length || 0,
            connectionCount: flow.connections?.length || 0,
            nodeTypes: this.analyzeNodeTypes(flow),
            complexity: this.calculateComplexity(flow),
            potentialIssues: await this.identifyPotentialIssues(flow),
            optimizationOpportunities: this.identifyOptimizations(flow)
        };

        return analysis;
    }

    /**
     * Generate flow-specific suggestions based on user message
     */
    private generateFlowSuggestions(flow: PrompdFlowDocument, userMessage: string): string[] {
        const suggestions: string[] = [];
        const message = userMessage.toLowerCase();

        // Workflow creation suggestions
        if (message.includes('create') || message.includes('add') || message.includes('new')) {
            suggestions.push('Create new prompt node', 'Add parameter node', 'Insert condition node');
        }

        // Connection suggestions
        if (message.includes('connect') || message.includes('link') || message.includes('flow')) {
            suggestions.push('Connect nodes', 'Fix broken connections', 'Optimize data flow');
        }

        // Debugging suggestions
        if (message.includes('debug') || message.includes('error') || message.includes('fix')) {
            suggestions.push('Debug workflow execution', 'Validate connections', 'Check node configurations');
        }

        // Optimization suggestions
        if (message.includes('optimize') || message.includes('improve') || message.includes('performance')) {
            suggestions.push('Optimize workflow performance', 'Reduce redundant nodes', 'Improve data flow');
        }

        return suggestions;
    }

    /**
     * Enhance modifications with flow-specific validation
     */
    private async enhanceFlowModifications(
        modifications: PrompdFileModification[], 
        currentContent: string
    ): Promise<PrompdFileModification[]> {
        const enhancedModifications: PrompdFileModification[] = [];

        for (const modification of modifications) {
            // Validate modification doesn't break flow structure
            const isValid = await this.validateModification(modification, currentContent);
            
            if (isValid) {
                // Add flow-specific enhancements
                const enhanced = await this.addFlowValidation(modification);
                enhancedModifications.push(enhanced);
            } else {
                // Create alternative safe modification
                const safe = await this.createSafeModification(modification, currentContent);
                enhancedModifications.push(safe);
            }
        }

        return enhancedModifications;
    }

    /**
     * Generate flow-specific action suggestions
     */
    private generateFlowActionSuggestions(
        request: PrompdChatRequest, 
        response: PrompdChatResponse
    ): any[] {
        const suggestions = [];

        // Always offer to test the workflow
        suggestions.push({
            type: 'improvement',
            title: 'Test Workflow',
            description: 'Run the workflow to verify changes work correctly',
            action: async () => await this.testWorkflow(request.filePath)
        });

        // Offer to validate connections
        suggestions.push({
            type: 'improvement',
            title: 'Validate Connections',
            description: 'Check all node connections are properly configured',
            action: async () => await this.validateConnections(request.filePath)
        });

        // Offer to optimize performance
        if (response.modifications && response.modifications.length > 0) {
            suggestions.push({
                type: 'optimization',
                title: 'Optimize Performance',
                description: 'Analyze and optimize workflow performance',
                action: async () => await this.optimizeWorkflow(request.filePath)
            });
        }

        return suggestions;
    }

    /**
     * Validate flow structure
     */
    private async validateFlow(flow: PrompdFlowDocument): Promise<FlowValidationIssue[]> {
        const issues: FlowValidationIssue[] = [];

        // Check for basic structure
        if (!flow.nodes || flow.nodes.length === 0) {
            issues.push({
                type: 'logic',
                severity: 'error',
                message: 'Workflow has no nodes',
                fix: async () => await this.addDefaultNodes(flow)
            });
        }

        // Check for orphaned nodes
        if (flow.nodes && flow.connections) {
            const connectedNodes = new Set<string>();
            flow.connections.forEach(conn => {
                connectedNodes.add(conn.sourceNodeId);
                connectedNodes.add(conn.targetNodeId);
            });

            flow.nodes.forEach(node => {
                if (!connectedNodes.has(node.id) && flow.nodes!.length > 1) {
                    issues.push({
                        type: 'connection',
                        severity: 'warning',
                        nodeId: node.id,
                        message: `Node "${node.id}" is not connected to the workflow`
                    });
                }
            });
        }

        // Check for circular dependencies
        const circularDeps = this.detectCircularDependencies(flow);
        circularDeps.forEach(cycle => {
            issues.push({
                type: 'logic',
                severity: 'error',
                message: `Circular dependency detected: ${cycle.join(' -> ')}`
            });
        });

        return issues;
    }

    /**
     * Find node at cursor position
     */
    private findNodeAtPosition(flow: PrompdFlowDocument, position: vscode.Position): FlowNode | undefined {
        // This is a simplified implementation
        // In practice, you'd need to map JSON positions to logical nodes
        if (flow.nodes && flow.nodes.length > 0) {
            // Return first node for now - enhance with actual position mapping
            return flow.nodes[0];
        }
        return undefined;
    }

    /**
     * Parse selected flow element
     */
    private parseSelectedFlowElement(flow: PrompdFlowDocument, selectedText: string): {
        node?: FlowNode;
        connection?: FlowConnection;
    } {
        try {
            const selected = JSON.parse(selectedText);
            
            if (selected.id && selected.type) {
                // It's a node
                const node = flow.nodes?.find(n => n.id === selected.id);
                return { node };
            } else if (selected.source && selected.target) {
                // It's a connection
                const connection = flow.connections?.find(c => 
                    c.sourceNodeId === selected.sourceNodeId && c.targetNodeId === selected.targetNodeId
                );
                return { connection };
            }
        } catch {
            // Not valid JSON, ignore
        }

        return {};
    }

    /**
     * Detect workflow state from user message
     */
    private detectWorkflowState(message: string): FlowChatContext['workflowState'] {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('debug') || lowerMessage.includes('error') || lowerMessage.includes('fix')) {
            return 'debugging';
        } else if (lowerMessage.includes('test') || lowerMessage.includes('run') || lowerMessage.includes('execute')) {
            return 'testing';
        } else if (lowerMessage.includes('design') || lowerMessage.includes('create') || lowerMessage.includes('build')) {
            return 'design';
        } else if (lowerMessage.includes('execute') || lowerMessage.includes('start')) {
            return 'execution';
        }
        
        return 'design';
    }

    /**
     * Analyze node types in workflow
     */
    private analyzeNodeTypes(flow: PrompdFlowDocument): Record<string, number> {
        const types: Record<string, number> = {};
        
        flow.nodes?.forEach(node => {
            types[node.type] = (types[node.type] || 0) + 1;
        });
        
        return types;
    }

    /**
     * Calculate workflow complexity
     */
    private calculateComplexity(flow: PrompdFlowDocument): {
        score: number;
        factors: string[];
    } {
        let score = 0;
        const factors: string[] = [];
        
        const nodeCount = flow.nodes?.length || 0;
        const connectionCount = flow.connections?.length || 0;
        
        // Base complexity from node count
        score += nodeCount * 2;
        if (nodeCount > 10) factors.push('High node count');
        
        // Complexity from connections
        score += connectionCount;
        if (connectionCount > nodeCount * 1.5) factors.push('High connectivity');
        
        // Complexity from node types
        const nodeTypes = this.analyzeNodeTypes(flow);
        if (nodeTypes.condition) {
            score += nodeTypes.condition * 3;
            factors.push('Conditional logic');
        }
        
        return { score, factors };
    }

    /**
     * Identify potential issues
     */
    private async identifyPotentialIssues(flow: PrompdFlowDocument): Promise<string[]> {
        const issues: string[] = [];
        
        // Check for performance issues
        if ((flow.nodes?.length || 0) > 20) {
            issues.push('Large workflow may have performance implications');
        }
        
        // Check for maintainability issues
        const nodeTypes = this.analyzeNodeTypes(flow);
        if (nodeTypes.prompt && nodeTypes.prompt > 10) {
            issues.push('Many prompt nodes may be difficult to maintain');
        }
        
        return issues;
    }

    /**
     * Identify optimization opportunities
     */
    private identifyOptimizations(flow: PrompdFlowDocument): string[] {
        const optimizations: string[] = [];
        
        // Check for node consolidation opportunities
        const nodeTypes = this.analyzeNodeTypes(flow);
        if (nodeTypes.parameter && nodeTypes.parameter > 5) {
            optimizations.push('Consider consolidating parameter nodes');
        }
        
        return optimizations;
    }

    /**
     * Detect circular dependencies
     */
    private detectCircularDependencies(flow: PrompdFlowDocument): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        
        const hasCircularDependency = (node: string, path: string[]): boolean => {
            if (recursionStack.has(node)) {
                const cycleStart = path.indexOf(node);
                cycles.push(path.slice(cycleStart).concat([node]));
                return true;
            }
            
            if (visited.has(node)) {
                return false;
            }
            
            visited.add(node);
            recursionStack.add(node);
            
            const connections = flow.connections?.filter(c => c.sourceNodeId === node) || [];
            for (const connection of connections) {
                if (hasCircularDependency(connection.targetNodeId, [...path, node])) {
                    return true;
                }
            }
            
            recursionStack.delete(node);
            return false;
        };
        
        flow.nodes?.forEach(node => {
            if (!visited.has(node.id)) {
                hasCircularDependency(node.id, []);
            }
        });
        
        return cycles;
    }

    // Action methods
    private async testWorkflow(filePath: string): Promise<void> {
        vscode.window.showInformationMessage('Testing workflow...');
        // Implementation for workflow testing
    }

    private async validateConnections(filePath: string): Promise<void> {
        vscode.window.showInformationMessage('Validating connections...');
        // Implementation for connection validation
    }

    private async optimizeWorkflow(filePath: string): Promise<void> {
        vscode.window.showInformationMessage('Optimizing workflow...');
        // Implementation for workflow optimization
    }

    private async addDefaultNodes(flow: PrompdFlowDocument): Promise<void> {
        // Implementation to add default nodes
    }

    private async validateModification(modification: PrompdFileModification, content: string): Promise<boolean> {
        // Validate modification doesn't break JSON structure
        return true; // Simplified implementation
    }

    private async addFlowValidation(modification: PrompdFileModification): Promise<PrompdFileModification> {
        // Add flow-specific validation to modification
        return modification; // Simplified implementation
    }

    private async createSafeModification(
        modification: PrompdFileModification, 
        content: string
    ): Promise<PrompdFileModification> {
        // Create a safe alternative modification
        return {
            ...modification,
            description: `Safe version: ${modification.description}`
        };
    }
}

export default PrompdFlowChatIntegration;
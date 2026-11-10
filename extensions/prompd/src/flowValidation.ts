/**
 * Enterprise-grade validation system for Prompd Flow documents
 * Comprehensive schema validation, business rule enforcement, and security checks
 */

import { 
    PrompdFlowDocument, 
    FlowNode, 
    FlowConnection, 
    ValidationRule, 
    DataType,
    ExecutionError,
    NodeType
} from './flowTypes';

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    metadata: ValidationMetadata;
}

export interface ValidationError {
    code: string;
    message: string;
    severity: 'error' | 'critical';
    location: ValidationLocation;
    suggestion?: string;
}

export interface ValidationWarning {
    code: string;
    message: string;
    location: ValidationLocation;
    suggestion?: string;
}

export interface ValidationLocation {
    type: 'document' | 'node' | 'connection' | 'variable' | 'configuration';
    identifier?: string;
    path?: string;
    line?: number;
    column?: number;
}

export interface ValidationMetadata {
    validationTime: Date;
    validatorVersion: string;
    rulesApplied: string[];
    performance: {
        totalTime: number;
        rulesExecutionTime: Record<string, number>;
    };
}

export class FlowValidator {
    private static readonly SCHEMA_VERSION = '1.0.0';
    private static readonly VALIDATOR_VERSION = '1.0.0';

    public static async validate(flow: PrompdFlowDocument): Promise<ValidationResult> {
        const startTime = Date.now();
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const rulesApplied: string[] = [];
        const rulesExecutionTime: Record<string, number> = {};

        try {
            // Schema validation
            await this.executeValidationRule('schema', () => this.validateSchema(flow), errors, warnings, rulesApplied, rulesExecutionTime);
            
            // Business rules validation
            await this.executeValidationRule('metadata', () => this.validateMetadata(flow.metadata), errors, warnings, rulesApplied, rulesExecutionTime);
            await this.executeValidationRule('nodes', () => this.validateNodes(flow.nodes), errors, warnings, rulesApplied, rulesExecutionTime);
            await this.executeValidationRule('connections', () => this.validateConnections(flow.connections, flow.nodes), errors, warnings, rulesApplied, rulesExecutionTime);
            await this.executeValidationRule('variables', () => this.validateVariables(flow.variables), errors, warnings, rulesApplied, rulesExecutionTime);
            await this.executeValidationRule('execution-config', () => this.validateExecutionConfig(flow.executionConfig), errors, warnings, rulesApplied, rulesExecutionTime);
            
            // Graph topology validation
            await this.executeValidationRule('topology', () => this.validateGraphTopology(flow.nodes, flow.connections), errors, warnings, rulesApplied, rulesExecutionTime);
            
            // Security validation
            await this.executeValidationRule('security', () => this.validateSecurity(flow), errors, warnings, rulesApplied, rulesExecutionTime);
            
            // Performance validation
            await this.executeValidationRule('performance', () => this.validatePerformance(flow), errors, warnings, rulesApplied, rulesExecutionTime);

        } catch (error) {
            errors.push({
                code: 'VALIDATION_INTERNAL_ERROR',
                message: `Internal validation error: ${error}`,
                severity: 'critical',
                location: { type: 'document' }
            });
        }

        const totalTime = Date.now() - startTime;

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                validationTime: new Date(),
                validatorVersion: this.VALIDATOR_VERSION,
                rulesApplied,
                performance: {
                    totalTime,
                    rulesExecutionTime
                }
            }
        };
    }

    private static async executeValidationRule(
        ruleName: string,
        rule: () => { errors: ValidationError[], warnings: ValidationWarning[] },
        errors: ValidationError[],
        warnings: ValidationWarning[],
        rulesApplied: string[],
        rulesExecutionTime: Record<string, number>
    ): Promise<void> {
        const startTime = Date.now();
        try {
            const result = rule();
            errors.push(...result.errors);
            warnings.push(...result.warnings);
            rulesApplied.push(ruleName);
        } catch (error) {
            errors.push({
                code: `${ruleName.toUpperCase()}_RULE_ERROR`,
                message: `Validation rule '${ruleName}' failed: ${error}`,
                severity: 'error',
                location: { type: 'document' }
            });
        } finally {
            rulesExecutionTime[ruleName] = Date.now() - startTime;
        }
    }

    private static validateSchema(flow: PrompdFlowDocument): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Version validation
        if (flow.version !== this.SCHEMA_VERSION) {
            errors.push({
                code: 'INVALID_SCHEMA_VERSION',
                message: `Unsupported schema version: ${flow.version}. Expected: ${this.SCHEMA_VERSION}`,
                severity: 'error',
                location: { type: 'document', path: 'version' }
            });
        }

        // Required fields validation
        if (!flow.metadata) {
            errors.push({
                code: 'MISSING_METADATA',
                message: 'Flow document must include metadata',
                severity: 'error',
                location: { type: 'document', path: 'metadata' }
            });
        }

        if (!flow.nodes || !Array.isArray(flow.nodes)) {
            errors.push({
                code: 'MISSING_NODES',
                message: 'Flow document must include nodes array',
                severity: 'error',
                location: { type: 'document', path: 'nodes' }
            });
        }

        if (!flow.connections || !Array.isArray(flow.connections)) {
            errors.push({
                code: 'MISSING_CONNECTIONS',
                message: 'Flow document must include connections array',
                severity: 'error',
                location: { type: 'document', path: 'connections' }
            });
        }

        return { errors, warnings };
    }

    private static validateMetadata(metadata: any): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!metadata) return { errors, warnings };

        // Required metadata fields
        const requiredFields = ['id', 'name', 'version', 'created', 'modified', 'schemaVersion'];
        for (const field of requiredFields) {
            if (!metadata[field]) {
                errors.push({
                    code: 'MISSING_METADATA_FIELD',
                    message: `Missing required metadata field: ${field}`,
                    severity: 'error',
                    location: { type: 'document', path: `metadata.${field}` }
                });
            }
        }

        // ID format validation
        if (metadata.id && !/^[a-zA-Z0-9_-]+$/.test(metadata.id)) {
            errors.push({
                code: 'INVALID_METADATA_ID',
                message: 'Metadata ID must contain only alphanumeric characters, hyphens, and underscores',
                severity: 'error',
                location: { type: 'document', path: 'metadata.id' }
            });
        }

        // Date validation
        const dateFields = ['created', 'modified'];
        for (const field of dateFields) {
            if (metadata[field] && isNaN(Date.parse(metadata[field]))) {
                errors.push({
                    code: 'INVALID_DATE_FORMAT',
                    message: `Invalid date format in metadata.${field}: ${metadata[field]}`,
                    severity: 'error',
                    location: { type: 'document', path: `metadata.${field}` }
                });
            }
        }

        // Schema version validation
        if (metadata.schemaVersion !== this.SCHEMA_VERSION) {
            errors.push({
                code: 'MISMATCHED_SCHEMA_VERSION',
                message: `Schema version mismatch. Expected: ${this.SCHEMA_VERSION}, Found: ${metadata.schemaVersion}`,
                severity: 'error',
                location: { type: 'document', path: 'metadata.schemaVersion' }
            });
        }

        return { errors, warnings };
    }

    private static validateNodes(nodes: FlowNode[]): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!nodes || nodes.length === 0) {
            warnings.push({
                code: 'EMPTY_FLOW',
                message: 'Flow contains no nodes',
                location: { type: 'document', path: 'nodes' }
            });
            return { errors, warnings };
        }

        const nodeIds = new Set<string>();
        const validNodeTypes: NodeType[] = [
            'prompt', 'parameter', 'condition', 'loop', 'transformer', 
            'output', 'subflow', 'api', 'validator', 'aggregator'
        ];

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const location = { type: 'node' as const, identifier: node.id, path: `nodes[${i}]` };

            // Required fields
            if (!node.id) {
                errors.push({
                    code: 'MISSING_NODE_ID',
                    message: `Node at index ${i} is missing required 'id' field`,
                    severity: 'error',
                    location
                });
                continue;
            }

            // Duplicate ID check
            if (nodeIds.has(node.id)) {
                errors.push({
                    code: 'DUPLICATE_NODE_ID',
                    message: `Duplicate node ID: ${node.id}`,
                    severity: 'error',
                    location
                });
            }
            nodeIds.add(node.id);

            // Node type validation
            if (!validNodeTypes.includes(node.type)) {
                errors.push({
                    code: 'INVALID_NODE_TYPE',
                    message: `Invalid node type: ${node.type}. Valid types: ${validNodeTypes.join(', ')}`,
                    severity: 'error',
                    location
                });
            }

            // Position validation
            if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
                errors.push({
                    code: 'INVALID_NODE_POSITION',
                    message: `Node ${node.id} has invalid position coordinates`,
                    severity: 'error',
                    location
                });
            }

            // Data validation
            if (!node.data) {
                errors.push({
                    code: 'MISSING_NODE_DATA',
                    message: `Node ${node.id} is missing data configuration`,
                    severity: 'error',
                    location
                });
            } else {
                // Validate node-specific configuration
                this.validateNodeConfig(node, errors, warnings);
            }

            // Ports validation
            if (!Array.isArray(node.inputPorts)) {
                errors.push({
                    code: 'INVALID_INPUT_PORTS',
                    message: `Node ${node.id} inputPorts must be an array`,
                    severity: 'error',
                    location
                });
            }

            if (!Array.isArray(node.outputPorts)) {
                errors.push({
                    code: 'INVALID_OUTPUT_PORTS',
                    message: `Node ${node.id} outputPorts must be an array`,
                    severity: 'error',
                    location
                });
            }

            // Port ID uniqueness within node
            const allPorts = [...(node.inputPorts || []), ...(node.outputPorts || [])];
            const portIds = new Set<string>();
            for (const port of allPorts) {
                if (portIds.has(port.id)) {
                    errors.push({
                        code: 'DUPLICATE_PORT_ID',
                        message: `Duplicate port ID '${port.id}' in node ${node.id}`,
                        severity: 'error',
                        location
                    });
                }
                portIds.add(port.id);
            }
        }

        return { errors, warnings };
    }

    private static validateNodeConfig(node: FlowNode, errors: ValidationError[], warnings: ValidationWarning[]): void {
        const location = { type: 'node' as const, identifier: node.id };

        if (!node.data.config) {
            errors.push({
                code: 'MISSING_NODE_CONFIG',
                message: `Node ${node.id} is missing configuration`,
                severity: 'error',
                location
            });
            return;
        }

        // Type-specific validation
        switch (node.type) {
            case 'prompt':
                this.validatePromptNodeConfig(node, errors, warnings);
                break;
            case 'parameter':
                this.validateParameterNodeConfig(node, errors, warnings);
                break;
            case 'condition':
                this.validateConditionNodeConfig(node, errors, warnings);
                break;
            case 'api':
                this.validateApiNodeConfig(node, errors, warnings);
                break;
            // Add other node type validations as needed
        }
    }

    private static validatePromptNodeConfig(node: FlowNode, errors: ValidationError[], warnings: ValidationWarning[]): void {
        const config = node.data.config as any;
        const location = { type: 'node' as const, identifier: node.id };

        if (!config.template) {
            errors.push({
                code: 'MISSING_PROMPT_TEMPLATE',
                message: `Prompt node ${node.id} is missing template`,
                severity: 'error',
                location
            });
        }

        if (!config.provider) {
            errors.push({
                code: 'MISSING_PROMPT_PROVIDER',
                message: `Prompt node ${node.id} is missing provider configuration`,
                severity: 'error',
                location
            });
        }

        if (!config.model) {
            errors.push({
                code: 'MISSING_PROMPT_MODEL',
                message: `Prompt node ${node.id} is missing model configuration`,
                severity: 'error',
                location
            });
        }

        // Validate timeout
        if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
            errors.push({
                code: 'INVALID_TIMEOUT',
                message: `Prompt node ${node.id} has invalid timeout value`,
                severity: 'error',
                location
            });
        }
    }

    private static validateParameterNodeConfig(node: FlowNode, errors: ValidationError[], warnings: ValidationWarning[]): void {
        const config = node.data.config as any;
        const location = { type: 'node' as const, identifier: node.id };

        if (!config.parameterName) {
            errors.push({
                code: 'MISSING_PARAMETER_NAME',
                message: `Parameter node ${node.id} is missing parameter name`,
                severity: 'error',
                location
            });
        }

        if (!config.dataType) {
            errors.push({
                code: 'MISSING_PARAMETER_TYPE',
                message: `Parameter node ${node.id} is missing data type`,
                severity: 'error',
                location
            });
        }

        const validDataTypes: DataType[] = ['string', 'number', 'boolean', 'object', 'array', 'null', 'any', 'file', 'image', 'audio', 'video'];
        if (config.dataType && !validDataTypes.includes(config.dataType)) {
            errors.push({
                code: 'INVALID_PARAMETER_TYPE',
                message: `Parameter node ${node.id} has invalid data type: ${config.dataType}`,
                severity: 'error',
                location
            });
        }
    }

    private static validateConditionNodeConfig(node: FlowNode, errors: ValidationError[], warnings: ValidationWarning[]): void {
        const config = node.data.config as any;
        const location = { type: 'node' as const, identifier: node.id };

        if (!config.conditions || !Array.isArray(config.conditions) || config.conditions.length === 0) {
            errors.push({
                code: 'MISSING_CONDITIONS',
                message: `Condition node ${node.id} must have at least one condition`,
                severity: 'error',
                location
            });
        }

        // Validate each condition
        if (config.conditions) {
            for (let i = 0; i < config.conditions.length; i++) {
                const condition = config.conditions[i];
                if (!condition.condition || !condition.targetNodeId) {
                    errors.push({
                        code: 'INVALID_CONDITION',
                        message: `Condition node ${node.id} has invalid condition at index ${i}`,
                        severity: 'error',
                        location
                    });
                }
            }
        }
    }

    private static validateApiNodeConfig(node: FlowNode, errors: ValidationError[], warnings: ValidationWarning[]): void {
        const config = node.data.config as any;
        const location = { type: 'node' as const, identifier: node.id };

        if (!config.endpoint) {
            errors.push({
                code: 'MISSING_API_ENDPOINT',
                message: `API node ${node.id} is missing endpoint`,
                severity: 'error',
                location
            });
        }

        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        if (!config.method || !validMethods.includes(config.method)) {
            errors.push({
                code: 'INVALID_HTTP_METHOD',
                message: `API node ${node.id} has invalid HTTP method: ${config.method}`,
                severity: 'error',
                location
            });
        }

        // URL validation
        if (config.endpoint) {
            try {
                new URL(config.endpoint);
            } catch {
                errors.push({
                    code: 'INVALID_URL',
                    message: `API node ${node.id} has invalid endpoint URL: ${config.endpoint}`,
                    severity: 'error',
                    location
                });
            }
        }
    }

    private static validateConnections(connections: FlowConnection[], nodes: FlowNode[]): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        const nodeMap = new Map<string, FlowNode>();
        nodes.forEach(node => nodeMap.set(node.id, node));

        const connectionIds = new Set<string>();

        for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            const location = { type: 'connection' as const, identifier: connection.id, path: `connections[${i}]` };

            // Required fields
            if (!connection.id) {
                errors.push({
                    code: 'MISSING_CONNECTION_ID',
                    message: `Connection at index ${i} is missing ID`,
                    severity: 'error',
                    location
                });
                continue;
            }

            // Duplicate ID check
            if (connectionIds.has(connection.id)) {
                errors.push({
                    code: 'DUPLICATE_CONNECTION_ID',
                    message: `Duplicate connection ID: ${connection.id}`,
                    severity: 'error',
                    location
                });
            }
            connectionIds.add(connection.id);

            // Node existence validation
            const sourceNode = nodeMap.get(connection.sourceNodeId);
            const targetNode = nodeMap.get(connection.targetNodeId);

            if (!sourceNode) {
                errors.push({
                    code: 'INVALID_SOURCE_NODE',
                    message: `Connection ${connection.id} references non-existent source node: ${connection.sourceNodeId}`,
                    severity: 'error',
                    location
                });
            }

            if (!targetNode) {
                errors.push({
                    code: 'INVALID_TARGET_NODE',
                    message: `Connection ${connection.id} references non-existent target node: ${connection.targetNodeId}`,
                    severity: 'error',
                    location
                });
            }

            // Port existence validation
            if (sourceNode) {
                const sourcePort = sourceNode.outputPorts?.find(p => p.id === connection.sourcePortId);
                if (!sourcePort) {
                    errors.push({
                        code: 'INVALID_SOURCE_PORT',
                        message: `Connection ${connection.id} references non-existent source port: ${connection.sourcePortId}`,
                        severity: 'error',
                        location
                    });
                }
            }

            if (targetNode) {
                const targetPort = targetNode.inputPorts?.find(p => p.id === connection.targetPortId);
                if (!targetPort) {
                    errors.push({
                        code: 'INVALID_TARGET_PORT',
                        message: `Connection ${connection.id} references non-existent target port: ${connection.targetPortId}`,
                        severity: 'error',
                        location
                    });
                }
            }

            // Self-connection check
            if (connection.sourceNodeId === connection.targetNodeId) {
                warnings.push({
                    code: 'SELF_CONNECTION',
                    message: `Connection ${connection.id} connects node to itself`,
                    location,
                    suggestion: 'Consider using internal node state instead of self-connections'
                });
            }
        }

        return { errors, warnings };
    }

    private static validateVariables(variables: any[]): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!variables) return { errors, warnings };

        const variableNames = new Set<string>();

        for (let i = 0; i < variables.length; i++) {
            const variable = variables[i];
            const location = { type: 'variable' as const, identifier: variable.name, path: `variables[${i}]` };

            if (!variable.name) {
                errors.push({
                    code: 'MISSING_VARIABLE_NAME',
                    message: `Variable at index ${i} is missing name`,
                    severity: 'error',
                    location
                });
                continue;
            }

            // Duplicate name check
            if (variableNames.has(variable.name)) {
                errors.push({
                    code: 'DUPLICATE_VARIABLE_NAME',
                    message: `Duplicate variable name: ${variable.name}`,
                    severity: 'error',
                    location
                });
            }
            variableNames.add(variable.name);

            // Variable name validation
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
                errors.push({
                    code: 'INVALID_VARIABLE_NAME',
                    message: `Invalid variable name: ${variable.name}. Must start with letter or underscore, followed by alphanumeric characters or underscores`,
                    severity: 'error',
                    location
                });
            }

            // Type validation
            const validDataTypes: DataType[] = ['string', 'number', 'boolean', 'object', 'array', 'null', 'any', 'file', 'image', 'audio', 'video'];
            if (variable.type && !validDataTypes.includes(variable.type)) {
                errors.push({
                    code: 'INVALID_VARIABLE_TYPE',
                    message: `Variable ${variable.name} has invalid type: ${variable.type}`,
                    severity: 'error',
                    location
                });
            }

            // Scope validation
            if (variable.scope && !['global', 'local'].includes(variable.scope)) {
                errors.push({
                    code: 'INVALID_VARIABLE_SCOPE',
                    message: `Variable ${variable.name} has invalid scope: ${variable.scope}`,
                    severity: 'error',
                    location
                });
            }
        }

        return { errors, warnings };
    }

    private static validateExecutionConfig(config: any): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!config) {
            warnings.push({
                code: 'MISSING_EXECUTION_CONFIG',
                message: 'No execution configuration provided, using defaults',
                location: { type: 'configuration', path: 'executionConfig' }
            });
            return { errors, warnings };
        }

        // Parallelism validation
        if (config.parallelism) {
            if (config.parallelism.maxConcurrency && (typeof config.parallelism.maxConcurrency !== 'number' || config.parallelism.maxConcurrency <= 0)) {
                errors.push({
                    code: 'INVALID_MAX_CONCURRENCY',
                    message: 'Max concurrency must be a positive number',
                    severity: 'error',
                    location: { type: 'configuration', path: 'executionConfig.parallelism.maxConcurrency' }
                });
            }
        }

        // Performance validation
        if (config.performance) {
            if (config.performance.maxMemoryUsage && (typeof config.performance.maxMemoryUsage !== 'number' || config.performance.maxMemoryUsage <= 0)) {
                errors.push({
                    code: 'INVALID_MEMORY_LIMIT',
                    message: 'Max memory usage must be a positive number',
                    severity: 'error',
                    location: { type: 'configuration', path: 'executionConfig.performance.maxMemoryUsage' }
                });
            }
        }

        return { errors, warnings };
    }

    private static validateGraphTopology(nodes: FlowNode[], connections: FlowConnection[]): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Build adjacency list
        const graph = new Map<string, string[]>();
        nodes.forEach(node => graph.set(node.id, []));

        connections.forEach(connection => {
            const neighbors = graph.get(connection.sourceNodeId);
            if (neighbors) {
                neighbors.push(connection.targetNodeId);
            }
        });

        // Cycle detection using DFS
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (nodeId: string): boolean => {
            if (recursionStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = graph.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (hasCycle(neighbor)) return true;
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const nodeId of graph.keys()) {
            if (!visited.has(nodeId) && hasCycle(nodeId)) {
                errors.push({
                    code: 'CIRCULAR_DEPENDENCY',
                    message: 'Flow contains circular dependencies',
                    severity: 'error',
                    location: { type: 'document' },
                    suggestion: 'Remove circular connections or add condition nodes to break cycles'
                });
                break;
            }
        }

        // Orphaned nodes detection
        const connectedNodes = new Set<string>();
        connections.forEach(connection => {
            connectedNodes.add(connection.sourceNodeId);
            connectedNodes.add(connection.targetNodeId);
        });

        nodes.forEach(node => {
            if (!connectedNodes.has(node.id) && node.type !== 'parameter') {
                warnings.push({
                    code: 'ORPHANED_NODE',
                    message: `Node ${node.id} is not connected to any other nodes`,
                    location: { type: 'node', identifier: node.id },
                    suggestion: 'Connect this node to the flow or remove it if not needed'
                });
            }
        });

        return { errors, warnings };
    }

    private static validateSecurity(flow: PrompdFlowDocument): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Check for sensitive data in plain text
        const sensitivePatterns = [
            { pattern: /password\s*[:=]\s*["']?[^"'\s]+/gi, name: 'password' },
            { pattern: /api[_-]?key\s*[:=]\s*["']?[^"'\s]+/gi, name: 'API key' },
            { pattern: /secret\s*[:=]\s*["']?[^"'\s]+/gi, name: 'secret' },
            { pattern: /token\s*[:=]\s*["']?[^"'\s]+/gi, name: 'token' }
        ];

        const checkForSensitiveData = (text: string, context: string) => {
            sensitivePatterns.forEach(({ pattern, name }) => {
                if (pattern.test(text)) {
                    warnings.push({
                        code: 'POTENTIAL_SENSITIVE_DATA',
                        message: `Potential ${name} found in ${context}`,
                        location: { type: 'document' },
                        suggestion: 'Use environment variables or secure parameter storage for sensitive data'
                    });
                }
            });
        };

        // Check nodes for sensitive data
        flow.nodes.forEach(node => {
            const nodeText = JSON.stringify(node.data);
            checkForSensitiveData(nodeText, `node ${node.id}`);
        });

        // Check variables for sensitive data
        flow.variables?.forEach(variable => {
            if (variable.value && typeof variable.value === 'string') {
                checkForSensitiveData(variable.value, `variable ${variable.name}`);
            }
            
            if (!variable.sensitive && variable.name.toLowerCase().includes('password')) {
                warnings.push({
                    code: 'UNMARKED_SENSITIVE_VARIABLE',
                    message: `Variable '${variable.name}' appears to contain sensitive data but is not marked as sensitive`,
                    location: { type: 'variable', identifier: variable.name },
                    suggestion: 'Mark sensitive variables with sensitive: true'
                });
            }
        });

        return { errors, warnings };
    }

    private static validatePerformance(flow: PrompdFlowDocument): { errors: ValidationError[], warnings: ValidationWarning[] } {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Check for potential performance issues
        const nodeCount = flow.nodes.length;
        const connectionCount = flow.connections.length;

        if (nodeCount > 100) {
            warnings.push({
                code: 'LARGE_FLOW',
                message: `Flow contains ${nodeCount} nodes, which may impact performance`,
                location: { type: 'document' },
                suggestion: 'Consider breaking large flows into smaller subflows'
            });
        }

        if (connectionCount > nodeCount * 3) {
            warnings.push({
                code: 'COMPLEX_CONNECTIVITY',
                message: 'Flow has high connectivity complexity',
                location: { type: 'document' },
                suggestion: 'Simplify connections or use aggregator nodes to reduce complexity'
            });
        }

        // Check for deeply nested loops
        let maxLoopDepth = 0;
        const calculateLoopDepth = (nodeId: string, depth: number, visited: Set<string>): number => {
            if (visited.has(nodeId)) return depth;
            visited.add(nodeId);

            const node = flow.nodes.find(n => n.id === nodeId);
            if (node?.type === 'loop') {
                depth++;
                maxLoopDepth = Math.max(maxLoopDepth, depth);
            }

            const outgoingConnections = flow.connections.filter(c => c.sourceNodeId === nodeId);
            for (const connection of outgoingConnections) {
                calculateLoopDepth(connection.targetNodeId, depth, new Set(visited));
            }

            return depth;
        };

        flow.nodes.forEach(node => {
            if (node.type === 'loop') {
                calculateLoopDepth(node.id, 0, new Set());
            }
        });

        if (maxLoopDepth > 3) {
            warnings.push({
                code: 'DEEP_LOOP_NESTING',
                message: `Loop nesting depth of ${maxLoopDepth} may cause performance issues`,
                location: { type: 'document' },
                suggestion: 'Consider flattening nested loops or using iterative approaches'
            });
        }

        return { errors, warnings };
    }
}


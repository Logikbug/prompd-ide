/**
 * Comprehensive type definitions for Prompd Flow System
 * Enterprise-grade architecture with full validation and extensibility
 */

export interface PrompdFlowDocument {
    version: '1.0.0';
    metadata: FlowMetadata;
    nodes: FlowNode[];
    connections: FlowConnection[];
    variables: FlowVariable[];
    executionConfig: ExecutionConfiguration;
}

export interface FlowMetadata {
    id: string;
    name: string;
    description?: string;
    author?: string;
    version: string;
    tags?: string[];
    created: string; // ISO timestamp
    modified: string; // ISO timestamp
    schemaVersion: '1.0.0';
}

export interface FlowNode {
    id: string;
    type: NodeType;
    position: Position;
    data: NodeData;
    inputPorts: Port[];
    outputPorts: Port[];
    metadata: NodeMetadata;
}

export type NodeType = 
    | 'prompt'          // Core prompt execution
    | 'parameter'       // Parameter input/definition
    | 'condition'       // Conditional branching
    | 'loop'           // Iteration control
    | 'transformer'    // Data transformation
    | 'output'         // Output formatting
    | 'subflow'        // Nested flow execution
    | 'api'            // External API call
    | 'validator'      // Input/output validation
    | 'aggregator';    // Data aggregation

export interface NodeData {
    // Base properties for all nodes
    label: string;
    description?: string;
    enabled: boolean;
    
    // Type-specific data (discriminated union)
    config: PromptNodeConfig | ParameterNodeConfig | ConditionNodeConfig | 
           LoopNodeConfig | TransformerNodeConfig | OutputNodeConfig |
           SubflowNodeConfig | ApiNodeConfig | ValidatorNodeConfig | AggregatorNodeConfig;
}

export interface PromptNodeConfig {
    type: 'prompt';
    template: string;
    parameters: ParameterBinding[];
    provider: ProviderConfig;
    model: ModelConfig;
    executionSettings: PromptExecutionSettings;
    outputFormat: OutputFormat;
    retryPolicy: RetryPolicy;
    timeout: number; // milliseconds
}

export interface ParameterNodeConfig {
    type: 'parameter';
    parameterName: string;
    dataType: DataType;
    defaultValue?: any;
    validation: ValidationRule[];
    required: boolean;
    sensitive: boolean; // For API keys, passwords, etc.
}

export interface ConditionNodeConfig {
    type: 'condition';
    conditions: ConditionalExpression[];
    defaultPath?: string; // Node ID for default case
}

export interface LoopNodeConfig {
    type: 'loop';
    loopType: 'for' | 'while' | 'forEach';
    condition: Expression;
    maxIterations: number;
    iterationVariable?: string;
}

export interface TransformerNodeConfig {
    type: 'transformer';
    transformationType: 'javascript' | 'jsonPath' | 'regex' | 'template';
    transformationCode: string;
    inputSchema: JsonSchema;
    outputSchema: JsonSchema;
}

export interface OutputNodeConfig {
    type: 'output';
    outputType: 'text' | 'json' | 'csv' | 'markdown' | 'html';
    template?: string;
    formatting: OutputFormatting;
}

export interface SubflowNodeConfig {
    type: 'subflow';
    flowPath: string; // Path to .pdflow file
    parameterMappings: ParameterMapping[];
    isolateExecution: boolean;
}

export interface ApiNodeConfig {
    type: 'api';
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers: Record<string, string>;
    body?: string;
    authentication: AuthenticationConfig;
    responseMapping: ResponseMapping;
}

export interface ValidatorNodeConfig {
    type: 'validator';
    validationType: 'schema' | 'custom' | 'regex' | 'range';
    validationRules: ValidationRule[];
    onFailure: 'stop' | 'continue' | 'retry' | 'default';
    defaultValue?: any;
}

export interface AggregatorNodeConfig {
    type: 'aggregator';
    aggregationType: 'collect' | 'merge' | 'reduce' | 'filter';
    aggregationFunction: string; // JavaScript function or built-in
    outputFormat: OutputFormat;
}

export interface Port {
    id: string;
    name: string;
    dataType: DataType;
    required: boolean;
    description?: string;
    defaultValue?: any;
}

export interface Position {
    x: number;
    y: number;
    z?: number; // For layering
}

export interface NodeMetadata {
    collapsed: boolean;
    color?: string;
    icon?: string;
    notes?: string;
    tags?: string[];
    breakpoint?: boolean;
}

export interface FlowConnection {
    id: string;
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
    metadata: ConnectionMetadata;
}

export interface ConnectionMetadata {
    label?: string;
    color?: string;
    style?: 'solid' | 'dashed' | 'dotted';
    condition?: Expression; // Conditional connections
}

export interface FlowVariable {
    name: string;
    type: DataType;
    value?: any;
    scope: 'global' | 'local';
    description?: string;
    sensitive: boolean;
}

export interface ExecutionConfiguration {
    parallelism: ParallelismConfig;
    errorHandling: ErrorHandlingConfig;
    logging: LoggingConfig;
    security: SecurityConfig;
    performance: PerformanceConfig;
}

export interface ParallelismConfig {
    enabled: boolean;
    maxConcurrency: number;
    nodeOrdering: 'topological' | 'priority' | 'custom';
}

export interface ErrorHandlingConfig {
    globalErrorHandler?: string; // Node ID
    retryPolicy: RetryPolicy;
    continueOnError: boolean;
    errorLogging: boolean;
}

export interface LoggingConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    logToFile: boolean;
    logPath?: string;
    includeTimestamps: boolean;
    includeNodeData: boolean;
}

export interface SecurityConfig {
    encryptSensitiveData: boolean;
    allowDynamicCode: boolean;
    restrictedAPIs: string[];
    sandboxExecution: boolean;
}

export interface PerformanceConfig {
    enableCaching: boolean;
    cacheStrategy: 'memory' | 'disk' | 'hybrid';
    cacheTTL: number; // seconds
    maxMemoryUsage: number; // MB
}

// Supporting types
export type DataType = 
    | 'string' | 'number' | 'boolean' | 'object' | 'array' 
    | 'null' | 'any' | 'file' | 'image' | 'audio' | 'video';

export interface ParameterBinding {
    parameterName: string;
    sourceType: 'static' | 'variable' | 'nodeOutput' | 'userInput';
    sourceValue: any;
    transformation?: string; // Optional transformation function
}

export interface ProviderConfig {
    name: string;
    apiKey?: string; // Should be encrypted
    endpoint?: string;
    region?: string;
    customHeaders?: Record<string, string>;
}

export interface ModelConfig {
    name: string;
    version?: string;
    parameters: Record<string, any>;
    capabilities: ModelCapability[];
}

export type ModelCapability = 
    | 'text-generation' | 'text-completion' | 'image-generation' 
    | 'image-analysis' | 'audio-transcription' | 'translation';

export interface PromptExecutionSettings {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    streaming?: boolean;
}

export type OutputFormat = 'text' | 'json' | 'structured' | 'raw';

export interface OutputFormatting {
    prettyPrint: boolean;
    indentation?: number;
    lineEndings?: 'LF' | 'CRLF';
    encoding?: 'utf8' | 'utf16' | 'ascii';
}

export interface RetryPolicy {
    enabled: boolean;
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    backoffDelay: number; // milliseconds
    retryConditions: RetryCondition[];
}

export interface RetryCondition {
    type: 'httpStatus' | 'errorMessage' | 'timeout' | 'custom';
    pattern: string | number;
    operator: 'equals' | 'contains' | 'regex' | 'range';
}

export interface ValidationRule {
    type: 'required' | 'type' | 'pattern' | 'range' | 'length' | 'custom';
    constraint: any;
    message?: string;
}

export interface ConditionalExpression {
    condition: Expression;
    targetNodeId: string;
    priority: number;
}

export interface Expression {
    type: 'comparison' | 'logical' | 'arithmetic' | 'function';
    operator: string;
    operands: (Expression | any)[];
}

export interface JsonSchema {
    type: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean;
    items?: JsonSchema;
    pattern?: string;
    minimum?: number;
    maximum?: number;
    [key: string]: any;
}

export interface ParameterMapping {
    sourceParameter: string;
    targetParameter: string;
    transformation?: string;
}

export interface AuthenticationConfig {
    type: 'none' | 'basic' | 'bearer' | 'apiKey' | 'oauth2';
    credentials: Record<string, string>;
    refreshConfig?: OAuth2RefreshConfig;
}

export interface OAuth2RefreshConfig {
    tokenEndpoint: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
}

export interface ResponseMapping {
    dataPath?: string; // JSONPath to extract data
    errorPath?: string; // JSONPath to extract errors
    statusPath?: string; // JSONPath to extract status
    transformation?: string; // Optional transformation function
}

// Execution runtime types
export interface FlowExecutionContext {
    flowId: string;
    executionId: string;
    variables: Map<string, any>;
    nodeOutputs: Map<string, any>;
    executionState: ExecutionState;
    startTime: Date;
    currentNode?: string;
    errors: ExecutionError[];
    metrics: ExecutionMetrics;
}

export interface ExecutionState {
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    completedNodes: Set<string>;
    failedNodes: Set<string>;
    skippedNodes: Set<string>;
}

export interface ExecutionError {
    nodeId: string;
    timestamp: Date;
    message: string;
    stack?: string;
    recoverable: boolean;
    retryCount: number;
}

export interface ExecutionMetrics {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    skippedNodes: number;
    totalExecutionTime: number; // milliseconds
    nodeExecutionTimes: Map<string, number>;
    memoryUsage: number; // bytes
    apiCalls: number;
    cacheHits: number;
    cacheMisses: number;
}
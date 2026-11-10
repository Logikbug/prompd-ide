import * as vscode from 'vscode';

/**
 * Prompt Breakpoint Manager
 * Handles setting breakpoints in .prompd files for debugging
 */
export class PromptBreakpointManager {
    private breakpoints: Map<string, PromptBreakpoint[]> = new Map();
    
    constructor() {
        // Listen for breakpoint changes
        vscode.debug.onDidChangeBreakpoints((e) => {
            this.handleBreakpointChanges(e);
        });
    }

    private handleBreakpointChanges(e: vscode.BreakpointsChangeEvent) {
        // Handle added breakpoints
        e.added.forEach(bp => {
            if (bp instanceof vscode.SourceBreakpoint && bp.location.uri.path.endsWith('.prompd')) {
                this.addBreakpoint(bp);
            }
        });

        // Handle removed breakpoints  
        e.removed.forEach(bp => {
            if (bp instanceof vscode.SourceBreakpoint && bp.location.uri.path.endsWith('.prompd')) {
                this.removeBreakpoint(bp);
            }
        });
    }

    private addBreakpoint(sourceBreakpoint: vscode.SourceBreakpoint) {
        const filePath = sourceBreakpoint.location.uri.fsPath;
        const line = sourceBreakpoint.location.range.start.line;
        
        const breakpoint: PromptBreakpoint = {
            id: `${filePath}:${line}`,
            filePath: filePath,
            line: line,
            condition: sourceBreakpoint.condition,
            enabled: sourceBreakpoint.enabled,
            type: this.determineBreakpointType(sourceBreakpoint, line)
        };

        if (!this.breakpoints.has(filePath)) {
            this.breakpoints.set(filePath, []);
        }
        
        this.breakpoints.get(filePath)!.push(breakpoint);
        
        console.log(`Added prompt breakpoint at ${filePath}:${line} (${breakpoint.type})`);
    }

    private removeBreakpoint(sourceBreakpoint: vscode.SourceBreakpoint) {
        const filePath = sourceBreakpoint.location.uri.fsPath;
        const line = sourceBreakpoint.location.range.start.line;
        
        const fileBreakpoints = this.breakpoints.get(filePath);
        if (fileBreakpoints) {
            const index = fileBreakpoints.findIndex(bp => bp.line === line);
            if (index !== -1) {
                fileBreakpoints.splice(index, 1);
                console.log(`Removed prompt breakpoint at ${filePath}:${line}`);
            }
        }
    }

    private determineBreakpointType(sourceBreakpoint: vscode.SourceBreakpoint, line: number): BreakpointType {
        // In the future, we could analyze the line content to determine type
        // For now, we'll use conditions or defaults
        
        if (sourceBreakpoint.condition?.includes('parameter')) {
            return BreakpointType.ParameterCheck;
        } else if (sourceBreakpoint.condition?.includes('response')) {
            return BreakpointType.ResponseReceived;
        } else if (line === 0) {
            return BreakpointType.ExecutionStart;
        } else {
            return BreakpointType.LineBreak;
        }
    }

    public getBreakpoints(filePath: string): PromptBreakpoint[] {
        return this.breakpoints.get(filePath) || [];
    }

    public shouldBreakAtLine(filePath: string, line: number, context: BreakpointContext): boolean {
        const fileBreakpoints = this.breakpoints.get(filePath);
        if (!fileBreakpoints) return false;

        const breakpoint = fileBreakpoints.find(bp => bp.line === line && bp.enabled);
        if (!breakpoint) return false;

        // Evaluate condition if present
        if (breakpoint.condition) {
            return this.evaluateBreakpointCondition(breakpoint.condition, context);
        }

        return true;
    }

    private evaluateBreakpointCondition(condition: string, context: BreakpointContext): boolean {
        try {
            // Simple condition evaluation for prompt debugging
            // Examples: "parameter.user_query == 'test'", "tokens > 100", "cost > 0.01"
            
            if (condition.includes('parameter.')) {
                const paramMatch = condition.match(/parameter\.(\w+)\s*([=!<>]+)\s*['"]?([^'"]+)['"]?/);
                if (paramMatch) {
                    const [, paramName, operator, expectedValue] = paramMatch;
                    const actualValue = context.parameters[paramName];
                    
                    switch (operator) {
                        case '==':
                        case '===':
                            return actualValue === expectedValue;
                        case '!=':
                        case '!==':
                            return actualValue !== expectedValue;
                        case '>':
                            return Number(actualValue) > Number(expectedValue);
                        case '<':
                            return Number(actualValue) < Number(expectedValue);
                        default:
                            return false;
                    }
                }
            }
            
            if (condition.includes('tokens')) {
                const tokenMatch = condition.match(/tokens\s*([><=]+)\s*(\d+)/);
                if (tokenMatch) {
                    const [, operator, threshold] = tokenMatch;
                    const tokenCount = context.executionMetrics.tokens;
                    
                    switch (operator) {
                        case '>': return tokenCount > Number(threshold);
                        case '<': return tokenCount < Number(threshold);
                        case '>=': return tokenCount >= Number(threshold);
                        case '<=': return tokenCount <= Number(threshold);
                        case '==': return tokenCount === Number(threshold);
                        default: return false;
                    }
                }
            }
            
            if (condition.includes('cost')) {
                const costMatch = condition.match(/cost\s*([><=]+)\s*([\d.]+)/);
                if (costMatch) {
                    const [, operator, threshold] = costMatch;
                    const cost = context.executionMetrics.cost;
                    
                    switch (operator) {
                        case '>': return cost > Number(threshold);
                        case '<': return cost < Number(threshold);
                        case '>=': return cost >= Number(threshold);
                        case '<=': return cost <= Number(threshold);
                        case '==': return cost === Number(threshold);
                        default: return false;
                    }
                }
            }
            
            // Default: break unconditionally
            return true;
            
        } catch (error) {
            console.warn(`Failed to evaluate breakpoint condition: ${condition}`, error);
            return true; // Break on error for safety
        }
    }

    public getBreakpointHints(): string[] {
        return [
            'parameter.user_query == "test"  // Break when parameter equals value',
            'parameter.temperature > 0.8     // Break when parameter exceeds threshold', 
            'tokens > 100                    // Break when token count exceeds limit',
            'cost > 0.01                     // Break when cost exceeds budget',
            'response.length > 1000          // Break when response is too long',
            '// Leave empty for unconditional breakpoint'
        ];
    }
}

export interface PromptBreakpoint {
    id: string;
    filePath: string;
    line: number;
    condition?: string;
    enabled: boolean;
    type: BreakpointType;
}

export enum BreakpointType {
    ExecutionStart = 'execution-start',
    ParameterCheck = 'parameter-check', 
    LineBreak = 'line-break',
    ResponseReceived = 'response-received',
    CostThreshold = 'cost-threshold',
    TokenThreshold = 'token-threshold'
}

export interface BreakpointContext {
    parameters: Record<string, any>;
    executionMetrics: {
        tokens: number;
        cost: number;
        executionTime: number;
    };
    response?: string;
    currentStep: string;
}
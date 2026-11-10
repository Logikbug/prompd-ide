import * as vscode from 'vscode';
import { PrompdChatRequest, PrompdChatResponse } from './prompdChatService';

/**
 * Enhanced Error Handler for Prompd Chat
 * 
 * Provides intelligent error detection, debugging assistance,
 * and recovery suggestions for prompt engineering workflows
 */

export interface PrompdError {
    type: 'syntax' | 'semantic' | 'runtime' | 'connection' | 'validation';
    severity: 'error' | 'warning' | 'info';
    message: string;
    location?: vscode.Location;
    fixes?: PrompdErrorFix[];
    context?: any;
}

export interface PrompdErrorFix {
    title: string;
    description: string;
    action: () => Promise<void>;
    autoApplicable?: boolean;
}

export class PrompdErrorHandler {
    private diagnostics: vscode.DiagnosticCollection;
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.diagnostics = vscode.languages.createDiagnosticCollection('prompd');
        this.outputChannel = vscode.window.createOutputChannel('Prompd Error Handler');
        this.context.subscriptions.push(this.diagnostics, this.outputChannel);
    }

    /**
     * Handle errors from chat interactions
     */
    public async handleChatError(error: Error, request: PrompdChatRequest): Promise<PrompdChatResponse> {
        this.outputChannel.appendLine(`Chat Error: ${error.message}`);
        this.outputChannel.appendLine(`Request: ${JSON.stringify(request, null, 2)}`);

        const prompdError = this.categorizeError(error, request);
        await this.displayError(prompdError);

        return {
            success: false,
            message: this.getUserFriendlyMessage(prompdError),
            suggestions: this.generateErrorSuggestions(prompdError)
        };
    }

    /**
     * Validate prompt file for common issues
     */
    public async validatePromptFile(document: vscode.TextDocument): Promise<PrompdError[]> {
        const errors: PrompdError[] = [];
        const content = document.getText();

        if (document.fileName.endsWith('.prompd')) {
            errors.push(...await this.validatePrompdFile(document, content));
        } else if (document.fileName.endsWith('.prompdflow')) {
            errors.push(...await this.validatePrompdFlowFile(document, content));
        }

        // Update diagnostics
        this.updateDiagnostics(document, errors);
        
        return errors;
    }

    /**
     * Validate .prompd file structure
     */
    private async validatePrompdFile(document: vscode.TextDocument, content: string): Promise<PrompdError[]> {
        const errors: PrompdError[] = [];
        const lines = content.split('\n');

        // Check for YAML frontmatter (non-destructive warning only)
        if (!content.startsWith('---')) {
            errors.push({
                type: 'syntax',
                severity: 'warning',
                message: 'Consider adding YAML frontmatter for better prompt structure',
                location: new vscode.Location(document.uri, new vscode.Position(0, 0))
                // Removed auto-fix to prevent destructive changes
            });
        }

        // Check for parameter syntax
        const parameterRegex = /\{(\w+)\}/g;
        const declaredParameters = this.extractDeclaredParameters(content);
        
        let match;
        while ((match = parameterRegex.exec(content)) !== null) {
            const paramName = match[1];
            if (!declaredParameters.includes(paramName)) {
                const position = document.positionAt(match.index);
                errors.push({
                    type: 'validation',
                    severity: 'warning',
                    message: `Undeclared parameter: ${paramName}`,
                    location: new vscode.Location(document.uri, position),
                    fixes: [{
                        title: `Declare parameter ${paramName}`,
                        description: `Add ${paramName} to the parameters section`,
                        action: async () => await this.addParameter(document, paramName)
                    }]
                });
            }
        }

        // Check for required sections
        const requiredSections = ['# System', '# User'];
        for (const section of requiredSections) {
            if (!content.includes(section)) {
                errors.push({
                    type: 'semantic',
                    severity: 'warning',
                    message: `Missing recommended section: ${section}`,
                    location: new vscode.Location(document.uri, new vscode.Position(0, 0)),
                    fixes: [{
                        title: `Add ${section} section`,
                        description: `Add the ${section} section template`,
                        action: async () => await this.addSection(document, section)
                    }]
                });
            }
        }

        return errors;
    }

    /**
     * Validate .prompdflow file structure
     */
    private async validatePrompdFlowFile(document: vscode.TextDocument, content: string): Promise<PrompdError[]> {
        const errors: PrompdError[] = [];

        try {
            const flow = JSON.parse(content);

            // Validate basic structure
            if (!flow.version) {
                errors.push({
                    type: 'validation',
                    severity: 'error',
                    message: 'Missing version field in flow definition',
                    location: new vscode.Location(document.uri, new vscode.Position(0, 0))
                });
            }

            if (!flow.nodes || !Array.isArray(flow.nodes)) {
                errors.push({
                    type: 'validation',
                    severity: 'error',
                    message: 'Missing or invalid nodes array',
                    location: new vscode.Location(document.uri, new vscode.Position(0, 0))
                });
            }

            if (!flow.connections || !Array.isArray(flow.connections)) {
                errors.push({
                    type: 'validation',
                    severity: 'warning',
                    message: 'Missing or invalid connections array',
                    location: new vscode.Location(document.uri, new vscode.Position(0, 0))
                });
            }

            // Validate node connections
            if (flow.nodes && flow.connections) {
                errors.push(...this.validateNodeConnections(document, flow));
            }

        } catch (error) {
            errors.push({
                type: 'syntax',
                severity: 'error',
                message: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
                location: new vscode.Location(document.uri, new vscode.Position(0, 0)),
                fixes: [{
                    title: 'Fix JSON syntax',
                    description: 'Automatically format and fix JSON syntax',
                    action: async () => await this.formatJSON(document)
                }]
            });
        }

        return errors;
    }

    /**
     * Validate node connections in flow
     */
    private validateNodeConnections(document: vscode.TextDocument, flow: any): PrompdError[] {
        const errors: PrompdError[] = [];
        const nodeIds = new Set(flow.nodes.map((n: any) => n.id));

        for (const connection of flow.connections) {
            if (!nodeIds.has(connection.source)) {
                errors.push({
                    type: 'validation',
                    severity: 'error',
                    message: `Connection references unknown source node: ${connection.source}`,
                    location: new vscode.Location(document.uri, new vscode.Position(0, 0)),
                    fixes: [{
                        title: 'Remove invalid connection',
                        description: 'Remove this connection or fix the node reference',
                        action: async () => await this.removeConnection(document, connection.id)
                    }]
                });
            }

            if (!nodeIds.has(connection.target)) {
                errors.push({
                    type: 'validation',
                    severity: 'error',
                    message: `Connection references unknown target node: ${connection.target}`,
                    location: new vscode.Location(document.uri, new vscode.Position(0, 0)),
                    fixes: [{
                        title: 'Remove invalid connection',
                        description: 'Remove this connection or fix the node reference',
                        action: async () => await this.removeConnection(document, connection.id)
                    }]
                });
            }
        }

        // Check for orphaned nodes
        const connectedNodes = new Set();
        flow.connections.forEach((conn: any) => {
            connectedNodes.add(conn.source);
            connectedNodes.add(conn.target);
        });

        flow.nodes.forEach((node: any) => {
            if (!connectedNodes.has(node.id) && flow.nodes.length > 1) {
                errors.push({
                    type: 'validation',
                    severity: 'warning',
                    message: `Orphaned node (not connected): ${node.id}`,
                    location: new vscode.Location(document.uri, new vscode.Position(0, 0)),
                    context: { nodeId: node.id }
                });
            }
        });

        return errors;
    }

    /**
     * Categorize error by type and severity
     */
    private categorizeError(error: Error, request: PrompdChatRequest): PrompdError {
        const message = error.message.toLowerCase();

        // Connection errors
        if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
            return {
                type: 'connection',
                severity: 'error',
                message: 'Failed to connect to AI provider. Check your internet connection and API credentials.',
                fixes: [
                    {
                        title: 'Check connection',
                        description: 'Test internet connectivity and API endpoints',
                        action: async () => await this.testConnection()
                    },
                    {
                        title: 'Reconfigure provider',
                        description: 'Update API keys and endpoints',
                        action: async () => await vscode.commands.executeCommand('prompd.configureProvider')
                    }
                ]
            };
        }

        // API key errors
        if (message.includes('unauthorized') || message.includes('api key') || message.includes('authentication')) {
            return {
                type: 'connection',
                severity: 'error',
                message: 'Invalid API credentials. Please check your API key configuration.',
                fixes: [
                    {
                        title: 'Update API key',
                        description: 'Reconfigure your API key',
                        action: async () => await vscode.commands.executeCommand('prompd.configureProvider')
                    }
                ]
            };
        }

        // Rate limiting
        if (message.includes('rate limit') || message.includes('quota')) {
            return {
                type: 'connection',
                severity: 'warning',
                message: 'API rate limit exceeded. Please wait before making more requests.',
                fixes: [
                    {
                        title: 'Wait and retry',
                        description: 'Wait a moment and try again',
                        action: async () => await this.waitAndRetry(request)
                    }
                ]
            };
        }

        // Generic error
        return {
            type: 'runtime',
            severity: 'error',
            message: error.message,
            fixes: [
                {
                    title: 'View logs',
                    description: 'Check detailed error information',
                    action: async () => this.outputChannel.show()
                }
            ]
        };
    }

    /**
     * Update VS Code diagnostics
     */
    private updateDiagnostics(document: vscode.TextDocument, errors: PrompdError[]): void {
        const diagnostics: vscode.Diagnostic[] = errors.map(error => {
            const range = error.location?.range || new vscode.Range(0, 0, 0, 0);
            const severity = error.severity === 'error' ? vscode.DiagnosticSeverity.Error :
                           error.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                           vscode.DiagnosticSeverity.Information;

            const diagnostic = new vscode.Diagnostic(range, error.message, severity);
            diagnostic.source = 'prompd';
            return diagnostic;
        });

        this.diagnostics.set(document.uri, diagnostics);
    }

    /**
     * Display error to user
     */
    private async displayError(error: PrompdError): Promise<void> {
        const actions = error.fixes?.map(fix => fix.title) || [];
        
        if (error.severity === 'error') {
            const choice = await vscode.window.showErrorMessage(error.message, ...actions);
            if (choice) {
                const fix = error.fixes?.find(f => f.title === choice);
                if (fix) {
                    await fix.action();
                }
            }
        } else if (error.severity === 'warning') {
            const choice = await vscode.window.showWarningMessage(error.message, ...actions);
            if (choice) {
                const fix = error.fixes?.find(f => f.title === choice);
                if (fix) {
                    await fix.action();
                }
            }
        }
    }

    /**
     * Generate user-friendly error message
     */
    private getUserFriendlyMessage(error: PrompdError): string {
        switch (error.type) {
            case 'connection':
                return 'Connection issue detected. Please check your network and API configuration.';
            case 'validation':
                return 'Prompt validation failed. Please check your file structure.';
            case 'syntax':
                return 'Syntax error detected. Please check your file format.';
            case 'semantic':
                return 'Semantic issue found. Please review your prompt logic.';
            default:
                return error.message;
        }
    }

    /**
     * Generate error-specific suggestions
     */
    private generateErrorSuggestions(error: PrompdError): any[] {
        return error.fixes?.map(fix => ({
            type: error.severity === 'error' ? 'warning' : 'improvement',
            title: fix.title,
            description: fix.description,
            action: fix.action
        })) || [];
    }

    // Helper methods for error fixes
    private async addYamlFrontmatter(document: vscode.TextDocument): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const frontmatter = `---
name: "New Prompt"
description: "Describe your prompt here"
version: "1.0"
parameters:
  - name: example_param
    type: string
    required: false
    description: "Example parameter"
---

`;
        edit.insert(document.uri, new vscode.Position(0, 0), frontmatter);
        await vscode.workspace.applyEdit(edit);
    }

    private extractDeclaredParameters(content: string): string[] {
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!yamlMatch) return [];

        try {
            const yaml = require('yaml');
            const frontmatter = yaml.parse(yamlMatch[1]);
            return frontmatter.parameters?.map((p: any) => p.name) || [];
        } catch {
            return [];
        }
    }

    private async addParameter(document: vscode.TextDocument, paramName: string): Promise<void> {
        // Implementation to add parameter to YAML frontmatter
        vscode.window.showInformationMessage(`Add parameter: ${paramName}`);
    }

    private async addSection(document: vscode.TextDocument, section: string): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const sectionContent = `\n${section}\n[Add your ${section.toLowerCase().replace('# ', '')} content here]\n`;
        edit.insert(document.uri, new vscode.Position(document.lineCount, 0), sectionContent);
        await vscode.workspace.applyEdit(edit);
    }

    private async formatJSON(document: vscode.TextDocument): Promise<void> {
        await vscode.commands.executeCommand('editor.action.formatDocument');
    }

    private async removeConnection(document: vscode.TextDocument, connectionId: string): Promise<void> {
        vscode.window.showInformationMessage(`Remove connection: ${connectionId}`);
    }

    private async testConnection(): Promise<void> {
        this.outputChannel.show();
        this.outputChannel.appendLine('Testing connection...');
    }

    private async waitAndRetry(request: PrompdChatRequest): Promise<void> {
        vscode.window.showInformationMessage('Waiting 30 seconds before retry...');
        setTimeout(() => {
            vscode.commands.executeCommand('prompd.retryLastRequest');
        }, 30000);
    }

    public dispose(): void {
        this.diagnostics.dispose();
        this.outputChannel.dispose();
    }
}

export default PrompdErrorHandler;
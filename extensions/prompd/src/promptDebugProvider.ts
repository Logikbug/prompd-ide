import * as vscode from 'vscode';
import * as path from 'path';
import { executeSecureCommand, buildPrompdArgs, extractParameters } from './extension';
import { PromptBreakpointManager, BreakpointContext } from './promptBreakpoints';

// Removed debug configuration provider - using direct approach instead

/**
 * Prompt Debug Session Manager
 * Manages the debugging session for prompts
 */
export class PromptDebugSession {
    private outputChannel: vscode.OutputChannel;
    private terminal: vscode.Terminal | undefined;
    private isRunning: boolean = false;
    private currentStep: number = 0;
    private parameters: Record<string, any> = {};
    private breakpointManager: PromptBreakpointManager;
    
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Prompt Debugger');
        this.breakpointManager = new PromptBreakpointManager();
    }

    async startDebugging(config: any) {
        this.outputChannel.clear();
        this.outputChannel.show();
        
        // Show in debug console
        this.log('🚀 Starting Prompt Debugging Session');
        this.log(`📄 File: ${path.basename(config.program)}`);
        this.log(`🤖 Provider: ${config.provider || 'openai'}`);
        this.log(`🎯 Model: ${config.model || 'gpt-4'}`);
        
        try {
            // Load and parse the prompt file
            const document = await vscode.workspace.openTextDocument(config.program);
            const content = document.getText();
            const parameters = await extractParameters(content);
            
            // Show parameters
            this.log('\n📊 Parameters:');
            if (parameters.length === 0) {
                this.log('   No parameters defined');
            } else {
                parameters.forEach(param => {
                    const value = config.parameters?.[param.name] || param.default || '';
                    this.parameters[param.name] = value;
                    this.log(`   ${param.name}: "${value}" (${param.type})`);
                });
            }
            
            // Create debug terminal for interaction
            this.terminal = vscode.window.createTerminal({
                name: 'Prompt Debug Console',
                message: '🔍 Prompt debugging session started. Use commands like "step", "continue", "inspect"'
            });
            
            // Show prompt steps
            await this.showPromptSteps(content);
            
            // Show breakpoint info
            this.showBreakpointInfo(config.program);
            
            // Start execution
            await this.executeStep(config);
            
        } catch (error) {
            this.log(`❌ Error: ${error}`);
        }
    }

    private async showPromptSteps(content: string) {
        this.log('\n🔗 Prompt Execution Plan:');
        this.log('   1. Parameter Validation');
        this.log('   2. Prompt Preprocessing');  
        this.log('   3. LLM Request Execution');
        this.log('   4. Response Processing');
        this.log('   5. Output Generation');
        this.log('\n⏯️  Ready to execute...\n');
    }

    private async executeStep(config: any) {
        this.isRunning = true;
        this.currentStep = 1;
        
        this.log('🔄 Step 1: Validating Parameters...');
        
        // Validate required parameters
        const requiredParams = Object.entries(this.parameters).filter(([_, value]) => !value);
        if (requiredParams.length > 0) {
            this.log(`⚠️  Missing required parameters: ${requiredParams.map(([key]) => key).join(', ')}`);
        } else {
            this.log('✅ All parameters validated');
        }
        
        // Step 2: Execute the actual prompt
        this.log('\n🔄 Step 2: Executing Prompt...');
        await this.executePrompt(config);
    }

    private async executePrompt(config: any) {
        try {
            const startTime = Date.now();
            
            // Build the command
            const args = buildPrompdArgs('execute', config.program, {
                provider: config.provider || 'openai',
                model: config.model || 'gpt-4', 
                parameters: this.parameters
            });
            
            this.log(`📤 Command: prompd ${args.join(' ')}`);
            
            // Execute with streaming output
            const { stdout, stderr } = await executeSecureCommand('prompd', args);
            
            const executionTime = Date.now() - startTime;
            
            if (stderr) {
                this.log(`\n⚠️  Warnings:`);
                this.log(stderr);
            }
            
            if (stdout) {
                this.log(`\n📥 Response (${executionTime}ms):`);
                this.log('─'.repeat(50));
                this.log(stdout);
                this.log('─'.repeat(50));
                
                // Analyze response
                this.analyzeResponse(stdout, executionTime);
            }
            
            this.log('\n✅ Prompt execution completed!');
            this.isRunning = false;
            
        } catch (error) {
            this.log(`\n❌ Execution Error: ${error}`);
            this.isRunning = false;
        }
    }
    
    private analyzeResponse(response: string, executionTime: number) {
        const wordCount = response.split(' ').length;
        const estimatedTokens = Math.ceil(wordCount * 1.3); // Rough estimate
        const estimatedCost = estimatedTokens * 0.00003; // GPT-4 estimate
        
        this.log('\n📊 Execution Metrics:');
        this.log(`   • Execution Time: ${executionTime}ms`);
        this.log(`   • Word Count: ${wordCount}`);
        this.log(`   • Estimated Tokens: ~${estimatedTokens}`);
        this.log(`   • Estimated Cost: ~$${estimatedCost.toFixed(4)}`);
        this.log(`   • Response Length: ${response.length} characters`);
    }

    private showBreakpointInfo(filePath: string) {
        const breakpoints = this.breakpointManager.getBreakpoints(filePath);
        
        if (breakpoints.length > 0) {
            this.log('\n🔴 Active Breakpoints:');
            breakpoints.forEach(bp => {
                const condition = bp.condition ? ` (${bp.condition})` : '';
                this.log(`   Line ${bp.line + 1}: ${bp.type}${condition}`);
            });
        } else {
            this.log('\n💡 Breakpoint Tips:');
            this.log('   • Click in the left margin to set breakpoints');
            this.log('   • Right-click breakpoints to add conditions like:');
            this.breakpointManager.getBreakpointHints().forEach(hint => {
                this.log(`     ${hint}`);
            });
        }
    }

    private checkBreakpoint(filePath: string, line: number, context: BreakpointContext): boolean {
        return this.breakpointManager.shouldBreakAtLine(filePath, line, context);
    }

    private log(message: string) {
        this.outputChannel.appendLine(message);
    }

    dispose() {
        this.outputChannel.dispose();
        this.terminal?.dispose();
    }
}

// Removed debug adapter classes - using direct output channel approach instead
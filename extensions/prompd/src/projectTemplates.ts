import * as vscode from 'vscode';
import * as path from 'path';

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    files: TemplateFile[];
    settings?: any;
}

export interface TemplateFile {
    path: string;
    content: string;
    type: 'prompd' | 'pdflow' | 'pdproj' | 'json' | 'md';
}

export class ProjectTemplateManager {
    private templates: ProjectTemplate[] = [];

    constructor() {
        this.initializeDefaultTemplates();
    }

    private initializeDefaultTemplates() {
        this.templates = [
            // Basic Prompt Template
            {
                id: 'basic-prompt',
                name: 'Basic Prompt Project',
                description: 'Simple single-prompt project for beginners',
                category: 'Basic',
                files: [
                    {
                        path: 'project.pdproj',
                        type: 'pdproj',
                        content: `---
name: my-prompt-project
version: 1.0.0
description: A basic prompt engineering project
type: prompd-project

structure:
  prompts/: "Prompt definitions"
  
settings:
  defaultModel: gpt-4o-mini
  temperature: 0.7

dependencies: []
`
                    },
                    {
                        path: 'prompts/hello-world.prompd',
                        type: 'prompd',
                        content: `---
name: hello-world
version: 1.0.0
description: A simple greeting prompt
author: You
tags: [basic, greeting]

parameters:
  - name: name
    type: string
    description: Name of the person to greet
    required: true
  - name: language
    type: string
    description: Language for greeting
    default: English
    enum: [English, Spanish, French, German]

model: gpt-4o-mini
temperature: 0.3
---

# Hello World Prompt

You are a friendly assistant. Greet the person named {name} in {language}.

Be warm and welcoming in your response.
`
                    },
                    {
                        path: 'README.md',
                        type: 'md',
                        content: `# My Prompt Project

This is a basic prompt engineering project created with Prompd IDE.

## Getting Started

1. Open \`prompts/hello-world.prompd\`
2. Press F5 or use "Run Prompt" command
3. Enter parameters when prompted
4. See the AI response

## Project Structure

- \`prompts/\` - Contains your .prompd files
- \`project.pdproj\` - Project configuration

## Next Steps

- Explore the Prompd Marketplace for more templates
- Create additional prompts in the \`prompts/\` folder
- Experiment with different parameters and models
`
                    }
                ]
            },

            // Workflow Template
            {
                id: 'ai-workflow',
                name: 'AI Workflow Project',
                description: 'Multi-step AI workflow with connected prompts',
                category: 'Advanced',
                files: [
                    {
                        path: 'project.pdproj',
                        type: 'pdproj',
                        content: `---
name: ai-workflow-project
version: 1.0.0
description: Advanced AI workflow with multiple connected prompts
type: prompd-project

structure:
  prompts/: "Individual prompt components"
  workflows/: "Workflow definitions"
  tests/: "Test cases"
  
settings:
  defaultModel: gpt-4
  temperature: 0.7

dependencies:
  - "@prompd/common-patterns": "^1.0.0"
`
                    },
                    {
                        path: 'prompts/analyze-text.prompd',
                        type: 'prompd',
                        content: `---
name: analyze-text
version: 1.0.0
description: Analyze text content for key insights
author: You
tags: [analysis, text, insights]

parameters:
  - name: text
    type: string
    description: Text to analyze
    required: true
  - name: focus
    type: string
    description: Analysis focus area
    default: general
    enum: [general, sentiment, topics, summary]

model: gpt-4
temperature: 0.3
---

# Text Analysis Expert

Analyze the following text with focus on {focus}:

{text}

Provide:
1. Key insights
2. Main themes
3. Notable patterns
4. Actionable recommendations

Format as structured JSON with clear sections.
`
                    },
                    {
                        path: 'prompts/generate-summary.prompd',
                        type: 'prompd',
                        content: `---
name: generate-summary
version: 1.0.0
description: Generate concise summary from analysis
author: You
tags: [summary, synthesis]

parameters:
  - name: analysis_data
    type: string
    description: Analysis data to summarize
    required: true
  - name: max_length
    type: integer
    description: Maximum summary length in words
    default: 150

model: gpt-4
temperature: 0.2
---

# Content Summarizer

Based on this analysis data:

{analysis_data}

Create a concise summary (max {max_length} words) that captures:
- Main findings
- Key recommendations
- Critical insights

Write in clear, actionable language suitable for executives.
`
                    },
                    {
                        path: 'workflows/content-pipeline.pdflow',
                        type: 'pdflow',
                        content: `{
  "name": "Content Analysis Pipeline",
  "version": "1.0.0",
  "description": "Analyze text content and generate executive summary",
  "nodes": [
    {
      "id": "input",
      "type": "input",
      "name": "Content Input",
      "position": { "x": 100, "y": 100 },
      "config": {
        "parameters": ["content_text", "analysis_type"]
      }
    },
    {
      "id": "analyze",
      "type": "prompt",
      "name": "Text Analysis",
      "position": { "x": 300, "y": 100 },
      "config": {
        "prompt": "analyze-text.prompd",
        "inputs": {
          "text": "{{input.content_text}}",
          "focus": "{{input.analysis_type}}"
        }
      }
    },
    {
      "id": "summarize",
      "type": "prompt", 
      "name": "Generate Summary",
      "position": { "x": 500, "y": 100 },
      "config": {
        "prompt": "generate-summary.prompd",
        "inputs": {
          "analysis_data": "{{analyze.output}}",
          "max_length": 150
        }
      }
    },
    {
      "id": "output",
      "type": "output",
      "name": "Final Output",
      "position": { "x": 700, "y": 100 },
      "config": {
        "format": "json",
        "fields": ["summary", "analysis", "metadata"]
      }
    }
  ],
  "connections": [
    { "from": "input", "to": "analyze" },
    { "from": "analyze", "to": "summarize" },
    { "from": "summarize", "to": "output" }
  ]
}`
                    },
                    {
                        path: 'README.md',
                        type: 'md',
                        content: `# AI Workflow Project

Advanced project template demonstrating connected AI prompts in a workflow.

## Features

- Multiple specialized prompts
- Visual workflow editor
- Parameter passing between steps
- JSON output formatting

## Workflow Overview

1. **Input**: Raw text content + analysis type
2. **Analyze**: Extract insights and patterns  
3. **Summarize**: Create executive summary
4. **Output**: Structured JSON result

## Getting Started

1. Open \`workflows/content-pipeline.pdflow\`
2. Use the Flow Canvas to visualize the workflow
3. Test individual prompts first
4. Run the complete workflow

## File Structure

- \`prompts/\` - Individual prompt components
- \`workflows/\` - Connected workflow definitions  
- \`tests/\` - Test cases and examples
`
                    }
                ]
            },

            // Enterprise Template
            {
                id: 'enterprise-suite',
                name: 'Enterprise AI Suite',
                description: 'Production-ready enterprise project with testing and deployment',
                category: 'Enterprise',
                files: [
                    {
                        path: 'project.pdproj',
                        type: 'pdproj',
                        content: `---
name: enterprise-ai-suite
version: 1.0.0
description: Enterprise-grade AI application suite
type: prompd-project

structure:
  src/prompts/: "Production prompts"
  src/workflows/: "Business workflows"  
  tests/: "Comprehensive test suite"
  docs/: "Documentation"
  deploy/: "Deployment configurations"
  
settings:
  defaultModel: gpt-4
  temperature: 0.1
  maxTokens: 4096
  
environments:
  development:
    registryUrl: "http://localhost:4000"
    model: gpt-4o-mini
  production:
    registryUrl: "https://registry.prompdhub.ai"
    model: gpt-4
    
dependencies:
  - "@prompd/enterprise-patterns": "^2.0.0"
  - "@prompd/security-helpers": "^1.5.0"
  - "@prompd/monitoring": "^1.2.0"

security:
  inputValidation: true
  outputSanitization: true
  auditLogging: true
`
                    },
                    {
                        path: 'src/prompts/customer-support.prompd',
                        type: 'prompd',
                        content: `---
name: customer-support-agent
version: 2.1.0
description: Enterprise customer support AI agent
author: Enterprise Team
tags: [customer-service, support, production]

parameters:
  - name: customer_query
    type: string
    description: Customer's support request
    required: true
    validation:
      maxLength: 2000
      pattern: "^[\\w\\s.,!?-]+$"
  - name: customer_tier
    type: string
    description: Customer service tier
    enum: [basic, premium, enterprise]
    default: basic
  - name: urgency
    type: string
    description: Issue urgency level
    enum: [low, medium, high, critical]
    default: medium

model: gpt-4
temperature: 0.2
maxTokens: 1000

security:
  sanitizeInputs: true
  validateOutputs: true
---

# Enterprise Customer Support Agent

You are a professional customer support agent for our enterprise software company.

## Customer Information
- Service Tier: {customer_tier}
- Issue Urgency: {urgency}

## Customer Query
{customer_query}

## Response Guidelines

1. **Professional Tone**: Always maintain professional, empathetic communication
2. **Accurate Information**: Only provide verified, accurate information
3. **Escalation**: For critical issues or enterprise customers, offer immediate escalation
4. **Follow-up**: Always ask if additional assistance is needed

## Security Requirements
- Never request sensitive information (passwords, SSNs, payment details)
- Validate all technical recommendations before providing them
- Log interaction for audit purposes

Provide a helpful, accurate response following company guidelines.
`
                    },
                    {
                        path: 'tests/support-agent.test.json',
                        type: 'json',
                        content: `{
  "testSuite": "Customer Support Agent",
  "version": "1.0.0",
  "tests": [
    {
      "name": "Basic Support Query",
      "prompt": "customer-support-agent",
      "inputs": {
        "customer_query": "How do I reset my password?",
        "customer_tier": "basic",
        "urgency": "low"
      },
      "expectedOutputs": [
        "password reset",
        "step-by-step",
        "professional tone"
      ],
      "assertions": [
        {
          "type": "contains",
          "value": "reset"
        },
        {
          "type": "length",
          "min": 50,
          "max": 500
        },
        {
          "type": "tone",
          "expected": "professional"
        }
      ]
    },
    {
      "name": "Enterprise Escalation",
      "prompt": "customer-support-agent", 
      "inputs": {
        "customer_query": "Our entire system is down, affecting 10,000+ users",
        "customer_tier": "enterprise",
        "urgency": "critical"
      },
      "assertions": [
        {
          "type": "contains",
          "value": "escalation"
        },
        {
          "type": "contains",
          "value": "immediate"
        }
      ]
    }
  ]
}`
                    },
                    {
                        path: 'deploy/production.config.json',
                        type: 'json',
                        content: `{
  "environment": "production",
  "deployment": {
    "platform": "prompd-cloud",
    "region": "us-east-1",
    "instances": 3,
    "autoScaling": {
      "enabled": true,
      "minInstances": 2,
      "maxInstances": 10,
      "targetCPU": 70
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics": [
      "response_time",
      "success_rate", 
      "token_usage",
      "customer_satisfaction"
    ],
    "alerts": {
      "responseTime": "> 2s",
      "errorRate": "> 5%"
    }
  },
  "security": {
    "authentication": "required",
    "encryption": "AES-256",
    "auditLogging": true,
    "compliance": ["SOC2", "GDPR"]
  },
  "rateLimit": {
    "requestsPerMinute": 1000,
    "burstLimit": 100
  }
}`
                    },
                    {
                        path: 'README.md',
                        type: 'md',
                        content: `# Enterprise AI Suite

Production-ready enterprise AI application with comprehensive testing, monitoring, and deployment configurations.

## Features

- Enterprise-grade security and compliance
- Comprehensive test suite with automated validation
- Production deployment configurations
- Monitoring and alerting setup
- Multi-environment support (dev/staging/prod)

## Architecture

\`\`\`
src/
├── prompts/          # Production AI prompts
└── workflows/        # Business process workflows
tests/                # Automated test suite  
deploy/               # Deployment configurations
docs/                 # Technical documentation
\`\`\`

## Security Features

- Input validation and sanitization
- Output validation and filtering
- Comprehensive audit logging
- SOC2 and GDPR compliance ready

## Getting Started

1. Review \`project.pdproj\` configuration
2. Run tests: \`npm run test\`
3. Deploy to staging: \`npm run deploy:staging\`
4. Monitor metrics in production dashboard

## Production Checklist

- [ ] Security review completed
- [ ] Load testing passed
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Incident response plan ready
`
                    }
                ]
            }
        ];
    }

    public getTemplates(): ProjectTemplate[] {
        return this.templates;
    }

    public getTemplateById(id: string): ProjectTemplate | undefined {
        return this.templates.find(t => t.id === id);
    }

    public getTemplatesByCategory(category: string): ProjectTemplate[] {
        return this.templates.filter(t => t.category === category);
    }

    public async createProjectFromTemplate(
        templateId: string, 
        projectName: string, 
        targetPath: string
    ): Promise<void> {
        const template = this.getTemplateById(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        // Create project directory
        const projectUri = vscode.Uri.file(path.join(targetPath, projectName));
        await vscode.workspace.fs.createDirectory(projectUri);

        // Create all template files
        for (const file of template.files) {
            const filePath = vscode.Uri.joinPath(projectUri, file.path);
            
            // Create parent directories if needed
            const parentDir = vscode.Uri.joinPath(filePath, '..');
            try {
                await vscode.workspace.fs.createDirectory(parentDir);
            } catch {
                // Directory may already exist
            }

            // Replace template variables in content
            let content = file.content;
            content = content.replace(/my-prompt-project/g, projectName);
            content = content.replace(/My Prompt Project/g, this.titleCase(projectName));
            
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));
        }

        vscode.window.showInformationMessage(
            `Project "${projectName}" created successfully from ${template.name} template!`
        );
    }

    private titleCase(str: string): string {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }
}

export async function showTemplatePickerDialog(): Promise<void> {
    const templateManager = new ProjectTemplateManager();
    const templates = templateManager.getTemplates();
    
    // Show template picker
    const selectedTemplate = await vscode.window.showQuickPick(
        templates.map(t => ({
            label: t.name,
            description: t.category,
            detail: t.description,
            template: t
        })),
        {
            placeHolder: 'Select a project template',
            ignoreFocusOut: true
        }
    );

    if (!selectedTemplate) {
        return;
    }

    // Get project name
    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter project name',
        placeHolder: 'my-awesome-project',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Project name is required';
            }
            if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                return 'Project name can only contain letters, numbers, hyphens, and underscores';
            }
            return undefined;
        }
    });

    if (!projectName) {
        return;
    }

    // Get target directory
    const targetFolders = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Parent Directory'
    });

    if (!targetFolders || targetFolders.length === 0) {
        return;
    }

    const targetPath = targetFolders[0].fsPath;

    // Create project
    try {
        await templateManager.createProjectFromTemplate(
            selectedTemplate.template.id,
            projectName,
            targetPath
        );

        // Ask if user wants to open the new project
        const openProject = await vscode.window.showInformationMessage(
            'Project created successfully! Would you like to open it?',
            'Open Project',
            'Not Now'
        );

        if (openProject === 'Open Project') {
            const projectPath = vscode.Uri.file(path.join(targetPath, projectName));
            await vscode.commands.executeCommand('vscode.openFolder', projectPath);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create project: ${error}`);
    }
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { IFileService } from 'vs/platform/files/common/files';
import { IModelService } from 'vs/editor/common/services/model';
import { IModeService } from 'vs/editor/common/services/language';

/**
 * Register .prompd and .prompdflow file types as native languages in VS Code
 */

export const PROMPD_LANGUAGE_ID = 'prompd';
export const PROMPDFLOW_LANGUAGE_ID = 'prompdflow';

export interface PrompdDocument {
	version: string;
	metadata: {
		name: string;
		description?: string;
		author?: string;
		tags?: string[];
		created?: string;
		modified?: string;
	};
	parameters?: {
		[key: string]: {
			type: 'string' | 'number' | 'boolean' | 'array' | 'object';
			description?: string;
			default?: any;
			required?: boolean;
			enum?: any[];
		};
	};
	providers?: {
		default?: string;
		allowed?: string[];
		config?: {
			[provider: string]: {
				model?: string;
				temperature?: number;
				maxTokens?: number;
				topP?: number;
				[key: string]: any;
			};
		};
	};
	prompts: {
		system?: string;
		user?: string;
		assistant?: string;
		context?: string[];
		examples?: Array<{
			user: string;
			assistant: string;
		}>;
		chain?: Array<{
			id: string;
			prompt: string;
			provider?: string;
			model?: string;
			dependsOn?: string[];
		}>;
	};
	output?: {
		format?: 'text' | 'json' | 'markdown' | 'code';
		schema?: any;
		validation?: string[];
		postProcessing?: string[];
	};
	tests?: Array<{
		name: string;
		input: any;
		expectedOutput?: any;
		assertions?: string[];
	}>;
}

export interface PrompdFlowDocument {
	version: string;
	metadata: {
		id: string;
		name: string;
		description: string;
		version: string;
		created: string;
		modified: string;
		schemaVersion: string;
	};
	settings?: {
		executionMode?: 'sequential' | 'parallel' | 'conditional';
		errorHandling?: 'stop' | 'continue' | 'retry';
		maxRetries?: number;
		timeout?: number;
		logging?: boolean;
		debug?: boolean;
	};
	parameters?: {
		[key: string]: {
			type: string;
			description?: string;
			default?: any;
			required?: boolean;
			validation?: string;
		};
	};
	nodes: Array<{
		id: string;
		type: 'prompt' | 'llm' | 'transform' | 'condition' | 'loop' | 'api' | 'input' | 'output' | 'parameters';
		position: { x: number; y: number };
		data: {
			label?: string;
			prompt?: string;
			provider?: string;
			model?: string;
			temperature?: number;
			maxTokens?: number;
			systemPrompt?: string;
			examples?: Array<{ input: string; output: string }>;
			transform?: string;
			condition?: string;
			loopOver?: string;
			maxIterations?: number;
			endpoint?: string;
			method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
			headers?: Record<string, string>;
			body?: any;
			outputVariable?: string;
			parameters?: Record<string, any>;
		};
		ports?: {
			input?: Array<{ id: string; label?: string; type?: string }>;
			output?: Array<{ id: string; label?: string; type?: string }>;
		};
	}>;
	connections: Array<{
		id: string;
		from: string;
		to: string;
		fromPort?: string;
		toPort?: string;
		data?: {
			condition?: string;
			transform?: string;
			label?: string;
		};
	}>;
	variables?: Record<string, any>;
	execution?: {
		history?: Array<{
			timestamp: string;
			status: 'success' | 'failure' | 'partial';
			duration: number;
			results?: any;
			errors?: string[];
		}>;
		breakpoints?: string[];
		watchedVariables?: string[];
	};
}

// Language configuration for .prompd files
export const prompdLanguageConfig = {
	comments: {
		lineComment: '#',
		blockComment: ['"""', '"""']
	},
	brackets: [
		['{', '}'],
		['[', ']'],
		['(', ')']
	],
	autoClosingPairs: [
		{ open: '{', close: '}' },
		{ open: '[', close: ']' },
		{ open: '(', close: ')' },
		{ open: '"', close: '"' },
		{ open: "'", close: "'" },
		{ open: '`', close: '`' },
		{ open: '"""', close: '"""' }
	],
	surroundingPairs: [
		{ open: '{', close: '}' },
		{ open: '[', close: ']' },
		{ open: '(', close: ')' },
		{ open: '"', close: '"' },
		{ open: "'", close: "'" },
		{ open: '`', close: '`' }
	],
	folding: {
		markers: {
			start: /^\s*#region\b/,
			end: /^\s*#endregion\b/
		}
	},
	wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
	indentationRules: {
		increaseIndentPattern: /^.*\{[^}"']*$/,
		decreaseIndentPattern: /^.*\}[^{"']*$/
	}
};

// Language configuration for .prompdflow files (JSON-based)
export const prompdflowLanguageConfig = {
	comments: {
		lineComment: '//',
		blockComment: ['/*', '*/']
	},
	brackets: [
		['{', '}'],
		['[', ']']
	],
	autoClosingPairs: [
		{ open: '{', close: '}' },
		{ open: '[', close: ']' },
		{ open: '"', close: '"' }
	],
	surroundingPairs: [
		{ open: '{', close: '}' },
		{ open: '[', close: ']' },
		{ open: '"', close: '"' }
	],
	folding: {
		markers: {
			start: /^\s*\/\/\s*#region\b/,
			end: /^\s*\/\/\s*#endregion\b/
		}
	}
};

// Syntax highlighting patterns for .prompd files
export const prompdMonarchLanguage = {
	defaultToken: '',
	tokenPostfix: '.prompd',
	
	keywords: [
		'version', 'metadata', 'parameters', 'providers', 'prompts',
		'system', 'user', 'assistant', 'context', 'examples', 'chain',
		'output', 'format', 'schema', 'validation', 'tests',
		'name', 'description', 'author', 'tags', 'type', 'default',
		'required', 'enum', 'model', 'temperature', 'maxTokens'
	],
	
	typeKeywords: [
		'string', 'number', 'boolean', 'array', 'object',
		'text', 'json', 'markdown', 'code'
	],
	
	operators: [
		'=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
		'&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
		'<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
		'%=', '<<=', '>>=', '>>>='
	],
	
	symbols: /[=><!~?:&|+\-*\/\^%]+/,
	escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
	
	tokenizer: {
		root: [
			// Comments
			[/#.*$/, 'comment'],
			[/"""/, { token: 'string', next: '@multistring' }],
			
			// Variables and parameters
			[/\{\{[^}]+\}\}/, 'variable'],
			[/\$\w+/, 'variable'],
			
			// Keywords
			[/\b(version|metadata|parameters|providers|prompts|output|tests)\b/, 'keyword'],
			[/\b(system|user|assistant|context|examples|chain)\b/, 'keyword.control'],
			[/\b(string|number|boolean|array|object)\b/, 'type'],
			
			// Strings
			[/"([^"\\]|\\.)*$/, 'string.invalid'],
			[/'([^'\\]|\\.)*$/, 'string.invalid'],
			[/"/, 'string', '@string_double'],
			[/'/, 'string', '@string_single'],
			[/`/, 'string', '@string_backtick'],
			
			// Numbers
			[/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
			[/0[xX][0-9a-fA-F]+/, 'number.hex'],
			[/\d+/, 'number'],
			
			// Booleans
			[/\b(true|false)\b/, 'keyword.constant'],
			
			// Identifiers
			[/[a-zA-Z_]\w*/, 'identifier'],
			
			// Whitespace
			{ include: '@whitespace' },
			
			// Delimiters and operators
			[/[{}()\[\]]/, '@brackets'],
			[/@symbols/, 'operator'],
			[/[;,.]/, 'delimiter']
		],
		
		multistring: [
			[/[^"]+/, 'string'],
			[/"""/, { token: 'string', next: '@pop' }],
			[/"/, 'string']
		],
		
		string_double: [
			[/[^\\"]+/, 'string'],
			[/@escapes/, 'string.escape'],
			[/\\./, 'string.escape.invalid'],
			[/"/, 'string', '@pop']
		],
		
		string_single: [
			[/[^\\']+/, 'string'],
			[/@escapes/, 'string.escape'],
			[/\\./, 'string.escape.invalid'],
			[/'/, 'string', '@pop']
		],
		
		string_backtick: [
			[/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
			[/[^\\`$]+/, 'string'],
			[/@escapes/, 'string.escape'],
			[/\\./, 'string.escape.invalid'],
			[/`/, 'string', '@pop']
		],
		
		bracketCounting: [
			[/\{/, 'delimiter.bracket', '@bracketCounting'],
			[/\}/, 'delimiter.bracket', '@pop'],
			{ include: 'root' }
		],
		
		whitespace: [
			[/[ \t\r\n]+/, 'white'],
			[/\/\*/, 'comment', '@comment'],
			[/\/\/.*$/, 'comment']
		],
		
		comment: [
			[/[^\/*]+/, 'comment'],
			[/\/\*/, 'comment', '@push'],
			[/\*\//, 'comment', '@pop'],
			[/[\/*]/, 'comment']
		]
	}
};

// Register the languages
export function registerPrompdLanguages(): void {
	// This will be called from the contribution point
	// The actual registration happens through the package.json or contribution points
}

// File associations
export const prompdFileAssociations = [
	{
		id: PROMPD_LANGUAGE_ID,
		extensions: ['.prompd'],
		aliases: ['Prompd', 'prompd'],
		mimetypes: ['text/x-prompd', 'application/x-prompd'],
		configuration: './language-configuration.json'
	},
	{
		id: PROMPDFLOW_LANGUAGE_ID,
		extensions: ['.prompdflow'],
		aliases: ['Prompd Flow', 'prompdflow'],
		mimetypes: ['application/json', 'application/x-prompdflow'],
		configuration: './language-configuration.json'
	}
];
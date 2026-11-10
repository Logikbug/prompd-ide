/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Logikbug. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IPrompdService = createDecorator<IPrompdService>('prompdService');

export interface IPrompdNode {
	readonly id: string;
	readonly type: string;
	readonly position: { x: number; y: number };
	readonly data: {
		label: string;
		description: string;
		enabled: boolean;
		config: any;
	};
	readonly inputPorts: IPrompdPort[];
	readonly outputPorts: IPrompdPort[];
	readonly metadata: {
		collapsed: boolean;
		breakpoint: boolean;
	};
}

export interface IPrompdPort {
	readonly id: string;
	readonly name: string;
	readonly dataType: string;
	readonly required: boolean;
}

export interface IPrompdConnection {
	readonly id: string;
	readonly sourceNodeId: string;
	readonly sourcePortId: string;
	readonly targetNodeId: string;
	readonly targetPortId: string;
	readonly metadata: {
		style: string;
	};
}

export interface IPrompdFlow {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly version: string;
	readonly tags: string[];
	readonly author: string;
	readonly createdAt: string;
	readonly nodes: IPrompdNode[];
	readonly connections: IPrompdConnection[];
	readonly variables: any[];
	readonly globalSettings: any;
}

export interface IPrompdService {
	readonly _serviceBrand: undefined;

	/**
	 * Create a new prompt flow
	 */
	createFlow(): Promise<IPrompdFlow>;

	/**
	 * Load a prompt flow from file
	 */
	loadFlow(uri: string): Promise<IPrompdFlow | null>;

	/**
	 * Save a prompt flow to file
	 */
	saveFlow(flow: IPrompdFlow, uri?: string): Promise<void>;

	/**
	 * Execute a prompt flow
	 */
	executeFlow(flow: IPrompdFlow): Promise<any>;

	/**
	 * Validate a prompt flow
	 */
	validateFlow(flow: IPrompdFlow): Promise<{ valid: boolean; errors: any[] }>;

	/**
	 * Get available node types
	 */
	getNodeTypes(): string[];

	/**
	 * Create a new node of specified type
	 */
	createNode(type: string, position: { x: number; y: number }): IPrompdNode;
}
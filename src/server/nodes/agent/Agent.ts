/**
 * Agent Node
 *
 * AI Agent node that can execute plans and use tools
 * Supports streaming, fallback models, and custom output formats
 */

import type {
	ExecutionContext,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	NodeExecutionData,
} from '@/types/interfaces';
import { executeAgent } from './execute';
import { agentProperties } from './properties';

const baseDescription: INodeTypeBaseDescription = {
	displayName: 'AI Agent',
	name: 'agent',
	icon: 'bot',
	iconColor: 'standard-gray',
	category: 'AI',
	description: 'Generates an action plan and executes it. Can use external tools.',
	codex: {
		alias: ['LangChain', 'Chat', 'Conversational', 'Plan and Execute', 'ReAct', 'Tools'],
		categories: ['AI'],
		subcategories: {
			AI: ['Agents', 'Root Nodes'],
		},
		resources: {
			primaryDocumentation: [
				{
					url: 'https://docs.example.com/nodes/agent',
				},
			],
		},
	},
};

export class Agent implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: 'AI Agent',
				color: 'standard-purple',
			},
			maxInputs: 1,   // One input connection
			maxOutputs: 1,  // One output connection
			properties: agentProperties,
			hints: [
				{
					message:
						'You are using streaming responses. Make sure to set the response mode to "Streaming" on the trigger node.',
					type: 'warning',
					location: 'outputPane',
					whenToDisplay: 'afterExecution',
					displayCondition: '={{ $parameter["enableStreaming"] === true }}',
				},
			],
		};
	}

	async execute(context: ExecutionContext): Promise<NodeExecutionData[][]> {
		// @ts-expect-error - Agent can return EngineRequest for tool execution (P0 extension)
		return await executeAgent(context);
	}
}

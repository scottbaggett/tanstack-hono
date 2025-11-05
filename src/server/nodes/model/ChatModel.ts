/**
 * Chat Model Node
 *
 * Provides a language model for agent and LLM nodes
 * Simple pass-through node that makes models available to downstream nodes
 */

import type {
	IExecutionContext,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	INodeExecutionData,
} from '@/types/interfaces';

const baseDescription: INodeTypeBaseDescription = {
	displayName: 'Chat Model',
	name: 'chatModel',
	icon: 'brain',
	iconColor: 'standard-blue',
	category: 'AI',
	description: 'Provides a language model configuration',
	codex: {
		alias: ['LLM', 'OpenAI', 'Model', 'GPT'],
		categories: ['AI'],
		subcategories: {
			AI: ['Models'],
		},
		resources: {
			primaryDocumentation: [
				{
					url: 'https://docs.example.com/nodes/chat-model',
				},
			],
		},
	},
};

export class ChatModel implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: 'Chat Model',
				color: 'standard-blue',
			},
			maxInputs: 0,   // No inputs
			maxOutputs: 1,  // One output connection
			outputs: [
				{
					displayName: 'Model',
					name: 'model',
					type: 'ai_languageModel',
				},
			],
			properties: [
				{
					displayName: 'Provider',
					name: 'provider',
					type: 'options',
					options: [
						{ name: 'OpenAI', value: 'openai' },
						{ name: 'Anthropic', value: 'anthropic' },
						{ name: 'Google', value: 'google' },
					],
					default: 'openai',
					description: 'The model provider to use',
				},
				{
					displayName: 'Model',
					name: 'model',
					type: 'string',
					default: 'gpt-4',
					description: 'The model name',
				},
				{
					displayName: 'Temperature',
					name: 'temperature',
					type: 'number',
					default: 0.7,
					description: 'Controls randomness (0-1)',
				},
			],
		};
	}

	async execute(context: IExecutionContext): Promise<INodeExecutionData[][]> {
		// This node just passes through its configuration
		// The actual model will be created by downstream nodes
		const provider = (context.evaluatedProperties?.provider || context.getNodeParameter('provider', 0)) as string;
		const model = (context.evaluatedProperties?.model || context.getNodeParameter('model', 0)) as string;
		const temperature = (context.evaluatedProperties?.temperature || context.getNodeParameter('temperature', 0)) as number;

		const outputData: INodeExecutionData[] = [{
			json: {
				provider,
				model,
				temperature,
			},
		}];

		// Set output using context helper
		context.setOutput('model', outputData);

		return [outputData];
	}
}

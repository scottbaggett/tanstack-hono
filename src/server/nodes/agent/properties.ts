/**
 * Agent Node Properties
 *
 * Defines the configuration properties for the Agent node
 */

import type { NodeProperty } from '@/types/interfaces';

export const agentProperties: NodeProperty[] = [
	{
		displayName: 'System Prompt',
		name: 'systemPrompt',
		type: 'string',
		default: 'You are a helpful AI assistant.',
		description: 'System prompt that guides the agent behavior',
	},
	{
		displayName: 'Prompt Type',
		name: 'promptType',
		type: 'select',
		default: 'define',
		options: [
			{ name: 'From Previous Node', value: 'auto' },
			{ name: 'Define Below', value: 'define' },
		],
		description: 'Where the agent prompt comes from',
	},
	{
		displayName: 'User Prompt',
		name: 'userPrompt',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				promptType: ['define'],
			},
		},
		description: 'The prompt/task for the agent',
	},
	{
		displayName: 'Require Specific Output Format',
		name: 'hasOutputParser',
		type: 'boolean',
		default: false,
		noDataExpression: true,
		description: 'Whether to require structured output',
	},
	{
		displayName:
			'Connect an output parser on the canvas to specify the output format',
		name: 'outputParserNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				hasOutputParser: [true],
			},
		},
	},
	{
		displayName: 'Enable Fallback Model',
		name: 'needsFallback',
		type: 'boolean',
		default: false,
		noDataExpression: true,
		description: 'Use a fallback model if the main model fails',
	},
	{
		displayName: 'Connect an additional language model as fallback',
		name: 'fallbackNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				needsFallback: [true],
			},
		},
	},
	{
		displayName: 'Enable Streaming',
		name: 'enableStreaming',
		type: 'boolean',
		default: false,
		description: 'Stream responses in real-time',
	},
	{
		displayName: 'Max Iterations',
		name: 'maxIterations',
		type: 'number',
		default: 10,
		description: 'Maximum number of agent iterations',
	},
	{
		displayName: 'Temperature',
		name: 'temperature',
		type: 'number',
		default: 0.7,
		description: 'Controls response randomness (0-2)',
	},
];

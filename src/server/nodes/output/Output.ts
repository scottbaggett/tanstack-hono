/**
 * Output Node
 *
 * Simple node that outputs received data
 * Useful as terminal node in workflows
 */

import type {
	ExecutionContext,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	NodeExecutionData,
} from '@/types/interfaces';

const baseDescription: INodeTypeBaseDescription = {
	displayName: 'Output',
	name: 'output',
	icon: 'send',
	iconColor: 'standard-green',
	category: 'output',
	description: 'Output node that formats and returns workflow results',
	codex: {
		alias: ['Result', 'Return', 'Output'],
		categories: ['output'],
		subcategories: {
			output: ['Results'],
		},
		resources: {
			primaryDocumentation: [
				{
					url: 'https://docs.example.com/nodes/output',
				},
			],
		},
	},
};

export class Output implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: 'Output',
				color: 'standard-green',
			},
			maxInputs: 1,   // One input connection
			maxOutputs: 0,  // End node - no outputs
			properties: [
				{
					displayName: 'Output Label',
					name: 'label',
					type: 'string',
					default: 'result',
					description: 'Label for the output field',
				},
			],
		};
	}

	async execute(context: ExecutionContext): Promise<NodeExecutionData[][]> {
		const label = (context.evaluatedProperties.label as string) || 'result';
		const input = context.inputs.input || {};

		return [
			[
				{
					json: {
						[label]: input,
					},
				},
			],
		];
	}
}

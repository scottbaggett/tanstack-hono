/**
 * If/Else Node
 *
 * Evaluates a condition expression and routes data to one of two outputs
 * - True output: when condition evaluates to truthy
 * - False output: when condition evaluates to falsy
 */

import type {
	IExecutionContext,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	INodeExecutionData,
} from '@/types/interfaces';
import { evaluateExpression } from '@/server/lib/expressions';
import { buildExpressionContext } from '@/server/execution/context';

const baseDescription: INodeTypeBaseDescription = {
	displayName: 'If/Else',
	name: 'ifElse',
	icon: 'git-branch',
	iconColor: 'standard-purple',
	category: 'control',
	description: 'Conditionally routes data based on evaluated expression',
	codex: {
		alias: ['Condition', 'Branch', 'Switch', 'If'],
		categories: ['control'],
		subcategories: {
			control: ['Flow Control'],
		},
		resources: {
			primaryDocumentation: [
				{
					url: 'https://docs.example.com/nodes/if-else',
				},
			],
		},
	},
};

export class IfElse implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: 'If/Else',
				color: 'standard-purple',
			},
			maxInputs: 1,   // One input connection
			maxOutputs: 2,  // Two outputs: true and false
			properties: [
				{
					displayName: 'Condition',
					name: 'condition',
					type: 'string',
					default: 'json.value > 0',
					description: 'CEL expression to evaluate. Use expressions like {{ json.field }} or {{ $input.count > 10 }}. Returns true if truthy, false otherwise.',
					placeholder: 'json.value > 0',
					noDataExpression: false,
				},
			],
		};
	}

	async execute(context: IExecutionContext): Promise<INodeExecutionData[][]> {
		const condition = (context.evaluatedProperties.condition as string) || 'true';

		// Get input data to pass through
		const inputData = context.inputs.main || context.inputs.input || {};
		const inputJson = (inputData as any)?.json || inputData;
		const inputBinary = (inputData as any)?.binary || {};

		// Build expression context for evaluation
		const expressionContext = buildExpressionContext(
			context.nodeId,
			context.nodeType,
			context.version,
			context.properties,
			context.inputs,
		);

		// Evaluate the condition expression
		const evaluation = evaluateExpression(condition, expressionContext);

		if (!evaluation.success) {
			throw new Error(
				`Failed to evaluate condition: ${evaluation.error || 'Unknown error'}`,
			);
		}

		// Determine if condition is truthy
		const conditionResult = Boolean(evaluation.value);

		// Prepare output data (pass through input data)
		const outputData: INodeExecutionData = {
			json: {
				...inputJson,
				_condition: conditionResult,
				_conditionExpression: condition,
			},
			binary: inputBinary,
		};

		// Return data in the appropriate output group
		// Output groups are indexed: [0] = true output, [1] = false output
		// The engine routes based on sourceHandle: "true" -> index 0, "false" -> index 1
		if (conditionResult) {
			return [
				[outputData], // Output group 0: True path (sourceHandle: "true")
				[],          // Output group 1: False path (empty)
			];
		} else {
			return [
				[],          // Output group 0: True path (empty)
				[outputData], // Output group 1: False path (sourceHandle: "false")
			];
		}
	}
}


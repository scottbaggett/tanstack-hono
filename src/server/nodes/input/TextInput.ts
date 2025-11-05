/**
 * Text Input Node
 *
 * Simple node that outputs provided text
 * Useful for feeding text into workflows
 */

import type {
	IExecutionContext,
	INodeExecutionData,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from "@/types/interfaces";

const baseDescription: INodeTypeBaseDescription = {
	displayName: "Text Input",
	name: "textInput",
	icon: "type",
	iconColor: "standard-blue",
	category: "input",
	description: "Input node for providing text to workflows",
	codex: {
		alias: ["Text", "Input", "String"],
		categories: ["input"],
		subcategories: {
			input: ["Sources"],
		},
		resources: {
			primaryDocumentation: [
				{
					url: "https://docs.example.com/nodes/text-input",
				},
			],
		},
	},
};

export class TextInput implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: "Text Input",
				color: "standard-blue",
			},
			maxInputs: 0, // Start node - no inputs
			maxOutputs: 1, // One output connection
			properties: [
				{
					displayName: "Text",
					name: "text",
					type: "string",
					default: "",
					description: "The text to output",
				},
			],
		};
	}

	async execute(context: IExecutionContext): Promise<INodeExecutionData[][]> {
		const text = (context.evaluatedProperties.text as string) || "";

		return [
			[
				{
					json: {
						text,
					},
				},
			],
		];
	}
}

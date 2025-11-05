/**
 * Structured Output Node
 *
 * Generates structured JSON output using LLM with schema validation
 * Allows users to define JSON schemas visually or generate them from prompts
 */

import type {
	IExecutionContext,
	INodeExecutionData,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from "@/types/interfaces";

const baseDescription: INodeTypeBaseDescription = {
	displayName: "Structured Output",
	name: "structuredOutput",
	icon: "braces",
	iconColor: "standard-blue",
	category: "AI",
	description: "Generate structured JSON output with schema validation",
	codex: {
		alias: ["JSON", "Schema", "Structured", "Format", "Parse"],
		categories: ["AI"],
		subcategories: {
			AI: ["Output Formatting"],
		},
		resources: {
			primaryDocumentation: [
				{
					url: "https://docs.example.com/nodes/structured-output",
				},
			],
		},
	},
};

export class StructuredOutput implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: "Structured Output",
				color: "flat-blue",
			},
			maxInputs: 1,
			maxOutputs: 1,

			properties: [
				{
					displayName: "Model",
					name: "model",
					type: "select",
					default: "gpt-4o-mini",
					noDataExpression: true,
					description: "The AI model to use for generation",
					options: [
						{
							name: "GPT-4o Mini",
							value: "gpt-4o-mini",
							description: "Fast and cost-effective",
						},
						{
							name: "GPT-4o",
							value: "gpt-4o",
							description: "Most capable",
						},
						{
							name: "GPT-4 Turbo",
							value: "gpt-4-turbo",
							description: "Previous generation flagship",
						},
					],
				},
				{
					displayName: "System Prompt",
					name: "systemPrompt",
					type: "string",
					default: "You are a helpful AI assistant that generates structured data.",
					description: "System prompt that guides the AI behavior",
				},
				{
					displayName: "User Prompt",
					name: "userPrompt",
					type: "string",
					default: "",
					description: "The prompt or instruction for what data to generate",
				},
				{
					displayName: "Schema",
					name: "schema",
					type: "json",
					default: {
						name: "example_schema",
						description: "An example schema",
						properties: {
							name: {
								type: "string",
								description: "The name field",
							},
							age: {
								type: "number",
								description: "The age field",
							},
						},
					},
					description:
						"JSON Schema definition for the structured output (use the schema builder in the UI)",
				},
				{
					displayName: "Strict Mode",
					name: "strictMode",
					type: "boolean",
					default: true,
					description:
						"Enable strict schema validation (recommended for production)",
				},
			],
		};
	}

	async execute(
		context: IExecutionContext,
	): Promise<INodeExecutionData[][]> {
		const model = context.getNodeParameter?.("model") as string;
		const userPrompt = context.getNodeParameter?.("userPrompt") as string;
		const schema = context.getNodeParameter?.("schema") as Record<string, unknown>;

		// Get input data if available
		const inputData = context.getInputData?.() || [];
		const inputJson = inputData[0]?.json || {};

		try {
			// TODO: Implement LLM call with structured output
			// For now, return a mock response
			const result = {
				generated: true,
				model,
				schema: schema.name || "unnamed",
				data: {
					// This will be replaced with actual LLM-generated data
					message: "Structured output generation not yet implemented",
					userPrompt,
					inputData: inputJson,
				},
			};

			return [[{ json: result }]];
		} catch (error) {
			throw new Error(
				`Structured output generation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}

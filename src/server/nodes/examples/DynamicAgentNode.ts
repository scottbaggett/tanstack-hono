/**
 * Example: Dynamic Agent Node (LLM with {{variable}} Support)
 *
 * Demonstrates the powerful {{variable}} feature:
 * - Node configuration uses {{variable}} placeholders
 * - Automatically exposes dynamic input handles
 * - Connects to upstream node outputs seamlessly
 *
 * Example workflow:
 * TextInput("Alice") → DynamicAgentNode with prompt "Hello {{name}}"
 * The {{name}} automatically becomes a connectible input
 * Output: "Hello Alice"
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
} from "../../../types/execution";
import { extractVariables } from "../../execution/InputResolver";
import type { INodeTypeDescription, IVersionedNodeType } from "../Node";
import { Node, nodeLoader } from "../Node";

class DynamicAgentNode extends Node {
	description: INodeTypeDescription = {
		displayName: "Dynamic Agent",
		name: "dynamicAgent",
		version: 1,
		category: "ai",
		description:
			"LLM agent that supports {{variable}} placeholders for dynamic inputs. Use {{variableName}} in the prompt to automatically expose connectible inputs.",
		icon: "brain",
		// Note: Inputs are DYNAMIC - they're inferred from the prompt template
		inputs: [
			{
				displayName: "Prompt (with {{variables}})",
				name: "prompt",
				type: "string" as any,
				required: true,
				description: "Prompt template with {{variable}} placeholders",
			},
		],
		outputs: [
			{
				displayName: "Response",
				name: "response",
				type: "string" as any,
				description: "LLM response",
			},
			{
				displayName: "Metadata",
				name: "metadata",
				type: "json",
				description: "Execution metadata (variables resolved, etc)",
			},
		],
		properties: [
			{
				displayName: "Model",
				name: "model",
				type: "options",
				required: true,
				default: "gpt-4",
				description: "Which LLM to use",
				options: [
					{ name: "GPT-4", value: "gpt-4" },
					{ name: "Claude 3.5", value: "claude-3.5" },
					{ name: "Llama 2", value: "llama-2" },
				],
			},
			{
				displayName: "Temperature",
				name: "temperature",
				type: "number",
				default: 0.7,
				description: "Randomness (0-2)",
			},
		],
	};

	async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		context.logInfo("Starting Dynamic Agent Node");

		// Get parameters
		const promptTemplate = context.getNodeParameter("prompt") as string;
		const model = context.getNodeParameter("model") as string;
		const temperature = context.getNodeParameter("temperature") as number;

		context.logInfo(`Model: ${model}, Temperature: ${temperature}`);

		// Extract variables from the prompt template
		const variables = extractVariables(promptTemplate);
		context.logInfo(
			`Found {{variables}} in prompt: ${variables.length > 0 ? variables.join(", ") : "none"}`,
		);

		// Get input data
		const inputs = context.getInputData();

		// For each variable, get the connected value
		const resolvedVariables: Record<string, unknown> = {};
		for (const varName of variables) {
			const varValue = inputs[varName];
			if (varValue && Array.isArray(varValue) && varValue.length > 0) {
				resolvedVariables[varName] = varValue[0];
				context.logInfo(
					`Resolved {{${varName}}} = ${String(varValue[0]).substring(0, 50)}`,
				);
			} else {
				context.logWarn(
					`Variable {{${varName}}} not connected - will use placeholder`,
				);
			}
		}

		// Resolve the prompt by replacing {{variables}} with actual values
		let resolvedPrompt = promptTemplate;
		for (const [varName, value] of Object.entries(resolvedVariables)) {
			resolvedPrompt = resolvedPrompt.replace(`{{${varName}}}`, String(value));
		}

		context.logInfo(`Resolved prompt: "${resolvedPrompt}"`);

		// In a real implementation, call the LLM
		// const llm = context.getLangchainModel(model);
		// const response = await llm.invoke({ prompt: resolvedPrompt, temperature });

		// For demo, simulate response
		const mockResponse = `[${model}] Response to: "${resolvedPrompt}"`;

		// Emit streaming event
		context.emitStreamEvent("log", {
			message: "Agent processing",
			variables: Object.keys(resolvedVariables),
		});

		// Set outputs
		context.setOutputData({
			response: [
				{
					dataType: "string",
					value: mockResponse,
				},
			],
			metadata: [
				{
					dataType: "json",
					value: {
						promptTemplate,
						resolvedPrompt,
						variables: Object.keys(resolvedVariables),
						model,
						temperature,
						timestamp: new Date().toISOString(),
					},
				},
			],
		});

		context.logInfo("Dynamic Agent Node completed");

		return [
			[{ response: mockResponse, metadata: { variables: resolvedVariables } }],
		];
	}
}

// Register the node
const versionedDynamicAgent: IVersionedNodeType = {
	description: new DynamicAgentNode().description,
	currentVersion: 1,
	nodeVersions: {
		1: new DynamicAgentNode(),
	},
	getNodeType(version?: number) {
		const v = version ?? this.currentVersion;
		return this.nodeVersions[v];
	},
};

nodeLoader.registerNode(versionedDynamicAgent);

export { DynamicAgentNode };

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
Workflow setup:

1. Node A (TextInput)
   Outputs: { response: ["Alice"] }

2. Node B (TextInput)
   Outputs: { response: [5] }

3. Node C (DynamicAgentNode)
   Properties:
     - prompt: "What is the name? {{name}}. How many items? {{count}}"
     - model: "gpt-4"

   Connections (edges):
     - Node A.response → Node C.name
     - Node B.response → Node C.count

During execution:
   - Prompt template: "What is the name? {{name}}. How many items? {{count}}"
   - Extract variables: ["name", "count"]
   - Get connected values: { name: "Alice", count: 5 }
   - Resolve prompt: "What is the name? Alice. How many items? 5"
   - Call LLM with resolved prompt
   - Output response

The key power: The prompt template is STATIC in the node config,
but the actual inputs are DYNAMIC and auto-expose as connectible handles!
*/

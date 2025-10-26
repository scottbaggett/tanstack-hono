/**
 * Example: LLM Node
 *
 * Demonstrates LangChain integration:
 * - Using getLangchainModel() to get a configured LLM
 * - Streaming tokens via emitStreamEvent()
 * - Handling LangChain callbacks
 * - Error handling
 */

import type { IExecuteFunctions, INodeExecutionData, StreamEvent } from "../../../types/execution";
import type { INodeTypeDescription, IVersionedNodeType } from "../Node";
import { Node, nodeLoader } from "../Node";

class LLMNode extends Node {
	description: INodeTypeDescription = {
		displayName: "LLM",
		name: "llm",
		version: 1,
		category: "ai",
		description: "Call a Language Model (LLM) with a prompt",
		icon: "brain",
		inputs: [
			{
				displayName: "Prompt",
				name: "prompt",
				type: "string",
				required: true,
				description: "The prompt to send to the LLM",
			},
		],
		outputs: [
			{
				displayName: "Response",
				name: "response",
				type: "string",
				description: "The LLM response",
			},
			{
				displayName: "Tokens Used",
				name: "tokensUsed",
				type: "number",
				description: "Approximate tokens used by the LLM",
			},
		],
		properties: [
			{
				displayName: "Model",
				name: "model",
				type: "options",
				default: "gpt-4",
				description: "Which LLM model to use",
				options: [
					{ name: "GPT-4", value: "gpt-4" },
					{ name: "GPT-4 Turbo", value: "gpt-4-turbo" },
					{ name: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
				],
			},
			{
				displayName: "Temperature",
				name: "temperature",
				type: "number",
				default: 0.7,
				description: "Controls randomness (0-2). Lower = more deterministic.",
				placeholder: "0.7",
			},
			{
				displayName: "Max Tokens",
				name: "maxTokens",
				type: "number",
				default: 1000,
				description: "Maximum tokens to generate",
				placeholder: "1000",
			},
		],
	};

	async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		context.logInfo("Starting LLM node");

		// Get node parameters
		const model = context.getNodeParameter("model") as string;
		const temperature = context.getNodeParameter("temperature") as number;
		const maxTokens = context.getNodeParameter("maxTokens") as number;

		context.logInfo(`Using model: ${model}, temperature: ${temperature}, maxTokens: ${maxTokens}`);

		// Get input
		const inputs = context.getInputData();
		const promptArray = inputs.prompt || [];

		if (promptArray.length === 0) {
			context.logError("No prompt provided");
			throw new Error("Prompt is required");
		}

		const results: INodeExecutionData[] = [];

		// Process each prompt
		for (const item of promptArray) {
			const prompt = String(item);
			context.logInfo(`Processing prompt: ${prompt.substring(0, 100)}...`);

			try {
				// Get the LangChain model from context
				const llm = context.getLangchainModel(model);

				context.logInfo("Invoking LLM");

				// Track tokens for demo purposes
				let tokensUsed = 0;
				let fullResponse = "";

				// Invoke the model
				// In a real implementation, you might use streaming:
				// const stream = await llm.stream({ prompt });
				// for await (const chunk of stream) {
				//   fullResponse += chunk;
				//   context.emitStreamEvent("token", { token: chunk });
				// }

				// For now, simple synchronous call
				const response = await llm.invoke({
					prompt,
					temperature,
					maxTokens,
				} as any);

				fullResponse = String(response);
				tokensUsed = Math.ceil(fullResponse.length / 4); // Rough estimate

				context.logInfo(`LLM response: ${fullResponse.substring(0, 100)}...`);

				// Emit streaming event to show the token as it arrived
				context.emitStreamEvent("token", {
					content: fullResponse,
					model,
				});

				results.push({
					response: fullResponse,
					tokensUsed,
					model,
					prompt,
				});
			} catch (error) {
				context.logError(`LLM call failed: ${String(error)}`);
				throw error;
			}
		}

		// Set output data
		context.setOutputData({
			response: results.map((r) => r.response),
			tokensUsed: results.map((r) => r.tokensUsed),
		});

		context.logInfo("LLM node completed");

		return [results];
	}
}

// Register the node
const versionedLLM: IVersionedNodeType = {
	description: new LLMNode().description,
	currentVersion: 1,
	nodeVersions: {
		1: new LLMNode(),
	},
	getNodeType(version?: number) {
		const v = version ?? this.currentVersion;
		return this.nodeVersions[v];
	},
};

nodeLoader.registerNode(versionedLLM);

export { LLMNode };

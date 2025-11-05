/**
 * Agent Node Execution (LangGraph-Based)
 *
 * P0 Implementation: Single-turn agent with LangGraph
 * Supports basic tool calling and deterministic IDs
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: initialState is a AgentGraphState */

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Tool } from "@langchain/core/tools";
import {
	type AgentGraphState,
	buildInitialState,
	buildResumedState,
	createAgentGraph,
} from "@/server/agents/graph";
import { createEventEmitter } from "@/server/observability/events";
import type {
	AgentOptions,
	EngineRequest,
	EngineResponse,
	RequestResponseMetadata,
} from "@/server/types/agent";
import { generateToolCallId } from "@/server/utils/ids";
import {
	getChatModel,
	getTools /* , getOptionalMemory */,
} from "@/server/utils/langchain";
import type { IExecutionContext, INodeExecutionData } from "@/types/interfaces";

/**
 * Main agent execution function
 * Returns either final results or an EngineRequest for tool execution
 */
export async function executeAgent(
	context: IExecutionContext,
	response?: EngineResponse<RequestResponseMetadata>,
): Promise<INodeExecutionData[][] | EngineRequest<RequestResponseMetadata>> {
	const { nodeId, inputs, evaluatedProperties, signal } = context;

	// Extract options from evaluated properties
	const systemPrompt =
		(evaluatedProperties.systemPrompt as string) ||
		"You are a helpful AI assistant.";
	const promptType = evaluatedProperties.promptType || "define";
	const userPrompt =
		promptType === "define"
			? (evaluatedProperties.userPrompt as string)
			: (inputs.text as string);
	const maxIterations = (evaluatedProperties.maxIterations as number) || 5;
	const temperature = (evaluatedProperties.temperature as number) || 0.7;
	const enableStreaming = evaluatedProperties.enableStreaming === false; // P0: No streaming yet

	// Get connected inputs (unused for now, kept for reference)
	// const languageModel = inputs.languageModel;
	// const tools = inputs.tools || [];
	// const connectedMemory = inputs.memory;

	// Check for cancellation
	if (signal?.aborted) {
		throw new Error("Agent execution cancelled");
	}

	// Get model from properties or connection
	let model: BaseChatModel | undefined;

	// Get model from evaluatedProperties
	const modelFromProperty = evaluatedProperties.model as string | undefined;

	if (modelFromProperty) {
		// Use model from node properties (simplified approach)
		const { ChatOpenAI } = await import("@langchain/openai");
		const { ChatAnthropic } = await import("@langchain/anthropic");
		const { getModel } = await import("@/server/models/registry");

		const modelConfig = getModel(modelFromProperty);
		if (!modelConfig) {
			throw new Error(`Unknown model: ${modelFromProperty}`);
		}

		// Create the appropriate model instance based on provider
		if (modelConfig.provider === "openai") {
			const modelOptions: {
				modelName: string;
				temperature?: number;
			} = {
				modelName: modelFromProperty,
			};

			// Only add temperature if the model supports it
			if (modelConfig.supports_temp) {
				modelOptions.temperature = temperature || 0.7;
			}

			model = new ChatOpenAI(modelOptions);
		} else if (modelConfig.provider === "anthropic") {
			const modelOptions: {
				modelName: string;
				temperature?: number;
			} = {
				modelName: modelFromProperty,
			};

			// Only add temperature if the model supports it
			if (modelConfig.supports_temp) {
				modelOptions.temperature = temperature || 0.7;
			}

			model = new ChatAnthropic(modelOptions);
		} else {
			throw new Error(`Unsupported provider: ${modelConfig.provider}`);
		}
	} else {
		// Fall back to connection-based model
		model = await getChatModel(context);
	}

	const langchainTools = await getTools(context);
	// const memory = await getOptionalMemory(context); // TODO: Implement memory support

	// Build agent options
	const options: AgentOptions = {
		systemPrompt,
		maxIterations,
		temperature,
		enableStreaming,
	};

	try {
		// Create event emitter
		const emitter = createEventEmitter();

		// Get execution ID and iteration count
		const executionId = `exec_${Date.now().toString(36)}_${crypto.randomUUID().split("-")[0]}`;
		const iterationCount = response?.metadata?.iterationCount ?? 0;

		// Build LangGraph with real components
		const graph = createAgentGraph({
			model,
			tools: langchainTools as unknown as Tool[], // LangChain tools
			...options,
		});

		const app = graph.compile();

		// Initial or resumed execution
		let initialState: AgentGraphState;
		if (response) {
			// Resuming after tool execution
			const previousState = buildInitialState(userPrompt, systemPrompt);
			initialState = buildResumedState(previousState, response.results);
		} else {
			// First execution
			initialState = buildInitialState(userPrompt, systemPrompt);
		}

		// Run graph (single-turn for P0)
		const graphResult = await app.invoke(initialState as any);
		const finalState = graphResult as unknown as AgentGraphState;

		// Check for tool calls
		if (finalState.toolCalls && finalState.toolCalls.length > 0) {
			// Create EngineRequest for tool execution
			const actions = await Promise.all(
				finalState.toolCalls.map(async (toolCall: any, index: number) => {
					const toolCallId = await generateToolCallId(
						executionId,
						nodeId,
						iterationCount + 1,
						index,
					);

					return {
						id: toolCallId,
						type: "ai_tool" as const,
						nodeName: `tool_${toolCall.tool}`, // TODO: Map to actual node name
						tool: toolCall.tool,
						input: toolCall.toolInput,
						metadata: {
							itemIndex: 0,
							iteration: iterationCount + 1,
							attempt: 0,
							source: "agent" as const,
							stepHash: "", // TODO: Generate step hash
						},
					};
				}),
			);

			const request: EngineRequest<RequestResponseMetadata> = {
				actions,
				metadata: {
					itemIndex: 0,
					iterationCount: iterationCount + 1,
					executionId,
					nodeId,
				},
			};

			emitter.emit({
				t: "engine.request",
				requestId: `req_${Date.now().toString(36)}`,
				actions: actions.map((a) => ({
					id: a.id,
					tool: a.tool,
					nodeName: a.nodeName,
				})),
			});

			return request;
		}

		// Return final output
		emitter.emit({
			t: "agent.finish",
			iteration: iterationCount + 1,
			output: finalState.finalOutput || "No output",
			finalState: "success",
		});

		// Clean output structure: just the result for downstream nodes
		const result: INodeExecutionData = {
			json: {
				output: finalState.finalOutput || "No output",
			},
		};

		return [[result]];
	} catch (error) {
		// Error handling
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		const result: INodeExecutionData = {
			json: {
				status: "error",
				error: errorMessage,
				systemPrompt,
				userPrompt,
			},
		};

		return [[result]];
	}
}

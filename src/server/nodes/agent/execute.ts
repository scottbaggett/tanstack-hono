/**
 * Agent Node Execution (LangGraph-Based)
 *
 * P0 Implementation: Single-turn agent with LangGraph
 * Supports basic tool calling and deterministic IDs
 */

import type { IExecutionContext, INodeExecutionData } from "@/types/interfaces";
import type {
	EngineRequest,
	EngineResponse,
	RequestResponseMetadata,
	AgentOptions,
} from "@/server/types/agent";
import {
	createAgentGraph,
	buildInitialState,
	buildResumedState,
	type AgentGraphState,
} from "@/server/agents/graph";
import { generateToolCallId } from "@/server/utils/ids";
import { createEventEmitter } from "@/server/observability/events";
import {
	getChatModel,
	getTools /* , getOptionalMemory */,
} from "@/server/utils/langchain";

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

	// Get real LangChain components from connections
	const model = await getChatModel(context);
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
			tools: langchainTools as any[], // LangChain tools
			...options,
		});

		const app = graph.compile();

		// Initial or resumed execution
		let initialState;
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

		const result: INodeExecutionData = {
			json: {
				status: "success",
				output: finalState.finalOutput || "No output",
				iterations: iterationCount + 1,
				systemPrompt,
				userPrompt,
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

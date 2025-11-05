/**
 * LangGraph Agent Setup
 *
 * Core LangGraph state machine for agent execution
 * Handles iteration, tool calling, and halting rules
 */

import { StateGraph, END } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Tool } from '@langchain/core/tools';
import type {
	AgentGraphState,
	ToolCallRequest,
	EngineActionResult,
	AgentOptions,
	ToolName,
} from '@/server/types/agent';
import { generateStepHashSync } from '@/server/utils/ids';

// Re-export for convenience
export type { AgentGraphState };

// ============================================================================
// State Channels
// ============================================================================

/**
 * Define how state updates are merged
 */
const stateChannels = {
	messages: {
		// Append new messages to existing
		value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
		default: () => [],
	},
	toolCalls: {
		// Replace tool calls
		value: (_: ToolCallRequest[], y: ToolCallRequest[]) => y || [],
		default: () => [],
	},
	toolResults: {
		// Merge tool results by ID
		value: (x: Map<string, EngineActionResult>, y: Map<string, EngineActionResult>) =>
			new Map([...Array.from(x), ...Array.from(y)]),
		default: () => new Map<string, EngineActionResult>(),
	},
	iteration: {
		// Increment iteration
		value: (_: number, y: number) => y ?? 0,
		default: () => 0,
	},
	finalOutput: {
		// Set final output
		value: (_: string | undefined, y: string | undefined) => y,
		default: () => undefined,
	},
	error: {
		// Set error
		value: (_: any, y: any) => y,
		default: () => undefined,
	},
};

// ============================================================================
// Graph Nodes
// ============================================================================

/**
 * Plan Node: Call LLM and extract tool calls
 */
async function planNode(
	state: AgentGraphState,
	model: BaseChatModel,
	tools: Tool[],
): Promise<Partial<AgentGraphState>> {
	// Increment iteration
	const iteration = state.iteration + 1;

	// Call model with current messages
	const response = await model.invoke(state.messages);

	// Extract tool calls from response
	const toolCalls: ToolCallRequest[] = [];

	if (response.additional_kwargs?.tool_calls) {
		for (const tc of response.additional_kwargs.tool_calls) {
			toolCalls.push({
				tool: tc.function?.name as ToolName,
				toolInput: JSON.parse(tc.function?.arguments || '{}'),
				toolCallId: tc.id || `call_${Date.now()}`,
				type: tc.type,
			});
		}
	}

	// If no tool calls, extract text response as final output
	const finalOutput = toolCalls.length === 0 ? response.content.toString() : undefined;

	return {
		messages: [response],
		toolCalls,
		iteration,
		finalOutput,
	};
}

/**
 * Tools Node: Placeholder for tool execution
 * In production, this returns an EngineRequest and execution is handled by engine
 */
async function toolsNode(state: AgentGraphState): Promise<Partial<AgentGraphState>> {
	console.log(`[TOOLS] Executing ${state.toolCalls.length} tool calls`);

	// NOTE: In production, this node would:
	// 1. Create EngineRequest with tool calls
	// 2. Return request to execution engine
	// 3. Engine executes tools and returns EngineResponse
	// 4. Agent resumes with tool results

	// For P0, we'll simulate tool results
	const toolResults = new Map<string, EngineActionResult>();

	for (const toolCall of state.toolCalls) {
		// Simulate tool execution
		toolResults.set(toolCall.toolCallId, {
			id: toolCall.toolCallId,
			output: { result: 'Simulated tool result', success: true },
			durationMs: 100,
			outputSize: 50,
		});
	}

	// Add tool results as messages
	const resultMessages = Array.from(toolResults.entries()).map(([id, result]) => {
		return new AIMessage({
			content: JSON.stringify(result.output),
			additional_kwargs: { tool_call_id: id },
		});
	});

	return {
		messages: resultMessages,
		toolResults,
		toolCalls: [], // Clear tool calls after execution
	};
}

// ============================================================================
// Routing Functions
// ============================================================================

/**
 * Decide whether to continue iteration or end
 */
function shouldContinue(
	state: AgentGraphState,
	options: AgentOptions,
): 'tools' | 'end' {
	const maxIterations = options.maxIterations ?? 5;

	// Check if we have a final output
	if (state.finalOutput) {
		console.log('[ROUTE] Final output received, ending');
		return 'end';
	}

	// Check if we have tool calls
	if (state.toolCalls.length === 0) {
		console.log('[ROUTE] No tool calls, ending');
		return 'end';
	}

	// Check max iterations
	if (state.iteration >= maxIterations) {
		console.log('[ROUTE] Max iterations reached, ending');
		return 'end';
	}

	// Check for no progress (duplicate tool calls)
	if (detectNoProgress(state)) {
		console.log('[ROUTE] No progress detected, ending');
		return 'end';
	}

	console.log('[ROUTE] Continuing to tools');
	return 'tools';
}

/**
 * Decide whether to continue planning or end after tools
 */
function shouldContinueAfterTools(
	state: AgentGraphState,
	options: AgentOptions,
): 'plan' | 'end' {
	const maxIterations = options.maxIterations ?? 5;

	// Check max iterations
	if (state.iteration >= maxIterations) {
		console.log('[ROUTE] Max iterations reached after tools, ending');
		return 'end';
	}

	// Check for errors in tool results
	const hasErrors = Array.from(state.toolResults.values()).some((r) => {
		const result = r as EngineActionResult;
		return 'error' in result && result.error !== undefined;
	});
	if (hasErrors) {
		console.log('[ROUTE] Tool errors detected, continuing to plan for handling');
	}

	console.log('[ROUTE] Tools complete, continuing to plan');
	return 'plan';
}

// ============================================================================
// Halting Rules
// ============================================================================

/**
 * Detect if agent is making no progress (duplicate tool calls)
 */
function detectNoProgress(state: AgentGraphState): boolean {
	// Look at recent AI messages with tool calls
	const recentToolCalls = state.messages
		.filter((m) => m._getType() === 'ai' && m.additional_kwargs?.tool_calls)
		.slice(-3);

	if (recentToolCalls.length < 2) return false;

	// Hash tool calls (name + args)
	const hashes = recentToolCalls.map((msg) => {
		const toolCalls = msg.additional_kwargs?.tool_calls || [];
		return toolCalls
			.map((tc: any) => generateStepHashSync(tc.function?.name || '', tc.function?.arguments || '{}'))
			.join(',');
	});

	// Check for duplicates
	const uniqueHashes = new Set(hashes);
	const hasDuplicate = uniqueHashes.size < hashes.length;

	if (hasDuplicate) {
		console.warn('[HALTING] Duplicate tool calls detected - no progress');
	}

	return hasDuplicate;
}

// ============================================================================
// Graph Builder
// ============================================================================

export interface CreateAgentGraphOptions extends AgentOptions {
	model: BaseChatModel;
	tools: Tool[];
	systemMessage?: string;
}

/**
 * Create a LangGraph state machine for agent execution
 */
export function createAgentGraph(config: CreateAgentGraphOptions) {
	const { model, tools, ...options } = config;

	// Create state graph
	const graph = new StateGraph<AgentGraphState>({
		channels: stateChannels,
	});

	// Add nodes
	graph.addNode('plan', async (state) => planNode(state, model, tools));
	graph.addNode('tools', toolsNode);

	// Set entry point
	graph.addEdge('__start__', 'plan');

	// Add conditional edges
	graph.addConditionalEdges('plan', (state) => shouldContinue(state, options));

	graph.addConditionalEdges('tools', (state) => shouldContinueAfterTools(state, options));

	return graph;
}

// ============================================================================
// Initial State Builder
// ============================================================================

/**
 * Build initial state from user input
 */
export function buildInitialState(
	userInput: string,
	systemMessage?: string,
): AgentGraphState {
	const messages: BaseMessage[] = [];

	// Add system message if provided
	if (systemMessage) {
		messages.push(new SystemMessage(systemMessage));
	}

	// Add user input
	messages.push(new HumanMessage(userInput));

	return {
		messages,
		toolCalls: [],
		toolResults: new Map(),
		iteration: 0,
		finalOutput: undefined,
		error: undefined,
	};
}

/**
 * Build resumed state from engine response
 */
export function buildResumedState(
	previousState: AgentGraphState,
	toolResults: EngineActionResult[],
): AgentGraphState {
	// Add tool results to state
	const resultsMap = new Map(previousState.toolResults);
	for (const result of toolResults) {
		resultsMap.set(result.id, result);
	}

	// Add tool results as messages
	const resultMessages = toolResults.map((result) => {
		return new AIMessage({
			content: JSON.stringify(result.output),
			additional_kwargs: { tool_call_id: result.id },
		});
	});

	return {
		...previousState,
		messages: [...previousState.messages, ...resultMessages],
		toolResults: resultsMap,
		toolCalls: [], // Clear tool calls after results
	};
}

// ============================================================================
// Usage Example
// ============================================================================

/**
 * Example: Create and run agent graph
 *
 * import { ChatOpenAI } from '@langchain/openai';
 * import { calculatorTool } from '@/server/tools/calculator';
 *
 * const model = new ChatOpenAI({ modelName: 'gpt-4', temperature: 0 });
 *
 * const graph = createAgentGraph({
 *   model,
 *   tools: [calculatorTool],
 *   systemMessage: 'You are a helpful assistant.',
 *   maxIterations: 5,
 * });
 *
 * const app = graph.compile();
 *
 * const initialState = buildInitialState('What is 2 + 2?');
 * const finalState = await app.invoke(initialState);
 *
 * console.log('Final output:', finalState.finalOutput);
 */

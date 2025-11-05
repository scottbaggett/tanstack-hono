/**
 * LangChain Integration Utilities
 *
 * Helpers to extract and configure LangChain components from execution context
 */

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMemory } from "@langchain/core/memory";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import type { AgentTool } from "@/server/types/agent";
import type { IExecutionContext } from "@/types/interfaces";

// ============================================================================
// Model Configuration
// ============================================================================

export interface ModelConfig {
	provider?: "openai" | "anthropic" | "custom";
	model?: string;
	temperature?: number;
	maxTokens?: number;
	apiKey?: string;
}

/**
 * Extract and configure chat model from execution context
 *
 * @param context - Execution context with languageModel input
 * @param inputKey - Key in context.inputs (default: 'languageModel')
 * @returns Configured BaseChatModel instance
 */
export async function getChatModel(
	context: IExecutionContext,
	inputKey: string = "languageModel",
): Promise<BaseChatModel> {
	const modelInput = context.inputs[inputKey];

	if (!modelInput) {
		throw new Error(`No model connected at input '${inputKey}'`);
	}

	// Extract model configuration
	// For P0, expect a simple config object. In production, this would
	// extract from connected model node's output
	const config: ModelConfig =
		typeof modelInput === "object" && modelInput !== null
			? (modelInput as ModelConfig)
			: {};

	const provider = config.provider || "openai";
	const modelName = config.model || "gpt-4";
	const temperature =
		config.temperature ??
		(context.evaluatedProperties.temperature as number) ??
		0.7;
	const maxTokens = config.maxTokens;

	// Get API key from credentials or config
	const apiKey =
		config.apiKey ||
		context.credentials?.openai?.apiKey ||
		process.env.OPENAI_API_KEY;

	if (!apiKey && provider === "openai") {
		throw new Error(
			"OpenAI API key not found. Set OPENAI_API_KEY environment variable or provide in credentials.",
		);
	}

	// Create model based on provider
	switch (provider) {
		case "openai":
			return new ChatOpenAI({
				modelName,
				temperature,
				maxTokens,
				openAIApiKey: apiKey,
			});

		// TODO: Add other providers
		// case 'anthropic':
		//   return new ChatAnthropic({ ... });

		default:
			throw new Error(`Unsupported model provider: ${provider}`);
	}
}

// ============================================================================
// Tools Integration
// ============================================================================

/**
 * Convert AgentTool to LangChain DynamicStructuredTool
 */
export function convertToLangChainTool(tool: AgentTool): DynamicStructuredTool {
	return new DynamicStructuredTool({
		name: tool.name,
		description: tool.description,
		schema: tool.inputSchema,
		func: async (input) => {
			// Execute tool with mock context for P0
			// TODO: Pass real context with signal, emit, etc.
			const mockContext = {
				executionId: "mock",
				nodeId: "mock",
				signal: new AbortController().signal,
				emit: () => {},
			};

			try {
				const result = await tool.execute(mockContext as any, input);
				return JSON.stringify(result);
			} catch (error) {
				return JSON.stringify({
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		},
	});
}

/**
 * Extract tools from execution context
 *
 * @param context - Execution context with tools input
 * @param inputKey - Key in context.inputs (default: 'tools')
 * @returns Array of LangChain tools
 */
export async function getTools(
	context: IExecutionContext,
	inputKey: string = "tools",
): Promise<DynamicStructuredTool[]> {
	const toolsInput = context.inputs[inputKey];

	if (!toolsInput) {
		return [];
	}

	// Handle different input formats
	let agentTools: AgentTool[];

	if (Array.isArray(toolsInput)) {
		// Direct array of AgentTool objects
		agentTools = toolsInput as AgentTool[];
	} else if (typeof toolsInput === "object") {
		// Single tool object
		agentTools = [toolsInput as AgentTool];
	} else {
		return [];
	}

	// Convert to LangChain tools
	return agentTools.map(convertToLangChainTool);
}

// ============================================================================
// Memory Integration
// ============================================================================

/**
 * Extract memory from execution context
 *
 * @param context - Execution context with memory input
 * @param inputKey - Key in context.inputs (default: 'memory')
 * @returns BaseMemory instance or undefined
 */
export async function getMemory(
	context: IExecutionContext,
	inputKey: string = "memory",
): Promise<BaseMemory | undefined> {
	const memoryInput = context.inputs[inputKey];

	if (!memoryInput) {
		return undefined;
	}

	// For P0, return the memory object directly
	// In production, this would properly initialize based on memory type
	return memoryInput as BaseMemory;
}

/**
 * Get optional memory (returns undefined instead of throwing)
 */
export async function getOptionalMemory(
	context: IExecutionContext,
	inputKey: string = "memory",
): Promise<BaseMemory | undefined> {
	try {
		return await getMemory(context, inputKey);
	} catch {
		return undefined;
	}
}

// ============================================================================
// Output Parser Integration
// ============================================================================

/**
 * Extract output parser from execution context
 *
 * @param context - Execution context with outputParser input
 * @param inputKey - Key in context.inputs (default: 'outputParser')
 * @returns Output parser instance or undefined
 */
export async function getOutputParser(
	context: IExecutionContext,
	inputKey: string = "outputParser",
): Promise<any | undefined> {
	const parserInput = context.inputs[inputKey];

	if (!parserInput) {
		return undefined;
	}

	// For P0, return parser directly
	return parserInput;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all connected tools including registered tools
 */
export async function getAllTools(
	context: IExecutionContext,
): Promise<DynamicStructuredTool[]> {
	const connectedTools = await getTools(context);

	// TODO: Merge with globally registered tools from registry
	// const registeredTools = listTools();
	// return [...connectedTools, ...registeredTools.map(convertToLangChainTool)];

	return connectedTools;
}

/**
 * Validate model configuration
 */
export function validateModelConfig(config: ModelConfig): void {
	if (config.temperature !== undefined) {
		if (config.temperature < 0 || config.temperature > 2) {
			throw new Error("Temperature must be between 0 and 2");
		}
	}

	if (config.maxTokens !== undefined) {
		if (config.maxTokens < 1) {
			throw new Error("Max tokens must be positive");
		}
	}
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example: Get model and tools for agent execution
 *
 * const model = await getChatModel(context);
 * const tools = await getTools(context);
 * const memory = await getOptionalMemory(context);
 *
 * const graph = createAgentGraph({
 *   model,
 *   tools: tools.map(t => ({ ...t, metadata: { sourceNodeName: 'tool_node' } })),
 *   systemMessage: 'You are a helpful assistant',
 *   maxIterations: 5,
 * });
 */

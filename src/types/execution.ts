/**
 * Execution Context and Function Interfaces
 *
 * Defines the context objects passed to nodes during execution.
 * Nodes receive these contexts to access configuration, LangChain instances,
 * workflow state, and emit streaming events.
 */

import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Tool } from "@langchain/core/tools";
import type { TypedValue, SerializedValue } from "./datatypes";

// ============================================================================
// NODE EXECUTION DATA
// ============================================================================

/**
 * Data flowing between nodes
 *
 * Can be:
 * - TypedValue: Value with explicit type information (used during execution)
 * - unknown: Inferred type (converted to TypedValue automatically)
 *
 * Supports: strings, numbers, floats, JSON, CSV, PDB, buffers, images, etc
 */
export type INodeExecutionData = TypedValue | unknown;

/**
 * Structured output from a node
 * Maps output handle names to arrays of execution data
 */
export type INodeOutputData = {
	[handleName: string]: INodeExecutionData[];
};

/**
 * Serialized node output for storage (database, transmission)
 * All data is serialized according to its type's serialization format
 */
export type INodeOutputDataSerialized = {
	[handleName: string]: SerializedValue[];
};

// ============================================================================
// STREAMING & EVENTS
// ============================================================================

/**
 * Types of events a node can emit during execution
 */
export type StreamEventType =
	| "token" // LLM token from streaming
	| "log" // Logging message
	| "tool_call" // Tool invocation
	| "tool_result" // Tool result
	| "agent_action" // Agent taking an action
	| "agent_finish" // Agent finishing
	| "chain_start" // Chain execution start
	| "chain_end" // Chain execution end
	| "custom"; // Custom event type

/**
 * An event emitted during node execution (from streaming, callbacks, etc)
 */
export interface StreamEvent {
	type: StreamEventType;
	timestamp: number; // Unix ms
	data: Record<string, unknown>;
	// For debugging/correlation
	nodeId?: string;
	runId?: string;
}

// ============================================================================
// EXECUTION CONTEXT - LAYERED ARCHITECTURE
// ============================================================================

/**
 * LAYER 1: CORE ORCHESTRATOR CAPABILITIES
 *
 * These methods are fundamental to the workflow platform itself.
 * Every node has access to these, independent of any AI framework.
 * Stable API - unlikely to change.
 */
export interface IExecuteFunctionsCore {
	// === Node Configuration ===

	/**
	 * Get a node parameter value by name
	 * Parameters are configured when the node is placed in the workflow
	 *
	 * @param name - Parameter name
	 * @param defaultValue - Default if not set
	 * @returns The parameter value
	 */
	getNodeParameter(name: string, defaultValue?: unknown): unknown;

	/**
	 * Get all node parameters as a dictionary
	 */
	getNodeParameters(): Record<string, unknown>;

	// === Credentials ===

	/**
	 * Get credentials for a specific type
	 * Credentials are configured per-node and stored encrypted
	 *
	 * @param type - Credential type (e.g., "httpBasicAuth", "apiKey")
	 * @returns The decrypted credential data
	 */
	getCredentials(type: string): Promise<Record<string, any>>;

	// === Input Data ===

	/**
	 * Get input data from previous nodes
	 * Input data is keyed by the input handle name
	 *
	 * @returns Input data mapped by handle name
	 */
	getInputData(): Record<string, INodeExecutionData[]>;

	/**
	 * Get input data from a specific input handle
	 *
	 * @param handleName - Name of the input handle
	 * @returns Array of execution data from that input
	 */
	getInputByHandle(handleName: string): INodeExecutionData[] | undefined;

	/**
	 * Helper: Get the first item from a specific input handle
	 */
	getInputValue(handleName: string): INodeExecutionData | undefined;

	// === Output ===

	/**
	 * Set the final output for this node
	 * Output is keyed by handle name
	 *
	 * @param outputData - Output data mapped by handle name
	 */
	setOutputData(outputData: INodeOutputData): void;

	/**
	 * Convenience: Set output for a single handle
	 *
	 * @param handleName - Name of the output handle
	 * @param data - The output data
	 */
	setOutput(handleName: string, data: INodeExecutionData[]): void;

	// === Secrets ===

	/**
	 * Securely retrieve a secret configured in the platform
	 * Secrets are encrypted and should not be logged
	 *
	 * @param secretName - Name of the secret
	 * @returns The secret value, or undefined if not found
	 */
	getSecret(secretName: string): Promise<string | undefined>;

	// === Logging ===

	/**
	 * Log a message
	 *
	 * @param level - Log level (info, warn, error)
	 * @param message - Log message
	 * @param data - Optional structured data
	 */
	log(level: "info" | "warn" | "error", message: string, data?: unknown): void;

	/**
	 * Convenience: Log at info level
	 */
	logInfo(message: string, data?: unknown): void;

	/**
	 * Convenience: Log at warn level
	 */
	logWarn(message: string, data?: unknown): void;

	/**
	 * Convenience: Log at error level
	 */
	logError(message: string, data?: unknown): void;

	// === Streaming & Events ===

	/**
	 * Emit a streaming event
	 * Used to send real-time updates to the frontend
	 *
	 * @param eventType - Type of event
	 * @param data - Event data
	 */
	emitStreamEvent(eventType: StreamEventType, data: Record<string, unknown>): void;

	/**
	 * Emit a complete stream event object
	 *
	 * @param event - The stream event
	 */
	emitEvent(event: StreamEvent): void;

	// === Run Metadata ===

	/**
	 * Get the ID of the current workflow run
	 */
	getRunId(): string;

	/**
	 * Get the ID of the current node
	 */
	getNodeId(): string;

	/**
	 * Get the type of the current node
	 */
	getNodeType(): string;

	/**
	 * Get the node's version
	 */
	getNodeVersion(): number;
}

/**
 * LAYER 2: PLATFORM-PROVIDED EXECUTION PRIMITIVES
 *
 * These are higher-level capabilities provided by the platform itself,
 * not by any external framework.
 *
 * These enable nodes to perform common tasks (API calls, code execution)
 * without needing LangChain or other frameworks.
 */
export interface IExecuteFunctionsPrimitives extends IExecuteFunctionsCore {
	// === HTTP/Network ===

	/**
	 * Make a secure HTTP request
	 *
	 * @param options - Request configuration
	 * @returns Response data
	 */
	httpRequest(options: {
		url: string;
		method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
		headers?: Record<string, string>;
		body?: unknown;
		timeout?: number;
	}): Promise<{
		status: number;
		headers: Record<string, string>;
		data: unknown;
		text: string;
	}>;

	/**
	 * Execute sandboxed code (Python, JavaScript, etc.)
	 *
	 * @param options - Execution configuration
	 * @returns Execution result
	 */
	executeSandboxedCode(options: {
		language: "python" | "javascript" | "bash";
		code: string;
		timeout?: number;
		environment?: Record<string, string>;
		requirements?: string[]; // e.g., ["pandas", "numpy"] for Python
		input?: Record<string, unknown>;
	}): Promise<{
		success: boolean;
		output: unknown;
		stderr?: string;
		duration: number;
	}>;

	/**
	 * Read from a file system (within allowed paths)
	 *
	 * @param path - File path (relative to workspace)
	 * @returns File contents
	 */
	readFile(path: string): Promise<string | Buffer>;

	/**
	 * Write to a file system (within allowed paths)
	 *
	 * @param path - File path
	 * @param data - Data to write
	 */
	writeFile(path: string, data: string | Buffer): Promise<void>;
}

/**
 * LAYER 3: AI FRAMEWORK INTEGRATION - LANGCHAIN
 *
 * These methods provide access to LangChain capabilities.
 * Nodes that use LangChain should access these.
 *
 * This layer can be extended or replaced with other frameworks
 * without breaking existing nodes that only use core/primitives layers.
 */
export interface IExecuteFunctionsLangChain extends IExecuteFunctionsPrimitives {
	// === LangChain Models ===

	/**
	 * Get a pre-configured LangChain Language Model
	 *
	 * @param modelName - Name of the configured model (e.g., "gpt-4", "claude-3")
	 *                    If not specified, returns the default/primary model
	 * @returns The LangChain BaseLanguageModel instance
	 */
	getLangchainModel(modelName?: string): BaseLanguageModel;

	/**
	 * Get a pre-configured LangChain Embeddings instance
	 *
	 * @param embeddingsName - Name of the configured embeddings provider
	 * @returns The LangChain Embeddings instance
	 */
	getLangchainEmbeddings(embeddingsName?: string): Embeddings;

	/**
	 * Get LangChain tools available to this node
	 * Tools are configured at the platform level and selected per-node
	 *
	 * @returns Array of LangChain Tool instances
	 */
	getLangchainTools(): Tool[];

	/**
	 * Get a specific tool by name
	 *
	 * @param toolName - Name of the tool
	 * @returns The Tool instance, or undefined if not found
	 */
	getLangchainTool(toolName: string): Tool | undefined;

	// === LangChain Helpers ===

	/**
	 * Helper: Create a memory instance for conversations
	 * (Future: when memory management is needed)
	 */
	// getConversationMemory(): BaseMemory;
}

/**
 * FULL EXECUTION CONTEXT
 *
 * This is what nodes receive during execution.
 * It includes all three layers: core, primitives, and LangChain.
 *
 * Nodes can use as much or as little as they need:
 * - Simple data transformer → only needs Core
 * - API caller → needs Core + Primitives
 * - LLM agent → needs Core + Primitives + LangChain
 */
export interface IExecuteFunctions extends IExecuteFunctionsLangChain {
	// === Extensibility ===

	/**
	 * Allow for future extensions without breaking existing nodes
	 */
	[key: string]: unknown;
}

// ============================================================================
// WEBHOOK CONTEXT
// ============================================================================

/**
 * Context passed to node webhook() method
 * Used for handling incoming webhooks (e.g., Slack events, webhooks)
 */
export interface IWebhookFunctions extends Omit<IExecuteFunctions, "setOutputData" | "setOutput"> {
	/**
	 * Get the incoming webhook request
	 */
	getWebhookRequest(): {
		method: string;
		path: string;
		query: Record<string, string>;
		headers: Record<string, string>;
		body: unknown;
		rawBody?: Buffer;
	};

	/**
	 * Set the webhook response
	 *
	 * @param statusCode - HTTP status code
	 * @param data - Response data
	 * @param headers - Optional response headers
	 */
	setWebhookResponse(
		statusCode: number,
		data: unknown,
		headers?: Record<string, string>
	): void;

	/**
	 * Set final output data (like IExecuteFunctions)
	 * This creates a new workflow run with the webhook payload
	 */
	triggerWorkflowRun(outputData: INodeOutputData): void;
}

/**
 * Webhook response data
 */
export interface IWebhookResponseData {
	statusCode: number;
	body: unknown;
	headers?: Record<string, string>;
	// Whether this should trigger a full workflow run
	triggerRun?: boolean;
}

// ============================================================================
// POLLING CONTEXT
// ============================================================================

/**
 * Context passed to node poll() method
 * Used for polling-based nodes (e.g., check for new messages, tweets, etc)
 */
export interface IPollFunctions extends IExecuteFunctions {
	/**
	 * Get the timestamp of the last successful poll
	 * Use this to fetch only new items since last poll
	 */
	getLastPollTime(): number | null;

	/**
	 * Set the timestamp for the next poll
	 * Called automatically after successful execution, but can be overridden
	 *
	 * @param timestamp - Unix timestamp in ms
	 */
	setPollTime(timestamp: number): void;

	/**
	 * Get the polling interval in ms
	 */
	getPollInterval(): number;

	/**
	 * Store state that persists between polls
	 * Useful for cursors, pagination tokens, etc.
	 *
	 * @param key - State key
	 * @param value - State value
	 */
	setPollState(key: string, value: unknown): void;

	/**
	 * Get state from previous poll
	 */
	getPollState(key: string): unknown;

	/**
	 * Clear all poll state
	 */
	clearPollState(): void;
}

// ============================================================================
// NODE EXECUTION RESULT
// ============================================================================

/**
 * Result returned by node execution
 */
export interface INodeExecutionResult {
	data?: INodeOutputData;
	error?: Error;
	status: "success" | "error";
}

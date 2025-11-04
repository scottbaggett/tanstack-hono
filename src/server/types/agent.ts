/**
 * Agent Type System
 *
 * Core types for LangGraph-based agent execution with request-response pattern
 */

import type { ZodSchema } from 'zod';
import type { BaseMessage } from '@langchain/core/messages';

// ============================================================================
// Action Types
// ============================================================================

export type ActionType = 'ai_tool' | 'structured_output' | 'noop';
export type ToolName = string & { __brand: 'ToolName' };

// ============================================================================
// Engine Request/Response (Resumable Loop)
// ============================================================================

export interface EngineRequest<T = RequestResponseMetadata> {
	actions: EngineAction[];
	metadata: T;
}

export interface EngineResponse<T = RequestResponseMetadata> {
	results: EngineActionResult[];
	metadata: T;
}

export interface EngineAction {
	/** Deterministic: hash(executionId + nodeId + iteration + index) */
	id: string;
	type: ActionType;
	/** Tool node ID in workflow */
	nodeName: string;
	/** Explicit tool name */
	tool: ToolName;
	/** Validated by tool schema */
	input: unknown;
	metadata: {
		itemIndex: number;
		iteration: number;
		attempt: number;
		source: 'agent' | 'system';
		/** Hash of action for deduplication */
		stepHash: string;
	};
}

export interface EngineActionResult {
	/** Matches EngineAction.id */
	id: string;
	output: unknown;
	error?: AgentError;
	durationMs: number;
	outputSize: number;
}

// ============================================================================
// Request/Response Metadata
// ============================================================================

export interface RequestResponseMetadata {
	itemIndex: number;
	iterationCount: number;
	previousRequests?: EngineRequest[];
	executionId: string;
	nodeId: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

export interface AgentTool<TIn = unknown, TOut = unknown> {
	name: ToolName;
	description: string;
	inputSchema: ZodSchema<TIn>;
	outputSchema: ZodSchema<TOut>;
	execute(ctx: ToolContext, input: TIn): Promise<TOut>;
	/** Default: 5000 */
	timeoutMs?: number;
	/** Default: 1MB */
	maxOutputBytes?: number;
	/** Org-level allowlist */
	allowedOrgs?: string[];
}

export interface ToolContext {
	executionId: string;
	nodeId: string;
	signal: AbortSignal;
	emit(event: AgentEvent): void;
}

// ============================================================================
// Tool Call Request
// ============================================================================

export interface ToolCallRequest {
	tool: ToolName;
	toolInput: Record<string, unknown>;
	/** Deterministic ID */
	toolCallId: string;
	type?: string;
	log?: string;
	messageLog?: unknown[];
}

// ============================================================================
// Agent Result
// ============================================================================

export interface AgentResult {
	output: string;
	toolCalls?: ToolCallRequest[];
	steps?: IntermediateStep[];
	finalState?: 'success' | 'max_iterations' | 'no_progress' | 'error';
}

export interface IntermediateStep {
	action: {
		tool: ToolName;
		toolInput: Record<string, unknown>;
		log: string;
		messageLog: unknown[];
		toolCallId: string;
		type: string;
	};
	observation?: string;
	error?: AgentError;
	durationMs?: number;
}

// ============================================================================
// Observability Events
// ============================================================================

export type AgentEvent =
	| {
			t: 'agent.plan';
			iteration: number;
			actions: PlannedActionPreview[];
	  }
	| {
			t: 'engine.request';
			requestId: string;
			actions: EngineActionPreview[];
	  }
	| {
			t: 'tool.start';
			tool: ToolName;
			id: string;
			input: unknown;
	  }
	| {
			t: 'tool.success';
			tool: ToolName;
			id: string;
			size: number;
			ms: number;
	  }
	| {
			t: 'tool.error';
			tool: ToolName;
			id: string;
			error: AgentError;
	  }
	| {
			t: 'agent.finish';
			iteration: number;
			output: string;
			finalState: string;
	  };

export type PlannedActionPreview = Pick<EngineAction, 'tool' | 'type'>;
export type EngineActionPreview = Pick<EngineAction, 'id' | 'tool' | 'nodeName'>;

// ============================================================================
// Error Types
// ============================================================================

export interface AgentError {
	code:
		| 'TOOL_TIMEOUT'
		| 'VALIDATION_ERROR'
		| 'MAX_ITERATIONS'
		| 'NO_PROGRESS'
		| 'MODEL_ERROR'
		| 'TOOL_UNAVAILABLE';
	message: string;
	cause?: Error;
	retriable: boolean;
}

export class AgentExecutionError extends Error {
	public cause?: Error;

	constructor(
		public readonly agentError: AgentError,
	) {
		super(agentError.message);
		this.name = 'AgentExecutionError';
		if (agentError.cause) {
			this.cause = agentError.cause;
		}
	}
}

// ============================================================================
// Memory Types
// ============================================================================

export type MemoryType = 'ephemeral' | 'thread' | 'global';

export interface MemoryConfig {
	type: MemoryType;
	maxTokens?: number;
	maxMessages?: number;
	storeSummaries?: boolean;
}

// ============================================================================
// LangGraph State
// ============================================================================

export interface AgentGraphState {
	messages: BaseMessage[];
	toolCalls: ToolCallRequest[];
	toolResults: Map<string, EngineActionResult>;
	iteration: number;
	finalOutput?: string;
	error?: AgentError;
}

// ============================================================================
// Agent Options
// ============================================================================

export interface AgentOptions {
	systemPrompt?: string;
	maxIterations?: number;
	temperature?: number;
	enableStreaming?: boolean;
	returnIntermediateSteps?: boolean;
	memoryConfig?: MemoryConfig;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isEngineRequest<T = RequestResponseMetadata>(
	result: unknown,
): result is EngineRequest<T> {
	return (
		typeof result === 'object' &&
		result !== null &&
		'actions' in result &&
		'metadata' in result &&
		Array.isArray((result as EngineRequest<T>).actions)
	);
}

export function isAgentError(error: unknown): error is AgentError {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		'message' in error &&
		'retriable' in error
	);
}

// ============================================================================
// Utility Types
// ============================================================================

export interface StreamChunk {
	type: 'token' | 'tool_call' | 'tool_result' | 'final';
	content?: string;
	id?: string;
	tool?: ToolName;
	input?: unknown;
	output?: unknown;
	error?: AgentError;
}

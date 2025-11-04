/**
 * Engine Request Handler
 *
 * Handles tool execution requests from agents
 * Implements timeout, size quotas, and error handling
 */

import type {
	EngineRequest,
	EngineResponse,
	EngineAction,
	EngineActionResult,
	RequestResponseMetadata,
	AgentTool,
	ToolContext,
	AgentError,
} from '@/server/types/agent';
import { createEventEmitter } from '@/server/observability/events';

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * Global tool registry
 * Maps tool names to tool implementations
 */
const toolRegistry = new Map<string, AgentTool>();

/**
 * Register a tool for execution
 */
export function registerTool(tool: AgentTool): void {
	toolRegistry.set(tool.name, tool);
}

/**
 * Get a tool by name
 */
export function getToolByName(name: string): AgentTool | undefined {
	return toolRegistry.get(name);
}

/**
 * List all registered tools
 */
export function listTools(): AgentTool[] {
	return Array.from(toolRegistry.values());
}

// ============================================================================
// Request Handler
// ============================================================================

export interface HandleRequestOptions {
	/** Workflow data (for context merging) */
	workflowData?: Record<string, unknown>;
	/** Continue on tool failure */
	continueOnFail?: boolean;
	/** Organization ID (for allowlist checks) */
	orgId?: string;
}

/**
 * Main request handler
 * Executes all actions in a request and returns results
 */
export async function handleEngineRequest(
	request: EngineRequest<RequestResponseMetadata>,
	options: HandleRequestOptions = {},
): Promise<EngineResponse<RequestResponseMetadata>> {
	const { workflowData = {}, continueOnFail = false, orgId } = options;
	const emitter = createEventEmitter();

	// Emit engine.request event
	emitter.emit({
		t: 'engine.request',
		requestId: `req_${Date.now().toString(36)}`,
		actions: request.actions.map((a) => ({
			id: a.id,
			tool: a.tool,
			nodeName: a.nodeName,
		})),
	});

	const results: EngineActionResult[] = [];

	// Execute actions sequentially (could be parallelized)
	for (const action of request.actions) {
		const result = await executeAction(action, {
			workflowData,
			continueOnFail,
			orgId,
			emitter,
		});
		results.push(result);

		// If not continuing on fail and we got an error, stop
		if (!continueOnFail && result.error) {
			break;
		}
	}

	return {
		results,
		metadata: request.metadata,
	};
}

// ============================================================================
// Action Execution
// ============================================================================

interface ExecuteActionOptions {
	workflowData: Record<string, unknown>;
	continueOnFail: boolean;
	orgId?: string;
	emitter: ReturnType<typeof createEventEmitter>;
}

/**
 * Execute a single action (tool call)
 */
async function executeAction(
	action: EngineAction,
	options: ExecuteActionOptions,
): Promise<EngineActionResult> {
	const { workflowData, orgId, emitter } = options;
	const startTime = Date.now();

	try {
		// Get tool from registry
		const tool = getToolByName(action.tool);
		if (!tool) {
			throw new Error(`Tool "${action.tool}" not found in registry`);
		}

		// Check org allowlist
		if (orgId && tool.allowedOrgs && !tool.allowedOrgs.includes(orgId)) {
			throw new Error(`Tool "${action.tool}" not allowed for organization "${orgId}"`);
		}

		// Merge workflow data with action input
		const mergedInput = {
			...workflowData,
			...(action.input as Record<string, unknown>),
		};

		// Validate input with Zod schema
		const validInput = tool.inputSchema.parse(mergedInput);

		// Create tool context with timeout
		const abortController = new AbortController();
		const timeoutMs = tool.timeoutMs ?? 5000;

		const timeoutId = setTimeout(() => {
			abortController.abort();
		}, timeoutMs);

		const ctx: ToolContext = {
			executionId: action.id,
			nodeId: action.nodeName,
			signal: abortController.signal,
			emit: emitter.createEmitFunction(),
		};

		// Execute tool with timeout
		const output = await Promise.race([
			tool.execute(ctx, validInput),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Tool execution timeout')), timeoutMs),
			),
		]);

		clearTimeout(timeoutId);

		// Validate output with Zod schema
		const validOutput = tool.outputSchema.parse(output);

		// Check output size
		const outputSize = JSON.stringify(validOutput).length;
		const maxOutputBytes = tool.maxOutputBytes ?? 1024 * 1024; // 1MB default

		if (outputSize > maxOutputBytes) {
			throw new Error(
				`Tool output too large: ${outputSize} bytes (max: ${maxOutputBytes} bytes)`,
			);
		}

		// Success
		return {
			id: action.id,
			output: validOutput,
			durationMs: Date.now() - startTime,
			outputSize,
		};
	} catch (error) {
		// Normalize error
		const agentError = normalizeError(error);

		return {
			id: action.id,
			output: null,
			error: agentError,
			durationMs: Date.now() - startTime,
			outputSize: 0,
		};
	}
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Normalize any error to AgentError format
 */
export function normalizeError(error: unknown): AgentError {
	if (isAgentError(error)) {
		return error;
	}

	if (error instanceof Error) {
		// Detect specific error types
		if (error.message.includes('timeout')) {
			return {
				code: 'TOOL_TIMEOUT',
				message: error.message,
				cause: error,
				retriable: true,
			};
		}

		if (error.message.includes('not found') || error.message.includes('unavailable')) {
			return {
				code: 'TOOL_UNAVAILABLE',
				message: error.message,
				cause: error,
				retriable: true,
			};
		}

		if (error.name === 'ZodError') {
			return {
				code: 'VALIDATION_ERROR',
				message: error.message,
				cause: error,
				retriable: false,
			};
		}

		// Generic error
		return {
			code: 'MODEL_ERROR',
			message: error.message,
			cause: error,
			retriable: false,
		};
	}

	// Unknown error type
	return {
		code: 'MODEL_ERROR',
		message: String(error),
		retriable: false,
	};
}

function isAgentError(error: unknown): error is AgentError {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		'message' in error &&
		'retriable' in error
	);
}

// ============================================================================
// Security Utilities
// ============================================================================

/**
 * Redact secrets from logs and error messages
 */
export function redactSecrets(text: string): string {
	return text
		.replace(/api[_-]?key[=:]\s*["']?[\w-]+["']?/gi, 'api_key=***')
		.replace(/token[=:]\s*["']?[\w.-]+["']?/gi, 'token=***')
		.replace(/password[=:]\s*["']?[^\s"']+["']?/gi, 'password=***')
		.replace(/secret[=:]\s*["']?[^\s"']+["']?/gi, 'secret=***')
		.replace(/bearer\s+[\w.-]+/gi, 'bearer ***');
}

/**
 * Check if a tool is allowed for an organization
 */
export function checkToolAllowed(tool: AgentTool, orgId?: string): boolean {
	if (!orgId) return true; // No org restriction
	if (!tool.allowedOrgs) return true; // Tool has no restrictions
	return tool.allowedOrgs.includes(orgId);
}

/**
 * Truncate output to prevent excessive data transfer
 */
export function truncateOutput(output: unknown, maxLength: number = 500): unknown {
	const str = JSON.stringify(output);
	if (str.length <= maxLength) return output;

	return {
		__truncated: true,
		preview: str.slice(0, maxLength),
		fullLength: str.length,
	};
}

// ============================================================================
// Parallel Execution (Optional)
// ============================================================================

/**
 * Execute multiple actions in parallel with concurrency limit
 * Useful for tools that don't depend on each other
 */
export async function handleEngineRequestParallel(
	request: EngineRequest<RequestResponseMetadata>,
	options: HandleRequestOptions & { maxConcurrency?: number } = {},
): Promise<EngineResponse<RequestResponseMetadata>> {
	const { maxConcurrency = 5 } = options;
	const emitter = createEventEmitter();

	emitter.emit({
		t: 'engine.request',
		requestId: `req_${Date.now().toString(36)}`,
		actions: request.actions.map((a) => ({
			id: a.id,
			tool: a.tool,
			nodeName: a.nodeName,
		})),
	});

	// Simple concurrency control using Promise.all with batching
	const results: EngineActionResult[] = [];
	const batches: EngineAction[][] = [];

	for (let i = 0; i < request.actions.length; i += maxConcurrency) {
		batches.push(request.actions.slice(i, i + maxConcurrency));
	}

	for (const batch of batches) {
		const batchResults = await Promise.all(
			batch.map((action) =>
				executeAction(action, {
					workflowData: options.workflowData ?? {},
					continueOnFail: options.continueOnFail ?? false,
					orgId: options.orgId,
					emitter,
				}),
			),
		);
		results.push(...batchResults);
	}

	return {
		results,
		metadata: request.metadata,
	};
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example: Register tools and handle request
 *
 * import { calculatorTool } from '@/server/tools/calculator';
 * import { searchTool } from '@/server/tools/search';
 *
 * // Register tools
 * registerTool(calculatorTool);
 * registerTool(searchTool);
 *
 * // Create request
 * const request: EngineRequest = {
 *   actions: [
 *     {
 *       id: 'call_123',
 *       type: 'ai_tool',
 *       nodeName: 'calculator_node',
 *       tool: 'calculator' as ToolName,
 *       input: { expression: '2+2' },
 *       metadata: {
 *         itemIndex: 0,
 *         iteration: 1,
 *         attempt: 0,
 *         source: 'agent',
 *         stepHash: 'abc123',
 *       },
 *     },
 *   ],
 *   metadata: {
 *     itemIndex: 0,
 *     iterationCount: 1,
 *     executionId: 'exec_123',
 *     nodeId: 'agent_1',
 *   },
 * };
 *
 * // Handle request
 * const response = await handleEngineRequest(request);
 *
 * // response.results[0].output = { result: 4, expression: '2+2', success: true }
 */

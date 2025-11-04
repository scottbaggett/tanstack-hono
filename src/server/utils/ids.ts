/**
 * Deterministic ID Generation
 *
 * Utilities for generating stable, collision-resistant IDs for agent execution
 * Enables idempotent retries and deduplication
 */

// ============================================================================
// Tool Call ID Generation
// ============================================================================

/**
 * Generates a deterministic tool call ID based on execution context
 *
 * Format: hash(executionId:nodeId:iteration:index)
 * Properties:
 * - Same inputs always produce same ID (idempotent)
 * - Different inputs produce different IDs (collision-resistant)
 * - Short enough for logging/storage (16 chars base64)
 *
 * @param executionId - Unique execution/workflow run ID
 * @param nodeId - Agent node ID in workflow
 * @param iteration - Current iteration number
 * @param index - Tool call index within iteration
 * @returns Base64-encoded hash (16 chars)
 */
export async function generateToolCallId(
	executionId: string,
	nodeId: string,
	iteration: number,
	index: number,
): Promise<string> {
	const input = `${executionId}:${nodeId}:${iteration}:${index}`;
	const encoder = new TextEncoder();
	const data = encoder.encode(input);

	// Use SHA-256 for collision resistance
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = new Uint8Array(hashBuffer);

	// Convert to base64, take first 16 chars
	const base64 = btoa(String.fromCharCode(...Array.from(hashArray)));
	return base64.slice(0, 16).replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Synchronous version using simple hash (for environments without crypto.subtle)
 * Less collision-resistant but still deterministic
 */
export function generateToolCallIdSync(
	executionId: string,
	nodeId: string,
	iteration: number,
	index: number,
): string {
	const input = `${executionId}:${nodeId}:${iteration}:${index}`;
	let hash = 0;

	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	// Convert to base36 for shorter representation
	return Math.abs(hash).toString(36).padStart(8, '0');
}

// ============================================================================
// Step Hash Generation (for deduplication)
// ============================================================================

/**
 * Generates a hash of an action for deduplication
 *
 * Used to detect if the same tool call is being executed multiple times
 * (no-progress detection)
 *
 * @param tool - Tool name
 * @param input - Tool input parameters
 * @returns Hash string (8 chars)
 */
export async function generateStepHash(tool: string, input: unknown): Promise<string> {
	// Stringify input in a canonical way (sorted keys)
	const canonical = JSON.stringify(input, Object.keys(input as object).sort());
	const combined = `${tool}:${canonical}`;

	const encoder = new TextEncoder();
	const data = encoder.encode(combined);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = new Uint8Array(hashBuffer);

	const base64 = btoa(String.fromCharCode(...Array.from(hashArray)));
	return base64.slice(0, 8).replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Synchronous version of step hash
 */
export function generateStepHashSync(tool: string, input: unknown): string {
	const canonical = JSON.stringify(input, Object.keys(input as object).sort());
	const combined = `${tool}:${canonical}`;

	let hash = 0;
	for (let i = 0; i < combined.length; i++) {
		const char = combined.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}

	return Math.abs(hash).toString(36).padStart(8, '0');
}

// ============================================================================
// Request ID Generation
// ============================================================================

/**
 * Generates a unique request ID for engine requests
 *
 * Format: req_<timestamp>_<random>
 *
 * @returns Request ID string
 */
export function generateRequestId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `req_${timestamp}_${random}`;
}

// ============================================================================
// Execution ID Generation
// ============================================================================

/**
 * Generates a unique execution ID for workflow runs
 *
 * Format: exec_<timestamp>_<uuid>
 *
 * @returns Execution ID string
 */
export function generateExecutionId(): string {
	const timestamp = Date.now().toString(36);
	const uuid = crypto.randomUUID().split('-')[0]; // Take first segment
	return `exec_${timestamp}_${uuid}`;
}

// ============================================================================
// ID Validation
// ============================================================================

/**
 * Validates that an ID is properly formatted
 */
export function isValidToolCallId(id: string): boolean {
	// Should be 8-16 chars, alphanumeric + dash/underscore
	return /^[a-zA-Z0-9_-]{8,16}$/.test(id);
}

export function isValidRequestId(id: string): boolean {
	return /^req_[a-z0-9]+_[a-z0-9]+$/.test(id);
}

export function isValidExecutionId(id: string): boolean {
	return /^exec_[a-z0-9]+_[a-z0-9]+$/.test(id);
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example: Generate tool call ID
 *
 * const id1 = await generateToolCallId('exec_123', 'agent_1', 1, 0);
 * const id2 = await generateToolCallId('exec_123', 'agent_1', 1, 0);
 * // id1 === id2 (deterministic)
 *
 * const id3 = await generateToolCallId('exec_123', 'agent_1', 1, 1);
 * // id3 !== id1 (different index)
 */

/**
 * Example: Detect duplicate tool calls
 *
 * const hash1 = await generateStepHash('calculator', { expression: '2+2' });
 * const hash2 = await generateStepHash('calculator', { expression: '2+2' });
 * // hash1 === hash2 (same tool + input)
 *
 * const hash3 = await generateStepHash('calculator', { expression: '3+3' });
 * // hash3 !== hash1 (different input)
 *
 * if (hash1 === hash2) {
 *   console.log('No progress - same tool call repeated');
 * }
 */

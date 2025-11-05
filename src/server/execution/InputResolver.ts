/**
 * Input Resolver
 *
 * Resolves node inputs by:
 * 1. Checking for direct edge connections
 * 2. Resolving {{variable}} placeholders in strings
 * 3. Extracting dynamic inputs from template strings
 * 4. Handling nested parameters
 *
 * This enables powerful dynamic workflows where nodes can reference outputs
 * from upstream nodes simply by using {{variableName}} syntax.
 */

import type { INodeExecutionData } from "../../types/execution";

// ============================================================================
// VARIABLE EXTRACTION
// ============================================================================

/**
 * Extract all {{variable}} references from a string
 *
 * @example
 * "Hello {{name}}, you have {{count}} messages"
 * // Returns: ["name", "count"]
 */
export function extractVariables(text: string): string[] {
	const pattern = /\{\{([^}]+)\}\}/g;
	const variables: string[] = [];
	let match: RegExpExecArray | null = pattern.exec(text);

	while (match !== null) {
		const varName = match[1].trim();
		if (!variables.includes(varName)) {
			variables.push(varName);
		}
		match = pattern.exec(text);
	}

	return variables;
}

/**
 * Check if a string contains {{variable}} placeholders
 */
export function hasVariables(text: string): boolean {
	return /\{\{[^}]+\}\}/.test(text);
}

// ============================================================================
// EDGE VALUE RESOLUTION
// ============================================================================

/**
 * Get value from a connected edge for a specific input
 */
export function getEdgeValue(
	inputName: string,
	nodeId: string,
	edges: Array<{
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}>,
	state: Record<string, Record<string, INodeExecutionData[]>>,
): INodeExecutionData | undefined {
	// Find edges connecting to this node's input
	const incomingEdges = edges.filter(
		(edge) =>
			edge.target === nodeId && (edge.targetHandle ?? "default") === inputName,
	);

	if (incomingEdges.length === 0) {
		return undefined;
	}

	// Get the first connected edge
	const sourceEdge = incomingEdges[0];
	const sourceNodeId = sourceEdge.source;
	const sourceHandle = sourceEdge.sourceHandle ?? "output";

	// Look up the output from the source node
	const sourceOutput = state[sourceNodeId];
	if (!sourceOutput) {
		return undefined;
	}

	// Get the specific output handle value
	const handleData = sourceOutput[sourceHandle];
	if (handleData && Array.isArray(handleData) && handleData.length > 0) {
		return handleData[0]; // Return first item
	}

	return undefined;
}

/**
 * Get all values from a connected edge
 */
export function getEdgeValues(
	inputName: string,
	nodeId: string,
	edges: Array<{
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}>,
	state: Record<string, Record<string, INodeExecutionData[]>>,
): INodeExecutionData[] {
	const incomingEdges = edges.filter(
		(edge) =>
			edge.target === nodeId && (edge.targetHandle ?? "default") === inputName,
	);

	if (incomingEdges.length === 0) {
		return [];
	}

	const sourceEdge = incomingEdges[0];
	const sourceNodeId = sourceEdge.source;
	const sourceHandle = sourceEdge.sourceHandle ?? "output";

	const sourceOutput = state[sourceNodeId];
	if (!sourceOutput) {
		return [];
	}

	const handleData = sourceOutput[sourceHandle];
	return Array.isArray(handleData) ? handleData : [];
}

// ============================================================================
// VARIABLE RESOLUTION IN STRINGS
// ============================================================================

/**
 * Resolve {{variable}} placeholders in a string with actual values
 *
 * @example
 * resolveVariablesInString(
 *   "User: {{username}}, Age: {{age}}",
 *   "agentNode",
 *   edges,
 *   state
 * )
 * // Returns: "User: alice, Age: 30"
 */
export function resolveVariablesInString(
	text: string,
	nodeId: string,
	edges: Array<{
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}>,
	state: Record<string, Record<string, INodeExecutionData[]>>,
): string {
	const pattern = /\{\{([^}]+)\}\}/g;
	let resolved = text;

	let match: RegExpExecArray | null = pattern.exec(text);
	while (match !== null) {
		const variableName = match[1].trim();
		const placeholder = match[0];

		// Find connected value for this variable
		const value = getEdgeValue(variableName, nodeId, edges, state);

		if (value !== undefined) {
			// Convert value to string
			let stringValue = "";
			if (typeof value === "string") {
				stringValue = value;
			} else if (typeof value === "number") {
				stringValue = String(value);
			} else if (typeof value === "object" && value !== null) {
				stringValue = JSON.stringify(value);
			} else {
				stringValue = String(value);
			}

			resolved = resolved.replace(placeholder, stringValue);
		}
		// If value not found, leave placeholder as-is
		match = pattern.exec(text);
	}

	return resolved;
}

// ============================================================================
// INPUT RESOLUTION
// ============================================================================

/**
 * Configuration for input resolution
 */
export interface ResolveInputsConfig {
	nodeInputs: Record<string, unknown>;
	nodeId: string;
	edges: Array<{
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}>;
	state: Record<string, Record<string, INodeExecutionData[]>>;
	logger?: Console;
}

/**
 * Resolve all node inputs by:
 * 1. Checking for direct edge connections
 * 2. Resolving {{variable}} placeholders
 * 3. Handling nested structures
 */
export function resolveInputs(
	config: ResolveInputsConfig,
): Record<string, unknown> {
	const { nodeInputs, nodeId, edges, state, logger } = config;
	const resolved: Record<string, unknown> = {};

	for (const [inputName, inputValue] of Object.entries(nodeInputs)) {
		// Check for direct edge connection
		const edgeValue = getEdgeValue(inputName, nodeId, edges, state);

		if (edgeValue !== undefined) {
			resolved[inputName] = edgeValue;
			logger?.info(`[${nodeId}] Edge connection: ${inputName}`);
		} else if (typeof inputValue === "string") {
			// Process string for {{variable}} placeholders
			resolved[inputName] = resolveVariablesInString(
				inputValue,
				nodeId,
				edges,
				state,
			);

			// Log if variables were resolved
			const vars = extractVariables(inputValue);
			if (vars.length > 0) {
				logger?.info(
					`[${nodeId}] Resolved variables in ${inputName}: ${vars.join(", ")}`,
				);
			}
		} else if (
			typeof inputValue === "object" &&
			inputValue !== null &&
			!Array.isArray(inputValue)
		) {
			// Recursively resolve nested objects
			resolved[inputName] = resolveNestedObject(
				inputValue as Record<string, unknown>,
				nodeId,
				edges,
				state,
			);
		} else {
			// Pass through unchanged
			resolved[inputName] = inputValue;
		}
	}

	return resolved;
}

/**
 * Recursively resolve variables in nested objects
 */
function resolveNestedObject(
	obj: Record<string, unknown>,
	nodeId: string,
	edges: Array<{
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}>,
	state: Record<string, Record<string, INodeExecutionData[]>>,
): Record<string, unknown> {
	const resolved: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "string") {
			resolved[key] = resolveVariablesInString(value, nodeId, edges, state);
		} else if (
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value)
		) {
			resolved[key] = resolveNestedObject(
				value as Record<string, unknown>,
				nodeId,
				edges,
				state,
			);
		} else {
			resolved[key] = value;
		}
	}

	return resolved;
}

// ============================================================================
// DYNAMIC INPUT INFERENCE
// ============================================================================

/**
 * Extract implicit input handles from node configuration
 *
 * When a node uses {{variable}} in any configuration, that becomes
 * a dynamic input handle that can be connected to upstream nodes.
 *
 * @example
 * If a node has nodeInputs: { prompt: "Hello {{name}}, you have {{count}} items" }
 * This function will return: ["name", "count"]
 *
 * These become implicit input handles that can be connected in the UI.
 */
export function extractDynamicInputHandles(
	nodeInputs: Record<string, unknown>,
): string[] {
	const handles = new Set<string>();

	function extractFromValue(value: unknown) {
		if (typeof value === "string") {
			const vars = extractVariables(value);
			for (const v of vars) {
				handles.add(v);
			}
		} else if (
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value)
		) {
			for (const v of Object.values(value as Record<string, unknown>)) {
				extractFromValue(v);
			}
		}
	}

	for (const value of Object.values(nodeInputs)) {
		extractFromValue(value);
	}

	return Array.from(handles);
}

// ============================================================================
// DYNAMIC OUTPUT EXPOSURE
// ============================================================================

/**
 * When a node outputs JSON with multiple fields, those fields can become
 * output handles automatically.
 *
 * For example, if an LLM node with json_schema outputs:
 * { "name": "Alice", "age": 30, "email": "alice@example.com" }
 *
 * Then output handles are automatically created for: name, age, email
 */
export function extractDynamicOutputHandles(output: unknown): string[] {
	if (typeof output === "object" && output !== null && !Array.isArray(output)) {
		return Object.keys(output);
	}
	return [];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that all required inputs are satisfied
 *
 * An input is satisfied if:
 * 1. It has a direct edge connection, OR
 * 2. It's a string without unresolved {{variables}}, OR
 * 3. It has a static value
 */
export function validateInputs(
	nodeInputs: Record<string, unknown>,
	nodeId: string,
	edges: Array<{
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}>,
	_state: Record<string, Record<string, INodeExecutionData[]>>,
	requiredInputs: string[] = [],
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	for (const requiredInput of requiredInputs) {
		const inputValue = nodeInputs[requiredInput];

		// Check if has edge connection
		const hasEdge = edges.some(
			(edge) =>
				edge.target === nodeId &&
				(edge.targetHandle ?? "default") === requiredInput,
		);

		if (hasEdge) {
			continue; // Input satisfied by edge
		}

		// Check if has static value
		if (inputValue !== undefined && inputValue !== null && inputValue !== "") {
			continue; // Input has value
		}

		errors.push(`Required input "${requiredInput}" is not satisfied`);
	}

	// Check for unresolved variables in required inputs
	for (const requiredInput of requiredInputs) {
		const inputValue = nodeInputs[requiredInput];

		if (typeof inputValue === "string") {
			const vars = extractVariables(inputValue);

			for (const varName of vars) {
				const hasEdge = edges.some(
					(edge) =>
						edge.target === nodeId &&
						(edge.targetHandle ?? "default") === varName,
				);

				if (!hasEdge) {
					errors.push(
						`Unresolved variable "{{${varName}}}" in input "${requiredInput}"`,
					);
				}
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

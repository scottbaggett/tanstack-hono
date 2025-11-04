/**
 * Workflow Execution Engine
 *
 * Executes workflows by:
 * - Processing nodes in topological order
 * - Managing data flow between nodes
 * - Handling async/streaming execution
 * - Collecting results
 */

import type { WorkflowDefinition, NodeExecutionData } from "@/types/interfaces";
import { nodeRegistry } from "@/server/nodes/registry";
import { buildExecutionContext } from "./context";

interface ExecutionResult {
	success: boolean;
	results?: Record<string, NodeExecutionData[][]>; // Keyed by node ID
	error?: string;
	executedNodes: string[]; // In order of execution
}

interface NodeState {
	results: NodeExecutionData[][];
	completed: boolean;
	error?: string;
}

/**
 * Topological sort of workflow nodes
 * Returns nodes in execution order based on their connections
 */
function topologicalSort(
	nodes: WorkflowDefinition["nodes"],
	edges: WorkflowDefinition["edges"],
): string[] {
	const nodeIds = new Set(nodes.map((n) => n.id));
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const result: string[] = [];

	function visit(nodeId: string) {
		if (visited.has(nodeId)) return;
		if (visiting.has(nodeId)) {
			throw new Error(`Circular dependency detected in workflow`);
		}

		visiting.add(nodeId);

		// Find all edges where this node is the target
		const incomingEdges = edges.filter((e) => e.target === nodeId);

		// Visit all source nodes first
		for (const edge of incomingEdges) {
			if (nodeIds.has(edge.source) && !visited.has(edge.source)) {
				visit(edge.source);
			}
		}

		visiting.delete(nodeId);
		visited.add(nodeId);
		result.push(nodeId);
	}

	// Visit all nodes
	for (const node of nodes) {
		visit(node.id);
	}

	return result;
}

/**
 * Get input values for a node from executed source nodes
 */
function getNodeInputs(
	nodeId: string,
	edges: WorkflowDefinition["edges"],
	nodeResults: Map<string, NodeState>,
): Record<string, any> {
	const inputs: Record<string, any> = {};

	// Find all edges where this node is the target
	const incomingEdges = edges.filter((e) => e.target === nodeId);

	for (const edge of incomingEdges) {
		const sourceState = nodeResults.get(edge.source);

		if (!sourceState?.results) {
			continue;
		}

		// Determine which output group to use based on sourceHandle
		// If sourceHandle is "true" or "false", map to output index 0 or 1
		// Otherwise, default to first output group (index 0)
		let outputGroupIndex = 0;
		if (edge.sourceHandle === "true") {
			outputGroupIndex = 0;
		} else if (edge.sourceHandle === "false") {
			outputGroupIndex = 1;
		} else if (edge.sourceHandle !== undefined) {
			// Try to parse as number for numeric handles
			const parsed = parseInt(edge.sourceHandle, 10);
			if (!isNaN(parsed)) {
				outputGroupIndex = parsed;
			}
		}

		// Get the output from the source node's output group
		const sourceOutput = sourceState.results[outputGroupIndex]?.[0];

		if (sourceOutput) {
			// Map to input by target handle or use 'main' as default
			const inputKey = edge.targetHandle || "main";
			inputs[inputKey] = sourceOutput.json || sourceOutput;
		}
	}

	return inputs;
}

/**
 * Execute a complete workflow
 * @param definition - Workflow definition with nodes and edges
 * @param initialInputs - Initial inputs for root nodes
 * @param signal - Abort signal for cancellation
 * @param pinnedData - Pre-computed outputs to use instead of executing nodes
 */
export async function executeWorkflow(
	definition: WorkflowDefinition,
	initialInputs?: Record<string, any>,
	signal?: AbortSignal,
	pinnedData?: Record<string, any>,
): Promise<ExecutionResult> {
	const { nodes, edges } = definition;

	if (!nodes || nodes.length === 0) {
		return {
			success: false,
			error: "Workflow has no nodes",
			executedNodes: [],
		};
	}

	// Get execution order
	let executionOrder: string[];
	try {
		executionOrder = topologicalSort(nodes, edges || []);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to sort nodes",
			executedNodes: [],
		};
	}

	const nodeResults = new Map<string, NodeState>();
	const executedNodes: string[] = [];

	// Execute nodes in order
	for (const nodeId of executionOrder) {
		// Check for cancellation
		if (signal?.aborted) {
			// Build results from nodeResults map for early return
			const earlyResults: Record<string, NodeExecutionData[][]> = {};
			for (const [id, state] of nodeResults.entries()) {
				earlyResults[id] = state.results;
			}

			return {
				success: false,
				error: "Workflow execution cancelled",
				executedNodes,
				results: earlyResults,
			};
		}

		// Check if this node has pinned data - if so, use it instead of executing
		if (pinnedData && pinnedData[nodeId]) {
			nodeResults.set(nodeId, {
				results: [[{ json: pinnedData[nodeId] }]],
				completed: true,
			});
			executedNodes.push(nodeId);
			continue;
		}

		const node = nodes.find((n) => n.id === nodeId);
		if (!node) {
			nodeResults.set(nodeId, {
				results: [],
				completed: false,
				error: "Node definition not found",
			});
			continue;
		}

		try {
			// Get the actual node type from node.data.nodeId (not node.type which is React Flow type)
			const actualNodeType = (node.data as any)?.nodeId || node.type;
			const nodeType = nodeRegistry.getNodeType(actualNodeType);
			const nodeDefinition = nodeRegistry.getDefinition(actualNodeType);

			if (!nodeType || !nodeDefinition) {
				throw new Error(`Node type "${actualNodeType}" not found in registry`);
			}

			// Get inputs from connected source nodes
			const nodeInputs = getNodeInputs(nodeId, edges || [], nodeResults);

			// Merge with initial inputs if this is a root node (no incoming edges)
			const incomingEdges = (edges || []).filter((e) => e.target === nodeId);
			if (incomingEdges.length === 0 && initialInputs) {
				Object.assign(nodeInputs, initialInputs);
			}

			// Build execution context with evaluated properties and credentials
			// Use propertyValues if available (user-entered values), fallback to empty object
			const nodeProperties =
				(node.data?.propertyValues as Record<string, unknown>) ||
				(node.data?.properties as Record<string, unknown>) ||
				{};

			// Extract credentials from node (at top level, not in data)
			const nodeCredentials = node.credentials as
				| Record<string, { id: string; name: string }>
				| undefined;

			const context = await buildExecutionContext({
				nodeId,
				nodeType: actualNodeType,
				version: node.version || 1,
				nodeDescription: nodeDefinition,
				properties: nodeProperties,
				inputs: nodeInputs,
				credentials: nodeCredentials,
				previousData: undefined,
				signal,
			});

			// Execute the node
			const results = await nodeType.execute(context);

			nodeResults.set(nodeId, {
				results: Array.isArray(results) ? results : [results],
				completed: true,
			});

			executedNodes.push(nodeId);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			nodeResults.set(nodeId, {
				results: [],
				completed: false,
				error: errorMessage,
			});

			// Continue executing other nodes (don't fail entire workflow on single node error)
			console.error(`Error executing node "${nodeId}":`, errorMessage);
		}
	}

	// Convert results map to object
	const results: Record<string, NodeExecutionData[][]> = {};
	let hasErrors = false;

	for (const [nodeId, state] of nodeResults.entries()) {
		results[nodeId] = state.results;
		if (state.error) {
			hasErrors = true;
		}
	}

	return {
		success: !hasErrors,
		results,
		executedNodes,
	};
}

/**
 * Get the final output from a workflow execution
 * Returns the results from the last executed node
 */
export function getWorkflowOutput(
	results: ExecutionResult["results"],
	executedNodes: string[],
): NodeExecutionData[][] | undefined {
	if (!results || executedNodes.length === 0) {
		return undefined;
	}

	const lastNodeId = executedNodes[executedNodes.length - 1];
	return results[lastNodeId];
}

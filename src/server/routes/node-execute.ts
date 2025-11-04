/**
 * Node Execution Routes
 *
 * Endpoints for executing individual nodes with parameters
 * Supports testing nodes with upstream re-execution (like n8n's "test step")
 */

import { Hono } from "hono";
import { nodeRegistry } from "../nodes/registry";
import { executeWorkflow } from "../execution/engine";
import type { INodeType } from "@/types/interfaces";

export const nodeExecuteRoutes = new Hono();

/**
 * POST /nodes/:testNodeId/execute - Execute a node with upstream context
 *
 * Request body:
 * {
 *   "workflowDefinition": { "nodes": [...], "edges": [...] },
 *   "testNodeId": "node-123",
 *   "parameters": { "param1": "value1", ... },
 *   "pinnedData": { "upstream-node-id": {...} }
 * }
 *
 * Flow:
 * 1. If pinnedData provided, use it instead of executing upstream nodes
 * 2. Otherwise, execute all upstream nodes in topological order
 * 3. Pass their outputs as inputs to the test node
 * 4. Execute the test node with new parameters
 * 5. Return the test node's output
 */
nodeExecuteRoutes.post("/:testNodeId", async (c) => {
	const testNodeId = c.req.param("testNodeId");

	try {
		const body = await c.req.json();
		const { workflowDefinition, parameters = {}, pinnedData = {} } = body;

		console.log("Node execute request:", {
			testNodeId,
			bodyKeys: Object.keys(body),
			hasWorkflowDef: !!workflowDefinition,
		});

		if (!workflowDefinition || !workflowDefinition.nodes) {
			return c.json(
				{
					success: false,
					error: "workflowDefinition with nodes array is required",
				},
				400,
			);
		}

		// Find the test node in the definition
		const testNodeDef = workflowDefinition.nodes.find(
			(n: any) => n.id === testNodeId,
		);
		if (!testNodeDef) {
			return c.json(
				{
					success: false,
					error: `Test node "${testNodeId}" not found in workflow`,
				},
				404,
			);
		}

		// Find all upstream nodes (nodes that connect to the test node)
		const edges = (workflowDefinition.edges as any[]) || [];
		const upstreamNodeIds = new Set<string>();

		const findUpstream = (nodeId: string) => {
			const incomingEdges = edges.filter((e: any) => e.target === nodeId);
			for (const edge of incomingEdges) {
				if (!upstreamNodeIds.has(edge.source)) {
					upstreamNodeIds.add(edge.source);
					findUpstream(edge.source);
				}
			}
		};

		findUpstream(testNodeId);

		// Build modified workflow: only include test node and its upstream dependencies
		const nodes = (workflowDefinition.nodes as any[]) || [];
		const nodesToExecute = nodes.filter(
			(n: any) => n.id === testNodeId || upstreamNodeIds.has(n.id),
		);

		const modifiedDefinition = {
			nodes: nodesToExecute,
			edges: edges.filter(
				(e: any) =>
					upstreamNodeIds.has(e.source) ||
					e.source === testNodeId ||
					upstreamNodeIds.has(e.target),
			),
		};

		// Execute workflow up to and including the test node
		const startTime = Date.now();
		const executionResult = await executeWorkflow(
			modifiedDefinition,
			{},
			c.req.raw.signal,
			pinnedData,
		);
		const duration = Date.now() - startTime;

		// Extract output from test node
		const testNodeOutput =
			executionResult.results && executionResult.results[testNodeId]
				? executionResult.results[testNodeId]
				: null;

		return c.json({
			success: true,
			data: {
				nodeId: testNodeId,
				output: testNodeOutput,
				// Include all execution results for the frontend to use
				results: executionResult.results || {},
				duration,
				executedAt: new Date().toISOString(),
				upstreamNodesExecuted: Array.from(upstreamNodeIds),
				pinnedDataUsed: Object.keys(pinnedData),
			},
		});
	} catch (error) {
		console.error("Node execution error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Execution failed";
		const errorStack = error instanceof Error ? error.stack : undefined;
		console.error("Full error:", errorMessage, errorStack);
		return c.json(
			{
				success: false,
				error: errorMessage,
				stack: errorStack,
			},
			500,
		);
	}
});

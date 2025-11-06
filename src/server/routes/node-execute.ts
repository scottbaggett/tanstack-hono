/**
 * Node Execution Routes
 *
 * Endpoints for executing individual nodes with parameters
 * Supports testing nodes with upstream re-execution (like n8n's "test step")
 */

import crypto from "node:crypto";
import { Hono } from "hono";
import type { OrchestrationConfig } from "../execution/WorkflowOrchestrator";
import { WorkflowOrchestrator } from "../execution/WorkflowOrchestrator";
import "@/server/nodes/load"; // Ensure nodes are loaded

const nodeExecuteRoutes = new Hono();

/**
 * POST /nodes/:nodeId/execute - Execute a node with upstream context
 *
 * Request body:
 * {
 *   "workflowDefinition": { "nodes": [...], "edges": [...] },
 *   "nodeId": "node-123",
 *   "parameters": { "param1": "value1", ... },
 *   "excludeTarget": false  // Optional: if true, only execute upstream nodes (skip target)
 * }
 *
 * Flow:
 * 1. Find all upstream dependencies of the target node
 * 2. Execute all upstream nodes in topological order
 * 3. If excludeTarget is false (default):
 *    - Execute the target node with provided parameters
 *    - Return results for all nodes (upstream + target)
 * 4. If excludeTarget is true:
 *    - Skip executing the target node
 *    - Return results for upstream nodes only
 *    - Useful for verifying expressions before executing the current step
 */
nodeExecuteRoutes.post("/:nodeId", async (c) => {
	const nodeId = c.req.param("nodeId");

	try {
		const body = await c.req.json();
		const { workflowDefinition, parameters = {}, excludeTarget = false } = body;

		console.log("Node execute request:", {
			nodeId,
			bodyKeys: Object.keys(body),
			hasWorkflowDef: !!workflowDefinition,
			excludeTarget,
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
			(n: any) => n.id === nodeId,
		);

		console.log("Test node definition:", testNodeDef);

		if (!testNodeDef) {
			return c.json(
				{
					success: false,
					error: `Test node "${nodeId}" not found in workflow`,
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

		findUpstream(nodeId);

		// Build modified workflow
		// If excludeTarget is true, only execute upstream nodes (exclude the target node)
		const nodes = (workflowDefinition.nodes as any[]) || [];
		const nodesToExecute = nodes
			.filter((n: any) => {
				if (excludeTarget) {
					// Only include upstream nodes, skip the target node
					return upstreamNodeIds.has(n.id);
				}
				// Include both target node and upstream dependencies
				return n.id === nodeId || upstreamNodeIds.has(n.id);
			})
			.map((n: any) => {
				// Merge parameters into the test node's propertyValues (if not excluding it)
				if (n.id === nodeId && !excludeTarget) {
					return {
						...n,
						data: {
							...n.data,
							propertyValues: {
								...(n.data?.propertyValues || {}),
								...parameters,
							},
						},
					};
				}
				return n;
			});

		// Build node ID set for quick lookup
		const nodeIdSet = excludeTarget
			? upstreamNodeIds
			: new Set([nodeId, ...upstreamNodeIds]);

		const modifiedDefinition = {
			nodes: nodesToExecute,
			edges: edges.filter(
				(e: any) =>
					// Both source and target must be in our node set
					nodeIdSet.has(e.source) && nodeIdSet.has(e.target),
			),
			viewport: { x: 0, y: 0, zoom: 1 },
		};

		// Create a run ID for this execution (node testing - no workflow_runs record needed)
		const runId = crypto.randomUUID();

		// Create orchestration config
		const config: OrchestrationConfig = {
			workflowId: `test-node-${nodeId}`,
			runId,
			definition: modifiedDefinition,
			inputs: {},
			langchainModels: new Map(),
			langchainEmbeddings: new Map(),
			langchainTools: [],
			secrets: new Map(),
			logger: console,
			skipPersistence: true, // Don't persist to DB for node testing
		};

		// Execute workflow using WorkflowOrchestrator
		const orchestrator = new WorkflowOrchestrator(config);
		const result = await orchestrator.orchestrate();

		// Extract output from test node (if it was executed)
		const nodeResult = result.nodeResults.get(nodeId);

		// If excludeTarget is true, the target node won't be in the results (that's expected)
		if (!excludeTarget && !nodeResult) {
			console.error("[NODE-EXECUTE] Node result not found:", {
				nodeId,
				availableNodes: Array.from(result.nodeResults.keys()),
				executionErrors: result.errors,
			});
			return c.json(
				{
					success: false,
					error: `No execution result found for node ${nodeId}`,
					debug: {
						availableNodes: Array.from(result.nodeResults.keys()),
						errors: result.errors.map((e) => e.error.message),
					},
				},
				500,
			);
		}

		// Build runData for ALL executed nodes (not just the target node)
		// This allows the UI to update execution cache and expression context
		const runData: Record<string, any> = {};

		for (const [executedNodeId, executedResult] of result.nodeResults.entries()) {
			const mainOutput = executedResult.data?.main?.[0];
			const hasError = executedResult.status === "error";

			runData[executedNodeId] = [
				{
					data: hasError
						? null
						: {
								json: mainOutput?.json || {},
								binary: mainOutput?.binary || null,
							},
					error:
						hasError && executedResult.error
							? {
									message: executedResult.error.message,
									stack: executedResult.error.stack,
									name: executedResult.error.name,
								}
							: null,
					startTime: executedResult.startTime,
					executionTime: executedResult.durationMs,
					metadata: {
						executedAt: new Date(executedResult.endTime).toISOString(),
					},
				},
			];
		}

		// Add metadata to the target node result (if it was executed)
		if (!excludeTarget && runData[nodeId]?.[0]) {
			runData[nodeId][0].metadata.upstreamNodes = Array.from(upstreamNodeIds);
		}

		const hasError = nodeResult?.status === "error" || false;

		// Clean response structure matching n8n format
		return c.json({
			success: !hasError,
			runData,
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

export default nodeExecuteRoutes;

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
		const nodesToExecute = nodes
			.filter((n: any) => n.id === testNodeId || upstreamNodeIds.has(n.id))
			.map((n: any) => {
				// Merge parameters into the test node's propertyValues
				if (n.id === testNodeId) {
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
		const nodeIdSet = new Set([testNodeId, ...upstreamNodeIds]);

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
			workflowId: `test-node-${testNodeId}`,
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

		// Extract output from test node
		const nodeResult = result.nodeResults.get(testNodeId);

		if (!nodeResult) {
			console.error("[NODE-EXECUTE] Node result not found:", {
				testNodeId,
				availableNodes: Array.from(result.nodeResults.keys()),
				executionErrors: result.errors,
			});
			return c.json(
				{
					success: false,
					error: `No execution result found for node ${testNodeId}`,
					debug: {
						availableNodes: Array.from(result.nodeResults.keys()),
						errors: result.errors.map((e) => e.error.message),
					},
				},
				500,
			);
		}

		// Extract the main output data
		const mainOutput = nodeResult.data?.main?.[0];
		const hasError = nodeResult.status === "error";

		// Clean response structure matching n8n format
		return c.json({
			success: !hasError,
			runData: {
				[testNodeId]: [
					{
						data: hasError
							? null
							: {
									json: mainOutput?.json || {},
									binary: mainOutput?.binary || null,
								},
						error:
							hasError && nodeResult.error
								? {
										message: nodeResult.error.message,
										stack: nodeResult.error.stack,
										name: nodeResult.error.name,
									}
								: null,
						startTime: nodeResult.startTime,
						executionTime: nodeResult.durationMs,
						metadata: {
							executedAt: new Date(nodeResult.endTime).toISOString(),
							upstreamNodes: Array.from(upstreamNodeIds),
						},
					},
				],
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

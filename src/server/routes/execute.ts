/**
 * Workflow Execution Routes
 *
 * Endpoints for executing workflows
 */

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/server/db";
import { workflowRuns, workflows } from "@/server/db/schema";
import type { OrchestrationConfig } from "@/server/execution/WorkflowOrchestrator";
import { WorkflowOrchestrator } from "@/server/execution/WorkflowOrchestrator";
import "@/server/nodes/load"; // Ensure nodes are loaded

export const executeRoutes = new Hono();

/**
 * POST /execute/:id - Execute a workflow
 */
executeRoutes.post("/:id", async (c) => {
	const workflowId = c.req.param("id");
	const body = await c.req.json();

	try {
		// Get workflow from database
		const workflow = await db
			.select()
			.from(workflows)
			.where(eq(workflows.id, workflowId))
			.limit(1);

		if (!workflow || workflow.length === 0) {
			return c.json(
				{
					success: false,
					error: "Workflow not found",
				},
				404,
			);
		}

		const workflowDef = workflow[0];

		// Parse workflow definition
		let definition: {
			nodes: unknown[];
			edges: unknown[];
			viewport?: unknown;
		};
		try {
			definition =
				typeof workflowDef.definition === "string"
					? JSON.parse(workflowDef.definition)
					: workflowDef.definition;
		} catch (_error) {
			return c.json(
				{
					success: false,
					error: "Invalid workflow definition",
				},
				400,
			);
		}

		// Create a run ID for this execution
		const runId = crypto.randomUUID();

		// Create workflow run record
		await db.insert(workflowRuns).values({
			id: runId,
			workflowId: workflowId,
			status: "running",
			inputs: body.inputs || {},
		});

		// Create abort signal for this execution (5 minute timeout)
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

		try {
			// Create orchestration config
			const config: OrchestrationConfig = {
				workflowId,
				runId,
				definition,
				inputs: body.inputs || {},
				langchainModels: new Map(),
				langchainEmbeddings: new Map(),
				langchainTools: [],
				secrets: new Map(),
				logger: console,
			};

			// Execute workflow using WorkflowOrchestrator
			const orchestrator = new WorkflowOrchestrator(config);
			const result = await orchestrator.orchestrate();

			// Update workflow run status
			await db
				.update(workflowRuns)
				.set({
					status: result.status === "success" ? "completed" : "error",
					outputs: result.finalOutputs as any,
					completedAt: new Date(),
					durationMs: result.totalDurationMs,
				})
				.where(eq(workflowRuns.id, runId));

			return c.json({
				success: result.status === "success",
				data: {
					workflowId,
					runId,
					status: result.status,
					nodeResults: Array.from(result.nodeResults.values()),
					outputs: result.finalOutputs,
					errors: result.errors,
					durationMs: result.totalDurationMs,
				},
			});
		} catch (error) {
			// Update workflow run with error
			await db
				.update(workflowRuns)
				.set({
					status: "error",
					errorMessage:
						error instanceof Error ? error.message : "Execution failed",
					completedAt: new Date(),
				})
				.where(eq(workflowRuns.id, runId));

			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	} catch (error) {
		console.error("Workflow execution error:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Execution failed",
			},
			500,
		);
	}
});

/**
 * POST /execute/:id/stream - Execute workflow with streaming
 * (Placeholder for future streaming implementation)
 */
executeRoutes.post("/:id/stream", async (c) => {
	return c.json(
		{
			success: false,
			error: "Streaming execution not yet implemented",
		},
		501,
	);
});

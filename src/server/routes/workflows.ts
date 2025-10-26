/**
 * Workflow API Routes
 *
 * Endpoints for workflow CRUD operations:
 * - GET /workflows - List all workflows
 * - GET /workflows/:id - Get workflow details
 * - POST /workflows - Create new workflow
 * - PUT /workflows/:id - Update workflow
 * - DELETE /workflows/:id - Delete workflow
 * - POST /workflows/:id/run - Execute workflow
 * - GET /workflows/:workflowId/runs/:runId - Get run details
 * - GET /workflows/:workflowId/runs/:runId/events - Stream execution events
 */

import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";

import type { WorkflowDefinition } from "../../types/workflow";
import type { StreamEvent } from "../../types/execution";
import { db } from "../db";
import { workflows, workflowVersions, workflowRuns, nodeExecutions } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthUser } from "../auth/middleware";

// ============================================================================
// TYPES
// ============================================================================

interface ExecutionContext {
	workflowId: string;
	runId: string;
	definition: WorkflowDefinition;
	onEvent?: (event: StreamEvent) => void;
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export const workflowRoutes = new Hono();

// GET /workflows - List all workflows for current user
workflowRoutes.get("/", async (c) => {
	try {
		const user = getAuthUser(c);
		const allWorkflows = await db
			.select()
			.from(workflows)
			.where(eq(workflows.ownerId, user.userId));

		return c.json({
			success: true,
			data: {
				workflows: allWorkflows,
				total: allWorkflows.length,
			},
		});
	} catch (error) {
		console.error("Failed to list workflows:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to list workflows",
			},
			500
		);
	}
});

// GET /workflows/:id - Get workflow details
workflowRoutes.get("/:id", async (c) => {
	try {
		const user = getAuthUser(c);
		const id = c.req.param("id");

		const workflow = await db
			.select()
			.from(workflows)
			.where(eq(workflows.id, id))
			.limit(1);

		if (workflow.length === 0) {
			return c.json(
				{
					success: false,
					error: "Workflow not found",
				},
				404
			);
		}

		// Check ownership
		if (workflow[0].ownerId !== user.userId) {
			return c.json(
				{
					success: false,
					error: "Unauthorized",
				},
				403
			);
		}

		return c.json({
			success: true,
			data: workflow[0],
		});
	} catch (error) {
		console.error("Failed to get workflow:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to get workflow",
			},
			500
		);
	}
});

// POST /workflows - Create new workflow
workflowRoutes.post("/", async (c) => {
	try {
		const user = getAuthUser(c);
		const body = await c.req.json();

		const schema = z.object({
			name: z.string().min(1),
			description: z.string().optional(),
			definition: z.object({
				nodes: z.array(z.any()),
				edges: z.array(z.any()),
				viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
			}),
		});

		const validated = schema.parse(body);

		const result = await db
			.insert(workflows)
			.values({
				ownerId: user.userId,
				name: validated.name,
				description: validated.description || "",
				definition: validated.definition,
				status: "draft",
			})
			.returning();

		return c.json(
			{
				success: true,
				data: result[0],
			},
			201
		);
	} catch (error) {
		console.error("Failed to create workflow:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to create workflow",
			},
			400
		);
	}
});

// PUT /workflows/:id - Update workflow
workflowRoutes.put("/:id", async (c) => {
	try {
		const user = getAuthUser(c);
		const id = c.req.param("id");
		const body = await c.req.json();

		const schema = z.object({
			name: z.string().min(1).optional(),
			description: z.string().optional(),
			definition: z
				.object({
					nodes: z.array(z.any()),
					edges: z.array(z.any()),
					viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
				})
				.optional(),
			status: z.enum(["draft", "published", "archived"]).optional(),
		});

		const validated = schema.parse(body);

		// Get current workflow to check if definition changed
		const currentWorkflow = await db
			.select()
			.from(workflows)
			.where(eq(workflows.id, id))
			.limit(1);

		if (currentWorkflow.length === 0) {
			return c.json(
				{
					success: false,
					error: "Workflow not found",
				},
				404
			);
		}

		// Check ownership
		if (currentWorkflow[0].ownerId !== user.userId) {
			return c.json(
				{
					success: false,
					error: "Unauthorized",
				},
				403
			);
		}

		const updates: any = {};
		let newVersion = currentWorkflow[0].version;

		if (validated.name) updates.name = validated.name;
		if (validated.description) updates.description = validated.description;
		if (validated.definition) {
			updates.definition = validated.definition;
			// Increment version when definition changes
			newVersion = currentWorkflow[0].version + 1;
			updates.version = newVersion;

			// Create version history entry
			await db.insert(workflowVersions).values({
				workflowId: id,
				version: newVersion,
				definition: validated.definition,
				changeDescription: `Version ${newVersion}`,
			});
		}
		if (validated.status) updates.status = validated.status;

		updates.updatedAt = new Date();

		const result = await db
			.update(workflows)
			.set(updates)
			.where(eq(workflows.id, id))
			.returning();

		return c.json({
			success: true,
			data: result[0],
		});
	} catch (error) {
		console.error("Failed to update workflow:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to update workflow",
			},
			400
		);
	}
});

// DELETE /workflows/:id - Delete workflow
workflowRoutes.delete("/:id", async (c) => {
	try {
		const user = getAuthUser(c);
		const id = c.req.param("id");

		// Get workflow to check ownership
		const workflow = await db
			.select()
			.from(workflows)
			.where(eq(workflows.id, id))
			.limit(1);

		if (workflow.length === 0) {
			return c.json(
				{
					success: false,
					error: "Workflow not found",
				},
				404
			);
		}

		// Check ownership
		if (workflow[0].ownerId !== user.userId) {
			return c.json(
				{
					success: false,
					error: "Unauthorized",
				},
				403
			);
		}

		const result = await db
			.delete(workflows)
			.where(eq(workflows.id, id))
			.returning();

		return c.json({
			success: true,
			message: "Workflow deleted",
		});
	} catch (error) {
		console.error("Failed to delete workflow:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to delete workflow",
			},
			500
		);
	}
});

// GET /workflows/:workflowId/runs - List workflow runs
workflowRoutes.get("/:workflowId/runs", async (c) => {
	try {
		const workflowId = c.req.param("workflowId");

		const runs = await db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.workflowId, workflowId))
			.orderBy(desc(workflowRuns.createdAt));

		return c.json({
			success: true,
			data: runs,
		});
	} catch (error) {
		console.error("Failed to list workflow runs:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to list workflow runs",
			},
			500
		);
	}
});

// GET /workflows/:workflowId/runs/:runId - Get run details
workflowRoutes.get("/:workflowId/runs/:runId", async (c) => {
	try {
		const { workflowId, runId } = c.req.param();

		const run = await db
			.select()
			.from(workflowRuns)
			.where(eq(workflowRuns.id, runId))
			.limit(1);

		if (run.length === 0) {
			return c.json(
				{
					success: false,
					error: "Run not found",
				},
				404
			);
		}

		// Get node executions for this run
		const executions = await db
			.select()
			.from(nodeExecutions)
			.where(eq(nodeExecutions.runId, runId));

		return c.json({
			success: true,
			data: {
				run: run[0],
				executions,
			},
		});
	} catch (error) {
		console.error("Failed to get workflow run:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to get workflow run",
			},
			500
		);
	}
});

// POST /workflows/:id/run - Execute workflow
workflowRoutes.post("/:id/run", async (c) => {
	try {
		const workflowId = c.req.param("id");

		// Get workflow
		const workflow = await db
			.select()
			.from(workflows)
			.where(eq(workflows.id, workflowId))
			.limit(1);

		if (workflow.length === 0) {
			return c.json(
				{
					success: false,
					error: "Workflow not found",
				},
				404
			);
		}

		// Get workflow definition (already parsed from JSONB)
		const definition = workflow[0].definition;

		// Create workflow run record
		const runId = crypto.randomUUID();

		const runRecord = await db
			.insert(workflowRuns)
			.values({
				workflowId,
				status: "running",
				startedAt: new Date(),
			})
			.returning();

		// TODO: Integrate with WorkflowOrchestrator for actual execution
		// For now, return the run record

		return c.json(
			{
				success: true,
				data: {
					run: runRecord[0],
					message: "Workflow execution started",
				},
			},
			202
		);
	} catch (error) {
		console.error("Failed to run workflow:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to run workflow",
			},
			500
		);
	}
});

// GET /workflows/:workflowId/runs/:runId/events - Stream execution events (SSE)
workflowRoutes.get("/:workflowId/runs/:runId/events", (c) => {
	const { workflowId, runId } = c.req.param();

	return stream(c, async (writer) => {
		try {
			// Get all events for this run from database
			// In production, this would stream events in real-time as they occur
			const allEvents = await db
				.select()
				.from(workflowRuns)
				.where(eq(workflowRuns.id, runId))
				.limit(1);

			if (allEvents.length === 0) {
				await writer.writeSSE({
					data: JSON.stringify({
						success: false,
						error: "Run not found",
					}),
				});

				return;
			}

			// For now, send a simple status update
			// TODO: Stream events from WorkflowOrchestrator
			await writer.writeSSE({
				data: JSON.stringify({
					type: "status",
					data: {
						runId,
						status: "streaming",
					},
				}),
			});

			// Keep connection alive
			await new Promise((resolve) => setTimeout(resolve, 30000));

			await writer.writeSSE({
				data: JSON.stringify({
					type: "done",
					data: {
						runId,
					},
				}),
			});
		} catch (error) {
			console.error("Stream error:", error);

			await writer.writeSSE({
				data: JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : "Stream error",
				}),
			});
		}
	});
});

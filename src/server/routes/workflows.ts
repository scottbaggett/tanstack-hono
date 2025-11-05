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

import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import { getAuthUser } from "../auth/middleware";
import { db } from "../db";
import {
  executionEvents,
  nodeExecutions,
  workflowRuns,
  workflows,
  workflowVersions,
} from "../db/schema";

// ============================================================================
// ROUTE HANDLER
// ============================================================================

const workflowRoutes = new Hono();

// GET /workflows - List all workflows for current user
workflowRoutes
  .get("/", async (c) => {
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
          error:
            error instanceof Error ? error.message : "Failed to list workflows",
        },
        500,
      );
    }
  })
  .get("/:id", async (c) => {
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
          404,
        );
      }

      // Check ownership
      if (workflow[0].ownerId !== user.userId) {
        return c.json(
          {
            success: false,
            error: "Unauthorized",
          },
          403,
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
          error:
            error instanceof Error ? error.message : "Failed to get workflow",
        },
        500,
      );
    }
  })
  .post("/", async (c) => {
    try {
      const user = getAuthUser(c);
      const body = await c.req.json();

      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        definition: z.object({
          nodes: z.array(z.any()),
          edges: z.array(z.any()),
          viewport: z
            .object({ x: z.number(), y: z.number(), zoom: z.number() })
            .optional(),
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
        201,
      );
    } catch (error) {
      console.error("Failed to create workflow:", error);

      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create workflow",
        },
        400,
      );
    }
  })
  .put("/:id", async (c) => {
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
            viewport: z
              .object({ x: z.number(), y: z.number(), zoom: z.number() })
              .optional(),
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
          404,
        );
      }

      // Check ownership
      if (currentWorkflow[0].ownerId !== user.userId) {
        return c.json(
          {
            success: false,
            error: "Unauthorized",
          },
          403,
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
          error:
            error instanceof Error
              ? error.message
              : "Failed to update workflow",
        },
        400,
      );
    }
  })
  .delete("/:id", async (c) => {
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
          404,
        );
      }

      // Check ownership
      if (workflow[0].ownerId !== user.userId) {
        return c.json(
          {
            success: false,
            error: "Unauthorized",
          },
          403,
        );
      }

      await db.delete(workflows).where(eq(workflows.id, id)).returning();

      return c.json({
        success: true,
        message: "Workflow deleted",
      });
    } catch (error) {
      console.error("Failed to delete workflow:", error);

      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete workflow",
        },
        500,
      );
    }
  })
  .get("/:workflowId/runs", async (c) => {
    try {
      const workflowId = c.req.param("workflowId");

      const runs = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.workflowId, workflowId))
        .orderBy(desc(workflowRuns.startedAt));

      return c.json({
        success: true,
        data: runs,
      });
    } catch (error) {
      console.error("Failed to list workflow runs:", error);

      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to list workflow runs",
        },
        500,
      );
    }
  })
  .get("/:workflowId/runs/:runId", async (c) => {
    try {
      const { runId } = c.req.param();

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
          404,
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
          error:
            error instanceof Error
              ? error.message
              : "Failed to get workflow run",
        },
        500,
      );
    }
  })
  .post("/:id/run", async (c) => {
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
          404,
        );
      }

      // Create workflow run record
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
        202,
      );
    } catch (error) {
      console.error("Failed to run workflow:", error);

      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to run workflow",
        },
        500,
      );
    }
  })
  .get("/:workflowId/runs/:runId/logs", async (c) => {
    try {
      const { runId } = c.req.param();
      const nodeId = c.req.query("nodeId");
      const level = c.req.query("level");
      const limit = Number.parseInt(c.req.query("limit") || "1000", 10);
      const offset = Number.parseInt(c.req.query("offset") || "0", 10);

      // Build query conditions
      const conditions = [eq(executionEvents.runId, runId)];

      if (nodeId) {
        conditions.push(eq(executionEvents.nodeId, nodeId));
      }

      // Filter by log level if provided
      // For now, we'll filter by eventType or eventData.level
      // This is a simplified version - in production, you'd want more sophisticated filtering

      const events = await db
        .select()
        .from(executionEvents)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0]!)
        .orderBy(executionEvents.timestamp)
        .limit(limit)
        .offset(offset);

      // Transform events into log format
      const logs = events
        .map((event) => {
          const eventData = event.eventData as any;

          // Extract log information
          let logLevel = "info";
          let message = "";
          let source = "system";

          // Handle different event types
          if (event.eventType === "log") {
            logLevel = eventData.level || "info";
            message = eventData.message || JSON.stringify(eventData);
            source = eventData.source || "system";
          } else if (event.eventType === "workflow_start") {
            message = "Workflow run started";
            source = "system";
          } else if (event.eventType === "workflow_complete") {
            message = "Workflow run finished: Success";
            source = "system";
          } else if (event.eventType === "workflow_error") {
            logLevel = "error";
            message = `Workflow run failed: ${eventData.message || "Unknown error"}`;
            source = "system";
          } else if (event.eventType === "node_start") {
            message = `Node "${eventData.nodeName || event.nodeId || "unknown"}" started`;
            source = "system";
          } else if (event.eventType === "node_complete") {
            message = `Node "${eventData.nodeName || event.nodeId || "unknown"}" finished`;
            source = "system";
          } else if (event.eventType === "node_error") {
            logLevel = "error";
            message = `Node "${eventData.nodeName || event.nodeId || "unknown"}" failed: ${eventData.message || "Unknown error"}`;
            source = "system";
          } else {
            // Generic event
            message = eventData.message || JSON.stringify(eventData);
          }

          // Filter by level if requested
          if (level && logLevel !== level) {
            return null;
          }

          return {
            id: event.id,
            timestamp: event.timestamp.toISOString(),
            level: logLevel,
            message,
            nodeId: event.nodeId || undefined,
            source,
          };
        })
        .filter((log) => log !== null);

      return c.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          hasMore: events.length === limit,
        },
      });
    } catch (error) {
      console.error("Failed to get execution logs:", error);

      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get execution logs",
        },
        500,
      );
    }
  })
  .get("/:workflowId/runs/:runId/events", (c) => {
    const { runId } = c.req.param();

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
          await writer.write(
            `data: ${JSON.stringify({
              success: false,
              error: "Run not found",
            })}\n\n`,
          );

          return;
        }

        // For now, send a simple status update
        // TODO: Stream events from WorkflowOrchestrator
        await writer.write(
          `data: ${JSON.stringify({
            type: "status",
            data: {
              runId,
              status: "streaming",
            },
          })}\n\n`,
        );

        // Keep connection alive
        await new Promise((resolve) => setTimeout(resolve, 30000));

        await writer.write(
          `data: ${JSON.stringify({
            type: "done",
            data: {
              runId,
            },
          })}\n\n`,
        );
      } catch (error) {
        console.error("Stream error:", error);

        await writer.write(
          `data: ${JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Stream error",
          })}\n\n`,
        );
      }
    });
  });

export default workflowRoutes;

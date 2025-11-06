/**
 * Workflow Execution Routes
 *
 * Endpoints for executing workflows
 */

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db } from "@/server/db";
import { workflowRuns, workflows } from "@/server/db/schema";
import type {
  NodeStatusEvent,
  OrchestrationConfig,
} from "@/server/execution/WorkflowOrchestrator";
import { WorkflowOrchestrator } from "@/server/execution/WorkflowOrchestrator";
import "@/server/nodes/load"; // Ensure nodes are loaded

export const executeRoutes = new Hono();

/**
 * POST /execute/:id - Execute a workflow
 */
executeRoutes
  .post("/:id", async (c) => {
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
      const runStartTime = Date.now();

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
        // Validate workflow definition structure
        if (!definition.nodes || !Array.isArray(definition.nodes)) {
          throw new Error("Workflow definition must have a nodes array");
        }
        if (!definition.edges || !Array.isArray(definition.edges)) {
          throw new Error("Workflow definition must have an edges array");
        }
        if (definition.nodes.length === 0) {
          throw new Error("Workflow must have at least one node");
        }

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
            status: result.status, // Use status directly from orchestrator (now properly typed)
            outputs: result.finalOutputs as any,
            completedAt: new Date(),
            durationMs: result.totalDurationMs,
          })
          .where(eq(workflowRuns.id, runId));

        // If there were errors, include them in the response
        if (result.errors.length > 0) {
          console.error("Workflow execution completed with errors:", result.errors);
        }

        // Convert Map to Record for JSON serialization
        const nodeResults = Object.fromEntries(result.nodeResults);

        // Always return success: true so frontend can access runId
        // The actual execution status is in data.status
        return c.json({
          success: true,
          data: {
            workflowId,
            runId,
            status: result.status,
            nodeResults, // Real NodeExecutionResult structure
            outputs: result.finalOutputs,
            errors: result.errors,
            durationMs: result.totalDurationMs,
          },
        });
      } catch (error) {
        // Update workflow run with error
        const errorMessage =
          error instanceof Error ? error.message : "Execution failed";
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error("Workflow execution failed:", {
          workflowId,
          runId,
          error: errorMessage,
          stack: errorStack,
        });

        await db
          .update(workflowRuns)
          .set({
            status: "error",
            errorMessage,
            completedAt: new Date(),
          })
          .where(eq(workflowRuns.id, runId));

        // Return runId even on error so user can view execution details
        return c.json({
          success: true,
          data: {
            workflowId,
            runId,
            status: "error",
            errors: [
              {
                nodeId: undefined,
                error: error instanceof Error ? error : new Error(errorMessage),
              },
            ],
            durationMs: Date.now() - runStartTime,
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Execution failed";
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error("Workflow execution error:", {
        workflowId,
        error: errorMessage,
        stack: errorStack,
      });

      return c.json(
        {
          success: false,
          error: errorMessage,
        },
        500,
      );
    }
  })
  .get("/:id/stream", (c) => {
    const workflowId = c.req.param("id");

    // Set SSE headers
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    return stream(c, async (streamWriter) => {
      const runId = crypto.randomUUID();

      try {
        // Get workflow from database
        const workflow = await db
          .select()
          .from(workflows)
          .where(eq(workflows.id, workflowId))
          .limit(1);

        if (!workflow || workflow.length === 0) {
          await streamWriter.write(
            `data: ${JSON.stringify({ type: "error", error: "Workflow not found" })}\n\n`,
          );
          return;
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
          await streamWriter.write(
            `data: ${JSON.stringify({ type: "error", error: "Invalid workflow definition" })}\n\n`,
          );
          return;
        }

        // Create workflow run record
        await db.insert(workflowRuns).values({
          id: runId,
          workflowId: workflowId,
          status: "running",
          inputs: {},
        });

        // Send run started event
        await streamWriter.write(
          `data: ${JSON.stringify({ type: "run_started", runId, workflowId })}\n\n`,
        );

        // Create orchestration config with status callback
        const config: OrchestrationConfig = {
          workflowId,
          runId,
          definition: definition as any,
          inputs: {},
          langchainModels: new Map(),
          langchainEmbeddings: new Map(),
          langchainTools: [],
          secrets: new Map(),
          logger: console,
          onNodeStatusChange: async (event: NodeStatusEvent) => {
            // Stream node status changes to client
            await streamWriter.write(
              `data: ${JSON.stringify({ type: "node_status", ...event })}\n\n`,
            );
          },
        };

        // Execute workflow
        const orchestrator = new WorkflowOrchestrator(config);
        const result = await orchestrator.orchestrate();

        // Update workflow run status
        await db
          .update(workflowRuns)
          .set({
            status: result.status, // Use status directly from orchestrator (now properly typed)
            outputs: result.finalOutputs as any,
            completedAt: new Date(),
            durationMs: result.totalDurationMs,
          })
          .where(eq(workflowRuns.id, runId));

        // Convert Map to Record for JSON serialization
        const nodeResults = Object.fromEntries(result.nodeResults);

        // Send completion event with nodeResults for frontend caching
        await streamWriter.write(
          `data: ${JSON.stringify({
            type: "run_completed",
            runId,
            status: result.status,
            durationMs: result.totalDurationMs,
            nodeResults, // Real NodeExecutionResult structure
          })}\n\n`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Execution failed";

        console.error("Streaming execution failed:", error);

        // Update run with error
        await db
          .update(workflowRuns)
          .set({
            status: "error",
            errorMessage,
            completedAt: new Date(),
          })
          .where(eq(workflowRuns.id, runId));

        // Send error event
        await streamWriter.write(
          `data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`,
        );
      }
    });
  });

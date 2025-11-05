/**
 * Webhook Routes
 *
 * Handles incoming webhook requests and triggers workflow execution
 */

import { Hono } from "hono";
import { db } from "../db";
import { workflows } from "../db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

/**
 * Webhook endpoint - receives HTTP requests and triggers workflows
 * POST /webhook/* - Generic webhook endpoint
 * GET /webhook/* - GET webhook endpoint
 */
app.all("/webhook/*", async (c) => {
	// Get the full path after /webhook/
	const fullPath = c.req.path;
	const path = fullPath.replace(/^\/api\/webhook\//, "").replace(/^\/webhook\//, "");
	const method = c.req.method;

	try {
		// Parse request data
		let body = {};
		const contentType = c.req.header("content-type") || "";

		if (method !== "GET" && method !== "HEAD") {
			if (contentType.includes("application/json")) {
				try {
					body = await c.req.json();
				} catch {
					body = {};
				}
			} else if (contentType.includes("application/x-www-form-urlencoded")) {
				const formData = await c.req.formData();
				body = Object.fromEntries(formData.entries());
			} else {
				try {
					const text = await c.req.text();
					body = { data: text };
				} catch {
					body = {};
				}
			}
		}

		// Get query parameters
		const query = Object.fromEntries(
			new URL(c.req.url).searchParams.entries()
		);

		// Get headers (excluding sensitive ones)
		const headers: Record<string, string> = {};
		c.req.raw.headers.forEach((value, key) => {
			if (!key.toLowerCase().startsWith("authorization")) {
				headers[key] = value;
			}
		});

		// Webhook data to pass to the workflow
		const webhookData = {
			body,
			headers,
			query,
			params: { path },
			method,
			path,
			timestamp: new Date().toISOString(),
		};

		// TODO: Find workflow with matching webhook path
		// For now, just return the webhook data as a test response
		// In production, this should:
		// 1. Find the workflow that has a webhook node with this path
		// 2. Execute the workflow with the webhook data
		// 3. Return the workflow result based on response mode

		return c.json({
			success: true,
			message: "Webhook received",
			data: webhookData,
			// TODO: Add workflow execution result here
		});
	} catch (error) {
		console.error("Webhook error:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500
		);
	}
});

/**
 * List all webhook URLs for a workflow
 * GET /webhooks/:workflowId
 */
app.get("/webhooks/:workflowId", async (c) => {
	const workflowId = c.req.param("workflowId");

	try {
		// Get workflow
		const workflow = await db.query.workflows.findFirst({
			where: eq(workflows.id, workflowId),
		});

		if (!workflow) {
			return c.json({ success: false, error: "Workflow not found" }, 404);
		}

		// Parse workflow definition to find webhook nodes
		const definition =
			typeof workflow.definition === "string"
				? JSON.parse(workflow.definition)
				: workflow.definition;

		const webhookNodes = (definition.nodes || []).filter(
			(node: any) => node.data?.nodeType === "webhook"
		);

		const baseUrl = process.env.WEBHOOK_URL || "http://localhost:3000";
		const webhooks = webhookNodes.map((node: any) => {
			const path =
				node.data?.properties?.path || `${workflowId}/${node.id}`;
			const method = node.data?.properties?.httpMethod || "POST";

			return {
				nodeId: node.id,
				nodeName: node.data?.displayName || node.data?.name || "Webhook",
				method,
				path,
				url: `${baseUrl}/api/webhook/${path}`,
			};
		});

		return c.json({
			success: true,
			webhooks,
		});
	} catch (error) {
		console.error("Error getting webhooks:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500
		);
	}
});

export const webhookRoutes = app;

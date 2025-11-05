/**
 * API Router
 *
 * Main API router that combines all routes and exports RPC types
 * This enables type-safe frontend API client generation
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { workflowRoutes } from "./routes/workflows";
import { modelsRoutes } from "./routes/models";
import { nodesRoutes } from "./routes/nodes";
import { nodeExecuteRoutes } from "./routes/node-execute";
import credentialsRoutes from "./routes/credentials";
import { webhookRoutes } from "./routes/webhooks";
import { authMiddleware } from "./auth/middleware";

// ============================================================================
// API SETUP
// ============================================================================

const app = new Hono();

// CORS middleware - allow localhost on any port
app.use(
	cors({
		origin: (origin) => {
			// Allow all localhost/127.0.0.1 origins on any port
			if (!origin) return null; // Allow requests with no origin (e.g., Postman, curl)
			const url = new URL(origin);
			if (
				url.hostname === "localhost" ||
				url.hostname === "127.0.0.1" ||
				url.hostname === "0.0.0.0"
			) {
				return null;
			}
			// In development, allow all origins
			if (process.env.NODE_ENV === "development") {
				return null;
			}
			return null;
		},
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

// ============================================================================
// ROUTES
// ============================================================================

// Health check (public)
app.get("/health", (c) => {
	return c.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		environment: process.env.NODE_ENV || "development",
	});
});

// Auth routes (public)
app.route("/auth", authRoutes);

// Models routes (public)
app.route("/models", modelsRoutes);

// Nodes routes (public)
app.route("/nodes", nodesRoutes);

// Node execution routes (public)
app.route("/node-execute", nodeExecuteRoutes);

// Credential routes (public for now, will be protected later)
app.route("/credentials", credentialsRoutes);

// Webhook routes (public - receives external requests)
app.route("/", webhookRoutes);

// Test workflow route (public - for testing)
app.get("/test-workflow", (c) => {
	const nodeCount = Number(c.req.query("nodes")) || 3;
	const status = c.req.query("status") || "idle";
	const includeData = c.req.query("includeData") === "true";

	const nodes = Array.from({ length: nodeCount }, (_, i) => ({
		id: `node-${i + 1}`,
		type: ["trigger", "action", "transform"][i % 3],
		position: { x: i * 200, y: 100 },
		data: includeData
			? {
					label: `Test Node ${i + 1}`,
					config: { enabled: true },
				}
			: undefined,
	}));

	const connections = Array.from({ length: Math.max(0, nodeCount - 1) }, (_, i) => ({
		source: `node-${i + 1}`,
		target: `node-${i + 2}`,
		sourceHandle: "output",
		targetHandle: "input",
	}));

	return c.json({
		success: true,
		workflow: {
			id: "test-workflow-1",
			name: "Test Workflow",
			status,
			nodes,
			connections,
			metadata: {
				createdAt: new Date().toISOString(),
				nodeCount,
				version: "1.0.0",
			},
		},
	});
});

// Protected workflow routes
app.use("/workflows/*", authMiddleware);
app.route("/workflows", workflowRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.notFound((c) => {
	return c.json(
		{
			success: false,
			error: "Not Found",
		},
		404
	);
});

// Error handler
app.onError((err, c) => {
	console.error("Unhandled error:", err);

	return c.json(
		{
			success: false,
			error: err instanceof Error ? err.message : "Internal Server Error",
		},
		500
	);
});

// ============================================================================
// EXPORT
// ============================================================================

export type ApiRouter = typeof app;
export const apiRouter = app;

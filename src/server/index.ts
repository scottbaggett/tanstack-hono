/**
 * Hono Server
 *
 * Main entry point for the backend API server.
 * Combines:
 * - Authentication routes
 * - Workflow API routes
 * - Execution engine integration
 * - Database connection
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./auth/middleware";
import { authRoutes } from "./routes/auth";
import { executeRoutes } from "./routes/execute";
import { nodesRoutes } from "./routes/nodes";
import { webhookRoutes } from "./routes/webhooks";
import { workflowRoutes } from "./routes/workflows";
// Load nodes to ensure they are registered
import "./nodes/load";

// ============================================================================
// SERVER SETUP
// ============================================================================

const app = new Hono();

// Middleware
app.use(logger());
app.use(
	cors({
		origin: (origin) => {
			// Allow requests with no origin (e.g., Postman, curl)
			if (!origin) return true;

			// Allow ngrok URL
			if (origin === "https://c9492d523d3d.ngrok.app") return true;

			// Allow localhost on any port
			const url = new URL(origin);
			if (
				url.hostname === "localhost" ||
				url.hostname === "127.0.0.1" ||
				url.hostname === "0.0.0.0"
			) {
				return true;
			}

			// In development, allow all origins
			if (process.env.NODE_ENV === "development") {
				return true;
			}

			return false;
		},
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

// ============================================================================
// ROUTES
// ============================================================================

// Auth routes (public)
app.route("/api/auth", authRoutes);

// Public API routes
app.route("/api/nodes", nodesRoutes);
app.route("/api/execute", executeRoutes);

// Webhook routes (public - receives external requests)
app.route("/api", webhookRoutes);

// Test workflow route (public - for testing with n8n)
app.get("/api/test-workflow", (c) => {
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

	const connections = Array.from(
		{ length: Math.max(0, nodeCount - 1) },
		(_, i) => ({
			source: `node-${i + 1}`,
			target: `node-${i + 2}`,
			sourceHandle: "output",
			targetHandle: "input",
		}),
	);

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

// Protected routes
app.use("/api/workflows/*", authMiddleware);
app.route("/api/workflows", workflowRoutes);

// Health check
app.get("/health", (c) => {
	return c.json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});

// 404 handler
app.notFound((c) => {
	return c.json(
		{
			success: false,
			error: "Not Found",
		},
		404,
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
		500,
	);
});

// ============================================================================
// EXPORT
// ============================================================================

export default app;

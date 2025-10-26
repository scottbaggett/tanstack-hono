/**
 * Hono Server
 *
 * Main entry point for the backend API server.
 * Combines:
 * - Workflow API routes
 * - Execution engine integration
 * - Database connection
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { workflowRoutes } from "./routes/workflows";

// ============================================================================
// SERVER SETUP
// ============================================================================

const app = new Hono();

// Middleware
app.use(logger());
app.use(
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	})
);

// ============================================================================
// ROUTES
// ============================================================================

// API routes
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

export default app;

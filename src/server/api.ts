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
import { authMiddleware } from "./auth/middleware";

// ============================================================================
// API SETUP
// ============================================================================

const app = new Hono();

// CORS middleware
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

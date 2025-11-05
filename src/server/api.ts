/**
 * API Router
 *
 * Main API router that combines all routes and exports RPC types
 * This enables type-safe frontend API client generation
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./auth/middleware";
import authRoutes from "./routes/auth";
import credentialsRoutes from "./routes/credentials";
import modelsRoutes from "./routes/models";
import nodeExecuteRoutes from "./routes/node-execute";
import nodesRoutes from "./routes/nodes";
import webhookRoutes from "./routes/webhooks";
import workflowRoutes from "./routes/workflows";

// ============================================================================
// API SETUP
// ============================================================================

const app = new Hono();

// ============================================================================
// ROUTES
// ============================================================================

// Chain all routes together for proper RPC type inference
// According to Hono RPC docs, all routes must be chained in a single expression
// and the type must be exported as `typeof routes` for proper inference
const routes = app;

// CORS middleware - allow localhost on any port
app
	.use(
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
		}),
	)
	.route("/models", modelsRoutes)
	.route("/nodes", nodesRoutes)
	.route("/execute/node", nodeExecuteRoutes)
	.route("/credentials", credentialsRoutes)
	.route("/webhooks", webhookRoutes)
	.use("/workflows/*", authMiddleware)
	.route("/workflows", workflowRoutes)
	.get("/test-workflow", (c) => {
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
	})
	.notFound((c) => {
		return c.json(
			{
				success: false,
				error: "Not Found",
			},
			404,
		);
	})
	.onError((err, c) => {
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

// Export the chained routes for runtime use
export const apiRouter = routes;

// Export the type for RPC client type inference
// Using typeof on the chained routes ensures all route types are properly inferred
// This pattern ensures TypeScript computes all route types together
export type ApiRouter = typeof routes;

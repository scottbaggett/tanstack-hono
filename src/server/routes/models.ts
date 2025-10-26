/**
 * Models API Routes
 *
 * Endpoints for accessing the model registry
 */

import { Hono } from "hono";
import { MODEL_REGISTRY } from "../models/registry";

export const modelsRoutes = new Hono();

/**
 * GET /models - Get all available models and their configurations
 */
modelsRoutes.get("/", (c) => {
	return c.json({
		success: true,
		data: {
			models: MODEL_REGISTRY,
			total: Object.keys(MODEL_REGISTRY).length,
		},
	});
});

/**
 * GET /models/:id - Get a specific model configuration
 */
modelsRoutes.get("/:id", (c) => {
	const id = c.req.param("id");
	const model = MODEL_REGISTRY[id];

	if (!model) {
		return c.json(
			{
				success: false,
				error: `Model "${id}" not found`,
			},
			404
		);
	}

	return c.json({
		success: true,
		data: {
			id,
			config: model,
		},
	});
});

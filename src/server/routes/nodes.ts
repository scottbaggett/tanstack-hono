/**
 * Nodes API Routes
 *
 * Endpoints for accessing available node definitions
 */

import { Hono } from "hono";
import { nodeRegistry } from "../nodes/registry";
// Load all nodes to ensure they are registered
import "../nodes/load";

export const nodesRoutes = new Hono();

/**
 * GET /nodes - Get all available node definitions
 */
nodesRoutes.get("/", (c) => {
	const nodes = nodeRegistry.getAllDefinitions();

	const nodeDefinitions = nodes.map((node) => {
		// Handle dynamic inputs - if it's a function, call it with empty context
		let inputs = [];
		if (typeof node.inputs === 'function') {
			inputs = node.inputs({ nodeId: 'preview', properties: {}, connectedInputs: {} });
		} else if (Array.isArray(node.inputs)) {
			inputs = node.inputs;
		}

		return {
			id: node.name,
			name: node.name,
			displayName: node.displayName,
			description: node.description,
			category: node.category,
			icon: node.icon,
			color: node.iconColor,
			version: node.version,
			inputs,
			outputs: node.outputs || [],
			properties: node.properties || [],
			codex: node.codex,
		};
	});

	// Group by category
	const byCategory = nodeDefinitions.reduce(
		(acc, node) => {
			if (!acc[node.category]) {
				acc[node.category] = [];
			}
			acc[node.category].push(node);
			return acc;
		},
		{} as Record<string, typeof nodeDefinitions>
	);

	return c.json({
		success: true,
		data: {
			nodes: nodeDefinitions,
			byCategory,
			total: nodeDefinitions.length,
		},
	});
});

/**
 * GET /nodes/:id - Get a specific node definition
 */
nodesRoutes.get("/:id", (c) => {
	const nodeId = c.req.param("id");
	const node = nodeRegistry.getDefinition(nodeId);

	if (!node) {
		return c.json(
			{
				success: false,
				error: `Node "${nodeId}" not found`,
			},
			404
		);
	}

	// Handle dynamic inputs
	let inputs = [];
	if (typeof node.inputs === 'function') {
		inputs = node.inputs({ nodeId: 'preview', properties: {}, connectedInputs: {} });
	} else if (Array.isArray(node.inputs)) {
		inputs = node.inputs;
	}

	return c.json({
		success: true,
		data: {
			id: node.name,
			name: node.name,
			displayName: node.displayName,
			description: node.description,
			category: node.category,
			icon: node.icon,
			color: node.iconColor,
			version: node.version,
			inputs,
			outputs: node.outputs || [],
			properties: node.properties || [],
			codex: node.codex,
		},
	});
});

/**
 * GET /nodes/category/:category - Get nodes in a specific category
 */
nodesRoutes.get("/category/:category", (c) => {
	const category = c.req.param("category");
	const nodes = nodeRegistry.getDefinitionsByCategory(category);

	const filtered = nodes.map((node) => ({
		id: node.type,
		displayName: node.displayName,
		description: node.description,
		category: node.category,
		icon: node.icon,
		color: node.color,
	}));

	return c.json({
		success: true,
		data: {
			category,
			nodes: filtered,
			total: filtered.length,
		},
	});
});

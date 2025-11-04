/**
 * Workflow Execution Routes
 *
 * Endpoints for executing workflows
 */

import { Hono } from 'hono';
import { db } from '@/server/db';
import { workflows } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { executeWorkflow, getWorkflowOutput } from '@/server/execution/engine';

export const executeRoutes = new Hono();

/**
 * POST /execute/:id - Execute a workflow
 */
executeRoutes.post('/:id', async (c) => {
	const workflowId = c.req.param('id');
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
					error: 'Workflow not found',
				},
				404,
			);
		}

		const workflowDef = workflow[0];

		// Parse workflow definition
		let definition;
		try {
			definition =
				typeof workflowDef.definition === 'string'
					? JSON.parse(workflowDef.definition)
					: workflowDef.definition;
		} catch (error) {
			return c.json(
				{
					success: false,
					error: 'Invalid workflow definition',
				},
				400,
			);
		}

		// Create abort signal for this execution (5 minute timeout)
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

		try {
			// Execute workflow
			const result = await executeWorkflow(definition, body.inputs, controller.signal);

			// Get final output
			const output = getWorkflowOutput(result.results, result.executedNodes);

			return c.json({
				success: result.success,
				data: {
					workflowId,
					status: result.success ? 'completed' : 'failed',
					executedNodes: result.executedNodes,
					output,
					results: result.results,
					error: result.error,
				},
			});
		} finally {
			clearTimeout(timeoutId);
		}
	} catch (error) {
		console.error('Workflow execution error:', error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Execution failed',
			},
			500,
		);
	}
});

/**
 * POST /execute/:id/stream - Execute workflow with streaming
 * (Placeholder for future streaming implementation)
 */
executeRoutes.post('/:id/stream', async (c) => {
	return c.json(
		{
			success: false,
			error: 'Streaming execution not yet implemented',
		},
		501,
	);
});

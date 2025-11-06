/**
 * Stage Calculation Algorithm
 *
 * Calculates execution stages for workflow nodes based on their dependencies.
 * Uses topological sort to assign stages based on the workflow's dependency graph.
 *
 * Stage Definition:
 * - A stage represents a group of nodes that executed at the same logical point
 * - Stages are determined by execution order and dependencies
 * - Stage 1 contains entry nodes (nodes with no dependencies)
 * - Each subsequent stage contains nodes whose all dependencies are in previous stages
 */

import type { IWorkflowDefinition, IWorkflowEdge } from "@/types/interfaces";
import type { NodeExecution } from "../db/schema";

/**
 * Node execution with calculated stage information
 */
export interface NodeExecutionWithStage extends NodeExecution {
	stage: number;
}

/**
 * Dependency graph: maps nodeId to array of dependent nodes (nodes that depend on it)
 */
type DependencyGraph = Map<string, string[]>;

/**
 * Reverse dependency graph: maps nodeId to array of dependencies (nodes it depends on)
 */
type ReverseDependencyGraph = Map<string, string[]>;

/**
 * Build dependency graph from workflow edges
 * Returns both forward and reverse graphs for efficient lookups
 */
function buildDependencyGraph(edges: IWorkflowEdge[]): {
	dependents: DependencyGraph;
	dependencies: ReverseDependencyGraph;
} {
	const dependents = new Map<string, string[]>();
	const dependencies = new Map<string, string[]>();

	for (const edge of edges) {
		const { source, target } = edge;

		// Forward graph: source -> [targets that depend on it]
		if (!dependents.has(source)) {
			dependents.set(source, []);
		}
		dependents.get(source)!.push(target);

		// Reverse graph: target -> [sources it depends on]
		if (!dependencies.has(target)) {
			dependencies.set(target, []);
		}
		dependencies.get(target)!.push(source);
	}

	return { dependents, dependencies };
}

/**
 * Find entry nodes (nodes with no incoming dependencies)
 */
function findEntryNodes(
	nodeIds: string[],
	dependencies: ReverseDependencyGraph,
): string[] {
	return nodeIds.filter((nodeId) => {
		const deps = dependencies.get(nodeId);
		return !deps || deps.length === 0;
	});
}

/**
 * Find nodes that can execute in the next stage
 * A node can execute when all its dependencies are in previous stages (< currentStage)
 */
function findNodesWithDependenciesInStages(
	nodeIds: string[],
	dependencies: ReverseDependencyGraph,
	stages: Map<string, number>,
	currentStage: number,
): string[] {
	return nodeIds.filter((nodeId) => {
		// Skip nodes that already have a stage assigned
		if (stages.has(nodeId)) {
			return false;
		}

		const deps = dependencies.get(nodeId);

		// If no dependencies, it should have been caught in stage 1
		if (!deps || deps.length === 0) {
			return false;
		}

		// Check if all dependencies are in stages < currentStage
		return deps.every((depNodeId) => {
			const depStage = stages.get(depNodeId);
			return depStage !== undefined && depStage < currentStage;
		});
	});
}

/**
 * Calculate stages for all nodes using topological sort
 *
 * Algorithm:
 * 1. Build dependency graph from workflow edges
 * 2. Stage 1: All nodes with no dependencies (entry nodes)
 * 3. Stage N: Nodes whose all dependencies are in stages < N
 * 4. Continue until all nodes are assigned
 */
export function calculateStages(
	workflowDefinition: IWorkflowDefinition,
	nodeExecutions: NodeExecution[],
): NodeExecutionWithStage[] {
	// Build dependency graphs
	const { dependencies } = buildDependencyGraph(
		workflowDefinition.edges,
	);

	// Get all node IDs from executions
	const nodeIds = nodeExecutions.map((exec) => exec.nodeId);

	// Find entry nodes (Stage 1)
	const entryNodes = findEntryNodes(nodeIds, dependencies);

	// Map to track stage assignments
	const stages = new Map<string, number>();

	// Assign Stage 1 to entry nodes
	let currentStage = 1;
	let nodesInStage = entryNodes;

	while (nodesInStage.length > 0) {
		// Assign current stage to all nodes in this batch
		for (const nodeId of nodesInStage) {
			stages.set(nodeId, currentStage);
		}

		// Find nodes that can execute next (all dependencies in previous stages)
		const nextNodes = findNodesWithDependenciesInStages(
			nodeIds,
			dependencies,
			stages,
			currentStage + 1,
		);

		nodesInStage = nextNodes;
		currentStage++;
	}

	// Handle orphaned nodes (nodes with no connections)
	// These should also be in Stage 1
	for (const nodeId of nodeIds) {
		if (!stages.has(nodeId)) {
			stages.set(nodeId, 1);
		}
	}

	// Enhance node executions with stage information
	return nodeExecutions.map((execution) => ({
		...execution,
		stage: stages.get(execution.nodeId) || 1,
	}));
}

/**
 * Sort node executions by stage, then by startedAt timestamp
 */
export function sortNodeExecutionsByStage(
	executions: NodeExecutionWithStage[],
): NodeExecutionWithStage[] {
	return [...executions].sort((a, b) => {
		// First sort by stage
		if (a.stage !== b.stage) {
			return a.stage - b.stage;
		}

		// Then sort by startedAt timestamp (if available)
		if (a.startedAt && b.startedAt) {
			return a.startedAt.getTime() - b.startedAt.getTime();
		}

		// If one has startedAt and the other doesn't, prioritize the one with startedAt
		if (a.startedAt) return -1;
		if (b.startedAt) return 1;

		// If neither has startedAt, maintain original order
		return 0;
	});
}

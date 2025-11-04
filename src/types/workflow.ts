/**
 * Core workflow types
 *
 * Inspired by N8N's workflow architecture, these types define:
 * - Workflows: Collections of connected nodes
 * - Nodes: Individual processing units with inputs/outputs
 * - Connections: Edges between nodes that pass data
 * - Runs & Executions: Instances of workflow execution
 */

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

/**
 * Viewport state for the workflow canvas
 */
export interface WorkflowViewport {
	x: number;
	y: number;
	zoom: number;
}

/**
 * A complete workflow definition
 *
 * @deprecated Use IWorkflowDefinition from interfaces.ts instead.
 * This legacy type uses Record<string, WorkflowNode> for nodes, while the
 * canonical type uses IWorkflowNode[] for better type safety.
 * Will be removed in Phase 2 cleanup.
 */
export interface WorkflowDefinition {
	nodes: Record<string, WorkflowNode>;
	edges: WorkflowEdge[];
	viewport: WorkflowViewport;
	metadata?: {
		name: string;
		description?: string;
		version?: string;
		tags?: string[];
	};
}

// ============================================================================
// NODES
// ============================================================================

/**
 * Handle position on a node (input/output points)
 */
export interface NodeHandle {
	id: string;
	label: string;
	type: "input" | "output";
	required?: boolean;
	dataType?: string; // e.g., "string", "number", "object", "any"
}

/**
 * A node instance in the workflow
 */
export interface WorkflowNode {
	id: string;
	type: string; // e.g., "text-input", "llm", "output"
	position: { x: number; y: number };
	data: {
		nodeType: string;
		label: string;
		description?: string;
		// Configuration/parameters specific to this node
		nodeInputs: Record<string, unknown>;
		// Input/output handles
		handles?: NodeHandle[];
		icon?: string;
	};
}

/**
 * An edge/connection between two nodes
 */
export interface WorkflowEdge {
	id: string;
	source: string; // Node ID
	target: string; // Node ID
	sourceHandle?: string; // Handle ID
	targetHandle?: string; // Handle ID
	animated?: boolean;
	label?: string;
}

// ============================================================================
// NODE TYPES & REGISTRY
// ============================================================================

/**
 * Input/output specification for a node
 */
export interface NodeIOSpec {
	name: string;
	description?: string;
	type: string; // JSON Schema type
	required?: boolean;
	default?: unknown;
	schema?: Record<string, unknown>; // Full JSON schema
}

/**
 * Complete node type definition (registered in the system)
 */
export interface NodeTypeDefinition {
	type: string;
	displayName: string;
	category: "input" | "processing" | "output" | "integration" | "control";
	description: string;
	icon?: string;
	color?: string;

	// Input and output specifications
	inputs: NodeIOSpec[];
	outputs: NodeIOSpec[];

	// Configuration options
	properties?: Record<string, unknown>; // JSON Schema
	required?: string[];

	// Execution method
	execute: (inputs: Record<string, unknown>, context: NodeExecutionContext) => Promise<Record<string, unknown>>;

	// Optional: validation
	validate?: (inputs: Record<string, unknown>) => { valid: boolean; errors?: string[] };

	// Optional: UI hints
	uiHints?: {
		hideNodeDetails?: boolean;
		hideInputs?: string[];
		hideOutputs?: string[];
	};
}

/**
 * Context provided during node execution
 *
 * @deprecated This legacy context is too simple for modern execution needs.
 * For agent nodes, use IExecutionContext from interfaces.ts.
 * For regular nodes, use IExecuteFunctions from execution.ts.
 * Will be removed in Phase 2 cleanup.
 */
export interface NodeExecutionContext {
	nodeId: string;
	workflowRunId: string;
	state: Record<string, unknown>; // Outputs from previous nodes
	logger: Logger;
}

/**
 * Simple logger interface
 */
export interface Logger {
	info: (message: string, data?: unknown) => void;
	warn: (message: string, data?: unknown) => void;
	error: (message: string, data?: unknown) => void;
	debug: (message: string, data?: unknown) => void;
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

/**
 * Status of a workflow run
 */
export type WorkflowRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Status of a node execution
 */
export type NodeExecutionStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/**
 * A workflow execution instance
 */
export interface WorkflowExecution {
	id: string;
	workflowId: string;
	status: WorkflowRunStatus;
	startedAt: Date;
	completedAt?: Date;
	inputs?: Record<string, unknown>;
	outputs?: Record<string, unknown>;
	errorMessage?: string;
	totalTokensUsed?: number;
}

/**
 * Individual node execution within a workflow run
 */
export interface NodeExecutionRecord {
	id: string;
	runId: string;
	nodeId: string;
	nodeType: string;
	status: NodeExecutionStatus;
	inputs?: Record<string, unknown>;
	outputs?: Record<string, unknown>;
	startedAt?: Date;
	completedAt?: Date;
	tokensUsed?: number;
	errorMessage?: string;
}

/**
 * Event emitted during workflow execution
 */
export interface ExecutionEvent {
	id: string;
	runId: string;
	timestamp: Date;
	eventType: ExecutionEventType;
	nodeId?: string;
	data: Record<string, unknown>;
}

/**
 * Types of events that can be emitted
 */
export type ExecutionEventType =
	| "workflow_start"
	| "workflow_complete"
	| "workflow_error"
	| "node_start"
	| "node_progress"
	| "node_complete"
	| "node_error"
	| "node_stream" // For streaming/partial results
	| "log"
	| "metric";

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Error thrown during workflow execution
 */
export class WorkflowError extends Error {
	constructor(
		message: string,
		public code: string,
		public nodeId?: string,
		public details?: unknown
	) {
		super(message);
		this.name = "WorkflowError";
	}
}

/**
 * Error thrown during node execution
 */
export class NodeError extends WorkflowError {
	constructor(message: string, nodeId: string, details?: unknown) {
		super(message, "NODE_ERROR", nodeId, details);
		this.name = "NodeError";
	}
}

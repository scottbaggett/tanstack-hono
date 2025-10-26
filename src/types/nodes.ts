/**
 * Node Type Definitions
 *
 * Defines all available node types and their configurations
 */

export type NodeInputType = "string" | "number" | "boolean" | "json" | "any";
export type NodeOutputType = "string" | "number" | "boolean" | "json" | "any";

export interface NodeInput {
	id: string;
	label: string;
	type: NodeInputType;
	required?: boolean;
	default?: unknown;
	description?: string;
}

export interface NodeOutput {
	id: string;
	label: string;
	type: NodeOutputType;
	description?: string;
}

export interface NodeCategory {
	id: string;
	label: string;
	description?: string;
	icon?: string;
	color?: string;
}

export interface NodeDefinition {
	// Unique identifier for the node type
	id: string;
	// Display name
	label: string;
	// Category for grouping in UI
	category: string;
	// Node icon (lucide-react icon name)
	icon: string;
	// Node description
	description: string;
	// Input ports
	inputs: NodeInput[];
	// Output ports
	outputs: NodeOutput[];
	// Default node configuration
	config?: Record<string, unknown>;
	// Node execution mode: execute (default), webhook, poll
	mode?: "execute" | "webhook" | "poll";
	// Whether node can be deleted
	isDeletable?: boolean;
	// Maximum instances allowed (-1 = unlimited)
	maxInstances?: number;
}

export interface CanvasNode {
	id: string;
	type: string; // References NodeDefinition.id
	label?: string;
	position: { x: number; y: number };
	data: {
		label: string;
		inputs?: Record<string, unknown>;
		config?: Record<string, unknown>;
	};
}

export interface CanvasEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
	data?: Record<string, unknown>;
}

export interface WorkflowDefinition {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	viewport?: {
		x: number;
		y: number;
		zoom: number;
	};
}

/**
 * Global Node System Interfaces
 *
 * Core types for the versioned node system with async streaming support
 * Inspired by N8N's node architecture
 */

// ============================================================================
// CONNECTION TYPES
// ============================================================================

export type ConnectionType =
	| 'main' // Standard data flow
	| 'ai_languageModel' // LLM/Chat model
	| 'ai_tool' // Tool/function
	| 'ai_memory' // Memory/context
	| 'ai_outputParser' // Output formatter
	| 'data'; // Generic data

// ============================================================================
// NODE PORTS (INPUTS/OUTPUTS)
// ============================================================================

export interface NodePort {
	id: string;
	displayName: string;
	type: ConnectionType;
	required?: boolean;
	maxConnections?: number; // 1 = single, undefined = multiple
	filter?: {
		excludedNodes?: string[];
		allowedTypes?: ConnectionType[];
	};
	description?: string;
}

// ============================================================================
// DYNAMIC INPUTS
// ============================================================================

export interface DynamicInputContext {
	nodeId: string;
	properties: Record<string, unknown>; // Current property values
	connectedInputs?: Record<string, boolean>; // Which inputs are connected
}

export type DynamicInputs = (context: DynamicInputContext) => NodePort[];

// ============================================================================
// NODE TYPE DESCRIPTION
// ============================================================================

export interface INodeTypeBaseDescription {
	displayName: string; // e.g., "AI Agent"
	name: string; // e.g., "agent" - used in type field
	icon: string; // lucide-react icon name
	iconColor?: string;
	category: string; // e.g., "AI", "Data", "Tools"
	description: string;
	codex?: {
		alias: string[];
		categories: string[];
		subcategories?: Record<string, string[]>;
		resources?: any;
	};
}

export interface NodeProperty {
	displayName: string;
	name: string;
	type: 'string' | 'number' | 'boolean' | 'json' | 'select' | 'notice' | 'callout';
	default: unknown;
	description?: string;
	options?: Array<{ name: string; value: unknown }>;
	noDataExpression?: boolean;
	displayOptions?: {
		show?: Record<string, unknown[]>;
	};
}

export interface INodeTypeDescription extends INodeTypeBaseDescription {
	version: number; // Current version (e.g., 1)
	defaults: {
		name: string;
		color: string;
	};
	inputs: NodePort[] | DynamicInputs; // Can be static or dynamic
	outputs: NodePort[];
	properties: NodeProperty[];
	hints?: Array<{
		message: string;
		type: 'warning' | 'info';
		location: string;
		whenToDisplay: string;
		displayCondition?: string;
	}>;
}

// ============================================================================
// NODE EXECUTION
// ============================================================================

export interface ExecutionContext {
	nodeId: string;
	nodeType: string;
	version: number;
	inputs: Record<string, any>; // Values from connected inputs
	properties: Record<string, unknown>; // Raw property values (may contain CEL expressions)
	evaluatedProperties: Record<string, any>; // Properties with CEL expressions evaluated
	previousData?: any[];
	signal?: AbortSignal; // For cancellation
}

export interface NodeExecutionData {
	json?: Record<string, any>; // Main output data
	binary?: Record<string, Buffer>; // Binary data
	pairedItem?: number | number[]; // Link to input item
}

// ============================================================================
// NODE TYPE IMPLEMENTATION
// ============================================================================

export interface INodeType {
	description: INodeTypeDescription;
	execute(
		context: ExecutionContext,
	): Promise<NodeExecutionData[][]> | NodeExecutionData[][];
}

// ============================================================================
// WORKFLOW NODE (INSTANCE IN CANVAS)
// ============================================================================

export interface WorkflowNode {
	id: string;
	type: string; // References node type name (e.g., "agent")
	version: number; // Node version (e.g., 1)
	position: {
		x: number;
		y: number;
	};
	data: {
		label?: string; // Custom label
		inputs?: Record<string, any>; // Values from connected nodes
		properties?: Record<string, unknown>; // Configuration values
	};
}

export interface WorkflowEdge {
	id: string;
	source: string; // Source node ID
	target: string; // Target node ID
	sourceHandle?: string; // Output port ID
	targetHandle?: string; // Input port ID
	data?: Record<string, unknown>;
}

export interface WorkflowDefinition {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	viewport?: {
		x: number;
		y: number;
		zoom: number;
	};
}

// ============================================================================
// NODE REGISTRY
// ============================================================================

export interface INodeRegistry {
	// Register a node type
	register(nodeType: INodeType, description: INodeTypeBaseDescription): void;

	// Get all node definitions
	getAllDefinitions(): INodeTypeDescription[];

	// Get definition by name
	getDefinition(name: string): INodeTypeDescription | undefined;

	// Get definitions by category
	getDefinitionsByCategory(category: string): INodeTypeDescription[];

	// Get node implementation
	getNodeType(name: string): INodeType | undefined;
}

/**
 * Base Node class and Node Registry
 *
 * Provides the foundation for all node types with strict typing and validation.
 * Inspired by N8N's node architecture.
 */

import type {
	Logger,
	NodeExecutionContext,
	NodeIOSpec,
	NodeTypeDefinition,
} from "../../types/workflow";
import { NodeError } from "../../types/workflow";

// ============================================================================
// BASE NODE CLASS
// ============================================================================

/**
 * Abstract base class for all node types
 * Provides common functionality and enforces contract
 */
export abstract class BaseNode<
	TInputs = Record<string, unknown>,
	TOutputs = Record<string, unknown>,
> {
	protected logger: Logger;

	constructor(
		public nodeId: string,
		protected context: NodeExecutionContext,
	) {
		this.logger = context.logger;
	}

	/**
	 * Execute the node with type-safe inputs
	 */
	abstract execute(inputs: TInputs): Promise<TOutputs>;

	/**
	 * Validate inputs before execution
	 */
	protected validateInputs(inputs: unknown): inputs is TInputs {
		return true; // Override in subclasses for custom validation
	}

	/**
	 * Get a value from the execution state (outputs from previous nodes)
	 */
	protected getStateValue(path: string): unknown {
		const parts = path.split(".");
		let current: unknown = this.context.state;

		for (const part of parts) {
			if (typeof current === "object" && current !== null && part in current) {
				current = (current as Record<string, unknown>)[part];
			} else {
				return undefined;
			}
		}

		return current;
	}

	/**
	 * Log a message at info level
	 */
	protected log(message: string, data?: unknown): void {
		this.logger.info(`[${this.nodeId}] ${message}`, data);
	}

	/**
	 * Log a warning
	 */
	protected warn(message: string, data?: unknown): void {
		this.logger.warn(`[${this.nodeId}] ${message}`, data);
	}

	/**
	 * Log an error and throw
	 */
	protected error(message: string, details?: unknown): never {
		this.logger.error(`[${this.nodeId}] ${message}`, details);
		throw new NodeError(message, this.nodeId, details);
	}
}

// ============================================================================
// NODE REGISTRY
// ============================================================================

type NodeConstructor = new (
	nodeId: string,
	context: NodeExecutionContext,
) => BaseNode;

/**
 * Global registry of all available node types
 */
export class NodeRegistry {
	private nodes = new Map<
		string,
		{ definition: NodeTypeDefinition; constructor: NodeConstructor }
	>();

	/**
	 * Register a new node type
	 */
	register(
		definition: NodeTypeDefinition,
		_nodeConstructor: NodeConstructor,
	): void {
		if (this.nodes.has(definition.type)) {
			throw new Error(`Node type "${definition.type}" is already registered`);
		}

		// Validate definition
		this.validateDefinition(definition);

		this.nodes.set(definition.type, { definition, constructor });
	}

	/**
	 * Get a node definition by type
	 */
	getDefinition(nodeType: string): NodeTypeDefinition | undefined {
		return this.nodes.get(nodeType)?.definition;
	}

	/**
	 * Get all node definitions
	 */
	getAllDefinitions(): NodeTypeDefinition[] {
		return Array.from(this.nodes.values()).map((item) => item.definition);
	}

	/**
	 * Get definitions by category
	 */
	getDefinitionsByCategory(category: string): NodeTypeDefinition[] {
		return this.getAllDefinitions().filter((def) => def.category === category);
	}

	/**
	 * Create an instance of a node
	 */
	createNode(
		nodeType: string,
		nodeId: string,
		context: NodeExecutionContext,
	): BaseNode {
		const item = this.nodes.get(nodeType);
		if (!item) {
			throw new Error(`Unknown node type: "${nodeType}"`);
		}
		return new item.constructor(nodeId, context);
	}

	/**
	 * Check if a node type is registered
	 */
	has(nodeType: string): boolean {
		return this.nodes.has(nodeType);
	}

	/**
	 * Get all registered node types
	 */
	getNodeTypes(): string[] {
		return Array.from(this.nodes.keys());
	}

	/**
	 * Validate a node definition
	 */
	private validateDefinition(definition: NodeTypeDefinition): void {
		if (!definition.type) {
			throw new Error("Node definition must have a type");
		}
		if (!definition.displayName) {
			throw new Error("Node definition must have a displayName");
		}
		if (!definition.category) {
			throw new Error("Node definition must have a category");
		}
		if (!Array.isArray(definition.inputs)) {
			throw new Error("Node definition inputs must be an array");
		}
		if (!Array.isArray(definition.outputs)) {
			throw new Error("Node definition outputs must be an array");
		}
		if (typeof definition.execute !== "function") {
			throw new Error("Node definition must have an execute function");
		}
	}
}

/**
 * Global registry instance
 */
export const nodeRegistry = new NodeRegistry();

// ============================================================================
// BUILDER HELPER FOR REGISTERING NODES
// ============================================================================

/**
 * Helper class to build and register a node with fluent API
 */
export class NodeBuilder {
	private definition: Partial<NodeTypeDefinition> = {
		inputs: [],
		outputs: [],
	};

	constructor(type: string) {
		this.definition.type = type;
	}

	displayName(name: string): this {
		this.definition.displayName = name;
		return this;
	}

	category(
		cat: "input" | "processing" | "output" | "integration" | "control",
	): this {
		this.definition.category = cat;
		return this;
	}

	description(desc: string): this {
		this.definition.description = desc;
		return this;
	}

	icon(icon: string): this {
		this.definition.icon = icon;
		return this;
	}

	input(spec: NodeIOSpec): this {
		if (!this.definition.inputs) {
			this.definition.inputs = [];
		}
		this.definition.inputs.push(spec);
		return this;
	}

	output(spec: NodeIOSpec): this {
		if (!this.definition.outputs) {
			this.definition.outputs = [];
		}
		this.definition.outputs.push(spec);
		return this;
	}

	execute(
		fn: (
			inputs: Record<string, unknown>,
			context: NodeExecutionContext,
		) => Promise<Record<string, unknown>>,
	): this {
		this.definition.execute = fn;
		return this;
	}

	build(): NodeTypeDefinition {
		if (!this.definition.type) {
			throw new Error("Node type is required");
		}
		if (!this.definition.displayName) {
			throw new Error("Display name is required");
		}
		if (!this.definition.category) {
			throw new Error("Category is required");
		}
		if (!this.definition.description) {
			this.definition.description = "";
		}
		if (!this.definition.execute) {
			throw new Error("Execute function is required");
		}

		return this.definition as NodeTypeDefinition;
	}

	register(nodeConstructor: NodeConstructor): void {
		const definition = this.build();
		nodeRegistry.register(definition, nodeConstructor);
	}
}

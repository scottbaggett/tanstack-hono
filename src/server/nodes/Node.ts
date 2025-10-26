/**
 * Node Base Class
 *
 * Matches N8N's Node pattern:
 * - Abstract class with description
 * - Optional execute, webhook, poll methods
 * - Version support for backwards compatibility
 * - Extensible node type description
 */

import type {
	IExecuteFunctions,
	IWebhookFunctions,
	IPollFunctions,
	IWebhookResponseData,
	INodeExecutionData,
} from "../../types/execution";
import type { DataTypeId } from "../../types/datatypes";

// ============================================================================
// NODE TYPE DESCRIPTION
// ============================================================================

/**
 * Describes a node's metadata, inputs, outputs, and properties
 * Extensible to support future features
 */
export interface INodeTypeDescription {
	// === Identity ===
	displayName: string;
	name: string; // Unique identifier
	description?: string;
	version: number;
	category?: string;
	icon?: string;
	color?: string;

	// === Documentation ===
	documentation?: {
		url?: string;
		description?: string;
		examples?: Array<{
			title: string;
			description?: string;
			image?: string;
		}>;
	};

	// === Input/Output Handles ===
	// Inputs: data types that this node accepts
	inputs?: Array<{
		displayName: string;
		name: string;
		// Data type: "string", "number", "float", "csv", "pdb", "image:png", etc
		// Can also be "any" to accept any type
		type: DataTypeId | "any";
		required?: boolean;
		description?: string;
	}>;

	// Outputs: data types that this node produces
	outputs?: Array<{
		displayName: string;
		name: string;
		// Data type this output handle produces
		type: DataTypeId | "any";
		description?: string;
	}>;

	// === Properties/Parameters ===
	properties?: Array<{
		displayName: string;
		name: string;
		type: "string" | "number" | "boolean" | "options" | "credentials" | "json";
		description?: string;
		required?: boolean;
		default?: unknown;
		options?: Array<{ name: string; value: unknown }>;
		placeholder?: string;
		hint?: string;
	}>;

	// === Capabilities ===
	credentials?: Array<{
		name: string;
		required?: boolean;
	}>;

	// === Advanced ===
	subtitle?: string;
	defaults?: {
		name?: string;
		[key: string]: unknown;
	};

	// Extensibility
	[key: string]: unknown;
}

/**
 * Versioned node type with multiple implementations
 */
export interface IVersionedNodeType {
	nodeVersions: {
		[version: number]: INodeType;
	};
	currentVersion: number;
	description: INodeTypeDescription;
	getNodeType(version?: number): INodeType;
}

// ============================================================================
// NODE INTERFACE
// ============================================================================

/**
 * Interface that all node implementations must satisfy
 */
export interface INodeType {
	description: INodeTypeDescription;

	/**
	 * Execute the node with normal inputs/outputs
	 * Optional - only implement if node performs regular execution
	 */
	execute?(context: IExecuteFunctions): Promise<INodeExecutionData[][] | void>;

	/**
	 * Handle incoming webhooks
	 * Optional - only implement if node receives webhooks
	 */
	webhook?(context: IWebhookFunctions): Promise<IWebhookResponseData>;

	/**
	 * Polling implementation
	 * Optional - only implement if node polls external sources
	 */
	poll?(context: IPollFunctions): Promise<INodeExecutionData[][] | null>;
}

// ============================================================================
// BASE NODE CLASS
// ============================================================================

/**
 * Abstract base class for all node implementations
 *
 * Extend this class and implement the desired execution methods:
 * - execute() for regular nodes
 * - webhook() for webhook-triggered nodes
 * - poll() for polling nodes
 *
 * @example
 * ```typescript
 * export class MyCustomNode extends Node {
 *   description: INodeTypeDescription = {
 *     displayName: "My Custom Node",
 *     name: "myCustomNode",
 *     version: 1,
 *     // ... more metadata
 *   };
 *
 *   async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
 *     const model = context.getLangchainModel();
 *     const input = context.getInputValue("text");
 *
 *     const result = await model.invoke({ prompt: input });
 *
 *     context.setOutput("output", [result]);
 *
 *     return [[result]];
 *   }
 * }
 * ```
 */
export abstract class Node implements INodeType {
	abstract description: INodeTypeDescription;

	/**
	 * Execute the node (override for regular execution logic)
	 */
	execute?(context: IExecuteFunctions): Promise<INodeExecutionData[][] | void>;

	/**
	 * Handle webhooks (override for webhook support)
	 */
	webhook?(context: IWebhookFunctions): Promise<IWebhookResponseData>;

	/**
	 * Handle polling (override for polling support)
	 */
	poll?(context: IPollFunctions): Promise<INodeExecutionData[][] | null>;
}

// ============================================================================
// NODE REGISTRY & LOADER
// ============================================================================

/**
 * Loads and manages node types
 */
export class NodeLoader {
	private nodes = new Map<string, IVersionedNodeType>();

	/**
	 * Register a versioned node type
	 */
	registerNode(nodeType: IVersionedNodeType): void {
		const name = nodeType.description.name;

		if (this.nodes.has(name)) {
			throw new Error(`Node "${name}" is already registered`);
		}

		this.nodes.set(name, nodeType);
	}

	/**
	 * Get a node type by name and optional version
	 */
	getNodeType(name: string, version?: number): INodeType | undefined {
		const versionedType = this.nodes.get(name);
		if (!versionedType) {
			return undefined;
		}
		return versionedType.getNodeType(version);
	}

	/**
	 * Get the current version of a node type
	 */
	getCurrentNodeType(name: string): INodeType | undefined {
		const versionedType = this.nodes.get(name);
		if (!versionedType) {
			return undefined;
		}
		return versionedType.getNodeType(versionedType.currentVersion);
	}

	/**
	 * Get all registered node names
	 */
	getNodeNames(): string[] {
		return Array.from(this.nodes.keys());
	}

	/**
	 * Get node description
	 */
	getNodeDescription(name: string): INodeTypeDescription | undefined {
		return this.nodes.get(name)?.description;
	}

	/**
	 * Get all node descriptions
	 */
	getAllNodeDescriptions(): INodeTypeDescription[] {
		return Array.from(this.nodes.values()).map((n) => n.description);
	}
}

/**
 * Global node loader instance
 */
export const nodeLoader = new NodeLoader();

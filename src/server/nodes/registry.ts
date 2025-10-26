/**
 * Node Registry
 *
 * Manages all available node types and their definitions
 * Supports dynamic input computation and versioned nodes
 */

import type {
	INodeRegistry,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from '@/types/interfaces';

class NodeRegistry implements INodeRegistry {
	private nodes: Map<string, INodeType> = new Map();
	private descriptions: Map<string, INodeTypeDescription> = new Map();

	/**
	 * Register a node type
	 */
	register(nodeType: INodeType, baseDescription: INodeTypeBaseDescription): void {
		const name = baseDescription.name;

		if (this.nodes.has(name)) {
			console.warn(`Node '${name}' is already registered, overwriting...`);
		}

		this.nodes.set(name, nodeType);
		this.descriptions.set(name, nodeType.description);
	}

	/**
	 * Get all node definitions
	 */
	getAllDefinitions(): INodeTypeDescription[] {
		return Array.from(this.descriptions.values());
	}

	/**
	 * Get definition by name
	 */
	getDefinition(name: string): INodeTypeDescription | undefined {
		return this.descriptions.get(name);
	}

	/**
	 * Get definitions by category
	 */
	getDefinitionsByCategory(category: string): INodeTypeDescription[] {
		return Array.from(this.descriptions.values()).filter(
			(def) => def.category === category,
		);
	}

	/**
	 * Get node type implementation
	 */
	getNodeType(name: string): INodeType | undefined {
		return this.nodes.get(name);
	}
}

// Export singleton instance
export const nodeRegistry = new NodeRegistry();

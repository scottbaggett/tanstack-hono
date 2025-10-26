/**
 * Load All Nodes
 *
 * Registers all available node types with the registry
 * Import this file early in the application to ensure nodes are registered
 */

import { Agent } from './agent/Agent';
import { nodeRegistry } from './registry';

/**
 * Register all node types
 */
export function loadNodes(): void {
	// Agent node
	const agentNode = new Agent();
	nodeRegistry.register(agentNode, {
		displayName: agentNode.description.displayName,
		name: agentNode.description.name,
		icon: agentNode.description.icon,
		iconColor: agentNode.description.iconColor,
		category: agentNode.description.category,
		description: agentNode.description.description,
		codex: agentNode.description.codex,
	});

	console.log('✓ Registered agent node');

	// TODO: Register other node types here
	// - LLM nodes
	// - Tool nodes
	// - Memory nodes
	// - etc.
}

// Auto-load on import
loadNodes();

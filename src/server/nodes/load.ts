/**
 * Load All Nodes
 *
 * Registers all available node types with the registry
 * Import this file early in the application to ensure nodes are registered
 */

import { registerTool } from "../execution/requestHandler";
// Agent tools
import { calculatorTool } from "../tools/calculator";
import { searchTool } from "../tools/search";
import { Agent } from "./agent/Agent";
import { IfElse } from "./control/IfElse";
import { TextInput } from "./input/TextInput";
import { Output } from "./output/Output";
import { nodeRegistry } from "./registry";
import { Webhook } from "./trigger/Webhook";
import { ExecuteCommand } from "./utility/ExecuteCommand";
import { HttpRequest } from "./utility/HttpRequest";

/**
 * Register all node types
 */
export function loadNodes(): void {
	// Text Input node
	const textInputNode = new TextInput();
	nodeRegistry.register(textInputNode, {
		displayName: textInputNode.description.displayName,
		name: textInputNode.description.name,
		icon: textInputNode.description.icon,
		iconColor: textInputNode.description.iconColor,
		category: textInputNode.description.category,
		description: textInputNode.description.description,
		codex: textInputNode.description.codex,
	});
	console.log("✓ Registered text input node");

	// Output node
	const outputNode = new Output();
	nodeRegistry.register(outputNode, {
		displayName: outputNode.description.displayName,
		name: outputNode.description.name,
		icon: outputNode.description.icon,
		iconColor: outputNode.description.iconColor,
		category: outputNode.description.category,
		description: outputNode.description.description,
		codex: outputNode.description.codex,
	});
	console.log("✓ Registered output node");

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
	console.log("✓ Registered agent node");

	// Execute Command node
	const executeCommandNode = new ExecuteCommand();
	nodeRegistry.register(executeCommandNode, {
		displayName: executeCommandNode.description.displayName,
		name: executeCommandNode.description.name,
		icon: executeCommandNode.description.icon,
		iconColor: executeCommandNode.description.iconColor,
		category: executeCommandNode.description.category,
		description: executeCommandNode.description.description,
		codex: executeCommandNode.description.codex,
	});
	console.log("✓ Registered execute command node");

	// If/Else node
	const ifElseNode = new IfElse();
	nodeRegistry.register(ifElseNode, {
		displayName: ifElseNode.description.displayName,
		name: ifElseNode.description.name,
		icon: ifElseNode.description.icon,
		iconColor: ifElseNode.description.iconColor,
		category: ifElseNode.description.category,
		description: ifElseNode.description.description,
		codex: ifElseNode.description.codex,
	});
	console.log("✓ Registered if/else node");

	// HTTP Request node
	const httpRequestNode = new HttpRequest();
	nodeRegistry.register(httpRequestNode, {
		displayName: httpRequestNode.description.displayName,
		name: httpRequestNode.description.name,
		icon: httpRequestNode.description.icon,
		iconColor: httpRequestNode.description.iconColor,
		category: httpRequestNode.description.category,
		description: httpRequestNode.description.description,
		codex: httpRequestNode.description.codex,
	});
	console.log("✓ Registered HTTP request node");

	// Webhook Trigger node
	const webhookNode = new Webhook();
	nodeRegistry.register(webhookNode, {
		displayName: webhookNode.description.displayName,
		name: webhookNode.description.name,
		icon: webhookNode.description.icon,
		iconColor: webhookNode.description.iconColor,
		category: webhookNode.description.category,
		description: webhookNode.description.description,
		codex: webhookNode.description.codex,
	});
	console.log("✓ Registered webhook trigger node");

	// Register agent tools
	registerTool(calculatorTool);
	console.log("✓ Registered calculator tool");

	registerTool(searchTool);
	console.log("✓ Registered search tool");

	// TODO: Register other node types here
	// - LLM nodes
	// - Memory nodes
	// - Output parsers
	// - Additional tools
}

// Auto-load on import
loadNodes();

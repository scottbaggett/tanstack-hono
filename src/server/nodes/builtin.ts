/**
 * Built-in node types
 *
 * Provides common nodes that come with the workflow engine
 */

import type { NodeExecutionContext } from "../../types/workflow";
import { BaseNode, NodeBuilder, nodeRegistry } from "./base";

// ============================================================================
// TEXT INPUT NODE
// ============================================================================

class TextInputNode extends BaseNode {
	async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
		const text = inputs.text as string;

		if (!text) {
			this.error("Text input is required");
		}

		this.log(`Outputting text: ${text.substring(0, 50)}...`);

		return {
			text,
			length: text.length,
			wordCount: text.split(/\s+/).length,
		};
	}
}

new NodeBuilder("text-input")
	.displayName("Text Input")
	.category("input")
	.description("Accept text input from the user")
	.icon("type")
	.input({
		name: "text",
		description: "The text to input",
		type: "string",
		required: true,
	})
	.output({
		name: "text",
		description: "The input text",
		type: "string",
	})
	.output({
		name: "length",
		description: "Length of the text",
		type: "number",
	})
	.output({
		name: "wordCount",
		description: "Number of words",
		type: "number",
	})
	.execute(async (inputs) => {
		const text = inputs.text as string;
		if (!text) {
			throw new Error("Text input is required");
		}
		return {
			text,
			length: text.length,
			wordCount: text.split(/\s+/).length,
		};
	})
	.register(TextInputNode);

// ============================================================================
// TEXT OUTPUT NODE
// ============================================================================

class TextOutputNode extends BaseNode {
	async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
		const text = inputs.text as string | undefined;

		if (text === undefined) {
			this.warn("No text provided to output node");
		}

		this.log(`Output: ${text}`);

		return {
			output: text,
			success: true,
		};
	}
}

new NodeBuilder("text-output")
	.displayName("Text Output")
	.category("output")
	.description("Output text as the final result")
	.icon("send")
	.input({
		name: "text",
		description: "The text to output",
		type: "string",
	})
	.output({
		name: "output",
		description: "The output text",
		type: "string",
	})
	.execute(async (inputs) => {
		const text = inputs.text as string | undefined;
		return {
			output: text,
			success: true,
		};
	})
	.register(TextOutputNode);

// ============================================================================
// STRING TRANSFORM NODE
// ============================================================================

class StringTransformNode extends BaseNode {
	async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
		const text = inputs.text as string;
		const operation = inputs.operation as string;

		if (!text) {
			this.error("Text input is required");
		}

		let result = text;

		switch (operation) {
			case "uppercase":
				result = text.toUpperCase();
				break;
			case "lowercase":
				result = text.toLowerCase();
				break;
			case "reverse":
				result = text.split("").reverse().join("");
				break;
			case "trim":
				result = text.trim();
				break;
			case "capitalize":
				result = text.charAt(0).toUpperCase() + text.slice(1);
				break;
			default:
				this.error(`Unknown operation: ${operation}`);
		}

		this.log(`Applied ${operation} transformation`);

		return {
			result,
			originalLength: text.length,
			resultLength: result.length,
		};
	}
}

new NodeBuilder("string-transform")
	.displayName("String Transform")
	.category("processing")
	.description("Transform text with various operations")
	.icon("zap")
	.input({
		name: "text",
		description: "The text to transform",
		type: "string",
		required: true,
	})
	.input({
		name: "operation",
		description: "The transformation to apply",
		type: "string",
		required: true,
		schema: {
			enum: ["uppercase", "lowercase", "reverse", "trim", "capitalize"],
		},
	})
	.output({
		name: "result",
		description: "The transformed text",
		type: "string",
	})
	.output({
		name: "originalLength",
		description: "Length of the original text",
		type: "number",
	})
	.output({
		name: "resultLength",
		description: "Length of the result",
		type: "number",
	})
	.execute(async (inputs) => {
		const text = inputs.text as string;
		const operation = inputs.operation as string;

		if (!text) {
			throw new Error("Text input is required");
		}

		let result = text;

		switch (operation) {
			case "uppercase":
				result = text.toUpperCase();
				break;
			case "lowercase":
				result = text.toLowerCase();
				break;
			case "reverse":
				result = text.split("").reverse().join("");
				break;
			case "trim":
				result = text.trim();
				break;
			case "capitalize":
				result = text.charAt(0).toUpperCase() + text.slice(1);
				break;
			default:
				throw new Error(`Unknown operation: ${operation}`);
		}

		return {
			result,
			originalLength: text.length,
			resultLength: result.length,
		};
	})
	.register(StringTransformNode);

// ============================================================================
// DELAY NODE (for testing async operations)
// ============================================================================

class DelayNode extends BaseNode {
	async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
		const delayMs = (inputs.delayMs as number) || 1000;
		const value = inputs.value;

		this.log(`Delaying for ${delayMs}ms`);

		await new Promise((resolve) => {
			setTimeout(resolve, delayMs);
		});

		this.log(`Delay complete`);

		return {
			value,
			delayedAt: new Date().toISOString(),
		};
	}
}

new NodeBuilder("delay")
	.displayName("Delay")
	.category("control")
	.description("Delay execution for a specified time")
	.icon("clock")
	.input({
		name: "delayMs",
		description: "Delay in milliseconds",
		type: "number",
		default: 1000,
	})
	.input({
		name: "value",
		description: "Value to pass through",
		type: "any",
	})
	.output({
		name: "value",
		description: "The passed through value",
		type: "any",
	})
	.output({
		name: "delayedAt",
		description: "Timestamp when delay completed",
		type: "string",
	})
	.execute(async (inputs) => {
		const delayMs = (inputs.delayMs as number) || 1000;
		const value = inputs.value;

		await new Promise((resolve) => {
			setTimeout(resolve, delayMs);
		});

		return {
			value,
			delayedAt: new Date().toISOString(),
		};
	})
	.register(DelayNode);

// ============================================================================
// EXPORT
// ============================================================================

export { TextInputNode, TextOutputNode, StringTransformNode, DelayNode };

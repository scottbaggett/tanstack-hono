/**
 * Example: Text Transform Node
 *
 * A simple node that demonstrates:
 * - Accessing node parameters
 * - Getting input from previous nodes
 * - Logging
 * - Setting output data
 * - Versioning
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
} from "../../../types/execution";
import type { INodeTypeDescription, IVersionedNodeType } from "../Node";
import { Node, nodeLoader } from "../Node";

class TextTransformNode extends Node {
	description: INodeTypeDescription = {
		displayName: "Text Transform",
		name: "textTransform",
		version: 1,
		category: "text",
		description:
			"Transform text with various operations (uppercase, lowercase, etc)",
		icon: "zap",
		inputs: [
			{
				displayName: "Input Text",
				name: "text",
				type: "string",
				required: true,
				description: "The text to transform",
			},
		],
		outputs: [
			{
				displayName: "Output Text",
				name: "text",
				type: "string",
				description: "The transformed text",
			},
			{
				displayName: "Original Length",
				name: "originalLength",
				type: "number",
			},
			{
				displayName: "Result Length",
				name: "resultLength",
				type: "number",
			},
		],
		properties: [
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				required: true,
				default: "uppercase",
				description: "The transformation to apply",
				options: [
					{ name: "Uppercase", value: "uppercase" },
					{ name: "Lowercase", value: "lowercase" },
					{ name: "Reverse", value: "reverse" },
					{ name: "Trim", value: "trim" },
					{ name: "Capitalize", value: "capitalize" },
				],
			},
		],
	};

	async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		context.logInfo("Starting text transform node");

		// Get node parameters
		const operation = context.getNodeParameter("operation") as string;
		context.logInfo(`Using operation: ${operation}`);

		// Get input from previous nodes
		const inputs = context.getInputData();
		const textArray = inputs.text || [];

		if (textArray.length === 0) {
			context.logWarn("No input text provided");
			return [];
		}

		const results: INodeExecutionData[] = [];

		// Process each input item
		for (const item of textArray) {
			const text = String(item);
			let result = text;

			// Apply transformation
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
					context.logError(`Unknown operation: ${operation}`);
					throw new Error(`Unknown operation: ${operation}`);
			}

			context.logInfo(`Transformed "${text}" → "${result}"`);

			// Create output object
			results.push({
				text: result,
				originalLength: text.length,
				resultLength: result.length,
			});
		}

		// Set output data
		context.setOutputData({
			text: results.map((r) => r.text),
			originalLength: results.map((r) => r.originalLength),
			resultLength: results.map((r) => r.resultLength),
		});

		context.logInfo("Text transform completed");

		// Return in the [[]] format for workflow compatibility
		return [results];
	}
}

// Register the node with versioning support
const versionedTextTransform: IVersionedNodeType = {
	description: new TextTransformNode().description,
	currentVersion: 1,
	nodeVersions: {
		1: new TextTransformNode(),
	},
	getNodeType(version?: number) {
		const v = version ?? this.currentVersion;
		return this.nodeVersions[v];
	},
};

nodeLoader.registerNode(versionedTextTransform);

export { TextTransformNode };

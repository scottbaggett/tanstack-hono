/**
 * Example: Image Processing Node
 *
 * Demonstrates working with rich data types:
 * - Input: PNG/JPG image (as Buffer)
 * - Output: Processed image + metadata (as Buffer) + analysis (as JSON)
 *
 * Shows:
 * - Using TypedValue for explicit type control
 * - Handling binary data (images)
 * - Multiple output handles with different types
 */

import type { IExecuteFunctions, INodeExecutionData } from "../../../types/execution";
import type { INodeTypeDescription, IVersionedNodeType } from "../Node";
import { Node, nodeLoader } from "../Node";
import type { TypedValue } from "../../../types/datatypes";

class ImageProcessingNode extends Node {
	description: INodeTypeDescription = {
		displayName: "Image Processing",
		name: "imageProcessing",
		version: 1,
		category: "image",
		description: "Process images and extract metadata",
		icon: "image",
		inputs: [
			{
				displayName: "Image",
				name: "image",
				type: "image:png" as any, // Accepts PNG images
				required: true,
				description: "Input image (PNG format)",
			},
		],
		outputs: [
			{
				displayName: "Processed Image",
				name: "processedImage",
				type: "image:png" as any,
				description: "The processed image data",
			},
			{
				displayName: "Metadata",
				name: "metadata",
				type: "json",
				description: "Image metadata and analysis",
			},
			{
				displayName: "File Size",
				name: "fileSize",
				type: "number",
				description: "Size of the image in bytes",
			},
		],
		properties: [
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				required: true,
				default: "analyze",
				description: "What to do with the image",
				options: [
					{ name: "Analyze Only", value: "analyze" },
					{ name: "Resize", value: "resize" },
					{ name: "Convert to Grayscale", value: "grayscale" },
				],
			},
			{
				displayName: "Width (for resize)",
				name: "width",
				type: "number",
				default: 100,
				description: "Target width in pixels",
			},
			{
				displayName: "Height (for resize)",
				name: "height",
				type: "number",
				default: 100,
				description: "Target height in pixels",
			},
		],
	};

	async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		context.logInfo("Starting image processing");

		// Get input - should be an image (Buffer)
		const imageInputs = context.getInputData();
		const imageArray = imageInputs.image || [];

		if (imageArray.length === 0) {
			context.logError("No image provided");
			throw new Error("Image input is required");
		}

		// Get parameters
		const operation = context.getNodeParameter("operation") as string;
		const width = context.getNodeParameter("width") as number;
		const height = context.getNodeParameter("height") as number;

		context.logInfo(`Using operation: ${operation}`);

		const results: INodeExecutionData[] = [];

		// Process each image
		for (const item of imageArray) {
			let imageBuffer: Buffer;

			// Extract buffer from potentially typed value
			if (
				typeof item === "object" &&
				item !== null &&
				"value" in item &&
				Buffer.isBuffer((item as any).value)
			) {
				imageBuffer = (item as TypedValue).value as Buffer;
			} else if (Buffer.isBuffer(item)) {
				imageBuffer = item;
			} else {
				context.logError("Input is not a valid image buffer");
				throw new Error("Invalid image data");
			}

			context.logInfo(
				`Processing image: ${imageBuffer.length} bytes`
			);

			// Simulate image processing
			// In production, you'd use a library like sharp or ImageMagick
			let processedBuffer = imageBuffer;
			const metadata: Record<string, unknown> = {
				originalSize: imageBuffer.length,
				operation,
				processedAt: new Date().toISOString(),
			};

			switch (operation) {
				case "analyze": {
					// Just analyze
					metadata.format = "png";
					metadata.estimatedWidth = 100; // Would detect real size
					metadata.estimatedHeight = 100;
					// Processed buffer is same as original
					processedBuffer = imageBuffer;
					break;
				}

				case "resize": {
					// Simulate resize (in reality would use sharp/imagemagick)
					context.logInfo(`Resizing to ${width}x${height}`);
					// Create a new buffer (simulating resize operation)
					// Real implementation would use image processing library
					processedBuffer = Buffer.alloc(width * height * 4);
					metadata.resizedWidth = width;
					metadata.resizedHeight = height;
					break;
				}

				case "grayscale": {
					// Simulate grayscale conversion
					context.logInfo("Converting to grayscale");
					// In real implementation, convert image data
					processedBuffer = imageBuffer;
					metadata.grayscale = true;
					break;
				}

				default:
					context.logError(`Unknown operation: ${operation}`);
					throw new Error(`Unknown operation: ${operation}`);
			}

			context.logInfo(
				`Image processing complete: ${processedBuffer.length} bytes`
			);

			// Emit event showing progress
			context.emitStreamEvent("log", {
				message: `Processed image: ${operation}`,
				size: processedBuffer.length,
			});

			// Create typed output for processed image
			const processedImageTyped: TypedValue = {
				dataType: "image:png",
				value: processedBuffer,
				metadata: {
					filename: `processed_${operation}.png`,
					size: processedBuffer.length,
				},
			};

			results.push({
				processedImage: processedImageTyped,
				metadata,
				fileSize: processedBuffer.length,
			});
		}

		// Set typed outputs
		const processedImages = results.map((r: any) => r.processedImage);
		const metadataList = results.map((r: any) => ({
			dataType: "json",
			value: r.metadata,
		}));
		const fileSizes = results.map((r: any) =>
			r.fileSize ? { dataType: "number", value: r.fileSize } : 0
		);

		context.setOutputData({
			processedImage: processedImages,
			metadata: metadataList,
			fileSize: fileSizes,
		});

		context.logInfo("Image processing completed");

		return [results];
	}
}

// Register the node
const versionedImageProcessing: IVersionedNodeType = {
	description: new ImageProcessingNode().description,
	currentVersion: 1,
	nodeVersions: {
		1: new ImageProcessingNode(),
	},
	getNodeType(version?: number) {
		const v = version ?? this.currentVersion;
		return this.nodeVersions[v];
	},
};

nodeLoader.registerNode(versionedImageProcessing);

export { ImageProcessingNode };

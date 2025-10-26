/**
 * Data Type System for Workflow Nodes
 *
 * Supports multiple data types flowing through the workflow:
 * - Primitives: string, number, float, boolean
 * - Structured: JSON, CSV, PDB (Protein Data Bank)
 * - Binary: Buffer, Images (PNG, JPG, etc)
 * - Collections: Arrays of any type
 *
 * Each type has:
 * - A type identifier
 * - Serialization strategy (how to store/transmit)
 * - Deserialization strategy (how to reconstruct)
 * - MIME type for HTTP
 */

// ============================================================================
// DATA TYPE IDENTIFIERS
// ============================================================================

/**
 * All supported data types in the workflow system
 */
export type DataTypeId =
	// Primitives
	| "string"
	| "number"
	| "float"
	| "integer"
	| "boolean"
	| "null"
	// Structured
	| "json"
	| "csv"
	| "pdb"
	| "xml"
	| "yaml"
	// Binary/Media
	| "buffer"
	| "image:png"
	| "image:jpg"
	| "image:webp"
	| "image:gif"
	| "image:svg"
	// Collections
	| "array"
	| "object"
	// Custom
	| `custom:${string}`;

// ============================================================================
// SERIALIZATION FORMAT
// ============================================================================

/**
 * How data should be serialized for storage/transmission
 */
export type SerializationFormat =
	| "json" // JSON-serializable object
	| "base64" // Base64 encoded string
	| "text" // Plain text
	| "reference"; // Store only a reference/path (data kept in memory)

/**
 * Metadata about how a data type serializes
 */
export interface DataTypeMetadata {
	typeId: DataTypeId;
	displayName: string;
	description?: string;
	mimeType?: string;
	serializationFormat: SerializationFormat;
	// Can this type be serialized to JSON?
	jsonSerializable: boolean;
	// Maximum size in bytes (null = unlimited)
	maxSize?: number | null;
}

// ============================================================================
// TYPE METADATA REGISTRY
// ============================================================================

/**
 * Metadata for all supported data types
 */
export const DATA_TYPE_METADATA: Record<DataTypeId, DataTypeMetadata> = {
	// Primitives
	string: {
		typeId: "string",
		displayName: "String",
		description: "Text data",
		mimeType: "text/plain",
		serializationFormat: "json",
		jsonSerializable: true,
	},
	number: {
		typeId: "number",
		displayName: "Number",
		description: "Integer or float number",
		serializationFormat: "json",
		jsonSerializable: true,
	},
	float: {
		typeId: "float",
		displayName: "Float",
		description: "Floating point number with decimal precision",
		serializationFormat: "json",
		jsonSerializable: true,
	},
	integer: {
		typeId: "integer",
		displayName: "Integer",
		description: "Whole number",
		serializationFormat: "json",
		jsonSerializable: true,
	},
	boolean: {
		typeId: "boolean",
		displayName: "Boolean",
		description: "True or false",
		serializationFormat: "json",
		jsonSerializable: true,
	},
	null: {
		typeId: "null",
		displayName: "Null",
		description: "Null/empty value",
		serializationFormat: "json",
		jsonSerializable: true,
	},

	// Structured data
	json: {
		typeId: "json",
		displayName: "JSON",
		description: "JSON object or array",
		mimeType: "application/json",
		serializationFormat: "json",
		jsonSerializable: true,
	},
	csv: {
		typeId: "csv",
		displayName: "CSV",
		description: "Comma-separated values data",
		mimeType: "text/csv",
		serializationFormat: "text",
		jsonSerializable: false,
	},
	pdb: {
		typeId: "pdb",
		displayName: "PDB",
		description: "Protein Data Bank file format",
		mimeType: "text/plain",
		serializationFormat: "text",
		jsonSerializable: false,
	},
	xml: {
		typeId: "xml",
		displayName: "XML",
		description: "XML structured data",
		mimeType: "application/xml",
		serializationFormat: "text",
		jsonSerializable: false,
	},
	yaml: {
		typeId: "yaml",
		displayName: "YAML",
		description: "YAML structured data",
		mimeType: "text/yaml",
		serializationFormat: "text",
		jsonSerializable: false,
	},

	// Binary/Media
	buffer: {
		typeId: "buffer",
		displayName: "Buffer",
		description: "Binary data",
		mimeType: "application/octet-stream",
		serializationFormat: "base64",
		jsonSerializable: false,
	},
	"image:png": {
		typeId: "image:png",
		displayName: "Image (PNG)",
		description: "PNG image data",
		mimeType: "image/png",
		serializationFormat: "base64",
		jsonSerializable: false,
		maxSize: 50 * 1024 * 1024, // 50MB
	},
	"image:jpg": {
		typeId: "image:jpg",
		displayName: "Image (JPG)",
		description: "JPEG image data",
		mimeType: "image/jpeg",
		serializationFormat: "base64",
		jsonSerializable: false,
		maxSize: 50 * 1024 * 1024,
	},
	"image:webp": {
		typeId: "image:webp",
		displayName: "Image (WebP)",
		description: "WebP image data",
		mimeType: "image/webp",
		serializationFormat: "base64",
		jsonSerializable: false,
		maxSize: 50 * 1024 * 1024,
	},
	"image:gif": {
		typeId: "image:gif",
		displayName: "Image (GIF)",
		description: "GIF image data",
		mimeType: "image/gif",
		serializationFormat: "base64",
		jsonSerializable: false,
		maxSize: 50 * 1024 * 1024,
	},
	"image:svg": {
		typeId: "image:svg",
		displayName: "Image (SVG)",
		description: "SVG vector image",
		mimeType: "image/svg+xml",
		serializationFormat: "text",
		jsonSerializable: false,
	},

	// Collections
	array: {
		typeId: "array",
		displayName: "Array",
		description: "Array of values",
		serializationFormat: "json",
		jsonSerializable: true,
	},
	object: {
		typeId: "object",
		displayName: "Object",
		description: "Object/dictionary",
		serializationFormat: "json",
		jsonSerializable: true,
	},
};

// ============================================================================
// TYPED NODE DATA
// ============================================================================

/**
 * A value with its data type information
 */
export interface TypedValue {
	dataType: DataTypeId;
	value: unknown;
	metadata?: {
		filename?: string;
		size?: number;
		encoding?: string;
		[key: string]: unknown;
	};
}

/**
 * Serialized version of TypedValue for storage/transmission
 */
export interface SerializedValue {
	dataType: DataTypeId;
	// Serialized value in the appropriate format
	data: string | Record<string, unknown> | null;
	// Metadata about the value
	metadata?: {
		filename?: string;
		size?: number;
		encoding?: string;
		[key: string]: unknown;
	};
}

// ============================================================================
// SERIALIZATION & DESERIALIZATION
// ============================================================================

/**
 * Serialize a TypedValue for storage/transmission
 *
 * Handles conversion based on the data type's serialization format
 */
export function serializeValue(typed: TypedValue): SerializedValue {
	const metadata = DATA_TYPE_METADATA[typed.dataType];

	if (!metadata) {
		throw new Error(`Unknown data type: ${typed.dataType}`);
	}

	let serialized: string | Record<string, unknown> | null;

	switch (metadata.serializationFormat) {
		case "json": {
			// Serialize to JSON
			if (typeof typed.value === "string") {
				serialized = typed.value;
			} else {
				serialized = typed.value as Record<string, unknown>;
			}
			break;
		}

		case "text": {
			// Already text, store as-is
			serialized = String(typed.value);
			break;
		}

		case "base64": {
			// Convert Buffer/binary to base64
			if (Buffer.isBuffer(typed.value)) {
				serialized = typed.value.toString("base64");
			} else if (typeof typed.value === "string") {
				serialized = typed.value;
			} else {
				throw new Error(`Cannot serialize ${typed.dataType}: invalid value type`);
			}
			break;
		}

		case "reference": {
			// Just store metadata, data kept in memory
			serialized = null;
			break;
		}

		default:
			throw new Error(`Unknown serialization format: ${metadata.serializationFormat}`);
	}

	return {
		dataType: typed.dataType,
		data: serialized,
		metadata: typed.metadata,
	};
}

/**
 * Deserialize a value from storage/transmission
 *
 * Reconstructs the TypedValue from its serialized form
 */
export function deserializeValue(serialized: SerializedValue): TypedValue {
	const metadata = DATA_TYPE_METADATA[serialized.dataType];

	if (!metadata) {
		throw new Error(`Unknown data type: ${serialized.dataType}`);
	}

	let value: unknown;

	switch (metadata.serializationFormat) {
		case "json": {
			value = serialized.data;
			break;
		}

		case "text": {
			value = serialized.data;
			break;
		}

		case "base64": {
			// Convert base64 back to Buffer
			if (typeof serialized.data === "string") {
				value = Buffer.from(serialized.data, "base64");
			} else {
				throw new Error(`Cannot deserialize base64 data: expected string`);
			}
			break;
		}

		case "reference": {
			// Data not included, would need to load from reference
			throw new Error(
				`Cannot deserialize reference type without context: ${serialized.dataType}`
			);
		}

		default:
			throw new Error(
				`Unknown serialization format: ${metadata.serializationFormat}`
			);
	}

	return {
		dataType: serialized.dataType,
		value,
		metadata: serialized.metadata,
	};
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the MIME type for a data type
 */
export function getMimeType(dataType: DataTypeId): string | undefined {
	return DATA_TYPE_METADATA[dataType]?.mimeType;
}

/**
 * Check if a data type is JSON-serializable
 */
export function isJsonSerializable(dataType: DataTypeId): boolean {
	return DATA_TYPE_METADATA[dataType]?.jsonSerializable ?? false;
}

/**
 * Get serialization format for a data type
 */
export function getSerializationFormat(dataType: DataTypeId): SerializationFormat {
	const format = DATA_TYPE_METADATA[dataType]?.serializationFormat;
	if (!format) {
		throw new Error(`Unknown data type: ${dataType}`);
	}
	return format;
}

/**
 * Infer the data type from a JavaScript value
 */
export function inferDataType(value: unknown): DataTypeId {
	if (value === null) {
		return "null";
	}

	if (typeof value === "string") {
		return "string";
	}

	if (typeof value === "number") {
		// Try to determine if it's a float or integer
		return Number.isInteger(value) ? "integer" : "float";
	}

	if (typeof value === "boolean") {
		return "boolean";
	}

	if (Buffer.isBuffer(value)) {
		return "buffer";
	}

	if (Array.isArray(value)) {
		return "array";
	}

	if (typeof value === "object") {
		return "object";
	}

	// Default to JSON for anything else
	return "json";
}

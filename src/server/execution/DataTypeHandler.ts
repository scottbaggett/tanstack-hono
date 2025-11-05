/**
 * Data Type Handler
 *
 * Utilities for converting, validating, and serializing typed data
 * flowing through the workflow execution.
 */

import type { DataTypeId, TypedValue } from "../../types/datatypes";
import {
	DATA_TYPE_METADATA,
	deserializeValue,
	inferDataType,
	serializeValue,
} from "../../types/datatypes";
import type {
	INodeExecutionData,
	INodeOutputData,
	INodeOutputDataSerialized,
} from "../../types/execution";

// ============================================================================
// TYPE CONVERSION
// ============================================================================

/**
 * Convert raw data to TypedValue
 *
 * If the value is already typed, returns it as-is.
 * Otherwise, infers the type automatically.
 */
export function toTypedValue(data: INodeExecutionData): TypedValue {
	// Already typed
	if (isTypedValue(data)) {
		return data as TypedValue;
	}

	// Infer type and wrap
	return {
		dataType: inferDataType(data),
		value: data,
	};
}

/**
 * Check if a value is a TypedValue
 */
export function isTypedValue(value: unknown): value is TypedValue {
	return (
		typeof value === "object" &&
		value !== null &&
		"dataType" in value &&
		"value" in value &&
		typeof (value as any).dataType === "string"
	);
}

/**
 * Extract the raw value from potentially typed data
 */
export function extractValue(data: INodeExecutionData): unknown {
	if (isTypedValue(data)) {
		return (data as TypedValue).value;
	}
	return data;
}

/**
 * Extract the type from potentially typed data
 */
export function extractType(data: INodeExecutionData): DataTypeId {
	if (isTypedValue(data)) {
		return (data as TypedValue).dataType;
	}
	return inferDataType(data);
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize node output data for storage/transmission
 *
 * Converts all TypedValues to SerializedValues using appropriate serialization.
 */
export function serializeOutputData(
	outputData: INodeOutputData,
): INodeOutputDataSerialized {
	const serialized: INodeOutputDataSerialized = {};

	for (const [handleName, values] of Object.entries(outputData)) {
		serialized[handleName] = values.map((value) => {
			const typed = toTypedValue(value);
			return serializeValue(typed);
		});
	}

	return serialized;
}

/**
 * Deserialize stored output data back to runtime values
 *
 * Converts SerializedValues back to TypedValues/raw values.
 */
export function deserializeOutputData(
	serialized: INodeOutputDataSerialized,
): INodeOutputData {
	const deserialized: INodeOutputData = {};

	for (const [handleName, values] of Object.entries(serialized)) {
		deserialized[handleName] = values.map((value) => {
			try {
				return deserializeValue(value);
			} catch (error) {
				// Fallback: return serialized data as-is
				console.warn(
					`Failed to deserialize ${handleName} (${value.dataType}):`,
					error,
				);
				return {
					dataType: value.dataType,
					value: value.data,
					metadata: value.metadata,
				};
			}
		});
	}

	return deserialized;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that data matches an expected type
 *
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateDataType(
	data: INodeExecutionData,
	expectedType: DataTypeId | "any",
): { valid: boolean; error?: string } {
	// "any" accepts all types
	if (expectedType === "any") {
		return { valid: true };
	}

	const actualType = extractType(data);

	// Exact match
	if (actualType === expectedType) {
		return { valid: true };
	}

	// Type compatibility checks
	if (canConvertType(actualType, expectedType)) {
		return { valid: true };
	}

	return {
		valid: false,
		error: `Expected ${expectedType}, got ${actualType}`,
	};
}

/**
 * Check if a type can be converted to another type
 */
function canConvertType(from: DataTypeId, to: DataTypeId): boolean {
	// String can be converted from many types
	if (to === "string") {
		return true;
	}

	// Number conversions
	if (to === "number" || to === "float" || to === "integer") {
		return (
			from === "number" ||
			from === "float" ||
			from === "integer" ||
			from === "string"
		);
	}

	// JSON can accept many types
	if (to === "json") {
		return [
			"string",
			"number",
			"float",
			"integer",
			"boolean",
			"array",
			"object",
		].includes(from);
	}

	return false;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get a human-readable summary of data for logging/display
 */
export function summarizeData(
	data: INodeExecutionData,
	maxLength: number = 100,
): string {
	const typed = toTypedValue(data);
	const value = typed.value;
	const type = typed.dataType;

	// Handle different types specially
	if (type.startsWith("image:")) {
		const meta = typed.metadata;
		const filename = meta?.filename || "image";
		const size = meta?.size ? ` (${(meta.size / 1024).toFixed(2)}KB)` : "";
		return `${type}: ${filename}${size}`;
	}

	if (type === "buffer") {
		const size = Buffer.isBuffer(value) ? value.length : 0;
		return `buffer (${(size / 1024).toFixed(2)}KB)`;
	}

	if (type === "csv" || type === "pdb") {
		const str = String(value);
		const lines = str.split("\n").length;
		return `${type} (${lines} lines)`;
	}

	// Default: stringify and truncate
	let str = "";
	if (typeof value === "string") {
		str = value;
	} else if (typeof value === "object") {
		str = JSON.stringify(value);
	} else {
		str = String(value);
	}

	if (str.length > maxLength) {
		return `${str.substring(0, maxLength)}... (${type})`;
	}

	return str || `(empty ${type})`;
}

// ============================================================================
// SIZE LIMITS
// ============================================================================

/**
 * Check if data respects the size limit for its type
 */
export function checkSizeLimit(data: INodeExecutionData): {
	valid: boolean;
	error?: string;
} {
	const typed = toTypedValue(data);
	const metadata = DATA_TYPE_METADATA[typed.dataType];

	if (!metadata || metadata.maxSize === undefined) {
		return { valid: true };
	}

	let size = 0;

	if (Buffer.isBuffer(typed.value)) {
		size = typed.value.length;
	} else if (typeof typed.value === "string") {
		size = Buffer.byteLength(typed.value, "utf8");
	} else if (typeof typed.value === "object") {
		size = Buffer.byteLength(JSON.stringify(typed.value), "utf8");
	}

	if (metadata.maxSize !== null && size > metadata.maxSize) {
		const maxMB = (metadata.maxSize / (1024 * 1024)).toFixed(2);
		const actualMB = (size / (1024 * 1024)).toFixed(2);
		return {
			valid: false,
			error: `Data exceeds size limit for ${typed.dataType}: ${actualMB}MB > ${maxMB}MB`,
		};
	}

	return { valid: true };
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Serialize all output data safely
 *
 * Returns serialized data, or empty if serialization fails
 */
export function serializeOutputDataSafely(
	outputData: INodeOutputData,
	logger?: Console,
): INodeOutputDataSerialized {
	try {
		return serializeOutputData(outputData);
	} catch (error) {
		logger?.error("Failed to serialize output data:", error);
		// Return minimal serialized data
		return {};
	}
}

/**
 * Validate all output handles against their declared types
 */
export function validateOutputHandles(
	outputData: INodeOutputData,
	declaredOutputs:
		| Array<{ name: string; type: DataTypeId | "any" }>
		| undefined,
): { valid: boolean; errors: Array<{ handle: string; error: string }> } {
	if (!declaredOutputs || declaredOutputs.length === 0) {
		return { valid: true, errors: [] };
	}

	const errors: Array<{ handle: string; error: string }> = [];

	for (const output of declaredOutputs) {
		const handleData = outputData[output.name];

		if (!handleData) {
			// Handle not provided - may be optional
			continue;
		}

		// Validate each value in the handle
		for (let i = 0; i < handleData.length; i++) {
			const validation = validateDataType(handleData[i], output.type);

			if (!validation.valid) {
				errors.push({
					handle: `${output.name}[${i}]`,
					error: validation.error || "Type mismatch",
				});
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * JSONata Expression Evaluator
 *
 * Evaluates JSONata expressions for node properties
 * Provides safe sandboxed evaluation with access to workflow context
 */

import jsonata from "jsonata";
import type { Expression } from "jsonata";

// ============================================================================
// TYPES
// ============================================================================

export interface ExpressionContext {
	// Workflow expression variables (JSONata natively supports $ prefix)
	// Current item's JSON data (first input item)
	$json?: Record<string, any>;
	// Array of all items (access via $item[0], $item[1], etc.)
	$item?: Array<{ json: Record<string, any>; binary?: Record<string, any> }>;
	// Map of items by node name (access via $items["NodeName"])
	$items?: Record<
		string,
		Array<{ json: Record<string, any>; binary?: Record<string, any> }>
	>;
	// Current node's parameters
	$parameters?: Record<string, any>;

	// Legacy support (deprecated - use $ prefixed versions above)
	json?: Record<string, any>;
	binary?: Record<string, any>;
	input?: {
		params?: Record<string, any>;
	};
	inputs?: Record<
		string,
		{
			json?: Record<string, any>;
			binary?: Record<string, any>;
			params?: Record<string, any>;
		}
	>;
	// Current node metadata
	node?: {
		id: string;
		type: string;
		version: number;
	};
	// Additional context (state, previous results, etc.)
	[key: string]: any;
}

export interface EvaluationResult {
	success: boolean;
	value?: any;
	error?: string;
}

// ============================================================================
// EXPRESSION CACHE
// ============================================================================

// Cache compiled JSONata expressions to avoid recompiling
const expressionCache = new Map<string, Expression>();

function getCachedExpression(expression: string): Expression {
	if (expressionCache.has(expression)) {
		return expressionCache.get(expression)!;
	}

	try {
		const compiled = jsonata(expression);
		expressionCache.set(expression, compiled);
		return compiled;
	} catch (error) {
		throw new Error(
			`Failed to compile JSONata expression "${expression}": ${error}`,
		);
	}
}

// ============================================================================
// EVALUATION
// ============================================================================

/**
 * Convert custom syntax to CEL-compatible bracket notation
 *
 * Patterns converted:
 * n8n-style syntax:
 * - $json.field -> $json["field"]
 * - $item[0].json.field -> $item[0]["json"]["field"]
 * - $items["NodeName"][0].json -> $items["NodeName"][0]["json"]
 * - $parameters.field -> $parameters["field"]
 *
 * Legacy syntax (deprecated):
 * - json.field -> json["field"]
 * - binary.key -> binary["key"]
 * - input.params.field -> input["params"]["field"]
 * - node.id -> node["id"]
 * - inputs.nodeId.json.field -> inputs["nodeId"]["json"]["field"]
 */
function convertCustomSyntaxToCEL(expression: string): string {
	// Convert $json.field to $json["field"]
	expression = expression.replace(
		/\$json((?:\.\w+)+)/g,
		(_match, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `$json${bracketProps}`;
		},
	);

	// Convert $parameters.field to $parameters["field"]
	expression = expression.replace(
		/\$parameters((?:\.\w+)+)/g,
		(_match, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `$parameters${bracketProps}`;
		},
	);

	// Convert $item[0].json.field to $item[0]["json"]["field"]
	expression = expression.replace(
		/\$item\[(\d+)\]((?:\.\w+)+)/g,
		(_match, index, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `$item[${index}]${bracketProps}`;
		},
	);

	// Convert $items["NodeName"][0].json.field to $items["NodeName"][0]["json"]["field"]
	expression = expression.replace(
		/\$items\["([^"]+)"\]\[(\d+)\]((?:\.\w+)+)/g,
		(_match, nodeName, index, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `$items["${nodeName}"][${index}]${bracketProps}`;
		},
	);

	// Legacy support below (deprecated)

	// Convert inputs.nodeId.json.field to inputs["nodeId"]["json"]["field"]
	expression = expression.replace(
		/\binputs((?:\.\w+)+)/g,
		(_match, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `inputs${bracketProps}`;
		},
	);

	// Convert json.field.nested to json["field"]["nested"]
	expression = expression.replace(
		/\bjson((?:\.\w+)+)/g,
		(_match, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `json${bracketProps}`;
		},
	);

	// Convert binary.field to binary["field"]
	expression = expression.replace(
		/\bbinary((?:\.\w+)+)/g,
		(_match, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `binary${bracketProps}`;
		},
	);

	// Convert input.params.field to input["params"]["field"]
	expression = expression.replace(
		/\binput((?:\.\w+)+)/g,
		(_match, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `input${bracketProps}`;
		},
	);

	// Convert node.id to node["id"]
	expression = expression.replace(
		/\bnode((?:\.\w+)+)/g,
		(_match, properties) => {
			const bracketProps = properties
				.split(".")
				.filter(Boolean)
				.map((p: string) => `["${p}"]`)
				.join("");
			return `node${bracketProps}`;
		},
	);

	return expression;
}

/**
 * Evaluate a CEL expression with the given context
 */
export function evaluateExpression(
	expression: string,
	context: ExpressionContext,
): EvaluationResult {
	try {
		// Convert custom syntax to CEL before evaluating
		const celExpression = convertCustomSyntaxToCEL(expression);
		const { evaluator } = getCachedExpression(celExpression);
		const result = evaluator(context);

		// CEL returns a CelResult which is either the value or a CelError
		// If it's an error, isCelError will help us detect it
		if (typeof result === "object" && result !== null && "message" in result) {
			return {
				success: false,
				error: result.message || String(result),
			};
		}

		return {
			success: true,
			value: result,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Check if a string contains CEL expressions ({{ ... }})
 */
export function hasExpressions(value: string): boolean {
	if (typeof value !== "string") return false;
	return /\$\{[^}]+\}|\{\{[^}]+\}\}/.test(value);
}

/**
 * Extract CEL expressions from a template string
 * Finds all patterns like {{expression}} or ${expression}
 */
export function extractExpressions(template: string): string[] {
	if (typeof template !== "string") return [];

	const regex = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;
	const matches: string[] = [];
	let match: RegExpExecArray | null = regex.exec(template);

	while (match !== null) {
		matches.push(match[1] || match[2]);
		match = regex.exec(template);
	}

	return matches;
}

/**
 * Evaluate a template string by replacing CEL expressions with their evaluated values
 * Supports both {{expression}} and ${expression} syntax
 *
 * Example:
 *   "Hello {{$parameter.name}}, you have {{$input.count}} items"
 *   with context { $parameter: { name: "Alice" }, $input: { count: 5 } }
 *   returns: "Hello Alice, you have 5 items"
 */
export function evaluateTemplate(
	template: string,
	context: ExpressionContext,
): EvaluationResult {
	if (!template || typeof template !== "string") {
		return { success: true, value: template };
	}

	// If no expressions, return as-is
	if (!hasExpressions(template)) {
		return { success: true, value: template };
	}

	try {
		let result = template;

		// Replace all expressions
		const regex = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;
		let match: RegExpExecArray | null = regex.exec(template);

		const replacements: Array<{ start: number; end: number; value: unknown }> =
			[];

		while (match !== null) {
			const expression = match[1] || match[2];
			const evaluation = evaluateExpression(expression, context);

			if (!evaluation.success) {
				return {
					success: false,
					error: `Failed to evaluate "${expression}": ${evaluation.error}`,
				};
			}

			replacements.push({
				start: match.index ?? 0,
				end: (match.index ?? 0) + match[0].length,
				value: evaluation.value,
			});
			match = regex.exec(template);
		}

		// Apply replacements in reverse order to maintain indices
		for (let i = replacements.length - 1; i >= 0; i--) {
			const { start, end, value } = replacements[i];
			const stringValue =
				typeof value === "string" ? value : JSON.stringify(value);
			result = result.substring(0, start) + stringValue + result.substring(end);
		}

		return { success: true, value: result };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Evaluate all properties in an object, handling nested objects
 * Returns evaluated copy with all CEL expressions resolved
 */
export function evaluateProperties(
	properties: Record<string, any>,
	context: ExpressionContext,
): { success: boolean; values?: Record<string, any>; error?: string } {
	const evaluated: Record<string, any> = {};

	try {
		for (const [key, value] of Object.entries(properties)) {
			if (typeof value === "string" && hasExpressions(value)) {
				// Evaluate string templates
				const result = evaluateTemplate(value, context);
				if (!result.success) {
					return {
						success: false,
						error: `Property "${key}": ${result.error}`,
					};
				}
				evaluated[key] = result.value;
			} else if (typeof value === "object" && value !== null) {
				// Recursively handle nested objects (but not arrays for now)
				const nested = evaluateProperties(value, context);
				if (!nested.success) {
					return {
						success: false,
						error: `Property "${key}": ${nested.error}`,
					};
				}
				evaluated[key] = nested.values;
			} else {
				// Keep as-is for non-string, non-object values
				evaluated[key] = value;
			}
		}

		return { success: true, values: evaluated };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a CEL expression without executing it
 */
export function validateExpression(expression: string): {
	valid: boolean;
	error?: string;
} {
	try {
		getCachedExpression(expression);
		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Validate a template string
 */
export function validateTemplate(template: string): {
	valid: boolean;
	errors: Array<{ expression: string; error: string }>;
} {
	if (!hasExpressions(template)) {
		return { valid: true, errors: [] };
	}

	const expressions = extractExpressions(template);
	const errors: Array<{ expression: string; error: string }> = [];

	for (const expr of expressions) {
		const result = validateExpression(expr);
		if (!result.valid) {
			errors.push({
				expression: expr,
				error: result.error || "Invalid expression",
			});
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Clear the compiled expression cache (useful for testing or memory management)
 */
export function clearExpressionCache(): void {
	expressionCache.clear();
}

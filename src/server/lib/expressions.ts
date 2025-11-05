/**
 * CEL Expression Evaluator
 *
 * Evaluates CEL (Common Expression Language) expressions for node properties
 * Provides safe sandboxed evaluation with access to workflow context
 */

import { celEnv, parse, plan } from "@bufbuild/cel";
import type { ParsedExpr } from "@bufbuild/cel-spec/cel/expr/syntax_pb.js";

// ============================================================================
// TYPES
// ============================================================================

export interface ExpressionContext {
	// Output data from connected input node (single input)
	json?: Record<string, any>;
	// Binary data from connected input node
	binary?: Record<string, any>;
	// Input context (params from connected node, multiple inputs)
	input?: {
		params?: Record<string, any>;
	};
	// Multiple inputs (when node has more than one connection)
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

// Cache parsed and planned expressions to avoid recompiling
interface CachedExpression {
	parsed: ParsedExpr;
	evaluator: (ctx?: Record<string, any>) => any;
}

const expressionCache = new Map<string, CachedExpression>();
const env = celEnv();

function getCachedExpression(expression: string): CachedExpression {
	if (expressionCache.has(expression)) {
		return expressionCache.get(expression)!;
	}

	try {
		const parsed = parse(expression);
		const evaluator = plan(env, parsed);
		const cached: CachedExpression = { parsed, evaluator };
		expressionCache.set(expression, cached);
		return cached;
	} catch (error) {
		throw new Error(
			`Failed to compile CEL expression "${expression}": ${error}`,
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
 * - json.field -> json["field"]
 * - json.field.nested -> json["field"]["nested"]
 * - binary.key -> binary["key"]
 * - input.params.field -> input["params"]["field"]
 * - node.id -> node["id"]
 * - inputs.nodeId.json.field -> inputs["nodeId"]["json"]["field"]
 */
function convertCustomSyntaxToCEL(expression: string): string {
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

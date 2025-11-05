/**
 * JSONata Expression Evaluator
 *
 * Evaluates JSONata expressions for node properties
 * Provides safe sandboxed evaluation with access to workflow context
 */

import type { Expression } from "jsonata";
import jsonata from "jsonata";

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
 * Evaluate a JSONata expression with the given context
 */
export async function evaluateExpression(
  expression: string,
  context: ExpressionContext,
): Promise<EvaluationResult> {
  try {
    // Trim whitespace from expression
    const trimmedExpression = expression.trim();
    const compiled = getCachedExpression(trimmedExpression);

    // JSONata's evaluate() returns a Promise - must await it
    const result = await compiled.evaluate(context);

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
 * Check if a string contains expressions ({{ ... }})
 */
export function hasExpressions(value: string): boolean {
  if (typeof value !== "string") return false;
  return /\$\{[^}]+\}|\{\{[^}]+\}\}/.test(value);
}

/**
 * Extract expressions from a template string
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
 * Evaluate a template string by replacing JSONata expressions with their evaluated values
 * Supports both {{expression}} and ${expression} syntax
 *
 * Example:
 *   "Hello {{$parameters.name}}, you have {{$json.count}} items"
 *   with context { $parameters: { name: "Alice" }, $json: { count: 5 } }
 *   returns: "Hello Alice, you have 5 items"
 */
export async function evaluateTemplate(
  template: string,
  context: ExpressionContext,
): Promise<EvaluationResult> {
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
      const evaluation = await evaluateExpression(expression, context);

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
 * Returns evaluated copy with all JSONata expressions resolved
 */
export async function evaluateProperties(
  properties: Record<string, any>,
  context: ExpressionContext,
): Promise<{ success: boolean; values?: Record<string, any>; error?: string }> {
  const evaluated: Record<string, any> = {};

  try {
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === "string" && hasExpressions(value)) {
        // Evaluate string templates
        const result = await evaluateTemplate(value, context);
        if (!result.success) {
          return {
            success: false,
            error: `Property "${key}": ${result.error}`,
          };
        }
        evaluated[key] = result.value;
      } else if (typeof value === "object" && value !== null) {
        // Recursively handle nested objects (but not arrays for now)
        const nested = await evaluateProperties(value, context);
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
 * Validate a JSONata expression without executing it
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

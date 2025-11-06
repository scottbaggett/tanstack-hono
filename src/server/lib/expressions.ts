/**
 * JavaScript Expression Evaluator (n8n-style)
 *
 * Evaluates JavaScript expressions for node properties
 * Simple, powerful, and familiar to users
 * Works in both browser and server environments
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ExpressionContext {
  // Simple flat structure - node names become camelCase variables
  // Example: "Manual Trigger" → manualTrigger.prompt
  // Example: "HTTP Request" → httpRequest.statusCode
  [nodeName: string]: any;
}

export interface EvaluationResult {
  success: boolean;
  value?: any;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a node name to camelCase variable name
 * "Manual Trigger" → "manualTrigger"
 * "HTTP Request 2" → "httpRequest2"
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

// ============================================================================
// EVALUATION
// ============================================================================

/**
 * Evaluate a JavaScript expression with the given context
 *
 * Examples:
 *   manualTrigger.prompt
 *   manualTrigger.max_length * 2
 *   httpRequest.statusCode === 200 ? 'success' : 'failed'
 *   workflow.name + ' - ' + dates.today
 */
export async function evaluateExpression(
  expression: string,
  context: ExpressionContext,
): Promise<EvaluationResult> {
  try {
    // Trim whitespace from expression
    const trimmedExpression = expression.trim();

    // Create parameter names and values from context
    const paramNames = Object.keys(context);
    const paramValues = Object.values(context);

    // Non-reserved globals we can shadow as parameters
    // Note: 'eval' and 'arguments' can't be shadowed in strict mode
    const shadowableGlobals = [
      'window',
      'document',
      'global',
      'process',
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'alert',
      'confirm',
      'prompt',
      'print',
      'open',
      'close',
      'location',
      'navigator',
      'history',
      'console',
      'performance',
      'requestAnimationFrame',
      'setInterval',
      'setTimeout',
      'clearInterval',
      'clearTimeout',
    ];

    // Create a function with shadowable globals and context variables as parameters
    // Reserved keywords (import, require, Function, etc.) can't be parameter names,
    // but they're already blocked in strict mode or won't work in this context
    const fn = new Function(
      ...shadowableGlobals,
      ...paramNames,
      'JSON',
      'Math',
      'Date',
      'String',
      'Number',
      'Boolean',
      'Array',
      'Object',
      `"use strict"; return (${trimmedExpression});`
    );

    // Execute the function with undefined for blocked globals, context values, and safe globals
    const result = fn(
      ...shadowableGlobals.map(() => undefined),
      ...paramValues,
      JSON,
      Math,
      Date,
      String,
      Number,
      Boolean,
      Array,
      Object
    );

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
 * Validate a JavaScript expression without executing it
 */
export function validateExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  try {
    // Try to create a function with the expression to check syntax
    new Function(`return (${expression})`);
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


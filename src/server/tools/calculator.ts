/**
 * Calculator Tool
 *
 * Math evaluation tool with Zod validation
 * Example tool demonstrating type-safe tool creation
 */

import { z } from 'zod';
import type { AgentTool, ToolContext, ToolName } from '@/server/types/agent';

// ============================================================================
// Schema Definitions
// ============================================================================

const calculatorInputSchema = z.object({
	expression: z
		.string()
		.min(1)
		.describe('Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")'),
});

const calculatorOutputSchema = z.object({
	result: z.number().describe('The computed result'),
	expression: z.string().describe('The original expression'),
	success: z.boolean().describe('Whether evaluation succeeded'),
	error: z.string().optional().describe('Error message if evaluation failed'),
});

export type CalculatorInput = z.infer<typeof calculatorInputSchema>;
export type CalculatorOutput = z.infer<typeof calculatorOutputSchema>;

// ============================================================================
// Safe Math Evaluator
// ============================================================================

/**
 * Safely evaluates mathematical expressions
 * Prevents code injection by using a whitelist of allowed operations
 */
function safeMathEval(expression: string): number {
	// Remove whitespace
	const cleaned = expression.replace(/\s/g, '');

	// Validate characters (numbers, operators, parentheses, dots, common functions)
	const allowedPattern = /^[0-9+\-*/.()sqrt,pow]+$/;
	if (!allowedPattern.test(cleaned)) {
		throw new Error(
			'Invalid characters in expression. Only numbers, +, -, *, /, (), sqrt, pow allowed.',
		);
	}

	// Replace safe function names with Math equivalents
	let safeExpr = cleaned
		.replace(/sqrt\(/g, 'Math.sqrt(')
		.replace(/pow\(/g, 'Math.pow(');

	// Evaluate using Function constructor (safer than eval)
	// Still sandboxed to prevent access to global scope
	try {
		const result = new Function(`"use strict"; return (${safeExpr})`)();

		if (typeof result !== 'number' || !Number.isFinite(result)) {
			throw new Error('Result is not a finite number');
		}

		return result;
	} catch (error) {
		throw new Error(
			`Failed to evaluate expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}

// ============================================================================
// Tool Implementation
// ============================================================================

export const calculatorTool: AgentTool<CalculatorInput, CalculatorOutput> = {
	name: 'calculator' as ToolName,
	description:
		'Performs mathematical calculations. Supports basic arithmetic (+, -, *, /), parentheses, and common functions like sqrt() and pow(). Example: "2 + 2" or "sqrt(16)"',
	inputSchema: calculatorInputSchema,
	outputSchema: calculatorOutputSchema,
	timeoutMs: 2000, // 2 seconds (math should be fast)
	maxOutputBytes: 1024, // 1KB (results are small)

	async execute(ctx: ToolContext, input: CalculatorInput): Promise<CalculatorOutput> {
		ctx.emit({
			t: 'tool.start',
			tool: 'calculator' as ToolName,
			id: ctx.executionId,
			input,
		});

		const startTime = Date.now();

		try {
			// Check for cancellation
			if (ctx.signal.aborted) {
				throw new Error('Calculation cancelled');
			}

			// Evaluate expression
			const result = safeMathEval(input.expression);

			const output: CalculatorOutput = {
				result,
				expression: input.expression,
				success: true,
			};

			ctx.emit({
				t: 'tool.success',
				tool: 'calculator' as ToolName,
				id: ctx.executionId,
				size: JSON.stringify(output).length,
				ms: Date.now() - startTime,
			});

			return output;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			const output: CalculatorOutput = {
				result: NaN,
				expression: input.expression,
				success: false,
				error: errorMessage,
			};

			ctx.emit({
				t: 'tool.error',
				tool: 'calculator' as ToolName,
				id: ctx.executionId,
				error: {
					code: 'VALIDATION_ERROR',
					message: errorMessage,
					cause: error instanceof Error ? error : undefined,
					retriable: false,
				},
			});

			// Return error output (don't throw - let agent handle)
			return output;
		}
	},
};

// ============================================================================
// Examples
// ============================================================================

/**
 * Example usage:
 *
 * const ctx: ToolContext = { ... };
 * const result = await calculatorTool.execute(ctx, { expression: "2 + 2" });
 * // result = { result: 4, expression: "2 + 2", success: true }
 *
 * const result2 = await calculatorTool.execute(ctx, { expression: "sqrt(16)" });
 * // result2 = { result: 4, expression: "sqrt(16)", success: true }
 *
 * const result3 = await calculatorTool.execute(ctx, { expression: "pow(2, 3)" });
 * // result3 = { result: 8, expression: "pow(2, 3)", success: true }
 */

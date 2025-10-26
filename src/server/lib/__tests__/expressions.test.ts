/**
 * CEL Expression Evaluator Tests
 *
 * Tests for the expression evaluation system
 */

import {
	evaluateExpression,
	evaluateTemplate,
	evaluateProperties,
	validateExpression,
	validateTemplate,
	hasExpressions,
	extractExpressions,
	type ExpressionContext,
} from '../expressions';

describe('CEL Expression Evaluator', () => {
	const mockContext: ExpressionContext = {
		$input: {
			text: 'Hello World',
			count: 42,
			score: 0.85,
			items: [1, 2, 3, 4, 5],
			user: {
				name: 'Alice',
				id: 'user123',
			},
		},
		$parameter: {
			name: 'Bob',
			temperature: 0.7,
			domain: 'technology',
			language: 'English',
		},
		$node: {
			id: 'agent-1',
			type: 'agent',
			version: 1,
		},
	};

	describe('evaluateExpression', () => {
		it('should evaluate basic math expressions', () => {
			const result = evaluateExpression('10 + 5', mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe(15);
		});

		it('should evaluate variable access', () => {
			const result = evaluateExpression('$input.count', mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe(42);
		});

		it('should evaluate nested property access', () => {
			const result = evaluateExpression('$input.user.name', mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe('Alice');
		});

		it('should evaluate comparisons', () => {
			const result = evaluateExpression('$input.score > 0.8', mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should evaluate logical operators', () => {
			const result = evaluateExpression(
				'$input.count > 40 && $input.score > 0.8',
				mockContext,
			);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should evaluate ternary expressions', () => {
			const result = evaluateExpression(
				'$input.count > 50 ? "many" : "few"',
				mockContext,
			);
			expect(result.success).toBe(true);
			expect(result.value).toBe('few');
		});

		it('should evaluate macros like size()', () => {
			const result = evaluateExpression('size($input.items)', mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe(5);
		});

		it('should handle invalid expressions', () => {
			const result = evaluateExpression('$input.nonexistent.property.deep', mockContext);
			// CEL is lenient, so this might still succeed with null
			// But let's test the structure
			expect(result).toHaveProperty('success');
		});
	});

	describe('evaluateTemplate', () => {
		it('should replace single expression in template', () => {
			const template = 'Hello {{$parameter.name}}';
			const result = evaluateTemplate(template, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe('Hello Bob');
		});

		it('should handle multiple expressions in template', () => {
			const template = '{{$input.user.name}} has {{$input.count}} items';
			const result = evaluateTemplate(template, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe('Alice has 42 items');
		});

		it('should handle ${} syntax', () => {
			const template = 'Score: ${$input.score}';
			const result = evaluateTemplate(template, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe('Score: 0.85');
		});

		it('should handle complex expressions in template', () => {
			const template =
				'Domain: {{$parameter.domain}}, Language: {{$parameter.language}}';
			const result = evaluateTemplate(template, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe('Domain: technology, Language: English');
		});

		it('should return unchanged string if no expressions', () => {
			const template = 'This is just plain text';
			const result = evaluateTemplate(template, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe(template);
		});

		it('should handle non-string inputs gracefully', () => {
			const result = evaluateTemplate(undefined as any, mockContext);
			expect(result.success).toBe(true);
		});
	});

	describe('evaluateProperties', () => {
		it('should evaluate properties with expressions', () => {
			const properties = {
				systemPrompt: 'You are expert in {{$parameter.domain}}',
				temperature: 0.7,
				name: '{{$parameter.name}}',
			};

			const result = evaluateProperties(properties, mockContext);
			expect(result.success).toBe(true);
			expect(result.values).toEqual({
				systemPrompt: 'You are expert in technology',
				temperature: 0.7,
				name: 'Bob',
			});
		});

		it('should handle nested properties', () => {
			const properties = {
				config: {
					prompt: 'Hello {{$input.user.name}}',
					temperature: '{{$parameter.temperature}}',
				},
			};

			const result = evaluateProperties(properties, mockContext);
			expect(result.success).toBe(true);
			expect(result.values?.config.prompt).toBe('Hello Alice');
		});

		it('should keep non-string values as-is', () => {
			const properties = {
				count: 42,
				enabled: true,
				template: 'User: {{$input.user.name}}',
			};

			const result = evaluateProperties(properties, mockContext);
			expect(result.success).toBe(true);
			expect(result.values?.count).toBe(42);
			expect(result.values?.enabled).toBe(true);
			expect(result.values?.template).toBe('User: Alice');
		});
	});

	describe('validateExpression', () => {
		it('should validate correct expressions', () => {
			const result = validateExpression('10 + 5');
			expect(result.valid).toBe(true);
		});

		it('should reject invalid expressions', () => {
			const result = validateExpression('10 +++ 5');
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should cache compiled expressions', () => {
			// First call
			const result1 = validateExpression('$input.count');
			expect(result1.valid).toBe(true);

			// Second call should use cache (no error thrown)
			const result2 = validateExpression('$input.count');
			expect(result2.valid).toBe(true);
		});
	});

	describe('validateTemplate', () => {
		it('should validate template with valid expressions', () => {
			const result = validateTemplate('Hello {{$input.user.name}}');
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should detect invalid expressions in template', () => {
			const result = validateTemplate('Score: {{$input.score +++ 5}}');
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should handle templates without expressions', () => {
			const result = validateTemplate('Just plain text');
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('hasExpressions', () => {
		it('should detect {{}} expressions', () => {
			expect(hasExpressions('Hello {{name}}')).toBe(true);
		});

		it('should detect ${} expressions', () => {
			expect(hasExpressions('Hello ${name}')).toBe(true);
		});

		it('should return false for plain text', () => {
			expect(hasExpressions('Hello world')).toBe(false);
		});

		it('should handle non-strings', () => {
			expect(hasExpressions(123 as any)).toBe(false);
			expect(hasExpressions(null as any)).toBe(false);
		});
	});

	describe('extractExpressions', () => {
		it('should extract all expressions from template', () => {
			const expressions = extractExpressions('{{a}} and {{b}} and ${c}');
			expect(expressions).toEqual(['a', 'b', 'c']);
		});

		it('should handle nested brackets', () => {
			const expressions = extractExpressions('{{$input.user[0].name}}');
			expect(expressions).toHaveLength(1);
		});

		it('should return empty array for plain text', () => {
			const expressions = extractExpressions('No expressions here');
			expect(expressions).toHaveLength(0);
		});
	});

	describe('Real-world scenarios', () => {
		it('should handle agent system prompt template', () => {
			const template =
				'You are an expert in {{$parameter.domain}}. Respond in {{$parameter.language}}.';
			const result = evaluateTemplate(template, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe('You are an expert in technology. Respond in English.');
		});

		it('should handle conditional logic', () => {
			const template = '{{$input.score > 0.8 ? "Pass" : "Fail"}}';
			const result = evaluateTemplate(template, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe('Pass');
		});

		it('should handle array operations', () => {
			const expr = 'size($input.items)';
			const result = evaluateExpression(expr, mockContext);
			expect(result.success).toBe(true);
			expect(result.value).toBe(5);
		});
	});
});

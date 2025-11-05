/**
 * Expression System Test
 *
 * Tests the JSONata-based expression system with $ prefix variables
 */

import { describe, expect, it } from "vitest";
import { evaluateTemplate } from "../expressions";

describe("Expression System", () => {
	it("should access simple $json property", async () => {
		const result = await evaluateTemplate("{{ $json.text }}", {
			$json: { text: "Hello World" },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("Hello World");
	});

	it("should access nested property", async () => {
		const result = await evaluateTemplate("{{ $json.result.message }}", {
			$json: { result: { message: "Success!" } },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("Success!");
	});

	it("should handle template with multiple references", async () => {
		const result = await evaluateTemplate(
			"Exit code: {{ $json.exitCode }}, Output: {{ $json.stdout }}",
			{ $json: { exitCode: 0, stdout: "Hello!" } },
		);
		expect(result.success).toBe(true);
		expect(result.value).toBe("Exit code: 0, Output: Hello!");
	});

	it("should access $parameters", async () => {
		const result = await evaluateTemplate("{{ $parameters.command }}", {
			$parameters: { command: 'echo "test"' },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe('echo "test"');
	});

	it("should access $item[0]", async () => {
		const result = await evaluateTemplate("{{ $item[0].json.text }}", {
			$item: [{ json: { text: "First item" }, binary: {} }],
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("First item");
	});

	it("should access $items by node name", async () => {
		const result = await evaluateTemplate(
			'{{ $items["HTTP Request"][0].json.statusCode }}',
			{
				$items: {
					"HTTP Request": [{ json: { statusCode: 200 }, binary: {} }],
				},
			},
		);
		expect(result.success).toBe(true);
		expect(result.value).toBe(200);
	});

	it("should handle missing properties gracefully", async () => {
		const result = await evaluateTemplate("{{ $json.missing }}", {
			$json: { existing: "value" },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBeUndefined();
	});

	it("should handle empty context", async () => {
		const result = await evaluateTemplate("{{ $json.anything }}", {});
		expect(result.success).toBe(true);
		expect(result.value).toBeUndefined();
	});

	it("should support array indexing", async () => {
		const result = await evaluateTemplate("{{ $json.items[0] }}", {
			$json: { items: ["first", "second", "third"] },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("first");
	});

	it("should support arithmetic operations", async () => {
		const result = await evaluateTemplate("{{ $json.count * 2 }}", {
			$json: { count: 5 },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe(10);
	});

	it("should support string concatenation", async () => {
		const result = await evaluateTemplate(
			'{{ $json.firstName & " " & $json.lastName }}',
			{
				$json: { firstName: "John", lastName: "Doe" },
			},
		);
		expect(result.success).toBe(true);
		expect(result.value).toBe("John Doe");
	});

	it("should support ternary conditionals", async () => {
		const result = await evaluateTemplate(
			"{{ $json.score > 80 ? 'pass' : 'fail' }}",
			{
				$json: { score: 85 },
			},
		);
		expect(result.success).toBe(true);
		expect(result.value).toBe("pass");
	});

	it("should handle complex nested access", async () => {
		const result = await evaluateTemplate(
			'{{ $items["API Call"][0].json.data.user.profile.email }}',
			{
				$items: {
					"API Call": [
						{
							json: {
								data: {
									user: {
										profile: {
											email: "user@example.com",
										},
									},
								},
							},
							binary: {},
						},
					],
				},
			},
		);
		expect(result.success).toBe(true);
		expect(result.value).toBe("user@example.com");
	});

	it("should handle invalid expressions", async () => {
		const result = await evaluateTemplate("{{ $json.field ++ }}", {
			$json: { field: "value" },
		});
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

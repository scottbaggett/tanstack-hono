/**
 * Expression System Test
 *
 * Tests the new json/binary/input accessor pattern (no $ prefix)
 */

import { describe, expect, it } from "vitest";
import { evaluateTemplate } from "../expressions";

describe("Expression System", () => {
	it("should access simple json property", () => {
		const result = evaluateTemplate("{{ json.text }}", {
			json: { text: "Hello World" },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("Hello World");
	});

	it("should access nested property", () => {
		const result = evaluateTemplate("{{ json.result.message }}", {
			json: { result: { message: "Success!" } },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("Success!");
	});

	it("should handle template with multiple references", () => {
		const result = evaluateTemplate(
			"Exit code: {{ json.exitCode }}, Output: {{ json.stdout }}",
			{ json: { exitCode: 0, stdout: "Hello!" } },
		);
		expect(result.success).toBe(true);
		expect(result.value).toBe("Exit code: 0, Output: Hello!");
	});

	it("should access input.params", () => {
		const result = evaluateTemplate("{{ input.params.command }}", {
			input: { params: { command: 'echo "test"' } },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe('echo "test"');
	});

	it("should access binary data", () => {
		const result = evaluateTemplate("{{ binary.file }}", {
			binary: { file: "data.txt" },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("data.txt");
	});

	it("should access node metadata", () => {
		const result = evaluateTemplate("Node: {{ node.id }} ({{ node.type }})", {
			node: { id: "node123", type: "executeCommand", version: 1 },
		});
		expect(result.success).toBe(true);
		expect(result.value).toBe("Node: node123 (executeCommand)");
	});

	it("should handle missing properties gracefully", () => {
		const result = evaluateTemplate("{{ json.missing }}", {
			json: { existing: "value" },
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("field not found: missing");
	});

	it("should handle empty context", () => {
		const result = evaluateTemplate("{{ json.anything }}", {});
		expect(result.success).toBe(false);
		expect(result.error).toContain("unresolved attribute");
	});
});

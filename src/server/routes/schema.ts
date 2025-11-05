/**
 * Schema API Routes
 *
 * Endpoints for schema generation and validation
 */

import { zValidator } from "@hono/zod-validator";
import { ChatOpenAI } from "@langchain/openai";
import { Hono } from "hono";
import { z } from "zod";

const schemaRoutes = new Hono();

// Request validation schema
const generateSchemaRequestSchema = z.object({
	prompt: z.string().min(1, "Prompt is required"),
	model: z.string().optional().default("gpt-4o-mini"),
});

/**
 * POST /schema/generate - Generate JSON schema from prompt
 */
schemaRoutes.post(
	"/generate",
	zValidator("json", generateSchemaRequestSchema),
	async (c) => {
		try {
			const { prompt, model } = c.req.valid("json");

			// Get API key from environment
			const apiKey = process.env.OPENAI_API_KEY;
			if (!apiKey) {
				return c.json(
					{
						success: false,
						error:
							"OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
					},
					500,
				);
			}

			// Create OpenAI client
			const llm = new ChatOpenAI({
				modelName: model,
				temperature: 0.7,
				openAIApiKey: apiKey,
			});

			// System prompt for schema generation
			const systemPrompt = `You are a JSON schema expert. Generate a valid JSON schema based on the user's description.

Return ONLY a JSON object with this structure:
{
  "name": "schema_name",
  "description": "brief description",
  "properties": {
    "property_name": {
      "type": "string" | "number" | "boolean" | "object" | "array",
      "description": "property description"
    }
  }
}

Rules:
- Use snake_case for schema and property names
- Keep descriptions concise and clear
- Only use these types: string, number, boolean, object, array
- Include at least 2-5 relevant properties
- Do not include any markdown, code blocks, or explanations
- Return ONLY the JSON object`;

			// Call LLM to generate schema
			const response = await llm.invoke([
				{ role: "system", content: systemPrompt },
				{ role: "user", content: prompt },
			]);

			// Parse the response content
			const content = response.content.toString().trim();

			// Remove markdown code blocks if present
			const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
			const jsonString = jsonMatch ? jsonMatch[1] : content;

			try {
				const schema = JSON.parse(jsonString);

				// Validate schema structure
				if (!schema.name || !schema.properties) {
					return c.json(
						{
							success: false,
							error:
								"Generated schema is missing required fields (name, properties)",
						},
						500,
					);
				}

				return c.json({
					success: true,
					data: schema,
				});
			} catch (parseError) {
				console.error("Failed to parse LLM response:", content);
				return c.json(
					{
						success: false,
						error: "Failed to parse generated schema as JSON",
						details:
							parseError instanceof Error
								? parseError.message
								: "Unknown error",
					},
					500,
				);
			}
		} catch (error) {
			console.error("Schema generation error:", error);
			return c.json(
				{
					success: false,
					error:
						error instanceof Error
							? error.message
							: "Failed to generate schema",
				},
				500,
			);
		}
	},
);

export default schemaRoutes;

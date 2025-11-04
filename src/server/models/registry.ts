/**
 * Model Registry
 *
 * Centralized configuration for all supported LLM models
 * Includes capabilities, parameter ranges, and provider information
 */

import type { ModelConfig, ModelRegistry } from "./types";

export const MODEL_REGISTRY: ModelRegistry = {
	// OpenAI GPT-5 series
	"gpt-5": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 8192, default: 2048 },
			reasoning_effort: {
				type: "enum",
				values: ["minimal", "low", "medium", "high"],
				default: "medium",
			},
			verbosity: {
				type: "enum",
				values: ["low", "medium", "high"],
				default: "medium",
			},
			reasoning_summary: {
				type: "enum",
				values: ["auto", "concise", "detailed"],
				default: "auto",
			},
		},
	},
	"gpt-5-pro": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 16384, default: 4096 },
			reasoning_effort: { type: "enum", values: ["high"], default: "high" },
			verbosity: {
				type: "enum",
				values: ["low", "medium", "high"],
				default: "medium",
			},
			preamble: { type: "bool", default: false },
		},
	},
	"gpt-5-codex": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 8192, default: 2048 },
			reasoning_effort: {
				type: "enum",
				values: ["low", "medium", "high"],
				default: "medium",
			},
			verbosity: {
				type: "enum",
				values: ["low", "medium", "high"],
				default: "medium",
			},
		},
	},
	"gpt-5-mini": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 4096, default: 1024 },
			reasoning_effort: {
				type: "enum",
				values: ["minimal", "low", "medium"],
				default: "low",
			},
			verbosity: {
				type: "enum",
				values: ["low", "medium", "high"],
				default: "medium",
			},
		},
	},
	"gpt-5-nano": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 2048, default: 512 },
			reasoning_effort: {
				type: "enum",
				values: ["minimal", "low"],
				default: "minimal",
			},
			verbosity: {
				type: "enum",
				values: ["low", "medium"],
				default: "medium",
			},
		},
	},

	// OpenAI O-series
	"o3-pro": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 8192, default: 2048 },
			reasoning_effort: {
				type: "enum",
				values: ["low", "medium", "high"],
				default: "medium",
			},
		},
	},
	"o3-mini": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 4096, default: 1024 },
			reasoning_effort: {
				type: "enum",
				values: ["low", "medium"],
				default: "low",
			},
		},
	},
	"o4-mini": {
		provider: "openai",
		supports_temp: false,
		valid_params: {
			max_completion_tokens: { type: "int", min: 1, max: 4096, default: 1024 },
			reasoning_effort: {
				type: "enum",
				values: ["low", "medium", "high"],
				default: "medium",
			},
		},
	},

	// Anthropic Claude 4.5 series
	"claude-opus-4-1": {
		provider: "anthropic",
		supports_temp: true,
		valid_params: {
			temperature: { type: "float", range: [0, 1], default: 0.5 },
			top_p: { type: "float", range: [0, 1], default: 0.9 },
			max_tokens: { type: "int", min: 1, max: 8192, default: 2048 },
			top_k: { type: "int", min: 1, max: 500, default: 5 },
		},
	},
	"claude-sonnet-4-5": {
		provider: "anthropic",
		supports_temp: true,
		valid_params: {
			temperature: { type: "float", range: [0, 1], default: 0.5 },
			top_p: { type: "float", range: [0, 1], default: 0.9 },
			top_k: { type: "int", min: 1, max: 500, default: 5 },
			max_tokens: { type: "int", min: 1, max: 8192, default: 1024 },
		},
	},
	"claude-haiku-4-5": {
		provider: "anthropic",
		supports_temp: true,
		valid_params: {
			temperature: { type: "float", range: [0, 1], default: 0.5 },
			top_p: { type: "float", range: [0, 1], default: 0.9 },
			top_k: { type: "int", min: 1, max: 500, default: 5 },
			max_tokens: { type: "int", min: 1, max: 4096, default: 512 },
		},
	},

	// Google Gemini 2.5 series
	"gemini-2.5-pro": {
		provider: "google",
		supports_temp: true,
		valid_params: {
			temperature: { type: "float", range: [0.0, 2.0], default: 1.0 },
			top_p: { type: "float", range: [0.0, 1.0], default: 0.95 },
			top_k: { type: "int", min: 1, max: 40, default: 20 },
			max_output_tokens: { type: "int", min: 1, max: 8192, default: 500 },
			frequency_penalty: { type: "float", range: [-2.0, 2.0], default: 0.0 },
			presence_penalty: { type: "float", range: [-2.0, 2.0], default: 0.0 },
		},
	},
	"gemini-2.5-flash": {
		provider: "google",
		supports_temp: true,
		valid_params: {
			temperature: { type: "float", range: [0.0, 2.0], default: 1.0 },
			top_p: { type: "float", range: [0.0, 1.0], default: 0.95 },
			top_k: { type: "int", min: 1, max: 40, default: 20 },
			max_output_tokens: { type: "int", min: 1, max: 8192, default: 500 },
			frequency_penalty: { type: "float", range: [-2.0, 2.0], default: 0.0 },
			presence_penalty: { type: "float", range: [-2.0, 2.0], default: 0.0 },
		},
	},
	"gemini-2.5-flash-lite": {
		provider: "google",
		supports_temp: true,
		valid_params: {
			temperature: { type: "float", range: [0.0, 2.0], default: 1.0 },
			top_p: { type: "float", range: [0.0, 1.0], default: 0.9 },
			top_k: { type: "int", min: 1, max: 40, default: 20 },
			max_output_tokens: { type: "int", min: 1, max: 8192, default: 500 },
			frequency_penalty: { type: "float", range: [-2.0, 2.0], default: 0.0 },
			presence_penalty: { type: "float", range: [-2.0, 2.0], default: 0.0 },
		},
	},
	"gemini-2.5-flash-native-audio": {
		provider: "google",
		supports_temp: true,
		valid_params: {
			temperature: { type: "float", range: [0.0, 2.0], default: 1.0 },
			top_p: { type: "float", range: [0.0, 1.0], default: 0.95 },
			top_k: { type: "int", min: 1, max: 40, default: 20 },
			max_output_tokens: { type: "int", min: 1, max: 8192, default: 500 },
		},
	},
};

/**
 * Get model configuration by name
 */
export function getModel(modelName: string): ModelConfig | null {
	return MODEL_REGISTRY[modelName] || null;
}

/**
 * Get all models for a specific provider
 */
export function getModelsByProvider(provider: string) {
	return Object.entries(MODEL_REGISTRY)
		.filter(([_, config]) => config.provider === provider)
		.map(([name, config]) => ({ name, ...config }));
}

/**
 * Get all available model names
 */
export function getModelNames(): string[] {
	return Object.keys(MODEL_REGISTRY);
}

/**
 * Validate model parameters against the model's configuration
 */
export function validateModelParams(
	modelName: string,
	params: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
	const model = getModel(modelName);
	if (!model) {
		return { valid: false, errors: [`Model "${modelName}" not found`] };
	}

	const errors: string[] = [];

	for (const [paramName, paramValue] of Object.entries(params)) {
		// Skip temperature check if model doesn't support it
		if (paramName === "temperature" && !model.supports_temp) {
			errors.push(
				`Model "${modelName}" does not support temperature parameter`,
			);
			continue;
		}

		const paramConfig = model.valid_params?.[paramName];
		if (!paramConfig) {
			errors.push(
				`Parameter "${paramName}" is not valid for model "${modelName}"`,
			);
			continue;
		}

		// Type validation
		switch (paramConfig.type) {
			case "int": {
				if (typeof paramValue !== "number" || !Number.isInteger(paramValue)) {
					errors.push(`Parameter "${paramName}" must be an integer`);
					break;
				}
				if (paramConfig.min !== undefined && paramValue < paramConfig.min) {
					errors.push(`Parameter "${paramName}" must be >= ${paramConfig.min}`);
				}
				if (paramConfig.max !== undefined && paramValue > paramConfig.max) {
					errors.push(`Parameter "${paramName}" must be <= ${paramConfig.max}`);
				}
				break;
			}
			case "float": {
				if (typeof paramValue !== "number") {
					errors.push(`Parameter "${paramName}" must be a number`);
					break;
				}
				if (paramConfig.range) {
					const [min, max] = paramConfig.range;
					if (paramValue < min || paramValue > max) {
						errors.push(
							`Parameter "${paramName}" must be between ${min} and ${max}`,
						);
					}
				}
				break;
			}
			case "bool": {
				if (typeof paramValue !== "boolean") {
					errors.push(`Parameter "${paramName}" must be a boolean`);
				}
				break;
			}
			case "enum": {
				if (!paramConfig.values?.includes(String(paramValue))) {
					errors.push(
						`Parameter "${paramName}" must be one of: ${paramConfig.values?.join(", ")}`,
					);
				}
				break;
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Get default parameters for a model
 */
export function getModelDefaults(modelName: string): Record<string, unknown> {
	const model = getModel(modelName);
	if (!model) {
		return {};
	}

	const defaults: Record<string, unknown> = {};
	if (model.valid_params) {
		for (const [paramName, paramConfig] of Object.entries(model.valid_params)) {
			if (paramConfig.default !== undefined) {
				defaults[paramName] = paramConfig.default;
			}
		}
	}

	return defaults;
}

/**
 * Helper to check if a model supports a specific parameter
 */
export function modelSupportsParam(
	config: ModelConfig | null | undefined,
	paramName: string,
): boolean {
	if (!config) return false;

	if (paramName === "temperature") {
		return config.supports_temp;
	}

	return config.valid_params?.[paramName] !== undefined;
}

/**
 * Helper to get temperature range for a model
 */
export function getTemperatureRange(
	config: ModelConfig | null | undefined,
): [number, number] {
	if (!config?.supports_temp) return [0, 1];

	const tempConfig = config.valid_params?.temperature;
	if (tempConfig?.range) {
		return tempConfig.range as [number, number];
	}

	return [0, 1]; // Default range
}

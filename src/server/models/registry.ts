/**
 * Model Registry
 *
 * Centralized configuration for all supported LLM models
 * Includes capabilities, parameter ranges, and provider information
 */

export interface ParamConfig {
	type: "int" | "float" | "enum" | "bool";
	min?: number;
	max?: number;
	range?: [number, number];
	values?: string[]; // For enum type
	default?: unknown;
}

export interface ModelConfig {
	provider: "openai" | "anthropic" | "google";
	supports_temp: boolean;
	valid_params?: Record<string, ParamConfig>;
}

export type ModelRegistry = Record<string, ModelConfig>;

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
 * Helper to check if a model supports a specific parameter
 */
export function modelSupportsParam(
	config: ModelConfig | null | undefined,
	paramName: string
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
	config: ModelConfig | null | undefined
): [number, number] {
	if (!config?.supports_temp) return [0, 1];

	const tempConfig = config.valid_params?.temperature;
	if (tempConfig?.range) {
		return tempConfig.range as [number, number];
	}

	return [0, 1]; // Default range
}

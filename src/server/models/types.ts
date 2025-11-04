/**
 * Model Registry Types
 *
 * Type definitions for LLM model configurations
 */

export type ModelProvider = "openai" | "anthropic" | "google";

export type ParameterType = "int" | "float" | "bool" | "enum";

export interface ParamConfig {
	type: ParameterType;
	default?: unknown;
	min?: number;
	max?: number;
	range?: [number, number];
	values?: string[];
}

export interface ModelConfig {
	provider: ModelProvider;
	supports_temp: boolean;
	valid_params?: Record<string, ParamConfig>;
}

export type ModelRegistry = Record<string, ModelConfig>;

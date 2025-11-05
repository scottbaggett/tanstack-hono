/**
 * Model Registry Hook
 *
 * React Query hook for fetching and accessing the model registry
 * Provides model capabilities and parameter configurations
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import {
	getTemperatureRange,
	modelSupportsParam,
} from "@/server/models/registry";
import type { ModelRegistry } from "@/server/models/types";

/**
 * Fetch model registry from the backend
 */
async function fetchModelRegistry(): Promise<ModelRegistry> {
	const response = await apiRequest<{
		models: ModelRegistry;
		total: number;
	}>("/api/models", { method: "GET" });

	if (!response.success) {
		throw new Error(response.error || "Failed to fetch model registry");
	}

	if (!response.data?.models) {
		throw new Error('Invalid model registry response - missing "models" field');
	}

	return response.data.models;
}

/**
 * Hook to access the complete model registry
 */
export function useModelRegistry() {
	return useQuery({
		queryKey: ["modelRegistry"],
		queryFn: fetchModelRegistry,
		staleTime: 1000 * 60 * 5, // Cache for 5 minutes
	});
}

/**
 * Hook to get configuration for a specific model
 */
export function useModelConfig(modelName: string | undefined) {
	const {
		data: registry,
		isLoading,
		isError,
		error,
		...query
	} = useModelRegistry();

	const modelConfig = modelName && registry ? registry[modelName] : null;

	// Log if model not found in registry
	if (modelName && registry && !modelConfig) {
		console.warn(
			`Model "${modelName}" not found in registry. Available models:`,
			Object.keys(registry),
		);
	}

	return {
		...query,
		isLoading,
		isError,
		error,
		modelConfig,
		isReady: query.isSuccess && !!modelConfig,
	};
}

/**
 * Helper to check if a model supports a specific parameter
 * Re-exported from server for convenience
 */
export { modelSupportsParam, getTemperatureRange };

/**
 * Get all available model names
 */
export function useAvailableModels() {
	const { data: registry, isLoading, isError, error } = useModelRegistry();

	return {
		models: registry ? Object.keys(registry) : [],
		isLoading,
		isError,
		error,
	};
}

/**
 * Get models filtered by provider
 */
export function useModelsByProvider(
	provider: "openai" | "anthropic" | "google",
) {
	const { data: registry, isLoading, isError, error } = useModelRegistry();

	const models = registry
		? Object.entries(registry)
				.filter(([, config]) => config.provider === provider)
				.map(([name, config]) => ({ name, config }))
		: [];

	return {
		models,
		isLoading,
		isError,
		error,
	};
}

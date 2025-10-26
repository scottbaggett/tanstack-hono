/**
 * Node Registry Hook
 *
 * React Query hook for fetching available node definitions from the backend
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface NodeInput {
	displayName: string;
	name: string;
	type: string;
	required?: boolean;
	description?: string;
}

export interface NodeOutput {
	displayName: string;
	name: string;
	type: string;
	description?: string;
}

export interface NodeProperty {
	displayName: string;
	name: string;
	type: "string" | "number" | "boolean" | "options" | "credentials" | "json";
	description?: string;
	required?: boolean;
	default?: unknown;
	options?: Array<{ name: string; value: unknown }>;
	placeholder?: string;
	hint?: string;
}

export interface NodeDefinition {
	id: string;
	displayName: string;
	description?: string;
	category: string;
	icon: string;
	color?: string;
	version: number;
	inputs: NodeInput[];
	outputs: NodeOutput[];
	properties: NodeProperty[];
	documentation?: {
		url?: string;
		description?: string;
		examples?: Array<{
			title: string;
			description?: string;
			image?: string;
		}>;
	};
}

interface NodesResponse {
	success: boolean;
	data: {
		nodes: NodeDefinition[];
		byCategory: Record<string, NodeDefinition[]>;
		total: number;
	};
}

/**
 * Fetch all available nodes
 */
async function fetchNodes(): Promise<NodesResponse["data"]> {
	const response = await apiRequest<NodesResponse["data"]>("/api/nodes", {
		method: "GET",
	});

	if (!response.success) {
		throw new Error(response.error || "Failed to fetch nodes");
	}

	if (!response.data?.nodes) {
		throw new Error("Invalid nodes response");
	}

	return response.data;
}

/**
 * Hook to access all available node definitions
 */
export function useNodeRegistry() {
	return useQuery({
		queryKey: ["nodeRegistry"],
		queryFn: fetchNodes,
		staleTime: 1000 * 60 * 5, // Cache for 5 minutes
	});
}

/**
 * Hook to get nodes grouped by category
 */
export function useNodesByCategory() {
	const { data, ...query } = useNodeRegistry();

	return {
		...query,
		categories: data?.byCategory || {},
		allNodes: data?.nodes || [],
	};
}

/**
 * Hook to get a specific node definition
 */
export function useNodeDefinition(nodeId: string | undefined) {
	const { data: nodesData, ...query } = useNodeRegistry();

	const nodeDefinition = nodeId
		? nodesData?.nodes.find((n) => n.id === nodeId)
		: null;

	return {
		...query,
		nodeDefinition,
		isLoading: query.isLoading,
		isError: query.isError,
		error: query.error,
	};
}

/**
 * Hook to get nodes in a specific category
 */
export function useNodesInCategory(category: string) {
	const { data: nodesData, ...query } = useNodeRegistry();

	const nodes = nodesData?.byCategory[category] || [];

	return {
		...query,
		nodes,
		total: nodes.length,
	};
}

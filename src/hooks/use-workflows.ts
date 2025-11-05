/**
 * Workflows Hook
 *
 * React Query hooks for workflow CRUD operations with type-safe Hono RPC client
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type {
	Workflow,
	WorkflowsListResponse,
	WorkflowRun,
	WorkflowRunsListResponse,
} from "@/server/types/api";

/**
 * Fetch all workflows for the current user
 */
export function useWorkflows() {
	return useQuery({
		queryKey: ["workflows"],
		queryFn: async () => {
			const response = await apiRequest<WorkflowsListResponse>(
				"/api/workflows",
				{
					method: "GET",
				},
			);

			if (!response.success) {
				throw new Error(response.error || "Failed to fetch workflows");
			}

			return response.data;
		},
		// Only run query on client side
		enabled: typeof window !== "undefined",
	});
}

/**
 * Fetch a single workflow by ID
 */
export function useWorkflow(workflowId: string | null) {
	return useQuery({
		queryKey: ["workflows", workflowId],
		queryFn: async () => {
			if (!workflowId) throw new Error("Workflow ID is required");

			const response = await apiRequest<Workflow>(
				`/api/workflows/${workflowId}`,
				{ method: "GET" },
			);

			if (!response.success) {
				throw new Error(response.error || "Failed to fetch workflow");
			}

			return response.data;
		},
		enabled: !!workflowId,
	});
}

/**
 * Create a new workflow
 */
export function useCreateWorkflow() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: {
			name: string;
			description?: string;
			definition: Record<string, unknown>;
		}) => {
			const response = await apiRequest<Workflow>("/api/workflows", {
				method: "POST",
				body: JSON.stringify(input),
			});

			if (!response.success) {
				throw new Error(response.error || "Failed to create workflow");
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["workflows"] });
		},
	});
}

/**
 * Update an existing workflow
 */
export function useUpdateWorkflow() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: {
			workflowId: string;
			name?: string;
			description?: string;
			definition?: Record<string, unknown>;
		}) => {
			const { workflowId, ...data } = input;

			const response = await apiRequest<Workflow>(
				`/api/workflows/${workflowId}`,
				{
					method: "PUT",
					body: JSON.stringify(data),
				},
			);

			if (!response.success) {
				throw new Error(response.error || "Failed to update workflow");
			}

			return response.data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["workflows"] });
			queryClient.invalidateQueries({ queryKey: ["workflows", data.id] });
		},
	});
}

/**
 * Delete a workflow
 */
export function useDeleteWorkflow() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (workflowId: string) => {
			const response = await apiRequest<{ success: boolean }>(
				`/api/workflows/${workflowId}`,
				{ method: "DELETE" },
			);

			if (!response.success) {
				throw new Error(response.error || "Failed to delete workflow");
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["workflows"] });
		},
	});
}

/**
 * Run a workflow
 */
export function useRunWorkflow() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: {
			workflowId: string;
			inputs?: Record<string, unknown>;
		}) => {
			const { workflowId, inputs } = input;

			const response = await apiRequest<{ runId: string }>(
				`/api/workflows/${workflowId}/run`,
				{
					method: "POST",
					body: JSON.stringify({ inputs }),
				},
			);

			if (!response.success) {
				throw new Error(response.error || "Failed to run workflow");
			}

			return response.data;
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["workflows"] });
			queryClient.invalidateQueries({
				queryKey: ["workflow-runs", variables.workflowId],
			});
		},
	});
}

/**
 * Fetch all workflow runs for a specific workflow
 */
export function useWorkflowRuns(workflowId: string | null) {
	return useQuery({
		queryKey: ["workflow-runs", workflowId],
		queryFn: async () => {
			if (!workflowId) throw new Error("Workflow ID is required");

			const response = await apiRequest<WorkflowRun[]>(
				`/api/workflows/${workflowId}/runs`,
				{
					method: "GET",
				},
			);

			if (!response.success) {
				throw new Error(response.error || "Failed to fetch workflow runs");
			}

			// API returns { success: true, data: WorkflowRun[] }
			return (response.data as WorkflowRun[]) || [];
		},
		enabled: !!workflowId && typeof window !== "undefined",
	});
}

/**
 * Fetch a single workflow run by ID
 */
export function useWorkflowRun(
	workflowId: string | null,
	runId: string | null,
) {
	return useQuery({
		queryKey: ["workflow-runs", workflowId, runId],
		queryFn: async () => {
			if (!workflowId || !runId) {
				throw new Error("Workflow ID and Run ID are required");
			}

			const response = await apiRequest<{
				run: WorkflowRun;
				executions: unknown[];
			}>(`/api/workflows/${workflowId}/runs/${runId}`, {
				method: "GET",
			});

			if (!response.success) {
				throw new Error(response.error || "Failed to fetch workflow run");
			}

			return response.data;
		},
		enabled: !!workflowId && !!runId && typeof window !== "undefined",
	});
}

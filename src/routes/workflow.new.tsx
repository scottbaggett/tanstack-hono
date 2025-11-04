/**
 * New Workflow Route
 *
 * Creates a new blank workflow and redirects to the editor
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useCreateWorkflow } from "@/hooks/use-workflows";
import { useEffect } from "react";

export const Route = createFileRoute("/workflow/new")({
	component: NewWorkflowPage,
});

function NewWorkflowPage() {
	const navigate = useNavigate();
	const createWorkflow = useCreateWorkflow();

	// Ensure user is authenticated
	useProtectedRoute();

	// Create workflow on mount
	useEffect(() => {
		const create = async () => {
			try {
				const result = await createWorkflow.mutateAsync({
					name: "Untitled Workflow",
					description: "New workflow",
					definition: {
						nodes: [],
						edges: [],
						viewport: { x: 0, y: 0, zoom: 1 },
					},
				});

				if (result?.id) {
					// Redirect to the new workflow
					navigate({
						to: "/workflow/$workflowId",
						params: { workflowId: result.id },
						replace: true,
					});
				}
			} catch (error) {
				console.error("Failed to create workflow:", error);
				// Redirect back to workflows list on error
				navigate({ to: "/workflows", replace: true });
			}
		};

		create();
	}, []);

	return (
		<div className="flex items-center justify-center h-screen">
			<div className="text-center">
				<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
				<p className="mt-4 text-sm text-muted-foreground">
					Creating workflow...
				</p>
			</div>
		</div>
	);
}

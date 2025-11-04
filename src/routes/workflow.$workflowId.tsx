/**
 * Workflow Editor Route
 *
 * Main workflow editor at /workflow/:workflowId
 * Optional nodeId in search params opens node modal
 */

import { createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@/components/canvas/Canvas";
import { useProtectedRoute } from "@/hooks/use-protected-route";

interface WorkflowSearch {
	nodeId?: string;
}

export const Route = createFileRoute("/workflow/$workflowId")({
	validateSearch: (search: Record<string, unknown>): WorkflowSearch => {
		return {
			nodeId: search.nodeId as string | undefined,
		};
	},
	component: WorkflowPage,
});

function WorkflowPage() {
	const { workflowId } = Route.useParams();
	const { nodeId } = Route.useSearch();

	// Ensure user is authenticated
	useProtectedRoute();

	return <Canvas workflowId={workflowId} selectedNodeId={nodeId} />;
}

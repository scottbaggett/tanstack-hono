/**
 * Canvas Route
 *
 * Workflow editor canvas for creating and editing workflows
 */

import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Canvas } from "@/components/canvas/Canvas";
import { useProtectedRoute } from "@/hooks/use-protected-route";

interface CanvasSearchParams {
	workflowId?: string;
}

export const Route = createFileRoute("/canvas")({
	validateSearch: (search): CanvasSearchParams => {
		return {
			workflowId: (search as any)?.workflowId,
		};
	},
	component: CanvasPage,
});

function CanvasPage() {
	const { workflowId } = useSearch({ from: Route.id });

	// Ensure user is authenticated
	useProtectedRoute();

	return <Canvas workflowId={workflowId} />;
}

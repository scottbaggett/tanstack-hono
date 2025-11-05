/**
 * Execution Detail Route
 *
 * Shows detailed execution view for a specific run at /workflow/:workflowId/executions/:runId
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Canvas } from "@/components/canvas/Canvas";
import { ExecutionHeader } from "@/components/canvas/ExecutionHeader";
import { ExecutionLogsViewer } from "@/components/canvas/nodeEditorModal/components/ExecutionLogsViewer";
import { NodeExecutionDetail } from "@/components/canvas/nodeEditorModal/components/NodeExecutionDetail";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import { useWorkflow, useWorkflowRun, useWorkflowRuns } from "@/hooks/use-workflows";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/executions/$workflowId/$runId")({
	component: ExecutionDetailPage,
});

function ExecutionDetailPage() {
	useProtectedRoute();
	const { workflowId, runId } = Route.useParams();
	const navigate = useNavigate();
	const { data: workflow } = useWorkflow(workflowId);
	const { data: runData, isLoading, error } = useWorkflowRun(workflowId, runId);
	const { data: allRuns } = useWorkflowRuns(workflowId);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

	// Find current run index for prev/next navigation
	const currentRunIndex =
		allRuns?.findIndex((r) => r.id === runId) ?? -1;
	const previousRun = currentRunIndex > 0 ? allRuns?.[currentRunIndex - 1] : null;
	const nextRun =
		currentRunIndex >= 0 && allRuns && currentRunIndex < allRuns.length - 1
			? allRuns[currentRunIndex + 1]
			: null;

		const handlePrevious = () => {
		if (previousRun) {
			navigate({
				to: "/executions/$workflowId/$runId",
				params: { workflowId, runId: previousRun.id },
			});
		}
	};

	const handleNext = () => {
		if (nextRun) {
			navigate({
				to: "/executions/$workflowId/$runId",
				params: { workflowId, runId: nextRun.id },
			});
		}
	};

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Escape: Close node detail panel or go back to executions list
			if (e.key === "Escape") {
				if (selectedNodeId) {
					setSelectedNodeId(null);
				} else {
					navigate({
						to: "/executions/$workflowId",
						params: { workflowId },
					});
				}
				return;
			}

			// Left Arrow: Previous execution
			if (e.key === "ArrowLeft" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handlePrevious();
				return;
			}

			// Right Arrow: Next execution
			if (e.key === "ArrowRight" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleNext();
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedNodeId, previousRun, nextRun, workflowId, navigate]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
					<p className="text-muted-foreground">Loading execution details...</p>
				</div>
			</div>
		);
	}

	if (error || !runData) {
		return (
			<div className="container mx-auto py-8 px-4 max-w-7xl">
				<div className="text-center py-12">
					<h2 className="text-2xl font-semibold mb-2">Execution Not Found</h2>
					<p className="text-muted-foreground mb-6">
						{error instanceof Error ? error.message : "Execution not found or has been deleted"}
					</p>
					<Link
						to="/executions/$workflowId"
						params={{ workflowId }}
					>
						<button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
							Back to Executions
						</button>
					</Link>
				</div>
			</div>
		);
	}

	const { run, executions } = runData;
	const nodeExecutionsMap = new Map(
		executions?.map((exec: any) => [exec.nodeId, exec]) || []
	);

	return (
		<div className="flex flex-col h-screen">
			{/* Execution Header */}
			<ExecutionHeader
				run={run}
				workflowName={workflow?.name || "Workflow"}
				workflowId={workflowId}
				onPrevious={previousRun ? handlePrevious : undefined}
				onNext={nextRun ? handleNext : undefined}
			/>

			{/* Graph Playback View */}
			<div className="flex-1 relative">
				<Canvas
					workflowId={workflowId}
					executionMode={true}
					runId={runId}
					nodeExecutionsMap={nodeExecutionsMap}
					selectedNodeId={selectedNodeId}
					onNodeClick={(nodeId) => setSelectedNodeId(nodeId || null)}
				/>

				{/* Node Execution Detail Panel or Global Logs */}
				{selectedNodeId ? (
					<NodeExecutionDetail
						nodeId={selectedNodeId}
						nodeExecution={nodeExecutionsMap.get(selectedNodeId)}
						runId={runId}
						workflowId={workflowId}
						onClose={() => setSelectedNodeId(null)}
					/>
				) : (
					<div className="absolute right-0 top-0 h-full w-96 bg-background border-l shadow-lg flex flex-col">
						<div className="flex items-center justify-between p-4 border-b">
							<h3 className="font-semibold">Execution Logs</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSelectedNodeId(null)}
							>
								<LucideIcon name="x" className="h-4 w-4" />
							</Button>
						</div>
						<div className="flex-1 overflow-hidden">
							<ExecutionLogsViewer
								workflowId={workflowId}
								runId={runId}
								nodeId={null}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

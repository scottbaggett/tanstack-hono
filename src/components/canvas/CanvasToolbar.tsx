/**
 * Canvas Toolbar Component
 *
 * Toolbar with workflow actions: add node, delete node, save, etc.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import { useExecuteWorkflow } from "@/hooks/use-workflows";

interface CanvasToolbarProps {
	onSave: () => void;
	hasSelectedNode: boolean;
	isSaving: boolean;
	workflowId?: string;
	workflowName: string;
}

export function CanvasToolbar({
	onSave,
	isSaving,
	workflowName,
	workflowId,
}: CanvasToolbarProps) {
	const navigate = useNavigate();
	const executeWorkflow = useExecuteWorkflow();

	const handleRun = async () => {
		if (!workflowId) return;

		try {
			const result = await executeWorkflow.mutateAsync({
				workflowId,
				inputs: {},
			});

			// Navigate to the execution detail page
			if (result?.runId) {
				navigate({
					to: "/executions/$workflowId/$runId",
					params: { workflowId, runId: result.runId },
				});
			} else {
				// Fallback: navigate to executions list
				navigate({
					to: "/executions/$workflowId",
					params: { workflowId },
				});
			}
		} catch (error) {
			console.error("Failed to execute workflow:", error);
			// Could show an error toast here
		}
	};

	return (
		<div className="flex items-center justify-between px-4 py-3 bg-background border-b">
			{/* Left side - Navigation */}
			<div className="flex items-center gap-4">
				<Link to="/workflows">
					<Button variant="ghost" size="sm">
						<ChevronLeft className="mr-2 h-4 w-4" />
					</Button>
				</Link>
				<div className="flex-1 text-center">
					<h1 className="text-lg font-semibold">{workflowName}</h1>
				</div>
			</div>

			{/* Center - Title */}

			{/* Right side - Actions */}
			<div className="flex items-center gap-2">
				{/* Run */}
				{workflowId && (
					<Button
						variant="default"
						size="sm"
						onClick={handleRun}
						disabled={executeWorkflow.isPending}
					>
						{executeWorkflow.isPending ? (
							<LucideIcon name="loader-2" className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<LucideIcon name="play" className="mr-2 h-4 w-4" />
						)}
						{executeWorkflow.isPending ? "Running..." : "Run"}
					</Button>
				)}
				{/* Executions */}
				{workflowId && (
					<Button variant="outline" size="sm" asChild>
						<Link
							to="/executions/$workflowId"
							params={{ workflowId }}
						>
							<LucideIcon name="play-circle" className="mr-2 h-4 w-4" />
							Executions
						</Link>
					</Button>
				)}
				{/* Save */}
				<Button
					variant="secondary"
					size="sm"
					onClick={onSave}
					disabled={isSaving}
					title={workflowId ? "Save workflow changes" : "Create new workflow"}
				>
					{isSaving ? (
						<LucideIcon name="loader-2" className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<LucideIcon name="save" className="mr-2 h-4 w-4" />
					)}
					{isSaving ? "Saving..." : "Save"}
				</Button>
			</div>
		</div>
	);
}

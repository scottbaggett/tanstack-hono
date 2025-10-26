/**
 * Canvas Toolbar Component
 *
 * Toolbar with workflow actions: add node, delete node, save, etc.
 */

import { Button } from "@/components/ui/button";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Link } from "@tanstack/react-router";

interface CanvasToolbarProps {
	onAddNode: () => void;
	onDeleteNode: () => void;
	onSave: () => void;
	hasSelectedNode: boolean;
	isSaving: boolean;
	workflowId?: string;
}

export function CanvasToolbar({
	onAddNode,
	onDeleteNode,
	onSave,
	hasSelectedNode,
	isSaving,
	workflowId,
}: CanvasToolbarProps) {
	return (
		<div className="flex items-center justify-between px-4 py-3 bg-canvas border-b">
			{/* Left side - Navigation */}
			<div className="flex items-center gap-4">
				<Link to="/workflows">
					<Button variant="ghost" size="sm">
						<LucideIcon name="arrow-left" className="mr-2 h-4 w-4" />
						Back to Workflows
					</Button>
				</Link>
			</div>

			{/* Center - Title */}
			<div className="flex-1 text-center">
				<h1 className="text-lg font-semibold text-white">
					{workflowId ? "Edit Workflow" : "New Workflow"}
				</h1>
			</div>

			{/* Right side - Actions */}
			<div className="flex items-center gap-2">
				{/* Add Node */}
				<Button
					variant="outline"
					size="sm"
					onClick={onAddNode}
					title="Add a new node to the workflow"
				>
					<LucideIcon name="plus" className="mr-2 h-4 w-4" />
					Add Node
				</Button>

				{/* Delete Node */}
				<Button
					variant="outline"
					size="sm"
					onClick={onDeleteNode}
					disabled={!hasSelectedNode}
					title="Delete the selected node"
				>
					<LucideIcon name="trash-2" className="h-4 w-4" />
				</Button>

				{/* Divider */}
				<div className="h-6 w-px bg-gray-700" />

				{/* Save */}
				<Button
					variant="default"
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

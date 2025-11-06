/**
 * Canvas Toolbar Component
 *
 * Toolbar with workflow actions: add node, delete node, save, etc.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUpdateWorkflow } from "@/hooks/use-workflows";

interface CanvasToolbarProps {
  onSave: () => void;
  hasSelectedNode: boolean;
  isSaving: boolean;
  workflowId?: string;
  workflowName: string;
  executionStream?: ReturnType<typeof import("@/hooks/use-execution-stream").useExecutionStream>;
}

export function CanvasToolbar({
  onSave,
  isSaving,
  workflowName,
  workflowId,
  executionStream,
}: CanvasToolbarProps) {
  const updateWorkflow = useUpdateWorkflow();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState(workflowName);

  const handleRun = async () => {
    if (!workflowId || !executionStream) return;

    try {
      const result = await executionStream.executeWorkflow(workflowId);

      console.log("Workflow execution completed:", {
        workflowId,
        runId: result.runId,
        status: result.status,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to execute workflow";
      console.error("Failed to execute workflow:", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Show error to user
      alert(`Failed to execute workflow: ${errorMessage}`);
    }
  };

  const handleRenameClick = () => {
    if (workflowId) {
      setNewName(workflowName);
      setIsRenameDialogOpen(true);
    }
  };

  const handleRename = async () => {
    if (!workflowId || !newName.trim()) return;

    try {
      await updateWorkflow.mutateAsync({
        workflowId,
        name: newName.trim(),
      });
      setIsRenameDialogOpen(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to rename workflow";
      console.error("Failed to rename workflow:", errorMessage);
      alert(`Failed to rename workflow: ${errorMessage}`);
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
          <button
            type="button"
            onClick={handleRenameClick}
            disabled={!workflowId}
            className={`text-lg font-semibold hover:underline focus:outline-none focus:underline ${
              workflowId
                ? "cursor-pointer text-foreground"
                : "cursor-default text-muted-foreground"
            }`}
            title={workflowId ? "Click to rename workflow" : undefined}
          >
            {workflowName}
          </button>
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
            disabled={executionStream?.isExecuting}
          >
            {executionStream?.isExecuting ? (
              <LucideIcon
                name="loader-2"
                className="mr-2 h-4 w-4 animate-spin"
              />
            ) : (
              <LucideIcon name="play" className="mr-2 h-4 w-4" />
            )}
            {executionStream?.isExecuting ? "Running..." : "Run"}
          </Button>
        )}
        {/* Executions */}
        {workflowId && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/executions/$workflowId" params={{ workflowId }}>
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

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Workflow</DialogTitle>
            <DialogDescription>
              Enter a new name for your workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRename();
                }
              }}
              placeholder="Workflow name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newName.trim() || updateWorkflow.isPending}
            >
              {updateWorkflow.isPending ? (
                <>
                  <LucideIcon
                    name="loader-2"
                    className="mr-2 h-4 w-4 animate-spin"
                  />
                  Renaming...
                </>
              ) : (
                "Rename"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

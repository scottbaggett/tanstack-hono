/**
 * Workflow Executions Route - n8n Style
 *
 * Two-panel layout:
 * - Left: Executions list
 * - Right: Graph replay (Canvas in execution mode)
 * - Bottom: Expandable logs panel
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Filter } from "lucide-react";
import { useState } from "react";
import { Canvas } from "@/components/canvas/Canvas";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import {
  useWorkflow,
  useWorkflowRun,
  useWorkflowRuns,
} from "@/hooks/use-workflows";
import type { NodeExecution } from "@/server/types/api";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/executions/$workflowId")({
  component: ExecutionsPage,
});

function ExecutionsPage() {
  useProtectedRoute();
  const { workflowId } = Route.useParams();
  const { data: workflow } = useWorkflow(workflowId);
  const {
    data: runs,
    isLoading: runsLoading,
    refetch,
  } = useWorkflowRuns(workflowId);

  // Selected execution
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    runs?.[0]?.id || null,
  );

  // Fetch selected run details
  const { data: selectedRunData } = useWorkflowRun(
    workflowId,
    selectedRunId || null,
  );

  // Logs panel state
  const [isLogsPanelExpanded, setIsLogsPanelExpanded] = useState(false);

  // Auto-select first run when runs load
  if (runs && runs.length > 0 && !selectedRunId) {
    setSelectedRunId(runs[0].id);
  }

  // Create nodeExecutionsMap from selected run
  const nodeExecutionsMap = new Map<string, NodeExecution>();
  if (selectedRunData?.executions) {
    for (const execution of selectedRunData.executions) {
      nodeExecutionsMap.set(execution.nodeId, execution);
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background z-10">
        <div className="flex items-center gap-4">
          <Link
            to="/workflow/$workflowId"
            params={{ workflowId }}
            className="text-muted-foreground hover:text-foreground"
          >
            <LucideIcon name="arrow-left" className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">
              {workflow?.name || "Workflow"} - Executions
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={runsLoading}
          >
            <LucideIcon
              name={runsLoading ? "loader-2" : "refresh-cw"}
              className={`${runsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Link to="/workflow/$workflowId" params={{ workflowId }}>
            <Button variant="default" size="sm">
              <LucideIcon name="edit" className="mr-2 h-4 w-4" />
              Edit Workflow
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Layout: Left Panel + Right Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Executions List */}
        <div className="w-100 border-r bg-background flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Execution History</h2>
            <Button size="icon" variant="ghost" className="size-7">
              <Filter className="size-4!" />
            </Button>
          </div>
          <ScrollArea className="flex-1 w-full">
            {runsLoading && (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            )}

            {!runsLoading && (!runs || runs.length === 0) && (
              <div className="p-8 text-center">
                <LucideIcon
                  name="inbox"
                  className="h-12 w-12 mx-auto text-muted-foreground mb-3"
                />
                <p className="text-sm text-muted-foreground">
                  No executions yet
                </p>
              </div>
            )}

            {!runsLoading && runs && runs.length > 0 && (
              <div className="p-2">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={cn(
                      "w-full text-left p-2 transition-colors",
                      selectedRunId === run.id
                        ? "bg-accent/50"
                        : "hover:bg-accent",
                      run.status === "completed" &&
                        "border-l-green-500 border-l-8",
                      run.status === "error" && "border-l-red-500 border-l-8",
                    )}
                  >
                    <div className={cn("flex items-center justify-between")}>
                      <span className="text-sm">
                        {new Date(run.startedAt).toLocaleDateString()}{" "}
                        {new Date(run.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {run.status} in{" "}
                      {run.durationMs && (
                        <span className="text-xs text-muted-foreground">
                          {(run.durationMs / 1000).toFixed(2)}s
                        </span>
                      )}{" "}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Panel: Graph Replay */}
        <div
          className={`flex-1 flex flex-col transition-all ${
            isLogsPanelExpanded ? "h-[60%]" : "h-full"
          }`}
        >
          {selectedRunId && selectedRunData ? (
            <div className="flex-1 relative">
              <Canvas
                workflowId={workflowId}
                executionMode={true}
                runId={selectedRunId}
                nodeExecutionsMap={nodeExecutionsMap}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <LucideIcon
                  name="play-circle"
                  className="h-16 w-16 mx-auto text-muted-foreground mb-4"
                />
                <p className="text-lg font-medium text-muted-foreground">
                  Select an execution to view
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel: Expandable Logs */}
      <div
        className={`border-t bg-background transition-all ${
          isLogsPanelExpanded ? "h-[40%]" : "h-12"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <LucideIcon name="terminal" className="h-4 w-4" />
            <span className="text-sm font-medium">Execution Logs</span>
            {selectedRunData && (
              <span className="text-xs text-muted-foreground">
                Run: {selectedRunId}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsLogsPanelExpanded(!isLogsPanelExpanded)}
          >
            <LucideIcon
              name={isLogsPanelExpanded ? "chevron-down" : "chevron-up"}
              className="h-4 w-4"
            />
          </Button>
        </div>

        {isLogsPanelExpanded && (
          <ScrollArea className="h-[calc(100%-3rem)] p-4">
            {selectedRunId ? (
              <div className="font-mono text-xs space-y-1">
                <div className="text-muted-foreground">
                  [
                  {new Date(
                    selectedRunData?.run?.startedAt || "",
                  ).toLocaleTimeString()}
                  ] Workflow execution started
                </div>
                {selectedRunData?.executions?.map((exec) => (
                  <div key={exec.id} className="space-y-0.5">
                    <div className="text-muted-foreground">
                      [{new Date(exec.startedAt || "").toLocaleTimeString()}]{" "}
                      Node "{exec.nodeId}" started
                    </div>
                    {exec.status === "completed" && (
                      <div className="text-green-600">
                        [{new Date(exec.completedAt || "").toLocaleTimeString()}
                        ] Node "{exec.nodeId}" completed
                      </div>
                    )}
                    {exec.status === "failed" && (
                      <div className="text-red-600">
                        [{new Date(exec.completedAt || "").toLocaleTimeString()}
                        ] Node "{exec.nodeId}" failed:{" "}
                        {exec.errorMessage || "Unknown error"}
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-muted-foreground">
                  [
                  {new Date(
                    selectedRunData?.run?.completedAt || "",
                  ).toLocaleTimeString()}
                  ] Workflow execution {selectedRunData?.run?.status}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select an execution to view logs
              </p>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  size = "default",
}: {
  status: string;
  size?: "default" | "sm";
}) {
  const statusConfig = {
    pending: { label: "Pending", variant: "secondary" as const, icon: "clock" },
    running: {
      label: "Running",
      variant: "default" as const,
      icon: "loader-2",
    },
    completed: {
      label: "Success",
      variant: "default" as const,
      icon: "check-circle",
    },
    failed: {
      label: "Failed",
      variant: "destructive" as const,
      icon: "x-circle",
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <Badge
      variant={config.variant}
      className={`flex items-center gap-1 ${
        size === "sm" ? "text-xs py-0 px-2" : ""
      }`}
    >
      <LucideIcon
        name={config.icon}
        className={`size-4 ${status === "running" ? "animate-spin" : ""}`}
      />
      {config.label}
    </Badge>
  );
}

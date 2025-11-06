/**
 * Workflow Executions Route - n8n Style
 *
 * Two-panel layout:
 * - Left: Executions list
 * - Right: Graph replay (Canvas in execution mode)
 * - Bottom: Expandable logs panel
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter } from "lucide-react";
import { useState } from "react";
import type { Node } from "@xyflow/react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { Canvas } from "@/components/canvas/Canvas";
import { NodeEditorModal } from "@/components/canvas/nodeEditorModal/NodeEditorModal";
import { SchemaTree } from "@/components/canvas/nodeEditorModal/components/SchemaTree";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNodeRegistry } from "@/hooks/use-node-registry";
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
  const { data: nodeRegistry } = useNodeRegistry();
  const {
    data: runs,
    isLoading: runsLoading,
    refetch,
  } = useWorkflowRuns(workflowId);

  // Selected execution
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    runs?.[0]?.id || null,
  );

  // Selected node for inspection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Full editor modal state
  const [isFullEditorOpen, setIsFullEditorOpen] = useState(false);

  // Fetch selected run details
  const { data: selectedRunData } = useWorkflowRun(
    workflowId,
    selectedRunId || null,
  );

  // Bottom panel tab state
  const [bottomPanelTab, setBottomPanelTab] = useState<"logs" | "input" | "output">("logs");

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

  // Get selected node execution data
  const selectedNodeExecution = selectedNodeId
    ? nodeExecutionsMap.get(selectedNodeId)
    : null;

  // Get selected node from workflow definition
  const selectedNode = selectedNodeId
    ? workflow?.definition?.nodes?.find((n: any) => n.id === selectedNodeId)
    : null;

  // Node click handler
  const handleNodeClick = (nodeId: string) => {
    if (!nodeId) {
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId(nodeId);
    setBottomPanelTab("output"); // Default to output tab when clicking a node
  };

  // Double-click handler to open full editor
  const handleOpenFullEditor = () => {
    setIsFullEditorOpen(true);
  };

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

      {/* Main Layout with Resizable Panels */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel: Executions List */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <div className="h-full border-r bg-background flex flex-col">
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
        </Panel>

        <PanelResizeHandle className="w-1 bg-surface-6 hover:bg-info-9 transition-colors" />

        {/* Right Panel: Vertical Layout (Canvas + Bottom Panel) */}
        <Panel defaultSize={75} minSize={50}>
          <PanelGroup direction="vertical">
            {/* Top: Canvas */}
            <Panel defaultSize={70} minSize={30}>
              <div className="h-full flex flex-col">
            {selectedRunId && selectedRunData ? (
              <div className="flex-1 relative">
                <Canvas
                  workflowId={workflowId}
                  executionMode={true}
                  runId={selectedRunId}
                  nodeExecutionsMap={nodeExecutionsMap}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={handleNodeClick}
                  onNodeDoubleClick={handleOpenFullEditor}
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
            </Panel>

            <PanelResizeHandle className="h-1 bg-surface-6 hover:bg-info-9 transition-colors" />

            {/* Bottom: Tabs Panel (Logs/Input/Output) */}
            <Panel defaultSize={30} minSize={20} maxSize={70} collapsible={true}>
              <div className="h-full border-t bg-background flex flex-col">
                {/* Tabs Header */}
                <Tabs
                  value={bottomPanelTab}
                  onValueChange={(v) => setBottomPanelTab(v as "logs" | "input" | "output")}
                  className="flex-1 flex flex-col"
                >
                  <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3">
                      <TabsList className="h-8">
                        <TabsTrigger value="logs" className="text-xs">
                          <LucideIcon name="terminal" className="h-3 w-3 mr-1" />
                          Logs
                        </TabsTrigger>
                        <TabsTrigger value="input" className="text-xs">
                          <LucideIcon name="arrow-down-to-line" className="h-3 w-3 mr-1" />
                          Input
                          {selectedNodeExecution?.inputs && Object.keys(selectedNodeExecution.inputs).length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {Object.keys(selectedNodeExecution.inputs).length}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="output" className="text-xs">
                          <LucideIcon name="arrow-up-from-line" className="h-3 w-3 mr-1" />
                          Output
                          {selectedNodeExecution?.outputs && Object.keys(selectedNodeExecution.outputs).length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {Object.keys(selectedNodeExecution.outputs).length}
                            </Badge>
                          )}
                        </TabsTrigger>
                      </TabsList>
                      {selectedNodeId && selectedNode && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-surface-4 rounded border border-surface-6">
                          <LucideIcon name="box" className="h-4 w-4 text-info-11" />
                          <span className="text-sm font-medium text-surface-12">
                            {(selectedNode.data?.displayName as string) ||
                              (selectedNode.data?.name as string) ||
                              "Node"}
                          </span>
                          {selectedNodeExecution && (
                            <Badge
                              variant={
                                selectedNodeExecution.status === "completed"
                                  ? "default"
                                  : selectedNodeExecution.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {selectedNodeExecution.status}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedNodeId && selectedNode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenFullEditor}
                        title="Open full editor (double-click node)"
                      >
                        <LucideIcon name="maximize-2" className="h-4 w-4" />
                        <span className="ml-1 text-xs">Expand</span>
                      </Button>
                    )}
                  </div>

                  {/* Logs Tab */}
                  <TabsContent value="logs" className="flex-1 overflow-y-auto mt-0">
                    <ScrollArea className="h-full p-4">
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
                  </TabsContent>

                  {/* Input Tab */}
                  <TabsContent value="input" className="flex-1 overflow-y-auto mt-0">
                    {selectedNodeExecution?.inputs && Object.keys(selectedNodeExecution.inputs).length > 0 ? (
                      <ScrollArea className="h-full p-4">
                        <SchemaTree
                          data={selectedNodeExecution.inputs}
                          path="input"
                          draggable={false}
                        />
                      </ScrollArea>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center p-8">
                          <LucideIcon
                            name="inbox"
                            className="h-12 w-12 mx-auto text-muted-foreground mb-3"
                          />
                          <p className="text-sm text-muted-foreground">
                            {selectedNodeId ? "No input data" : "Select a node to view input"}
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Output Tab */}
                  <TabsContent value="output" className="flex-1 overflow-y-auto mt-0">
                    {selectedNodeExecution?.outputs && Object.keys(selectedNodeExecution.outputs).length > 0 ? (
                      <ScrollArea className="h-full p-4">
                        <SchemaTree
                          data={selectedNodeExecution.outputs}
                          path="output"
                          draggable={false}
                        />
                      </ScrollArea>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center p-8">
                          <LucideIcon
                            name="inbox"
                            className="h-12 w-12 mx-auto text-muted-foreground mb-3"
                          />
                          <p className="text-sm text-muted-foreground">
                            {selectedNodeId ? "No output data" : "Select a node to view output"}
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Full Node Editor Modal (execution replay mode) */}
      {isFullEditorOpen && selectedNode && selectedNodeExecution && workflow && (
        <NodeEditorModal
          selectedNode={selectedNode}
          onClose={() => setIsFullEditorOpen(false)}
          onUpdateNode={() => {
            // No-op in execution replay mode
          }}
          onExecutionComplete={() => {
            // No-op in execution replay mode
          }}
          workflowEdges={
            (workflow.definition?.edges as Array<{
              source: string;
              target: string;
              sourceHandle?: string;
              targetHandle?: string;
            }>) || []
          }
          allNodes={(workflow.definition?.nodes as unknown as Node[]) || []}
          nodeRegistry={nodeRegistry}
          executionCache={
            Array.from(nodeExecutionsMap.entries()).reduce(
              (acc, [nodeId, execution]) => {
                // Transform to match NodeExecutionResult format expected by panels
                // NodeInputsPanel expects: nodeResult.data.main[0].json
                // execution.outputs is already in the correct format: { main: [{ json: {...} }] }
                acc[nodeId] = {
                  data: execution.outputs || { main: [] },
                } as any;
                return acc;
              },
              {} as Record<string, Record<string, unknown>>,
            )
          }
          readOnly={true}
        />
      )}
    </div>
  );
}

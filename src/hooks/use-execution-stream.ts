/**
 * Hook for streaming workflow execution with real-time updates
 */

import { useCallback, useRef, useState } from "react";

export interface NodeExecutionStatus {
  nodeId: string;
  status: "pending" | "running" | "completed" | "failed";
  stage?: number;
  error?: string;
}

export interface ExecutionStreamEvent {
  type: "run_started" | "node_status" | "run_completed" | "error";
  runId?: string;
  workflowId?: string;
  nodeId?: string;
  status?: string;
  stage?: number;
  error?: string;
  durationMs?: number;
}

export function useExecutionStream() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<
    Map<string, NodeExecutionStatus>
  >(new Map());
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const executeWorkflow = useCallback(
    async (workflowId: string): Promise<{ runId: string; status: string }> => {
      // Clean up any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setIsExecuting(true);
      setNodeStatuses(new Map());
      setCurrentRunId(null);

      return new Promise((resolve, reject) => {
        // Create EventSource connection for SSE
        const eventSource = new EventSource(
          `/api/execute/${workflowId}/stream`,
          {
            withCredentials: true,
          },
        );
        eventSourceRef.current = eventSource;

        let runId: string | null = null;

        eventSource.onmessage = (event) => {
          try {
            const data: ExecutionStreamEvent = JSON.parse(event.data);

            switch (data.type) {
              case "run_started":
                runId = data.runId || null;
                setCurrentRunId(runId);
                console.log("[Execution] Workflow execution started:", {
                  runId,
                  workflowId: data.workflowId,
                });
                break;

              case "node_status":
                if (data.nodeId) {
                  setNodeStatuses((prev) => {
                    const next = new Map(prev);
                    next.set(data.nodeId!, {
                      nodeId: data.nodeId!,
                      status: data.status as any,
                      stage: data.stage,
                      error: data.error,
                    });
                    return next;
                  });
                  console.log("[Execution] Node status update:", {
                    nodeId: data.nodeId,
                    status: data.status,
                    stage: data.stage,
                  });
                }
                break;

              case "run_completed":
                console.log("[Execution] Workflow execution completed:", {
                  runId: data.runId,
                  status: data.status,
                  durationMs: data.durationMs,
                });
                setIsExecuting(false);
                eventSource.close();
                resolve({
                  runId: data.runId || runId || "unknown",
                  status: data.status || "completed",
                });
                break;

              case "error":
                console.error("[Execution] Workflow execution error:", data.error);
                setIsExecuting(false);
                eventSource.close();
                reject(new Error(data.error || "Execution failed"));
                break;
            }
          } catch (error) {
            console.error("[Execution] Failed to parse SSE event:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("[Execution] EventSource error:", error);
          setIsExecuting(false);
          eventSource.close();
          reject(new Error("Connection to server lost"));
        };
      });
    },
    [],
  );

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsExecuting(false);
    setNodeStatuses(new Map());
    setCurrentRunId(null);
  }, []);

  return {
    executeWorkflow,
    isExecuting,
    nodeStatuses,
    currentRunId,
    cleanup,
  };
}

/**
 * Node Execution Panel
 *
 * Shows input/output data for a node execution (execution replay mode)
 * Similar to n8n's execution inspection panel
 */

import { Code2, Table2, Ungroup } from "lucide-react";
import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NodeExecution } from "@/server/types/api";
import { SchemaTree } from "../nodeEditorModal/components/SchemaTree";

interface NodeExecutionPanelProps {
  nodeExecution: NodeExecution;
  nodeName: string;
  onClose: () => void;
  onOpenFullEditor?: () => void;
}

type ViewMode = "schema" | "table" | "json";

export function NodeExecutionPanel({
  nodeExecution,
  nodeName,
  onClose,
  onOpenFullEditor,
}: NodeExecutionPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("schema");
  const [activeTab, setActiveTab] = useState<"input" | "output">("output");

  // Parse input/output data
  const inputData = nodeExecution.inputs || {};
  const outputData = nodeExecution.outputs || {};

  // Count items
  const inputCount = Object.keys(inputData).length;
  const outputCount = Object.keys(outputData).length;

  const currentData = activeTab === "input" ? inputData : outputData;
  const hasData = Object.keys(currentData).length > 0;

  return (
    <div className="h-full flex flex-col bg-background border-l">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm">{nodeName}</h3>
          <StatusBadge status={nodeExecution.status} size="sm" />
        </div>
        <div className="flex items-center gap-2">
          {onOpenFullEditor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFullEditor}
              title="Open full editor"
            >
              <LucideIcon name="maximize-2" className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <LucideIcon name="x" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Execution Info */}
      <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Execution Time</span>
          <span className="font-mono">
            {nodeExecution.startedAt && nodeExecution.completedAt
              ? `${(
                  (new Date(nodeExecution.completedAt).getTime() -
                    new Date(nodeExecution.startedAt).getTime()) /
                  1000
                ).toFixed(2)}s`
              : "N/A"}
          </span>
        </div>
        {nodeExecution.tokensUsed && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tokens Used</span>
            <span className="font-mono">{nodeExecution.tokensUsed}</span>
          </div>
        )}
        {nodeExecution.errorMessage && (
          <div className="text-xs text-red-11 bg-red-2 p-2 rounded">
            {nodeExecution.errorMessage}
          </div>
        )}
      </div>

      {/* Tabs: Input / Output */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "input" | "output")}
        className="flex-1 flex flex-col"
      >
        <div className="px-4 pt-3 pb-2 border-b flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="input" className="text-xs">
              Input
              {inputCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {inputCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="output" className="text-xs">
              Output
              {outputCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {outputCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* View Mode Tabs */}
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
            className="w-auto"
          >
            <TabsList className="h-7 gap-1">
              <TabsTrigger value="schema" className="text-xs px-1">
                <Ungroup className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="table" className="text-xs px-1">
                <Table2 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="json" className="text-xs px-1">
                <Code2 className="w-4 h-4" />
                <span className="sr-only">JSON</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TabsContent value="input" className="flex-1 overflow-y-auto mt-0">
          <DataView data={inputData} viewMode={viewMode} dataType="input" />
        </TabsContent>

        <TabsContent value="output" className="flex-1 overflow-y-auto mt-0">
          <DataView data={outputData} viewMode={viewMode} dataType="output" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface DataViewProps {
  data: Record<string, unknown>;
  viewMode: ViewMode;
  dataType: "input" | "output";
}

function DataView({ data, viewMode, dataType }: DataViewProps) {
  if (Object.keys(data).length === 0) {
    return (
      <div className="p-8 text-center">
        <LucideIcon
          name="inbox"
          className="h-12 w-12 mx-auto text-muted-foreground mb-3"
        />
        <p className="text-sm text-muted-foreground">
          No {dataType} data available
        </p>
        {dataType === "input" && (
          <p className="text-xs text-muted-foreground mt-1">
            This node may not have any input connections
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Schema View */}
      {viewMode === "schema" && (
        <SchemaTree data={data} path={dataType} draggable={false} />
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-6">
                <th className="text-left py-2 px-2 font-semibold text-surface-11 bg-surface-2">
                  Key
                </th>
                <th className="text-left py-2 px-2 font-semibold text-surface-11 bg-surface-2">
                  Value
                </th>
                <th className="text-left py-2 px-2 font-semibold text-surface-11 bg-surface-2">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data).map(([key, value]) => {
                const valueType = Array.isArray(value)
                  ? "array"
                  : value === null
                    ? "null"
                    : typeof value;
                const displayValue =
                  typeof value === "object" && value !== null
                    ? JSON.stringify(value)
                    : String(value);

                return (
                  <tr
                    key={key}
                    className="border-b border-surface-5 hover:bg-surface-2"
                  >
                    <td className="py-2 px-2 font-medium text-surface-12">
                      {key}
                    </td>
                    <td className="py-2 px-2 text-surface-11 max-w-xs truncate">
                      {displayValue}
                    </td>
                    <td className="py-2 px-2 text-surface-10">
                      <span className="px-2 py-0.5 bg-surface-3 rounded">
                        {valueType}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* JSON View */}
      {viewMode === "json" && (
        <pre className="text-xs bg-surface-3 p-3 rounded overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
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
    pending: {
      label: "Pending",
      variant: "secondary" as const,
      icon: "clock",
      className: "",
    },
    running: {
      label: "Running",
      variant: "default" as const,
      icon: "loader-2",
      className: "",
    },
    completed: {
      label: "Success",
      variant: "default" as const,
      icon: "check-circle",
      className: "bg-green-9 text-white",
    },
    failed: {
      label: "Failed",
      variant: "destructive" as const,
      icon: "x-circle",
      className: "",
    },
    skipped: {
      label: "Skipped",
      variant: "secondary" as const,
      icon: "skip-forward",
      className: "",
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <Badge
      variant={config.variant}
      className={`flex items-center gap-1 ${
        size === "sm" ? "text-xs py-0 px-2" : ""
      } ${config.className}`}
    >
      <LucideIcon
        name={config.icon}
        className={`size-3 ${status === "running" ? "animate-spin" : ""}`}
      />
      {config.label}
    </Badge>
  );
}

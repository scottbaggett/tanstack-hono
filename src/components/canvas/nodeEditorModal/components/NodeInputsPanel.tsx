/**
 * Input Explorer Panel
 *
 * Shows execution data from connected upstream nodes
 * Displays json and binary accessors with their properties
 * Supports Schema, Table, and JSON views like n8n
 */

import type { Node } from "@xyflow/react";
import { Code2, Table2, Ungroup } from "lucide-react";
import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaTree } from "./SchemaTree";

interface NodeInputsPanelProps {
  connectedNodes: Node[];
  executionResults: Record<string, unknown> | null;
}

type ViewMode = "schema" | "table" | "json";

export function NodeInputsPanel({
  connectedNodes,
  executionResults,
}: NodeInputsPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("schema");

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  if (connectedNodes.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="text-sm text-surface-11">No connected inputs</p>
          <p className="text-xs text-surface-10 mt-2">
            Connect nodes with edges to see their outputs here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Tabs */}
      <div className="px-4 border-b border-surface-6 h-12 flex items-center">
        <div className="flex items-center justify-between grow">
          <h3 className="font-semibold text-sm text-surface-11 uppercase tracking-wide">
            INPUT
          </h3>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar break-after-all">
        {connectedNodes.map((node) => {
          const nodeResults = executionResults?.[node.id];
          const nodeName =
            (node.data?.displayName as string) ||
            (node.data?.name as string) ||
            node.id;
          const isExpanded = expandedNodes.has(node.id);

          // Extract json data from execution results
          // nodeResults is the runData array: [{ data: { json, binary }, ... }]
          const nodeRun = Array.isArray(nodeResults) ? nodeResults[0] : null;
          const jsonData = nodeRun?.data?.json || null;
          const binaryData = nodeRun?.data?.binary || null;

          return (
            <div key={node.id} className="border-b border-surface-6">
              {/* Node Header */}
              <button
                type="button"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleNode(node.id);
                  }
                }}
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-surface-2"
                onClick={() => toggleNode(node.id)}
              >
                <LucideIcon name="globe" className="w-4 h-4 text-info-11" />
                <span className="text-sm font-medium text-surface-12">
                  {nodeName}
                </span>
                <span className="text-xs text-surface-10 ml-auto">
                  {jsonData ? "1 item" : "not executed"}
                </span>
                <LucideIcon
                  name={isExpanded ? "chevron-down" : "chevron-right"}
                  className="w-4 h-4 text-surface-11"
                />
              </button>

              {/* Node Data */}
              {isExpanded && (
                <div className="bg-surface-1 py-2">
                  {!jsonData && (
                    <div className="text-xs text-surface-10 px-4 py-8 text-center">
                      <p className="mb-1">No output data available</p>
                      <p className="text-surface-9">
                        Execute this node to see schema
                      </p>
                    </div>
                  )}

                  {jsonData && (
                    <>
                      {/* Schema View */}
                      {viewMode === "schema" && (
                        <div className="px-2">
                          <SchemaTree
                            data={jsonData}
                            path="json"
                            nodeName={nodeName}
                            draggable={true}
                          />
                        </div>
                      )}

                      {/* Table View */}
                      {viewMode === "table" && (
                        <div className="px-4">
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
                                {Object.entries(jsonData).map(
                                  ([key, value]) => {
                                    const valueType = Array.isArray(value)
                                      ? "array"
                                      : value === null
                                        ? "null"
                                        : typeof value;
                                    const displayValue =
                                      typeof value === "object" &&
                                      value !== null
                                        ? JSON.stringify(value)
                                        : String(value);

                                    return (
                                      <tr
                                        key={key}
                                        className="border-b border-surface-5 hover:bg-surface-2"
                                        draggable
                                        onDragStart={(e) => {
                                          const path = `{{ $items["${nodeName}"][0].json.${key} }}`;
                                          e.dataTransfer.setData(
                                            "text/plain",
                                            path,
                                          );
                                        }}
                                      >
                                        <td className="py-2 px-2 font-medium text-surface-12 cursor-grab">
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
                                  },
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* JSON View */}
                      {viewMode === "json" && (
                        <div className="px-4">
                          <pre className="text-xs bg-surface-3 p-3 rounded overflow-x-auto">
                            {JSON.stringify(jsonData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}

                  {/* Binary data section */}
                  {binaryData && Object.keys(binaryData).length > 0 && (
                    <div className="px-4 py-2 mt-2 border-t border-surface-6">
                      <div className="flex items-center gap-2 text-xs text-surface-11 mb-2">
                        <LucideIcon name="file-binary" className="w-3 h-3" />
                        <span className="font-medium">Binary Data</span>
                      </div>
                      <div className="space-y-1">
                        {Object.keys(binaryData).map((key) => (
                          <button
                            type="button"
                            key={key}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "text/plain",
                                `{{ $items["${nodeName}"][0].binary.${key} }}`,
                              );
                            }}
                            className="px-2 py-1 text-xs hover:bg-surface-3 rounded cursor-grab"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

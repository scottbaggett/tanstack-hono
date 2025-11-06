/**
 * Output Panel
 *
 * Execute node and display results with Schema/Table/JSON views
 */

import { Code2, Table2, Ungroup } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { INodeExecutionData } from "../../../../types/interfaces";
import { SchemaTree } from "./SchemaTree";

interface NodeOutputsPanelProps {
  executionResult?: INodeExecutionData;
}

type ViewMode = "schema" | "table" | "json";

export function NodeOutputsPanel({ executionResult }: NodeOutputsPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("schema");

  // Extract json data and error from execution result
  // executionResult is { json: {...}, binary: {...} } or { error: {...} }
  const jsonData = executionResult?.json || null;
  const errorData = executionResult?.error || null;

  const hasData = jsonData && typeof jsonData === "object";
  const hasError = errorData && typeof errorData === "object";

  return (
    <div className="flex flex-col h-full">
      {/* Header with Tabs */}
      <div className="px-4 pb-2 border-b h-12 flex items-center">
        <div className="flex items-center justify-between grow">
          <h3 className="font-semibold text-sm text-surface-11 uppercase tracking-wide">
            OUTPUT
          </h3>
          {hasData && (
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
              className="w-auto"
            >
              <TabsList className="h-7 gap-1">
                <TabsTrigger value="schema" className="text-xs px-1">
                  <Ungroup className="w-4 h-4" />
                  <span className="sr-only">Schema</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="text-xs px-1">
                  <Table2 className="w-4 h-4" />
                  <span className="sr-only">Table</span>
                </TabsTrigger>
                <TabsTrigger value="json" className="text-xs px-1">
                  <Code2 className="w-4 h-4" />
                  <span className="sr-only">JSON</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {hasError ? (
          <div className="flex flex-col items-start px-4 py-4">
            <div className="w-full space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-9" />
                <p className="text-sm text-red-11 font-semibold">
                  Execution Error
                </p>
              </div>
              <div className="bg-red-2 border border-red-6 rounded p-4">
                <p className="text-sm text-red-12 font-semibold">
                  {errorData.message}
                </p>
              </div>
              {errorData.stack && (
                <details className="w-full">
                  <summary className="text-xs text-surface-11 cursor-pointer hover:text-surface-12 font-medium">
                    View stack trace
                  </summary>
                  <pre className="text-xs text-surface-11 mt-3 p-3 bg-surface-3 rounded whitespace-pre-wrap font-mono border border-surface-6">
                    {errorData.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-center">
              <p className="text-sm text-surface-11 font-semibold">
                Execute this node to view output
              </p>
              <p className="text-xs text-surface-10 mt-2">
                Results will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {/* Schema View */}
            {viewMode === "schema" && (
              <div className="px-2">
                <SchemaTree data={jsonData} path="json" draggable={false} />
              </div>
            )}

            {/* Table View */}
            {viewMode === "table" && (
              <div className="px-4">
                <div className="">
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
                      {Object.entries(jsonData).map(([key, value]) => {
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
                            <td className="py-2 px-2 font-medium text-surface-12 cursor-grab align-top">
                              {key}
                            </td>
                            <td className="py-2 px-2 text-surface-11 max-w-xs align-top">
                              {displayValue}
                            </td>
                            <td className="py-2 px-2 text-surface-10 align-top">
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
              </div>
            )}

            {/* JSON View */}
            {viewMode === "json" && (
              <div className="px-4">
                <pre
                  lang="json"
                  className="text-xs bg-surface-3 p-3 rounded whitespace-pre-wrap wrap-break-word"
                >
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

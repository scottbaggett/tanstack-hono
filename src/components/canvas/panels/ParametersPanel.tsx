import type { Node } from "@xyflow/react";
import type React from "react";
import { ExpressionInput } from "@/components/shared/ExpressionInput";
import { SchemaBuilder } from "@/components/shared/SchemaBuilder";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/ui/json-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { INodeExecutionData } from "@/types/interfaces";
import { CredentialSelector } from "./CredentialSelector";

interface NodeProperty {
  displayName: string;
  name: string;
  type: string;
  default?: unknown;
  description?: string;
  noDataExpression?: boolean;
  options?: Array<{ name: string; value: unknown; description?: string }>;
}

interface CredentialRequirement {
  name: string;
  required?: boolean;
}

interface ParametersPanelProps {
  selectedNode: Node;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  nodeRegistry: any;
  currentPropertyValues: Record<string, unknown>;
  onPropertyValuesChange: (values: Record<string, unknown>) => void;
  executionResults?: INodeExecutionData;
  allExecutionResults?: Record<string, INodeExecutionData>;
  connectedNodes?: Node[];
}

export function ParametersPanel({
  selectedNode,
  onUpdateNode,
  nodeRegistry,
  currentPropertyValues,
  onPropertyValuesChange,
  executionResults: _executionResults,
  allExecutionResults,
  connectedNodes = [],
}: ParametersPanelProps) {
  const nodeData = selectedNode.data as Record<string, unknown>;
  // Support both new nodeType and legacy nodeId
  const nodeType = (nodeData.nodeType || nodeData.nodeId) as string;

  // Look up property and credential definitions from registry
  const registryNode = nodeRegistry?.nodes?.find((n: any) => n.id === nodeType);

  const propertyDefinitions = Array.isArray(registryNode?.properties)
    ? (registryNode.properties as NodeProperty[])
    : [];
  const credentialRequirements = Array.isArray(registryNode?.credentials)
    ? (registryNode.credentials as CredentialRequirement[])
    : [];

  // Get current credentials from node data
  const currentCredentials =
    (nodeData.credentials as Record<string, { id: string; name: string }>) ||
    {};

  const handlePropertyChange = (propertyName: string, value: unknown) => {
    onPropertyValuesChange({
      ...currentPropertyValues,
      [propertyName]: value,
    });
  };

  const handleCredentialChange = (
    credentialType: string,
    credential: { id: string; name: string } | null,
  ) => {
    const updatedCredentials = { ...currentCredentials };

    if (credential) {
      updatedCredentials[credentialType] = credential;
    } else {
      delete updatedCredentials[credentialType];
    }

    // Update node data directly (not part of property values)
    onUpdateNode(selectedNode.id, {
      ...selectedNode.data,
      credentials: updatedCredentials,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, fieldName: string) => {
    e.preventDefault();
    const expression = e.dataTransfer.getData("text/plain");
    if (expression) {
      handlePropertyChange(fieldName, expression);
    }
  };

  // Build simple expression context - node names become camelCase variables
  // Example: "Manual Trigger" → manualTrigger.prompt
  const expressionContext = (() => {
    if (!allExecutionResults) {
      return undefined;
    }

    const context: Record<string, any> = {};
    const nodeNameCounts: Record<string, number> = {};

    // Add data from each connected node with camelCase keys
    for (const node of connectedNodes) {
      const nodeResult = allExecutionResults[node.id] as any;

      if (nodeResult && nodeResult.data && !nodeResult.error) {
        // Get node display name
        const nodeName =
          (node.data?.displayName as string) ||
          (node.data?.name as string) ||
          node.id;

        // Convert to camelCase for simple access
        let camelCaseName = nodeName
          .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
          .replace(/^[A-Z]/, (char) => char.toLowerCase());

        // Handle duplicate node names by appending number
        if (nodeNameCounts[camelCaseName]) {
          nodeNameCounts[camelCaseName]++;
          camelCaseName = `${camelCaseName}${nodeNameCounts[camelCaseName]}`;
        } else {
          nodeNameCounts[camelCaseName] = 1;
        }

        // Get first item from main or output handle
        const firstItem =
          nodeResult.data.main?.[0] || nodeResult.data.output?.[0];

        if (firstItem && firstItem.json) {
          // Flatten the structure - just use the json data directly
          context[camelCaseName] = firstItem.json;
        }
      }
    }

    // Add previousNode helper (last connected node with data)
    const lastConnectedNode = connectedNodes[connectedNodes.length - 1];
    if (lastConnectedNode) {
      const nodeResult = allExecutionResults[lastConnectedNode.id] as any;
      if (nodeResult && nodeResult.data && !nodeResult.error) {
        const firstItem =
          nodeResult.data.main?.[0] || nodeResult.data.output?.[0];
        if (firstItem && firstItem.json) {
          context.previousNode = firstItem.json;
        }
      }
    }

    // Add current node's parameters
    context.parameters = currentPropertyValues;

    // Add date helpers
    const now = new Date();
    context.dates = {
      now: now.toISOString(),
      today: now.toISOString().split('T')[0],
      timestamp: now.getTime(),
    };

    // Add workflow context (placeholder for now)
    context.workflow = {
      id: 'workflow-id', // TODO: Get from actual workflow
      name: 'Workflow Name',
    };

    // If no connected nodes have data, return undefined
    if (Object.keys(context).length === 4 && context.parameters && context.dates && context.workflow) {
      return undefined;
    }

    return context;
  })();

  // Build autocomplete data from connected nodes with duplicate handling
  // Show all connected nodes in autocomplete, regardless of execution status
  const connectedNodesData = (() => {
    const nodeData: Array<{ id: string; name: string; variableName: string }> = [];
    const nodeNameCounts: Record<string, number> = {};

    for (const node of connectedNodes) {
      const nodeName =
        (node.data?.displayName as string) ||
        (node.data?.name as string) ||
        node.id;

      // Convert to camelCase
      let camelCaseName = nodeName
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
        .replace(/^[A-Z]/, (char) => char.toLowerCase());

      // Handle duplicate names
      if (nodeNameCounts[camelCaseName]) {
        nodeNameCounts[camelCaseName]++;
        camelCaseName = `${camelCaseName}${nodeNameCounts[camelCaseName]}`;
      } else {
        nodeNameCounts[camelCaseName] = 1;
      }

      nodeData.push({
        id: node.id,
        name: nodeName,
        variableName: camelCaseName,
      });
    }

    return nodeData;
  })();

  const hasCredentials = credentialRequirements.length > 0;
  const hasProperties = propertyDefinitions.length > 0;

  // Check if this is a webhook node
  const isWebhookNode = nodeType === "webhook";

  // Generate webhook URL if this is a webhook node
  const webhookUrl = isWebhookNode
    ? (() => {
        const path = currentPropertyValues.path || selectedNode.id;
        const baseUrl = window.location.origin;
        return `${baseUrl}/api/webhook/${path}`;
      })()
    : null;

  const handleCopyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
    }
  };

  if (!hasCredentials && !hasProperties && !isWebhookNode) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="text-sm text-surface-11">No configuration required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto  no-scrollbar">
        {/* Webhook URL Section (for webhook nodes) */}
        {isWebhookNode && webhookUrl && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold">Webhook URL</h3>
              <p className="text-xs text-surface-11 mt-1">
                Send HTTP requests to this URL to trigger the workflow
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface-3 px-3 py-2 rounded text-xs font-mono text-surface-12 overflow-x-auto whitespace-nowrap">
                  {webhookUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopyWebhookUrl}
                  className="px-3 py-2 bg-surface-4 hover:bg-surface-5 rounded text-xs font-medium transition-colors"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-surface-10">
                Method: {(currentPropertyValues.httpMethod as string) || "POST"}
              </p>
            </div>
          </div>
        )}

        {/* Credentials Section */}
        {hasCredentials && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Credentials</h3>
              <p className="text-xs text-surface-11 mt-1">
                Authentication for this node
              </p>
            </div>

            {credentialRequirements.map((credReq) => {
              const credential = currentCredentials[credReq.name];

              return (
                <div key={credReq.name} className="space-y-2">
                  <p className="text-sm font-medium text-surface-12">
                    {credReq.name}
                    {credReq.required && (
                      <span className="text-red-9 ml-1">*</span>
                    )}
                  </p>
                  <CredentialSelector
                    credentialType={credReq.name}
                    value={credential || null}
                    onChange={(cred) =>
                      handleCredentialChange(credReq.name, cred)
                    }
                    required={credReq.required}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="p-3 h-12  border-b">
          <h3 className="font-semibold text-sm text-surface-11 uppercase tracking-wide">
            PARAMETERS
          </h3>
        </div>

        {/* Parameters Section */}
        {hasProperties && (
          <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar h-full px-4 pt-4">
            {propertyDefinitions.map((prop) => {
              if (
                typeof prop !== "object" ||
                prop === null ||
                !("name" in prop)
              ) {
                return null;
              }

              const property = prop as NodeProperty;
              const currentValue =
                currentPropertyValues[property.name] ?? property.default ?? "";

              // Render different input types based on property type
              const renderInput = () => {
                switch (property.type) {
                  case "json": {
                    // Use SchemaBuilder for schema property
                    if (property.name === "schema") {
                      return (
                        <SchemaBuilder
                          value={currentValue as any}
                          onChange={(val) =>
                            handlePropertyChange(property.name, val)
                          }
                          onGenerate={async (prompt) => {
                            try {
                              const response = await fetch(
                                "/api/schema/generate",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ prompt }),
                                },
                              );

                              const result = await response.json();

                              if (!result.success) {
                                throw new Error(
                                  result.error || "Schema generation failed",
                                );
                              }

                              return result.data;
                            } catch (error) {
                              console.error("Schema generation failed:", error);
                              // Return a fallback schema on error
                              return {
                                name: "error_schema",
                                description: `Failed to generate from prompt: ${error instanceof Error ? error.message : "Unknown error"}`,
                                properties: {
                                  error: {
                                    type: "string",
                                    description: "Error message",
                                  },
                                },
                              };
                            }
                          }}
                        />
                      );
                    }

                    // Regular JSON editor for other properties
                    return (
                      <JsonEditor
                        value={currentValue}
                        onChange={(val) =>
                          handlePropertyChange(property.name, val)
                        }
                        placeholder={
                          typeof property.default === "object"
                            ? JSON.stringify(property.default, null, 2)
                            : "{}"
                        }
                      />
                    );
                  }
                  case "select": {
                    // For select type, check if property has options
                    const options = property.options || [];
                    if (options.length > 0) {
                      return (
                        <Select
                          value={String(
                            currentValue || options[0]?.value || "",
                          )}
                          onValueChange={(val) =>
                            handlePropertyChange(property.name, val)
                          }
                        >
                          <SelectTrigger className="bg-surface-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem
                                key={String(opt.value)}
                                value={String(opt.value)}
                              >
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }
                    // Fall through to ExpressionInput if no options (unless noDataExpression)
                    if (property.noDataExpression) {
                      return (
                        <Input
                          type="text"
                          value={String(currentValue)}
                          onChange={(e) =>
                            handlePropertyChange(property.name, e.target.value)
                          }
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, property.name)}
                          placeholder={String(property.default || "")}
                          className="bg-surface-3"
                        />
                      );
                    }
                    return (
                      <ExpressionInput
                        value={String(currentValue)}
                        onChange={(val) =>
                          handlePropertyChange(property.name, val)
                        }
                        executionContext={expressionContext}
                        connectedNodes={connectedNodesData}
                      />
                    );
                  }
                  case "boolean": {
                    return (
                      <Switch
                        checked={Boolean(currentValue)}
                        onCheckedChange={(checked) =>
                          handlePropertyChange(property.name, checked)
                        }
                      />
                    );
                  }
                  case "number": {
                    return (
                      <Input
                        type="number"
                        value={String(currentValue)}
                        onChange={(e) => {
                          const numValue =
                            e.target.value === "" ? 0 : Number(e.target.value);
                          handlePropertyChange(property.name, numValue);
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, property.name)}
                        placeholder={String(property.default || "")}
                        className="bg-surface-3"
                      />
                    );
                  }
                  default: {
                    // Default to ExpressionInput for text (unless noDataExpression)
                    if (property.noDataExpression) {
                      return (
                        <Input
                          type="text"
                          value={String(currentValue)}
                          onChange={(e) =>
                            handlePropertyChange(property.name, e.target.value)
                          }
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, property.name)}
                          placeholder={String(property.default || "")}
                          className="bg-surface-3"
                        />
                      );
                    }
                    return (
                      <ExpressionInput
                        value={String(currentValue)}
                        onChange={(val) =>
                          handlePropertyChange(property.name, val)
                        }
                        executionContext={expressionContext}
                        connectedNodes={connectedNodesData}
                      />
                    );
                  }
                }
              };

              return (
                <div key={property.name} className="space-y-2">
                  <p className="text-sm font-medium text-surface-12">
                    {property.displayName || property.name}
                  </p>
                  {property.description && (
                    <p className="text-xs text-surface-11">
                      {property.description}
                    </p>
                  )}
                  {renderInput()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

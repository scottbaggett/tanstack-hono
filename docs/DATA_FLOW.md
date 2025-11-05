# Data Flow Architecture

## Overview

Data flows between nodes using a simplified n8n-compatible format. This document explains the structure and how to work with it.

## Data Structure

### Execution Response Format
```json
{
  "success": boolean,
  "runData": {
    "NodeName": [
      {
        "data": {
          "json": { "field": "value" },
          "binary": null
        },
        "error": null,
        "startTime": 1744774591588,
        "executionTime": 3,
        "metadata": { ... }
      }
    ]
  }
}
```

### Key Components

1. **`runData`** - Contains all node execution results, keyed by node name/id
2. **Node array** - Each node has an array of execution runs (supports loop iterations)
3. **Run object** - Contains:
   - `data` - The successful output data with `json` and `binary` (null if error)
   - `error` - Error information if execution failed (null if success)
   - `startTime` - Timestamp when execution started
   - `executionTime` - Duration in milliseconds
   - `metadata` - Additional execution metadata

4. **Data structure** (success):
```typescript
{
  json: Record<string, any>,       // The actual data
  binary?: Record<string, Buffer>  // Optional: files, images
}
```

5. **Error structure** (failure):
```typescript
{
  message: string,      // Error description
  stack?: string,       // Stack trace
  name?: string        // Error type/name
}
```

### Example: Successful Agent Execution
```json
{
  "success": true,
  "runData": {
    "agent-123": [
      {
        "data": {
          "json": {
            "output": "The answer is 20"
          },
          "binary": null
        },
        "error": null,
        "startTime": 1744774591588,
        "executionTime": 2847,
        "metadata": {
          "executedAt": "2025-01-14T10:23:14.435Z",
          "upstreamNodes": []
        }
      }
    ]
  }
}
```

### Example: Failed Node Execution
```json
{
  "success": false,
  "runData": {
    "agent-123": [
      {
        "data": null,
        "error": {
          "message": "API key not configured",
          "stack": "Error: API key not configured\n    at execute (/src/nodes/agent/execute.ts:106:11)",
          "name": "ConfigurationError"
        },
        "startTime": 1744774591588,
        "executionTime": 12,
        "metadata": {
          "executedAt": "2025-01-14T10:23:14.600Z",
          "upstreamNodes": []
        }
      }
    ]
  }
}
```

### Example: Multiple Node Results
```json
{
  "success": true,
  "runData": {
    "webhook-1": [
      {
        "data": {
          "json": { "email": "user@example.com", "name": "John" },
          "binary": null
        },
        "startTime": 1744774590000,
        "executionTime": 5
      }
    ],
    "agent-1": [
      {
        "data": {
          "json": { "output": "Hello John!" },
          "binary": null
        },
        "startTime": 1744774591588,
        "executionTime": 2847
      }
    ]
  },
  "errors": []
}
```

## For UI Implementation

### Accessing Execution Results
```typescript
// From API response
const result = await response.json();
const runData = result.runData;

// Get specific node's output
const nodeId = "agent-123";
const nodeRun = runData[nodeId]?.[0];
const jsonData = nodeRun?.data?.json;
const binaryData = nodeRun?.data?.binary;
```

### Displaying Output Schema
```typescript
// Show what a node produced
const nodeRun = runData[nodeId]?.[0];
if (nodeRun?.data?.json) {
  const schema = Object.keys(nodeRun.data.json);
  // Display: ["output"]
}
```

### Displaying Input Schema
```typescript
// Get upstream node's output to show as input
const upstreamNodeRun = runData[upstreamNodeId]?.[0];
if (upstreamNodeRun?.data?.json) {
  const inputSchema = Object.keys(upstreamNodeRun.data.json);
  // Display available fields from upstream
}
```

### Schema Inference (Before Execution)
For nodes that haven't executed yet, infer schema from node type definition:
```typescript
// From node registry
const nodeType = nodeRegistry.getNodeType("agent");
const expectedOutputSchema = {
  fields: [
    { name: "output", type: "string" }
  ]
};
```

## Internal Node Execution

While the API returns simplified `runData`, nodes internally still use n8n's data flow pattern with handles for future multi-output support.

### Node Execution Context
```typescript
// Inside a node's execute function
const items = context.getInputByHandle("main");
const firstItem = items?.[0];
const inputData = firstItem?.json;

// Process and return output
const result: INodeExecutionData = {
  json: {
    output: "processed result"
  },
  binary: null
};

return [[result]]; // Wrapped for main handle
```

### From Handle-Based to API Response
The orchestrator converts internal handle-based data to the simplified API format:
```typescript
// Internal: nodeResult.data = { main: [{ json: {...} }] }
// API: runData[nodeId][0].data = { json: {...}, binary: null }
```

## Type Definitions

### API Response Types
```typescript
interface ExecutionResponse {
  success: boolean;
  runData: {
    [nodeId: string]: NodeRun[];
  };
}

interface NodeRun {
  data: {
    json: Record<string, any>;
    binary: Record<string, Buffer> | null;
  } | null;
  error: {
    message: string;
    stack?: string;
    name?: string;
  } | null;
  startTime: number;
  executionTime: number;
  metadata?: Record<string, any>;
}
```

### Internal Types (Node Execution)
```typescript
interface INodeExecutionData {
  json?: Record<string, any>;
  binary?: Record<string, Buffer>;
  pairedItem?: number | number[];
  error?: Error;
}

interface NodeExecutionResult {
  nodeId: string;
  nodeType: string;
  status: "success" | "error" | "skipped";

  // Internal handle-based data
  inputData: Record<string, unknown>;
  data?: Record<string, INodeExecutionData[]>; // { main: [...], error: [...] }

  // Metadata
  startTime: number;
  endTime: number;
  durationMs: number;
  events: StreamEvent[];
  error?: Error;
}
```

## Common Patterns

### Single Result (Most Nodes)
```typescript
return [[{ json: { result: "value" } }]];
```

### Multiple Results (Batch Processing)
```typescript
return [[
  { json: { id: 1, name: "Alice" } },
  { json: { id: 2, name: "Bob" } }
]];
```

### Multiple Outputs (Branching)
```typescript
// Not yet implemented - future feature
return [
  [{ json: { success: true } }],  // "success" handle
  [{ json: { error: "msg" } }]     // "error" handle
];
```

### Empty Result
```typescript
return [[]]; // No items output
```

## Summary

**Key Principles:**
1. ✅ API uses simplified `runData` structure for clarity
2. ✅ Each node has array of runs (supports loops in future)
3. ✅ Each run contains `data: { json, binary }`
4. ✅ Internally nodes use handle-based flow for flexibility
5. ✅ Schema is discoverable from `json` object keys

**For UI:**
- Access node output via `runData[nodeId][0].data.json`
- Display schema from Object.keys() of json
- Show execution time and metadata from run object
- Support for multiple runs per node (future loop feature)

**For Node Developers:**
- Return data in handle format: `[[{ json: {...} }]]`
- Orchestrator converts to simplified API format
- Maintains n8n compatibility internally
- Clean API for external consumers

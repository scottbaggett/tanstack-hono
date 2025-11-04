# Node System - Complete Guide

The workflow builder uses a comprehensive node system that allows you to compose complex workflows by connecting different types of nodes. The system is inspired by n8n's node architecture and supports multiple execution modes.

## Architecture

```
┌─────────────────────────────────────────┐
│  Backend Node System                    │
│  src/server/nodes/                      │
├─────────────────────────────────────────┤
│ - base.ts (NodeRegistry, NodeBuilder)   │
│ - Node.ts (Base class, interfaces)      │
│ - builtin.ts (Text I/O, transform, etc) │
│ - examples/ (Sample nodes)              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Nodes API Endpoint                     │
│  GET /api/nodes                         │
│  GET /api/nodes/:id                     │
│  GET /api/nodes/category/:category      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Frontend Node Registry Hook            │
│  src/hooks/use-node-registry.ts         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Canvas Components                      │
│  - Canvas.tsx (main editor)             │
│  - NodePanel.tsx (node browser)         │
│  - WorkflowNode.tsx (node renderer)     │
└─────────────────────────────────────────┘
```

## Available Built-in Nodes

### Input Nodes
- **Text Input** (`text-input`) - Accept text from user
  - Returns structured data with text, length, and wordCount properties

### Output Nodes
- **Text Output** (`text-output`) - Display text as final result
  - Processes incoming data and displays output

### Transform Nodes
- **String Transform** (`string-transform`) - Transform text (uppercase, lowercase, etc.)
  - Transforms input data and returns result with metadata

- **Delay** (`delay`) - Wait for specified milliseconds
  - Delays execution and passes through data

## Node Structure

Every node has a standardized structure:

```typescript
interface INodeTypeDescription {
  // Unique identifier
  name: string;

  // Display name in UI
  displayName: string;

  // Detailed description
  description?: string;

  // Category for grouping
  group: string[];

  // Icon name (lucide-react)
  icon: string;

  // Configuration properties
  properties: NodeProperty[];

  // Execution mode
  mode?: "execute" | "webhook" | "poll";
}
```

**Key Simplification**: Nodes no longer declare input/output field arrays. Instead:
- Nodes have generic connection points
- Data flows through `INodeExecutionData[][]` structure
- Each node's `execute()` method returns this standardized format

## Using Nodes in the Frontend

### Accessing the Node Registry

```typescript
import { useNodeRegistry } from "@/hooks/use-node-registry";

function NodeBrowser() {
  const { data: nodesData, isLoading } = useNodeRegistry();

  if (isLoading) return <div>Loading nodes...</div>;

  return (
    <div>
      <h2>Available Nodes ({nodesData?.total})</h2>
      {nodesData?.nodes.map((node) => (
        <div key={node.id}>
          <h3>{node.displayName}</h3>
          <p>{node.description}</p>
          <p>Category: {node.category}</p>
        </div>
      ))}
    </div>
  );
}
```

### Nodes Grouped by Category

```typescript
import { useNodesByCategory } from "@/hooks/use-node-registry";

function CategorizedNodes() {
  const { categories } = useNodesByCategory();

  return (
    <div>
      {Object.entries(categories).map(([category, nodes]) => (
        <div key={category}>
          <h3>{category}</h3>
          {nodes.map((node) => (
            <button key={node.id}>{node.displayName}</button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Specific Node Information

```typescript
import { useNodeDefinition } from "@/hooks/use-node-registry";

function NodeDetails({ nodeId }: { nodeId: string }) {
  const { nodeDefinition, isLoading } = useNodeDefinition(nodeId);

  if (isLoading) return <div>Loading...</div>;
  if (!nodeDefinition) return <div>Node not found</div>;

  return (
    <div>
      <h3>{nodeDefinition.displayName}</h3>
      <p>{nodeDefinition.description}</p>
      <p>Category: {nodeDefinition.group?.join(", ")}</p>

      <h4>Properties:</h4>
      {nodeDefinition.properties.map((prop) => (
        <div key={prop.name}>
          <strong>{prop.displayName}</strong> ({prop.type})
          {prop.required && <span>*</span>}
        </div>
      ))}
    </div>
  );
}
```

## Canvas Integration

The Canvas component includes a built-in NodePanel on the left sidebar that allows users to:

1. **Browse Nodes** - View all available nodes organized by category
2. **Search Nodes** - Find nodes by name or description
3. **Drag & Drop** - Drag nodes from the panel onto the canvas to create instances
4. **Node Information** - Hover over nodes to see descriptions

### Drag and Drop

Nodes can be dragged from the NodePanel and dropped onto the canvas. The system automatically:

1. Creates a new node instance with a unique ID
2. Positions it at the drop location
3. Initializes it with default values

```typescript
// The Canvas component handles this automatically
<div onDragOver={(e) => e.preventDefault()} onDrop={handleNodeDrop}>
  {/* Canvas content */}
</div>
```

## Node Execution Flow

When a workflow runs:

1. **Topological Sort** - Nodes are ordered by their dependencies
2. **Sequential Execution** - Nodes execute in dependency order
3. **Data Flow** - Each node returns `INodeExecutionData[][]` which flows to connected nodes
4. **Error Handling** - If a node fails, execution stops with error message

### Data Structure

```typescript
interface INodeExecutionData {
  json: IDataObject;        // Main structured data (any JSON-serializable data)
  binary?: IBinaryKeyData;  // Optional binary data (images, files, etc.)
  pairedItem?: number | number[]; // Links to input items
}
```

**Important**: All data types flow through this structure:
- Strings, numbers, objects, arrays go in the `json` property
- Binary data (buffers, images) go in the `binary` property
- Nodes return arrays of arrays: `INodeExecutionData[][]`
  - Outer array: multiple outputs (branches)
  - Inner array: multiple items per output

## Creating Custom Nodes

### Backend: Implement INodeType

```typescript
import type { INodeType, INodeTypeDescription, ExecutionContext } from "@/types/interfaces";

export class CustomNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Custom Node",
    name: "customNode",
    group: ["transform"],
    version: 1,
    description: "My custom node that processes data",
    icon: "zap",
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        options: [
          { name: "Process", value: "process" },
          { name: "Transform", value: "transform" }
        ],
        default: "process"
      }
    ]
  };

  async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
    const items = context.getInputData();
    const operation = context.getNodeParameter("operation", 0) as string;

    const returnData: INodeExecutionData[] = [];

    for (const item of items) {
      // Access input data via $json
      const inputData = item.json;

      // Process the data
      const processedData = processData(inputData, operation);

      // Return in INodeExecutionData format
      returnData.push({
        json: processedData,
        // binary: item.binary  // Pass through binary data if needed
      });
    }

    return [returnData];
  }
}
```

### Frontend: Use in Canvas

Once registered on the backend, the node:
1. Automatically appears in the NodePanel
2. Can be dragged onto the canvas
3. Shows generic connection points (no pre-defined input/output handles)
4. Can be connected to other nodes
5. Data structure is determined at runtime based on execution

## Node Categories

Nodes are organized into categories for easy discovery:

- **input** - Accept data from outside
- **output** - Output final results
- **transform** - Process and modify data
- **llm** - Language model operations
- **integration** - Connect to external services
- **utility** - Helper and utility nodes
- **custom** - User-defined nodes

## API Reference

### GET /api/nodes

Returns all available nodes.

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [...],
    "byCategory": {
      "input": [...],
      "output": [...],
      ...
    },
    "total": 10
  }
}
```

### GET /api/nodes/:id

Returns a specific node definition.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "text-input",
    "displayName": "Text Input",
    "description": "Accept text input from the user",
    "category": "input",
    "icon": "type",
    "version": 1,
    "inputs": [...],
    "outputs": [...],
    "properties": [...]
  }
}
```

### GET /api/nodes/category/:category

Returns nodes in a specific category.

**Response:**
```json
{
  "success": true,
  "data": {
    "category": "input",
    "nodes": [...],
    "total": 3
  }
}
```

## Data Types

All data flows through the `INodeExecutionData` structure:

### JSON Property (Main Data)
The `json` property holds all JSON-serializable data:
- Strings: `{ json: { text: "Hello" } }`
- Numbers: `{ json: { count: 42, temperature: 98.6 } }`
- Booleans: `{ json: { isActive: true } }`
- Objects: `{ json: { user: { name: "Alice", age: 30 } } }`
- Arrays: `{ json: { items: [1, 2, 3] } }`
- Mixed structures: `{ json: { name: "Report", data: [...], meta: {...} } }`

### Binary Property (Optional)
The `binary` property holds non-JSON data:
- Images (PNG, JPEG, etc.)
- PDF documents
- Audio/video files
- Any Buffer data

**Important**: `$json` is NOT a data type indicator - it's the accessor/selector for the `json` property in expressions. All data types flow through the `json` or `binary` properties.

## Node Properties

Node properties are configuration options available in the UI:

```typescript
interface NodeProperty {
  displayName: string;      // Label in UI
  name: string;             // Internal identifier
  type: string;             // string, number, boolean, options, credentials, json
  description?: string;     // Help text
  required?: boolean;       // If mandatory
  default?: unknown;        // Default value
  options?: Array<...>;     // For "options" type
  placeholder?: string;     // Input placeholder
  hint?: string;            // Tooltip/hint text
}
```

## Performance Considerations

- Nodes cache for 5 minutes via React Query
- Nodes are lazy-loaded from the API
- Node panel uses virtualization for large lists
- Drag & drop is optimized with event delegation

## Next Steps

1. **Create custom nodes** - Build domain-specific nodes
2. **Add more built-ins** - Expand HTTP, code execution, API nodes
3. **Node versioning** - Support multiple node versions
4. **Node validation** - Validate node configurations
5. **Error handling** - Detailed error messages per node

## Troubleshooting

### Nodes not appearing in panel
- Check that backend `/api/nodes` endpoint is working
- Verify node registry is properly initialized
- Check browser console for errors

### Can't drag nodes
- Ensure drag handlers are properly bound
- Check browser console for React errors
- Verify nodePanel component is rendered

### Node execution fails
- Check input types match node requirements
- Review node error logs
- Verify dependencies between nodes

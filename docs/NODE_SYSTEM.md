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
  - Outputs: text, length, wordCount

### Output Nodes
- **Text Output** (`text-output`) - Display text as final result
  - Inputs: text

### Transform Nodes
- **String Transform** (`string-transform`) - Transform text (uppercase, lowercase, etc.)
  - Inputs: text, operation
  - Outputs: result

- **Delay** (`delay`) - Wait for specified milliseconds
  - Inputs: milliseconds
  - Outputs: None (passes through)

## Node Structure

Every node has a standardized structure:

```typescript
interface NodeDefinition {
  // Unique identifier
  id: string;

  // Display name in UI
  displayName: string;

  // Detailed description
  description?: string;

  // Category for grouping
  category: string;

  // Icon name (lucide-react)
  icon: string;

  // Input/Output handles
  inputs: NodeInput[];
  outputs: NodeOutput[];

  // Configuration properties
  properties: NodeProperty[];

  // Execution mode
  mode?: "execute" | "webhook" | "poll";
}
```

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

      <h4>Inputs:</h4>
      {nodeDefinition.inputs.map((input) => (
        <div key={input.name}>
          <strong>{input.displayName}</strong> ({input.type})
          {input.required && <span>*</span>}
        </div>
      ))}

      <h4>Outputs:</h4>
      {nodeDefinition.outputs.map((output) => (
        <div key={output.name}>
          <strong>{output.displayName}</strong> ({output.type})
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
3. **Data Flow** - Output from one node feeds into the next
4. **Error Handling** - If a node fails, execution stops with error message

## Creating Custom Nodes

### Backend: Extend BaseNode

```typescript
import { BaseNode, NodeBuilder } from "@/server/nodes/base";

class CustomNode extends BaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const input = inputs.data as string;
    // Process input
    return {
      result: processedData,
    };
  }
}

// Register with NodeBuilder
new NodeBuilder("custom-node")
  .displayName("Custom Node")
  .category("custom")
  .description("My custom node")
  .icon("zap")
  .input({
    name: "data",
    description: "Input data",
    type: "string",
    required: true,
  })
  .output({
    name: "result",
    description: "Processed result",
    type: "string",
  })
  .execute(async (inputs) => {
    // Implementation
    return { result: "..." };
  })
  .register(CustomNode);
```

### Frontend: Use in Canvas

Once registered on the backend, the node:
1. Automatically appears in the NodePanel
2. Can be dragged onto the canvas
3. Shows proper input/output handles
4. Can be connected to other nodes

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

Nodes support multiple data types for inputs/outputs:

- `string` - Text data
- `number` - Numeric values
- `boolean` - True/false values
- `float` - Decimal numbers
- `json` - JSON objects/arrays
- `csv` - CSV formatted data
- `image:png` - PNG images
- `image:jpg` - JPEG images
- `pdf` - PDF documents
- `any` - Accept any type

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

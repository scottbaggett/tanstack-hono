# Node System Implementation Guide

This document explains the enhanced node system with visual node rendering, property configuration, and full integration with the Canvas editor.

## Overview

The node system has been significantly enhanced with:
- **Visual Node Rendering** - Nodes display with inputs/outputs as connection handles
- **Node Configuration Panel** - Edit node properties when selected
- **Color Palette Support** - Uses the design system color palettes for consistent styling
- **Drag-and-Drop Integration** - Nodes from the panel can be dragged onto the canvas
- **Type-Safe Node Definitions** - All nodes are defined with strict TypeScript types

## Architecture

```
┌─────────────────────────────────────────────┐
│         Backend Node Registration            │
│  src/server/nodes/                          │
│  - base.ts (NodeRegistry, NodeBuilder)      │
│  - builtin.ts (4 built-in nodes)            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│       Node API Routes (Type-Safe)            │
│  src/server/routes/nodes.ts                 │
│  GET /api/nodes         (all nodes)         │
│  GET /api/nodes/:id     (specific node)     │
│  GET /api/nodes/category/:category          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      Frontend Node Registry Hooks            │
│  src/hooks/use-node-registry.ts             │
│  - useNodeRegistry()        (all nodes)     │
│  - useNodesByCategory()     (grouped)       │
│  - useNodeDefinition(id)    (specific)      │
│  - useNodesInCategory(cat)  (by category)   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Canvas Editor Components             │
│  src/components/canvas/                     │
│  - Canvas.tsx              (main editor)    │
│  - NodePanel.tsx           (node browser)   │
│  - WorkflowNode.tsx        (node renderer)  │
│  - NodeConfigPanel.tsx     (config editor)  │
│  - CanvasToolbar.tsx       (toolbar)        │
└─────────────────────────────────────────────┘
```

## Components

### WorkflowNode.tsx

The visual representation of a node on the canvas. Features:

- **Dynamic Color Palettes**: Uses CSS variables from `@src/styles/node-palettes.css`
- **Input/Output Handles**: Each input and output is rendered as a connection point
- **Selection Highlighting**: Selected nodes show border glow
- **Responsive Layout**: Adapts to number of inputs/outputs

**Data Structure**:
```typescript
interface NodeData {
  label: string;           // Fallback display name
  nodeId: string;          // Unique node ID for handles
  displayName: string;     // Primary display name
  description?: string;    // Node description
  icon?: string;          // Lucide icon name
  color?: string;         // Color palette name (e.g., "standard-blue")
  inputs?: Array<{
    name: string;
    displayName: string;
    type: string;
  }>;
  outputs?: Array<{
    name: string;
    displayName: string;
    type: string;
  }>;
}
```

### NodePanel.tsx

The left sidebar for browsing and selecting nodes. Features:

- **Searchable**: Real-time filtering by name or description
- **Categorized**: Nodes organized by category (input, output, transform, etc.)
- **Collapsible Sections**: Expand/collapse categories
- **Drag-and-Drop**: Drag nodes onto the canvas to create instances
- **Visual Feedback**: Icons and descriptions for each node

### NodeConfigPanel.tsx

The right sidebar for editing selected node properties. Features:

- **Dynamic Form Generation**: Creates inputs based on node definition properties
- **Multiple Input Types**:
  - String inputs
  - Number inputs
  - Boolean toggles
  - Select dropdowns
  - JSON editors
- **Live Updates**: Changes apply immediately to the node data
- **Validation Ready**: Can validate inputs before saving

### Canvas.tsx

Main editor component orchestrating all pieces:

- **Node Management**: Create, update, delete nodes
- **Edge Management**: Create and manage connections
- **Drag-and-Drop**: Integrates node drop handler
- **Selection**: Click nodes to select and show config panel
- **Persistence**: Save workflow to database

## Built-in Nodes

### 1. Text Input (`text-input`)
- **Category**: input
- **Icon**: type
- **Outputs**:
  - `text` (string) - The input text
  - `length` (number) - Text length
  - `wordCount` (number) - Word count
- **Properties**: None

### 2. Text Output (`text-output`)
- **Category**: output
- **Icon**: send
- **Inputs**:
  - `text` (string) - Text to output
- **Properties**: None

### 3. String Transform (`string-transform`)
- **Category**: processing
- **Icon**: zap
- **Inputs**:
  - `text` (string, required) - Text to transform
  - `operation` (string, required) - Operation to apply
    - Options: uppercase, lowercase, reverse, trim, capitalize
- **Outputs**:
  - `result` (string) - Transformed text
  - `originalLength` (number) - Original text length
  - `resultLength` (number) - Result length

### 4. Delay (`delay`)
- **Category**: control
- **Icon**: clock
- **Inputs**:
  - `delayMs` (number, default: 1000) - Delay in milliseconds
  - `value` (any) - Value to pass through
- **Outputs**:
  - `value` (any) - The passed-through value
  - `delayedAt` (string) - ISO timestamp of completion

## Adding New Nodes

### Backend: Create Node Definition

Use the `NodeBuilder` fluent API in `src/server/nodes/builtin.ts`:

```typescript
import { BaseNode, NodeBuilder, nodeRegistry } from "./base";

class CustomNode extends BaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = inputs.data as string;
    return {
      result: processedData,
    };
  }
}

new NodeBuilder("custom-node")
  .displayName("Custom Node")
  .category("transform")
  .description("My custom node")
  .icon("zap")
  .input({
    name: "data",
    displayName: "Input Data",
    description: "The input data",
    type: "string",
    required: true,
  })
  .output({
    name: "result",
    displayName: "Result",
    type: "string",
  })
  .execute(async (inputs) => {
    const data = inputs.data as string;
    return { result: processData(data) };
  })
  .register(CustomNode);
```

### Frontend: Uses Registry Automatically

Once registered on the backend, nodes:
1. Appear in the NodePanel automatically
2. Can be dragged onto the canvas
3. Show proper inputs/outputs
4. Can be configured via NodeConfigPanel

## Color Palettes

Nodes use the design system color palettes. Available palette names:

**Standard Color Set**:
- `standard-gray`, `standard-red`, `standard-orange`, `standard-yellow`
- `standard-green`, `standard-teal`, `standard-blue`, `standard-purple`
- `standard-pink`, `standard-brown`, `standard-olive`, `standard-peach`, `standard-mint`, `standard-sky`

**Solid Color Set**:
- `solid-white`, `solid-red`, `solid-orange`, `solid-yellow`
- `solid-green`, `solid-cyan`, `solid-blue`, `solid-purple`

Set the color in your node definition:

```typescript
new NodeBuilder("my-node")
  .color("standard-blue")  // Adds a `color` property to the node
  // ... rest of definition
```

## Node Properties Format

Node properties are defined using JSON Schema:

```typescript
properties: [
  {
    name: "threshold",
    displayName: "Threshold",
    type: "number",
    description: "The threshold value",
    required: true,
    default: 0.5,
    placeholder: "0.0 - 1.0",
    hint: "Must be between 0 and 1"
  },
  {
    name: "operation",
    displayName: "Operation",
    type: "options",
    options: [
      { name: "Add", value: "add" },
      { name: "Subtract", value: "subtract" }
    ]
  }
]
```

## Using Nodes in Workflows

### 1. Create Workflow
Navigate to `/workflows/new` and create a new workflow.

### 2. Add Nodes
- Click canvas or use NodePanel on the left
- Search for nodes by name or description
- Drag nodes from panel to canvas

### 3. Configure Nodes
- Click on a node to select it
- Right panel opens with configuration options
- Edit properties as needed
- Click "Save" to apply changes

### 4. Connect Nodes
- Hover over output handles on the right of nodes
- Click and drag to an input handle on another node
- Connection established

### 5. Save Workflow
Click "Save" in the toolbar to persist the workflow.

## API Reference

### GET /api/nodes
Returns all available nodes grouped by category.

**Response**:
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "text-input",
        "displayName": "Text Input",
        "description": "Accept text input from the user",
        "category": "input",
        "icon": "type",
        "color": "standard-blue",
        "inputs": [],
        "outputs": [
          {
            "name": "text",
            "displayName": "Text",
            "type": "string"
          }
        ]
      }
    ],
    "byCategory": {
      "input": [/* nodes in category */],
      "output": [/* nodes in category */],
      "processing": [/* nodes in category */],
      "control": [/* nodes in category */],
      "integration": [/* nodes in category */]
    },
    "total": 4
  }
}
```

### GET /api/nodes/:id
Returns a specific node definition.

**Example**: `GET /api/nodes/text-input`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "text-input",
    "displayName": "Text Input",
    "description": "Accept text input from the user",
    "category": "input",
    "icon": "type",
    "color": "standard-blue",
    "inputs": [],
    "outputs": [
      {
        "name": "text",
        "displayName": "Text",
        "type": "string"
      },
      {
        "name": "length",
        "displayName": "Length",
        "type": "number"
      },
      {
        "name": "wordCount",
        "displayName": "Word Count",
        "type": "number"
      }
    ]
  }
}
```

### GET /api/nodes/category/:category
Returns nodes in a specific category.

**Example**: `GET /api/nodes/category/input`

## Styling with Node Palettes

The node renderer automatically applies CSS variables from the selected color palette:

```css
/* From node-palettes.css */
[data-node-color="standard-blue"] {
  --color-node: hsl(...);
  --color-node-foreground: hsl(...);
  --color-node-border: hsl(...);
  --color-node-muted-foreground: hsl(...);
  --color-node-highlight: hsla(...);
  --color-node-input: hsla(...);
}
```

Nodes use these CSS variables via Tailwind's `var()` function for full consistency with the design system.

## Troubleshooting

### Nodes don't appear in panel
1. Check that builtin.ts is imported in nodes route
2. Verify node definitions are registered correctly
3. Check browser console for API errors
4. Test `/api/nodes` endpoint directly

### Drag-and-drop not working
1. Ensure NodePanel is visible
2. Check that `onDrop` handler is attached to canvas
3. Verify dataTransfer contains `application/json`
4. Check browser console for errors

### Config panel doesn't show
1. Click on a node to select it
2. Check that Canvas passes `showConfig={true}`
3. Verify NodeConfigPanel is mounted
4. Check node definition includes `properties` array

### Styling issues
1. Verify `node-palettes.css` is imported in styles
2. Check that `data-node-color` attribute is set
3. Inspect element to see applied CSS variables
4. Ensure dark mode class is set on root element

## Next Steps

1. **Validation** - Implement input validation on connections
2. **Execution** - Connect to backend workflow execution
3. **Error Handling** - Display node errors in UI
4. **History** - Add undo/redo functionality
5. **Advanced Nodes** - LLM, API, webhook nodes
6. **Node Groups** - Collapse multiple nodes into groups
7. **Comments** - Add notes to nodes

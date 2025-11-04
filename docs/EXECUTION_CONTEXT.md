# Execution Context API: Simplified Data Flow

## Overview

The execution context provides nodes with access to input data, parameters, and platform capabilities. The system uses a simplified data model where all data flows through the `INodeExecutionData` structure.

## INodeExecutionData Structure

**Core Concept**: All data in the workflow system flows through this standardized structure:

```typescript
interface INodeExecutionData {
  json: IDataObject;        // Main structured data (any JSON-serializable value)
  binary?: IBinaryKeyData;  // Optional binary data (images, files, buffers)
  pairedItem?: number | number[]; // Links output to input items
}
```

### The json Property

The `json` property is the **primary data container** and holds all JSON-serializable data:
- Strings: `{ json: { text: "Hello" } }`
- Numbers: `{ json: { count: 42, price: 99.99 } }`
- Booleans: `{ json: { isActive: true } }`
- Objects: `{ json: { user: { name: "Alice", age: 30 } } }`
- Arrays: `{ json: { items: [1, 2, 3] } }`
- Complex structures: `{ json: { metadata: {...}, results: [...] } }`

**Important**: `$json` in expressions is the **accessor** for this property, NOT a type indicator.

### The binary Property (Optional)

The `binary` property holds non-JSON data:
- Image buffers
- PDF documents
- Audio/video files
- Any binary data

### Return Format

Nodes always return `INodeExecutionData[][]`:
```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  // Process data
  return [
    [
      { json: { result: "processed" } },
      { json: { result: "more data" } }
    ]
  ];
}
```

**Structure Explained**:
- Outer array: Multiple outputs (for branching workflows)
- Inner array: Multiple items per output (batch processing)

## Execution Context Methods

### Accessing Input Data

Nodes receive data from connected upstream nodes:

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  // Get all input items
  const items = context.getInputData();

  // items is INodeExecutionData[]
  for (const item of items) {
    // Access the json property
    const data = item.json;

    // data now contains the actual values
    console.log(data.text, data.count, data.user);

    // Access binary data if present
    if (item.binary) {
      const imageBuffer = item.binary.image;
    }
  }
}

```

### Accessing Node Parameters

Get configuration values from the node's properties:

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  // Get a specific parameter
  const mode = context.getNodeParameter("mode", 0) as string;
  const temperature = context.getNodeParameter("temperature", 0) as number;

  // Use in processing
  if (mode === "strict") {
    // strict processing
  }
}
```

### Returning Data

Always return data in `INodeExecutionData[][]` format:

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (const item of items) {
    const processed = processData(item.json);

    // Build return item
    returnData.push({
      json: processed,                // Required: main data
      binary: item.binary,           // Optional: pass through or modify
      pairedItem: item.pairedItem    // Optional: link to input
    });
  }

  // Return as array of arrays
  return [returnData];
}
```

**Key Points**:
- Always return `INodeExecutionData[][]`
- Put main data in the `json` property
- Binary data goes in the `binary` property
- Outer array is for multiple outputs (usually just one: `[returnData]`)
- Inner array is for multiple items

## Complete Node Example

Here's a full example showing the simplified data flow:

```typescript
import type { INodeType, INodeTypeDescription, ExecutionContext, INodeExecutionData } from "@/types/interfaces";

export class TextTransformer implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Text Transformer",
    name: "textTransformer",
    group: ["transform"],
    version: 1,
    description: "Transform text to uppercase or lowercase",
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        options: [
          { name: "Uppercase", value: "upper" },
          { name: "Lowercase", value: "lower" }
        ],
        default: "upper"
      }
    ]
  };

  async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
    // 1. Get input data from connected nodes
    const items = context.getInputData();

    // 2. Get node configuration
    const operation = context.getNodeParameter("operation", 0) as string;

    // 3. Process each item
    const returnData: INodeExecutionData[] = [];

    for (const item of items) {
      // Access the json property
      const inputText = item.json.text as string;

      // Transform
      const result = operation === "upper"
        ? inputText.toUpperCase()
        : inputText.toLowerCase();

      // Return in INodeExecutionData format
      returnData.push({
        json: {
          text: result,
          originalLength: inputText.length,
          operation: operation
        },
        // Pass through binary data if any
        binary: item.binary
      });
    }

    // 4. Return as array of arrays
    return [returnData];
  }
}
```

**What Happens**:
1. Node receives `INodeExecutionData[]` from `getInputData()`
2. Accesses data via `item.json.text`
3. Processes the data
4. Returns new `INodeExecutionData[][]` with result in `json` property
5. Downstream nodes access this via `{{ TextTransformer.$json.text }}`

## Data Flow in Practice

### Example Workflow: Text Input → Transform → Output

**1. Text Input Node** executes first:
```typescript
return [[{
  json: {
    text: "hello world",
    length: 11,
    wordCount: 2
  }
}]];
```

**2. Transform Node** receives this data:
```typescript
const items = context.getInputData();
// items[0].json = { text: "hello world", length: 11, wordCount: 2 }

const text = items[0].json.text as string;
const result = text.toUpperCase();

return [[{
  json: {
    text: "HELLO WORLD",
    originalLength: 11
  }
}]];
```

**3. Output Node** receives transformed data:
```typescript
const items = context.getInputData();
// items[0].json = { text: "HELLO WORLD", originalLength: 11 }

// Display the result
console.log(items[0].json.text); // "HELLO WORLD"
```

**4. Expressions can reference any upstream node**:
```
{{ TextInput.$json.text }}        // "hello world"
{{ Transform.$json.text }}        // "HELLO WORLD"
{{ Transform.$json.originalLength }}  // 11
```

## Runtime Data Inspection

The **InputExplorer** tool shows the actual `INodeExecutionData` structure:

1. Run a workflow
2. Click on any node
3. View the execution output showing the `json` and `binary` properties
4. Use this to build correct expressions

Example InputExplorer output:
```json
{
  "json": {
    "text": "HELLO WORLD",
    "originalLength": 11,
    "operation": "upper"
  },
  "binary": null
}
```

You can then access: `{{ NodeName.$json.text }}`, `{{ NodeName.$json.originalLength }}`, etc.

## Key Takeaways

1. **Single Data Structure**: All data flows through `INodeExecutionData`
2. **json Property**: Holds all JSON-serializable data (strings, numbers, objects, arrays)
3. **binary Property**: Optional, holds non-JSON data (buffers, images)
4. **No Type Validation**: Connections are generic; validation happens at runtime
5. **$json Accessor**: Used in expressions to access the json property
6. **Graceful Handling**: Missing fields return undefined rather than throwing errors

## See Also

- [Node System](./NODE_SYSTEM.md) - Node architecture overview
- [Expressions](./EXPRESSIONS.md) - Using $json in expressions
- [Data Types](./DATATYPES.md) - Understanding json vs binary properties

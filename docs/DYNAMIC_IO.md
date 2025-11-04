# Data Flow and Expressions

## Overview

The workflow system uses a simplified data flow model where nodes connect generically and data is accessed at runtime through expressions.

**Key Concepts**:
- No pre-defined input/output field arrays
- All data flows through `INodeExecutionData` structure
- Expressions use `{{ NodeName.$json.property }}` syntax
- Runtime inspection reveals actual data structure

## Connection Model

### Old Model (Complex)
```typescript
// Nodes declared specific inputs/outputs
inputs: [
  { name: "text", type: "string", displayName: "Text" },
  { name: "count", type: "number", displayName: "Count" }
]
outputs: [
  { name: "result", type: "string", displayName: "Result" }
]
```

Problems:
- Required pre-declaring all fields
- Type contracts at connection time
- Limited flexibility
- Complex validation

### New Model (Simplified)
```typescript
// No input/output declarations
// Nodes just implement execute()
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();

  // Access whatever properties exist
  const text = items[0].json.text;
  const count = items[0].json.count;

  // Return any structure
  return [[{
    json: { result: processData(text, count) }
  }]];
}
```

Benefits:
- No field declarations needed
- Generic connections
- Flexible data structures
- Runtime validation

## Data Structure

All data flows through `INodeExecutionData`:

```typescript
interface INodeExecutionData {
  json: IDataObject;        // Main data (any JSON-serializable value)
  binary?: IBinaryKeyData;  // Optional binary data
}
```

### Example Data Flow

**Node 1** returns:
```typescript
[[{
  json: {
    text: "Hello World",
    count: 42,
    metadata: { source: "input" }
  }
}]]
```

**Node 2** receives and accesses:
```typescript
const items = context.getInputData();
const text = items[0].json.text;          // "Hello World"
const count = items[0].json.count;         // 42
const source = items[0].json.metadata.source; // "input"
```

**Node 3** can reference via expressions:
```
{{ Node1.$json.text }}                    // "Hello World"
{{ Node1.$json.count }}                   // 42
{{ Node1.$json.metadata.source }}         // "input"
```

## Expression Syntax

### Basic Pattern

```
{{ NodeName.$json.propertyPath }}
```

**Components**:
- `NodeName`: Name or ID of an upstream node
- `$json`: Accessor for the json property
- `propertyPath`: Dot notation path to the desired value

### Examples

```
// Simple property access
{{ TextInput.$json.message }}

// Nested property access
{{ APICall.$json.data.user.email }}

// Array access
{{ DataFetcher.$json.items[0].title }}

// Multiple expressions in one string
"User {{ UserNode.$json.name }} has {{ UserNode.$json.itemCount }} items"
```

## Runtime Data Discovery

### Using InputExplorer

The InputExplorer tool shows you the actual data structure after execution:

**1. Run the workflow**
```
TextInput node executes and produces:
{
  "json": {
    "text": "Sample input",
    "length": 12,
    "wordCount": 2
  }
}
```

**2. View in InputExplorer**
Click on the node to see its output structure

**3. Build expressions**
Now you know the exact property paths:
- `{{ TextInput.$json.text }}` → "Sample input"
- `{{ TextInput.$json.length }}` → 12
- `{{ TextInput.$json.wordCount }}` → 2

### No Guessing Required

Unlike the old system where you had to know field names in advance:
- Execute the workflow first
- Inspect actual output
- Use revealed property paths
- No type errors at connection time

## Handling Dynamic Structures

Nodes can return any structure they want:

### Example: Flexible API Response

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const response = await fetch(url);
  const data = await response.json();

  // Return whatever structure the API provides
  return [[{
    json: data  // Could be any shape!
  }]];
}
```

Downstream nodes access with expressions:
```
{{ APINode.$json.users[0].name }}
{{ APINode.$json.pagination.total }}
{{ APINode.$json.status }}
```

### Example: Conditional Structures

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const mode = context.getNodeParameter("mode", 0) as string;

  if (mode === "simple") {
    return [[{ json: { result: "simple data" } }]];
  } else {
    return [[{
      json: {
        result: "complex data",
        metadata: {...},
        details: [...]
      }
    }]];
  }
}
```

Both structures are valid - downstream nodes handle gracefully.

## Benefits of This Approach

### 1. Simplicity
- No input/output field arrays to maintain
- No type declarations needed
- Just return data and access it

### 2. Flexibility
- Nodes can return any structure
- Structure can vary based on parameters or data
- No rigid contracts

### 3. Discoverability
- InputExplorer shows actual data
- Build expressions from real structures
- See exactly what's available

### 4. Graceful Degradation
- Missing fields return undefined
- No connection-time errors
- Runtime validation only

### 5. Simpler Mental Model
- Connect nodes
- Run workflow
- Inspect data
- Use expressions

## Comparison

### Old System (n8n-like with types)
```
1. Declare inputs: [{ name, type }]
2. Declare outputs: [{ name, type }]
3. Validate connections based on types
4. Complex type resolution
5. Rigid structure
```

### New System (n8n simplified)
```
1. Implement execute()
2. Return INodeExecutionData[][]
3. Connect nodes freely
4. Inspect data at runtime
5. Access via expressions
```

## Migrating from Old System

If you have old node definitions:

**Old**:
```typescript
inputs: [
  { name: "data", type: "string" }
]
outputs: [
  { name: "result", type: "string" }
]
```

**New**:
```typescript
// No declarations needed!
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const data = items[0].json.data; // Access directly

  return [[{
    json: { result: processData(data) }
  }]];
}
```

**Expressions**:
- Old: `{{ $input.data }}`
- New: `{{ UpstreamNode.$json.data }}`

## See Also

- [Expressions](./EXPRESSIONS.md) - Full expression syntax guide
- [Node System](./NODE_SYSTEM.md) - Node architecture
- [Execution Context](./EXECUTION_CONTEXT.md) - INodeExecutionData details
- [Data Types](./DATATYPES.md) - Understanding json vs binary properties

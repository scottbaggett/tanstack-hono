# Data Types in the Simplified Node System

## Overview

The system uses a **simplified data model** where all data flows through the `INodeExecutionData` structure. There are no type contracts at connection time - all data is handled gracefully at runtime.

**Key Concept**: Data types are not declared on inputs/outputs. Instead, all data flows through two properties: `json` and `binary`.

## INodeExecutionData Structure

```typescript
interface INodeExecutionData {
  json: IDataObject;        // Main structured data
  binary?: IBinaryKeyData;  // Optional binary data
}
```

## The json Property: All JSON-Serializable Data

The `json` property holds **all JSON-serializable data**. This is where most data flows:

### Supported in json Property

**Primitive Types**:
- Strings: `{ json: { text: "Hello" } }`
- Numbers: `{ json: { count: 42, price: 99.99 } }`
- Booleans: `{ json: { isActive: true, verified: false } }`
- Null: `{ json: { optionalField: null } }`

**Structured Types**:
- Objects: `{ json: { user: { name: "Alice", age: 30 } } }`
- Arrays: `{ json: { items: [1, 2, 3], tags: ["a", "b"] } }`
- Nested structures: `{ json: { data: { users: [{...}], meta: {...} } } }`

**Special Formats (as strings)**:
- CSV text: `{ json: { csvData: "name,age\nAlice,30" } }`
- XML text: `{ json: { xmlData: "<root>...</root>" } }`
- YAML text: `{ json: { yamlData: "key: value" } }`
- JSON strings: `{ json: { jsonString: "{\"key\":\"value\"}" } }`

## The binary Property: Non-JSON Data

The `binary` property holds data that cannot be JSON-serialized:

### Supported in binary Property

**Binary & Media**:
- Images: `{ binary: { image: Buffer } }`
- PDF documents: `{ binary: { document: Buffer } }`
- Audio files: `{ binary: { audio: Buffer } }`
- Video files: `{ binary: { video: Buffer } }`
- Any raw bytes: `{ binary: { data: Buffer } }`

### Binary Data Structure

```typescript
interface IBinaryKeyData {
  [key: string]: IBinaryData;
}

interface IBinaryData {
  data: Buffer;
  mimeType?: string;
  fileName?: string;
  fileExtension?: string;
}
```

## Important: $json is NOT a Type

**Common Misconception**: "`$json` means the data is JSON"

**Reality**: `$json` is an **accessor/selector** for the `json` property, not a type indicator.

### Examples of ALL Data Types Through $json

```typescript
// String data
{ json: { message: "Hello" } }
// Access: {{ Node.$json.message }}

// Number data
{ json: { count: 42, temperature: 98.6 } }
// Access: {{ Node.$json.count }}

// Boolean data
{ json: { isActive: true } }
// Access: {{ Node.$json.isActive }}

// Object data
{ json: { user: { name: "Alice", role: "admin" } } }
// Access: {{ Node.$json.user.name }}

// Array data
{ json: { items: [1, 2, 3, 4, 5] } }
// Access: {{ Node.$json.items[0] }}

// Mixed data
{ json: { title: "Report", score: 95, tags: ["a", "b"], meta: {...} } }
// Access: {{ Node.$json.title }}, {{ Node.$json.score }}, etc.
```

All these different data types flow through the SAME `json` property!

## Working with Data in Nodes

### Reading Input Data

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();

  for (const item of items) {
    // Access json property directly
    const text = item.json.text as string;
    const count = item.json.count as number;
    const user = item.json.user as { name: string; age: number };

    // Access binary data if present
    if (item.binary) {
      const imageBuffer = item.binary.image?.data;
      const fileName = item.binary.image?.fileName;
    }
  }
}
```

### Returning Output Data

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (const item of items) {
    // Process data
    const result = processData(item.json);

    // Return in INodeExecutionData format
    returnData.push({
      json: {
        // Any JSON-serializable data
        result: result,
        processed: true,
        timestamp: new Date().toISOString()
      },
      // Optional: include binary data
      binary: item.binary
    });
  }

  return [returnData];
}
```

### Working with Binary Data

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (const item of items) {
    // Get image buffer
    const imageBuffer = item.binary?.image?.data;

    if (imageBuffer) {
      // Process image
      const processed = await processImage(imageBuffer);

      returnData.push({
        json: {
          status: "processed",
          originalSize: imageBuffer.length,
          newSize: processed.length
        },
        binary: {
          image: {
            data: processed,
            mimeType: "image/png",
            fileName: "processed.png"
          }
        }
      });
    }
  }

  return [returnData];
}
```

## Runtime Type Handling

### No Type Validation at Connection Time

Unlike the old model, there is **no type checking** when connecting nodes:
- Any node can connect to any other node
- Type compatibility is validated at runtime
- Missing fields are handled gracefully (return undefined)

### Graceful Error Handling

```typescript
async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (const item of items) {
    // Handle missing fields gracefully
    const text = item.json.text as string | undefined;

    if (!text) {
      // Provide default or skip
      returnData.push({
        json: { error: "No text provided", status: "skipped" }
      });
      continue;
    }

    // Process normally
    const result = text.toUpperCase();
    returnData.push({
      json: { result, status: "success" }
    });
  }

  return [returnData];
}
```

## Practical Examples

### Example 1: String Processing

```typescript
// Input: { json: { text: "hello" } }
// Output: { json: { result: "HELLO", length: 5 } }

async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (const item of items) {
    const text = item.json.text as string;
    returnData.push({
      json: {
        result: text.toUpperCase(),
        length: text.length
      }
    });
  }

  return [returnData];
}
```

### Example 2: Number Calculations

```typescript
// Input: { json: { numbers: [1, 2, 3, 4, 5] } }
// Output: { json: { sum: 15, average: 3, count: 5 } }

async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (const item of items) {
    const numbers = item.json.numbers as number[];
    const sum = numbers.reduce((a, b) => a + b, 0);

    returnData.push({
      json: {
        sum,
        average: sum / numbers.length,
        count: numbers.length
      }
    });
  }

  return [returnData];
}
```

### Example 3: Mixed Data Types

```typescript
// Input: { json: { title: "Report", score: 95, tags: ["a", "b"] } }
// Output: { json: { summary: "...", passed: true } }

async execute(context: ExecutionContext): Promise<INodeExecutionData[][]> {
  const items = context.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (const item of items) {
    const title = item.json.title as string;
    const score = item.json.score as number;
    const tags = item.json.tags as string[];

    returnData.push({
      json: {
        summary: `${title}: ${score}% with ${tags.length} tags`,
        passed: score >= 70,
        tagList: tags.join(", ")
      }
    });
  }

  return [returnData];
}
```

## Key Takeaways

1. **Unified Structure**: All data flows through `INodeExecutionData`
2. **json Property**: Holds ALL JSON-serializable types (strings, numbers, objects, arrays, etc.)
3. **binary Property**: Optional, for non-JSON data (Buffers, images, files)
4. **No Type Contracts**: No input/output type declarations needed
5. **Runtime Handling**: Missing fields handled gracefully at execution time
6. **$json Accessor**: Used in expressions to access the json property (NOT a type indicator)

## See Also

- [Node System](./NODE_SYSTEM.md) - Node architecture
- [Expressions](./EXPRESSIONS.md) - Using $json in expressions
- [Execution Context](./EXECUTION_CONTEXT.md) - Working with INodeExecutionData

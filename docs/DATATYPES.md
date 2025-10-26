# Data Types

## Overview

The system supports **rich data types** flowing between nodes, not just strings and JSON.

**Key Pattern**: Each type has metadata describing serialization, deserialization, MIME type, and size limits.

## Supported Types

### Primitives
- `string` - Text
- `number` - Integer or float
- `float` - Floating point
- `integer` - Whole number
- `boolean` - True/false

### Structured
- `json` - JSON objects/arrays
- `csv` - CSV text
- `pdb` - Protein Data Bank
- `xml` - XML
- `yaml` - YAML

### Binary & Media
- `buffer` - Raw bytes
- `image:png` - PNG (max 50MB)
- `image:jpg` - JPEG (max 50MB)
- `image:webp` - WebP (max 50MB)
- `image:gif` - GIF (max 50MB)
- `image:svg` - SVG vector

### Collections
- `array` - Arrays
- `object` - Objects

## TypedValue

Data flows as `TypedValue` objects:

```typescript
interface TypedValue {
  dataType: DataTypeId;        // Type identifier
  value: unknown;              // The actual value
  metadata?: {                 // Optional metadata
    filename?: string;
    size?: number;
  };
}
```

## Serialization

Each type serializes differently for storage:

| Type | Format | Storage |
|------|--------|---------|
| string, number, json | JSON | As-is in JSONB |
| csv, pdb, xml, yaml | Text | String in JSONB |
| image:*, buffer | Base64 | Encoded string |

### Example

```typescript
// In-memory (TypedValue)
{
  dataType: "image:png",
  value: Buffer.from([...]),
  metadata: { filename: "photo.png" }
}

// Stored in DB (SerializedValue)
{
  dataType: "image:png",
  data: "iVBORw0KGgoAAAA...",  // Base64
  metadata: { filename: "photo.png" }
}
```

## API Reference

### DataTypeHandler Module

```typescript
import {
  toTypedValue,                // Convert to TypedValue
  extractValue,                // Get raw value
  extractType,                 // Get data type
  serializeOutputData,         // To storage format
  deserializeOutputData,       // From storage format
  validateDataType,            // Type checking
  checkSizeLimit,              // Validate size
  summarizeData                // For logging
} from '../server/execution/DataTypeHandler';
```

### In Node Configuration

```typescript
inputs: [
  { name: "image", type: "image:png" },
  { name: "data", type: "csv" }
]

outputs: [
  { name: "processed", type: "image:png" },
  { name: "result", type: "json" }
]
```

## Node Integration

### Reading Typed Input

```typescript
async execute(context: IExecuteFunctions) {
  const inputs = context.getInputData();

  // Extract value (handles both TypedValue and raw)
  const buffer = extractValue(inputs.image?.[0]);
  const type = extractType(inputs.image?.[0]);  // "image:png"
}
```

### Setting Typed Output

```typescript
context.setOutputData({
  processed: [{
    dataType: "image:png",
    value: processedBuffer,
    metadata: { filename: "output.png" }
  }]
});
```

### Validation

```typescript
const validation = validateDataType(data, "csv");
if (!validation.valid) {
  throw new Error(validation.error);
}

const sizeCheck = checkSizeLimit(data);
if (!sizeCheck.valid) {
  throw new Error(sizeCheck.error);
}
```

## Size Limits

- `image:png` - 50MB
- `image:jpg` - 50MB
- `image:webp` - 50MB
- `image:gif` - 50MB
- Others - Unlimited

## Type Conversion

Compatible types can be converted:

```
string ← number, json, array
number ← string, other numbers
json ← string, array, object
```

## Examples

### CSV Processing

```typescript
async execute(context: IExecuteFunctions) {
  const csvInput = context.getInputValue("csvInput");
  const csvText = extractValue(csvInput);  // Get raw CSV string

  // Parse with library like papaparse
  const rows = Papa.parse(csvText);

  // Output as JSON
  context.setOutputData({
    parsed: [{
      dataType: "json",
      value: rows.data
    }]
  });
}
```

### Image Processing

```typescript
async execute(context: IExecuteFunctions) {
  const imageInput = context.getInputValue("image");
  const buffer = extractValue(imageInput);

  // Process
  const processed = await sharp(buffer)
    .resize(200, 200)
    .png()
    .toBuffer();

  // Output as typed image
  context.setOutputData({
    processedImage: [{
      dataType: "image:png",
      value: processed,
      metadata: {
        filename: "resized.png",
        size: processed.length
      }
    }]
  });
}
```

### Multi-Type Workflow

```typescript
// Inputs: CSV file + image
// Outputs: JSON analysis + processed image

async execute(context: IExecuteFunctions) {
  // Validate types
  const csvValidation = validateDataType(inputs.csv, "csv");
  const imgValidation = validateDataType(inputs.image, "image:png");

  if (!csvValidation.valid || !imgValidation.valid) {
    throw new Error("Invalid input types");
  }

  // Process both
  const csvData = extractValue(inputs.csv);
  const imageData = extractValue(inputs.image);

  // ... processing ...

  context.setOutputData({
    analysis: [{ dataType: "json", value: {...} }],
    processed: [{ dataType: "image:png", value: processedImg }]
  });
}
```

## See Also

- [Architecture](./ARCHITECTURE.md) - Overall system design
- [Dynamic IO](./DYNAMIC_IO.md) - Variable template system
- `src/types/datatypes.ts` - Type definitions and metadata
- `src/server/execution/DataTypeHandler.ts` - Utility functions
- `src/server/nodes/examples/ImageProcessingNode.ts` - Image example

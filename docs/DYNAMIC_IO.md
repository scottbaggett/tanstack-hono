# Dynamic Inputs and Outputs

## Overview

Nodes automatically expose connectible inputs/outputs based on configuration templates and output structure.

**Key Pattern**: Use `{{variable}}` in node config → automatic input discovery and resolution.

## {{variable}} Syntax

### Basic Usage

```typescript
// Node configuration
{
  prompt: "User: {{userName}}, Age: {{userAge}}"
}

// Automatically exposes inputs: ["userName", "userAge"]
```

### Execution

1. **Extract**: Find all `{{variable}}` in config → `["userName", "userAge"]`
2. **Connect**: Upstream nodes connect outputs to these dynamic inputs
3. **Resolve**: At execution time, replace `{{variable}}` with actual values
4. **Execute**: Node receives resolved prompt

### Example

```
TextInput ("Alice") → DynamicAgent (prompt: "Hello {{name}}")
                      Output: "Hello Alice"
```

## Implementation

### In Node Configuration

```typescript
properties: [
  {
    displayName: "Prompt",
    name: "prompt",
    type: "string",
    default: "User: {{name}}, Email: {{email}}"
  }
]
```

No need to define inputs separately. They're auto-discovered.

### In Node Execution

```typescript
async execute(context: IExecuteFunctions) {
  const promptTemplate = context.getNodeParameter("prompt");
  const inputs = context.getInputData();

  // inputs.name and inputs.email are automatically available
  // from connected upstream nodes

  const resolvedPrompt = promptTemplate
    .replace("{{name}}", inputs.name?.[0])
    .replace("{{email}}", inputs.email?.[0]);
}
```

### Dynamic Input Discovery

```typescript
const dynamicInputs = context.getDynamicInputHandles();
// Returns: ["name", "email"]
// These become connectible in the UI
```

## Dynamic Outputs

### JSON Properties as Outputs

When a node outputs structured JSON, each property becomes a connectible output:

```typescript
// Node outputs
{
  name: "Alice",
  age: 30,
  email: "alice@example.com"
}

// Automatically exposes outputs: ["name", "age", "email"]
```

### Usage

```
LLMNode (outputs structured JSON)
  ├→ output.name
  ├→ output.age
  └→ output.email
       ↓
  Downstream nodes connect to individual properties
```

## API Reference

### InputResolver Module

```typescript
import {
  extractVariables,              // ["var1", "var2"]
  resolveVariablesInString,      // "{{var1}}" → "value1"
  extractDynamicInputHandles,    // ["var1", "var2"]
  extractDynamicOutputHandles,   // ["key1", "key2"]
  validateInputs                 // Check all required inputs satisfied
} from '../server/execution/InputResolver';
```

### IExecuteFunctions

```typescript
// Get dynamic inputs inferred from node config
const inputs = context.getDynamicInputHandles();
```

## Validation

### Check Required Inputs

```typescript
const validation = validateInputs(
  nodeInputs,
  nodeId,
  edges,
  state,
  ["userName", "userAge"]  // Required
);

if (!validation.valid) {
  throw new Error(validation.errors.join("\n"));
}
```

## Best Practices

1. **Naming**: Use descriptive variable names: `{{userName}}` not `{{u}}`
2. **Documentation**: Document expected variables in node description
3. **Validation**: Validate required variables are connected
4. **Error Handling**: Handle unresolved variables gracefully

## Examples

### Template Processing

```
"Generate blog post about {{topic}} for {{audience}}"
```

### Parameterized LLM

```
{
  prompt: "Analyze: {{data}}",
  model: "{{selectedModel}}",
  temperature: {{userTemperature}}
}
```

### Multi-field JSON

```
LLM outputs: { name, role, department }
Each becomes connectible output handle
```

## See Also

- [Architecture](./ARCHITECTURE.md) - Overall system design
- [Data Types](./DATATYPES.md) - Rich data type support
- `src/server/execution/InputResolver.ts` - Implementation
- `src/server/nodes/examples/DynamicAgentNode.ts` - Example node

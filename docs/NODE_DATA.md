# Node Data & Expressions

## Overview

This document explains how data flows through nodes and how to reference it using expressions.

## Node Execution Data Structure

### Internal Format (Node Implementation)

Nodes internally return data in the n8n-compatible format:

```typescript
INodeExecutionData[][] = [
  [
    {
      json: { /* your data */ },
      binary?: { /* binary files */ }
    }
  ]
]
```

### API Response Format (Simplified)

When you execute nodes via the API, the response uses a simplified structure:

```json
{
  "success": true,
  "runData": {
    "nodeId": [
      {
        "data": {
          "json": { /* your data */ },
          "binary": null
        },
        "error": null,
        "startTime": 1762304740814,
        "executionTime": 209,
        "metadata": {}
      }
    ]
  }
}
```

See [DATA_FLOW.md](./DATA_FLOW.md) for complete API structure details.

**Example - TextInput node outputs:**
```javascript
[
  [
    {
      json: {
        text: "Hello World"
      }
    }
  ]
]
```

**Example - ExecuteCommand node outputs:**
```javascript
[
  [
    {
      json: {
        exitCode: 0,
        stdout: "Hello!",
        stderr: "",
        command: "echo 'Hello!'"
      }
    }
  ]
]
```

## Expression Context

When a node executes, it has access to data through an **expression context**. This context contains:

### Available Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `json` | Output data from connected input node | `json.text` |
| `binary` | Binary data from connected input node | `binary.file` |
| `input.params` | Parameters/config from connected input node | `input.params.command` |
| `node` | Current node metadata | `node.id`, `node.type` |

### Single Input (Most Common)

When a node has **one input connection**, use the simple accessors:

```javascript
{{ json.text }}              // Access field from input's output
{{ json.result.message }}    // Nested properties
{{ binary.file }}            // Binary data
{{ input.params.command }}   // Input node's parameters
```

**Example:**
```
TextInput → ExecuteCommand
  text      command: "echo {{ json.text }}"
```

Result: `json.text` resolves to the `text` output from TextInput node.

### Multiple Inputs

When a node has **multiple input connections**, use explicit node references:

```javascript
{{ inputs.nodeId123.json.text }}           // Specific node by ID
{{ inputs.nodeId456.json.result }}         // Different node
{{ inputs.nodeId123.params.command }}      // Node's parameters
{{ inputs.nodeId123.binary.file }}         // Node's binary data
```

**Why node IDs instead of names?**
- Stable across renames
- No issues with spaces in names
- Unambiguous

**UI Helper:**
When dragging properties from the Input Explorer, the UI shows friendly names but generates IDs:
- Display: `TextInput › text`
- Expression: `{{ inputs.node_abc123.json.text }}`

## json vs input.params

Understanding the difference between output data and parameters:

### `json.*` - Node Output

The **result** of a node's execution. This is what the node produced.

**Example - ExecuteCommand:**
- Executes: `echo "Hello"`
- Outputs: `{ exitCode: 0, stdout: "Hello", stderr: "", command: "echo Hello" }`
- Access with: `json.stdout`, `json.exitCode`

### `input.params.*` - Node Parameters

The **configuration** values that were set on the node.

**Example - ExecuteCommand:**
- Parameter `command` was set to: `"echo Hello"`
- Access with: `input.params.command`

### When are they the same?

For simple nodes like **TextInput**:
- Parameter: `text = "Hello"`
- Output: `{ text: "Hello" }`
- Both `json.text` and `input.params.text` return `"Hello"`

### When are they different?

For complex nodes like **HTTPRequest**:
- Parameters: `{ url: "https://api.example.com", method: "GET" }`
- Output: `{ statusCode: 200, body: { data: [...] }, headers: {...} }`
- `json.body` → API response (different!)
- `input.params.url` → "https://api.example.com"

## Expression Syntax

Expressions use `{{ ... }}` syntax:

```javascript
{{ json.field }}                    // Simple field
{{ json.user.name }}                // Nested object
{{ json.items[0] }}                 // Array access (CEL syntax)
{{ json.count + 10 }}               // Math operations
{{ json.status == "success" }}      // Comparisons
```

### Template Strings

Combine expressions with static text:

```javascript
"Hello {{ json.name }}!"                           // Simple substitution
"Exit code: {{ json.exitCode }}"                   // Number to string
"Status: {{ json.status }}, Count: {{ json.count }}" // Multiple expressions
```

### CEL Functions

Our expression engine uses [CEL (Common Expression Language)](https://github.com/google/cel-spec), which supports:

```javascript
{{ json.text.contains("hello") }}          // String functions
{{ json.count > 5 ? "many" : "few" }}      // Ternary
{{ json.items.size() }}                    // Collection size
{{ json.timestamp.toDate() }}              // Type conversions
```

## Node Parameters vs Node Outputs

**Parameters** are the configuration for a node:
- Defined in node's `properties` array in `INodeTypeDescription`
- Set by the user in the UI
- Can contain expressions that reference other nodes

**Outputs** are the result of execution:
- Returned by the node's `execute()` method
- Become available as `json` in downstream nodes
- Determined by what the node actually produces

**Example - ExecuteCommand node:**

```typescript
// PARAMETER DEFINITION
properties: [
  {
    displayName: 'Command',
    name: 'command',
    type: 'string',
    default: 'echo "Hello"',
    description: 'Shell command to execute'
  }
]

// USER SETS (with expression)
command: "echo {{ json.text }}"

// AFTER EVALUATION (expression resolved)
command: "echo Hello World"

// NODE EXECUTES AND OUTPUTS
{
  json: {
    exitCode: 0,
    stdout: "Hello World\n",
    stderr: "",
    command: "echo Hello World"
  }
}
```

## Data Flow Example

```
┌─────────────┐         ┌──────────────────┐        ┌─────────────┐
│ TextInput   │────────▶│ ExecuteCommand   │───────▶│ Output      │
│             │         │                  │        │             │
│ text: "Hi"  │         │ cmd: echo {{...}}│        │ Displays    │
└─────────────┘         └──────────────────┘        └─────────────┘
      │                          │                         │
      │ Output:                  │ Has access to:          │ Has access to:
      │ { text: "Hi" }           │ json.text = "Hi"        │ json.stdout
      │                          │                         │
      │                          │ Output:                 │
      │                          │ { exitCode: 0,          │
      │                          │   stdout: "Hi",         │
      │                          │   command: "echo Hi" }  │
```

## Best Practices

### 1. Use the simplest accessor

✅ Good: `{{ json.text }}`
❌ Avoid: `{{ inputs.node123.json.text }}` (when only one input)

### 2. Be explicit with multiple inputs

✅ Good: `{{ inputs.userNode.json.name }} and {{ inputs.orderNode.json.id }}`
❌ Avoid: `{{ json.name }}` (ambiguous!)

### 3. Use json for output, input.params for config

✅ Good: `{{ json.stdout }}` (the result)
✅ Good: `{{ input.params.url }}` (the config)
❌ Avoid: Confusing which is which

### 4. Drag from Input Explorer

Instead of typing expressions manually, drag properties from the Input Explorer panel to ensure correct syntax.

## Technical Implementation

### Expression Evaluation

The expression system:

1. **Detects expressions**: Looks for `{{ ... }}` patterns
2. **Converts syntax**: Transforms `json.field` to CEL-compatible `json["field"]`
3. **Builds context**: Creates evaluation context with available variables
4. **Evaluates**: Uses CEL engine to compute result
5. **Substitutes**: Replaces `{{ ... }}` with evaluated value

### Context Building

When a node executes, the system builds the expression context:

```typescript
// Single input
{
  json: { text: "Hello" },           // From connected node's output
  binary: {},                         // From connected node
  input: {
    params: { text: "Hello" }         // From connected node's parameters
  },
  node: {
    id: "node_abc123",
    type: "executeCommand",
    version: 1
  }
}

// Multiple inputs
{
  inputs: {
    node_abc123: {
      json: { text: "Hello" },
      params: { text: "Hello" }
    },
    node_def456: {
      json: { count: 42 },
      params: { count: 42 }
    }
  },
  node: { ... }
}
```

## See Also

- [NODE_SYSTEM.md](./NODE_SYSTEM.md) - Node architecture
- [CEL Language Spec](https://github.com/google/cel-spec) - Expression language details

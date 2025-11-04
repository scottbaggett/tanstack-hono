# Expressions in Workflows

This guide explains how to use expressions in your workflow node properties to create dynamic, data-driven workflows.

## Table of Contents

1. [Overview](#overview)
2. [Basic Syntax](#basic-syntax)
3. [The $json Accessor](#the-json-accessor)
4. [Available Variables](#available-variables)
5. [Examples](#examples)
6. [Advanced Usage](#advanced-usage)
7. [Limitations](#limitations)

## Overview

Expressions allow you to write dynamic statements to access and transform your workflow data. Instead of hard-coding values, you can:

- Reference data from connected nodes via `$json`
- Access node configuration via `$parameter`
- Perform calculations and comparisons
- Use built-in functions (string, array, math operations)
- Create conditional logic

### Expression Syntax

Expressions are written inside your node properties using double curly braces:

```
{{ expression }}    // Standard syntax
```

### Simple Examples

```
{{ NodeName.$json.text }}                    // Get text from a node's output
{{ $parameter.temperature * 2 }}             // Math operations
{{ NodeName.$json.count > 10 ? "many" : "few" }}  // Conditional
```

## The $json Accessor

**IMPORTANT**: `$json` is the accessor/selector for accessing the `json` property of `INodeExecutionData`, NOT a data type indicator.

### What is $json?

Every node returns data in this structure:
```typescript
INodeExecutionData {
  json: IDataObject,        // Main structured data
  binary?: IBinaryKeyData   // Optional binary data
}
```

The `$json` accessor allows you to access properties from the `json` object:
```
{{ NodeName.$json.propertyName }}
```

### All Data Types Flow Through $json

The `json` property can hold ANY JSON-serializable data:
- Strings: `{{ NodeName.$json.message }}`
- Numbers: `{{ NodeName.$json.count }}`
- Booleans: `{{ NodeName.$json.isActive }}`
- Objects: `{{ NodeName.$json.user.name }}`
- Arrays: `{{ NodeName.$json.items[0] }}`

**Key Point**: `$json` doesn't mean "this is JSON data" - it means "access the json property". All data types (strings, numbers, etc.) flow through this property.

## Basic Syntax

### Variable Access

Access nested properties with dot notation:

```
NodeName.$json.results[0].score    // Array access from node output
$parameter.settings.debug          // Nested configuration
$node.id                           // Current node ID
```

**Pattern**: `{{ NodeName.$json.propertyPath }}`
- `NodeName`: The name/ID of an upstream node
- `$json`: Accessor for the json property
- `propertyPath`: Dot notation path to the value you need

### Operators

**Arithmetic**
```
{{ 10 + 5 }}                              // 15
{{ $parameter.value * 2 }}
{{ 100 / TextInput.$json.divisor }}
```

**Comparison**
```
{{ Agent.$json.score >= 0.8 }}            // true/false
{{ $parameter.name == "admin" }}
{{ TextInput.$json.count != null }}
```

**Logical**
```
{{ Agent.$json.score > 0.8 && Agent.$json.verified == true }}
{{ $parameter.debug || $parameter.verbose }}
{{ !TextInput.$json.isDeleted }}
```

**String Concatenation**
```
{{ "Hello " + $parameter.name }}
{{ TextInput.$json.firstName + " " + TextInput.$json.lastName }}
```

### Conditionals (Ternary)

```
{{ Agent.$json.score > 0.8 ? "Pass" : "Fail" }}
{{ $parameter.mode == "strict" ? 10 : 100 }}
```

## Available Variables

### `NodeName.$json` - Data from Connected Nodes

Access data from any upstream node by referencing its name followed by `.$json`:

```
TextInput.$json.text              // Access text property
Agent.$json.results[0]           // First result from array
APICall.$json.data.metadata.key  // Nested access
```

**Pattern Explained**:
- `TextInput`: Name of the upstream node
- `$json`: Accessor for the json property of that node's output
- `.text`: Property within the json object

### `$binary` - Binary Data Access

Access binary data from connected nodes:

```
ImageNode.$binary.image          // Access binary image data
FileNode.$binary.document        // Access binary document
```

### `$parameter` - Node Properties

Values from this node's configuration properties.

```
$parameter.systemPrompt       // Property value
$parameter.temperature        // Config value
$parameter.settings.timeout   // Nested property
```

**Note**: These are configuration values set in the node's property panel, NOT data from upstream nodes.

### `$node` - Current Node Metadata

Information about the current node.

```
$node.id                      // Node instance ID (e.g., "agent-1")
$node.type                    // Node type (e.g., "agent")
$node.version                 // Node version (e.g., 1)
```

## Real-World Expression Examples

### Example 1: Accessing Text from Input Node

**Scenario**: Get user input text for processing

```
{{ TextInput.$json.text }}
```

**Explanation**:
- `TextInput` is the node name
- `$json` accesses the json property
- `.text` gets the text field

### Example 2: Using Agent Output in Prompt

**Scenario**: Pass agent response to another node

```
"Summarize this response: {{ Agent.$json.response }}"
```

Result: `"Summarize this response: The weather is sunny today"`

### Example 3: Conditional Based on Node Output

**Scenario**: Choose processing mode based on data size

```
{{ DataFetcher.$json.itemCount > 100 ? "batch" : "realtime" }}
```

**Explanation**:
- Access `itemCount` from DataFetcher node's output
- If > 100, use "batch", otherwise "realtime"

### Example 4: Combining Multiple Node Outputs

**Scenario**: Create message from multiple sources

```
"User {{ UserInput.$json.name }} requested {{ APICall.$json.items.length }} items"
```

**Explanation**:
- Get `name` from UserInput node
- Get array length from APICall node
- Combine into single string

### Example 5: Accessing Nested Data

**Scenario**: Get deeply nested property

```
{{ APIResponse.$json.data.user.profile.email }}
```

**Explanation**: Chain dot notation to access nested properties

### Example 6: Working with Arrays

**Scenario**: Get first item from array

```
{{ DataProcessor.$json.results[0].score }}
```

**Explanation**:
- Access `results` array
- Get first element `[0]`
- Access its `score` property

## Advanced Usage

### Template Strings with Multiple Expressions

A single property can contain multiple expressions:

```
"Processing {{ DataFetcher.$json.count }} items in {{ $parameter.mode }} mode for {{ UserInput.$json.userId }}"
```

Result: `"Processing 5 items in batch mode for user123"`

**Key**: Mix static text with multiple `{{ }}` expressions

### Accessing Complex Structures

Access complex nested data:

```
{{ APIResponse.$json.data.users[0].profile.settings.notifications.email }}
```

**Explanation**: Chain as many property accesses as needed

### Runtime Data Inspection

Use the **InputExplorer** tool to see the actual structure of node outputs:

1. Execute a workflow
2. Click on a node
3. View the `$json` structure in the inspector
4. Use the revealed property paths in your expressions

Example: If InputExplorer shows:
```json
{
  "json": {
    "user": {
      "name": "Alice",
      "email": "alice@example.com"
    }
  }
}
```

You can access with:
```
{{ NodeName.$json.user.name }}      // "Alice"
{{ NodeName.$json.user.email }}     // "alice@example.com"
```

## Expression Validation

The system validates expressions when nodes are executed. Invalid expressions will show error messages at runtime.

**Common issues:**
```
{{ NonExistentNode.$json.value }}     // Error: Node not found
{{ TextInput.$json.missing }}         // Returns undefined (no error)
{{ TextInput.$json.items[999] }}      // Returns undefined (no error)
```

**Best Practices**:
- Use InputExplorer to verify property names
- Test expressions by running the workflow
- Handle missing data gracefully with conditionals:
  ```
  {{ TextInput.$json.value || "default" }}
  ```

## Limitations

### Expression Capabilities

Expressions are designed for data access and simple transformations:

**You CAN**:
- Access node outputs via `NodeName.$json.property`
- Use arithmetic, comparison, and logical operators
- Use string concatenation
- Use ternary conditionals
- Access nested properties and arrays

**You CANNOT**:
- Execute arbitrary code or functions
- Modify data (expressions are read-only)
- Make network calls or file operations
- Define custom functions
- Use complex loops (use transform nodes instead)

### Data Types in Expressions

All data accessed via `$json` is JSON-serializable:
- **Strings**: `{{ Node.$json.message }}`
- **Numbers**: `{{ Node.$json.count }}`, `{{ Node.$json.price }}`
- **Booleans**: `{{ Node.$json.isActive }}`
- **Arrays**: `{{ Node.$json.items[0] }}`
- **Objects**: `{{ Node.$json.user.name }}`
- **Null/undefined**: Handled gracefully

Remember: The `$json` accessor doesn't indicate type - it accesses the json property which can hold any of these types.

## Common Patterns

### Conditional Prompts

```
{{
  $parameter.style == "formal" ?
    "Please provide a professional response." :
    "Keep it casual and friendly."
}}
```

### Combining Multiple Inputs

```
"Analyze {{ DataSource.$json.topic }} with context: {{ ContextNode.$json.background }}"
```

### Formatting Output

```
"Processed {{ DataNode.$json.items.length }} items in {{ $parameter.mode }} mode"
```

### Checking for Data

```
{{ UserInput.$json.email ? UserInput.$json.email : "no-email@example.com" }}
```

### Accessing Array Data

```
"First result: {{ Results.$json.items[0].title }}"
"Last score: {{ Scores.$json.values[Scores.$json.values.length - 1] }}"
```

## Troubleshooting

### Expression returns undefined

**Cause**: Property doesn't exist in node output

**Solution**:
1. Use InputExplorer to verify the actual data structure
2. Provide a default value: `{{ Node.$json.field || "default" }}`

### Node name not found

**Cause**: Node doesn't exist or isn't connected

**Solution**:
1. Verify node name matches exactly (case-sensitive)
2. Ensure node is upstream (connected before current node)
3. Check workflow execution order

### Getting entire object instead of value

**Cause**: Missing property access

**Solution**: Add property path after `$json`:
- Wrong: `{{ TextInput.$json }}`
- Right: `{{ TextInput.$json.text }}`

## Key Takeaways

1. **$json is an accessor, not a type**: It accesses the `json` property of `INodeExecutionData`
2. **All data types flow through $json**: Strings, numbers, objects, arrays - everything goes in the json property
3. **Pattern**: `{{ NodeName.$json.propertyPath }}`
4. **Use InputExplorer**: See actual execution data to build correct expressions
5. **Graceful handling**: Missing fields return undefined rather than errors

## See Also

- [Node System Guide](./NODE_SYSTEM.md) - Understanding node architecture
- [Execution Context](./EXECUTION_CONTEXT.md) - INodeExecutionData structure
- [Data Types](./DATATYPES.md) - How data flows through the system

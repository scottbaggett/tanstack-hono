# Expressions in Workflows

This guide explains how to use expressions in your workflow node properties to create dynamic, data-driven workflows.

## Table of Contents

1. [Overview](#overview)
2. [Basic Syntax](#basic-syntax)
3. [Available Variables](#available-variables)
4. [The $json Accessor](#the-json-accessor)
5. [Examples](#examples)
6. [Advanced Usage](#advanced-usage)
7. [Limitations](#limitations)

## Overview

Expressions allow you to write dynamic statements to access and transform your workflow data. Instead of hard-coding values, you can:

- Reference data from connected nodes via `$json`, `$item`, and `$items`
- Access node configuration via `$parameters`
- Perform calculations and comparisons
- Use built-in functions (string, array, math operations)
- Create conditional logic

**Expression Engine**: We use [JSONata](https://jsonata.org/) for expression evaluation. JSONata is a lightweight query and transformation language designed for JSON data, making it perfect for workflows.

### Expression Syntax

Expressions are written inside your node properties using double curly braces:

```
{{ expression }}    // Standard syntax
```

### Simple Examples

```
{{ $json.text }}                              // Get text from current input
{{ $item[0].json.count }}                     // Get count from first input
{{ $items["Structured Output"][0].json.model }} // Get model from specific node
{{ $parameters.temperature * 2 }}             // Math operations with node parameters
{{ $json.count > 10 ? "many" : "few" }}       // Conditional
```

## Available Variables

### `$json` - Current Item Data

Access data from the **first connected input** with execution data:

```
{{ $json.text }}              // Access text property
{{ $json.results[0] }}        // First result from array
{{ $json.user.name }}         // Nested access
```

**What is $json?**
- Accesses the `json` property of `INodeExecutionData` from the first available input
- Automatically selects the first connected node that has execution data
- All data types (strings, numbers, objects, arrays) flow through this property

### `$item[index]` - Access Specific Input by Index

Access data from a **specific connected input** by its index:

```
{{ $item[0].json.text }}       // First input's data
{{ $item[1].json.model }}      // Second input's data
{{ $item[0].binary.file }}     // Binary data from first input
```

**When to use:**
- When you have multiple inputs connected to a node
- When you need to access data from a specific input, not just the first

**Index order:**
- `0` = first connected input
- `1` = second connected input
- etc.

### `$items["NodeName"]` - Access Specific Node by Name

Access data from a **specific node by its name**:

```
{{ $items["Structured Output"][0].json.model }}    // Access Structured Output node
{{ $items["HTTP Request"][0].json.statusText }}    // Access HTTP Request node
{{ $items["Text Input"][0].json.text }}            // Access Text Input node
```

**Pattern:**
- `$items["NodeName"]` returns an array of execution items from that node
- `[0]` gets the first item (most common)
- `.json` accesses the json property
- `.field` accesses the specific field

**When to use:**
- When you want to reference a specific upstream node by name
- When you need clarity about where data comes from
- When you have multiple paths and want to be explicit

### `$parameters` - Current Node's Parameters

Access the **current node's configuration values**:

```
{{ $parameters.systemPrompt }}       // Property value
{{ $parameters.temperature }}        // Config value
{{ $parameters.settings.timeout }}   // Nested property
```

**Note**: These are configuration values set in the node's property panel, NOT data from upstream nodes.

### `$binary` - Binary Data (Legacy)

Access binary data from connected nodes:

```
{{ $item[0].binary.image }}          // Binary data from first input
{{ $items["File Node"][0].binary.document }}  // Binary from specific node
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

The `$json` accessor allows you to access properties from the `json` object.

### All Data Types Flow Through $json

The `json` property can hold ANY JSON-serializable data:
- Strings: `{{ $json.message }}`
- Numbers: `{{ $json.count }}`
- Booleans: `{{ $json.isActive }}`
- Objects: `{{ $json.user.name }}`
- Arrays: `{{ $json.items[0] }}`

**Key Point**: `$json` doesn't mean "this is JSON data" - it means "access the json property". All data types (strings, numbers, etc.) flow through this property.

## Basic Syntax

### Variable Access

Access nested properties with dot notation:

```
{{ $json.results[0].score }}           // Array access from current input
{{ $parameters.settings.debug }}       // Nested configuration
{{ $item[1].json.user.email }}         // Nested from specific input
{{ $items["API Call"][0].json.data }}  // From specific node
```

### Operators

**Arithmetic**
```
{{ 10 + 5 }}                              // 15
{{ $parameters.value * 2 }}
{{ 100 / $json.divisor }}
```

**Comparison**
```
{{ $json.score >= 0.8 }}                  // true/false
{{ $parameters.name == "admin" }}
{{ $json.count != null }}
```

**Logical**
```
{{ $json.score > 0.8 && $json.verified == true }}
{{ $parameters.debug || $parameters.verbose }}
{{ !$json.isDeleted }}
```

**String Concatenation**
```
{{ "Hello " + $parameters.name }}
{{ $json.firstName + " " + $json.lastName }}
```

### Conditionals (Ternary)

```
{{ $json.score > 0.8 ? "Pass" : "Fail" }}
{{ $parameters.mode == "strict" ? 10 : 100 }}
{{ $items["Validator"][0].json.isValid ? "Proceed" : "Reject" }}
```

## Real-World Expression Examples

### Example 1: Accessing Data from Current Input

**Scenario**: Get text from the first connected input

```
{{ $json.text }}
```

**Explanation**:
- `$json` accesses the json property from the first available input
- `.text` gets the text field

### Example 2: Accessing Data from Specific Node

**Scenario**: Get model name from "Structured Output" node

```
{{ $items["Structured Output"][0].json.model }}
```

**Explanation**:
- `$items["Structured Output"]` gets items from that specific node
- `[0]` gets the first execution item
- `.json.model` accesses the model field

### Example 3: Using Multiple Inputs

**Scenario**: Combine data from two different inputs

```
"User {{ $item[0].json.name }} requested {{ $item[1].json.itemCount }} items"
```

**Explanation**:
- `$item[0].json.name` gets name from first input
- `$item[1].json.itemCount` gets item count from second input
- Combines into single string

### Example 4: Conditional Based on Node Output

**Scenario**: Choose processing mode based on data size

```
{{ $json.itemCount > 100 ? "batch" : "realtime" }}
```

**Explanation**:
- Access `itemCount` from current input
- If > 100, use "batch", otherwise "realtime"

### Example 5: Combining Node Data with Parameters

**Scenario**: Create a prompt using both input data and node config

```
"Analyze this text about {{ $json.topic }} using {{ $parameters.mode }} mode"
```

**Explanation**:
- `$json.topic` from input data
- `$parameters.mode` from node configuration
- Combined into dynamic prompt

### Example 6: Accessing Deeply Nested Data

**Scenario**: Get email from nested user object

```
{{ $items["API Response"][0].json.data.user.profile.email }}
```

**Explanation**: Chain dot notation to access nested properties from a specific node

### Example 7: Working with Arrays

**Scenario**: Get first item's score from results array

```
{{ $json.results[0].score }}
```

**Explanation**:
- Access `results` array from current input
- Get first element `[0]`
- Access its `score` property

## Advanced Usage

### Template Strings with Multiple Expressions

A single property can contain multiple expressions:

```
"Processing {{ $json.count }} items in {{ $parameters.mode }} mode for {{ $items["User Input"][0].json.userId }}"
```

Result: `"Processing 5 items in batch mode for user123"`

**Key**: Mix static text with multiple `{{ }}` expressions

### Accessing Complex Structures

Access complex nested data:

```
{{ $json.data.users[0].profile.settings.notifications.email }}
```

**Explanation**: Chain as many property accesses as needed

### Comparing Data from Different Nodes

```
{{ $items["Node A"][0].json.value > $items["Node B"][0].json.threshold ? "high" : "low" }}
```

**Explanation**: Compare values from two different nodes

### Runtime Data Inspection & Drag-and-Drop

Use the **Input Explorer** panel to see the actual structure of node outputs:

1. Execute a workflow
2. Click on a node to open the editor
3. View the **Input** panel on the left showing connected nodes' data
4. Expand the JSON structure to see available fields
5. **Drag properties directly into parameter fields** to generate expressions automatically

**Drag-and-Drop Behavior**:
When you drag a property from the Input Explorer, it generates the full n8n-style path:

- From "Structured Output" node's `model` field → `{{ $items["Structured Output"][0].json.model }}`
- From "HTTP Request" node's `statusCode` field → `{{ $items["HTTP Request"][0].json.statusCode }}`
- Binary data → `{{ $items["File Reader"][0].binary.file }}`

**Manual typing**: If Input Explorer shows:
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
{{ $items["Node Name"][0].json.user.name }}   // Full path (recommended)
{{ $json.user.name }}                          // Shorthand (first input only)
```

## Expression Validation

The system validates expressions when you type them. The **Result** preview shows:
- Evaluated value if successful
- Error message if invalid
- "No execution data available" if you need to run the workflow first

**Common issues:**
```
{{ $items["NonExistent"][0].json.value }}  // Error: Node not found
{{ $json.missing }}                        // Returns undefined (no error)
{{ $json.items[999] }}                     // Returns undefined (no error)
```

**Best Practices**:
- Use Input Explorer to verify property names
- Test expressions by running the workflow
- Watch the Result preview to see evaluated values
- Handle missing data gracefully with conditionals:
  ```
  {{ $json.value || "default" }}
  ```

## Choosing Between $json, $item, and $items

### Use `$json` when:
- ✅ You have one input and want the simplest syntax
- ✅ You don't care which specific node provides the data
- ✅ You want the first available data

```
{{ $json.text }}
```

### Use `$item[index]` when:
- ✅ You have multiple inputs and need a specific one by position
- ✅ You want to reference "first input", "second input", etc.
- ✅ Order matters more than node name

```
{{ $item[0].json.text }}     // First input
{{ $item[1].json.model }}    // Second input
```

### Use `$items["NodeName"]` when:
- ✅ You want to be explicit about where data comes from
- ✅ You have complex workflows with multiple paths
- ✅ Readability and maintainability matter
- ✅ You might rearrange nodes later

```
{{ $items["Structured Output"][0].json.model }}
{{ $items["HTTP Request"][0].json.statusCode }}
```

**Recommendation**: Prefer `$items["NodeName"]` for clarity in complex workflows, use `$json` for simplicity in straightforward cases.

## Limitations

### Expression Capabilities

Expressions are designed for data access and simple transformations:

**You CAN**:
- Access node outputs via `$json`, `$item`, `$items`
- Access node parameters via `$parameters`
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
- **Strings**: `{{ $json.message }}`
- **Numbers**: `{{ $json.count }}`, `{{ $json.price }}`
- **Booleans**: `{{ $json.isActive }}`
- **Arrays**: `{{ $json.items[0] }}`
- **Objects**: `{{ $json.user.name }}`
- **Null/undefined**: Handled gracefully

Remember: The `$json` accessor doesn't indicate type - it accesses the json property which can hold any of these types.

## Common Patterns

### Conditional Prompts

```
{{
  $parameters.style == "formal" ?
    "Please provide a professional response." :
    "Keep it casual and friendly."
}}
```

### Combining Multiple Inputs

```
"Analyze {{ $item[0].json.topic }} with context: {{ $item[1].json.background }}"
```

### Accessing Specific Nodes

```
"Model: {{ $items["Structured Output"][0].json.model }}, Status: {{ $items["HTTP Request"][0].json.statusText }}"
```

### Formatting Output

```
"Processed {{ $json.items.length }} items in {{ $parameters.mode }} mode"
```

### Checking for Data

```
{{ $json.email ? $json.email : "no-email@example.com" }}
```

### Accessing Array Data

```
"First result: {{ $json.items[0].title }}"
"Last score: {{ $json.values[$json.values.length - 1] }}"
```

## Troubleshooting

### Expression returns undefined

**Cause**: Property doesn't exist in node output

**Solution**:
1. Use Input Explorer to verify the actual data structure
2. Provide a default value: `{{ $json.field || "default" }}`

### Node name not found

**Cause**: Node doesn't exist or hasn't been executed

**Solution**:
1. Verify node name matches exactly (case-sensitive)
2. Ensure node is upstream (connected before current node)
3. Execute the workflow to populate execution data

### Getting entire object instead of value

**Cause**: Missing property access

**Solution**: Add property path after `$json`:
- Wrong: `{{ $json }}`
- Right: `{{ $json.text }}`

### "No execution data available"

**Cause**: Workflow hasn't been executed yet

**Solution**:
1. Click "Execute Node" button to run the workflow
2. Execution data will populate and expressions will evaluate

## Quick Reference

| Syntax | What it does | Example |
|--------|-------------|---------|
| `{{ $json.field }}` | Current input's field | `{{ $json.text }}` |
| `{{ $item[0].json.field }}` | First input's field | `{{ $item[0].json.name }}` |
| `{{ $items["Name"][0].json.field }}` | Specific node's field | `{{ $items["API"][0].json.data }}` |
| `{{ $parameters.field }}` | Node parameter | `{{ $parameters.temperature }}` |
| `{{ expr1 + expr2 }}` | Arithmetic | `{{ $json.a + $json.b }}` |
| `{{ expr ? "yes" : "no" }}` | Conditional | `{{ $json.valid ? "OK" : "Error" }}` |
| `{{ $json.arr[0] }}` | Array access | `{{ $json.items[0] }}` |
| `{{ $json.obj.nested }}` | Object access | `{{ $json.user.name }}` |

## Key Takeaways

1. **Three ways to access data**:
   - `$json` - Current input (simplest)
   - `$item[index]` - Specific input by position
   - `$items["NodeName"]` - Specific node by name (most explicit)

2. **$json is an accessor, not a type**: It accesses the `json` property of `INodeExecutionData`

3. **All data types flow through $json**: Strings, numbers, objects, arrays - everything goes in the json property

4. **Use Input Explorer**: See actual execution data to build correct expressions

5. **Graceful handling**: Missing fields return undefined rather than errors

6. **Real-time preview**: The Result section shows evaluated values as you type

## See Also

- [Node System Guide](./NODE_SYSTEM.md) - Understanding node architecture
- [Execution Context](./EXECUTION_CONTEXT.md) - INodeExecutionData structure
- [Data Types](./DATATYPES.md) - How data flows through the system

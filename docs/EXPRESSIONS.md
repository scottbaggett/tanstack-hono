# Expressions in Workflows

This guide explains how to use JavaScript expressions in your workflow node properties to create dynamic, data-driven workflows.

## Table of Contents

1. [Overview](#overview)
2. [Basic Syntax](#basic-syntax)
3. [Available Variables](#available-variables)
4. [Expression Context](#expression-context)
5. [Examples](#examples)
6. [Autocomplete & Drag-and-Drop](#autocomplete--drag-and-drop)
7. [Advanced Usage](#advanced-usage)
8. [Security](#security)
9. [Limitations](#limitations)
10. [Troubleshooting](#troubleshooting)

## Overview

Expressions allow you to write dynamic JavaScript statements to access and transform your workflow data. Instead of hard-coding values, you can:

- Reference data from connected nodes using simple dot notation
- Access node configuration via `parameters`
- Perform calculations, comparisons, and string operations
- Use standard JavaScript methods (Math, String, Array, etc.)
- Create conditional logic

**Expression Engine**: We use sandboxed JavaScript evaluation for expressions. This provides a familiar, powerful syntax that's easy to learn for both engineers and non-engineers.

### Expression Syntax

Expressions are written inside your node properties using double curly braces:

```
{{ expression }}
```

### Simple Examples

```javascript
{{ manualTrigger.prompt }}                    // Get prompt from Manual Trigger node
{{ httpRequest.statusCode }}                  // Get status code from HTTP Request node
{{ parameters.temperature * 2 }}              // Math operations with node parameters
{{ structuredOutput.score > 0.8 ? "Pass" : "Fail" }}  // Conditional
{{ dates.today }}                             // Current date
{{ previousNode.text.toUpperCase() }}         // String transformation
```

## Basic Syntax

### Node Names as Variables

Connected nodes are accessible as **camelCase variables** based on their display names:

| Node Display Name | Variable Name |
|------------------|---------------|
| Manual Trigger | `manualTrigger` |
| HTTP Request | `httpRequest` |
| Structured Output | `structuredOutput` |
| Text Input | `textInput` |
| API Call | `apiCall` |

**Conversion Rules:**
- Spaces and special characters removed
- First letter lowercase
- Words capitalized (camelCase)
- Numbers preserved

**Examples:**
```javascript
{{ manualTrigger.prompt }}           // "Manual Trigger" node
{{ httpRequest.data.userId }}        // "HTTP Request" node
{{ structuredOutput.model }}         // "Structured Output" node
```

### Duplicate Node Names

If you have multiple nodes with the same name, they're numbered sequentially:

```javascript
{{ manualTrigger.prompt }}           // First Manual Trigger
{{ manualTrigger2.prompt }}          // Second Manual Trigger
{{ manualTrigger3.prompt }}          // Third Manual Trigger
```

**How it works:**
- First occurrence: no number
- Second occurrence: `2` suffix
- Third occurrence: `3` suffix
- And so on...

### Property Access

Use standard JavaScript dot notation to access nested properties:

```javascript
{{ manualTrigger.user.email }}       // Nested object
{{ httpRequest.results[0] }}         // Array access
{{ apiCall.data.users[0].name }}     // Combined nested access
```

## Available Variables

### Node Variables (camelCase)

Every connected node with execution data is available as a variable:

```javascript
{{ manualTrigger.prompt }}
{{ httpRequest.statusCode }}
{{ structuredOutput.model }}
```

**What you get:**
- Direct access to the node's JSON output data
- No need for complex path syntax
- Autocomplete suggestions as you type

### `parameters` - Current Node's Configuration

Access the current node's parameter values:

```javascript
{{ parameters.systemPrompt }}
{{ parameters.temperature }}
{{ parameters.mode }}
```

**Note:** These are configuration values set in the node's Parameters panel, NOT data from upstream nodes.

### `previousNode` - Last Connected Node

Shorthand to access the most recently connected node:

```javascript
{{ previousNode.text }}
{{ previousNode.score }}
```

**When to use:**
- Simple linear workflows
- You don't need to specify which node
- Quick access to immediate upstream data

### `dates` - Date Helpers

Built-in date utilities:

```javascript
{{ dates.now }}          // ISO timestamp: "2024-01-15T10:30:00.000Z"
{{ dates.today }}        // Date only: "2024-01-15"
{{ dates.timestamp }}    // Unix timestamp: 1705318200000
```

**Common patterns:**
```javascript
"Generated on {{ dates.today }}"
"Timestamp: {{ dates.timestamp }}"
```

### `workflow` - Workflow Metadata

Access workflow information:

```javascript
{{ workflow.id }}        // Workflow ID
{{ workflow.name }}      // Workflow name
```

## Expression Context

The expression context contains all available data. Here's the complete structure:

```javascript
{
  // Connected nodes (camelCase names)
  manualTrigger: {
    prompt: "User's input",
    userId: "123"
  },
  httpRequest: {
    statusCode: 200,
    data: { ... }
  },

  // Special variables
  parameters: {
    systemPrompt: "You are a helpful assistant",
    temperature: 0.7
  },
  previousNode: {
    // Same as last connected node
  },
  dates: {
    now: "2024-01-15T10:30:00.000Z",
    today: "2024-01-15",
    timestamp: 1705318200000
  },
  workflow: {
    id: "workflow-123",
    name: "My Workflow"
  }
}
```

### How Data Flows

1. **Node executes** → produces `INodeExecutionData` with `json` property
2. **System builds context** → converts node names to camelCase
3. **Expression evaluates** → accesses data via simple variables
4. **Result returned** → used in current node's execution

**Example:**
```typescript
// Node output structure
INodeExecutionData {
  data: {
    main: [{
      json: {
        prompt: "Hello world",
        userId: "123"
      }
    }]
  }
}

// Becomes accessible as:
{{ manualTrigger.prompt }}     // "Hello world"
{{ manualTrigger.userId }}     // "123"
```

## Examples

### Example 1: Simple Variable Access

**Scenario:** Get user input from Manual Trigger

```javascript
{{ manualTrigger.prompt }}
```

**Result:** `"What is the weather like?"`

---

### Example 2: Nested Property Access

**Scenario:** Get email from nested user object

```javascript
{{ httpRequest.data.user.email }}
```

**Result:** `"alice@example.com"`

---

### Example 3: Array Access

**Scenario:** Get first result from array

```javascript
{{ apiCall.results[0].score }}
```

**Result:** `0.95`

---

### Example 4: String Concatenation

**Scenario:** Combine multiple values into one string

```javascript
"Hello {{ manualTrigger.name }}, welcome back!"
```

**Result:** `"Hello Alice, welcome back!"`

---

### Example 5: Math Operations

**Scenario:** Calculate adjusted score

```javascript
{{ structuredOutput.score * parameters.multiplier }}
```

**Result:** `7.5` (if score is 0.75 and multiplier is 10)

---

### Example 6: Conditional (Ternary)

**Scenario:** Set mode based on score

```javascript
{{ structuredOutput.score > 0.8 ? "high" : "low" }}
```

**Result:** `"high"` (if score is 0.95)

---

### Example 7: String Methods

**Scenario:** Convert text to uppercase

```javascript
{{ manualTrigger.text.toUpperCase() }}
```

**Result:** `"HELLO WORLD"`

---

### Example 8: Multiple Expressions in One Field

**Scenario:** Create dynamic prompt with multiple values

```javascript
"Analyze {{ manualTrigger.topic }} on {{ dates.today }} using {{ parameters.mode }} mode"
```

**Result:** `"Analyze climate change on 2024-01-15 using strict mode"`

---

### Example 9: Using previousNode

**Scenario:** Access last node's output

```javascript
{{ previousNode.text }}
```

**Result:** Same as accessing the last connected node by name

---

### Example 10: Complex Conditional

**Scenario:** Multi-condition logic

```javascript
{{ httpRequest.statusCode === 200 ?
   "Success: " + httpRequest.data.message :
   "Error: " + httpRequest.statusText }}
```

**Result:** `"Success: Data retrieved"` or `"Error: Not Found"`

---

### Example 11: Array Length

**Scenario:** Get count of items

```javascript
"Found {{ apiCall.results.length }} results"
```

**Result:** `"Found 15 results"`

---

### Example 12: Logical Operators

**Scenario:** Combine multiple conditions

```javascript
{{ structuredOutput.score > 0.8 && structuredOutput.verified ? "approved" : "review" }}
```

**Result:** `"approved"` (if both conditions are true)

---

### Example 13: Math Functions

**Scenario:** Round a number

```javascript
{{ Math.round(structuredOutput.confidence * 100) }}%
```

**Result:** `"87%"`

---

### Example 14: Date Formatting

**Scenario:** Include current date in output

```javascript
"Report generated on {{ dates.today }}"
```

**Result:** `"Report generated on 2024-01-15"`

---

### Example 15: Default Values

**Scenario:** Provide fallback for missing data

```javascript
{{ manualTrigger.email || "no-email@example.com" }}
```

**Result:** `"no-email@example.com"` (if email is undefined)

## Autocomplete & Drag-and-Drop

### Autocomplete

The expression editor provides intelligent autocomplete as you type:

1. **Type `{{` to start** an expression
2. **Type a space** and see suggestions
3. **Autocomplete shows:**
   - **SUGGESTED**: `parameters`, common helpers
   - **EARLIER NODES**: All connected nodes (camelCase)

**Example:**
```
{{ man[TAB]          → manualTrigger.
{{ manualTrigger.[TAB]  → Shows available properties
```

**Autocomplete sections:**

**SUGGESTED:**
- `parameters` - Current node's configuration
- `parameters.fieldName` - Parameter fields

**EARLIER NODES:**
- `manualTrigger` - First Manual Trigger node
- `manualTrigger2` - Second Manual Trigger node
- `httpRequest` - HTTP Request node
- etc.

### Drag-and-Drop

The **INPUT** panel (left side of node editor) shows execution data from connected nodes:

1. **Execute your workflow** to populate data
2. **Open a node** to see its editor
3. **Expand nodes in INPUT panel** to see their data
4. **Drag any field** into a parameter field

**What happens:**
- Dragging `prompt` from "Manual Trigger" generates: `{{ manualTrigger.prompt }}`
- Dragging `statusCode` from "HTTP Request" generates: `{{ httpRequest.statusCode }}`
- Dragging nested `user.email` generates: `{{ apiCall.user.email }}`

**Views available:**
- **Schema** - Tree view with drag-and-drop chips
- **Table** - Tabular view with drag-and-drop rows
- **JSON** - Raw JSON view

### Expression Preview

The **Result** section shows live evaluation:

```javascript
{{ manualTrigger.prompt }}

Result:
"What is the weather like?"
```

**States:**
- ✅ **Evaluated value** - Expression is valid and has data
- ❌ **Error message** - Expression has syntax error
- ⏳ **"No execution data available"** - Workflow hasn't run yet
- ⏳ **"Evaluating..."** - Expression is being processed

## Advanced Usage

### Combining Multiple Nodes

Access data from multiple nodes in one expression:

```javascript
"User {{ manualTrigger.userId }} requested {{ httpRequest.itemCount }} items"
```

### Deeply Nested Access

Chain property access as needed:

```javascript
{{ apiCall.response.data.users[0].profile.settings.email }}
```

### Complex Calculations

Use standard JavaScript operations:

```javascript
{{ (structuredOutput.score * 100).toFixed(2) }}%
```

### String Manipulation

Use built-in JavaScript string methods:

```javascript
{{ manualTrigger.text.toLowerCase().trim() }}
{{ httpRequest.data.join(", ") }}
{{ apiCall.description.substring(0, 100) }}
```

### Array Operations

Work with arrays using JavaScript methods:

```javascript
{{ apiCall.items.length }}
{{ apiCall.results[0].name }}
{{ apiCall.scores.map(s => s * 2) }}  // Note: limited by sandbox
```

### Type Checking

Check types before accessing:

```javascript
{{ typeof manualTrigger.value === "string" ? manualTrigger.value : "N/A" }}
```

### Template Literals (Alternative)

Mix static text with expressions:

```javascript
Processing {{ apiCall.items.length }} items in {{ parameters.mode }} mode for user {{ manualTrigger.userId }}
```

## Security

Expressions run in a **sandboxed JavaScript environment** with security restrictions:

### Blocked Globals

The following are **undefined** in expressions (security):

- `window`, `document`, `global`
- `process`, `require`, `import`
- `fetch`, `XMLHttpRequest`, `WebSocket`
- `localStorage`, `sessionStorage`, `indexedDB`
- `alert`, `confirm`, `prompt`, `print`
- `open`, `close`, `location`, `navigator`, `history`
- `console`, `performance`
- `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`
- `requestAnimationFrame`

### Allowed Features

The following are **available** in expressions:

- `JSON`, `Math`, `Date`
- `String`, `Number`, `Boolean`, `Array`, `Object`
- Standard JavaScript operators (`+`, `-`, `*`, `/`, `%`, `&&`, `||`, `!`, etc.)
- Ternary conditionals (`? :`)
- Property access (`.`, `[]`)

### Strict Mode

Expressions run in JavaScript strict mode for additional security:

- No undeclared variables
- No deleting variables
- No eval in certain contexts
- More restrictions on `this`

### Future: Worker Isolation

**Note:** In future releases, expressions will run in separate worker processes for complete isolation. Currently, the sandbox provides reasonable security for trusted workflows.

## Limitations

### What You CAN Do

✅ Access node data with dot notation
✅ Access parameters, dates, workflow metadata
✅ Math operations (`+`, `-`, `*`, `/`, `%`)
✅ String operations (concatenation, methods)
✅ Comparison operators (`>`, `<`, `===`, `!==`)
✅ Logical operators (`&&`, `||`, `!`)
✅ Ternary conditionals (`? :`)
✅ Array/object access (`[]`, `.`)
✅ Built-in methods (`Math.round`, `String.toUpperCase`, etc.)

### What You CANNOT Do

❌ Define custom functions
❌ Use loops (for, while, etc.)
❌ Make network calls
❌ Access file system
❌ Use `eval`, `Function` constructor
❌ Access browser/Node.js APIs
❌ Modify data (expressions are read-only)
❌ Use async/await

**For complex transformations:** Use Code nodes or dedicated transformation nodes instead of expressions.

### Data Type Handling

Expressions work with JSON-serializable data:

- ✅ **Strings**: `{{ manualTrigger.message }}`
- ✅ **Numbers**: `{{ apiCall.count }}`, `{{ parameters.temperature }}`
- ✅ **Booleans**: `{{ structuredOutput.isValid }}`
- ✅ **Arrays**: `{{ httpRequest.items[0] }}`
- ✅ **Objects**: `{{ apiCall.user.name }}`
- ✅ **null**: Handled gracefully (returns `null`)
- ✅ **undefined**: Handled gracefully (returns `undefined`)

## Troubleshooting

### Expression Returns `undefined`

**Cause:** Property doesn't exist in node output

**Solution:**
1. Use INPUT panel to verify actual data structure
2. Check spelling and capitalization
3. Provide a default value: `{{ manualTrigger.field || "default" }}`

**Example:**
```javascript
// Wrong property name
{{ manualTrigger.promtp }}  // undefined (typo)

// Correct
{{ manualTrigger.prompt }}  // "Hello world"

// With fallback
{{ manualTrigger.missing || "fallback" }}  // "fallback"
```

---

### "No execution data available"

**Cause:** Workflow hasn't been executed yet

**Solution:**
1. Click "Execute Node" or "Execute Workflow" button
2. Execution data will populate
3. Expression will evaluate and show result

---

### Node Variable Not Found

**Cause:** Node doesn't exist, isn't connected, or hasn't executed

**Solution:**
1. Verify node is connected upstream
2. Check node name matches (use INPUT panel)
3. Execute the workflow to populate data
4. Remember: names are camelCase (`manualTrigger`, not `Manual Trigger`)

---

### Autocomplete Not Showing Nodes

**Cause:** Nodes haven't been connected or data hasn't loaded

**Solution:**
1. Connect nodes with edges
2. The autocomplete updates automatically
3. All connected nodes appear in "EARLIER NODES" section

---

### Duplicate Node Shows Wrong Data

**Cause:** Using wrong numbered variable

**Solution:**
```javascript
// If you have two "Manual Trigger" nodes:
{{ manualTrigger.prompt }}   // First one
{{ manualTrigger2.prompt }}  // Second one
{{ manualTrigger3.prompt }}  // Third one
```

Use INPUT panel to see which number corresponds to which node.

---

### Expression Syntax Error

**Cause:** Invalid JavaScript syntax

**Solution:**
- Check for matching quotes: `"text"` or `'text'`
- Check for matching braces: `{{ }}`
- Valid operators: `+`, `-`, `*`, `/`, `===`, `!==`, `&&`, `||`
- Use ternary: `condition ? true : false`

**Common mistakes:**
```javascript
// Wrong
{{ manualTrigger.text = "new" }}  // Can't assign
{{ for (let i...) }}              // No loops

// Right
{{ manualTrigger.text }}
{{ manualTrigger.count > 10 ? "many" : "few" }}
```

---

### Getting `[object Object]` Instead of Value

**Cause:** Accessing object instead of property

**Solution:**
```javascript
// Wrong - returns whole object
{{ manualTrigger }}  // [object Object]

// Right - access specific property
{{ manualTrigger.prompt }}  // "Hello world"

// To see structure, use INPUT panel or convert to JSON
{{ JSON.stringify(manualTrigger) }}
```

---

## Common Patterns

### Conditional Prompts

```javascript
{{
  parameters.style === "formal" ?
    "Please provide a professional response." :
    "Keep it casual and friendly."
}}
```

### Combining Multiple Inputs

```javascript
"Process {{ manualTrigger.topic }} with {{ httpRequest.itemCount }} items"
```

### Formatting Numbers

```javascript
{{ Math.round(structuredOutput.confidence * 100) }}%
```

### String Templates

```javascript
"User {{ manualTrigger.name }} ({{ manualTrigger.email }}) requested access on {{ dates.today }}"
```

### Checking for Missing Data

```javascript
{{ manualTrigger.email || "no-email@example.com" }}
{{ apiCall.data ? apiCall.data.value : "N/A" }}
```

### Array Length Checks

```javascript
{{ httpRequest.items.length > 0 ? "Has items" : "Empty" }}
```

### Nested Conditionals

```javascript
{{
  structuredOutput.score > 0.9 ? "excellent" :
  structuredOutput.score > 0.7 ? "good" :
  structuredOutput.score > 0.5 ? "average" :
  "poor"
}}
```

## Quick Reference

### Variable Access

| Expression | Description |
|-----------|-------------|
| `{{ nodeName.field }}` | Access field from named node |
| `{{ nodeName.nested.field }}` | Access nested property |
| `{{ nodeName.array[0] }}` | Access array element |
| `{{ parameters.field }}` | Current node parameter |
| `{{ previousNode.field }}` | Last connected node |
| `{{ dates.today }}` | Current date |
| `{{ workflow.id }}` | Workflow ID |

### Operators

| Expression | Description |
|-----------|-------------|
| `{{ a + b }}` | Addition |
| `{{ a - b }}` | Subtraction |
| `{{ a * b }}` | Multiplication |
| `{{ a / b }}` | Division |
| `{{ a % b }}` | Modulo |
| `{{ a === b }}` | Equality |
| `{{ a !== b }}` | Inequality |
| `{{ a > b }}` | Greater than |
| `{{ a < b }}` | Less than |
| `{{ a && b }}` | Logical AND |
| `{{ a \|\| b }}` | Logical OR |
| `{{ !a }}` | Logical NOT |
| `{{ a ? b : c }}` | Ternary conditional |

### Common Methods

| Expression | Description |
|-----------|-------------|
| `{{ text.toUpperCase() }}` | Convert to uppercase |
| `{{ text.toLowerCase() }}` | Convert to lowercase |
| `{{ text.trim() }}` | Remove whitespace |
| `{{ text.substring(0, 10) }}` | Get substring |
| `{{ array.length }}` | Array length |
| `{{ Math.round(num) }}` | Round number |
| `{{ Math.floor(num) }}` | Round down |
| `{{ Math.ceil(num) }}` | Round up |
| `{{ JSON.stringify(obj) }}` | Convert to JSON string |

## Key Takeaways

1. **Simple syntax**: Use camelCase node names directly (`manualTrigger.prompt`)
2. **No complex paths**: No more `$items["Node Name"][0].json.field` syntax
3. **Autocomplete**: Type `{{` and see all available variables
4. **Drag-and-drop**: Drag fields from INPUT panel to generate expressions
5. **JavaScript-based**: Familiar syntax with standard operators and methods
6. **Sandboxed**: Secure evaluation without access to dangerous APIs
7. **Real-time preview**: See evaluated results as you type
8. **Duplicate handling**: Nodes with same name get numbered (node, node2, node3)

## See Also

- [Node System Guide](./NODE_SYSTEM.md) - Understanding node architecture
- [Execution Context](./EXECUTION_CONTEXT.md) - INodeExecutionData structure
- [Data Types](./DATATYPES.md) - How data flows through the system

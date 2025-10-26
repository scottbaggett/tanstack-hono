# CEL Expressions in Workflows

This guide explains how to use **CEL (Common Expression Language)** expressions in your workflow node properties to create dynamic, data-driven workflows.

## Table of Contents

1. [Overview](#overview)
2. [Basic Syntax](#basic-syntax)
3. [Available Variables](#available-variables)
4. [Examples](#examples)
5. [Advanced Usage](#advanced-usage)
6. [Limitations](#limitations)

## Overview

CEL expressions allow you to write small, powerful statements to transform and inspect your workflow data. Instead of hard-coding values, you can:

- Reference data from connected nodes
- Access node configuration
- Perform calculations and comparisons
- Use built-in functions (string, array, math operations)
- Create conditional logic

### Expression Syntax

Expressions are written inside your node properties using either syntax:

```
{{expression}}    // Recommended
${expression}     // Alternative
```

### Simple Examples

```
{{$input.text}}                           // Get text from input
{{$parameter.temperature * 2}}            // Math operations
{{$input.count > 10 ? "many" : "few"}}   // Conditional
```

## Basic Syntax

### Variable Access

Access nested properties with dot notation:

```cel
$input.results[0].score        // Array access
$parameter.settings.debug      // Nested objects
$node.id                       // Current node ID
```

### Operators

**Arithmetic**
```cel
{{10 + 5}}              // 15
{{$parameter.value * 2}}
{{100 / $input.divisor}}
```

**Comparison**
```cel
{{$input.score >= 0.8}}         // true/false
{{$parameter.name == "admin"}}
{{$input.count != null}}
```

**Logical**
```cel
{{$input.score > 0.8 && $input.verified == true}}
{{$parameter.debug || $parameter.verbose}}
{{!$input.isDeleted}}
```

**String Concatenation**
```cel
{{"Hello " + $parameter.name}}
{{$input.firstName + " " + $input.lastName}}
```

### Conditionals (Ternary)

```cel
{{$input.score > 0.8 ? "Pass" : "Fail"}}
{{$parameter.mode == "strict" ? 10 : 100}}
```

## Available Variables

### `$input` - Connected Input Data

Data from nodes connected to this node's inputs.

```cel
$input.text                    // Single value
$input.results[0]             // First result
$input.data.metadata.key      // Nested access
```

### `$parameter` - Node Properties

Values from this node's configuration properties.

```cel
$parameter.systemPrompt       // Property value
$parameter.temperature        // Config value
$parameter.settings.timeout   // Nested property
```

### `$node` - Current Node Metadata

Information about the current node.

```cel
$node.id                      // Node instance ID (e.g., "agent-1")
$node.type                    // Node type (e.g., "agent")
$node.version                 // Node version (e.g., 1)
```

## Examples

### Example 1: Dynamic System Prompt

Node property: `systemPrompt`

```cel
{{
  "You are an expert in " +
  $parameter.domain +
  ". Respond in " +
  $parameter.language
}}
```

With properties:
- domain: "biology"
- language: "Spanish"

Result: `"You are an expert in biology. Respond in Spanish"`

### Example 2: Conditional Processing

Node property: `processingMode`

```cel
{{
  $input.fileSize > 10000000 ? "streaming" : "standard"
}}
```

If file size > 10MB, use "streaming", otherwise "standard"

### Example 3: Array Operations

Node property: `selectedTools`

```cel
{{
  $input.availableTools.filter(t, t.enabled).map(t, t.name)
}}
```

Get names of all enabled tools from the input.

### Example 4: Using Macros

```cel
{{
  size($input.items) > 0 ?
    $input.items[0].value :
    "empty"
}}
```

Get first item's value, or "empty" if list is empty.

## Advanced Usage

### Template Strings with Multiple Expressions

A single property can contain multiple expressions:

```
"Processing {{$parameter.count}} items in {{$parameter.mode}} mode for {{$input.userId}}"
```

Result: `"Processing 5 items in batch mode for user123"`

### Nested Objects

Access complex data structures:

```cel
{{
  {
    "userId": $input.user.id,
    "userName": $input.user.name,
    "isAdmin": $input.user.roles.size() > 0
  }
}}
```

### Macros (Built-in Functions)

CEL provides useful macros for common operations:

**Array Operations**
```cel
size($input.items)              // Length of array
$input.items.map(x, x.value)   // Transform each element
$input.items.filter(x, x > 5)  // Filter elements
```

**String Operations**
```cel
"hello".toUpperCase()           // "HELLO"
"  trim me  ".trim()            // "trim me"
"a,b,c".split(",")             // ["a", "b", "c"]
```

**Conditionals**
```cel
has($input.optional_field)      // Check if field exists
$input.value != null            // Null check
$input.list.exists(x, x > 0)   // Any element matches
```

### Type Conversions

```cel
int("42")                   // String to integer
string(123)                 // Integer to string
double("3.14")             // String to float
bool("true")               // String to boolean
```

## Expression Validation

The system automatically validates expressions when you save a node. Invalid expressions will show an error message.

**Invalid expression example:**
```cel
{{$input.nonexistent.property}}  // May still evaluate (CEL is lenient)
{{size($input.items)}}           // Valid - using macro
{{$input[0:5]}}                  // Valid - slicing
```

Note: CEL is designed to be lenient. If a property doesn't exist, it returns `null` rather than erroring. Use `has()` to check existence first.

## Limitations

### What You Can't Do

- **No arbitrary code execution** - CEL is sandboxed, you can't call JavaScript functions
- **No file access** - No reading/writing files
- **No network calls** - Expressions can't make HTTP requests
- **No state mutations** - Expressions can't modify input data (they return new values)
- **No loops** - Use `map()`, `filter()`, etc. instead
- **No function definitions** - Can't define custom functions (use built-in macros)

### Data Types

CEL works with standard JSON types:
- **Strings**: `"hello"`
- **Numbers**: `42`, `3.14`
- **Booleans**: `true`, `false`
- **Arrays**: `[1, 2, 3]`
- **Objects**: `{name: "Alice", age: 30}`
- **Null**: `null`

Complex objects (classes, functions, etc.) are serialized to JSON before evaluation.

### Expression Performance

- Expressions are compiled and cached for performance
- Large array operations (`map()` on 1M items) may be slow
- Use filters early to reduce data size

## Common Patterns

### Conditional Prompts

```cel
{{
  $parameter.style == "formal" ?
    "Please provide a professional response." :
    "Keep it casual and friendly."
}}
```

### Dynamic Tool Selection

```cel
{{
  $input.dataType == "image" ?
    ["vision", "ocr"] :
    ["text", "analysis"]
}}
```

### Formatting Output

```cel
{{
  "Count: " + string(size($input.items)) +
  " | Mode: " + $parameter.mode
}}
```

### Checking Required Fields

```cel
{{
  has($input.email) && has($input.password) ?
    "Ready" : "Missing fields"
}}
```

## Troubleshooting

### Expression returns `null`

This usually means a field doesn't exist. Use `has()` to check:

```cel
{{has($input.field) ? $input.field : "default"}}
```

### Wrong data type

Convert explicitly:

```cel
{{string($input.number)}}     // Convert number to string
{{int($input.text)}}          // Convert string to number
```

### Performance issues

If evaluation is slow:
- Reduce array sizes before processing
- Move complex filtering to the connected node
- Cache results in a previous node

## See Also

- [CEL Language Reference](https://github.com/google/cel-spec)
- [Node System Guide](./NODE_SYSTEM.md)
- [Workflow Structure](./WORKFLOWS.md)

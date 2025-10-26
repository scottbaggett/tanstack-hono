# Workflow Builder Architecture

## Overview

This document describes the architecture of the TypeScript-first, LangChain-powered AI workflow builder.

**Core Principle**: LangChain is the execution engine. Nodes use LangChain directly. The orchestrator handles graph execution, state management, and event streaming.

## High-Level Architecture

```
User Interface (React + TanStack Router)
         ↓
    Hono API Server
         ↓
  WorkflowOrchestrator (Graph Execution)
         ↓
    [Node Execution Layer]
         ↓
    LangChain (LLMs, Chains, Agents, Tools)
         ↓
PostgreSQL Database
```

## Core Components

### 1. Node System (`src/server/nodes/Node.ts`)

**Base Class**: `Node` (abstract)
- Implements `INodeType` interface
- Optional execution modes: `execute`, `webhook`, `poll`
- Versioning support for backwards compatibility

**Registration**: Nodes are registered with `NodeLoader` at startup

**Three Execution Modes**:
- **execute** - Regular workflow execution (primary)
- **webhook** - Handle incoming webhooks
- **poll** - Periodic polling for new data

### 2. Execution Context API - Three Layers (`src/types/execution.ts`)

**Layer 1: Core** (`IExecuteFunctionsCore`)
- Node parameters, input/output, logging, events
- Framework-independent, required by all nodes
- 14 core methods

**Layer 2: Primitives** (`IExecuteFunctionsPrimitives`)
- `httpRequest()` - HTTP requests with timeout
- `executeSandboxedCode()` - Python, JavaScript, Bash execution
- `readFile()` / `writeFile()` - Workspace-scoped file I/O

**Layer 3: LangChain** (`IExecuteFunctionsLangChain`)
- `getLangchainModel()` - Access LLMs
- `getLangchainEmbeddings()` - Access embeddings
- `getLangchainTools()` - Get tools for agents

See [EXECUTION_CONTEXT.md](./EXECUTION_CONTEXT.md) for details.

### 3. Execution Context Implementation (`src/server/execution/ExecuteFunctions.ts`)

**Full implementation of all three layers**:
- Parameter and input/output management
- LangChain model/embeddings/tools access
- HTTP requests with timeout and auto-JSON parsing
- Sandboxed code execution (JS/Python/Bash)
- File I/O with workspace security
- Logging and event emission
- Dynamic input discovery

### 4. Workflow Orchestrator (`src/server/execution/WorkflowOrchestrator.ts`)

**Responsibilities**:
1. Load workflow definition
2. Topological sort (Kahn's algorithm) for execution order
3. Execute nodes in dependency order
4. Manage execution state
5. Resolve inputs using InputResolver
6. Collect outputs and events
7. Handle errors

**Execution Flow**:
```
Load Workflow Definition
    ↓
Validate (topological sort checks for cycles)
    ↓
For Each Node in Dependency Order:
  - Resolve Inputs (edges + {{variables}})
  - Create ExecuteFunctions Context
  - Call node.execute(context)
  - Collect Outputs & Events
    ↓
Return Results + Events + History
```

### 5. Input Resolver (`src/server/execution/InputResolver.ts`)

**Features**:
- Extract {{variable}} placeholders from node config
- Resolve variables using connected edge values
- Handle nested object resolution
- Auto-expose dynamic inputs
- Validate required inputs
- Support both edge connections and template variables

See [DYNAMIC_IO.md](./DYNAMIC_IO.md) for details.

### 6. Data Type Handler (`src/server/execution/DataTypeHandler.ts`)

**Utilities for rich data types**:
- `toTypedValue()` - Convert to TypedValue with type info
- `serializeOutputData()` - Prepare for database storage
- `deserializeOutputData()` - Load from database
- `validateDataType()` - Type checking and conversion
- `summarizeData()` - Human-readable logging
- `validateOutputHandles()` - Verify node output matches declaration

### 7. Data Type System (`src/types/datatypes.ts`)

**Supports 20+ types**:
- Primitives: string, number, float, integer, boolean
- Structured: json, csv, pdb, xml, yaml
- Binary: buffer, images (png, jpg, webp, gif, svg)
- Collections: array, object
- Custom: custom:* for domain-specific types

**TypedValue format**:
```typescript
{
  dataType: "image:png" | "csv" | "string" | ...
  value: actual data
  metadata?: { ... }
}
```

See [DATATYPES.md](./DATATYPES.md) for details.

### 8. REST API (`src/server/routes/workflows.ts`)

**Endpoints**:
- `GET /api/workflows` - List workflows
- `GET /api/workflows/:id` - Get workflow
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `GET /api/workflows/:id/runs` - List runs
- `GET /api/workflows/:id/runs/:runId` - Get run details
- `POST /api/workflows/:id/run` - Execute workflow
- `GET /api/workflows/:id/runs/:runId/events` - Stream events (SSE)

See [API.md](./API.md) for full reference.

### 9. Database (`src/server/db/schema.ts`)

**Core Tables**:
- `users` - Platform users
- `workflows` - Workflow definitions (JSONB nodes/edges)
- `workflow_runs` - Execution instances with status
- `node_executions` - Individual node results (inputs/outputs)
- `execution_events` - Event stream for replay (type, timestamp, data)
- `node_definitions` - Registered node types

### 10. Server (`src/server/index.ts`)

**Hono server setup**:
- Middleware (logging, CORS)
- API route registration
- Health check endpoint
- Error handling
- 404 handler

## Data Flow

### Workflow Execution

```
1. User submits workflow + inputs
   ↓
2. API creates WorkflowRun
   ↓
3. WorkflowOrchestrator.orchestrate()
   - Topological sort
   - For each node:
     * Input resolution (InputResolver)
     * Node execution
     * Output collection
     * Event collection
   ↓
4. Return results + events
   ↓
5. API streams events via SSE
   ↓
6. Store execution history
```

### Input Data Flow

```
Upstream Node Output
         ↓
  Edge Connection
         ↓
  InputResolver.getEdgeValue()
         ↓
  ExecuteFunctions.getInputData()
         ↓
  Current Node Input
```

### Event Streaming

```
Node emits event
         ↓
  Orchestrator collects
         ↓
  API streams via SSE
         ↓
  Frontend displays
         ↓
  Database stores
```

## Type Safety

**Full TypeScript coverage**:
- Workflow definitions
- Node descriptions
- Execution contexts
- Database models (Drizzle)
- API responses

## Key Design Decisions

### 1. Three-Layer Execution Context (Critical for Flexibility)

**The Problem**: Relying solely on LangChain for all node execution would create vendor lock-in and limit flexibility.

**The Solution**: Three independent layers allow nodes to use only what they need:

```
Layer 1: Core (IExecuteFunctionsCore)
├─ Node parameters & configuration
├─ Input/output management
├─ Logging & event emission
├─ Secrets access
└─ Metadata (runId, nodeId, etc.)

Layer 2: Primitives (IExecuteFunctionsPrimitives extends Layer 1)
├─ httpRequest() - Any REST API
├─ executeSandboxedCode() - Python, JavaScript, Bash
├─ readFile() / writeFile() - File I/O
└─ All independent of any AI framework

Layer 3: LangChain (IExecuteFunctionsLangChain extends Layer 2)
├─ getLangchainModel() - LLMs and chat models
├─ getLangchainEmbeddings() - Embedding models
├─ getLangchainTools() - Tools for agents
└─ Optional - only used when needed
```

**Why This Matters**:

1. **No Lock-In**: A simple transformer node never needs LangChain
   ```typescript
   class TextTransformNode extends Node {
     async execute(context: IExecuteFunctionsCore) {
       // Only basic I/O - works without LangChain
       const input = context.getInputValue("text");
       context.setOutput("text", [input.toUpperCase()]);
     }
   }
   ```

2. **Platform Agnostic**: Any API integration works without frameworks
   ```typescript
   class APICallerNode extends Node {
     async execute(context: IExecuteFunctionsPrimitives) {
       // Uses httpRequest() - no external framework needed
       const response = await context.httpRequest({
         url: "https://api.example.com/data",
         method: "GET"
       });
       context.setOutputData({ result: [response.data] });
     }
   }
   ```

3. **Code Execution**: Run arbitrary Python/JavaScript/Bash
   ```typescript
   class PythonNode extends Node {
     async execute(context: IExecuteFunctionsPrimitives) {
       // Sandboxed code execution - no framework dependency
       const result = await context.executeSandboxedCode({
         language: "python",
         code: "import pandas as pd; ...",
         requirements: ["pandas", "numpy"]
       });
       context.setOutputData({ output: [result.output] });
     }
   }
   ```

4. **Optional LangChain**: Use when you need AI, skip when you don't
   ```typescript
   class LLMNode extends Node {
     async execute(context: IExecuteFunctionsLangChain) {
       // Only uses LangChain when needed
       const model = context.getLangchainModel("gpt-4");
       // ... LangChain-specific logic
     }
   }
   ```

5. **Future-Proof**: Add new frameworks without breaking existing nodes
   ```typescript
   // Could add DSPy support in future
   export interface IExecuteFunctionsDSPy extends IExecuteFunctionsPrimitives {
     getDSPyModel(name?: string): DSPyModel
     getDSPyProgram(name?: string): DSPyProgram
   }

   // Existing LangChain nodes still work ✅
   // Existing API/Python nodes still work ✅
   // New DSPy nodes use new methods ✅
   ```

**Real-World Workflow Example**:
```
[REST API Call] ──────┐
                       │
[Python Script] ───────┼─→ [LLM Agent] ─→ [Slack Notification]
                       │
[Database Query] ──────┘

- REST API: Uses Layer 1 + 2 (httpRequest)
- Python: Uses Layer 1 + 2 (executeSandboxedCode)
- LLM: Uses Layer 1 + 2 + 3 (getLangchainModel)
- Slack: Uses Layer 1 + 2 (httpRequest)

All nodes coexist in same workflow, each using only what they need.
```

### 2. Topological Sort for Execution

**Why**:
- Ensures correct execution order
- Supports parallel execution (future)
- Detects circular dependencies
- Simple and efficient (Kahn's algorithm)

### 3. Event-Based Streaming

**Why**:
- Real-time updates to frontend
- Complete execution replay capability
- Debugging support
- Audit trail

### 4. TypedValue System

**Why**:
- Support rich data types (not just JSON)
- Explicit type information
- Automatic serialization
- Type validation

### 5. Dynamic Inputs with {{variable}}

**Why**:
- No need to pre-define inputs
- Flexible, template-based workflows
- Automatic UI generation
- Matches user expectations

## Extension Points

### Adding New Node Types

1. Create class extending `Node`
2. Implement `execute()` method
3. Define `description: INodeTypeDescription`
4. Register with `NodeLoader`

See `src/server/nodes/examples/` for examples.

### Adding New Data Types

1. Add type ID to `DataTypeId` union
2. Define metadata in `DATA_TYPE_METADATA`
3. Define serialization in `serializeValue()`
4. Define deserialization in `deserializeValue()`

See [Data Types](./DATATYPES.md).

### Custom Nodes with Dynamic Inputs

Use {{variable}} placeholders in node config. InputResolver automatically exposes them as connectible inputs.

See [Dynamic IO](./DYNAMIC_IO.md) and `DynamicAgentNode.ts`.

## Performance Considerations

### Execution Speed

- Topological sort: O(V + E) - linear time
- Input resolution: O(edges) per node
- No network overhead between nodes (in-process)

### Scalability

- Workflow size: Limited by graph complexity
- Node count: Tested up to 1000+ nodes
- Data size: Limited by database and memory

### Optimization Opportunities

- Parallel node execution (same dependency level)
- Caching node outputs within run
- Connection pooling for LangChain
- Database query optimization

## Security Considerations

- Secrets: Encrypted, retrieved at execution time
- Node isolation: Nodes can't access other node's data directly
- Input validation: All user inputs validated
- Error handling: Errors logged, not exposed to users
- Sandboxed code: Python/JavaScript/Bash run in isolated processes
- Workspace scoping: File I/O restricted to project directory

## Beyond LangChain: Framework Flexibility

### The Core Philosophy

This platform is **not a LangChain wrapper**. LangChain is one tool among many. The three-layer execution context ensures we can:

1. **Support multiple frameworks** - Add DSPy, OpenAI Swarm, or any framework without breaking existing nodes
2. **Enable non-framework patterns** - HTTP calls, Python scripts, file processing work standalone
3. **Mix and match** - A single workflow uses LangChain for AI, HTTP for APIs, Python for data processing
4. **Future-proof** - When new frameworks emerge, add them as new layers, existing nodes keep working

### Layer Addition Example: Adding OpenAI Swarm

```typescript
// Current: Layer 3 is LangChain
export interface IExecuteFunctionsLangChain extends IExecuteFunctionsPrimitives {
  getLangchainModel(modelName?: string): BaseLanguageModel
  // ... other LangChain methods
}

// Future: Add Layer 3B for Swarm
export interface IExecuteFunctionsSwarm extends IExecuteFunctionsPrimitives {
  getSwarmAgent(name?: string): SwarmAgent
  getSwarmSubAgent(name?: string): SubAgent
}

// Extend main interface
export interface IExecuteFunctions
  extends IExecuteFunctionsLangChain, IExecuteFunctionsSwarm {
}

// Result:
// - LangChain nodes still work ✅
// - API nodes still work ✅
// - Python nodes still work ✅
// - New Swarm nodes can be created ✅
// - No existing code changes ✅
```

### Why This Matters

Many platforms make the mistake of tightly coupling to a single framework:
- Becomes obsolete when better frameworks emerge
- Forces rewriting existing workflows
- Limits architectural flexibility

Our approach:
- **Agnostic by design** - Framework is pluggable, not core
- **Composable** - Mix frameworks in single workflow
- **Evolutionary** - Add new frameworks without breaking changes
- **Practical** - Use the best tool for each job

## See Also

- [Dynamic IO System](./DYNAMIC_IO.md) - {{variable}} inputs/outputs
- [Data Types](./DATATYPES.md) - Rich data type support
- [API Reference](./API.md) - REST API endpoints
- [Execution Context](./EXECUTION_CONTEXT.md) - Three-layer API details

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

### 2. Execution Context API (`src/types/execution.ts`)

**IExecuteFunctions** - Passed to nodes during execution

Provides access to:
- Node parameters
- Input data from previous nodes
- LangChain models, embeddings, tools
- Secrets
- Logging and event emission

### 3. Workflow Orchestrator (`src/server/execution/WorkflowOrchestrator.ts`)

**Responsibilities**:
1. Load workflow definition
2. Topological sort (Kahn's algorithm) for execution order
3. Execute nodes in dependency order
4. Manage execution state
5. Emit events for streaming/logging
6. Handle errors

**Execution Flow**:
```
Load Workflow
    ↓
Topological Sort
    ↓
For Each Node in Order:
  - Prepare Input Data
  - Create ExecuteFunctions Context
  - Call node.execute(context)
  - Collect Outputs & Events
    ↓
Return Results + Events
```

### 4. Input Resolver (`src/server/execution/InputResolver.ts`)

**Features**:
- Extract {{variable}} placeholders from node config
- Resolve variables using connected edge values
- Auto-expose dynamic inputs
- Validate required inputs

See [Dynamic IO](./DYNAMIC_IO.md) for details.

### 5. Data Type System (`src/types/datatypes.ts`)

**Supports**:
- Primitives: string, number, float, integer, boolean
- Structured: json, csv, pdb, xml, yaml
- Binary: buffer, images (png, jpg, webp, gif, svg)
- Collections: array, object

**Serialization**: Each type knows how to serialize/deserialize

See [Data Types](./DATATYPES.md) for details.

### 6. Database (`src/server/db/schema.ts`)

**Core Tables**:
- `users` - Platform users
- `workflows` - Workflow definitions (JSONB)
- `workflow_runs` - Execution instances
- `node_executions` - Individual node execution records
- `execution_events` - Event stream for replay/debugging
- `node_definitions` - Registered node types

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

### 1. LangChain as Engine

**Why**:
- Nodes don't need to know about external services
- LangChain handles complexity (LLMs, chains, agents, tools)
- Clean separation of concerns
- Streaming support built-in

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

## See Also

- [Dynamic IO System](./DYNAMIC_IO.md) - {{variable}} inputs/outputs
- [Data Types](./DATATYPES.md) - Rich data type support
- [API Reference](./API.md) - REST API endpoints

# Architecture Documentation

High-level system architecture and design decisions for the workflow platform.

## Overview

This platform is a **visual workflow orchestration system** that enables domain experts to design, execute, and debug complex AI-augmented workflows with full traceability and extensibility.

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface (React)                │
│  Canvas Editor • Run History • Node Configuration       │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/SSE
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   API Layer (Hono)                       │
│  /workflows • /nodes • /executions • /credentials       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│              Execution Engine (Orchestrator)             │
│  Topological Sort • Node Execution • Agent Loops        │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Nodes      │ │    Tools     │ │   Storage    │
│ (Registry)   │ │  (Registry)  │ │ (Postgres)   │
└──────────────┘ └──────────────┘ └──────────────┘
        ↓               ↓
┌──────────────┐ ┌──────────────┐
│  LangChain   │ │  External    │
│  LangGraph   │ │  APIs        │
└──────────────┘ └──────────────┘
```

## Key Documents

### 🎯 [Execution Engine](./EXECUTION_ENGINE.md)
**The heart of the platform.** Understand how workflows are executed, how agents loop through tools, and how state is managed.

**Read this if**: You want to understand the core execution model, how agents work, or how to optimize workflow performance.

### 📊 [Data Flow](./DATA_FLOW.md) _(Coming Soon)_
How data flows through nodes, how expressions are evaluated, and how state is propagated.

**Read this if**: You want to understand how `$json` works, how nodes access previous outputs, or how to debug data issues.

### 🔄 [Node Lifecycle](./NODE_LIFECYCLE.md) _(Coming Soon)_
The complete lifecycle of a node from registration to execution to cleanup.

**Read this if**: You want to create custom nodes, understand node initialization, or debug node errors.

### 🛠️ [Tech Stack](./TECH_STACK.md) _(Coming Soon)_
Technology choices and rationale: TanStack Router, Hono, Drizzle, LangChain, etc.

**Read this if**: You're new to the project, evaluating the architecture, or considering alternatives.

---

## Architecture Principles

### 1. **Observable by Default**
Every execution step is tracked and stored. No "black boxes" allowed.

### 2. **Type-Safe**
TypeScript end-to-end, with Zod for runtime validation.

### 3. **Provider Agnostic**
Support multiple LLM providers (OpenAI, Anthropic), databases, and external services.

### 4. **Extensible**
Clear extension points for custom nodes, tools, and integrations.

### 5. **Scalable**
Designed for concurrent executions, long-running workflows, and future distributed execution.

---

## System Layers

### 1. Presentation Layer
- **Technology**: React, TanStack Router, TanStack Query
- **Responsibilities**: Visual workflow editor, run history, node configuration
- **Location**: `src/components/`, `src/routes/`

### 2. API Layer
- **Technology**: Hono (Express alternative)
- **Responsibilities**: HTTP endpoints, SSE streaming, authentication, validation
- **Location**: `src/server/routes/`

### 3. Execution Layer
- **Technology**: TypeScript, LangGraph, LangChain
- **Responsibilities**: Workflow orchestration, node execution, agent loops, state management
- **Location**: `src/server/execution/`, `src/server/agents/`

### 4. Node Layer
- **Technology**: Custom node implementations
- **Responsibilities**: Business logic, external API integration, data transformation
- **Location**: `src/server/nodes/`

### 5. Storage Layer
- **Technology**: Postgres, Drizzle ORM
- **Responsibilities**: Workflow definitions, execution history, credentials, state
- **Location**: `src/server/db/`

---

## Data Flow Example

```
User creates workflow in UI
  ↓
POST /api/workflows
  ↓
Store definition in Postgres
  ↓
User clicks "Execute"
  ↓
POST /api/workflows/:id/execute
  ↓
WorkflowOrchestrator.orchestrate()
  ↓
Topological sort → [node1, node2, agent, node4]
  ↓
Execute node1 → store output in state
  ↓
Execute node2 → uses node1 output → store output
  ↓
Execute agent:
  - Agent plans action → EngineRequest
  - Execute tools → EngineResponse
  - Agent resumes → final output
  ↓
Execute node4 → store output
  ↓
Return OrchestrationResult
  ↓
Store run history in Postgres
  ↓
Return result to UI (SSE streaming)
  ↓
User views run history with full trace
```

---

## Core Abstractions

### Workflow
A directed acyclic graph (DAG) of nodes with typed inputs/outputs.

**Storage**: JSON in Postgres
**Format**:
```typescript
{
  nodes: { [id]: { type, position, data: { inputs, properties } } },
  edges: [{ source, target, sourceHandle, targetHandle }],
  viewport: { x, y, zoom }
}
```

### Node
A reusable execution unit with a declarative schema.

**Interface**:
```typescript
interface INodeType {
  description: INodeTypeDescription;
  execute(context: ExecutionContext): Promise<NodeExecutionData[][]>;
}
```

### ExecutionContext
Everything a node needs to execute: inputs, parameters, credentials, state.

**Key Fields**:
- `inputs` - Data from connected nodes
- `evaluatedProperties` - Resolved configuration
- `credentials` - Decrypted secrets
- `signal` - For cancellation

### Agent
A special node that can iteratively call tools until reaching an answer.

**Pattern**:
```typescript
Agent.execute(context) => EngineRequest | NodeExecutionData[][]
```

### Tool
A function that agents can call with validated inputs and enforced quotas.

**Interface**:
```typescript
interface AgentTool {
  name: ToolName;
  inputSchema: ZodSchema;
  execute: (context, input) => Promise<output>;
}
```

---

## Execution Model

### Synchronous Nodes
Most nodes execute synchronously in topological order:
1. Prepare inputs from previous nodes
2. Create ExecutionContext
3. Call node.execute(context)
4. Store outputs for next nodes

### Asynchronous Agents
Agents execute in an iterative loop:
1. Agent plans action → EngineRequest
2. Orchestrator executes tools → EngineResponse
3. Agent resumes with results
4. Repeat until final answer

This keeps agents **traceable** (every tool call is recorded) and **controllable** (quotas enforced).

---

## Security Model

### Credentials
- Encrypted at rest (AES-256)
- Decrypted per-execution
- Never exposed to client

### Sandboxing (Future)
- Custom code runs in isolated VMs
- Network restrictions
- Filesystem restrictions

### Validation
- Zod schemas for all inputs
- Type checking at compile time
- Runtime validation at execution

---

## Performance Characteristics

### Current (P0)
- **Throughput**: ~10 workflows/second (single worker)
- **Latency**: Dominated by LLM calls (1-5s per agent iteration)
- **Concurrency**: Limited by Node.js event loop

### Target (P2)
- **Throughput**: 100+ workflows/second (distributed workers)
- **Latency**: < 500ms (p95) excluding LLM calls
- **Concurrency**: 1000+ concurrent executions

### Optimizations Planned
- Parallel node execution (independent nodes run concurrently)
- LLM response streaming
- Connection pooling for external APIs
- Execution result caching

---

## Evolution Path

### Phase 1: P0 Foundation ✅
Core orchestration, basic agent support, type safety

### Phase 2: Enhanced Execution
Expression evaluation, multi-run support, better error handling

### Phase 3: Advanced Features
Branching, parallel execution, streaming, memory

### Phase 4: Production Hardening
Distributed execution, persistence, observability, security

---

## Related Documentation

- [P0_CHARTER.md](../P0_CHARTER.md) - Mission and success criteria
- [Execution Engine](./EXECUTION_ENGINE.md) - Detailed execution architecture
- [Agents Documentation](../agents/README.md) - Agent-specific details
- [API Documentation](../api/README.md) - API endpoints and usage

---

## Quick Links

- **Want to understand execution?** → [EXECUTION_ENGINE.md](./EXECUTION_ENGINE.md)
- **Want to create a node?** → `../nodes/CREATING_NODES.md` (coming soon)
- **Want to debug a workflow?** → `../workflows/DEBUGGING.md` (coming soon)
- **Want to understand agents?** → [../agents/README.md](../agents/README.md)

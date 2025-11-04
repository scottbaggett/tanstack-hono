# Workflow Builder Documentation

## Start Here

👉 **[P0_CHARTER.md](./P0_CHARTER.md)** - Mission, principles, and success criteria
👉 **[INDEX.md](./INDEX.md)** - Navigation and quick reference

## Core Documents

### 🏗️ Architecture

**[architecture/EXECUTION_ENGINE.md](./architecture/EXECUTION_ENGINE.md)** ⭐
**The heart of the platform.** Deep dive into workflow execution, agent loops, state management, and core execution architecture.

**Read this to understand**:
- How workflows execute end-to-end
- How agents iteratively call tools (EngineRequest/Response pattern)
- State management and error handling
- Performance and security considerations

**[architecture/README.md](./architecture/README.md)**
High-level system architecture overview, layers, and core abstractions.

### 🤖 Agents

**[agents/TRACEABILITY_REQUIREMENTS.md](./agents/TRACEABILITY_REQUIREMENTS.md)** ⚠️ **CRITICAL**
**Non-negotiable requirements for agent transparency and debuggability.** Addresses the "Inception Problem" - how to make the agent's internal loop visible and debuggable. Must read before implementing agent features.

**[agents/EXECUTION_LOOP_COMPLETE.md](./agents/EXECUTION_LOOP_COMPLETE.md)**
Complete documentation of the agent execution loop implementation.

**[agents/EXECUTION_CONTEXT.md](./agents/EXECUTION_CONTEXT.md)**
Deep dive into ExecutionContext architecture and comparison with n8n.

**[agents/TESTING_STRATEGY.md](./agents/TESTING_STRATEGY.md)**
Comprehensive test plan for agent execution (unit, integration, E2E).

**[agents/IMPLEMENTATION_PLAN.md](./agents/IMPLEMENTATION_PLAN.md)**
Roadmap for agent features (P0 → P3).

---

### [ARCHITECTURE.md](./ARCHITECTURE.md)
System design, component overview, data flow, and design decisions.

**Read this to understand**:
- How the workflow builder works end-to-end
- Component responsibilities
- Execution flow
- Design rationale

### [DATATYPES.md](./DATATYPES.md)
Rich data type system supporting 20+ types beyond JSON.

**Read this when**:
- Working with images, CSV, PDB, or binary data
- Building nodes that handle multiple data types
- Implementing serialization for custom types

### [DYNAMIC_IO.md](./DYNAMIC_IO.md)
Dynamic inputs and outputs using `{{variable}}` syntax.

**Read this when**:
- Creating flexible, template-based nodes
- Using {{variable}} placeholders in node config
- Building dynamic workflows

### [EXECUTION_CONTEXT.md](./EXECUTION_CONTEXT.md)
Three-layer execution context API (Core, Primitives, LangChain).

**Read this when**:
- Building a new node
- Understanding what capabilities are available
- Working with LangChain, HTTP, or sandboxed code

## Developer Guides

### [DEVELOPMENT.md](./DEVELOPMENT.md)
Setup instructions, development workflow, and how to create nodes.

**Read this to**:
- Set up your development environment
- Create and register new nodes
- Work with dynamic inputs/outputs
- Use the execution context
- Debug and test your code

### [API.md](./API.md)
REST API reference for workflow CRUD, execution, and streaming.

**Read this to**:
- Understand all available endpoints
- Execute workflows programmatically
- Stream execution events
- Handle errors

## Architectural Decisions

These documents capture critical design choices:

1. **LangChain as the execution engine** - Nodes use LangChain directly
2. **TypedValue system** - Rich data types with explicit type information
3. **{{variable}} templates** - Automatic input discovery from config
4. **Event-based streaming** - Real-time updates and execution replay
5. **Topological sort** - Dependency-based node execution

## Repository Structure

```
docs/
├── README.md           # This file
├── INDEX.md            # Navigation index
├── ARCHITECTURE.md     # System design
├── DATATYPES.md        # Data type system
└── DYNAMIC_IO.md       # Variable template system
```

## Key Source Files

| File | Purpose |
|------|---------|
| `src/server/nodes/Node.ts` | Base node class and registry |
| `src/types/execution.ts` | Execution context interfaces |
| `src/types/datatypes.ts` | Data type system |
| `src/server/execution/WorkflowOrchestrator.ts` | Graph execution engine |
| `src/server/execution/InputResolver.ts` | Variable resolution |
| `src/server/execution/DataTypeHandler.ts` | Type utilities |
| `src/server/db/schema.ts` | Database models |

## Common Tasks

### Create a new node
1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for node system overview
2. Look at examples in `src/server/nodes/examples/`
3. Extend `Node` class and register with `NodeLoader`

### Work with dynamic inputs
1. Read [DYNAMIC_IO.md](./DYNAMIC_IO.md)
2. Use `{{variable}}` in node configuration
3. Access values from `context.getInputData()`

### Handle binary data
1. Read [DATATYPES.md](./DATATYPES.md)
2. Use appropriate `DataTypeId` in node inputs/outputs
3. Use `DataTypeHandler` utilities for serialization

## Philosophy

**Tight and Organized**:
- Each document focuses on a single architectural concept
- Cross-references for navigation
- Concise, practical content
- Examples for every pattern

**TypeScript-First**:
- Full type coverage throughout
- Type safety enables confidence
- Types serve as documentation

**LangChain-Powered**:
- Nodes use LangChain directly
- No request/response abstraction
- Streaming support built-in

## Questions?

Refer to the relevant document above, or check the example nodes in `src/server/nodes/examples/`.

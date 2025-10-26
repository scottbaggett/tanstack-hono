# Documentation Index

## Core Documentation

### [ARCHITECTURE.md](./ARCHITECTURE.md)
System design and high-level overview.

**Covers**:
- Component overview
- Data flow diagrams
- Design decisions
- Extension points
- Performance considerations

**For**: Understanding how everything fits together

---

### [DATATYPES.md](./DATATYPES.md)
Rich data type system supporting 20+ types.

**Covers**:
- Supported types (primitives, structured, binary, media)
- TypedValue format
- Serialization/deserialization
- API reference
- Examples

**For**: Working with images, CSV, PDB, and other non-JSON data

---

### [DYNAMIC_IO.md](./DYNAMIC_IO.md)
Dynamic inputs and outputs using {{variable}} syntax.

**Covers**:
- {{variable}} placeholders
- Automatic input/output discovery
- Implementation patterns
- Validation
- Examples

**For**: Creating flexible, template-based nodes

---

## Getting Started

1. **New to the project?** Start with [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Setting up locally?** Follow [DEVELOPMENT.md](./DEVELOPMENT.md)
3. **Building a node?** Check [DEVELOPMENT.md](./DEVELOPMENT.md), [EXECUTION_CONTEXT.md](./EXECUTION_CONTEXT.md), [DYNAMIC_IO.md](./DYNAMIC_IO.md), and [DATATYPES.md](./DATATYPES.md)
4. **Using the API?** See [API.md](./API.md)
5. **Implementing features?** Review relevant sections in ARCHITECTURE.md

## Quick Reference

### Key Concepts

- **Node**: Processing unit that extends the `Node` base class
- **Workflow**: Directed acyclic graph (DAG) of connected nodes
- **TypedValue**: Data with explicit type information
- **{{variable}}**: Placeholder that becomes dynamic input
- **StreamEvent**: Real-time event emitted during execution

### Key Files

| File | Purpose |
|------|---------|
| `src/server/nodes/Node.ts` | Base node class and registry |
| `src/types/execution.ts` | Execution context interfaces |
| `src/types/datatypes.ts` | Data type definitions |
| `src/server/execution/WorkflowOrchestrator.ts` | Graph execution engine |
| `src/server/execution/InputResolver.ts` | Variable resolution |
| `src/server/execution/DataTypeHandler.ts` | Type serialization |
| `src/server/db/schema.ts` | Database models |

### Common Tasks

**Create a new node**:
1. Extend `Node` class
2. Implement `description` and `execute()`
3. Register with `NodeLoader`

See `src/server/nodes/examples/` for examples.

**Use {{variable}} inputs**:
1. Add `{{varName}}` to node config
2. Variables auto-expose as inputs
3. Get values from `context.getInputData()`

See [DYNAMIC_IO.md](./DYNAMIC_IO.md).

**Handle binary data**:
1. Declare input/output types (e.g., `image:png`)
2. Use `DataTypeHandler` utilities
3. Serialize properly for storage

See [DATATYPES.md](./DATATYPES.md).

## Architecture Decisions

These documents capture critical architectural decisions:

- **Monorepo structure**: Frontend and backend in single codebase with shared types
- **Layered execution context**: Core, Primitives, and LangChain layers for flexibility
- **LangChain as primary AI engine**: Nodes use LangChain directly when needed
- **Platform primitives**: HTTP, sandboxed code execution, file I/O for non-LangChain nodes
- **TypedValue system**: Rich data type support with explicit type information
- **{{variable}} templates**: Automatic input discovery from node configuration
- **Event-based streaming**: Real-time updates and execution replay capability
- **Topological sort execution**: Dependency-based node ordering
- **InputResolver pattern**: Unified resolution of edges and variable placeholders

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete design rationale.

## See Also

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Full architecture document (root)
- GitHub repository
- Source code examples in `src/server/nodes/examples/`

## Project Context

We are building a **TanStack-Hono workflow automation platform** with AI agent capabilities, inspired by n8n's architecture.

# Docs (Must Read)
- See @docs/READMME

### Current Phase: Agent System Implementation (P0+)

**Status**:
- ✅ P0 Foundation Complete (LangGraph-based agent system)
- ✅ Real LangChain model integration
- ✅ Tool registration on startup
- 🔄 Working on: Execution engine loop

### Key Architecture Decisions

1. **Agent Pattern**: Request-response loop (n8n-inspired)
   - Agent returns `EngineRequest` with tool calls
   - Engine executes tools with quotas/timeouts
   - Agent resumes with `EngineResponse`
   - Iterates until final answer or max iterations

2. **LangGraph State Management**:
   - No custom iteration loops (LangGraph handles this)
   - State machine with conditional routing
   - Built-in halting rules (max iterations, no-progress detection)

3. **Type-Safe Tools**:
   - Zod schemas for input/output validation
   - Deterministic IDs: `hash(executionId + nodeId + iteration + index)`
   - Timeout and size quotas per tool

4. **Observability**:
   - Structured `AgentEvent` emission
   - Supports LangSmith integration

### Files Structure

```
src/server/
├── types/agent.ts              # Core type system (EngineRequest/Response)
├── tools/                      # Agent tools (calculator, search)
├── agents/graph.ts             # LangGraph state machine
├── execution/requestHandler.ts # Tool execution with quotas
├── observability/events.ts     # Event system
├── utils/
│   ├── ids.ts                 # Deterministic ID generation
│   └── langchain.ts           # Model/tool extraction utilities
└── nodes/agent/execute.ts      # Agent node execution
```

### Documentation

See `docs/agents/` for full implementation plan and status.

### Development Rules

- We are EARLY in build, do not worry about backward compatibility!
- Don't commit your work until you are asked.
- Tool registration happens in `src/server/nodes/load.ts`
- All tools must have Zod schemas for validation

### Type System & Naming Conventions

**Interface Naming:**
- All interfaces MUST be prefixed with `I` (e.g., `IWorkflowDefinition`, `INodeType`)
- All type aliases MUST be prefixed with `I` (e.g., `INodeExecutionStatus`, `IWorkflowRunStatus`)
- This applies to ALL types defined in `src/types/interfaces.ts`
- Exceptions: Zod-inferred types in API schemas (e.g., `WorkflowRun` from `WorkflowRunSchema`)

**Type Consistency:**
- Define core types ONCE in `src/types/interfaces.ts` with the `I` prefix
- Use these types consistently across database schema, orchestrator, and UI
- Database status fields MUST use the exact string literals from type definitions
- Never use similar-but-different values (e.g., don't use "success" when type defines "completed")

**Status Type Rules:**
- Node execution status: Use `INodeExecutionStatus` type
- Workflow run status: Use `IWorkflowRunStatus` type
- Both are defined in `src/types/interfaces.ts`
- Status mappings should NOT be needed if types are used correctly everywhere

### Testing Guidelines

- **Use Vitest** for all new tests (project standard)
- **Test location**: Place tests in `__tests__/` directories next to source files
- **Test structure**: Use `describe/it/expect` pattern from Vitest
- **Test naming**: Name files `*.test.ts` (not `test-*.ts`)
- **Manual test files**: Convert root-level `test-*.ts` files to proper Vitest tests
- **Run tests**: Use `npm test` to run Vitest, `npm run test:ui` for watch mode
- **Coverage**: Aim for test coverage on core utilities and business logic

#### Test File Organization
```
src/server/lib/
├── crypto.ts
├── expressions.ts
└── __tests__/
    ├── credentials.test.ts
    └── expressions.test.ts
```

#### Test Patterns
- **Unit tests**: Test individual functions in isolation
- **Integration tests**: Test component interactions
- **Error cases**: Always test failure scenarios
- **Edge cases**: Test boundary conditions and invalid inputs
- **Security tests**: For encryption/auth, test wrong keys, tampered data
- this project uses PNPM not NPM!
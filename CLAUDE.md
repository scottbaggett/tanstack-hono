## Project Context

We are building a **TanStack-Hono workflow automation platform** with AI agent capabilities, inspired by n8n's architecture.

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

- We are EARLY in the build, do not worry about backward compatibility!
- Don't commit your work until you are asked.
- Tool registration happens in `src/server/nodes/load.ts`
- All tools must have Zod schemas for validation
# Agent System Documentation

LangGraph-based AI agent implementation for TanStack-Hono platform.

---

## Quick Start

**Current Status**: P0 Complete ✅ (Foundation ready, needs model integration)

See [P0_COMPLETE.md](./P0_COMPLETE.md) for full status and next steps.

---

## Documents

### Implementation
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Complete implementation roadmap (P0-P3)
- **[P0_COMPLETE.md](./P0_COMPLETE.md)** - P0 completion status and next steps ⭐ **START HERE**

### Reference
- **[P0_SETUP.md](./P0_SETUP.md)** - File-by-file P0 setup guide
- **[P0_SUMMARY.md](./P0_SUMMARY.md)** - P0 overview and quick reference
- **[P0_FIXES.md](./P0_FIXES.md)** - TypeScript fixes applied (archived)

---

## Architecture Overview

### Core Components

```
Agent System
├── Types (agent.ts)           - Type system with EngineRequest/Response
├── Tools (calculator, search) - Zod-validated tool implementations
├── Utils (ids.ts)             - Deterministic ID generation
├── Observability (events.ts)  - Structured event emission
├── Execution (requestHandler) - Tool execution with quotas
├── Agents (graph.ts)          - LangGraph state machine
└── Nodes (agent/execute.ts)   - Agent node execution
```

### Key Patterns

1. **Request-Response Loop**: Agent ↔ Engine communication via EngineRequest/Response
2. **Deterministic IDs**: Idempotent retries via hash(executionId + nodeId + iteration + index)
3. **Type-Safe Tools**: Zod schemas for input/output validation
4. **LangGraph State**: Iteration control, routing, halting rules
5. **Structured Events**: Unified observability with AgentEvent schema

---

## Files Created (P0)

### Core Infrastructure
| File | Lines | Purpose |
|------|-------|---------|
| `src/server/types/agent.ts` | 369 | Type system |
| `src/server/tools/calculator.ts` | 150 | Math tool |
| `src/server/tools/search.ts` | 206 | Search tool |
| `src/server/utils/ids.ts` | 154 | ID generation |
| `src/server/observability/events.ts` | 262 | Event system |
| `src/server/execution/requestHandler.ts` | 273 | Tool execution |
| `src/server/agents/graph.ts` | 250 | LangGraph |
| `src/server/nodes/agent/execute.ts` | 196 | Agent execution |
| **Total** | **1,860** | **P0 Complete** |

---

## Current Status

### ✅ Completed (P0)
- Type system with EngineRequest/Response
- Two example tools (calculator, search)
- Deterministic ID generation
- Event emission system
- Tool execution handler with quotas
- LangGraph state machine
- Agent node integration
- TypeScript compilation verified
- Dependencies installed

### 🔧 TODO (Next Steps)
- Real LangChain model integration (ChatOpenAI, etc.)
- Tool registry population on startup
- Execution engine loop
- Unit tests
- Demo workflow

---

## Quick Commands

```bash
# Verify compilation
pnpm exec tsc --noEmit --skipLibCheck

# Run tests (when created)
pnpm test src/server/__tests__/agent

# Format code
pnpm biome format --write src/server/{types,tools,utils,observability,execution,agents,nodes}/agent*
```

---

## Dependencies

```json
{
  "@langchain/langgraph": "0.2.74",
  "@langchain/core": "^0.3.0",
  "@langchain/openai": "^0.3.0",
  "zod": "3.25.76"
}
```

---

## Next Session

Choose one:

### A. Wire Up Real Models (1-2 hours)
```bash
touch src/server/utils/langchain.ts
# Implement: getChatModel(), getTools(), getMemory()
```

### B. Add Unit Tests (1-2 hours)
```bash
mkdir -p src/server/__tests__/agent
# Test: IDs, tools, events
```

### C. Execution Engine (2-3 hours)
```bash
touch src/server/execution/workflowExecute.ts
# Implement: main loop, EngineRequest handling
```

---

## Resources

- **n8n Agent Docs**: Reference implementation
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **LangChain Docs**: https://js.langchain.com/docs/

---

**Status**: Foundation complete, ready for integration! 🚀

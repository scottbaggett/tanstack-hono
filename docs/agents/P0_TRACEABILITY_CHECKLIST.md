# P0 Agent Traceability Checklist

**Quick reference for implementing non-negotiable traceability requirements**

📖 Full details: [TRACEABILITY_REQUIREMENTS.md](./TRACEABILITY_REQUIREMENTS.md)

---

## ✅ Database Schema

- [ ] Add `internalTrace` JSONB column to `node_executions` table
- [ ] Create `InternalTraceData` type with `steps`, `iterationCount`, `finalState`
- [ ] Create `InternalStep` type with `iteration`, `timestamp`, `type`, tool data
- [ ] Run migration to add column

**File**: `src/server/db/schema.ts`

---

## ✅ Agent Loop Collection

- [ ] Create `agentExecutionSteps: InternalStep[]` array in WorkflowOrchestrator
- [ ] On each agent iteration, collect:
  - Agent planning step (`agent.plan` event)
  - Tool call step (`tool.start` event)
  - Tool result step (`tool.success` or `tool.error` event)
- [ ] On agent finish, create final `agent_finish` step
- [ ] Pass `agentExecutionSteps` to `NodeExecutionResult.internalTrace`

**File**: `src/server/execution/WorkflowOrchestrator.ts:249-281`

---

## ✅ Memory Scoping

- [ ] Add `private conversationMemory?: BaseChatMemory` to WorkflowOrchestrator
- [ ] Implement `initializeMemoryIfNeeded()` method
- [ ] Check if any agent has memory input connected
- [ ] Create `BufferMemory` instance if needed
- [ ] Pass memory to agent via ExecutionContext
- [ ] Memory lifecycle: created at run start, destroyed at run end

**File**: `src/server/execution/WorkflowOrchestrator.ts:91-102`

---

## ✅ Event Emitter Integration

- [ ] Ensure `createEventEmitter()` is called in `executeAgent()`
- [ ] Emit `agent.plan` when agent returns tool calls
- [ ] Emit `tool.start` when tool execution begins
- [ ] Emit `tool.success` when tool completes
- [ ] Emit `tool.error` when tool fails
- [ ] Emit `agent.finish` when agent returns final answer
- [ ] Pass emitter to `handleEngineRequest()` via options

**File**: `src/server/nodes/agent/execute.ts:76-156`

---

## ✅ Persistence

- [ ] When agent execution completes, build `InternalTraceData` from collected steps
- [ ] Store in `NodeExecutionResult.internalTrace`
- [ ] Ensure `nodeResults.set()` includes `internalTrace` field
- [ ] Verify data is saved to database via Drizzle

**File**: `src/server/execution/WorkflowOrchestrator.ts:299-310`

---

## 🎯 Testing Checklist

- [ ] **Unit Test**: Verify `InternalStep` collection during agent loop
- [ ] **Unit Test**: Verify `InternalTraceData` is built correctly
- [ ] **Integration Test**: Run agent with 2 tool calls, verify trace persisted
- [ ] **Integration Test**: Run agent that hits max iterations, verify halt reason
- [ ] **E2E Test**: Execute workflow with agent, query database for `internalTrace`
- [ ] **E2E Test**: Verify trace includes all iterations and tool calls

---

## 📊 Success Criteria

### Traceability Task (< 2 minutes)
- [ ] Run workflow with agent node
- [ ] Open run history
- [ ] Click on agent node
- [ ] Verify can see all tool calls, inputs, outputs
- [ ] Verify can see agent reasoning at each step

### Debugging Task (< 5 minutes)
- [ ] Create agent that fails on 3rd tool call
- [ ] Run workflow
- [ ] Open run history
- [ ] Click on agent node
- [ ] Identify which tool call failed in < 5 minutes

---

## 🚫 P0 Out of Scope (Don't Implement Yet)

- ❌ UI component (`InternalStepsViewer`) - P1
- ❌ SSE streaming endpoint - P1
- ❌ Real-time frontend updates - P1
- ❌ Memory persistence - P2
- ❌ Thread-scoped memory - P2
- ❌ Replay mode - P2

---

## 📝 Quick Implementation Order

1. **Database schema** (5 min) - Add `internalTrace` column
2. **Type definitions** (10 min) - `InternalTraceData`, `InternalStep`
3. **Memory scoping** (15 min) - Initialize memory in orchestrator
4. **Step collection** (30 min) - Collect steps during agent loop
5. **Persistence** (10 min) - Store trace in database
6. **Testing** (60 min) - Verify with unit/integration tests

**Total**: ~2 hours of focused implementation

---

**Status**: Ready for implementation
**Priority**: P0 (Critical - blocks production)
**Dependencies**: None (all infrastructure is in place)

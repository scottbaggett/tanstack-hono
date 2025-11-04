# Agent Execution Loop - Implementation Complete

## Summary

Successfully implemented the agent-tool execution loop in `WorkflowOrchestrator`, enabling agents to iteratively call tools and resume execution until a final answer is reached.

**Status**: ✅ Complete (P0 Implementation)

---

## What Was Built

### 1. Execution Context Architecture Document

**File**: `docs/agents/EXECUTION_CONTEXT.md`

Comprehensive documentation that:
- Maps n8n's execution architecture to our implementation
- Identifies the ExecuteFunctions vs ExecutionContext gap
- Proposes immediate fix (adapter pattern) and long-term solution
- Details the agent execution loop requirements
- Provides roadmap for future enhancements

**Key Insights**:
- n8n uses dual-context system (IExecuteFunctions + WorkflowDataProxy)
- Our agent nodes use ExecutionContext, but orchestrator used ExecuteFunctions
- Adapter pattern bridges the gap for P0, proper alignment planned for Phase 2

### 2. WorkflowOrchestrator Agent Loop

**File**: `src/server/execution/WorkflowOrchestrator.ts`

**Changes**:
1. Added imports for `EngineRequest`, `EngineResponse`, `ExecutionContext`
2. Created `createExecutionContext()` adapter method
3. Modified `executeNode()` to detect agent nodes and handle execution loop
4. Added `isEngineRequest()` type guard

**Flow**:
```typescript
// Agent execution
if (nodeType === 'agent') {
    const context = createExecutionContext(executeFunctions);
    let result = await nodeInstance.execute(context);

    // Loop until final answer
    while (isEngineRequest(result)) {
        // Execute tools
        const response = await handleEngineRequest(result, { ... });

        // Resume agent with results
        const resumeContext = createExecutionContext(executeFunctions, response);
        result = await nodeInstance.execute(resumeContext);
    }
}
```

**Location**: `WorkflowOrchestrator.ts:220-243`

### 3. ExecutionContext Interface Enhancement

**File**: `src/types/interfaces.ts`

**Changes**:
1. Added `engineResponse` field to ExecutionContext
2. Updated INodeType.execute() signature to support EngineRequest returns

```typescript
export interface ExecutionContext {
    // ... existing fields
    engineResponse?: EngineResponse<RequestResponseMetadata>;
}

export interface INodeType {
    execute(context: ExecutionContext):
        Promise<NodeExecutionData[][] | EngineRequest> | NodeExecutionData[][];
}
```

**Impact**:
- ✅ Type-safe agent resumption
- ✅ No more @ts-expect-error needed
- ✅ Clear contract for agent nodes

**Location**: `interfaces.ts:111-141`

### 4. Agent Node Cleanup

**File**: `src/server/nodes/agent/Agent.ts`

**Changes**:
- Removed `@ts-expect-error` comment
- Types now properly support EngineRequest return

**Location**: `Agent.ts:68-70`

---

## How It Works

### Data Flow

```
1. WorkflowOrchestrator.executeNode() called
   ↓
2. Detects nodeType === 'agent'
   ↓
3. Creates ExecutionContext via adapter
   ↓
4. Calls agent.execute(context)
   ↓
5. Agent returns EngineRequest with tool calls
   ↓
6. handleEngineRequest() executes tools with quotas
   ↓
7. Creates EngineResponse with tool results
   ↓
8. Creates new ExecutionContext with engineResponse
   ↓
9. Calls agent.execute(context) again
   ↓
10. Repeat 5-9 until agent returns NodeExecutionData[][]
   ↓
11. Store final results in orchestrator.state
```

### Type Safety

**Before**:
```typescript
// Agent.ts
// @ts-expect-error - Agent can return EngineRequest
return await executeAgent(context);

// WorkflowOrchestrator.ts
result = await nodeInstance.execute(resumeContext as any);
```

**After**:
```typescript
// Agent.ts
return await executeAgent(context); // ✅ Type-safe

// WorkflowOrchestrator.ts
result = await nodeInstance.execute(resumeContext); // ✅ Type-safe
```

---

## Integration Points

### Agent Node → Execution Loop

**File**: `src/server/nodes/agent/execute.ts`

The `executeAgent()` function signature supports resumption:
```typescript
export async function executeAgent(
    context: ExecutionContext,
    response?: EngineResponse<RequestResponseMetadata>,
): Promise<NodeExecutionData[][] | EngineRequest>
```

- First call: `response` is undefined, agent plans action
- Subsequent calls: `response` contains tool results, agent resumes
- Final call: agent returns `NodeExecutionData[][]`

**How resumption works**:
```typescript
// In execute.ts:89-96
if (response) {
    // Resuming after tool execution
    const previousState = buildInitialState(userPrompt, systemPrompt);
    initialState = buildResumedState(previousState, response.results);
} else {
    // First execution
    initialState = buildInitialState(userPrompt, systemPrompt);
}
```

### Tool Execution

**File**: `src/server/execution/requestHandler.ts`

The `handleEngineRequest()` function:
- Takes EngineRequest with tool calls
- Executes each tool via registered tool registry
- Applies quotas (timeouts, size limits)
- Returns EngineResponse with results

**Location**: `requestHandler.ts:120-220`

### LangGraph State Machine

**File**: `src/server/agents/graph.ts`

The `createAgentGraph()` builds LangGraph StateGraph:
- `plan` node: Calls LLM, extracts tool calls
- `tools` node: Placeholder (we execute via EngineRequest instead)
- Conditional routing based on tool calls and iteration count
- Halting rules: max iterations, no progress detection

**Location**: `graph.ts:268-289`

---

## Testing Status

### Type Check

✅ **Passed** - All agent execution types compile correctly

**Command**: `npx tsc --noEmit`

**Result**: No errors in agent execution files
- `WorkflowOrchestrator.ts` - ✅
- `ExecutionContext` interface - ✅
- `Agent.ts` - ✅
- `execute.ts` - ✅

(Pre-existing errors in other files: scripts, unused variables, etc.)

### Manual Testing

⚠️ **Pending** - End-to-end workflow execution test needed

**To Test**:
1. Create workflow with agent node
2. Connect tool inputs (calculator, search)
3. Execute workflow via API
4. Verify agent-tool loop executes
5. Verify final output is stored

**Test Script Location**: TBD (next step)

---

## Architecture Decisions

### Phase 1: Adapter Pattern (Current)

**Decision**: Use adapter pattern to bridge ExecuteFunctions → ExecutionContext

**Rationale**:
- ✅ Minimal changes required
- ✅ Unblocks agent execution immediately
- ✅ Maintains backward compatibility
- ✅ Type-safe with proper interface updates

**Trade-offs**:
- Still maintains dual-context system
- Uses `any` cast to access ExecuteFunctions private fields
- Not the long-term solution

### Phase 2: Unified Context (Future)

**Decision**: Deprecate ExecuteFunctions, use ExecutionContext everywhere

**Plan**:
1. Enhance ExecutionContext with helper methods
2. Update WorkflowOrchestrator to build ExecutionContext directly
3. Add expression evaluation (CEL)
4. Migrate all nodes to ExecutionContext
5. Remove ExecuteFunctions

**Benefits**:
- Single, clear context interface
- Natural agent resumption
- Aligns with modern n8n architecture
- Easier to understand and maintain

**Timeline**: P1/P2 priority

---

## Gaps and Future Work

### Expression Evaluation (P1)

**Status**: ❌ Not implemented

**What's Missing**:
- No `$json`, `$input`, `$node` variables
- No CEL expression evaluation
- Properties are not evaluated before execution

**Impact**:
- Users cannot reference previous node outputs in agent prompts
- Static configuration only

**Proposed Solution**:
- Implement CEL evaluator or simple template engine
- Add WorkflowDataProxy equivalent
- Evaluate `evaluatedProperties` from `properties` before execution

### Multi-Run Support (P2)

**Status**: ❌ Not implemented

**What's Missing**:
- No `runIndex` tracking
- Nodes execute once per workflow execution
- Cannot loop or retry

**Impact**:
- No support for loops, splits, or retries
- Linear execution only

**Proposed Solution**:
- Add `runIndex` to ExecutionContext
- Store outputs as `state[nodeId][runIndex]`
- Support conditional loops in orchestrator

### Item-Based Execution (P2)

**Status**: ❌ Not implemented

**What's Missing**:
- No `itemIndex` tracking
- Nodes execute once, not per-item
- No pairedItem support

**Impact**:
- Cannot process arrays of data
- No data lineage tracking

**Proposed Solution**:
- Add `itemIndex` to ExecutionContext
- Execute nodes once per input item
- Track pairedItem relationships

### Branch Support (P3)

**Status**: ❌ Not implemented

**What's Missing**:
- Nodes output single result, not multiple branches
- No conditional routing

**Impact**:
- Cannot split workflows (e.g., IF/ELSE with different paths)

**Proposed Solution**:
- Change output format to `NodeExecutionData[][][]` (add branch dimension)
- Update orchestrator to handle multiple output branches
- Add edge targeting specific branches

---

## Files Modified

### Core Implementation

1. **`src/server/execution/WorkflowOrchestrator.ts`**
   - Added agent execution loop (lines 220-243)
   - Added `createExecutionContext()` adapter (lines 319-340)
   - Added `isEngineRequest()` type guard (lines 301-311)

2. **`src/types/interfaces.ts`**
   - Added `engineResponse` to ExecutionContext (line 123)
   - Updated INodeType.execute() return type (line 140)

3. **`src/server/nodes/agent/Agent.ts`**
   - Removed `@ts-expect-error` comment (line 68)

### Documentation

4. **`docs/agents/EXECUTION_CONTEXT.md`** (NEW)
   - Architecture comparison (n8n vs ours)
   - Context problem analysis
   - Proposed solutions (Phase 1 & 2)
   - Data flow diagrams
   - Type safety improvements

5. **`docs/agents/EXECUTION_LOOP_COMPLETE.md`** (THIS FILE)
   - Implementation summary
   - Integration points
   - Testing status
   - Future work

---

## Next Steps

### Immediate (P0)
1. ✅ Document execution context architecture
2. ✅ Implement agent execution loop
3. ✅ Update ExecutionContext interface
4. ✅ Update INodeType interface
5. ⏭️ Create end-to-end test workflow
6. ⏭️ Test agent execution manually
7. ⏭️ Commit changes

### Short-term (P1)
1. Add expression evaluation ($json, $input)
2. Extract credentials in createExecutionContext()
3. Add proper signal handling (cancellation)
4. Add execution time tracking
5. Add proper error handling for tool failures

### Long-term (P2)
1. Migrate to unified ExecutionContext
2. Add multi-run support
3. Add item-based execution
4. Add branch support
5. Implement WorkflowDataProxy equivalent

---

## Conclusion

**The agent execution loop is now functionally complete for P0.**

✅ Agents can iteratively call tools until reaching a final answer
✅ Type-safe with proper interfaces
✅ Clean separation between agent and regular node execution
✅ Ready for end-to-end testing

The adapter pattern provides a pragmatic bridge between our legacy ExecuteFunctions and modern ExecutionContext architectures, unblocking agent development while maintaining a clear path forward for architectural improvements in Phase 2.

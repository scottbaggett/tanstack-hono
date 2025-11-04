# Agent Traceability & Debuggability Requirements

**Critical Feedback from Founder Review** (2025-11-04)

## 🎯 The Core Problem: "Inception" - Workflow Within a Workflow

The Agent Node creates a powerful but dangerous pattern: **a workflow within a workflow**.

```
Canvas View (User Sees):
[Trigger] → [Agent Node] → [Output]

Reality (What Actually Happens):
[Trigger] → [Agent Loop:
              Step 1: Agent thinks → calls Tool A
              Step 2: Tool A executes → returns result
              Step 3: Agent thinks → calls Tool B
              Step 4: Tool B executes → returns result
              Step 5: Agent thinks → returns final answer
            ] → [Output]
```

**The Danger**: If we only show one `NodeExecution` entry for the Agent Node, we've created a "black box" that violates our P0 Charter dealbreakers.

---

## 🚨 P0 Charter Violations We Must Prevent

### Violation 1: Lost Traceability
**Problem**: User sees one node execution, but 5+ operations happened inside.
**Impact**: Cannot audit what the agent did, why it chose certain tools, or what data was passed.
**Charter Violation**: "Users MUST be able to see each tool call the agent planned"

### Violation 2: Impossible Debugging
**Problem**: Agent gets stuck in a loop or Tool B fails - user has no visibility.
**Impact**: Domain expert cannot diagnose issues in < 5 minutes (our success metric).
**Charter Violation**: "Agent Loop Transparency" dealbreaker

---

## ✅ Required Solutions (Non-Negotiable)

### 1. Persist Internal Steps in Database

**What**: Modify `node_executions` schema to capture full agent loop trace.

**Schema Change**:
```typescript
// src/server/db/schema.ts
export const nodeExecutions = pgTable('node_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => workflowRuns.id),
  nodeId: text('node_id').notNull(),
  nodeType: text('node_type').notNull(),
  status: text('status').notNull(), // 'pending' | 'running' | 'success' | 'error'

  // Input/output data
  inputs: jsonb('inputs'),
  outputs: jsonb('outputs'),

  // NEW: Agent-specific internal trace
  internalTrace: jsonb('internal_trace').$type<InternalTraceData>(),

  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),

  // Error handling
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Type for internal trace
export interface InternalTraceData {
  steps: InternalStep[];
  iterationCount: number;
  finalState: 'success' | 'max_iterations' | 'no_progress' | 'error';
  halted: boolean;
  haltReason?: string;
}

export interface InternalStep {
  iteration: number;
  timestamp: number;
  type: 'agent_plan' | 'tool_call' | 'tool_result' | 'agent_finish';

  // Agent planning
  agentLog?: string; // The agent's reasoning

  // Tool execution
  toolName?: string;
  toolCallId?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  toolError?: string;
  toolDurationMs?: number;

  // Final answer
  finalOutput?: string;
}
```

**When to Persist**:
```typescript
// src/server/execution/WorkflowOrchestrator.ts:280-310

// After agent loop completes (when result is INodeExecutionData[][])
if (nodeType === 'agent') {
  // Agent returned final result, save internal trace
  const internalTrace: InternalTraceData = {
    steps: agentExecutionSteps, // Collected during loop
    iterationCount: currentIteration,
    finalState: result.finalState || 'success',
    halted: currentIteration >= maxIterations,
    haltReason: currentIteration >= maxIterations ? 'max_iterations' : undefined,
  };

  this.nodeResults.set(nodeId, {
    nodeId,
    nodeType,
    status: 'success',
    inputs: inputData,
    outputs,
    internalTrace, // NEW: Store agent's internal steps
    events,
    durationMs: endTime - startTime,
    startTime,
    endTime,
  });
}
```

**Why**: Ensures our "Lab Notebook" (run history) captures the full, auditable trace of the agent's reasoning.

---

### 2. Surface Internal Steps in UI (Debuggability)

**What**: When user clicks on an Agent Node in run history, show the internal loop.

**UI Requirements**:

#### Basic View (Default)
```
┌─────────────────────────────────────────────┐
│ Agent Node: "Research Assistant"           │
│ Status: ✅ Success                          │
│ Duration: 4.2s                              │
│ Iterations: 3                               │
├─────────────────────────────────────────────┤
│ Input:                                      │
│   prompt: "What's the weather in Boston?"  │
│                                             │
│ Output:                                     │
│   answer: "The weather in Boston is 72°F"  │
│                                             │
│ [View Internal Steps ▼]                    │
└─────────────────────────────────────────────┘
```

#### Expanded View (When Clicked)
```
┌─────────────────────────────────────────────┐
│ Agent Node: "Research Assistant"           │
│ Status: ✅ Success                          │
│ Duration: 4.2s                              │
│ Iterations: 3                               │
├─────────────────────────────────────────────┤
│ Internal Steps:                             │
│                                             │
│ ┌─ Iteration 1 (0.8s) ───────────────────┐ │
│ │ 🤖 Agent Planning:                      │ │
│ │    "I need to check the weather in     │ │
│ │     Boston. I'll use the weather tool."│ │
│ │                                         │ │
│ │ 🔧 Tool Call: get_current_weather       │ │
│ │    Input: { location: "Boston" }       │ │
│ │    Duration: 0.3s                       │ │
│ │                                         │ │
│ │ 📊 Tool Result:                         │ │
│ │    "The weather in Boston is 72°F,     │ │
│ │     partly cloudy."                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ Iteration 2 (0.5s) ───────────────────┐ │
│ │ 🤖 Agent Planning:                      │ │
│ │    "I have the weather information.    │ │
│ │     I can now provide the answer."     │ │
│ │                                         │ │
│ │ ✅ Final Answer:                        │ │
│ │    "The weather in Boston is 72°F"     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Hide Internal Steps ▲]                    │
└─────────────────────────────────────────────┘
```

**Implementation Path**:
1. **Phase 1 (P0)**: Store `internalTrace` in database
2. **Phase 2 (P1)**: Add "View Internal Steps" button to run history UI
3. **Phase 2 (P1)**: Create `InternalStepsViewer` component to render the trace

**Why**: Makes the agent's "black box" transparent, aligning with our P0 principle. A domain expert can see why the agent did what it did.

---

### 3. Make Streaming Non-Negotiable (Real-Time Visibility)

**What**: Phase 3 streaming is NOT optional - it's core to debuggability.

**Current Status**: ❌ Not implemented (Phase 3 in original plan)
**New Status**: ⚠️ Must be prioritized to P1

**Why Streaming Matters**:
- **Real-time debugging**: See agent loop as it happens, not after it completes
- **Early intervention**: Cancel stuck agents before they hit max iterations
- **Better UX**: Users see progress, not just a spinner for 10+ seconds

**Required Events** (Must emit during agent execution):
```typescript
// src/server/nodes/agent/execute.ts

// When agent starts planning
emitter.emit({
  t: 'agent.plan',
  iteration: currentIteration,
  actions: toolCalls.map(tc => ({ tool: tc.tool, type: 'ai_tool' })),
});

// When tool starts executing
emitter.emit({
  t: 'tool.start',
  tool: toolName,
  id: toolCallId,
  input: toolInput,
});

// When tool completes
emitter.emit({
  t: 'tool.success',
  tool: toolName,
  id: toolCallId,
  size: outputSize,
  ms: durationMs,
});

// When tool fails
emitter.emit({
  t: 'tool.error',
  tool: toolName,
  id: toolCallId,
  error: agentError,
});

// When agent finishes
emitter.emit({
  t: 'agent.finish',
  iteration: currentIteration,
  output: finalOutput,
  finalState: 'success',
});
```

**Frontend Integration**:
```typescript
// src/components/run-history/StreamingAgentView.tsx

useEffect(() => {
  const eventSource = new EventSource(`/api/workflows/${workflowId}/runs/${runId}/stream`);

  eventSource.addEventListener('agent.plan', (e) => {
    const data = JSON.parse(e.data);
    setCurrentStep({
      type: 'planning',
      iteration: data.iteration,
      actions: data.actions,
    });
  });

  eventSource.addEventListener('tool.start', (e) => {
    const data = JSON.parse(e.data);
    addToolExecution({
      tool: data.tool,
      id: data.id,
      status: 'running',
      input: data.input,
    });
  });

  // ... other event handlers
}, [workflowId, runId]);
```

**Why**: Allows the frontend to display the internal reasoning loop in real-time during execution, not just after it's finished.

---

### 4. Clarify `getMemory()` Scoping

**Question from Feedback**: "Your getMemory() helper is critical. We must define its scope."

**Decision**: Memory is scoped to a **single WorkflowRun**.

**Implementation**:
```typescript
// src/server/execution/WorkflowOrchestrator.ts:91-102

export class WorkflowOrchestrator {
  private state: Record<string, Record<string, unknown>> = {};
  private nodeResults: Map<string, NodeExecutionResult> = new Map();
  private allEvents: StreamEvent[] = [];
  private errors: Array<{ nodeId?: string; error: Error }> = [];

  // NEW: Memory scoped to this workflow run
  private conversationMemory?: BaseChatMemory;

  constructor(private config: OrchestrationConfig) {
    // Initialize memory if a memory node is connected
    this.conversationMemory = this.initializeMemoryIfNeeded();
  }

  private initializeMemoryIfNeeded(): BaseChatMemory | undefined {
    // Check if any agent node has a memory input connected
    const hasMemoryNode = Object.values(this.config.definition.nodes).some(
      (node) => node.data?.nodeType === 'agent' &&
                this.config.definition.edges.some(
                  (edge) => edge.target === node.id && edge.targetHandle === 'memory'
                )
    );

    if (hasMemoryNode) {
      // Create memory instance for this run
      return new BufferMemory({
        returnMessages: true,
        memoryKey: 'chat_history',
      });
    }

    return undefined;
  }
}
```

**Memory Lifecycle**:
1. **Created**: At the start of a WorkflowRun (in WorkflowOrchestrator constructor)
2. **Used**: By all Agent Nodes in the workflow (shared across the run)
3. **Destroyed**: When the WorkflowRun completes
4. **Never Persisted**: Starts fresh on every new run (P0 scope)

**Why**:
- Agent can maintain context across its internal tool-calling loop
- Multiple agent nodes in one workflow can share conversation history
- Simple scoping prevents memory leaks and confusion
- Fresh start on each run is predictable and debuggable

**Future Enhancement (P2)**: Thread-scoped or global memory with persistence.

---

## 📋 Action Items (Prioritized)

### P0 (Critical - Before Launch)
- [ ] **Database Schema**: Add `internalTrace` JSONB column to `node_executions`
- [ ] **WorkflowOrchestrator**: Collect internal steps during agent loop
- [ ] **WorkflowOrchestrator**: Persist `internalTrace` when agent completes
- [ ] **Memory Scoping**: Implement run-scoped memory initialization

### P1 (High Priority - Next Sprint)
- [ ] **UI Component**: Create `InternalStepsViewer` component
- [ ] **Run History**: Add "View Internal Steps" expansion to agent nodes
- [ ] **Event Streaming**: Implement SSE endpoint for real-time agent events
- [ ] **Frontend SSE**: Connect StreamingAgentView to event stream
- [ ] **Documentation**: Update EXECUTION_ENGINE.md with traceability patterns

### P2 (Future Enhancement)
- [ ] **Advanced Filtering**: Filter internal steps by tool, iteration, or error
- [ ] **Export Trace**: Allow exporting internal trace as JSON for debugging
- [ ] **Memory Persistence**: Add thread-scoped or global memory with DB storage
- [ ] **Replay Mode**: Re-run agent with same inputs but different tools

---

## 🎯 Success Metrics (From P0 Charter)

### Agent Traceability Task
**Goal**: A domain expert can view every tool call an agent made, the inputs/outputs, and why it was called in < 2 minutes using run history.

**How We Measure**:
1. Open run history ✓
2. Click on Agent Node ✓
3. Expand "Internal Steps" ✓
4. See full iteration-by-iteration trace with tool calls and reasoning ✓

**Target**: < 2 minutes

---

### Agent Debugging Task
**Goal**: When an agent loops unexpectedly or fails, a domain expert can identify the problematic tool call or max-iteration limit in < 5 minutes.

**How We Measure**:
1. Identify agent node that failed/looped ✓
2. Expand internal steps ✓
3. See which tool call failed or which iteration hit max limit ✓
4. View tool input/output or error message ✓

**Target**: < 5 minutes

---

## 🔗 Related Documentation

- [P0_CHARTER.md](../P0_CHARTER.md) - Mission and dealbreakers
- [architecture/EXECUTION_ENGINE.md](../architecture/EXECUTION_ENGINE.md) - Execution engine architecture
- [agents/EXECUTION_LOOP_COMPLETE.md](./EXECUTION_LOOP_COMPLETE.md) - Agent loop implementation
- [agents/IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Full agent roadmap (Phase 0 → Phase 3)

---

**Status**: Requirements documented, awaiting implementation
**Owner**: Engineering team
**Priority**: P0 (Critical)
**Deadline**: Before production launch

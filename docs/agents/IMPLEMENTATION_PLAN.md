# Agent Implementation Plan V2 (LangGraph-Based)

> **Key Pivot**: Adopt LangGraph for executor core. Shaves 1 week off timeline, provides battle-tested state management, checkpointing, and halting rules. Total effort: **2.5 weeks** (down from 3-4).

---

## Critical Fixes from Founder Review

### 1. LangGraph vs Hand-Rolled Iteration ✅
**Decision**: Use `@langchain/langgraph` for state management, checkpointing, and iteration control.
- Deletes ~20% of custom loop code
- Gets resumption, interrupts, and replay for free
- Aligns with 2025 prod standards (70%+ adoption per LangWatch)

### 2. Deterministic IDs & Idempotency ✅
**Fix**: `toolCallId = hash(executionId + nodeId + iteration + index)`
- Enables retry deduplication
- Prevents duplicate tool execution costs
- Add `attempt: number` and `stepHash: string` to metadata

### 3. Observability & Recovery ✅
**Fix**: Unified `AgentEvent` schema + checkpointing
- Emit structured events: `agent.plan`, `engine.request`, `tool.start/success/error`, `agent.finish`
- Persist checkpoints per iteration (prompt hash, tools version, calls, outputs)
- Integrate LangSmith for traces (optional)

### 4. Tool I/O Schema + Validation ✅
**Fix**: Mandate Zod schemas for all tools
- `input.parse()` before execution, `output.parse()` after
- Fail fast with `ValidationError`
- Auto-gen JSON Schema for UI

### 5. Security & Isolation ✅
**Fix**: Per-tool quotas and isolation
- `timeoutMs: 5000`, `maxOutputBytes: 1MB`
- Log redaction (strip secrets)
- Org-level tool allowlist
- Isolated execution contexts

### 6. Streaming Semantics ✅
**Fix**: Defined chunk types + pause-on-tool
- Chunks: `token`, `tool_call`, `tool_result`, `final` (always, even on error)
- Pause token streaming during tool execution
- Buffer tool deltas into single chunks

### 7. Memory Strategy ✅
**Fix**: Explicit memory types + trimming
- Types: Ephemeral (per-run), Thread (Redis), Global (vector store)
- Trim by tokens (tiktoken) + recency (last N)
- Store structured step summaries

### 8. Iteration & Halting Rules ✅
**Fix**: Max iterations + no-progress detection
- Max: 5 iterations (configurable)
- Halt on: duplicate tool args (hash check), unavailable tool
- Output parser: Always last via LangGraph end node

### 9. Batching + Concurrency ✅
**Fix**: Token budgeter + rate limit gates
- Per-model token quotas (tiktoken)
- Semaphore per API key (p-limit)
- Cost guards: 429/5xx handling

### 10. TanStack/Hono Compatibility ✅
**Fix**: Standardized error envelopes
```typescript
interface AgentError {
  code: 'TOOL_TIMEOUT' | 'VALIDATION_ERROR' | 'MAX_ITERATIONS' | 'MODEL_ERROR';
  message: string;
  cause?: Error;
  retriable: boolean;
}
```

---

## Updated Architecture

### Core Type System

**File**: `src/server/types/agent.ts`

```typescript
import type { ZodSchema } from 'zod';

// Action types
type ActionType = 'ai_tool' | 'structured_output' | 'noop';
type ToolName = string & { __brand: 'ToolName' };

// Engine Request/Response (resumable loop)
interface EngineRequest<T = RequestResponseMetadata> {
  actions: EngineAction[];
  metadata: T;
}

interface EngineResponse<T = RequestResponseMetadata> {
  results: EngineActionResult[];
  metadata: T;
}

interface EngineAction {
  id: string;              // Deterministic: hash(executionId + nodeId + iteration + index)
  type: ActionType;
  nodeName: string;        // Tool node ID in workflow
  tool: ToolName;          // Explicit tool name
  input: unknown;          // Validated by tool schema
  metadata: {
    itemIndex: number;
    iteration: number;
    attempt: number;
    source: 'agent' | 'system';
    stepHash: string;      // Hash of action for deduplication
  };
}

interface EngineActionResult {
  id: string;              // Matches EngineAction.id
  output: unknown;
  error?: AgentError;
  durationMs: number;
  outputSize: number;
}

// Request/Response Metadata
interface RequestResponseMetadata {
  itemIndex: number;
  iterationCount: number;
  previousRequests?: EngineRequest[];
  executionId: string;
  nodeId: string;
}

// Tool Definition
interface AgentTool<TIn = unknown, TOut = unknown> {
  name: ToolName;
  description: string;
  inputSchema: ZodSchema<TIn>;
  outputSchema: ZodSchema<TOut>;
  execute(ctx: ToolContext, input: TIn): Promise<TOut>;
  timeoutMs?: number;      // Default: 5000
  maxOutputBytes?: number; // Default: 1MB
  allowedOrgs?: string[];  // Org-level allowlist
}

interface ToolContext {
  executionId: string;
  nodeId: string;
  signal: AbortSignal;
  emit(event: AgentEvent): void;
}

// Tool Call Request
interface ToolCallRequest {
  tool: ToolName;
  toolInput: Record<string, unknown>;
  toolCallId: string;      // Deterministic
  type?: string;
  log?: string;
  messageLog?: unknown[];
}

// Agent Result
interface AgentResult {
  output: string;
  toolCalls?: ToolCallRequest[];
  steps?: IntermediateStep[];
  finalState?: 'success' | 'max_iterations' | 'no_progress' | 'error';
}

interface IntermediateStep {
  action: {
    tool: ToolName;
    toolInput: Record<string, unknown>;
    log: string;
    messageLog: unknown[];
    toolCallId: string;
    type: string;
  };
  observation?: string;
  error?: AgentError;
  durationMs?: number;
}

// Observability Events
type AgentEvent =
  | { t: 'agent.plan'; iteration: number; actions: PlannedActionPreview[] }
  | { t: 'engine.request'; requestId: string; actions: EngineActionPreview[] }
  | { t: 'tool.start'; tool: ToolName; id: string; input: unknown }
  | { t: 'tool.success'; tool: ToolName; id: string; size: number; ms: number }
  | { t: 'tool.error'; tool: ToolName; id: string; error: AgentError }
  | { t: 'agent.finish'; iteration: number; output: string; finalState: string };

type PlannedActionPreview = Pick<EngineAction, 'tool' | 'type'>;
type EngineActionPreview = Pick<EngineAction, 'id' | 'tool' | 'nodeName'>;

// Error Types
interface AgentError {
  code: 'TOOL_TIMEOUT' | 'VALIDATION_ERROR' | 'MAX_ITERATIONS' | 'NO_PROGRESS' | 'MODEL_ERROR' | 'TOOL_UNAVAILABLE';
  message: string;
  cause?: Error;
  retriable: boolean;
}

// Memory Types
type MemoryType = 'ephemeral' | 'thread' | 'global';

interface MemoryConfig {
  type: MemoryType;
  maxTokens?: number;
  maxMessages?: number;
  storeSummaries?: boolean;
}

// LangGraph State
interface AgentGraphState {
  messages: BaseMessage[];
  toolCalls: ToolCallRequest[];
  toolResults: Map<string, EngineActionResult>;
  iteration: number;
  finalOutput?: string;
  error?: AgentError;
}
```

---

## Revised Phase Breakdown

### P0: Core Loop + Single-Turn (Days 1-3)

**Goal**: Demo-able MVP with LangGraph executor, typed tools, deterministic IDs, basic events.

#### Phase 1.1: Type System & Error Handling
**File**: `src/server/types/agent.ts`

- [ ] Define all core types (above)
- [ ] Implement `AgentError` with retriable logic
- [ ] Create type guards: `isEngineRequest()`, `isAgentError()`

#### Phase 1.2: Tool System with Zod
**File**: `src/server/tools/`

- [ ] Create `AgentTool<TIn, TOut>` interface with Zod schemas
- [ ] Implement `createTool()` factory
  ```typescript
  function createTool<TIn, TOut>(config: {
    name: ToolName;
    description: string;
    inputSchema: ZodSchema<TIn>;
    outputSchema: ZodSchema<TOut>;
    execute: (ctx: ToolContext, input: TIn) => Promise<TOut>;
    timeoutMs?: number;
    maxOutputBytes?: number;
  }): AgentTool<TIn, TOut>
  ```
- [ ] Build two example tools:
  - `searchTool`: Web search with timeout
  - `calculatorTool`: Math eval with validation
- [ ] Add Zod → JSON Schema converter for UI
- [ ] Implement validation wrapper (pre/post parse)

#### Phase 1.3: Deterministic ID Generation
**File**: `src/server/utils/ids.ts`

- [ ] Implement `generateToolCallId()`
  ```typescript
  async function generateToolCallId(
    executionId: string,
    nodeId: string,
    iteration: number,
    index: number
  ): Promise<string> {
    const input = `${executionId}:${nodeId}:${iteration}:${index}`;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return btoa(String.fromCharCode(...new Uint8Array(hash))).slice(0, 16);
  }
  ```
- [ ] Implement `generateStepHash()` for deduplication
- [ ] Add tests for ID stability across retries

#### Phase 1.4: Observability Foundation
**File**: `src/server/observability/events.ts`

- [ ] Create `EventEmitter` wrapper
- [ ] Implement `emitEvent(event: AgentEvent)` with structured logging
- [ ] Add basic console logger (JSON format)
- [ ] Hook for LangSmith integration (optional, disabled by default)

#### Phase 1.5: LangGraph Setup
**File**: `src/server/agents/graph/setup.ts`

- [ ] Install dependencies
  ```json
  {
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph": "^0.4.0",
    "@langchain/openai": "^0.3.0",
    "zod": "^3.23.0",
    "tiktoken": "^1.1.0",
    "p-limit": "^5.0.0"
  }
  ```
- [ ] Create `AgentGraphState` interface
- [ ] Build basic `StateGraph` with single-turn execution
  ```typescript
  const graph = new StateGraph<AgentGraphState>({
    channels: {
      messages: { value: (x, y) => x.concat(y) },
      toolCalls: { value: (x, y) => y || x },
      toolResults: { value: (x, y) => new Map([...x, ...y]) },
      iteration: { value: (x, y) => y ?? x },
      finalOutput: { value: (x, y) => y ?? x },
      error: { value: (x, y) => y ?? x },
    }
  });
  ```

#### Phase 1.6: Single-Turn Agent Node
**File**: `src/server/agents/graph/nodes.ts`

- [ ] Implement `planNode`: Call LLM, extract tool calls
  ```typescript
  async function planNode(state: AgentGraphState): Promise<Partial<AgentGraphState>> {
    // Call model with current messages
    // Extract tool calls from response
    // Emit 'agent.plan' event
    // Return { toolCalls }
  }
  ```
- [ ] Implement `shouldContinue`: Route to tools or end
  ```typescript
  function shouldContinue(state: AgentGraphState): 'tools' | 'end' {
    return state.toolCalls && state.toolCalls.length > 0 ? 'tools' : 'end';
  }
  ```
- [ ] Wire nodes: `plan → [conditional] → tools/end`

#### Phase 1.7: Engine Bridge
**File**: `src/server/execution/requestHandler.ts`

- [ ] Implement `handleEngineRequest()`
  ```typescript
  async function handleEngineRequest(
    request: EngineRequest<RequestResponseMetadata>,
    workflowData: WorkflowData,
    executionId: string
  ): Promise<EngineResponse<RequestResponseMetadata>> {
    const results: EngineActionResult[] = [];

    for (const action of request.actions) {
      const startTime = Date.now();

      try {
        // Emit 'tool.start' event

        // Get tool from registry
        const tool = await getToolByName(action.tool);

        // Validate input
        const validInput = tool.inputSchema.parse(action.input);

        // Execute with timeout and size limits
        const result = await executeWithQuotas(tool, validInput, {
          timeoutMs: tool.timeoutMs ?? 5000,
          maxOutputBytes: tool.maxOutputBytes ?? 1024 * 1024,
        });

        // Validate output
        const validOutput = tool.outputSchema.parse(result);

        // Emit 'tool.success' event
        results.push({
          id: action.id,
          output: validOutput,
          durationMs: Date.now() - startTime,
          outputSize: JSON.stringify(validOutput).length,
        });
      } catch (error) {
        // Emit 'tool.error' event
        results.push({
          id: action.id,
          output: null,
          error: normalizeError(error),
          durationMs: Date.now() - startTime,
          outputSize: 0,
        });
      }
    }

    return { results, metadata: request.metadata };
  }
  ```
- [ ] Implement `executeWithQuotas()` (timeout + size caps)
- [ ] Implement `normalizeError()` → `AgentError`
- [ ] Add log redaction for secrets

#### Phase 1.8: Agent Node Integration
**File**: `src/server/nodes/agent/execute.ts`

- [ ] Update `executeAgent()` to use LangGraph
  ```typescript
  export async function executeAgent(
    context: ExecutionContext,
    response?: EngineResponse<RequestResponseMetadata>
  ): Promise<NodeExecutionData[][] | EngineRequest<RequestResponseMetadata>> {
    // Setup: Get model, tools, options
    const model = await getChatModel(context);
    const tools = await getTools(context);
    const options = getAgentOptions(context);

    // Build LangGraph
    const graph = createAgentGraph(model, tools, options);
    const app = graph.compile();

    // Initial or resumed execution
    const initialState: AgentGraphState = response
      ? buildResumedState(response)
      : buildInitialState(context);

    // Run graph (single-turn for P0)
    const finalState = await app.invoke(initialState);

    // Check for tool calls
    if (finalState.toolCalls && finalState.toolCalls.length > 0) {
      return createEngineRequest(finalState.toolCalls, context, options);
    }

    // Return final output
    return formatFinalOutput(finalState.finalOutput);
  }
  ```

#### Phase 1.9: Three Demo Workflows
**File**: `examples/workflows/`

- [ ] **Demo 1**: Simple search (trigger → agent → search tool → output)
- [ ] **Demo 2**: Math calculation (trigger → agent → calculator → output)
- [ ] **Demo 3**: Multi-tool (trigger → agent → search + calculator → output)

#### Phase 1.10: Tests (Golden Traces + Fuzz)
**File**: `src/server/__tests__/agent/`

- [ ] Golden trace: Record successful run, replay with mock LLM
- [ ] Fuzz tool inputs: Valid + invalid schemas
- [ ] ID stability: Assert same ID on retry
- [ ] Timeout enforcement: Slow tool fails gracefully
- [ ] Validation errors: Invalid input/output caught

---

### P1: Iteration + Streaming (Days 4-7)

#### Phase 2.1: Multi-Turn Iteration with LangGraph
**File**: `src/server/agents/graph/iteration.ts`

- [ ] Add iteration counter to state
- [ ] Implement `checkContinue()` conditional edge
  ```typescript
  function checkContinue(state: AgentGraphState): 'plan' | 'end' {
    if (state.iteration >= MAX_ITERATIONS) return 'end';
    if (detectNoProgress(state)) return 'end';
    return 'plan';
  }
  ```
- [ ] Implement `detectNoProgress()`: Hash tool args, detect duplicates
- [ ] Wire loop: `plan → tools → checkContinue → [plan/end]`

#### Phase 2.2: Checkpointing with MemorySaver
**File**: `src/server/agents/graph/checkpoints.ts`

- [ ] Integrate LangGraph `MemorySaver`
  ```typescript
  import { MemorySaver } from '@langchain/langgraph';

  const checkpointer = new MemorySaver();
  const app = graph.compile({ checkpointer });
  ```
- [ ] Persist checkpoints to Redis/DB (via custom saver)
  ```typescript
  class RedisCheckpointSaver extends BaseCheckpointSaver {
    async getTuple(config) { /* Load from Redis */ }
    async putTuple(config, checkpoint) { /* Save to Redis */ }
  }
  ```
- [ ] Store checkpoint metadata: prompt hash, tools version, iteration
- [ ] Implement replay: Resume from checkpoint on retry

#### Phase 2.3: Memory Integration
**File**: `src/server/agents/memory.ts`

- [ ] Implement `loadChatHistory()`
  ```typescript
  async function loadChatHistory(
    memory: BaseChatMemory,
    model: BaseChatModel,
    config: MemoryConfig
  ): Promise<BaseMessage[]> {
    const history = await memory.loadMemoryVariables({});
    let messages = history['chat_history'] as BaseMessage[];

    // Trim by tokens
    if (config.maxTokens) {
      messages = await trimMessages(messages, {
        strategy: 'last',
        maxTokens: config.maxTokens,
        tokenCounter: model,
      });
    }

    // Trim by count
    if (config.maxMessages) {
      messages = messages.slice(-config.maxMessages);
    }

    return messages;
  }
  ```
- [ ] Implement `saveChatHistory()` with tool context
  ```typescript
  async function saveChatHistory(
    memory: BaseChatMemory,
    input: string,
    output: string,
    steps: IntermediateStep[]
  ): Promise<void> {
    let fullOutput = output;

    if (steps.length > 0) {
      const toolContext = steps
        .map(s => `${s.action.tool}: ${s.observation?.slice(0, 100)}`)
        .join('; ');
      fullOutput = `[Tools: ${toolContext}] ${output}`;
    }

    await memory.saveContext({ input }, { output: fullOutput });

    // Store structured summaries if enabled
    if (config.storeSummaries) {
      await storeStepSummaries(steps);
    }
  }
  ```
- [ ] Add memory types: Ephemeral (in-memory), Thread (Redis), Global (vector store)

#### Phase 2.4: Halting Rules
**File**: `src/server/agents/graph/halting.ts`

- [ ] Implement max iterations check (configurable, default: 5)
- [ ] Implement no-progress detection
  ```typescript
  function detectNoProgress(state: AgentGraphState): boolean {
    const recentCalls = state.messages
      .filter(m => m.type === 'ai' && m.tool_calls)
      .slice(-3);

    if (recentCalls.length < 2) return false;

    // Hash tool calls (name + args)
    const hashes = recentCalls.map(call =>
      hashToolCalls(call.tool_calls)
    );

    // Duplicate detected
    return new Set(hashes).size < hashes.length;
  }
  ```
- [ ] Implement unavailable tool fallback
  ```typescript
  function handleUnavailableTool(tool: ToolName): string {
    return `Tool "${tool}" is unavailable. Please try a different approach.`;
  }
  ```

#### Phase 2.5: Output Parser (Server-Side)
**File**: `src/server/agents/outputParser.ts`

- [ ] Implement post-draft parsing
  ```typescript
  async function parseAgentOutput(
    draft: string,
    parser: BaseOutputParser,
    model: BaseChatModel
  ): Promise<unknown> {
    // Attempt 1: Parse draft
    const result = await parser.safeParseAsync(draft);
    if (result.success) return result.value;

    // Attempt 2: Repair with constrained prompt
    const repairPrompt = `
      The following output failed to parse:
      ${draft}

      Error: ${result.error}

      Please fix the output to match the required schema.
    `;

    const repairedDraft = await model.invoke([
      { role: 'user', content: repairPrompt }
    ]);

    const repairedResult = await parser.safeParseAsync(repairedDraft.content);
    if (repairedResult.success) return repairedResult.value;

    throw new AgentError({
      code: 'VALIDATION_ERROR',
      message: 'Failed to parse output after repair',
      cause: repairedResult.error,
      retriable: false,
    });
  }
  ```
- [ ] Add output parser as LangGraph end node (not tool)

#### Phase 3.1: Streaming with Event Processing
**File**: `src/server/agents/streaming.ts`

- [ ] Implement `processEventStream()`
  ```typescript
  async function processEventStream(
    context: ExecutionContext,
    stream: AsyncIterator<StreamEvent>,
    emitEvent: (event: AgentEvent) => void
  ): Promise<AgentResult> {
    let currentOutput = '';
    const toolCalls: ToolCallRequest[] = [];
    const steps: IntermediateStep[] = [];

    // Buffer for tool chunks
    let toolBuffer: Map<string, Partial<ToolCallRequest>> = new Map();

    for await (const event of stream) {
      switch (event.event) {
        case 'on_chat_model_stream':
          // Stream tokens to UI (if not paused for tool)
          if (!isPausedForTool(state)) {
            const chunk = event.data.chunk.content;
            currentOutput += chunk;
            context.streamChunk?.({ type: 'token', content: chunk });
          }
          break;

        case 'on_chat_model_end':
          // Extract tool calls
          const llmOutput = event.data.output;
          if (llmOutput.tool_calls?.length > 0) {
            // Emit single buffered tool_call chunk per tool
            for (const tc of llmOutput.tool_calls) {
              const toolCall = buildToolCallRequest(tc);
              toolCalls.push(toolCall);
              context.streamChunk?.({
                type: 'tool_call',
                id: toolCall.toolCallId,
                tool: toolCall.tool,
                input: toolCall.toolInput,
              });
            }
            // Pause token streaming
            setPausedForTool(state, true);
          }
          break;

        case 'on_tool_end':
          // Emit tool result
          const result = event.data.output;
          context.streamChunk?.({
            type: 'tool_result',
            id: event.data.tool_call_id,
            output: truncateOutput(result, 500),
          });

          steps.push({
            action: findActionById(toolCalls, event.data.tool_call_id),
            observation: result,
            durationMs: event.data.duration_ms,
          });

          // Resume token streaming
          setPausedForTool(state, false);
          break;
      }
    }

    // Always emit terminal 'final' chunk
    context.streamChunk?.({
      type: 'final',
      output: currentOutput,
      error: state.error,
    });

    return {
      output: currentOutput,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      steps,
      finalState: determineFinalState(state),
    };
  }
  ```
- [ ] Implement pause-on-tool logic
- [ ] Buffer tool chunks (single emission per call)
- [ ] Always emit terminal `final` chunk (even on error)

#### Phase 3.2: Streaming Executor
**File**: `src/server/nodes/agent/execute.ts` (update)

- [ ] Detect streaming mode: `context.isStreaming()`
- [ ] Use LangGraph's `app.stream()` instead of `invoke()`
  ```typescript
  if (context.isStreaming()) {
    const stream = app.stream(initialState, { streamMode: 'events' });
    const result = await processEventStream(context, stream, emitEvent);
    // ... handle result (tool calls or final)
  }
  ```

---

### P2: Scale + Polish (Days 8-10)

#### Phase 4.1: Batching with Token Budget
**File**: `src/server/agents/batching.ts`

- [ ] Implement `TokenBudgeter`
  ```typescript
  class TokenBudgeter {
    private quotas: Map<string, { used: number; limit: number }>;

    async checkAndReserve(modelId: string, tokens: number): Promise<boolean> {
      const quota = this.quotas.get(modelId);
      if (!quota || quota.used + tokens > quota.limit) return false;
      quota.used += tokens;
      return true;
    }

    release(modelId: string, tokens: number): void {
      const quota = this.quotas.get(modelId);
      if (quota) quota.used -= tokens;
    }
  }
  ```
- [ ] Integrate tiktoken for token counting
- [ ] Wrap batch loop with budget checks

#### Phase 4.2: Concurrency Gates
**File**: `src/server/agents/concurrency.ts`

- [ ] Install `p-limit` for semaphores
- [ ] Implement per-API-key gates
  ```typescript
  import pLimit from 'p-limit';

  class ConcurrencyGate {
    private limiters: Map<string, ReturnType<typeof pLimit>>;

    constructor(private maxConcurrency: number = 5) {}

    async execute<T>(apiKey: string, fn: () => Promise<T>): Promise<T> {
      let limiter = this.limiters.get(apiKey);
      if (!limiter) {
        limiter = pLimit(this.maxConcurrency);
        this.limiters.set(apiKey, limiter);
      }
      return limiter(fn);
    }
  }
  ```
- [ ] Wrap model calls with gate

#### Phase 4.3: Cost Guards (429/5xx Handling)
**File**: `src/server/agents/retries.ts`

- [ ] Implement exponential backoff
  ```typescript
  async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries: number;
      backoffMs: number;
      shouldRetry: (error: unknown) => boolean;
    }
  ): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i <= options.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!options.shouldRetry(error) || i === options.maxRetries) {
          throw error;
        }
        await sleep(options.backoffMs * Math.pow(2, i));
      }
    }
    throw lastError;
  }
  ```
- [ ] Add retry logic to model calls
- [ ] Detect 429/5xx: `shouldRetry(error)`

#### Phase 4.4: Fallback Model
**File**: `src/server/agents/fallback.ts`

- [ ] Use LangGraph conditional edges for fallback routing
  ```typescript
  function shouldUseFallback(state: AgentGraphState): 'primary' | 'fallback' {
    if (state.error?.code === 'MODEL_ERROR' && state.error.retriable) {
      return 'fallback';
    }
    return 'primary';
  }
  ```
- [ ] Wire fallback model node
- [ ] Track fallback usage in events

#### Phase 4.5: Security Gates
**File**: `src/server/agents/security.ts`

- [ ] Implement log redaction
  ```typescript
  function redactSecrets(log: string): string {
    return log
      .replace(/api[_-]?key[=:]\s*["']?[\w-]+["']?/gi, 'api_key=***')
      .replace(/token[=:]\s*["']?[\w.-]+["']?/gi, 'token=***')
      .replace(/password[=:]\s*["']?[^\s"']+["']?/gi, 'password=***');
  }
  ```
- [ ] Enforce org-level tool allowlist
  ```typescript
  function checkToolAllowed(tool: ToolName, orgId: string): boolean {
    const allowlist = getOrgToolAllowlist(orgId);
    return !allowlist || allowlist.includes(tool);
  }
  ```
- [ ] Add tool execution timeouts (via AbortController)
- [ ] Add output size caps (truncate before return)

---

### P3: Nesting + Ship (Days 11-14)

#### Phase 6.1: Agent Tool Node (LangGraph Subgraphs)
**File**: `src/server/nodes/agentTool/`

- [ ] Create `AgentTool` node class
  - Similar to `Agent` but outputs `ai_tool` connection
  - Wraps LangGraph as subgraph
- [ ] Implement subgraph invocation
  ```typescript
  const subgraph = createAgentGraph(subModel, subTools, subOptions);
  const toolNode = (state: ParentGraphState) => {
    const subState = extractSubState(state);
    return subgraph.invoke(subState);
  };
  ```
- [ ] Wire parent → child communication
- [ ] Handle nested tool calls (recursive)

#### Phase 6.2: Multi-Agent Example
**File**: `examples/workflows/multi-agent.ts`

- [ ] Create parent agent with research task
- [ ] Create child agent (research specialist) as tool
- [ ] Demo: Parent delegates research, uses results

#### Phase 7.1: Comprehensive Tests
**File**: `src/server/__tests__/agent/`

- [ ] **Unit Tests**:
  - [ ] Tool call creation + validation
  - [ ] Prompt preparation
  - [ ] Memory trimming
  - [ ] Output parser (parse + repair)
  - [ ] Iteration control
  - [ ] Error normalization

- [ ] **Integration Tests**:
  - [ ] Single tool call
  - [ ] Multiple tool calls (parallel)
  - [ ] Iterative reasoning (3+ turns)
  - [ ] Streaming mode (chunks + terminal)
  - [ ] Memory persistence (thread)
  - [ ] Structured output
  - [ ] Fallback model activation
  - [ ] Agent tool nodes (nesting)

- [ ] **Chaos Tests**:
  - [ ] Kill executor mid-request (assert resumption)
  - [ ] Duplicate tool call IDs (assert dedup)
  - [ ] Tool timeout enforcement
  - [ ] Output size cap enforcement
  - [ ] 429 rate limit (assert backoff)
  - [ ] 5xx server error (assert retry)

- [ ] **Golden Trace Tests**:
  - [ ] Record full successful run (JSON)
  - [ ] Replay with mock LLM
  - [ ] Assert engine contracts match

#### Phase 8.1: Documentation
**File**: `docs/agents/`

- [ ] Architecture overview (LangGraph + engine loop)
- [ ] Connection model (ai_* types)
- [ ] Tool creation guide (Zod schemas)
- [ ] Streaming semantics (chunk types)
- [ ] Memory strategies (ephemeral/thread/global)
- [ ] Output parsers (server-side)
- [ ] Multi-agent patterns (nesting)
- [ ] Security best practices

#### Phase 8.2: Example Workflows
**File**: `examples/workflows/`

- [ ] Simple agent (search tool)
- [ ] Multi-step agent (research + summarize)
- [ ] Chatbot with thread memory
- [ ] Structured output agent (JSON schema)
- [ ] Multi-agent system (delegation)

---

## Dependencies

### Required Packages
```json
{
  "@langchain/core": "^0.3.0",
  "@langchain/langgraph": "^0.4.0",
  "@langchain/openai": "^0.3.0",
  "zod": "^3.23.0",
  "tiktoken": "^1.1.0",
  "p-limit": "^5.0.0"
}
```

### Optional Packages
```json
{
  "@langchain/anthropic": "^0.3.0",
  "@langchain/langsmith": "^0.2.0",
  "ioredis": "^5.3.0"
}
```

---

## Estimated Effort (Revised)

- **P0** (Days 1-3): Core loop + single-turn = **3 days**
- **P1** (Days 4-7): Iteration + streaming = **4 days**
- **P2** (Days 8-10): Scale + polish = **3 days**
- **P3** (Days 11-14): Nesting + ship = **4 days**

**Total**: **2.5 weeks** (12.5 working days)

**Savings from LangGraph**: ~5 days (eliminated custom loop, checkpointing, halting logic)

---

## Success Criteria

1. ✅ Agent executes single tool calls with validation
2. ✅ Agent performs iterative multi-step reasoning (5+ turns)
3. ✅ Streaming responses work with pause-on-tool
4. ✅ Memory persists across executions (thread store)
5. ✅ Structured output parsing with repair
6. ✅ Fallback models activate on errors
7. ✅ Multi-agent systems (Agent Tool nodes) work
8. ✅ All tests pass (unit/integration/chaos/golden)
9. ✅ 95%+ test coverage
10. ✅ Deterministic IDs enable idempotent retries
11. ✅ Observability: All events emitted, checkpoints persisted
12. ✅ Security: Timeouts, size caps, redaction, allowlists enforced
13. ✅ Cost guards: 429/5xx handled, token budgets respected
14. ✅ Documentation complete with examples

---

## First 72 Hours Checklist (P0)

### Day 1: Types + Tools
- [ ] Lock event schema + ID strategy
- [ ] Implement Zod-backed Tool adapter
- [ ] Build two example tools (search, calculator)
- [ ] Add validation + error handling

### Day 2: Engine + LangGraph
- [ ] Build engine bridge (`handleEngineRequest`)
- [ ] Implement single-turn LangGraph executor
- [ ] Wire deterministic IDs + basic events
- [ ] Add timeout/size quotas per tool

### Day 3: Integration + Demo
- [ ] Integrate agent node with LangGraph
- [ ] Wire stream envelope (token, tool_call, tool_result, final)
- [ ] Build three demo workflows
- [ ] Golden trace + fuzz tests

---

## Key Wins from V2

1. **LangGraph Adoption**: Deletes ~20% custom code, gets production-ready state management
2. **Deterministic IDs**: Enables idempotent retries, prevents duplicate costs
3. **Unified Events**: Structured observability + checkpoint replay
4. **Zod Everywhere**: Type-safe tools, fail-fast validation
5. **Security-First**: Timeouts, caps, redaction, allowlists built-in
6. **Streaming Done Right**: Pause-on-tool, terminal final chunk
7. **Explicit Memory**: Ephemeral/thread/global with trimming
8. **Halting Rules**: Max iterations + no-progress detection
9. **Cost Controls**: Token budgets + rate limit gates
10. **Server-Side Parsing**: Output parser with repair, decoupled from tools

---

## What's Different from V1

| Aspect | V1 (Hand-Rolled) | V2 (LangGraph) | Impact |
|--------|------------------|----------------|--------|
| **Executor** | Custom loop | `StateGraph` + `MemorySaver` | -5 days effort, +reliability |
| **Iteration** | Manual counter | Graph conditional edges | Built-in halting |
| **Checkpoints** | Custom impl | LangGraph native | Replay for free |
| **Tool IDs** | Random UUIDs | Deterministic hash | Idempotency |
| **Events** | Ad-hoc logs | Unified `AgentEvent` | Observability |
| **Validation** | Runtime checks | Zod schemas | Type safety |
| **Security** | Not specified | Quotas + redaction | Production-ready |
| **Streaming** | Basic | Pause-on-tool + buffer | Better UX |
| **Parser** | Special tool | Server-side stage | Cleaner separation |
| **Memory** | Vague | Explicit types + trim | Predictable |

---

## Next Steps

**Option A**: Start P0 implementation
- I'll stub files: `types/agent.ts`, `tools/calculator.ts`, `agents/graph/setup.ts`
- You review + approve structure
- We pair on Day 1 checklist

**Option B**: Deep-dive specific area
- Security implementation details
- LangGraph graph construction
- Tool validation architecture
- Streaming event handling

**Option C**: Adjust plan
- Different priorities
- Additional requirements
- Timeline constraints

**Your call—what's the priority?**

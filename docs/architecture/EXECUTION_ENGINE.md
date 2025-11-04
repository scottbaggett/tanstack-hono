# Execution Engine - High-Level Architecture

## Vision

The execution engine is the heart of the platform—a type-safe, observable, and extensible system that orchestrates the execution of complex workflows with full traceability from input to output. It treats all nodes (including AI agents) as first-class citizens, providing consistent execution semantics, error handling, and observability regardless of node type.

**Core Promise**: *Every workflow execution is deterministic, traceable, and debuggable—whether it's a simple data transformation or a multi-iteration AI agent calling dozens of tools.*

---

## Design Philosophy

### 1. **Traceability First**
Every execution step leaves an audit trail:
- What node executed
- What inputs it received
- What outputs it produced
- What errors occurred
- How long it took

This isn't optional—it's baked into the execution model.

### 2. **Nodes as Pure Functions (with Effects)**
Conceptually, a node is:
```typescript
Node: (ExecutionContext) => Promise<NodeExecutionData[][]>
```

Nodes receive context (inputs, parameters, credentials) and return outputs. Side effects (API calls, DB writes) happen within the node but are managed by the platform (timeouts, retries, quotas).

### 3. **Agents as Special Nodes**
AI agents are nodes that can *request additional execution*:
```typescript
AgentNode: (ExecutionContext) => Promise<NodeExecutionData[][] | EngineRequest>
```

When an agent needs tools, it returns an `EngineRequest`. The orchestrator executes the tools and resumes the agent with an `EngineResponse`. This pattern keeps agents observable and controllable.

### 4. **Separation of Concerns**

```
┌─────────────────────────────────────────────┐
│         Workflow Definition (JSON)          │
│   (Nodes, Edges, Configuration - Static)    │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│        WorkflowOrchestrator                 │
│   (Topological Sort, Execution Order)       │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│         ExecutionContext Factory            │
│   (Build Context from Definition + State)   │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│           Node Execution                    │
│   (Node.execute(context) => results)        │
└─────────────────┬───────────────────────────┘
                  │
                  ↓ (if EngineRequest)
┌─────────────────────────────────────────────┐
│         Request Handler                     │
│   (Execute Tools with Quotas)               │
└─────────────────┬───────────────────────────┘
                  │
                  ↓ (EngineResponse)
┌─────────────────────────────────────────────┐
│         Agent Resumption                    │
│   (Agent.execute(context + response))       │
└─────────────────────────────────────────────┘
```

---

## Core Components

### 1. WorkflowOrchestrator
**Location**: `src/server/execution/WorkflowOrchestrator.ts`

**Responsibilities**:
- Load workflow definition
- Perform topological sort to determine execution order
- Create ExecutionContext for each node
- Execute nodes in dependency order
- Handle agent execution loops (detect EngineRequest, execute tools, resume)
- Collect and store execution results
- Emit execution events for observability

**Key Methods**:
- `orchestrate()` - Main entry point, returns `OrchestrationResult`
- `executeNode()` - Execute a single node (handles both regular nodes and agents)
- `createExecutionContext()` - Adapter to build ExecutionContext from ExecuteFunctions

**State Management**:
```typescript
private state: Record<nodeId, outputs>  // Node outputs for dependency resolution
private nodeResults: Map<nodeId, NodeExecutionResult>  // Full execution metadata
```

### 2. ExecutionContext
**Location**: `src/types/interfaces.ts`

**Purpose**: The execution context passed to every node, containing everything needed for execution.

**Structure**:
```typescript
interface ExecutionContext {
  // Identity
  nodeId: string;
  nodeType: string;
  version: number;

  // Data
  inputs: Record<string, any>;           // From connected nodes
  properties: Record<string, unknown>;   // Raw config (may have expressions)
  evaluatedProperties: Record<string, any>;  // Evaluated config

  // Security
  credentials?: Record<string, Record<string, any>>;
  signal?: AbortSignal;

  // Tracking (for future multi-run/item-based execution)
  runIndex?: number;
  itemIndex?: number;

  // Agent-specific
  engineResponse?: EngineResponse;  // Tool results for agent resumption

  // Helper methods (Phase 2)
  getInputData?(): NodeExecutionData[];
  getNodeParameter?<T>(name: string): T;
}
```

**Evolution Path**:
- **Phase 1 (Current)**: Basic context with agent support
- **Phase 2**: Add helper methods, remove ExecuteFunctions
- **Phase 3**: Add expression evaluation ($json, $input, etc.)

### 3. Request Handler
**Location**: `src/server/execution/requestHandler.ts`

**Purpose**: Execute tool calls on behalf of agents with quotas and validation.

**Flow**:
```
EngineRequest (from agent)
  ↓
Tool Registry Lookup
  ↓
Input Validation (Zod)
  ↓
Execute with Quotas (timeout, size limits)
  ↓
Output Validation (Zod)
  ↓
EngineResponse (back to agent)
```

**Quotas Enforced**:
- Timeout (default: 5s per tool)
- Output size (default: 1MB)
- Rate limiting (future)

### 4. Tool Registry
**Location**: `src/server/execution/requestHandler.ts`

**Purpose**: Central registry of all available tools that agents can call.

**Registration**:
```typescript
// At startup (src/server/nodes/load.ts)
registerTool(calculatorTool);
registerTool(searchTool);

// Tool structure
interface AgentTool {
  name: ToolName;
  description: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  execute: (context, input) => Promise<output>;
  timeoutMs?: number;
  maxOutputBytes?: number;
  allowedOrgs?: string[];
}
```

### 5. Node Registry
**Location**: `src/server/nodes/Node.ts`

**Purpose**: Registry of all node types (TextInput, Agent, HttpRequest, etc.)

**Loading**:
```typescript
// At startup (src/server/nodes/load.ts)
export function loadNodes(): void {
  nodeRegistry.register(new TextInput(), { ... });
  nodeRegistry.register(new Agent(), { ... });
  nodeRegistry.register(new Output(), { ... });
  // ...
}
```

---

## Execution Flow

### Standard Node Execution

```
1. Orchestrator gets execution order: [node1, node2, node3]
2. For each node:
   a. Prepare input data from state
   b. Create ExecutionContext
   c. Call node.execute(context)
   d. Store outputs in state
   e. Track result metadata
3. Return OrchestrationResult
```

**Example**:
```
TextInput → Set → Output

1. Execute TextInput
   - No inputs
   - Returns: [{ json: { text: "Hello" } }]
   - state["textInput1"] = { output: [{ json: { text: "Hello" } }] }

2. Execute Set
   - Input from TextInput: [{ json: { text: "Hello" } }]
   - Transform: Add field "processed: true"
   - Returns: [{ json: { text: "Hello", processed: true } }]
   - state["set1"] = { output: [{ json: { text: "Hello", processed: true } }] }

3. Execute Output
   - Input from Set: [{ json: { text: "Hello", processed: true } }]
   - Display to user
   - Returns: [{ json: { success: true } }]
```

### Agent Node Execution (Iterative)

```
1. Orchestrator detects nodeType === 'agent'
2. Create ExecutionContext (no engineResponse)
3. Execute agent → Returns EngineRequest
4. Loop:
   a. Check abort signal
   b. Execute tools via handleEngineRequest()
   c. Create new ExecutionContext (with engineResponse)
   d. Resume agent → Returns EngineRequest OR NodeExecutionData[][]
   e. If NodeExecutionData[][] → Break loop
5. Store final outputs in state
```

**Example**:
```
TextInput("What is 15 * 7?") → Agent → Output

1. Execute TextInput
   - Returns: [{ json: { text: "What is 15 * 7?" } }]

2. Execute Agent (Iteration 1)
   - Input: "What is 15 * 7?"
   - Agent plans: "I need to use calculator"
   - Returns: EngineRequest {
       actions: [{ tool: "calculator", input: { expression: "15*7" } }]
     }

3. Execute Tools
   - calculator("15*7") → 105
   - Returns: EngineResponse {
       results: [{ id: "...", output: { result: 105 } }]
     }

4. Resume Agent (Iteration 2)
   - Input: "What is 15 * 7?" + EngineResponse
   - Agent: "I have the result"
   - Returns: NodeExecutionData[][] = [[{ json: { answer: "105" } }]]

5. Store agent output
   - state["agent1"] = { output: [{ json: { answer: "105" } }] }

6. Execute Output
   - Display "105" to user
```

---

## State Management

### Current Approach (Phase 1)
```typescript
// Flat state per node
state[nodeId] = outputs
```

**Limitations**:
- No runIndex tracking (nodes execute once)
- No branch support (multiple outputs)
- No item-based execution (batch processing)

### Future Approach (Phase 2+)
```typescript
// Hierarchical state (inspired by n8n)
state[nodeId][runIndex].data.main[branchIndex][itemIndex]
```

**Benefits**:
- Support loops (multiple runs per node)
- Support branching (IF/ELSE with different paths)
- Support batch processing (one execution per item)
- Better data lineage (pairedItem tracking)

---

## Error Handling

### Error Propagation

```
Node Error
  ↓
Caught by executeNode()
  ↓
Stored in NodeExecutionResult.error
  ↓
Workflow halted (no further nodes execute)
  ↓
OrchestrationResult.status = "error"
```

### Error Types

1. **Node Execution Errors**
   - Node throws exception
   - Validation fails
   - Timeout

2. **Tool Execution Errors**
   - Tool throws exception
   - Tool exceeds quota
   - Tool not found

3. **Agent Errors**
   - Max iterations exceeded
   - No progress detected (infinite loop)
   - LLM API failure

### Error Recovery (Future)

- **Retry Logic**: Auto-retry transient failures (network, rate limits)
- **Fallback Nodes**: Execute alternative path on error
- **Partial Success**: Continue workflow despite non-critical errors

---

## Observability

### Events Emitted

```typescript
// Agent events
agent.plan        // Agent planning action
agent.finish      // Agent completed
tool.start        // Tool execution started
tool.success      // Tool execution succeeded
tool.error        // Tool execution failed
engine.request    // EngineRequest created
engine.response   // EngineResponse returned

// Workflow events
workflow.start    // Workflow execution started
workflow.complete // Workflow execution finished
node.start        // Node execution started
node.complete     // Node execution finished
node.error        // Node execution failed
```

### Traceability Requirements (from P0_CHARTER.md)

✅ **End-to-End Traceability**: Every node execution is recorded with inputs/outputs/errors
✅ **Agent Loop Transparency**: Every tool call is captured in EngineRequest/EngineResponse
✅ **Debuggability**: Clear error messages with node context
⏳ **UI Visualization**: Run history viewer (P0 remaining)

---

## Performance Considerations

### Bottlenecks

1. **LLM Latency**: Agent nodes wait for OpenAI API (1-5s per call)
2. **Tool Execution**: External API calls can be slow
3. **Sequential Execution**: Nodes execute one at a time (topological order)

### Optimizations (Future)

1. **Parallel Execution**: Execute independent nodes concurrently
2. **Streaming**: Stream LLM responses for better UX
3. **Caching**: Cache LLM responses for deterministic inputs
4. **Connection Pooling**: Reuse HTTP connections for tools

### Resource Limits

- **Max Workflow Duration**: 10 minutes (default)
- **Max Agent Iterations**: 5 (default, configurable)
- **Tool Timeout**: 5s (default, configurable)
- **Tool Output Size**: 1MB (default, configurable)

---

## Security

### Sandboxing

- **Custom Code Execution**: Run in isolated VM or container (future)
- **Tool Execution**: No direct filesystem access, network restrictions

### Credentials

- **Storage**: Encrypted at rest in database
- **Access**: Decrypted only during node execution
- **Scope**: Per-node, per-workflow basis

### Validation

- **Input Validation**: Zod schemas for all tool inputs
- **Output Validation**: Zod schemas for tool outputs
- **Property Validation**: Node properties validated before execution

---

## Extension Points

### Adding Custom Nodes

```typescript
// 1. Implement INodeType interface
export class MyCustomNode implements INodeType {
  description: INodeTypeDescription = { ... };

  async execute(context: ExecutionContext): Promise<NodeExecutionData[][]> {
    const input = context.inputs.main;
    const param = context.getNodeParameter('myParam');

    // Do work
    const output = processData(input, param);

    return [[{ json: output }]];
  }
}

// 2. Register in loadNodes()
nodeRegistry.register(new MyCustomNode(), { ... });
```

### Adding Custom Tools

```typescript
// 1. Define tool with Zod schemas
export const myTool: AgentTool = {
  name: 'myTool',
  description: 'Does something useful',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async (context, input) => {
    // Do work
    return { result: 'success' };
  },
};

// 2. Register in loadNodes()
registerTool(myTool);
```

---

## Roadmap

### Phase 1: P0 Foundation ✅
- [x] Basic orchestration (topological sort)
- [x] Agent execution loop
- [x] Tool registry and execution
- [x] LangGraph integration
- [x] Abort signal handling
- [x] Type-safe ExecutionContext

### Phase 2: Enhanced Execution (P1)
- [ ] Expression evaluation ($json, $input)
- [ ] Multi-run support (runIndex tracking)
- [ ] Item-based execution (itemIndex)
- [ ] Unified ExecutionContext (deprecate ExecuteFunctions)
- [ ] Enhanced error handling with retry logic

### Phase 3: Advanced Features (P2)
- [ ] Branch support (multiple output paths)
- [ ] Parallel node execution
- [ ] Streaming execution
- [ ] Memory integration for agents
- [ ] Human-in-the-loop (pause for approval)

### Phase 4: Production Hardening (P3)
- [ ] Distributed execution (multiple workers)
- [ ] Execution persistence (resume from DB)
- [ ] Advanced observability (OpenTelemetry)
- [ ] Performance optimizations
- [ ] Security hardening

---

## Key Decisions

### Why LangGraph?
- Battle-tested state management for agents
- Conditional routing built-in
- Halting rules prevent infinite loops
- Compatible with LangChain ecosystem

### Why Request-Response Pattern?
- Makes agent tool calls explicit and traceable
- Enables quota enforcement (timeout, size)
- Allows execution engine to manage resources
- Supports future features (approval workflows, caching)

### Why ExecutionContext (not just ExecuteFunctions)?
- Simpler interface for modern nodes
- Easier to extend (add fields without breaking changes)
- Better type safety with helper methods
- Aligns with n8n's evolution

### Why Topological Sort?
- Guarantees correct execution order (dependencies first)
- Detects cycles in workflow (fail fast)
- Deterministic execution order (same every time)

---

## Related Documentation

- [P0_CHARTER.md](../P0_CHARTER.md) - Mission and principles
- [EXECUTION_CONTEXT.md](../agents/EXECUTION_CONTEXT.md) - ExecutionContext architecture deep dive
- [EXECUTION_LOOP_COMPLETE.md](../agents/EXECUTION_LOOP_COMPLETE.md) - Agent loop implementation
- [TESTING_STRATEGY.md](../agents/TESTING_STRATEGY.md) - Testing approach

---

## Questions?

- **How do I debug a workflow?** See `workflows/DEBUGGING.md`
- **How do I create a custom node?** See `nodes/CREATING_NODES.md`
- **How do agents work?** See `agents/AGENT_LOOP.md`
- **What's the API?** See `api/EXECUTION_API.md`

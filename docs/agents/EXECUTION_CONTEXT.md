# Execution Context Architecture

## Overview

This document maps n8n's execution context architecture to our TanStack-Hono implementation, identifying key concepts, data structures, and the path forward for a scalable, type-safe agent execution system.

---

## Architecture Comparison

### n8n Architecture

n8n uses a dual-context system:

1. **IExecuteFunctions** - Legacy interface for node execution
   - Provides helper methods (getNodeParameter, getInputData, etc.)
   - Used by most utility nodes (HTTP Request, Set, etc.)
   - Location: `n8n-workflow/src/Interfaces.ts`

2. **WorkflowDataProxy** - Expression evaluation context
   - Provides `$json`, `$input`, `$node`, etc. variables
   - Uses JavaScript Proxies for lazy evaluation
   - Created per-item during expression evaluation
   - Location: `n8n-workflow/src/WorkflowDataProxy.ts`

3. **IRunExecutionData** - Execution state storage
   - Stores all node outputs in `resultData.runData`
   - Hierarchical: `runData[nodeName][runIndex].data.main[branchIndex][itemIndex]`
   - Persists across node executions

### Our Architecture

We currently have a similar dual-context system that needs alignment:

1. **ExecuteFunctions** - Implements `IExecuteFunctions` interface
   - Location: `src/server/execution/ExecuteFunctions.ts`
   - Used by WorkflowOrchestrator to execute nodes
   - Provides helper methods for node implementations

2. **ExecutionContext** - Lightweight context for agent nodes
   - Location: `src/types/interfaces.ts:111-121`
   - Used by Agent node (src/server/nodes/agent/execute.ts)
   - Simple data structure with inputs, properties, credentials

3. **WorkflowOrchestrator** - Execution engine
   - Location: `src/server/execution/WorkflowOrchestrator.ts`
   - Manages node execution order (topological sort)
   - Stores execution state in `this.state`

---

## Key Data Structures

### n8n's INodeExecutionData

```typescript
interface INodeExecutionData {
    json: IDataObject;                    // Primary JSON payload ($json)
    binary?: IBinaryKeyData;             // Binary data attachments
    error?: NodeApiError | NodeOperationError;
    pairedItem?: IPairedItemData | number;  // Item linking metadata
    metadata?: { subExecution: RelatedExecution };
    evaluationData?: Record<string, GenericValue>;
    sendMessage?: string;                // For chat nodes
}
```

**Our equivalent**: `INodeExecutionData` (src/types/execution.ts)
```typescript
export interface INodeExecutionData {
    json?: IDataObject;
    binary?: Record<string, IBinaryData>;
    pairedItem?: number | { item: number; input?: number };
    error?: Error;
}
```

✅ **Status**: Similar structure, covers core use cases

### n8n's IRunExecutionData

```typescript
interface IRunExecutionData {
    startData?: { ... };
    resultData: {
        error?: ExecutionError;
        runData: IRunData;              // Stores all node execution results
        pinData?: IPinData;
    };
}

interface IRunData {
    [nodeName: string]: ITaskData[];    // Array of task executions per node
}

interface ITaskData {
    executionTime: number;
    data?: ITaskDataConnections;        // { main: [INodeExecutionData[][], ...] }
    error?: ExecutionError;
}
```

**Our equivalent**: `OrchestrationResult` + `this.state` in WorkflowOrchestrator
```typescript
export interface OrchestrationResult {
    workflowId: string;
    runId: string;
    status: "success" | "error";
    nodeResults: Map<string, NodeExecutionResult>;  // Per-node results
    finalOutputs: Record<string, unknown>;          // this.state contents
    allEvents: StreamEvent[];
    errors: Array<{ nodeId?: string; error: Error }>;
}
```

❌ **Gap**: Our state storage is less structured than n8n's
- We store `this.state[nodeId] = outputs` as flat objects
- n8n stores hierarchical: `runData[nodeName][runIndex].data.main[branchIndex]`
- We lose branch/run index information

---

## The Context Problem

### Current Issue

We have **two incompatible interfaces** being used interchangeably:

1. **ExecuteFunctions** (implements IExecuteFunctions)
   - Used by: WorkflowOrchestrator
   - Interface from: `src/types/execution.ts`
   - Purpose: Helper methods for node execution

2. **ExecutionContext** (simple data structure)
   - Used by: Agent node
   - Interface from: `src/types/interfaces.ts:111-121`
   - Purpose: Lightweight context with inputs/properties

**The Problem**:
```typescript
// In WorkflowOrchestrator.ts:216
let result = await nodeInstance.execute(executeFunctions); // Passes ExecuteFunctions

// But Agent.ts:68 expects:
async execute(context: ExecutionContext): Promise<NodeExecutionData[][]>
```

This works because of TypeScript's structural typing, but creates confusion and limits functionality.

### n8n's Solution

n8n bridges this gap through:

1. **Execution Functions Factory** - Creates IExecuteFunctions from execution context
   - Location: `n8n-core/src/node-execution-context/execute-single-context.ts`
   - Wraps execution data into helper methods

2. **Context-Aware Nodes** - Nodes receive IExecuteFunctions
   - Access input data via `this.getInputData()`
   - Access parameters via `this.getNodeParameter()`
   - Return `INodeExecutionData[][]`

3. **Expression Evaluation** - Happens separately via WorkflowDataProxy
   - Parameters are pre-evaluated before execution
   - Nodes receive resolved values

---

## Proposed Solution

### Option 1: Align on ExecutionContext (Recommended)

**Goal**: Make ExecutionContext the single source of truth, deprecate ExecuteFunctions

**Changes Required**:

1. **Enhance ExecutionContext** to include helper methods:
```typescript
export interface ExecutionContext {
    // Current fields
    nodeId: string;
    nodeType: string;
    version: number;
    inputs: Record<string, any>;
    properties: Record<string, unknown>;
    evaluatedProperties: Record<string, any>;
    credentials?: Record<string, Record<string, any>>;
    signal?: AbortSignal;

    // NEW: Add helper methods
    getInputData(): INodeExecutionData[];
    getInputByHandle(handle: string): INodeExecutionData[] | undefined;
    getNodeParameter(name: string, defaultValue?: any): any;

    // NEW: Add execution state
    runIndex: number;
    itemIndex: number;

    // NEW: For agent resumption
    engineResponse?: EngineResponse<RequestResponseMetadata>;
}
```

2. **Update WorkflowOrchestrator** to create ExecutionContext:
```typescript
private async executeNode(nodeId: string, nodeData: any): Promise<void> {
    // Build ExecutionContext instead of ExecuteFunctions
    const context: ExecutionContext = {
        nodeId,
        nodeType: nodeData.data?.nodeType,
        version: nodeData.data?.nodeVersion || 1,
        inputs: this.prepareInputData(nodeId),
        properties: nodeData.data?.nodeInputs || {},
        evaluatedProperties: {}, // TODO: Evaluate expressions
        credentials: this.getCredentials(nodeId),
        signal: new AbortController().signal,
        runIndex: 0, // TODO: Support multiple runs
        itemIndex: 0, // TODO: Item-based execution

        // Helper methods
        getInputData: () => Object.values(context.inputs).flat(),
        getInputByHandle: (handle) => context.inputs[handle],
        getNodeParameter: (name, def) => context.evaluatedProperties[name] ?? def,
    };

    let result = await nodeInstance.execute(context);

    // Agent execution loop
    while (this.isEngineRequest(result)) {
        const response = await handleEngineRequest(result, { ... });
        context.engineResponse = response;
        result = await nodeInstance.execute(context);
    }
}
```

3. **Deprecate ExecuteFunctions** gradually:
   - Keep for backward compatibility
   - New nodes use ExecutionContext only
   - Migrate existing nodes over time

**Pros**:
- Single, clear context interface
- Agent resumption becomes natural (engineResponse field)
- Aligns with modern n8n architecture
- Type-safe and explicit

**Cons**:
- Requires updating all existing node implementations
- Breaking change (can be gradual)

### Option 2: Adapter Pattern (Quick Fix)

**Goal**: Create an adapter that converts ExecuteFunctions → ExecutionContext

**Changes Required**:

1. **Create ExecutionContextAdapter**:
```typescript
function createExecutionContext(
    executeFunctions: ExecuteFunctions,
    engineResponse?: EngineResponse
): ExecutionContext {
    return {
        nodeId: executeFunctions.nodeId,
        nodeType: executeFunctions.nodeType,
        version: executeFunctions.nodeVersion,
        inputs: executeFunctions.getInputData(),
        properties: executeFunctions.getNodeParameters(),
        evaluatedProperties: executeFunctions.getNodeParameters(), // Already evaluated
        credentials: {}, // TODO: Extract from executeFunctions
        signal: new AbortController().signal,
        engineResponse,
    };
}
```

2. **Use in WorkflowOrchestrator**:
```typescript
let result = await nodeInstance.execute(executeFunctions);

while (this.isEngineRequest(result)) {
    const response = await handleEngineRequest(result, { ... });
    const context = createExecutionContext(executeFunctions, response);
    result = await nodeInstance.execute(context as any);
}
```

**Pros**:
- Minimal changes required
- Works immediately
- Backward compatible

**Cons**:
- Maintains dual-context confusion
- Type casts required (`as any`)
- Not a long-term solution

---

## Recommended Path Forward

### Phase 1: Immediate Fix (Use Option 2)
1. Create `ExecutionContextAdapter` utility
2. Fix agent execution loop in WorkflowOrchestrator
3. Test end-to-end agent execution
4. Ship P0 functionality

### Phase 2: Proper Architecture (Use Option 1)
1. Design enhanced ExecutionContext interface
2. Update WorkflowOrchestrator to build ExecutionContext
3. Add expression evaluation (CEL or similar)
4. Migrate nodes to use ExecutionContext
5. Deprecate ExecuteFunctions

### Phase 3: Advanced Features
1. Add multi-run support (runIndex tracking)
2. Add item-based execution (itemIndex, loops)
3. Add branch support (multiple outputs per node)
4. Add pairedItem tracking for data lineage
5. Implement WorkflowDataProxy equivalent ($json, $input, etc.)

---

## Data Flow Comparison

### n8n Data Flow

```
Trigger Node
    ↓ produces INodeExecutionData[]
    ↓ stored in runData["Trigger"][0].data.main[0]
    ↓
Set Node (receives via IExecuteFunctions.getInputData())
    ↓ evaluates expressions using WorkflowDataProxy
    ↓ produces INodeExecutionData[]
    ↓ stored in runData["Set"][0].data.main[0]
    ↓
HTTP Request Node
    ↓ etc.
```

### Our Current Data Flow

```
Trigger Node
    ↓ produces INodeExecutionData[] (via ExecuteFunctions.emit())
    ↓ stored in state[nodeId] = { output: [...] }
    ↓
Set Node (receives via ExecuteFunctions.getInputData())
    ↓ NO expression evaluation yet
    ↓ produces INodeExecutionData[]
    ↓ stored in state[nodeId] = { output: [...] }
    ↓
Agent Node (receives via ExecutionContext)
    ↓ produces EngineRequest OR NodeExecutionData[][]
    ↓ if EngineRequest → execute tools → resume with EngineResponse
    ↓ stored in state[nodeId] = { output: [...] }
```

**Key Gaps**:
1. ❌ No expression evaluation ($json, etc.)
2. ❌ No runIndex/itemIndex tracking
3. ❌ No branch support (multiple outputs)
4. ❌ Inconsistent context (ExecuteFunctions vs ExecutionContext)

---

## Agent Execution Loop Detail

### n8n Agent Architecture

n8n's agent nodes use a **request-response pattern**:

1. Agent plans action → Returns `EngineRequest` (not stored in runData yet)
2. Engine executes tools → Returns `EngineResponse`
3. Agent resumes with response → Returns final `INodeExecutionData[][]`
4. Final output stored in `runData[agentNodeName][0].data.main[0]`

**Key Insight**: The intermediate tool calls are NOT stored as node outputs. Only the final result is.

### Our Agent Architecture (Current)

From `src/server/nodes/agent/execute.ts`:

```typescript
export async function executeAgent(
    context: ExecutionContext,
    response?: EngineResponse<RequestResponseMetadata>,
): Promise<NodeExecutionData[][] | EngineRequest<RequestResponseMetadata>>
```

**Signature Analysis**:
- Takes `ExecutionContext` (NOT ExecuteFunctions)
- Optionally takes `EngineResponse` for resumption
- Returns EITHER final data OR request for tools

This is correct! We just need WorkflowOrchestrator to handle it properly.

### Correct Implementation

```typescript
private async executeNode(nodeId: string, nodeData: any): Promise<void> {
    // Create ExecuteFunctions for most nodes
    const executeFunctions = new ExecuteFunctions(...);

    // Execute node
    let result = await nodeInstance.execute(executeFunctions);

    // Special handling for agent nodes
    if (nodeType === 'agent') {
        while (this.isEngineRequest(result)) {
            // Execute tools
            const response = await handleEngineRequest(result, {
                emit: (event) => this.config.logger.debug(event),
                signal: this.config.signal,
            });

            // Resume agent with response
            const context = this.createExecutionContext(executeFunctions, response);
            result = await nodeInstance.execute(context);
        }
    }

    // Store final result
    this.state[nodeId] = executeFunctions.getCollectedOutputs();
}

private createExecutionContext(
    executeFunctions: ExecuteFunctions,
    engineResponse?: EngineResponse
): ExecutionContext {
    return {
        nodeId: executeFunctions['nodeId'],
        nodeType: executeFunctions['nodeType'],
        version: executeFunctions['nodeVersion'],
        inputs: executeFunctions.getInputData(),
        properties: executeFunctions.getNodeParameters(),
        evaluatedProperties: executeFunctions.getNodeParameters(),
        credentials: {}, // TODO
        signal: new AbortController().signal,
        engineResponse,
    };
}
```

---

## Type Safety Improvements

### Current Type Issues

1. **Agent execute signature** uses TypeScript ignore:
```typescript
// src/server/nodes/agent/Agent.ts:69
// @ts-expect-error - Agent can return EngineRequest for tool execution (P0 extension)
return await executeAgent(context);
```

2. **INodeType interface** doesn't support EngineRequest return:
```typescript
// src/types/interfaces.ts:133-138
export interface INodeType {
    description: INodeTypeDescription;
    execute(context: ExecutionContext): Promise<NodeExecutionData[][]> | NodeExecutionData[][];
}
```

### Proposed Solution

**Option A**: Union return type (type-safe):
```typescript
export interface INodeType {
    description: INodeTypeDescription;
    execute(
        context: ExecutionContext
    ): Promise<NodeExecutionData[][] | EngineRequest> | NodeExecutionData[][];
}
```

**Option B**: Generic interface (more flexible):
```typescript
export interface INodeType<TResult = NodeExecutionData[][]> {
    description: INodeTypeDescription;
    execute(context: ExecutionContext): Promise<TResult> | TResult;
}

export class Agent implements INodeType<NodeExecutionData[][] | EngineRequest> {
    async execute(context: ExecutionContext) {
        return await executeAgent(context);
    }
}
```

**Recommendation**: Use Option A for simplicity. Most nodes return `NodeExecutionData[][]`, only agents return `EngineRequest`.

---

## Summary

### Current State
- ✅ Agent execution logic is correct (execute.ts)
- ✅ Tool execution handler is implemented (requestHandler.ts)
- ✅ LangGraph state machine is working (graph.ts)
- ❌ WorkflowOrchestrator doesn't handle agent loop properly
- ❌ ExecuteFunctions vs ExecutionContext mismatch
- ❌ No expression evaluation yet

### Immediate Action Items

1. **Fix WorkflowOrchestrator agent loop** (Phase 1)
   - Add `createExecutionContext()` helper
   - Detect agent nodes and handle loop
   - Pass EngineResponse on resumption

2. **Update INodeType interface** (Type safety)
   - Add union return type for EngineRequest
   - Remove @ts-expect-error from Agent.ts

3. **Test end-to-end execution** (Validation)
   - Create test workflow with agent node
   - Verify tool execution cycle
   - Verify final output storage

### Future Work

1. **Expression evaluation** (P1)
   - Implement CEL or simple template evaluation
   - Add $json, $input variable support
   - Evaluate properties before execution

2. **Enhanced state storage** (P1)
   - Add runIndex tracking
   - Add branch support (multiple outputs)
   - Store metadata (execution time, etc.)

3. **Item-based execution** (P2)
   - Execute nodes once per input item
   - Track itemIndex
   - Support pairedItem linking

---

## Next Steps

Proceed with **Phase 1: Immediate Fix** using the adapter pattern to unblock agent execution, then plan for proper architecture alignment in Phase 2.

# Execution Context API: Layered Architecture

## Overview

The `IExecuteFunctions` context is designed with three distinct layers, allowing different types of nodes to use only what they need, while maintaining flexibility for future framework integration.

## The Three Layers

### Layer 1: Core Orchestrator Capabilities

**Interface**: `IExecuteFunctionsCore`

Fundamental workflow platform capabilities - **framework-independent**.

```typescript
// Node Configuration
getNodeParameter(name: string): unknown
getNodeParameters(): Record<string, unknown>

// Input/Output
getInputData(): Record<string, INodeExecutionData[]>
getInputByHandle(handleName: string): INodeExecutionData[] | undefined
getInputValue(handleName: string): INodeExecutionData | undefined

setOutputData(outputData: INodeOutputData): void
setOutput(handleName: string, data: INodeExecutionData[]): void

// Secrets (encrypted access)
getSecret(secretName: string): Promise<string | undefined>

// Logging
log(level: "info" | "warn" | "error", message: string): void
logInfo(message: string): void
logWarn(message: string): void
logError(message: string): void

// Events
emitStreamEvent(type: StreamEventType, data: Record<string, unknown>): void
emitEvent(event: StreamEvent): void

// Metadata
getRunId(): string
getNodeId(): string
getNodeType(): string
getNodeVersion(): number
```

**Stability**: This API is stable and unlikely to change. All nodes rely on these methods.

**Use Cases**:
- Parameter access
- Data flow (inputs/outputs)
- Logging and monitoring
- Event emission

---

### Layer 2: Platform-Provided Execution Primitives

**Interface**: `IExecuteFunctionsPrimitives`

Higher-level capabilities provided by our platform (not by external frameworks).

```typescript
// HTTP/Network - Make secure API calls
httpRequest(options: {
  url: string
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}): Promise<{
  status: number
  headers: Record<string, string>
  data: unknown
  text: string
}>

// Code Execution - Run sandboxed code
executeSandboxedCode(options: {
  language: "python" | "javascript" | "bash"
  code: string
  timeout?: number
  environment?: Record<string, string>
  requirements?: string[]  // e.g., ["pandas", "numpy"] for Python
  input?: Record<string, unknown>
}): Promise<{
  success: boolean
  output: unknown
  stderr?: string
  duration: number
}>

// File System (within allowed paths)
readFile(path: string): Promise<string | Buffer>
writeFile(path: string, data: string | Buffer): Promise<void>
```

**Stability**: These are newer, but designed to be stable. They provide alternatives to framework-specific approaches.

**Use Cases**:
- Simple data transformers
- API callers (without LangChain)
- Python/JavaScript script nodes
- File processing
- Any node that doesn't need LangChain

**Example**: A node that calls a REST API without LangChain
```typescript
async execute(context: IExecuteFunctionsPrimitives) {
  const url = context.getNodeParameter("url");
  const response = await context.httpRequest({
    url,
    method: "GET"
  });
  context.setOutputData({
    result: [response.data]
  });
}
```

---

### Layer 3: AI Framework Integration - LangChain

**Interface**: `IExecuteFunctionsLangChain`

LangChain-specific capabilities for AI-powered nodes.

```typescript
// LLM/Chat Models
getLangchainModel(modelName?: string): BaseLanguageModel
getLangchainEmbeddings(embeddingsName?: string): Embeddings

// Tools & Agents
getLangchainTools(): Tool[]
getLangchainTool(toolName: string): Tool | undefined

// Future: Memory, etc.
// getConversationMemory(): BaseMemory
```

**Stability**: Most stable for AI-specific operations. Can be extended with additional frameworks without breaking existing nodes.

**Use Cases**:
- LLM call nodes
- Agent nodes
- RAG/embedding nodes
- Tool-using nodes
- Any complex AI workflow

**Example**: An LLM agent node
```typescript
async execute(context: IExecuteFunctionsLangChain) {
  const prompt = context.getNodeParameter("prompt");
  const model = context.getLangchainModel("gpt-4");
  const tools = context.getLangchainTools();

  const agent = await AgentExecutor.fromAgentAndTools({
    agent: createOpenAIToolsAgent(model, tools, prompt),
    tools
  });

  const result = await agent.invoke({ input: prompt });
  context.setOutputData({
    response: [result]
  });
}
```

---

## Node Usage Patterns

### Pattern 1: Simple Data Transformer (Core Only)

```typescript
// Only needs parameter access and input/output
async execute(context: IExecuteFunctionsCore) {
  const input = context.getInputValue("text");
  const output = String(input).toUpperCase();
  context.setOutput("text", [output]);
}
```

### Pattern 2: API Caller (Core + Primitives)

```typescript
// Needs HTTP without LangChain
async execute(context: IExecuteFunctionsPrimitives) {
  const endpoint = context.getNodeParameter("endpoint");
  const response = await context.httpRequest({
    url: endpoint,
    method: "POST",
    body: { data: context.getInputValue("data") }
  });
  context.setOutputData({
    response: [response.data]
  });
}
```

### Pattern 3: Python Script (Core + Primitives)

```typescript
// Execute arbitrary Python
async execute(context: IExecuteFunctionsPrimitives) {
  const code = context.getNodeParameter("code");
  const result = await context.executeSandboxedCode({
    language: "python",
    code,
    requirements: ["pandas", "numpy"],
    input: { data: context.getInputValue("data") }
  });
  context.setOutputData({
    output: [result.output]
  });
}
```

### Pattern 4: LLM Agent (All Layers)

```typescript
// Full power of LangChain
async execute(context: IExecuteFunctionsLangChain) {
  const prompt = context.getNodeParameter("prompt");
  const model = context.getLangchainModel("gpt-4");
  const tools = context.getLangchainTools();

  const agent = await AgentExecutor.fromAgentAndTools({
    agent: createOpenAIToolsAgent(model, tools, prompt),
    tools
  });

  const result = await agent.invoke({ input: prompt });
  context.setOutputData({
    response: [result]
  });
}
```

---

## Design Benefits

### 1. Flexibility

Nodes only depend on what they need:
- Simple nodes don't pay the cost of LangChain
- New frameworks can be added without breaking existing nodes
- Clear separation of concerns

### 2. Future-Proofing

Adding support for new frameworks is non-breaking:

```typescript
// Could add this layer in the future
export interface IExecuteFunctionsDSPy extends IExecuteFunctionsPrimitives {
  getDSPyModel(name?: string): DSPyModel
  // ...
}

// Existing nodes still work unchanged
```

### 3. Stability

Core layer is very unlikely to change. New capabilities go into higher layers.

### 4. Clarity

Each layer has a clear purpose and responsibility.

---

## Implementation Notes

### ExecuteFunctions Class

The `ExecuteFunctions` implementation provides all three layers:

```typescript
export class ExecuteFunctions implements IExecuteFunctions {
  // Implements Core + Primitives + LangChain
  // Subclasses or interfaces could restrict to specific layers
}
```

### Type Safety

Nodes can declare which layers they need:

```typescript
// Only needs core
async execute(context: IExecuteFunctionsCore) { }

// Needs primitives
async execute(context: IExecuteFunctionsPrimitives) { }

// Full context
async execute(context: IExecuteFunctions) { }
```

---

## Future Extensions

### Example: Adding a New Framework

```typescript
// LAYER 3B: AI FRAMEWORK INTEGRATION - DSPY (hypothetical future)
export interface IExecuteFunctionsDSPy extends IExecuteFunctionsPrimitives {
  getDSPyModel(name?: string): DSPyModel
  getDSPyProgram(name?: string): DSPyProgram
}

// Extend main interface
export interface IExecuteFunctions
  extends IExecuteFunctionsLangChain, IExecuteFunctionsDSPy {
}

// Existing LangChain nodes: no changes needed
// New DSPy nodes: use getDSPyModel()
```

### Example: Adding Primitives

```typescript
// Add database query capability
export interface IExecuteFunctionsPrimitives {
  // ... existing ...

  // New
  queryDatabase(options: {
    query: string
    params?: unknown[]
  }): Promise<unknown[]>
}
```

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system design
- [DYNAMIC_IO.md](./DYNAMIC_IO.md) - Variable template system
- `src/types/execution.ts` - Full type definitions
- `src/server/execution/ExecuteFunctions.ts` - Implementation

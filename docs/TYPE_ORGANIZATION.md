# Type Organization & Cleanup Plan

## Current State Analysis

### Directory Structure

```
src/types/                  # Shared/Core Types (client + server)
├── interfaces.ts           # Core node system interfaces (NEW: I-prefix convention)
├── execution.ts            # Execution context interfaces (layered architecture)
├── datatypes.ts            # Data type definitions
├── nodes.ts                # Node-specific types
├── workflow.ts             # Workflow types
└── credentials.ts          # Credential types

src/server/types/           # Server-Specific Types (server-only)
├── agent.ts                # LangGraph agent system types (complex, server-only)
└── api.ts                  # Zod schemas for API validation (server-only)
```

### ✅ Good Separation

1. **Shared types in `src/types/`** can be used by both client and server
2. **Server-only types in `src/server/types/`** keep server complexity isolated
3. **API types with Zod schemas** are server-specific validation logic
4. **Clean dependencies**: Client can import from `src/types/` without pulling in server dependencies

## ⚠️ Issues Identified

### Issue 1: `INodeExecutionData` Duplication

**Location 1: `src/types/execution.ts:27`**
```typescript
export type INodeExecutionData = TypedValue | unknown;

export type INodeOutputData = {
  [handleName: string]: INodeExecutionData[];
};
```

**Location 2: `src/types/interfaces.ts:144`**
```typescript
export interface INodeExecutionData {
  json?: Record<string, any>; // Main output data
  binary?: Record<string, Buffer>; // Binary data
  pairedItem?: number | number[]; // Link to input item
  error?: Error; // Error object if execution failed

  // Advanced n8n-like features
  metadata?: {
    subExecution?: {
      workflowId: string;
      executionId: string;
    };
    [key: string]: any;
  };
  evaluationData?: Record<string, any>;
  sendMessage?: string;
}
```

**Analysis**: These are **two different concepts** with the same name:
- `execution.ts` version: Simple type alias for data flowing between nodes (TypedValue system)
- `interfaces.ts` version: Structured n8n-style execution data with metadata

**Problem**: Confusing which to use, potential import conflicts

### Issue 2: `WorkflowDefinition` Naming Inconsistency

**Location 1: `src/types/workflow.ts:27`**
```typescript
export interface WorkflowDefinition {
  nodes: Record<string, WorkflowNode>;
  edges: WorkflowEdge[];
  viewport: WorkflowViewport;
  metadata?: { ... };
}
```

**Location 2: `src/types/interfaces.ts:217`**
```typescript
export interface IWorkflowDefinition {
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  viewport?: { ... };
}
```

**Location 3: `src/server/types/api.ts:64`**
```typescript
export const WorkflowDefinitionSchema = z.record(z.unknown());
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
```

**Analysis**: Three different versions:
- `workflow.ts`: Legacy/original definition with Record of nodes
- `interfaces.ts`: New n8n-style with array of nodes and `I` prefix
- `api.ts`: Zod schema version for API validation (loose Record type)

**Problem**: Unclear which is canonical, inconsistent `I` prefix usage

### Issue 3: Execution Context Overlap

**Location 1: `src/types/execution.ts:86`**
```typescript
export interface IExecuteFunctionsCore {
  getNodeParameter(name: string, defaultValue?: unknown): unknown;
  getNodeParameters(): Record<string, unknown>;
  // ... many methods
}
```

**Location 2: `src/types/interfaces.ts:118`**
```typescript
export interface IExecutionContext {
  nodeId: string;
  nodeType: string;
  version: number;
  inputs: Record<string, any>;
  properties: Record<string, unknown>;
  // ... helper methods
  getInputData?(): INodeExecutionData[];
  getNodeParameter?<T = any>(name: string, defaultValue?: T): T;
}
```

**Location 3: `src/types/workflow.ts:138`**
```typescript
export interface NodeExecutionContext {
  nodeId: string;
  workflowRunId: string;
  state: Record<string, unknown>;
  logger: Logger;
}
```

**Analysis**: Three overlapping execution context concepts:
- `execution.ts`: Layered architecture (Core → Primitives → LangChain)
- `interfaces.ts`: Modern n8n-style context for agents
- `workflow.ts`: Simple original context (legacy)

**Problem**: Unclear which context to use for new nodes

## 📋 Cleanup Plan

### Phase 1: Consolidate Execution Data Types (P0)

**Goal**: Single source of truth for `INodeExecutionData`

**Decision**:
- **Keep**: `src/types/interfaces.ts:144` as the canonical `INodeExecutionData`
- **Rename**: `src/types/execution.ts:27` → `NodeFlowData` or `TypedNodeData`
- **Rationale**: The n8n-style interface is more feature-complete and matches our execution engine design

**Actions**:
1. Rename in `src/types/execution.ts`:
   ```typescript
   // OLD
   export type INodeExecutionData = TypedValue | unknown;

   // NEW
   export type NodeFlowData = TypedValue | unknown;
   export type INodeOutputData = {
     [handleName: string]: NodeFlowData[];
   };
   ```

2. Update all imports that use the execution.ts version
3. Keep both temporarily, add deprecation comment

### Phase 2: Consolidate Workflow Definitions (P0)

**Goal**: Single canonical `WorkflowDefinition` type

**Decision**:
- **Keep**: `src/types/interfaces.ts` as canonical (matches n8n style, has `I` prefix)
- **Deprecate**: `src/types/workflow.ts` version (legacy)
- **Update**: `src/server/types/api.ts` to reference the canonical type

**Actions**:
1. In `src/types/workflow.ts`, add deprecation:
   ```typescript
   /**
    * @deprecated Use IWorkflowDefinition from interfaces.ts instead
    * This will be removed in Phase 2 cleanup
    */
   export interface WorkflowDefinition {
     // ... existing code
   }
   ```

2. In `src/server/types/api.ts`, import from interfaces:
   ```typescript
   import type { IWorkflowDefinition } from '@/types/interfaces';

   // Use proper schema based on IWorkflowDefinition
   export const WorkflowDefinitionSchema = z.object({
     nodes: z.array(z.any()), // TODO: proper IWorkflowNode schema
     edges: z.array(z.any()), // TODO: proper IWorkflowEdge schema
     viewport: z.object({
       x: z.number(),
       y: z.number(),
       zoom: z.number(),
     }).optional(),
   });

   export type WorkflowDefinition = IWorkflowDefinition;
   ```

3. Update all usages to use `IWorkflowDefinition`

### Phase 3: Execution Context Consolidation (P1)

**Goal**: Clear execution context hierarchy

**Decision**:
- **Keep**: `src/types/execution.ts` layered architecture (Core → Primitives → LangChain) for **implementation**
- **Keep**: `src/types/interfaces.ts` `IExecutionContext` for **agent nodes**
- **Deprecate**: `src/types/workflow.ts` `NodeExecutionContext` (legacy, too simple)
- **Document**: When to use which context

**Actions**:
1. Add clear documentation to each context type explaining usage
2. Create adapter pattern documentation (already implemented in WorkflowOrchestrator)
3. Deprecate `NodeExecutionContext` in workflow.ts

### Phase 4: Naming Convention Standardization (P1)

**Goal**: Consistent `I` prefix for all interface types

**Current State**:
- ✅ `IExecutionContext`, `INodeExecutionData`, `INodeType` (interfaces.ts - already using `I`)
- ❌ `WorkflowDefinition`, `NodeExecutionContext` (workflow.ts - no `I` prefix)
- ❌ `AgentTool`, `EngineRequest`, `AgentError` (agent.ts - no `I` prefix)

**Decision**:
- **Shared types** (`src/types/`): Use `I` prefix for interfaces
- **Server-only types** (`src/server/types/`): No `I` prefix (these are domain-specific, not shared contracts)
- **Type aliases**: No `I` prefix
- **Zod schemas**: No `I` prefix

**Actions**:
1. Rename in `src/types/workflow.ts`:
   - `WorkflowNode` → `IWorkflowNode`
   - `WorkflowEdge` → `IWorkflowEdge`
   - `NodeExecutionContext` → `INodeExecutionContext` (then deprecate)
   - Keep `WorkflowDefinition` → Already deprecated in favor of `IWorkflowDefinition`

2. Keep server types as-is:
   - `EngineRequest`, `AgentTool`, etc. (server-only, no `I` needed)

## 📖 Import Guidelines

### When to import from `src/types/`

✅ **Use for**:
- Client-side code
- Shared types across client/server
- Core platform interfaces (INodeType, IExecutionContext, etc.)

```typescript
import type { INodeExecutionData, IWorkflowDefinition } from '@/types/interfaces';
import type { IExecuteFunctions } from '@/types/execution';
```

### When to import from `src/server/types/`

✅ **Use for**:
- Server-only code
- Agent/LangGraph types
- API validation schemas

```typescript
import type { EngineRequest, AgentTool } from '@/server/types/agent';
import { WorkflowDefinitionSchema } from '@/server/types/api';
```

## 🎯 Clear Rules Summary

### Naming Convention
1. **Shared interfaces** in `src/types/`: Use `I` prefix (e.g., `INodeType`, `IWorkflowDefinition`)
2. **Server-only types** in `src/server/types/`: No `I` prefix (e.g., `EngineRequest`, `AgentTool`)
3. **Type aliases**: No `I` prefix (e.g., `NodeFlowData`)
4. **Zod schemas**: No `I` prefix, use `Schema` suffix (e.g., `WorkflowDefinitionSchema`)

### File Organization
1. **`src/types/interfaces.ts`**: Core node system contracts (canonical source)
2. **`src/types/execution.ts`**: Execution context implementation (layered API)
3. **`src/types/workflow.ts`**: Legacy types (mark for deprecation)
4. **`src/server/types/agent.ts`**: LangGraph agent system (server-only)
5. **`src/server/types/api.ts`**: Zod validation schemas (server-only)

### Execution Context Usage
1. **Agent nodes**: Use `IExecutionContext` from `interfaces.ts`
2. **Regular nodes**: Use `IExecuteFunctions` from `execution.ts`
3. **Future**: Unify on `IExecutionContext` (Phase 2 roadmap)

## 📝 Migration Checklist

### P0 (Critical - Do Now)
- [ ] Rename `INodeExecutionData` in `execution.ts` → `NodeFlowData`
- [ ] Update all imports of execution.ts version
- [ ] Deprecate `WorkflowDefinition` in workflow.ts
- [ ] Update api.ts to reference `IWorkflowDefinition`
- [ ] Document import guidelines (this file)

### P1 (Important - Next Sprint)
- [ ] Deprecate `NodeExecutionContext` in workflow.ts
- [ ] Standardize `I` prefix in workflow.ts types
- [ ] Create type usage examples
- [ ] Update all documentation with new import paths

### P2 (Future - Backlog)
- [ ] Remove deprecated types (after migration period)
- [ ] Create Zod schemas for all core types
- [ ] Add type tests to prevent future duplication
- [ ] Document type versioning strategy

## 🔍 Type Dependency Graph

```
Client/Server Shared (src/types/)
├── interfaces.ts (canonical source)
│   ├── INodeType
│   ├── IExecutionContext
│   ├── INodeExecutionData ⭐ (canonical)
│   ├── IWorkflowDefinition ⭐ (canonical)
│   └── IWorkflowNode, IWorkflowEdge
│
├── execution.ts (implementation)
│   ├── IExecuteFunctionsCore
│   ├── IExecuteFunctionsPrimitives
│   ├── IExecuteFunctionsLangChain
│   └── NodeFlowData (renamed from INodeExecutionData)
│
└── workflow.ts (legacy - deprecating)
    ├── WorkflowDefinition (⚠️ deprecated → use IWorkflowDefinition)
    └── NodeExecutionContext (⚠️ deprecated)

Server Only (src/server/types/)
├── agent.ts (LangGraph system)
│   ├── EngineRequest
│   ├── EngineResponse
│   ├── AgentTool
│   └── AgentError
│
└── api.ts (Zod schemas)
    ├── WorkflowDefinitionSchema → references IWorkflowDefinition
    └── Other API schemas
```

## 📚 Related Documentation

- [P0_CHARTER.md](./P0_CHARTER.md) - Mission and principles
- [architecture/EXECUTION_ENGINE.md](./architecture/EXECUTION_ENGINE.md) - Execution engine architecture
- [agents/EXECUTION_CONTEXT.md](./agents/EXECUTION_CONTEXT.md) - Execution context deep dive
- [DATATYPES.md](./DATATYPES.md) - Data type system

---

**Status**: Plan created, awaiting approval for execution
**Next**: Execute P0 checklist items

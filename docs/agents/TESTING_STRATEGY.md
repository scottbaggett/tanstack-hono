# Agent Execution Testing Strategy

## Overview

Comprehensive testing strategy for agent execution system, covering unit tests, integration tests, and end-to-end scenarios. Focuses on resilience, edge cases, and production-readiness.

---

## Test Pyramid

```
        ┌─────────────────┐
        │   E2E Tests     │  Full workflows with real LLMs
        │   (Manual + CI) │  Focus: User journeys
        └─────────────────┘
              ▲
              │
        ┌─────────────────┐
        │ Integration     │  Agent + Tools + Orchestrator
        │ Tests           │  Focus: Component interaction
        └─────────────────┘
              ▲
              │
        ┌─────────────────┐
        │  Unit Tests     │  Individual functions/classes
        │                 │  Focus: Logic correctness
        └─────────────────┘
```

---

## Unit Tests

### 1. Execution Context Adapter

**File**: `src/server/execution/__tests__/WorkflowOrchestrator.test.ts`

**Test Cases**:

```typescript
describe('WorkflowOrchestrator.createExecutionContext', () => {
    it('should create ExecutionContext from ExecuteFunctions', () => {
        // Test basic field mapping
    });

    it('should include engineResponse when resuming agent', () => {
        // Test agent resumption
    });

    it('should pass AbortSignal correctly', () => {
        // Test signal propagation
    });

    it('should stub runIndex and itemIndex to 0', () => {
        // Test execution tracking fields
    });

    it('should provide working helper methods', () => {
        // Test getInputData, getInputByHandle, getNodeParameter
    });

    it('should handle missing credentials gracefully', () => {
        // Test credential extraction (when TODO is implemented)
    });
});
```

**Priority**: P0 (Critical path)

### 2. EngineRequest Type Guard

**File**: `src/server/execution/__tests__/WorkflowOrchestrator.test.ts`

**Test Cases**:

```typescript
describe('WorkflowOrchestrator.isEngineRequest', () => {
    it('should return true for valid EngineRequest', () => {
        const request = {
            actions: [{ id: '1', type: 'ai_tool', tool: 'calculator', input: {} }],
            metadata: { nodeId: 'agent1', executionId: 'exec1' }
        };
        expect(orchestrator.isEngineRequest(request)).toBe(true);
    });

    it('should return false for NodeExecutionData[][]', () => {
        const data = [[{ json: { result: 'ok' } }]];
        expect(orchestrator.isEngineRequest(data)).toBe(false);
    });

    it('should return false for malformed objects', () => {
        expect(orchestrator.isEngineRequest({})).toBe(false);
        expect(orchestrator.isEngineRequest({ actions: 'not-array' })).toBe(false);
        expect(orchestrator.isEngineRequest(null)).toBe(false);
    });
});
```

**Priority**: P0

### 3. Tool Execution Handler

**File**: `src/server/execution/__tests__/requestHandler.test.ts`

**Test Cases**:

```typescript
describe('handleEngineRequest', () => {
    it('should execute single tool and return results', async () => {
        // Test calculator tool execution
    });

    it('should execute multiple tools in sequence', async () => {
        // Test calculator + search
    });

    it('should respect timeout quotas', async () => {
        // Test tool that exceeds timeoutMs
    });

    it('should respect output size quotas', async () => {
        // Test tool that returns too much data
    });

    it('should handle tool execution errors gracefully', async () => {
        // Test tool that throws error
    });

    it('should emit events during execution', async () => {
        // Test observability events
    });

    it('should abort on signal cancellation', async () => {
        // Test AbortSignal handling
    });
});
```

**Priority**: P0

### 4. Agent Execution Function

**File**: `src/server/nodes/agent/__tests__/execute.test.ts`

**Test Cases**:

```typescript
describe('executeAgent', () => {
    beforeEach(() => {
        // Mock LangChain components
    });

    it('should return EngineRequest on first execution with tools', async () => {
        // Agent plans to use calculator
    });

    it('should return final output when no tools needed', async () => {
        // Simple question with direct answer
    });

    it('should resume with EngineResponse', async () => {
        // Test resumption after tool execution
    });

    it('should handle max iterations limit', async () => {
        // Test halting rule
    });

    it('should detect no-progress loops', async () => {
        // Test duplicate tool call detection
    });

    it('should respect cancellation signal', async () => {
        // Test abort handling
    });

    it('should handle LLM errors gracefully', async () => {
        // Test OpenAI API failure
    });
});
```

**Priority**: P0

### 5. LangGraph State Machine

**File**: `src/server/agents/__tests__/graph.test.ts`

**Test Cases**:

```typescript
describe('createAgentGraph', () => {
    it('should create valid StateGraph', () => {
        // Test graph structure
    });

    it('should route from plan to tools when tool calls present', () => {
        // Test conditional edge
    });

    it('should route from plan to end when no tools', () => {
        // Test final output routing
    });

    it('should detect no-progress and halt', () => {
        // Test duplicate detection
    });

    it('should respect maxIterations', () => {
        // Test iteration limit
    });
});

describe('buildInitialState', () => {
    it('should create state with system and user messages', () => {});
});

describe('buildResumedState', () => {
    it('should add tool results as messages', () => {});
});
```

**Priority**: P1

---

## Integration Tests

### 1. Agent Execution Loop

**File**: `src/server/execution/__tests__/agent-loop.integration.test.ts`

**Test Cases**:

```typescript
describe('Agent Execution Loop (Integration)', () => {
    let orchestrator: WorkflowOrchestrator;

    beforeEach(() => {
        // Setup workflow with agent node + tools
    });

    it('should execute agent → tool → resume → final answer', async () => {
        // Test full loop with calculator
        // Assert: Agent calls calculator, resumes, returns answer
    });

    it('should handle multiple tool calls in sequence', async () => {
        // Test: calculator → search → calculator
    });

    it('should handle tool execution failure', async () => {
        // Test: Tool throws error, agent receives error response
    });

    it('should abort execution on signal', async () => {
        // Test: AbortController.abort() stops loop
    });

    it('should respect tool timeout quotas', async () => {
        // Test: Tool exceeds timeout, agent receives timeout error
    });

    it('should respect max iterations', async () => {
        // Test: Agent loops 5 times, then halts
    });

    it('should detect infinite loops', async () => {
        // Test: Agent calls same tool with same args repeatedly
    });
});
```

**Priority**: P0 (Critical for production)

### 2. Multi-Node Workflows

**File**: `src/server/execution/__tests__/workflow.integration.test.ts`

**Test Cases**:

```typescript
describe('Workflow Execution (Integration)', () => {
    it('should execute TextInput → Agent → Output', async () => {
        // Test data flow through nodes
    });

    it('should execute Agent → HttpRequest', async () => {
        // Test agent output as HTTP input
    });

    it('should execute IfElse → Agent (conditional)', async () => {
        // Test conditional routing to agent
    });

    it('should handle agent error and stop workflow', async () => {
        // Test error propagation
    });
});
```

**Priority**: P1

### 3. Tool Registry

**File**: `src/server/execution/__tests__/tool-registry.integration.test.ts`

**Test Cases**:

```typescript
describe('Tool Registration (Integration)', () => {
    it('should register calculator tool on startup', async () => {
        // Test loadNodes() registers tools
    });

    it('should register search tool on startup', async () => {});

    it('should make tools available to agent', async () => {
        // Test getTools() in langchain.ts
    });

    it('should validate tool schemas with Zod', async () => {
        // Test invalid input rejection
    });
});
```

**Priority**: P1

---

## End-to-End Tests

### Scenario 1: Simple Calculation

**Workflow**: `TextInput → Agent → Output`

**Setup**:
```json
{
  "nodes": {
    "input1": {
      "type": "textInput",
      "data": { "text": "What is 15 * 7?" }
    },
    "agent1": {
      "type": "agent",
      "data": {
        "systemPrompt": "You are a helpful assistant.",
        "promptType": "connect",
        "maxIterations": 5
      }
    },
    "output1": {
      "type": "output"
    }
  },
  "edges": [
    { "source": "input1", "target": "agent1" },
    { "source": "agent1", "target": "output1" }
  ]
}
```

**Expected Flow**:
1. Input provides "What is 15 * 7?"
2. Agent plans to use calculator
3. Agent returns `EngineRequest` with calculator(15 * 7)
4. Orchestrator executes calculator → 105
5. Agent resumes with result
6. Agent returns final answer: "105"
7. Output displays result

**Assertions**:
- Agent calls calculator exactly once
- Final output contains "105"
- No errors in execution

**Priority**: P0 (Critical path)

### Scenario 2: Multi-Tool Chain

**Workflow**: `TextInput → Agent → Output`

**Input**: "Search for the current Python version and tell me if it's greater than 3.10"

**Expected Flow**:
1. Agent searches for Python version → "3.13.0"
2. Agent uses calculator to compare 3.13 > 3.10 → true
3. Agent returns "Yes, Python 3.13 is greater than 3.10"

**Assertions**:
- Agent calls search tool
- Agent calls calculator tool
- Two iterations total
- Final answer is correct

**Priority**: P0

### Scenario 3: Tool Failure Recovery

**Workflow**: `TextInput → Agent → Output`

**Input**: "Calculate 100 / 0 and tell me the result"

**Expected Flow**:
1. Agent calls calculator(100 / 0)
2. Calculator returns error: "Division by zero"
3. Agent resumes with error
4. Agent explains error to user

**Assertions**:
- Calculator returns error (not throws)
- Agent receives error in EngineResponse
- Final output explains the issue

**Priority**: P1

### Scenario 4: Abort Signal

**Workflow**: `TextInput → Agent → Output`

**Setup**: Trigger abort after 2 seconds

**Expected**:
- Execution stops mid-loop
- Error: "Agent execution cancelled"
- No orphaned tool executions

**Priority**: P1

### Scenario 5: Max Iterations

**Workflow**: `TextInput → Agent → Output`

**Input**: "Keep calculating 1+1 until I say stop" (agent has maxIterations=3)

**Expected**:
- Agent loops 3 times
- Execution halts at iteration 3
- Final output: Partial result or timeout message

**Priority**: P1

### Scenario 6: No-Progress Detection

**Workflow**: `TextInput → Agent → Output`

**Input**: Force agent to call same tool repeatedly

**Expected**:
- Agent calls calculator("1+1") → 2
- Agent calls calculator("1+1") again → 2
- Agent calls calculator("1+1") third time → HALT
- Error: "No progress detected - duplicate tool calls"

**Priority**: P2

---

## Performance Tests

### Load Testing

**Goal**: Ensure system handles concurrent agent executions

**Test Cases**:
1. **10 Concurrent Agents**: Each executing simple calculation
2. **50 Concurrent Agents**: Mix of calculator and search tools
3. **100 Agent Executions**: Sequential, measure throughput

**Metrics**:
- P50, P95, P99 latency
- Success rate
- Memory usage
- Tool execution time

**Tools**: k6, Artillery, or custom script

**Priority**: P2

### Stress Testing

**Goal**: Find breaking points

**Test Cases**:
1. **Large Tool Outputs**: Search tool returns 100MB result
2. **Long-Running Tools**: Tool that takes 10 minutes
3. **Many Iterations**: Agent loops 100 times
4. **Deep Nesting**: Sub-workflows calling sub-workflows

**Priority**: P3

---

## Resilience Tests

### Chaos Engineering

**Test Cases**:

1. **Network Failures**:
   - OpenAI API returns 500 error
   - Timeout on LLM call
   - Rate limit (429) errors

2. **Tool Failures**:
   - Calculator throws exception
   - Search API unavailable
   - Tool times out

3. **System Failures**:
   - Out of memory during execution
   - Database connection lost
   - Redis cache unavailable

**Expected**:
- Graceful error handling
- Proper error messages to user
- No data loss
- System remains stable

**Priority**: P2

---

## Testing Tools and Framework

### Unit Testing

- **Framework**: Vitest (already in project)
- **Mocking**: vi.fn(), vi.mock()
- **Coverage Target**: 80%+ for agent execution code

### Integration Testing

- **Framework**: Vitest + Testcontainers (for DB)
- **LLM Mocking**: Mock ChatOpenAI responses
- **Test Fixtures**: Pre-defined workflow definitions

### E2E Testing

- **Manual**: Postman collection or Thunder Client
- **Automated**: Playwright + Hono test client
- **Environment**: Dedicated test environment with test API keys

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Agent Execution

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:coverage

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:integration

  e2e:
    runs-on: ubuntu-latest
    env:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_TEST }}
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:e2e
```

---

## Test Data Management

### Fixtures

**Location**: `src/server/__tests__/fixtures/`

**Files**:
- `workflows.ts` - Sample workflow definitions
- `execution-contexts.ts` - Mock ExecutionContext objects
- `engine-requests.ts` - Sample EngineRequest objects
- `engine-responses.ts` - Sample EngineResponse objects
- `llm-responses.ts` - Mock ChatOpenAI responses

### Test Credentials

**Environment Variables**:
```bash
# .env.test
OPENAI_API_KEY=sk-test-... # Dedicated test key with low rate limits
OPENAI_API_KEY_MOCK=mock   # For unit tests (no real API calls)
```

---

## Test Execution

### Local Development

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Specific file
pnpm test WorkflowOrchestrator.test.ts
```

### CI Pipeline

1. **Pre-commit**: Run unit tests (< 30s)
2. **PR Review**: Run unit + integration tests (< 5min)
3. **Merge to main**: Run full suite including E2E (< 15min)
4. **Nightly**: Run performance + resilience tests

---

## Success Criteria

### P0 (Must Have)

- ✅ All unit tests pass (80%+ coverage)
- ✅ Agent loop integration test passes
- ✅ E2E Scenario 1 & 2 pass
- ✅ No TypeScript errors
- ✅ Basic error handling works

### P1 (Should Have)

- ✅ All integration tests pass
- ✅ E2E Scenarios 3-5 pass
- ✅ Abort signal handling works
- ✅ Tool timeout enforcement works
- ✅ CI/CD pipeline configured

### P2 (Nice to Have)

- ✅ Performance tests baseline established
- ✅ E2E Scenario 6 (no-progress) works
- ✅ Chaos engineering tests pass
- ✅ Load testing shows acceptable latency

---

## Next Steps

1. **Create test file structure** (5min)
2. **Write unit tests for adapter** (30min)
3. **Write integration test for agent loop** (1hr)
4. **Create E2E Scenario 1 test** (30min)
5. **Run tests and fix issues** (ongoing)

**Estimated Time**: 2-3 hours for P0 tests

---

## References

- [n8n Testing Approach](https://github.com/n8n-io/n8n/tree/master/packages/@n8n/nodes-base/__tests__)
- [Vitest Best Practices](https://vitest.dev/guide/)
- [Testing LangChain Applications](https://python.langchain.com/docs/guides/testing)
- [Chaos Engineering Principles](https://principlesofchaos.org/)

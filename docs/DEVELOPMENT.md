# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for Postgres)
- PostgreSQL 14+

### Setup

1. **Install dependencies:**
```bash
pnpm install
```

2. **Start Postgres:**
```bash
docker-compose up -d
```

3. **Initialize database:**
```bash
pnpm run db:push
```

4. **Start development server:**
```bash
pnpm run dev
```

The API will be available at `http://localhost:5173/api`.

## Development Commands

### Database

```bash
# Generate migrations from schema changes
pnpm run db:generate

# Apply all pending migrations
pnpm run db:migrate

# Push schema directly (for development)
pnpm run db:push

# Open Drizzle Studio (browser UI for database)
pnpm run db:studio
```

### Type Checking & Linting

```bash
# TypeScript type check
pnpm run typecheck

# Lint code
pnpm run lint

# Format code
pnpm run format
```

### Building

```bash
# Build for production
pnpm run build
```

## Project Structure

```
src/
├── client/                     # Frontend (React + TanStack Router)
│   ├── components/
│   ├── pages/
│   ├── App.tsx
│   └── main.tsx
├── server/                     # Backend (Hono)
│   ├── db/
│   │   ├── schema.ts           # Database schema (Drizzle)
│   │   └── index.ts            # Database connection
│   ├── nodes/                  # Node implementations
│   │   ├── Node.ts             # Base class and registry
│   │   └── examples/
│   ├── execution/              # Execution engine
│   │   ├── WorkflowOrchestrator.ts
│   │   ├── ExecuteFunctions.ts
│   │   ├── InputResolver.ts
│   │   └── DataTypeHandler.ts
│   ├── routes/                 # API routes
│   │   └── workflows.ts
│   └── index.ts                # Server entry point
├── types/                      # Shared types
│   ├── workflow.ts
│   ├── execution.ts
│   └── datatypes.ts
└── docs/                       # Documentation
    ├── ARCHITECTURE.md
    ├── DATATYPES.md
    ├── DYNAMIC_IO.md
    ├── EXECUTION_CONTEXT.md
    ├── API.md
    └── DEVELOPMENT.md
```

## Creating a New Node

Nodes are the building blocks of workflows. Here's how to create one:

### 1. Extend the Node base class

```typescript
// src/server/nodes/examples/MyNode.ts
import { Node } from "../Node";
import type { IExecuteFunctions } from "../../types/execution";

export class MyNode extends Node {
  name = "MyNode";
  version = 1;

  description = {
    displayName: "My Node",
    description: "Does something interesting",
    category: "custom",
    inputs: [
      {
        displayName: "Input",
        name: "input",
        type: "string",
      },
    ],
    outputs: [
      {
        displayName: "Output",
        name: "output",
        type: "string",
      },
    ],
    properties: [
      {
        displayName: "Option",
        name: "option",
        type: "string",
        default: "value",
      },
    ],
  };

  async execute(context: IExecuteFunctions): Promise<void> {
    // Get input
    const input = context.getInputValue("input");

    // Get parameter
    const option = context.getNodeParameter("option");

    // Do something
    const result = String(input).toUpperCase();

    // Set output
    context.setOutput("output", [result]);
  }
}
```

### 2. Register the node

```typescript
// src/server/nodes/Node.ts
import { MyNode } from "./examples/MyNode";

export const nodeLoader = new NodeLoader();
nodeLoader.registerNodeType(new MyNode());
```

### 3. Use it in a workflow

Create a workflow with your node type:
```json
{
  "nodes": {
    "node-1": {
      "data": {
        "nodeType": "MyNode",
        "nodeInputs": {
          "option": "value"
        }
      }
    }
  },
  "edges": []
}
```

## Working with Dynamic Inputs

Use `{{variable}}` syntax to create dynamic inputs:

```typescript
class MyNode extends Node {
  // ...
  async execute(context: IExecuteFunctions): Promise<void> {
    const template = context.getNodeParameter("template");
    // template = "Hello {{name}}, you have {{count}} items"

    // The InputResolver automatically creates inputs for "name" and "count"
    // You can connect these from upstream nodes

    const resolved = context.getInputData();
    // resolved = {
    //   "name": ["Alice"],
    //   "count": [5]
    // }
  }
}
```

See [DYNAMIC_IO.md](./DYNAMIC_IO.md) for more details.

## Working with Data Types

The system supports rich data types beyond JSON:

```typescript
import { toTypedValue } from "../execution/DataTypeHandler";

async execute(context: IExecuteFunctions): Promise<void> {
  // Handle images
  const imageBuffer = await context.readFile("image.png");
  const typedImage = toTypedValue(imageBuffer, "image:png");
  context.setOutput("image", [typedImage]);

  // Handle CSV
  const csvData = toTypedValue("col1,col2\nval1,val2", "csv");
  context.setOutput("csv", [csvData]);
}
```

See [DATATYPES.md](./DATATYPES.md) for all supported types.

## Using LangChain

For AI nodes, use LangChain through the execution context:

```typescript
async execute(context: IExecuteFunctions): Promise<void> {
  const model = context.getLangchainModel("gpt-4");
  const tools = context.getLangchainTools();

  const agent = await AgentExecutor.fromAgentAndTools({
    agent: createOpenAIToolsAgent(model, tools, prompt),
    tools,
  });

  const result = await agent.invoke({ input: "..." });
  context.setOutputData({ response: [result] });
}
```

## Using Platform Primitives

For non-LangChain operations, use platform primitives:

```typescript
async execute(context: IExecuteFunctions): Promise<void> {
  // HTTP requests
  const response = await context.httpRequest({
    url: "https://api.example.com/data",
    method: "GET",
  });

  // Code execution
  const result = await context.executeSandboxedCode({
    language: "python",
    code: "print('hello')",
  });

  // File I/O
  const file = await context.readFile("data.txt");
  await context.writeFile("output.txt", "content");
}
```

See [EXECUTION_CONTEXT.md](./EXECUTION_CONTEXT.md) for the full API.

## Debugging

### Enable debug logging

Set environment variable:
```bash
DEBUG=* pnpm run dev
```

### Check database

Open Drizzle Studio:
```bash
pnpm run db:studio
```

Then navigate to http://localhost:3000

### Inspect workflow state

Add logging in your node:
```typescript
context.logInfo("Node state:", context.getInputData());
context.logInfo("Node outputs:", context.getCollectedOutputs?.());
```

## Testing

Create tests for your nodes:

```typescript
// src/server/nodes/examples/MyNode.test.ts
import { describe, it, expect } from "vitest";
import { MyNode } from "./MyNode";
import { ExecuteFunctions } from "../../execution/ExecuteFunctions";

describe("MyNode", () => {
  it("should uppercase input", async () => {
    const node = new MyNode();
    const context = {
      getNodeParameter: () => "uppercase",
      getInputValue: () => "hello",
      setOutput: (handle, data) => {
        expect(data).toEqual(["HELLO"]);
      },
    } as any;

    await node.execute(context);
  });
});
```

Run tests:
```bash
pnpm run test
```

## Performance Tips

1. **Use batching** - Process multiple items in a single node execution
2. **Stream results** - Use `emitStreamEvent()` for long-running operations
3. **Cache expensive operations** - LLM calls, API requests
4. **Optimize data types** - Use appropriate types for your data
5. **Profile with DevTools** - Check CPU and memory usage

## Common Errors

### "Node type not found"

Make sure the node is registered:
```typescript
nodeLoader.registerNodeType(new MyNode());
```

### "Variable not resolved"

Check that:
1. The input handle name matches the `{{variable}}` name
2. The upstream node's output handle is connected
3. The variable is in scope (between `{{` and `}}`)

### "Timeout"

Increase timeout for long-running operations:
```typescript
await context.executeSandboxedCode({
  code: "...",
  timeout: 60000, // 60 seconds
});
```

## Production Deployment

### Environment Setup

1. Set environment variables:
```bash
DATABASE_URL=postgres://user:pass@host/dbname
NODE_ENV=production
```

2. Build the app:
```bash
pnpm run build
```

3. Run migrations:
```bash
pnpm run db:migrate
```

4. Start the server:
```bash
pnpm start
```

### Security Considerations

1. **Enable authentication** - Add JWT or OAuth
2. **Restrict CORS** - Don't allow all origins
3. **Validate inputs** - All node parameters
4. **Use secrets management** - For API keys and credentials
5. **Sandbox code execution** - Isolate Python/JavaScript execution
6. **Rate limiting** - Prevent abuse

### Monitoring

1. **Log levels** - Use structured logging
2. **Error tracking** - Sentry or similar
3. **Performance metrics** - Execution times, queue depth
4. **Database health** - Connection pool, slow queries

## Contributing

1. Create a new branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run tests and type checks: `pnpm test && pnpm typecheck`
4. Commit: `git commit -m "feat: my feature"`
5. Push: `git push origin feature/my-feature`
6. Create a pull request

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [EXECUTION_CONTEXT.md](./EXECUTION_CONTEXT.md) - Execution API
- [API.md](./API.md) - REST API reference

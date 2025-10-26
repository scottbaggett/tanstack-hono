# Architecture Documentation

**See comprehensive documentation in [`docs/`](./docs/) directory**:
- [docs/INDEX.md](./docs/INDEX.md) - Start here
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System design
- [docs/DATATYPES.md](./docs/DATATYPES.md) - Rich data types
- [docs/DYNAMIC_IO.md](./docs/DYNAMIC_IO.md) - {{variable}} system

---

## Quick Overview

This is a full-stack TypeScript application combining:

**Frontend**:
- React 19 with concurrent features
- TanStack Router for type-safe routing with SSR
- Tailwind CSS v4 for styling
- Vite for build/dev server

**Backend**:
- Hono web framework
- TypeScript-first workflow builder
- PostgreSQL + Drizzle ORM
- LangChain for AI/LLM integration

**Architecture is designed for**:
- **Performance**: Fast SSR, efficient execution
- **Type Safety**: Full TypeScript coverage
- **Flexibility**: Rich data types, dynamic inputs/outputs
- **Scalability**: Dependency-based execution, streaming

## Technology Stack

### Frontend
- **React 19**: Latest React with concurrent features
- **TanStack Router**: Type-safe, file-based routing with data loading
- **Tailwind CSS v4**: Utility-first styling
- **Vite**: Build tool and dev server

### Backend
- **Hono**: Lightweight web framework (~12KB)
- **@hono/node-server**: Node.js adapter for Hono
- **Node.js**: Runtime environment

### Tooling
- **TypeScript**: Type safety across the stack
- **Biome**: Fast linting and formatting
- **Vitest**: Unit testing framework

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  React App (Hydrated)                              │     │
│  │  - TanStack Router (Client-side navigation)        │     │
│  │  - React Components                                │     │
│  │  - Tailwind CSS                                    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ↕ HTTP
┌─────────────────────────────────────────────────────────────┐
│                      Hono Server                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Middleware Stack                                  │     │
│  │  - Logger                                          │     │
│  │  - CORS                                            │     │
│  │  - Compression (Production)                        │     │
│  │  - Static File Serving (Production)                │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  API Routes (Optional)                             │     │
│  │  - /api/*                                          │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  SSR Handler                                       │     │
│  │  - TanStack Router SSR                             │     │
│  │  - React Rendering                                 │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow

### SSR Request Flow (Production)

1. **Client Request**: Browser requests `/about`
2. **Server Receives**: Hono server matches the request
3. **Route Matching**: TanStack Router matches `/about` route
4. **Data Loading**: Route loader functions execute (if defined)
5. **React Rendering**: Components render to HTML string
6. **HTML Response**: Server sends complete HTML with embedded data
7. **Client Hydration**: Browser downloads JS, React hydrates
8. **SPA Navigation**: Subsequent navigation happens client-side

### Development Request Flow

In development, Vite dev server handles:
- Hot Module Replacement (HMR)
- Fast refresh for React components
- On-demand compilation
- Source maps

The `@hono/vite-dev-server` plugin integrates Hono with Vite's dev server.

## Directory Structure

```
tanstack-hono/
├── src/
│   ├── routes/              # File-based routes (auto-discovered)
│   │   ├── __root.tsx       # Root layout (wraps all routes)
│   │   ├── index.tsx        # Home page (/)
│   │   ├── about.tsx        # About page (/about)
│   │   ├── error.tsx        # Error page
│   │   └── -test.ts         # Non-route utility (- prefix excludes)
│   ├── components/          # Reusable React components
│   │   └── Header.tsx       # Example component
│   ├── entry-client.tsx     # Client-side hydration entry point
│   ├── entry-server.tsx     # Hono server + SSR setup
│   ├── router.tsx           # Router configuration
│   ├── routerContext.tsx    # Router context type definitions
│   ├── routeTree.gen.ts     # AUTO-GENERATED route tree
│   └── styles.css           # Global styles + Tailwind
├── dist/                    # Build output
│   ├── client/              # Client bundle (browser)
│   │   └── static/          # JS, CSS, and other assets
│   └── server/              # Server bundle (Node.js)
│       └── index.js         # Server entry point
├── public/                  # Static assets (if needed)
├── .github/workflows/       # CI/CD pipelines
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── biome.json               # Biome configuration
└── package.json             # Dependencies and scripts
```

## Core Components

### 1. Entry Points

#### Client Entry (`src/entry-client.tsx`)
- Hydrates React app in the browser
- Sets up TanStack Router client-side
- Runs only in the browser

```tsx
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-router'
import { createRouter } from './router'

const router = createRouter()
hydrateRoot(document.getElementById('root')!, <StartClient router={router} />)
```

#### Server Entry (`src/entry-server.tsx`)
- Hono server setup
- Middleware configuration
- SSR rendering logic
- API routes (if any)

### 2. Routing System

#### File-Based Routing
Routes are automatically discovered from `src/routes/`:

```
src/routes/index.tsx       → /
src/routes/about.tsx       → /about
src/routes/blog/index.tsx  → /blog
src/routes/blog/$id.tsx    → /blog/:id (dynamic)
```

#### Route Definition
Each route file exports a `Route` object:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
  loader: async () => {
    // Optional: fetch data before rendering
    return { data: await fetchData() }
  },
})

function AboutPage() {
  const { data } = Route.useLoaderData()
  return <div>About</div>
}
```

#### Route Tree Generation
The `@tanstack/router-plugin` Vite plugin watches `src/routes/` and auto-generates `src/routeTree.gen.ts`. This file should never be edited manually.

### 3. Server-Side Rendering

SSR is handled by TanStack Router's `createRequestHandler`:

```tsx
app.use('*', async (c) => {
  const handler = createRequestHandler({
    request: c.req.raw,
    createRouter: () => createRouter(),
  })

  return await handler(({ responseHeaders, router }) => {
    return renderRouterToString({
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    })
  })
})
```

This:
1. Creates a router instance per request
2. Matches the route
3. Runs loaders
4. Renders React to string
5. Returns HTML

### 4. Build System

#### Two Build Modes

**Client Build** (`npm run build:client`):
- Builds browser bundle
- Output: `dist/client/`
- Includes assets (JS, CSS, images)

**Server Build** (`npm run build:server`):
- Builds Node.js server bundle
- Output: `dist/server/index.js`
- Includes SSR rendering logic

#### Vite Configuration

```typescript
export default defineConfig({
  plugins: [
    TanStackRouterVite(),  // Route generation
    react(),               // React support
    tailwindcss(),         // Tailwind v4
  ],
  build: {
    ssr: true,  // Enable SSR build
    rollupOptions: {
      input: {
        server: 'src/entry-server.tsx',
      },
    },
  },
})
```

## Data Loading

### Route Loaders
Routes can define loaders to fetch data before rendering:

```tsx
export const Route = createFileRoute('/users')({
  loader: async () => {
    const users = await fetch('/api/users').then(r => r.json())
    return { users }
  },
  component: UsersPage,
})
```

**Benefits:**
- Data available during SSR
- No loading states on initial render
- Type-safe data access

### Loader Execution
- **Server (SSR)**: Loaders run on the server during initial page load
- **Client (Navigation)**: Loaders run in the browser during client-side navigation

## Styling

### Tailwind CSS v4
- Configured via `@tailwindcss/vite` plugin
- Global styles in `src/styles.css`
- Utility-first approach

```css
/* src/styles.css */
@import "tailwindcss";

/* Custom utilities or components */
@layer components {
  .btn {
    @apply px-4 py-2 bg-blue-500 text-white rounded;
  }
}
```

## Middleware

### Hono Middleware Stack
```tsx
app.use(logger())      // Request logging
app.use(cors())        // CORS headers
app.use(compress())    // Gzip compression (production)
```

### Custom Middleware
Add your own middleware:

```tsx
import { myMiddleware } from './middleware'
app.use(myMiddleware())
```

## API Routes

Add API routes in `src/entry-server.tsx`:

```tsx
app.get('/api/users', async (c) => {
  const users = await db.getUsers()
  return c.json({ users })
})

app.post('/api/users', async (c) => {
  const body = await c.req.json()
  const user = await db.createUser(body)
  return c.json({ user }, 201)
})
```

## Type Safety

### Router Types
TanStack Router generates types for:
- Route paths
- Loader data
- Search params
- Route context

```tsx
// Type-safe navigation
<Link to="/blog/$id" params={{ id: '123' }}>View Post</Link>

// Type-safe data access
const { users } = Route.useLoaderData()  // `users` is typed
```

### Shared Types
Define shared types in separate files:

```typescript
// types/user.ts
export interface User {
  id: string
  name: string
  email: string
}
```

## Performance Optimizations

### Production Optimizations
- **Code Splitting**: Vite automatically splits code
- **Tree Shaking**: Unused code is removed
- **Minification**: JS and CSS are minified
- **Compression**: Gzip compression via Hono middleware
- **Static Asset Caching**: Assets served with cache headers

### SSR Benefits
- **Faster FCP**: First Contentful Paint happens sooner
- **Better SEO**: Search engines see fully rendered HTML
- **Progressive Enhancement**: Works without JavaScript
- **Social Sharing**: Rich previews with meta tags

### Potential Bottlenecks
- Large component trees increase SSR time
- Slow API calls in loaders block rendering
- Unoptimized images increase bundle size

### Optimization Strategies
1. **Code Splitting**: Use `React.lazy()` for large components
2. **Data Caching**: Cache API responses
3. **Image Optimization**: Use WebP, responsive images
4. **Bundle Analysis**: Use `npm run build:analyze`

## Deployment Strategies

### 1. Docker (Recommended)
```bash
docker build -t tanstack-hono .
docker run -p 3000:3000 tanstack-hono
```

### 2. Serverless (Vercel, Netlify)
- Deploy as serverless functions
- Automatic scaling
- Edge network distribution

### 3. Containers (Railway, Render)
- Deploy Docker container
- Persistent instances
- Built-in load balancing

### 4. VPS (DigitalOcean, AWS EC2)
- Use PM2 for process management
- Nginx as reverse proxy
- Manual scaling

### 5. Edge (Cloudflare Workers)
- Deploy to edge network
- Ultra-low latency
- Requires Hono edge adapter

## Security Considerations

### Environment Variables
- Never commit `.env` files
- Use `VITE_` prefix for client-side vars
- Rotate secrets regularly

### Input Validation
- Validate all user input
- Use a validation library (Zod)
- Sanitize HTML to prevent XSS

### CORS Configuration
```tsx
app.use(cors({
  origin: ['https://example.com'],
  credentials: true,
}))
```

### Rate Limiting
Consider adding rate limiting:
```tsx
import { rateLimiter } from 'hono-rate-limiter'
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }))
```

## Testing Strategy

### Unit Tests
- Test individual components
- Test utility functions
- Use Vitest + Testing Library

### Integration Tests
- Test route loaders
- Test API endpoints
- Test SSR rendering

### E2E Tests (Optional)
- Use Playwright or Cypress
- Test critical user flows

## Extending the Template

### Adding a Database
1. Install database client (e.g., Prisma, Drizzle)
2. Add connection in `entry-server.tsx`
3. Use in route loaders or API routes

### Adding Authentication
1. Choose auth strategy (JWT, session, OAuth)
2. Add auth middleware
3. Protect routes in loader

### Adding State Management
- TanStack Router handles most routing state
- Use React Context for global UI state
- Consider TanStack Query for server state

## Common Patterns

### Protected Routes
```tsx
export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const user = await getUser()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
})
```

### Error Handling
```tsx
export const Route = createFileRoute('/users')({
  component: UsersPage,
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
})
```

### Layout Routes
```tsx
// src/routes/__root.tsx
export const Route = createRootRoute({
  component: () => (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  ),
})
```

## Design Decisions

### Why Hono?
- **Lightweight**: ~12KB, minimal overhead
- **Fast**: Optimized for performance
- **Edge-Ready**: Works on Cloudflare Workers, Deno, Bun
- **Express-like API**: Familiar middleware pattern

### Why TanStack Router?
- **Type Safety**: Full TypeScript support
- **File-Based**: Convention over configuration
- **SSR Support**: First-class SSR support
- **Data Loading**: Built-in loader pattern

### Why Vite?
- **Fast HMR**: Instant feedback during development
- **Modern**: ESM-based, optimized for modern browsers
- **Plugin Ecosystem**: Rich plugin ecosystem

### Why Biome?
- **Speed**: 100x faster than ESLint + Prettier
- **All-in-One**: Linting + formatting in one tool
- **Compatible**: Drop-in replacement for ESLint/Prettier

## Future Enhancements

Potential additions to consider:
- [ ] Database integration example
- [ ] Authentication example
- [ ] TanStack Query integration
- [ ] Internationalization (i18n)
- [ ] Progressive Web App (PWA) support
- [ ] E2E testing setup
- [ ] Monitoring and error tracking
- [ ] Advanced caching strategies

## Resources

- [TanStack Router Docs](https://tanstack.com/router)
- [Hono Docs](https://hono.dev)
- [Vite SSR Guide](https://vitejs.dev/guide/ssr.html)
- [React 19 Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com)

## Questions?

For more information:
- Check [AGENTS.md](AGENTS.md) for AI agent guidelines
- Check [CLAUDE.md](CLAUDE.md) for Claude-specific context
- Check [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
- Review existing code in `src/` for patterns

---

# Workflow Builder Architecture

On top of the TanStack Hono SSR foundation, we're building a fully-typed, LangChain-powered AI workflow builder. This section documents that subsystem.

## Workflow Builder Overview

A TypeScript-first, LangChain-powered workflow builder that allows users to compose nodes into directed acyclic graphs (DAGs) for AI-powered processing pipelines.

**Core Principle**: LangChain IS the execution engine. Nodes use LangChain directly for LLM calls, chains, agents, tools. The orchestrator handles graph execution, state management, and event streaming.

## Workflow Builder Tech Stack

**New Dependencies:**
- `drizzle-orm` + `postgres` - Database layer
- `@langchain/core`, `@langchain/openai`, `langchain` - LLM and agent framework
- Docker Postgres - Development database

## Workflow Execution Flow

```
User Submits Workflow
        ↓
API creates WorkflowRun
        ↓
WorkflowOrchestrator starts
    ├─ Topological sort (Kahn's algorithm)
    ├─ For each node in execution order:
    │  ├─ Prepare input data (collect outputs from state)
    │  ├─ Create ExecuteFunctions context
    │  ├─ Call node.execute(context)
    │  │  └─ Node uses LangChain directly
    │  │  └─ Node emits streaming events
    │  ├─ Collect outputs → state
    │  ├─ Collect events
    │  └─ Store NodeExecution record
    │
    └─ Return final outputs + all events
        ↓
API streams events via SSE to frontend
        ↓
Store WorkflowRun + execution history to database
```

## Node System

### Node Base Class

Located in `src/server/nodes/Node.ts`.

```typescript
export abstract class Node implements INodeType {
  abstract description: INodeTypeDescription;

  execute?(context: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  webhook?(context: IWebhookFunctions): Promise<IWebhookResponseData>;
  poll?(context: IPollFunctions): Promise<INodeExecutionData[][] | null>;
}
```

**Three Execution Modes:**
1. **execute** - Regular node execution (primary)
2. **webhook** - Handle incoming webhooks
3. **poll** - Polling-based triggers

**Versioning Support:**
Nodes are registered with version numbers for backwards compatibility.

### Node Description

Each node declares its interface via `INodeTypeDescription`:

```typescript
interface INodeTypeDescription {
  displayName: string;        // "Text Transform"
  name: string;               // "textTransform"  (unique ID)
  version: number;            // 1
  category: string;           // "processing"
  description?: string;
  inputs: Array<...>;         // Input handles
  outputs: Array<...>;        // Output handles
  properties: Array<...>;     // Configurable parameters
  // ... more metadata
}
```

### Example Node

See `src/server/nodes/examples/TextTransformNode.ts` for a complete example.

## Execution Context API

Nodes receive `IExecuteFunctions` during execution. This context provides access to:

```typescript
interface IExecuteFunctions {
  // === Node Configuration ===
  getNodeParameter(name: string, defaultValue?: unknown): unknown;
  getNodeParameters(): Record<string, unknown>;

  // === Input Data (from previous nodes) ===
  getInputData(): Record<string, INodeExecutionData[]>;
  getInputByHandle(handleName: string): INodeExecutionData[] | undefined;
  getInputValue(handleName: string): INodeExecutionData | undefined;

  // === LangChain Integration (THE ENGINE) ===
  getLangchainModel(modelName?: string): BaseLanguageModel;
  getLangchainEmbeddings(embeddingsName?: string): Embeddings;
  getLangchainTools(): Tool[];
  getLangchainTool(toolName: string): Tool | undefined;

  // === Secrets ===
  getSecret(secretName: string): Promise<string | undefined>;

  // === Output ===
  setOutputData(outputData: INodeOutputData): void;
  setOutput(handleName: string, data: INodeExecutionData[]): void;

  // === Streaming & Events ===
  emitStreamEvent(eventType: StreamEventType, data: Record<string, unknown>): void;
  emitEvent(event: StreamEvent): void;

  // === Logging ===
  log(level: "info" | "warn" | "error", message: string, data?: unknown): void;
  logInfo(message: string, data?: unknown): void;
  logWarn(message: string, data?: unknown): void;
  logError(message: string, data?: unknown): void;

  // === Metadata ===
  getRunId(): string;
  getNodeId(): string;
  getNodeType(): string;
  getNodeVersion(): number;
}
```

### Why This Design?

- **Nodes are pure**: They take context, use LangChain, emit events, set outputs
- **LangChain is embedded**: No request/response pattern needed
- **Extensible**: New context methods can be added without breaking existing nodes
- **Streaming-friendly**: Nodes emit events in real-time as LangChain processes data

## WorkflowOrchestrator

Located in `src/server/execution/WorkflowOrchestrator.ts`.

**Responsibilities:**
1. Load workflow definition (nodes, edges, viewport)
2. Perform topological sort to determine execution order
3. Execute nodes in dependency order
4. Manage execution state (collect node outputs)
5. Emit events for real-time updates
6. Handle errors and stop execution
7. Return complete execution results

**Topological Sort (Kahn's Algorithm):**
Ensures nodes execute only after all their dependencies are satisfied.

```
Input → Transform → LLM → Output
  ↑         ↑         ↑       ↑
  └─────────┴─────────┴───────┘
  Execution order: Input → Transform → LLM → Output
```

## Database Schema

### Core Tables

**users**
- `id` (UUID)
- `email` (unique)
- `username` (unique)
- `created_at`, `updated_at`

**workflows**
- `id` (UUID)
- `owner_id` (foreign key → users)
- `name`
- `definition` (JSONB - stores nodes, edges, viewport)
- `created_at`, `updated_at`

**workflow_runs**
- `id` (UUID)
- `workflow_id` (foreign key → workflows)
- `owner_id` (foreign key → users)
- `status` (pending, running, completed, failed)
- `inputs` (JSONB - workflow input parameters)
- `outputs` (JSONB - final results)
- `error_message`
- `started_at`, `completed_at`
- `total_tokens_used`, `duration_ms`

**node_executions**
- `id` (UUID)
- `run_id` (foreign key → workflow_runs)
- `node_id` (string from workflow definition)
- `node_type` (string - the node type name)
- `status` (pending, running, completed, failed, skipped)
- `inputs` (JSONB)
- `outputs` (JSONB)
- `tokens_used`, `error_message`
- `started_at`, `completed_at`

**execution_events**
- `id` (UUID)
- `run_id` (foreign key → workflow_runs)
- `event_type` (workflow_start, node_start, token, log, etc)
- `node_id` (optional - for node-specific events)
- `event_data` (JSONB)
- `timestamp`

**node_definitions**
- `id` (UUID)
- `node_type` (unique)
- `display_name`
- `category`
- `description`
- `input_schema`, `output_schema` (JSONB)
- `documentation`
- `is_built_in` (boolean)

### Design Patterns

- **JSONB for flexibility**: Workflow definitions, event data, inputs/outputs
- **Indexed for performance**: Foreign keys, status, timestamps
- **Events for replay**: Full execution history stored for debugging/audit
- **Soft schema**: Nodes can define their own input/output schemas

## Event Streaming

### Stream Event Types

```typescript
type StreamEventType =
  | "token"           // LLM token output
  | "log"             // Logging message
  | "tool_call"       // Tool invocation
  | "tool_result"     // Tool result
  | "agent_action"    // Agent taking action
  | "agent_finish"    // Agent finished
  | "chain_start"     // Chain started
  | "chain_end"       // Chain completed
  | "custom";         // Custom event
```

### Event Flow

1. **Node emits event** via `context.emitStreamEvent(type, data)`
2. **Orchestrator collects** events from all nodes
3. **API streams via SSE** to connected clients
4. **Frontend displays** in real-time (logs, tokens, etc)
5. **Database stores** complete event history

## LangChain Integration

Nodes access LangChain through the execution context:

```typescript
async execute(context: IExecuteFunctions) {
  const model = context.getLangchainModel("gpt-4");
  const tools = context.getLangchainTools();

  // Use LangChain directly
  const agent = await AgentExecutor.fromAgentAndTools({
    agent: createOpenAIToolsAgent(model, tools, prompt),
    tools,
  });

  // Node handles streaming internally
  const result = await agent.invoke({ input: userInput });

  // Emit events for real-time updates
  context.emitStreamEvent("log", { message: result });

  // Set output for downstream nodes
  context.setOutput("result", [result]);

  return [[result]];
}
```

**No request/response pattern needed** - nodes call LangChain directly and emit events as data flows through.

## Node Registration

Nodes must be registered with the `NodeLoader` to be available:

```typescript
const versionedNode: IVersionedNodeType = {
  description: new MyNode().description,
  currentVersion: 1,
  nodeVersions: {
    1: new MyNode(),
  },
  getNodeType(version?: number) {
    const v = version ?? this.currentVersion;
    return this.nodeVersions[v];
  },
};

nodeLoader.registerNode(versionedNode);
```

Nodes are typically registered at server startup by importing node files.

## Workflow Builder Directory Structure

```
src/
├── types/
│   ├── workflow.ts          # Workflow types (nodes, edges, definitions)
│   └── execution.ts         # Execution context interfaces
│
├── server/
│   ├── nodes/
│   │   ├── Node.ts          # Base Node class, INodeType, NodeLoader
│   │   └── examples/
│   │       ├── TextTransformNode.ts
│   │       └── LLMNode.ts
│   │
│   ├── execution/
│   │   ├── ExecuteFunctions.ts      # IExecuteFunctions implementation
│   │   └── WorkflowOrchestrator.ts  # Core execution orchestration
│   │
│   └── db/
│       ├── index.ts         # Drizzle DB instance
│       ├── schema.ts        # Database schema
│       └── migrations/      # Auto-generated migrations
│
└── routes/
    └── api/
        └── workflows.ts     # API endpoints for workflows
```

## Database Setup

### Docker

```bash
docker-compose up postgres
```

Starts PostgreSQL at `localhost:5432` with database `workflow_builder`.

### Migrations

```bash
# Generate migrations from schema
npm run db:generate

# Apply migrations
npm run db:migrate

# Or push directly (development)
npm run db:push

# View/manage data
npm run db:studio
```

## Type Safety Throughout

The entire workflow system is fully typed:

- **Workflow definitions** - `WorkflowDefinition` type
- **Node descriptions** - `INodeTypeDescription` interface
- **Execution contexts** - `IExecuteFunctions` interface
- **Database models** - Drizzle ORM types
- **API responses** - Full type coverage

This enables:
- Compile-time safety
- IDE autocomplete
- Self-documenting code
- Runtime type guards where needed

## Future Enhancements

### Webhook Support
```typescript
async webhook(context: IWebhookFunctions) {
  const request = context.getWebhookRequest();
  // Process webhook and trigger workflow
  context.triggerWorkflowRun(outputData);
}
```

### Polling Support
```typescript
async poll(context: IPollFunctions) {
  const lastPoll = context.getLastPollTime();
  // Fetch new items since last poll
  const items = await fetchNewItems(lastPoll);
  return [items];
}
```

### Advanced Features
- [ ] Node versioning and migrations
- [ ] Conditional branching
- [ ] Loop support
- [ ] Sub-workflows
- [ ] Caching/memoization
- [ ] Cost tracking and limits
- [ ] Node templates/presets
- [ ] Collaborative editing

# AI Workflow Builder

A **TypeScript-powered AI workflow builder** platform with a modern full-stack architecture. Build, execute, and monitor complex workflows combining APIs, Python/JavaScript scripts, and LLM agents—all through an intuitive interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- pnpm (recommended)

### 1. Start PostgreSQL

```bash
docker run -d --name workflow-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=workflow_builder \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` and set (or leave defaults):
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workflow_builder
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY=7d
```

### 3. Install & Setup

```bash
pnpm install
pnpm run db:push
pnpm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** → Sign up → Start building workflows!

**API Health**: [http://localhost:5173/api/health](http://localhost:5173/api/health)

## ✨ Core Features

### Workflow Engine
- **📊 Topological Sort**: Automatic dependency resolution and execution ordering
- **🔀 Dynamic Routing**: Connect nodes with flexible {{variable}} placeholders
- **🎯 20+ Data Types**: Seamless handling of strings, numbers, images, CSV, JSON, and more
- **📡 Real-time Events**: Server-Sent Events for live execution progress

### Node System
- **🧩 Modular Design**: Versioned, extensible node architecture
- **🔗 Three Execution Modes**: execute, webhook, poll
- **🛡️ Type Safety**: Full TypeScript support across all nodes

### Execution Capabilities
- **🤖 LangChain Integration**: First-class support for AI models and agents
- **🌐 HTTP Requests**: Call any REST API with automatic error handling
- **🐍 Code Execution**: Python, JavaScript, Bash in sandboxed environments
- **📁 File I/O**: Read/write files with workspace security

### Authentication
- **🔐 JWT Auth**: Secure token-based authentication
- **🔑 Password Hashing**: Bcrypt for secure password storage
- **🛡️ Protected Routes**: All API endpoints require authentication

### Frontend
- **⚡ TanStack Router**: Type-safe file-based routing
- **🎨 Shadcn/ui**: Beautiful, accessible component library
- **📝 Login/Signup**: Built-in authentication UI
- **🔐 Route Protection**: Automatic redirection for unauthenticated users

## 🏗️ Architecture

```
Frontend (React + TanStack Router)
         ↓
    Hono API Server
         ↓
  WorkflowOrchestrator (Topological Sort)
         ↓
    [Node Execution Layer]
         ↓
  ┌─────────────────────┐
  │ Layer 1: Core       │ (Parameter access, I/O, logging)
  ├─────────────────────┤
  │ Layer 2: Primitives │ (HTTP, code execution, file I/O)
  ├─────────────────────┤
  │ Layer 3: LangChain  │ (Models, embeddings, tools)
  └─────────────────────┘
         ↓
PostgreSQL Database
```

## 🛠 Development Commands

```bash
pnpm run dev           # Start dev server
pnpm run build         # Build for production
pnpm run db:studio    # Open database UI (Drizzle Studio)
pnpm run db:push      # Push schema to database
pnpm run check        # Lint and type check
pnpm run test         # Run tests
```



## 🔄 SSR Flow

1. **Request**: Browser requests a URL
2. **Server**: Hono matches route and runs TanStack Router SSR
3. **Render**: React components render to HTML string
4. **Response**: Full HTML sent to browser with embedded data
5. **Hydration**: Client-side React takes over for SPA navigation

## 🗺 File-Based Routing

Routes are automatically generated from files in `src/routes/`:

```tsx
// src/routes/about.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return <div>About us!</div>;
}
```

### 🔗 Navigation

```tsx
import { Link } from "@tanstack/react-router";

<Link to="/about">About</Link>
```

### 📊 Data Loading

```tsx
export const Route = createFileRoute("/users")({
  loader: async () => {
    const users = await fetch("/api/users").then((r) => r.json());
    return { users };
  },
  component: UsersPage,
});

function UsersPage() {
  const { users } = Route.useLoaderData();
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## 🏠 Layouts with SSR

The root layout (`src/routes/__root.tsx`) wraps all pages:

```tsx
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Header } from "../components/Header";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

## ⚡ Performance Benefits

**SSR Advantages:**

- **SEO**: Fully rendered HTML for search engines
- **LCP**: Faster Largest Contentful Paint
- **Progressive Enhancement**: Works without JavaScript
- **Social Sharing**: Rich preview cards with meta tags

**Hono Benefits:**

- **Small Bundle**: Minimal server overhead
- **Edge Ready**: Deploy to Cloudflare Workers, etc.
- **Fast Startup**: Quick cold start times

## 🐳 Docker Support

### Using Docker

```bash
# Build and run production
docker-compose up app

# Development with hot reload
docker-compose --profile dev up dev
```

### Building the Image

```bash
docker build -t tanstack-hono .
docker run -p 3000:3000 tanstack-hono
```

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to:

- **Docker**: Use included Dockerfile and docker-compose.yml
- **Vercel/Netlify**: Serverless functions
- **Railway/Render**: Container deployments
- **Cloudflare Workers**: Edge runtime
- **VPS**: With PM2 + Nginx

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed deployment strategies.

## 📚 Documentation

- **[AGENTS.md](AGENTS.md)** - Guide for AI agents working with this codebase
- **[CLAUDE.md](CLAUDE.md)** - Claude-specific context and patterns
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Deep dive into system design
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[SECURITY.md](SECURITY.md)** - Security policy and best practices

## 🤖 AI-Friendly

This template includes comprehensive documentation for AI coding assistants:
- `.cursorrules` for Cursor IDE
- `AGENTS.md` for general AI agent guidelines
- `CLAUDE.md` for Claude-specific context

## 📖 Learn More

- [TanStack Router](https://tanstack.com/router) - Type-safe routing
- [Hono](https://hono.dev) - Ultrafast web framework
- [SSR Guide](https://tanstack.com/router/latest/docs/framework/react/guide/ssr) - TanStack Router SSR
- [Vite SSR](https://vitejs.dev/guide/ssr.html) - Vite server-side rendering

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

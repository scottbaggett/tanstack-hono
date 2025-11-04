# API Types - Type-Safe Backend-to-Frontend Communication

This document explains how we leverage Hono's type system to automatically generate types from the backend API to the frontend.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│   Backend (Hono API Router)             │
│  ┌──────────────────────────────────┐   │
│  │ src/server/api.ts                │   │
│  │ (Main API router definition)      │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ src/server/types/api.ts          │   │
│  │ (Zod schemas for validation)     │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ src/server/routes/*.ts           │   │
│  │ (Route handlers)                 │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓
        Type Inference
              ↓
┌─────────────────────────────────────────┐
│   Frontend (React + Type Safety)        │
│  ┌──────────────────────────────────┐   │
│  │ src/lib/api-client.ts            │   │
│  │ (RPC client with types)          │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ src/hooks/use-workflows.ts       │   │
│  │ (Typed React Query hooks)        │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ src/routes/*.tsx                 │   │
│  │ (Components with auto-complete)  │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## How It Works

### 1. Define API Types on Backend

All API request/response types are defined as Zod schemas in `src/server/types/api.ts`:

```typescript
// src/server/types/api.ts

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  fullName: z.string().nullable(),
});

export type User = z.infer<typeof UserSchema>;

export const RegisterRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3).max(100),
  password: z.string().min(8),
  fullName: z.string().max(255).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
```

### 2. Define API Routes

Routes are defined in separate files and combined in `src/server/api.ts`:

```typescript
// src/server/api.ts

import { authRoutes } from "./routes/auth";
import { workflowRoutes } from "./routes/workflows";

const app = new Hono();

// Auth routes (public)
app.route("/auth", authRoutes);

// Protected workflow routes
app.use("/workflows/*", authMiddleware);
app.route("/workflows", workflowRoutes);

export type ApiRouter = typeof app;
```

### 3. Create Frontend RPC Client

The frontend uses Hono's client library to automatically infer types from the backend router:

```typescript
// src/lib/api-client.ts

import { hc } from "hono/client";
import type { ApiRouter } from "@/server/api";

export function createApiClient() {
  return hc<ApiRouter>(window.location.origin, {
    headers: {
      authorization: () => {
        const token = getToken();
        return token ? `Bearer ${token}` : "";
      },
    },
  });
}

export const rpcClient = createApiClient();
```

### 4. Use Types in Frontend

Frontend code automatically gets types from the server definitions:

```typescript
// src/hooks/use-workflows.ts

import type { Workflow, WorkflowsListResponse } from "@/server/types/api";

export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      // Types are automatically inferred from the backend
      const response = await apiRequest<WorkflowsListResponse>(
        "/api/workflows",
        { method: "GET" }
      );

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch workflows");
      }

      return response.data; // Fully typed!
    },
  });
}
```

## Benefits

### 1. Single Source of Truth

All types are defined once in the backend and automatically available to the frontend:

```typescript
// Change once in src/server/types/api.ts
export const UserSchema = z.object({
  // ... types
});

// Automatically available everywhere in frontend
import type { User } from "@/server/types/api";
```

### 2. Runtime Validation

Zod schemas provide both TypeScript types AND runtime validation:

```typescript
// TypeScript knows the shape at compile time
const user: User = { /* ... */ };

// Zod validates at runtime
const validated = UserSchema.parse(untrustedData);
```

### 3. Type-Safe Request Builders

When using the RPC client, requests are type-checked:

```typescript
// This works - types match
const response = await rpcClient.auth.register.$post({
  json: {
    email: "user@example.com",
    username: "john",
    password: "password123"
  }
});

// This would be a TypeScript error - wrong field
const response = await rpcClient.auth.register.$post({
  json: {
    email: "user@example.com",
    // @ts-expect-error - missing required field 'username'
  }
});
```

### 4. Automatic API Documentation

IDEs provide auto-complete based on actual backend API:

```typescript
const client = createApiClient();

// IDE shows all available endpoints
client.auth.     // <- auto-complete shows: register, login, me
client.workflows // <- auto-complete shows: list, get, create, update, delete, run
```

## File Structure

```
src/
├── server/
│   ├── api.ts                    # Main API router (source of truth)
│   ├── types/
│   │   └── api.ts               # Zod schemas for all types
│   ├── routes/
│   │   ├── auth.ts              # Auth endpoints
│   │   └── workflows.ts         # Workflow endpoints
│   └── auth/
│       ├── jwt.ts               # JWT utilities
│       └── middleware.ts        # Auth middleware
├── lib/
│   ├── api.ts                   # Basic fetch utility
│   └── api-client.ts            # Hono RPC client with types
├── hooks/
│   └── use-workflows.ts         # React Query hooks with types
└── routes/
    ├── login.tsx                # Login page with types
    └── workflows/
        └── index.tsx            # Workflows page with types
```

## Common Patterns

### Adding a New API Endpoint

1. **Define types** in `src/server/types/api.ts`:

```typescript
export const CreateWorkflowRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  definition: WorkflowDefinitionSchema,
});

export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;
```

2. **Implement route** in `src/server/routes/workflows.ts`:

```typescript
workflowRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const validated = CreateWorkflowRequestSchema.parse(body);

  // ... implementation

  return c.json({ success: true, data: workflow });
});
```

3. **Use in frontend** with automatic types:

```typescript
// Types are automatically inferred
const response = await apiRequest<Workflow>("/api/workflows", {
  method: "POST",
  body: JSON.stringify(createRequest),
});
```

### Creating a React Query Hook

```typescript
export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkflowRequest) => {
      // Input is type-safe
      const response = await apiRequest<Workflow>(
        "/api/workflows",
        { method: "POST", body: JSON.stringify(input) }
      );

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    },
    onSuccess: (data: Workflow) => {
      // Response is type-safe
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}
```

## Migration from Manual Types

If you have manually defined types in the frontend, migrate them:

### Before:
```typescript
// Frontend defines its own types
interface Workflow {
  id: string;
  name: string;
  // ... manually maintained
}
```

### After:
```typescript
// Import from backend
import type { Workflow } from "@/server/types/api";
```

## Validation

All requests validate their inputs using Zod schemas:

```typescript
// src/server/routes/auth.ts

authRoutes.post("/register", async (c) => {
  const body = await c.req.json();

  // Validate using Zod schema
  const validated = RegisterRequestSchema.parse(body);

  // validated is type-safe here
  const user = await createUser(validated);

  return c.json({ success: true, data: user });
});
```

## Type Safety Guarantees

With this setup:

1. ✅ Backend types are source of truth
2. ✅ Frontend types match backend exactly
3. ✅ Requests are validated at runtime
4. ✅ Responses are type-checked at compile time
5. ✅ IDE auto-complete works for all APIs
6. ✅ Refactoring types updates both backend and frontend
7. ✅ No manual type synchronization needed

## Further Reading

- [Hono Client](https://hono.dev/docs/api/client)
- [Zod Documentation](https://zod.dev)
- [React Query (TanStack Query)](https://tanstack.com/query/latest)

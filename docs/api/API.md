# API Reference

## Overview

The workflow builder provides a RESTful API for managing workflows and executing them. All endpoints return JSON responses with a `success` boolean and either `data` or `error` fields.

## Base URL

```
http://localhost:5173/api
```

## Endpoints

### Workflows

#### List Workflows
```
GET /workflows
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "wf-123",
      "name": "My Workflow",
      "description": "A sample workflow",
      "definition": { ... },
      "status": "published",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Workflow
```
GET /workflows/:id
```

**Parameters:**
- `id` (string, required) - Workflow ID

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

#### Create Workflow
```
POST /workflows
```

**Request Body:**
```json
{
  "name": "My Workflow",
  "description": "Optional description",
  "definition": {
    "nodes": { ... },
    "edges": [ ... ],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "data": { ... }
}
```

#### Update Workflow
```
PUT /workflows/:id
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "definition": { ... },
  "status": "published"
}
```

**Status Values:** `draft`, `published`, `archived`

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

#### Delete Workflow
```
DELETE /workflows/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Workflow deleted"
}
```

### Workflow Runs

#### List Workflow Runs
```
GET /workflows/:workflowId/runs
```

**Parameters:**
- `workflowId` (string, required) - Workflow ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "run-123",
      "workflowId": "wf-123",
      "status": "success",
      "startedAt": "2024-01-01T00:00:00Z",
      "completedAt": "2024-01-01T00:01:00Z"
    }
  ]
}
```

#### Get Run Details
```
GET /workflows/:workflowId/runs/:runId
```

**Parameters:**
- `workflowId` (string, required) - Workflow ID
- `runId` (string, required) - Run ID

**Response:**
```json
{
  "success": true,
  "data": {
    "run": { ... },
    "executions": [
      {
        "id": "exec-123",
        "runId": "run-123",
        "nodeId": "node-1",
        "status": "success",
        "inputs": { ... },
        "outputs": { ... }
      }
    ]
  }
}
```

#### Execute Workflow
```
POST /workflows/:id/run
```

**Parameters:**
- `id` (string, required) - Workflow ID

**Response:** (202 Accepted)
```json
{
  "success": true,
  "data": {
    "run": { ... },
    "message": "Workflow execution started"
  }
}
```

#### Stream Execution Events
```
GET /workflows/:workflowId/runs/:runId/events
```

**Parameters:**
- `workflowId` (string, required) - Workflow ID
- `runId` (string, required) - Run ID

**Stream Format:** Server-Sent Events (SSE)

**Event Types:**
- `status` - Execution status update
- `token` - LLM token from streaming
- `log` - Logging message
- `tool_call` - Tool invocation
- `agent_action` - Agent action
- `agent_finish` - Agent finish
- `done` - Execution complete

**Example Event:**
```json
{
  "type": "token",
  "data": {
    "nodeId": "node-1",
    "content": "Hello world",
    "timestamp": 1234567890
  }
}
```

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

**Common Status Codes:**
- `200` - OK
- `201` - Created
- `202` - Accepted (async operation)
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

## Examples

### Create and Execute a Workflow

1. **Create a workflow:**
```bash
curl -X POST http://localhost:5173/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Workflow",
    "definition": {
      "nodes": {
        "node-1": {
          "data": {
            "nodeType": "TextTransform",
            "nodeInputs": {
              "text": "hello",
              "operation": "uppercase"
            }
          }
        }
      },
      "edges": []
    }
  }'
```

2. **Execute the workflow:**
```bash
curl -X POST http://localhost:5173/api/workflows/{workflowId}/run
```

3. **Stream execution events:**
```bash
curl -N http://localhost:5173/api/workflows/{workflowId}/runs/{runId}/events
```

## Webhooks

Workflows can be triggered by webhooks. Define a webhook node in your workflow to listen for incoming HTTP requests.

```
POST /workflows/:workflowId/webhook/:nodeId
```

This integrates with the node's webhook handler.

## Rate Limiting

Currently no rate limiting is enforced. This should be added in production.

## Authentication

Currently no authentication is required. In production, implement JWT or similar.

## CORS

CORS is enabled for all origins. In production, restrict to specific domains.

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [DYNAMIC_IO.md](./DYNAMIC_IO.md) - Dynamic inputs/outputs
- [EXECUTION_CONTEXT.md](./EXECUTION_CONTEXT.md) - Execution context API

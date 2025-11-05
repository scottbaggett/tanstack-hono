# Executions View - Product Requirements Document

## Overview

The Executions View is a new feature that enables users to view historical workflow runs and understand exactly how data flows and transforms through their workflows. This feature provides complete visibility into workflow execution history, allowing users to debug issues, analyze performance, and understand the step-by-step execution sequence.

## Problem Statement

Currently, users can only view and edit workflows. While workflows can be executed, there is no way to:
- View historical execution runs
- Understand the sequence of node executions
- See how data transformed at each step
- Debug failed executions
- Analyze successful executions to understand data flow

This lack of visibility makes it difficult to:
- Troubleshoot workflow failures
- Understand why certain outputs were produced
- Optimize workflow performance
- Learn from past executions

## Goals

1. **Visibility**: Users can see all historical runs for a workflow
2. **Traceability**: Users can trace data flow from inputs to outputs through the entire execution sequence
3. **Debugging**: Users can identify where and why executions failed
4. **Understanding**: Users can understand how data transforms at each node stage
5. **Stages**: Users can see the execution sequence organized by stages (no timing information)

## User Stories

### As a workflow user, I want to:
1. **View execution history**: See all runs for a workflow, including status, date, and basic metadata
2. **Select a run**: Click on a run to see its detailed execution view
3. **See execution sequence**: View the order in which nodes executed, organized by stages
4. **Trace data flow**: See inputs and outputs for each node in the execution sequence
5. **Understand transformations**: See how data changed as it flowed through each node
6. **Debug failures**: Identify which node failed and why
7. **View agent traces**: For agent nodes, see the internal reasoning loop (iterations, tool calls, results)
8. **Navigate between runs**: Easily switch between different runs to compare executions

## Feature Requirements

### 1. Executions List View

**Location**: `/workflow/:workflowId/executions`

**Purpose**: Display all historical runs for a workflow

**Requirements**:
- Show a list of all workflow runs for the selected workflow
- Each run item displays:
  - Run ID (truncated for display)
  - Status badge (pending, running, completed, failed)
  - Started date/time (relative format: "2 hours ago")
  - Completion status indicator
  - Token usage (if available)
  - Quick status summary
- Runs sorted by most recent first (default)
- Filtering options:
  - By status (all, completed, failed, running)
  - By date range (future enhancement)
- Click on a run to navigate to detailed execution view
- Empty state when no runs exist
- Pagination or infinite scroll for workflows with many runs

**UI Components**:
- Table or card-based list layout
- Status badges with color coding
- Search/filter bar
- "View Details" button/link on each run

### 2. Execution Detail View

**Location**: `/workflow/:workflowId/executions/:runId`

**Purpose**: Show complete execution details for a specific run

**Requirements**:

#### 2.1 Execution Header
- Run ID (full UUID)
- Status badge
- Workflow name (link back to workflow editor)
- Started date/time (absolute and relative)
- Completed date/time (if completed)
- Overall execution status
- Token usage summary
- Error message (if failed)

#### 2.2 Graph Playback View (Primary UI)
- **Architecture**: Reuse the existing React Flow canvas as the main UI for execution detail view
- **Concept**: "Play back" the selected run by overlaying execution data onto the graph the user already built
- **Implementation**:
  - Use the existing `Canvas` component with execution context
  - `WorkflowNode` components already accept an `executionStatus` prop
  - Pass execution status for each node from the selected run
  - Visual indicators on nodes:
    - Status badge/indicator (pending, running, completed, failed, skipped)
    - Color coding (green for success, red for error, yellow for running, gray for pending)
    - Stage indicator (if applicable)
  - Edge/connection visual indicators:
    - Color coding based on data transfer success/failure
    - Hover tooltip showing data preview
- **Benefits**:
  - More intuitive: Users debug on the same canvas they build on
  - Technically faster: Reuses existing components
  - Proven model: Same pattern as n8n and other workflow tools
- **Node Interaction**:
  - Click on a node to open the `NodeExecutionDetail` panel (see 2.3)
  - Hover on edges to see data that flowed between nodes

#### 2.3 Node Execution Details Panel
- **Trigger**: Click on a node in the graph playback view
- **Location**: Side panel or modal overlay
- **Tab Structure**: Panel uses tabs for different views:
  - **Inputs** tab
  - **Outputs** tab
  - **Logs** tab (see Section 2.6)

**Inputs Tab**:
- Show all input data received by the node
- Display in structured format (JSON viewer with syntax highlighting)
- Show which upstream nodes provided the data
- **Large Data Handling** (see Section 7.1):
  - Truncate JSON display to 50 lines by default
  - "Expand Full" button to show complete data
  - "Copy to clipboard" button for each section
  - Syntax highlighting for JSON

**Outputs Tab**:
- Show all output data produced by the node
- Display in structured format (JSON viewer with syntax highlighting)
- Show which downstream nodes received this data
- Same large data handling as inputs

**Data Transformation View (V1 Simplified)**:
- Side-by-side or tabbed view of Input and Output JSON
- User performs mental diff (visual diff viewer is future enhancement)

**Status information** (always visible, not in tabs):
- Execution status
- Error message (if failed)
- Token usage (if applicable)

**Agent-specific details** (for agent nodes):
- Internal trace summary (iterations, final state)
- Number of iterations
- Tool calls made
- Final state (success, max_iterations, no_progress, error)
- **V1**: Raw `internalTrace` JSON in collapsible, syntax-highlighted block
- **Phase 4**: Link to full `AgentTraceViewer` (see Section 2.7)

#### 2.4 Data Flow Visualization
- **Visual representation**: Integrated into Graph Playback View (Section 2.2)
- **Data preview**: Hover on edges/connections to see tooltip with data preview
- **Connection status**: Visual indicators on edges (color coding for success/failure)
- **Data transformation**: Viewable in Node Execution Details Panel (Section 2.3)

#### 2.5 Execution Events Timeline (Future Enhancement)
- Show all events that occurred during execution
- Event types: workflow_start, node_start, node_progress, node_complete, node_error, workflow_complete
- Filterable by event type
- Searchable

#### 2.6 Logs Tab (Execution Logging)

**Location**: Tab in the Node Execution Details Panel (Section 2.3)

**Two Display States**:

1. **Global Workflow Logs** (No node selected):
   - Shows auto-generated system logs for the entire workflow run
   - Chronological order of all execution events
   - Examples:
     ```
     [2:41:15 PM] Workflow run started...
     [2:41:15 PM] Node "When clicking 'Execute...'" finished.
     [2:41:15 PM] Node "Execute Command" started.
     [2:41:16 PM] Node "Execute Command" finished.
     [2:41:16 PM] Node "Extract from File" started.
     [2:41:16 PM] Workflow run finished: Success.
     ```

2. **Node-Specific Logs** (Node selected):
   - Filtered to show only logs from the selected node
   - Includes:
     - Auto-generated system logs (e.g., "Node started", "Node finished")
     - User-generated logs from custom code nodes (console.log, print(), etc.)
   - Examples:
     ```
     [2:41:15 PM] Node "Execute Command" started.
     [2:41:15 PM] INFO: Processing input data...
     [2:41:15 PM] DEBUG: Found 42 items to process
     [2:41:16 PM] ERROR: Failed to parse line 15
     [2:41:16 PM] Node "Execute Command" finished.
     ```

**UI Features**:
- **Timestamps**: Each log line shows timestamp (relative and absolute on hover)
- **Color-coding by log level**:
  - ERROR: Red text
  - WARN: Yellow/orange text
  - INFO: Default text color
  - DEBUG: Muted/gray text
- **Log Level Filter**: Dropdown filter (All, Errors Only, Warnings & Errors, etc.)
- **Search**: Text search within logs
- **Copy Logs**: Button to copy all visible logs to clipboard
- **Scroll to Latest**: Button to jump to the most recent log entry
- **Auto-scroll**: Optional toggle to auto-scroll to latest logs (for running executions)

**Log Sources**:
- **Auto-Generated (System Logs)**: From `execution_events` table with event types:
  - `workflow_start`, `workflow_complete`, `workflow_error`
  - `node_start`, `node_complete`, `node_error`
  - `log` (for system logging events)
- **User-Generated (Custom Logs)**: Captured from custom code nodes (see Section 6.3)

#### 2.7 Agent Internal Trace Viewer (Phase 4)
- **Trigger**: Click "View Trace" link on an agent node's execution panel
- **Display Format**: Modal or expandable panel showing an iteration-by-iteration breakdown
- **Content Structure**:
  ```
  Agent Trace - [Node Name]

  ├─ Summary
  │  ├─ Total Iterations: 3
  │  └─ Final State: success
  │
  ├─ Iteration 1
  │  ├─ Agent Planning
  │  │  └─ "I need to call the weather API..."
  │  ├─ Tool Call: weatherApi
  │  │  ├─ Input: { city: "San Francisco" }
  │  │  └─ Output: { temp: 65, condition: "sunny" }
  │
  ├─ Iteration 2
  │  ├─ Agent Planning
  │  │  └─ "Now I have the data, I can format the response..."
  │  └─ Final Answer
  │     └─ "The weather in San Francisco is 65°F and sunny."
  ```
- **UI Components**:
  - Collapsible sections for each iteration
  - Color-coded step types (planning, tool_call, tool_result, agent_finish)
  - JSON viewers for tool inputs/outputs
  - Copy buttons for each section
- **Data Source**: Uses existing `InternalTraceData` structure from `src/server/db/schema.ts`

### 3. Navigation & Integration

**Requirements**:
- Access executions from workflow editor:
  - "Executions" tab or button in workflow view
  - Link in workflow list page
- Breadcrumb navigation:
  - Workflows → [Workflow Name] → Executions → [Run ID]
- Back navigation:
  - Return to executions list
  - Return to workflow editor
- URL structure:
  - `/workflow/:workflowId/executions` - List view
  - `/workflow/:workflowId/executions/:runId` - Detail view
- **Direct URL access**: Must support direct navigation to specific executions via URL
- **Previous/Next Navigation**:
  - "Previous Execution" and "Next Execution" buttons in detail view
  - Navigate between runs in chronological order
- **Keyboard Shortcuts**:
  - `←` / `→`: Previous/Next execution
  - `Esc`: Return to list

### 3.1 Running Executions Handling (Phase 1)

**Requirements**:
- Display "running" status badge in both list and detail views
- Show text indicator: "Last updated: X seconds ago"
- Provide a manual **"Refresh" button** in the UI
- **Note**: Auto-refresh/polling is explicitly out of scope until Phase 4

### 3.2 Workflow Version Context

**Requirements**:
- The API must return which workflow version was executed
- The UI must display this version (e.g., "Executed on v3" or "Workflow Version: 3")
- Display in execution header (Section 2.1)
- **Future Enhancement**: Add a link to view the workflow definition at that point in time

### 4. Data Requirements

**API Endpoints Needed**:
- `GET /api/workflows/:workflowId/runs` - List all runs (already exists)
- `GET /api/workflows/:workflowId/runs/:runId` - Get run details (already exists)
- `GET /api/workflows/:workflowId/runs/:runId/nodes` - Get node executions with stages (may need enhancement)
- `GET /api/workflows/:workflowId/runs/:runId/events` - Get execution events (already exists, may need enhancement)
- `GET /api/workflows/:workflowId/runs/:runId/logs` - Get execution logs (new endpoint, see Section 6.3)
  - Query params: `?nodeId=<nodeId>` to filter by node
  - Query params: `?level=<level>` to filter by log level

**Data Structure**:
The execution detail view needs:
- Workflow run metadata (status, dates, tokens, error)
- Node executions array (ordered by execution sequence)
- Each node execution includes:
  - Node ID, type, label
  - Status
  - Stage number/identifier
  - Inputs (JSON)
  - Outputs (JSON)
  - Internal trace (for agent nodes)
  - Error message (if failed)
  - Token usage
- Execution events (optional, for timeline view)

**Stages Definition**:
- A stage represents a group of nodes that executed at the same logical point
- Stages are determined by the execution order and dependencies
- Nodes in the same stage may execute in parallel or sequentially
- Stage numbers are sequential (Stage 1, Stage 2, etc.)
- Stage 1 typically contains entry nodes (nodes with no dependencies)
- Each subsequent stage contains nodes that depend on previous stages

**Stage Calculation Strategy**:
- **MVP Approach**: Calculate stages on-demand (no schema changes needed)
- **Algorithm**: See Section 6.1 for full stage calculation algorithm
- **Future Enhancement**: Option to store stages during execution for faster queries

## Technical Considerations

### Frontend Components

**New Components Needed**:
1. `ExecutionsList` - List view component
2. `ExecutionDetail` - Detail view component (wraps existing Canvas with execution context)
3. `NodeExecutionDetail` - Expandable node details panel (side panel or modal)
4. `ExecutionLogsViewer` - Logs viewer component with filtering and search
5. `AgentTraceViewer` - Agent-specific trace viewer (Phase 4)
6. `ExecutionHeader` - Execution metadata header component
7. `ExecutionStatusBadge` - Status badge component with color coding

**Components to Enhance**:
1. `Canvas` - Add execution mode that overlays execution data
2. `WorkflowNode` - Already accepts `executionStatus` prop (enhance for execution context)
3. Existing edge components - Add execution status visual indicators

**Hooks Needed**:
- `useWorkflowRuns(workflowId)` - Fetch runs list
- `useWorkflowRun(workflowId, runId)` - Fetch run details
- `useNodeExecutions(runId)` - Fetch node executions

**Routes Needed**:
- `/workflow/:workflowId/executions` - List route
- `/workflow/:workflowId/executions/:runId` - Detail route

### Backend Considerations

**Database Queries**:
- Efficient querying of `workflow_runs` table
- Join with `node_executions` table
- Join with `workflows` table to get workflow definition and version
- Order node executions by execution sequence (determined by startedAt or execution order)
- Calculate stages on-demand using topological sort (see Section 6.1)
- Fetch execution events if needed
- **Indexing**: Ensure `workflow_runs.startedAt` has database index for fast sorting

**Performance**:
- Pagination for large execution lists (50 runs per page)
- Lazy loading of node execution details (expand to load)
- Efficient JSON data retrieval (large JSONB fields)
- Client-side render limit: Max 10MB per node input/output
- Consider caching for frequently accessed runs

### UI/UX Considerations

**Design Principles**:
- Clear visual hierarchy
- Status-based color coding (green for success, red for error, yellow for running)
- Progressive disclosure (expandable details)
- Responsive layout
- Accessible (keyboard navigation, screen readers)

**Visual Design**:
- Use existing UI component library (shadcn/ui)
- Consistent with workflow editor design
- Card-based layout for execution items (list view)
- **Graph Playback View**: Reuse React Flow canvas for execution detail view
- JSON viewer with syntax highlighting for data inspection
- Collapsible sections for detailed views
- Side panel or modal for node execution details

## Success Criteria

1. **Functionality**:
   - Users can view all runs for a workflow
   - Users can view detailed execution information for any run
   - Users can see execution status overlaid on the workflow graph
   - Users can inspect inputs and outputs for each node
   - Users can view agent internal traces (Phase 4)
   - Users can navigate between executions easily

2. **Performance**:
   - Execution list loads in < 2 seconds
   - Execution detail view loads in < 3 seconds
   - Node execution details expand/collapse smoothly
   - Handles large JSON payloads (up to 10MB) without UI freezing

3. **User Experience**:
   - Intuitive navigation between views
   - Clear visual indicators for status and errors
   - Graph playback view feels natural and familiar
   - Responsive design works on desktop and tablet
   - Keyboard shortcuts work correctly

4. **Reliability**:
   - Handles missing data gracefully
   - Shows appropriate error states (see Section 8)
   - Handles large JSON payloads efficiently
   - Gracefully handles corrupted or malformed data

## Out of Scope (Future Enhancements)

1. **Execution Comparison**: Compare two runs side-by-side
2. **Execution Analytics**: Aggregate statistics across runs
3. **Execution Replay**: Replay an execution with visual animation
4. **Export Execution Data**: Export execution data as JSON/CSV
5. **Execution Search**: Search executions by input/output data
6. **Execution Filtering**: Advanced filtering by date range, status, node type
7. **Real-time Execution View**: Auto-refresh/polling for live view of currently running executions
8. **Performance Metrics**: Detailed timing and performance analysis
9. **Execution Cloning**: Clone a run with same inputs
10. **Execution Comments**: Add notes/comments to executions
11. **Visual JSON Diff Viewer**: Automatic diff visualization between node inputs and outputs
12. **Workflow Version Viewer**: View the workflow definition at the time of execution

## Implementation Phases

### Phase 1: Basic Executions List & Graph Playback Foundation
- Create executions list route (`/workflow/:workflowId/executions`)
- Fetch and display workflow runs with pagination
- Basic status indicators
- Navigation to detail view
- Running executions handling (refresh button, status indicators)
- Error states and handling (Section 8)

### Phase 2: Execution Detail View with Graph Playback
- Create execution detail route (`/workflow/:workflowId/executions/:runId`)
- Implement Graph Playback View (reuse Canvas with execution context)
- Display run metadata header
- Overlay execution status on workflow nodes
- Basic node execution details panel with tabs (Inputs, Outputs, Logs)
- Display node inputs/outputs (with large data handling)
- **Logs Tab**: Global workflow logs view (system logs only)
- Stage calculation algorithm (on-demand)
- Workflow version context display
- Previous/Next navigation buttons

### Phase 3: Enhanced Data Flow & Node Details
- Enhanced node execution details panel
- Side-by-side Input/Output view
- **Enhanced Logs Tab**: Node-specific logs with filtering and search
- **User-Generated Logs**: Capture and display logs from custom code nodes
- Edge/connection visual indicators with data preview
- Improved large data handling (truncation, expand, copy)
- Keyboard shortcuts (← → Esc)
- Execution events timeline (basic)

### Phase 4: Agent Trace Viewer & Polish
- Full `AgentTraceViewer` component (Section 2.7)
- Enhanced filtering and search
- Performance optimizations
- Auto-refresh for running executions (optional)
- Advanced error handling

## Dependencies

- Existing API endpoints (already implemented)
- Database schema (already implemented)
- UI component library (shadcn/ui)
- TanStack Router for routing
- React Query for data fetching

## Performance & Scalability Requirements

### 7.1 Large Data Handling (UI/UX)

**Problem**: Node inputs/outputs can be huge JSON objects and will break the UI.

**Requirements**:
- Truncate JSON display in the details panel to 50 lines by default
- Provide an **"Expand Full"** button to show complete data
- Must include **syntax highlighting** for JSON (use a JSON viewer library)
- Must include a **"Copy to clipboard"** button for each section
- Client-side render limit: Max 10MB per node input/output
- **Future Enhancement**: "Download as JSON file" button

### 7.2 Data Volume & Pagination

**Requirements**:
- Execution list (`GET .../runs`) must be paginated (50 runs per page)
- Lazy-loading: The `NodeExecutionDetail` panel should lazy-load its `Input`/`Output` data on expand
- Database indexing: `workflow_runs.startedAt` must have a database index for fast sorting

## Error States & Handling

The UI must gracefully handle the following scenarios:

1. **Execution not found (404)**:
   - Show a "Not Found" page with a link back to the executions list
   - Clear error message: "Execution not found or has been deleted"

2. **Incomplete/Missing Data**:
   - Show a warning badge: "Some execution data is missing"
   - Display available data, mark missing sections clearly

3. **Corrupted JSON**:
   - Display the raw text with an error indicator
   - Show message: "Unable to parse JSON data"
   - Provide "View Raw" option

4. **Permission Denied (403)**:
   - Show an access denied message
   - Provide link to return to workflows list

5. **Network/API Errors**:
   - Show a "Failed to load" message with a "Retry" button
   - Display specific error message when available

6. **Workflow Not Found**:
   - If workflow was deleted but execution exists, show warning
   - Provide link to executions list

## Technical Specifications

### 6.1 Stage Calculation Algorithm

**Purpose**: Calculate execution stages on-demand for display in the execution detail view.

**Algorithm**:

1. **Fetch Data**:
   - Fetch node executions from `node_executions` table for the run
   - Fetch workflow definition (for the dependency graph/edges)
   - Build map of node executions by nodeId

2. **Build Dependency Graph**:
   - Parse workflow edges to understand node dependencies
   - Create an adjacency list representation (node → array of dependent nodes)
   - Identify entry nodes (nodes with no incoming edges)

3. **Assign Stages**:
   - **Stage 1**: All nodes with no dependencies (entry nodes)
   - **Stage N**: Nodes whose all dependencies are in stages < N
   - Nodes in the same stage may execute in parallel or sequentially
   - Use topological sort algorithm:
     ```
     function calculateStages(workflowDefinition, nodeExecutions) {
       // Build dependency graph from edges
       const dependencies = buildDependencyGraph(workflowDefinition.edges);

       // Find entry nodes (no dependencies)
       const entryNodes = findEntryNodes(dependencies);

       // Assign stages using topological sort
       const stages = new Map();
       let currentStage = 1;
       let nodesInStage = entryNodes;

       while (nodesInStage.length > 0) {
         nodesInStage.forEach(nodeId => {
           stages.set(nodeId, currentStage);
         });

         // Find nodes that can execute next (all dependencies completed)
         const nextNodes = findNodesWithDependenciesInStages(
           dependencies,
           stages,
           currentStage
         );

         nodesInStage = nextNodes;
         currentStage++;
       }

       return stages;
     }
     ```

4. **Return Enhanced Data**:
   - Return node executions with a new `stage` property added
   - Sort node executions by stage, then by execution order

**Implementation Location**: Backend API endpoint (`GET /api/workflows/:workflowId/runs/:runId`)

### 6.2 Agent Trace Data Structure (Existing)

The data model for agent traces is already defined and available.

**Source**: `src/server/db/schema.ts:144-190`

```typescript
interface InternalTraceData {
  steps: InternalStep[];
  iterationCount: number;
  finalState: "success" | "max_iterations" | "no_progress" | "error";
  halted: boolean;
  haltReason?: string;
}

interface InternalStep {
  iteration: number;
  timestamp: number;
  type: "agent_plan" | "tool_call" | "tool_result" | "agent_finish";
  // Agent planning
  agentLog?: string;
  // Tool execution
  toolName?: string;
  toolCallId?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  toolError?: string;
  toolDurationMs?: number;
  // Final answer
  finalOutput?: string;
}
```

**Usage**: This structure is stored in `node_executions.internalTrace` JSONB field for agent nodes.

### 6.3 Execution Logging System

**Purpose**: Capture and store logs for every execution, both system-generated and user-generated.

#### 6.3.1 Storage Strategy

**Existing Infrastructure**:
- The `execution_events` table already exists and supports logging
- Event types include: `workflow_start`, `workflow_complete`, `node_start`, `node_complete`, `node_error`, `log`
- Table structure: `runId`, `nodeId` (optional), `eventType`, `eventData` (JSONB), `timestamp`

**Storage Approach**:
- **System Logs**: Use existing `execution_events` table with `eventType: "log"`
  - Store structured log data in `eventData` JSONB field:
    ```json
    {
      "level": "info" | "warn" | "error" | "debug",
      "message": "Log message text",
      "metadata": { ... }
    }
    ```
- **User-Generated Logs**: Also stored in `execution_events` with:
  - `eventType: "log"`
  - `nodeId`: Set to the node that generated the log
  - `eventData.level`: "info", "warn", "error", or "debug" (from user code)
  - `eventData.message`: The actual log message/console output

#### 6.3.2 Log Capture Mechanisms

**Auto-Generated (System) Logs**:

Created by the execution engine during workflow execution:

1. **Workflow-Level Events**:
   - `workflow_start`: "Workflow run started..."
   - `workflow_complete`: "Workflow run finished: Success"
   - `workflow_error`: "Workflow run failed: [error message]"

2. **Node-Level Events**:
   - `node_start`: "Node '[Node Name]' started"
   - `node_complete`: "Node '[Node Name]' finished"
   - `node_error`: "Node '[Node Name]' failed: [error message]"

**Implementation**: These are already captured via `WorkflowOrchestrator` and stored in `execution_events`.

**User-Generated Logs**:

Captured from custom code nodes (Python, JavaScript, etc.):

1. **Interception Strategy**:
   - For **Python nodes**: Intercept `stdout` (print() statements)
   - For **JavaScript nodes**: Intercept `console.log()`, `console.error()`, `console.warn()`, `console.debug()`
   - For **other languages**: Similar stdout/intercept mechanisms

2. **Implementation Details**:
   ```typescript
   // In custom code execution environment
   class LogInterceptor {
     constructor(private runId: string, private nodeId: string) {}

     interceptStdout(output: string, level: 'info' | 'error' | 'warn' | 'debug') {
       // Store log event
       await db.insert(executionEvents).values({
         runId: this.runId,
         nodeId: this.nodeId,
         eventType: 'log',
         eventData: {
           level: level,
           message: output,
           source: 'user_code'
         },
         timestamp: new Date()
       });
     }
   }
   ```

3. **Execution Context Integration**:
   - Custom code nodes receive execution context with logging capabilities
   - `context.logInfo()`, `context.logError()`, etc. (see `IExecuteFunctions` in `src/types/execution.ts`)
   - These methods automatically capture and store logs

#### 6.3.3 API Endpoint

**New Endpoint**: `GET /api/workflows/:workflowId/runs/:runId/logs`

**Query Parameters**:
- `nodeId` (optional): Filter logs by specific node
- `level` (optional): Filter by log level (`info`, `warn`, `error`, `debug`)
- `limit` (optional): Number of logs to return (default: 1000)
- `offset` (optional): Pagination offset

**Response Format**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "event-uuid",
        "timestamp": "2024-01-15T14:41:15Z",
        "level": "info",
        "message": "Node 'Execute Command' started",
        "nodeId": "node-123",
        "source": "system"
      },
      {
        "id": "event-uuid-2",
        "timestamp": "2024-01-15T14:41:16Z",
        "level": "error",
        "message": "Failed to parse line 15",
        "nodeId": "node-123",
        "source": "user_code"
      }
    ],
    "total": 42,
    "hasMore": false
  }
}
```

**Implementation Location**: Backend API route (`src/server/routes/workflows.ts` or new `src/server/routes/logs.ts`)

#### 6.3.4 Frontend Integration

**Component**: `ExecutionLogsViewer`

**Features**:
- Fetch logs from API endpoint
- Display in chronological order
- Color-code by log level
- Filter by level and node
- Search functionality
- Copy to clipboard
- Auto-scroll for running executions

**Data Flow**:
```
User clicks node in graph
  ↓
NodeExecutionDetail panel opens
  ↓
User clicks "Logs" tab
  ↓
ExecutionLogsViewer component mounts
  ↓
Fetches logs from API (with nodeId filter if node selected)
  ↓
Displays logs with filtering and search
```

## Notes

- **No Timing Information**: As per requirements, this PRD does not include timing/duration information in the UI. Stages are used instead to organize execution sequence.
- **Stages**: Stages are determined by execution order and dependencies. Nodes in the same stage executed at the same logical point in the workflow.
- **Graph Playback**: The primary UI reuses the existing React Flow canvas, providing a familiar debugging experience.
- **Logging Integration**: Logs are tightly integrated with execution visibility, shown in the same context as inputs/outputs for complete execution understanding.
- **Data Privacy**: Ensure sensitive data in inputs/outputs is handled appropriately (masking, sanitization if needed). Logs may contain sensitive data and should be handled with same care.
- **Architecture**: This feature leverages existing components where possible to minimize technical debt and implementation time.


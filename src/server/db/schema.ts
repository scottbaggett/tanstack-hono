import {
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
	integer,
	jsonb,
	boolean,
	index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		username: varchar("username", { length: 100 }).notNull().unique(),
		fullName: varchar("full_name", { length: 255 }),
		isActive: boolean("is_active").default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.default(sql`now()`)
			.onUpdateNow(),
	},
	(table) => ({
		emailIdx: index("users_email_idx").on(table.email),
		usernameIdx: index("users_username_idx").on(table.username),
	})
);

// ============================================================================
// WORKFLOWS TABLE
// ============================================================================

export const workflows = pgTable(
	"workflows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		// Workflow definition includes nodes, edges, viewport, and metadata
		definition: jsonb("definition").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.default(sql`now()`)
			.onUpdateNow(),
	},
	(table) => ({
		ownerIdx: index("workflows_owner_id_idx").on(table.ownerId),
		nameIdx: index("workflows_name_idx").on(table.name),
	})
);

// ============================================================================
// WORKFLOW RUNS TABLE
// ============================================================================

export const workflowRuns = pgTable(
	"workflow_runs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowId: uuid("workflow_id")
			.references(() => workflows.id, { onDelete: "cascade" })
			.notNull(),
		ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
		// Status: pending, running, completed, failed
		status: varchar("status", { length: 20 })
			.default("pending")
			.notNull(),
		// Input parameters passed to the workflow
		inputs: jsonb("inputs"),
		// Final output/results
		outputs: jsonb("outputs"),
		// Error information if failed
		errorMessage: text("error_message"),
		// Execution timing
		startedAt: timestamp("started_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		// Metrics
		totalTokensUsed: integer("total_tokens_used"),
		durationMs: integer("duration_ms"),
	},
	(table) => ({
		workflowIdx: index("workflow_runs_workflow_id_idx").on(table.workflowId),
		ownerIdx: index("workflow_runs_owner_id_idx").on(table.ownerId),
		statusIdx: index("workflow_runs_status_idx").on(table.status),
		startedIdx: index("workflow_runs_started_at_idx").on(table.startedAt),
	})
);

// ============================================================================
// NODE EXECUTIONS TABLE
// ============================================================================

export const nodeExecutions = pgTable(
	"node_executions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		runId: uuid("run_id")
			.references(() => workflowRuns.id, { onDelete: "cascade" })
			.notNull(),
		// Node ID from workflow definition
		nodeId: varchar("node_id", { length: 255 }).notNull(),
		// Node type (e.g., "text-input", "llm", "output")
		nodeType: varchar("node_type", { length: 100 }).notNull(),
		// Status: pending, running, completed, failed, skipped
		status: varchar("status", { length: 20 })
			.default("pending")
			.notNull(),
		// Input data passed to the node
		inputs: jsonb("inputs"),
		// Output data produced by the node
		outputs: jsonb("outputs"),
		// Metrics
		tokensUsed: integer("tokens_used"),
		// Execution timing
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		// Error information
		errorMessage: text("error_message"),
	},
	(table) => ({
		runIdx: index("node_executions_run_id_idx").on(table.runId),
		nodeIdIdx: index("node_executions_node_id_idx").on(table.nodeId),
		statusIdx: index("node_executions_status_idx").on(table.status),
	})
);

// ============================================================================
// EXECUTION EVENTS TABLE
// ============================================================================

export const executionEvents = pgTable(
	"execution_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		runId: uuid("run_id")
			.references(() => workflowRuns.id, { onDelete: "cascade" })
			.notNull(),
		// Event type: workflow_start, workflow_complete, node_start, node_progress, node_stream, node_complete, error, log, metric
		eventType: varchar("event_type", { length: 50 }).notNull(),
		// Optional node ID for node-specific events
		nodeId: varchar("node_id", { length: 255 }),
		// Event data payload
		eventData: jsonb("event_data").notNull(),
		// Timestamp of the event
		timestamp: timestamp("timestamp", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
	},
	(table) => ({
		runIdx: index("execution_events_run_id_idx").on(table.runId),
		eventTypeIdx: index("execution_events_event_type_idx").on(table.eventType),
		nodeIdx: index("execution_events_node_id_idx").on(table.nodeId),
		timestampIdx: index("execution_events_timestamp_idx").on(table.timestamp),
	})
);

// ============================================================================
// NODE DEFINITIONS TABLE (for node registry)
// ============================================================================

export const nodeDefinitions = pgTable(
	"node_definitions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Node type identifier (e.g., "text-input", "llm", "output")
		nodeType: varchar("node_type", { length: 100 }).notNull().unique(),
		// Display name
		displayName: varchar("display_name", { length: 255 }).notNull(),
		// Category (e.g., "input", "processing", "output")
		category: varchar("category", { length: 50 }).notNull(),
		// Description of what the node does
		description: text("description"),
		// Input schema (JSON schema)
		inputSchema: jsonb("input_schema").notNull(),
		// Output schema (JSON schema)
		outputSchema: jsonb("output_schema").notNull(),
		// Node configuration (handles, defaults, etc.)
		config: jsonb("config"),
		// Icon or visual representation
		icon: varchar("icon", { length: 255 }),
		// Is this a built-in node
		isBuiltIn: boolean("is_built_in").default(false),
		// Documentation/examples
		documentation: text("documentation"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
	},
	(table) => ({
		nodeTypeIdx: index("node_definitions_node_type_idx").on(table.nodeType),
		categoryIdx: index("node_definitions_category_idx").on(table.category),
	})
);

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type Workflow = typeof workflows.$inferSelect;
export type WorkflowInsert = typeof workflows.$inferInsert;

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type WorkflowRunInsert = typeof workflowRuns.$inferInsert;

export type NodeExecution = typeof nodeExecutions.$inferSelect;
export type NodeExecutionInsert = typeof nodeExecutions.$inferInsert;

export type ExecutionEvent = typeof executionEvents.$inferSelect;
export type ExecutionEventInsert = typeof executionEvents.$inferInsert;

export type NodeDefinition = typeof nodeDefinitions.$inferSelect;
export type NodeDefinitionInsert = typeof nodeDefinitions.$inferInsert;

import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

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
		passwordHash: text("password_hash"),
		isActive: boolean("is_active").default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.default(sql`now()`)
			.$onUpdate(() => sql`now()`),
	},
	(table) => [
		index("users_email_idx").on(table.email),
		index("users_username_idx").on(table.username),
	],
);

// ============================================================================
// WORKFLOWS TABLE
// ============================================================================

export const workflows = pgTable(
	"workflows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerId: uuid("owner_id").references(() => users.id, {
			onDelete: "cascade",
		}),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		// Workflow definition includes nodes, edges, viewport, and metadata
		definition: jsonb("definition").notNull(),
		// Version tracking
		version: integer("version").default(1).notNull(),
		status: varchar("status", { length: 50 }).default("draft").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.default(sql`now()`)
			.$onUpdate(() => sql`now()`),
	},
	(table) => [
		index("workflows_owner_id_idx").on(table.ownerId),
		index("workflows_name_idx").on(table.name),
		index("workflows_version_idx").on(table.version),
	],
);

// ============================================================================
// WORKFLOW VERSIONS TABLE
// ============================================================================

export const workflowVersions = pgTable(
	"workflow_versions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowId: uuid("workflow_id")
			.references(() => workflows.id, { onDelete: "cascade" })
			.notNull(),
		version: integer("version").notNull(),
		definition: jsonb("definition").notNull(),
		changeDescription: text("change_description"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
	},
	(table) => [
		index("workflow_versions_workflow_id_idx").on(table.workflowId),
		index("workflow_versions_version_idx").on(table.version),
	],
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
		ownerId: uuid("owner_id").references(() => users.id, {
			onDelete: "cascade",
		}),
		// Status: pending, running, completed, failed
		status: varchar("status", { length: 20 }).default("pending").notNull(),
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
	(table) => [
		index("workflow_runs_workflow_id_idx").on(table.workflowId),
		index("workflow_runs_owner_id_idx").on(table.ownerId),
		index("workflow_runs_status_idx").on(table.status),
		index("workflow_runs_started_at_idx").on(table.startedAt),
		index("workflow_runs_completed_at_idx").on(table.completedAt),
	],
);

// ============================================================================
// NODE EXECUTIONS TABLE
// ============================================================================

/**
 * Internal trace data for agent node executions
 * Captures the full step-by-step execution of an agent's reasoning loop
 */
export interface InternalTraceData {
	/** All steps executed during the agent loop */
	steps: InternalStep[];
	/** Total number of iterations the agent went through */
	iterationCount: number;
	/** Final state when agent stopped */
	finalState: "success" | "max_iterations" | "no_progress" | "error";
	/** Whether the agent was halted (hit max iterations or no progress) */
	halted: boolean;
	/** Reason for halting, if applicable */
	haltReason?: string;
}

/**
 * A single step in the agent's execution trace
 * Can represent agent planning, tool execution, or final answer
 */
export interface InternalStep {
	/** Which iteration this step belongs to */
	iteration: number;
	/** Timestamp when this step occurred (Unix ms) */
	timestamp: number;
	/** Type of step */
	type: "agent_plan" | "tool_call" | "tool_result" | "agent_finish";

	// Agent planning step
	/** The agent's reasoning or planning log */
	agentLog?: string;

	// Tool execution step
	/** Name of the tool being called */
	toolName?: string;
	/** Unique ID for this tool call */
	toolCallId?: string;
	/** Input parameters passed to the tool */
	toolInput?: unknown;
	/** Output returned by the tool */
	toolOutput?: unknown;
	/** Error message if tool failed */
	toolError?: string;
	/** How long the tool took to execute (ms) */
	toolDurationMs?: number;

	// Final answer step
	/** The agent's final output/answer */
	finalOutput?: string;
}

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
		status: varchar("status", { length: 20 }).default("pending").notNull(),
		// Input data passed to the node
		inputs: jsonb("inputs"),
		// Output data produced by the node
		outputs: jsonb("outputs"),
		// Agent-specific: Internal trace of agent loop iterations
		// Contains full step-by-step trace of agent reasoning, tool calls, and results
		internalTrace: jsonb("internal_trace").$type<InternalTraceData>(),
		// Metrics
		tokensUsed: integer("tokens_used"),
		// Execution timing
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		// Error information
		errorMessage: text("error_message"),
	},
	(table) => [
		index("node_executions_run_id_idx").on(table.runId),
		index("node_executions_node_id_idx").on(table.nodeId),
		index("node_executions_status_idx").on(table.status),
	],
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
	(table) => [
		index("execution_events_run_id_idx").on(table.runId),
		index("execution_events_event_type_idx").on(table.eventType),
		index("execution_events_node_id_idx").on(table.nodeId),
		index("execution_events_timestamp_idx").on(table.timestamp),
	],
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
	(table) => [
		index("node_definitions_node_type_idx").on(table.nodeType),
		index("node_definitions_category_idx").on(table.category),
	],
);

// ============================================================================
// CREDENTIALS TABLE
// ============================================================================

export const credentials = pgTable(
	"credentials",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Owner of this credential
		ownerId: uuid("owner_id").references(() => users.id, {
			onDelete: "cascade",
		}),
		// User-defined name for this credential instance
		name: varchar("name", { length: 255 }).notNull(),
		// Credential type (e.g., "slackApi", "httpBasicAuth")
		type: varchar("type", { length: 100 }).notNull(),
		// Encrypted credential data (AES-256-GCM)
		// Format: salt:iv:authTag:encrypted (base64)
		data: text("data").notNull(),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.default(sql`now()`)
			.$onUpdate(() => sql`now()`),
	},
	(table) => [
		index("credentials_owner_id_idx").on(table.ownerId),
		index("credentials_type_idx").on(table.type),
		index("credentials_name_idx").on(table.name),
	],
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

export type Credential = typeof credentials.$inferSelect;
export type CredentialInsert = typeof credentials.$inferInsert;

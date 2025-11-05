/**
 * API Type Definitions
 *
 * Zod schemas for all API request/response types
 * These are used for both validation and type generation
 */

import { z } from "zod";
import type { IWorkflowDefinition } from "@/types/interfaces";

// ============================================================================
// COMMON TYPES
// ============================================================================

export const ApiResponseSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
	data: z.unknown().optional(),
});

export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & {
	data?: T;
};

// ============================================================================
// AUTH TYPES
// ============================================================================

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

export const LoginRequestSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthResponseSchema = z.object({
	user: UserSchema,
	token: z.string(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

/**
 * Zod schema for workflow definition validation
 *
 * Note: This is a simplified schema for API validation.
 * The full TypeScript type is IWorkflowDefinition from interfaces.ts
 * TODO: Create proper Zod schemas matching IWorkflowNode and IWorkflowEdge
 */
export const WorkflowDefinitionSchema = z.object({
	nodes: z.record(z.any(), z.any()), // TODO: Proper IWorkflowNode schema
	edges: z.array(z.any()), // TODO: Proper IWorkflowEdge schema
	viewport: z
		.object({
			x: z.number(),
			y: z.number(),
			zoom: z.number(),
		})
		.optional(),
});

/**
 * WorkflowDefinition type for API validation
 * For full type-safe usage, import IWorkflowDefinition from @/types/interfaces
 */
export type WorkflowDefinition = IWorkflowDefinition;

export const WorkflowSchema = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	definition: WorkflowDefinitionSchema,
	created_at: z.string(),
	updated_at: z.string(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowsListResponseSchema = z.object({
	workflows: z.array(WorkflowSchema),
	total: z.number(),
});

export type WorkflowsListResponse = z.infer<typeof WorkflowsListResponseSchema>;

export const CreateWorkflowRequestSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	definition: WorkflowDefinitionSchema,
});

export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;

export const UpdateWorkflowRequestSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	definition: WorkflowDefinitionSchema.optional(),
});

export type UpdateWorkflowRequest = z.infer<typeof UpdateWorkflowRequestSchema>;

// ============================================================================
// WORKFLOW RUN TYPES
// ============================================================================

export const WorkflowRunSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	status: z.enum(["pending", "running", "success", "failed", "cancelled"]),
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const RunWorkflowRequestSchema = z.object({
	inputs: z.record(z.string(), z.unknown()).optional(),
});

export type RunWorkflowRequest = z.infer<typeof RunWorkflowRequestSchema>;

export const RunWorkflowResponseSchema = z.object({
	runId: z.string(),
	workflowId: z.string(),
	status: z.string(),
});

export type RunWorkflowResponse = z.infer<typeof RunWorkflowResponseSchema>;

// ============================================================================
// EXECUTION EVENT TYPES
// ============================================================================

export const ExecutionEventSchema = z.object({
	id: z.string(),
	type: z.string(),
	timestamp: z.string(),
	data: z.record(z.string(), z.unknown()).optional(),
});

export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;

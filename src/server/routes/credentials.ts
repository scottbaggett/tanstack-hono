/**
 * Credential Management API Routes
 *
 * Endpoints for CRUD operations on credentials
 */

import { Hono } from "hono";
import { z } from "zod";
import type {
	ICredentialData,
	ICredentialDataDecryptedObject,
} from "@/types/credentials";
import { credentialRegistry } from "../credentials/registry";
import { credentialService } from "../services/credentials";

const app = new Hono();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createCredentialSchema = z.object({
	name: z.string().min(1, "Name is required"),
	type: z.string().min(1, "Type is required"),
	data: z.record(z.string(), z.unknown()),
});

const updateCredentialSchema = z.object({
	name: z.string().min(1).optional(),
	data: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/credentials/types
 * Get all available credential types
 * NOTE: This must come BEFORE /:id to avoid route conflict
 */
app.get("/types", async (c) => {
	try {
		const types = credentialRegistry.getAllTypes();

		return c.json({
			success: true,
			data: types,
		});
	} catch (error) {
		console.error("Failed to fetch credential types:", error);
		return c.json(
			{
				success: false,
				error: "Failed to fetch credential types",
			},
			500,
		);
	}
});

/**
 * GET /api/credentials
 * List all credentials for the current user (metadata only, no sensitive data)
 */
app.get("/", async (c) => {
	try {
		// TODO: Get actual user ID from auth context
		const ownerId = "temp-user-id";

		const credentials = await credentialService.getAllCredentials(ownerId);

		return c.json({
			success: true,
			data: credentials,
		});
	} catch (error) {
		console.error("Failed to fetch credentials:", error);
		return c.json(
			{
				success: false,
				error: "Failed to fetch credentials",
			},
			500,
		);
	}
});

/**
 * GET /api/credentials/:id
 * Get a specific credential (decrypted for editing)
 */
app.get("/:id", async (c) => {
	try {
		const id = c.req.param("id");
		// TODO: Get actual user ID from auth context
		const ownerId = "temp-user-id";

		const credential = await credentialService.getCredential(id, ownerId);

		if (!credential) {
			return c.json(
				{
					success: false,
					error: "Credential not found",
				},
				404,
			);
		}

		return c.json({
			success: true,
			data: credential,
		});
	} catch (error) {
		console.error("Failed to fetch credential:", error);
		return c.json(
			{
				success: false,
				error: "Failed to fetch credential",
			},
			500,
		);
	}
});

/**
 * POST /api/credentials
 * Create a new credential
 */
app.post("/", async (c) => {
	try {
		const body = await c.req.json();

		// Validate input
		const validation = createCredentialSchema.safeParse(body);
		if (!validation.success) {
			return c.json(
				{
					success: false,
					error: "Validation failed",
					details: validation.error.issues,
				},
				400,
			);
		}

		const { name, type, data } = validation.data;

		// Verify credential type exists
		if (!credentialRegistry.hasType(type)) {
			return c.json(
				{
					success: false,
					error: `Invalid credential type: ${type}`,
				},
				400,
			);
		}

		// TODO: Get actual user ID from auth context
		const ownerId = "temp-user-id";

		// Create credential
		const credentialData: ICredentialData = {
			name,
			type,
			data: data as ICredentialDataDecryptedObject,
		};

		const newCredential = await credentialService.createCredential(
			ownerId,
			credentialData,
		);

		return c.json(
			{
				success: true,
				data: newCredential,
			},
			201,
		);
	} catch (error) {
		console.error("Failed to create credential:", error);
		return c.json(
			{
				success: false,
				error: "Failed to create credential",
			},
			500,
		);
	}
});

/**
 * PUT /api/credentials/:id
 * Update an existing credential
 */
app.put("/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const body = await c.req.json();

		// Validate input
		const validation = updateCredentialSchema.safeParse(body);
		if (!validation.success) {
			return c.json(
				{
					success: false,
					error: "Validation failed",
					details: validation.error.issues,
				},
				400,
			);
		}

		// TODO: Get actual user ID from auth context
		const ownerId = "temp-user-id";

		// Update credential
		const updates = validation.data;
		const updatesWithCorrectType = updates.data
			? { ...updates, data: updates.data as ICredentialDataDecryptedObject }
			: updates;
		const updated = await credentialService.updateCredential(
			id,
			ownerId,
			updatesWithCorrectType as {
				name?: string;
				data?: ICredentialDataDecryptedObject;
			},
		);

		if (!updated) {
			return c.json(
				{
					success: false,
					error: "Credential not found",
				},
				404,
			);
		}

		return c.json({
			success: true,
			data: updated,
		});
	} catch (error) {
		console.error("Failed to update credential:", error);
		return c.json(
			{
				success: false,
				error: "Failed to update credential",
			},
			500,
		);
	}
});

/**
 * DELETE /api/credentials/:id
 * Delete a credential
 */
app.delete("/:id", async (c) => {
	try {
		const id = c.req.param("id");
		// TODO: Get actual user ID from auth context
		const ownerId = "temp-user-id";

		const deleted = await credentialService.deleteCredential(id, ownerId);

		if (!deleted) {
			return c.json(
				{
					success: false,
					error: "Credential not found",
				},
				404,
			);
		}

		return c.json({
			success: true,
			message: "Credential deleted successfully",
		});
	} catch (error) {
		console.error("Failed to delete credential:", error);
		return c.json(
			{
				success: false,
				error: "Failed to delete credential",
			},
			500,
		);
	}
});

export default app;

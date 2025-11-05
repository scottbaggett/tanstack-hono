/**
 * Credential Storage Service
 *
 * Handles CRUD operations for credentials with encryption/decryption
 */

import { and, eq } from "drizzle-orm";
import type {
	ICredentialData,
	ICredentialDataDecryptedObject,
	ICredentialsResponse,
} from "@/types/credentials";
import { db } from "../db";
import { credentials } from "../db/schema";
import { decrypt, encrypt } from "../lib/crypto";

// ============================================================================
// CREDENTIAL SERVICE
// ============================================================================

export class CredentialService {
	/**
	 * Get all credentials for a user (metadata only, no decrypted data)
	 */
	async getAllCredentials(ownerId: string): Promise<ICredentialsResponse[]> {
		const allCredentials = await db
			.select({
				id: credentials.id,
				name: credentials.name,
				type: credentials.type,
				createdAt: credentials.createdAt,
				updatedAt: credentials.updatedAt,
			})
			.from(credentials)
			.where(eq(credentials.ownerId, ownerId));

		return allCredentials.map((cred) => ({
			id: cred.id,
			name: cred.name,
			type: cred.type,
			createdAt: cred.createdAt.toISOString(),
			updatedAt: cred.updatedAt?.toISOString() || cred.createdAt.toISOString(),
		}));
	}

	/**
	 * Get a specific credential by ID (decrypted)
	 */
	async getCredential(
		id: string,
		ownerId: string,
	): Promise<ICredentialData | null> {
		const [credential] = await db
			.select()
			.from(credentials)
			.where(and(eq(credentials.id, id), eq(credentials.ownerId, ownerId)))
			.limit(1);

		if (!credential) {
			return null;
		}

		// Decrypt the data
		const decryptedData = decrypt(credential.data);

		return {
			name: credential.name,
			type: credential.type,
			data: decryptedData as ICredentialDataDecryptedObject,
		};
	}

	/**
	 * Get credential data by type and ID (for node execution)
	 */
	async getCredentialData(
		type: string,
		id: string,
	): Promise<ICredentialDataDecryptedObject | null> {
		const [credential] = await db
			.select()
			.from(credentials)
			.where(and(eq(credentials.id, id), eq(credentials.type, type)))
			.limit(1);

		if (!credential) {
			return null;
		}

		// Decrypt and return data
		return decrypt(credential.data) as ICredentialDataDecryptedObject;
	}

	/**
	 * Create a new credential
	 */
	async createCredential(
		ownerId: string,
		credentialData: ICredentialData,
	): Promise<{ id: string; name: string; type: string }> {
		// Encrypt the credential data
		const encryptedData = encrypt(credentialData.data);

		// Insert into database
		const [newCredential] = await db
			.insert(credentials)
			.values({
				ownerId,
				name: credentialData.name,
				type: credentialData.type,
				data: encryptedData,
			})
			.returning({
				id: credentials.id,
				name: credentials.name,
				type: credentials.type,
			});

		return newCredential;
	}

	/**
	 * Update an existing credential
	 */
	async updateCredential(
		id: string,
		ownerId: string,
		updates: { name?: string; data?: ICredentialDataDecryptedObject },
	): Promise<{ id: string; name: string; type: string } | null> {
		// Get existing credential to verify ownership
		const [existing] = await db
			.select()
			.from(credentials)
			.where(and(eq(credentials.id, id), eq(credentials.ownerId, ownerId)))
			.limit(1);

		if (!existing) {
			return null;
		}

		// Prepare update values
		const updateValues: Record<string, unknown> = {};

		if (updates.name !== undefined) {
			updateValues.name = updates.name;
		}

		if (updates.data !== undefined) {
			// Encrypt new data
			updateValues.data = encrypt(updates.data);
		}

		// Update in database
		const [updated] = await db
			.update(credentials)
			.set(updateValues)
			.where(and(eq(credentials.id, id), eq(credentials.ownerId, ownerId)))
			.returning({
				id: credentials.id,
				name: credentials.name,
				type: credentials.type,
			});

		return updated || null;
	}

	/**
	 * Delete a credential
	 */
	async deleteCredential(id: string, ownerId: string): Promise<boolean> {
		const result = await db
			.delete(credentials)
			.where(and(eq(credentials.id, id), eq(credentials.ownerId, ownerId)))
			.returning({ id: credentials.id });

		return result.length > 0;
	}

	/**
	 * Check if a credential exists and belongs to user
	 */
	async credentialExists(id: string, ownerId: string): Promise<boolean> {
		const [credential] = await db
			.select({ id: credentials.id })
			.from(credentials)
			.where(and(eq(credentials.id, id), eq(credentials.ownerId, ownerId)))
			.limit(1);

		return !!credential;
	}

	/**
	 * Get credentials by type for a user
	 */
	async getCredentialsByType(
		type: string,
		ownerId: string,
	): Promise<ICredentialsResponse[]> {
		const typeCredentials = await db
			.select({
				id: credentials.id,
				name: credentials.name,
				type: credentials.type,
				createdAt: credentials.createdAt,
				updatedAt: credentials.updatedAt,
			})
			.from(credentials)
			.where(and(eq(credentials.type, type), eq(credentials.ownerId, ownerId)));

		return typeCredentials.map((cred) => ({
			id: cred.id,
			name: cred.name,
			type: cred.type,
			createdAt: cred.createdAt.toISOString(),
			updatedAt: cred.updatedAt?.toISOString() || cred.createdAt.toISOString(),
		}));
	}
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const credentialService = new CredentialService();

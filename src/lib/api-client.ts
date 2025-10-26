/**
 * API Client with Hono RPC Types
 *
 * Type-safe API client generated from backend Hono router
 * Provides automatic type inference for all API endpoints
 */

import { hc } from "hono/client";
import type { ApiRouter } from "@/server/api";
import { getToken } from "./api";

// ============================================================================
// RPC CLIENT SETUP
// ============================================================================

const apiURL = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

/**
 * Create Hono RPC client with automatic type inference
 * Automatically includes JWT token in all requests
 */
export function createApiClient() {
	return hc<ApiRouter>(apiURL, {
		headers: {
			authorization: () => {
				const token = getToken();
				return token ? `Bearer ${token}` : "";
			},
		},
	});
}

export const rpcClient = createApiClient();

// ============================================================================
// TYPED EXPORTS
// ============================================================================

/**
 * Re-export types from the server API for frontend use
 */
export type { ApiRouter } from "@/server/api";

/**
 * Type-safe API methods with auto-complete and type inference
 *
 * Usage:
 * ```ts
 * const response = await rpcClient.auth.register.$post({
 *   json: {
 *     email: "user@example.com",
 *     username: "john",
 *     password: "password123"
 *   }
 * });
 *
 * const user = response.json(); // Fully typed!
 * ```
 */
export const apiEndpoints = {
	// Auth endpoints
	auth: {
		register: rpcClient.auth.register,
		login: rpcClient.auth.login,
		me: rpcClient.auth.me,
	},

	// Workflow endpoints
	workflows: {
		list: rpcClient.workflows,
		get: (id: string) => rpcClient.workflows[":id"].$get({ param: { id } }),
		create: rpcClient.workflows,
		update: (id: string) => rpcClient.workflows[":id"],
		delete: (id: string) => rpcClient.workflows[":id"],
		run: (id: string) => rpcClient.workflows[":id"].run,
	},

	// Health check
	health: rpcClient.health,
};

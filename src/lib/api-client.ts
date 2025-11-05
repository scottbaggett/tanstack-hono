/**
 * API Client with Hono RPC Types
 *
 * Type-safe API client generated from backend Hono router
 * Provides automatic type inference for all API endpoints
 *
 * Based on Hono RPC: https://hono.dev/docs/guides/rpc
 */

import { hc } from "hono/client";
import type { ApiRouter } from "@/server/api";
import { getToken } from "./api";

// ============================================================================
// RPC CLIENT SETUP
// ============================================================================

const apiURL =
	typeof window !== "undefined"
		? window.location.origin
		: "http://localhost:3000";

// Pre-compute the client type to help TypeScript infer all routes
// This pattern from Hono docs helps with IDE performance and type inference
type PrecomputedClient = ReturnType<typeof hc<ApiRouter>>;

/**
 * Create Hono RPC client with automatic type inference
 * Automatically includes JWT token in all requests
 *
 * This uses Hono's RPC feature to get full type safety from the server API router.
 * Types are automatically inferred from the ApiRouter type.
 *
 * Usage:
 * ```ts
 * const client = createApiClient();
 * const response = await client.auth.register.$post({
 *   json: {
 *     email: "user@example.com",
 *     username: "john",
 *     password: "password123"
 *   }
 * });
 *
 * if (response.ok) {
 *   const data = await response.json(); // Fully typed!
 * }
 * ```
 */
export function createApiClient() {
	const token = getToken();
	return hc<ApiRouter>(apiURL, {
		init: {
			credentials: "include", // Include cookies in requests
			headers: {
				Authorization: token ? `Bearer ${token}` : "",
			},
		},
	});
}

/**
 * Type-safe Hono RPC client type
 * Use this type when you need to reference the client type explicitly
 * This uses the pre-computed type to ensure all routes are properly typed
 */
export type ApiClient = PrecomputedClient;

/**
 * Default RPC client instance
 * Use this for most API calls, or create your own with createApiClient()
 *
 * @example
 * ```ts
 * const res = await rpcClient.workflows.$get();
 * const data = await res.json();
 *
 * // For routes with params:
 * const res = await rpcClient.workflows[":id"].$get({
 *   param: { id: "workflow-123" }
 * });
 * ```
 */
export const rpcClient = createApiClient();

// ============================================================================
// TYPED EXPORTS
// ============================================================================

/**
 * Type helper to infer request types from RPC client methods
 *
 * @example
 * ```ts
 * import type { InferRequestType } from "hono/client";
 * type RegisterRequest = InferRequestType<typeof rpcClient.auth.register.$post>["json"];
 * ```
 */
export type { InferRequestType, InferResponseType } from "hono/client";
/**
 * Re-export the API router type for use in frontend code
 */
export type { ApiRouter } from "@/server/api";

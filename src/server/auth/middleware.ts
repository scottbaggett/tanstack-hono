/**
 * Authentication Middleware
 *
 * Protects routes and extracts user context.
 */

import { createMiddleware } from "hono/factory";
import { extractToken, type JWTPayload, verifyToken } from "./jwt";

// ============================================================================
// TYPES
// ============================================================================

export interface AuthContext {
	user: JWTPayload;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware
 *
 * Verifies JWT token and adds user to context.
 * Usage: app.use("/protected/*", authMiddleware)
 */
export const authMiddleware = createMiddleware(async (c, next) => {
	try {
		const authHeader = c.req.header("Authorization");
		const token = extractToken(authHeader);

		if (!token) {
			return c.json(
				{
					success: false,
					error: "Missing authentication token",
				},
				401,
			);
		}

		const user = verifyToken(token);

		// Add user to context
		c.set("user", user);

		await next();
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Authentication failed",
			},
			401,
		);
	}
});

/**
 * Get authenticated user from context
 */
export function getAuthUser(c: any): JWTPayload {
	const user = c.get("user");
	if (!user) {
		throw new Error("User not authenticated");
	}
	return user;
}

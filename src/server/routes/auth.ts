/**
 * Authentication Routes
 *
 * Endpoints for user registration and login.
 */

import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken } from "../auth/jwt";
import { getAuthUser, authMiddleware } from "../auth/middleware";

// ============================================================================
// TYPES
// ============================================================================

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export const authRoutes = new Hono();

// POST /auth/register - Create new user
authRoutes.post("/register", async (c) => {
	try {
		const body = await c.req.json();

		// Validate input
		const schema = z.object({
			email: z.string().email(),
			username: z.string().min(3).max(100),
			password: z.string().min(8),
			fullName: z.string().max(255).optional(),
		});

		const validated = schema.parse(body);

		// Check if user exists
		const existing = await db
			.select()
			.from(users)
			.where(eq(users.email, validated.email))
			.limit(1);

		if (existing.length > 0) {
			return c.json(
				{
					success: false,
					error: "Email already registered",
				},
				400
			);
		}

		// Hash password
		const passwordHash = await hashPassword(validated.password);

		// Create user
		const result = await db
			.insert(users)
			.values({
				email: validated.email,
				username: validated.username,
				fullName: validated.fullName || null,
				isActive: true,
				passwordHash,
			})
			.returning();

		const user = result[0];

		// Generate token
		const token = generateToken({
			userId: user.id,
			email: user.email,
			username: user.username,
		});

		return c.json(
			{
				success: true,
				data: {
					user: {
						id: user.id,
						email: user.email,
						username: user.username,
						fullName: user.fullName,
					},
					token,
				},
			},
			201
		);
	} catch (error) {
		console.error("Registration error:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Registration failed",
			},
			400
		);
	}
});

// POST /auth/login - Authenticate user
authRoutes.post("/login", async (c) => {
	try {
		const body = await c.req.json();

		// Validate input
		const schema = z.object({
			email: z.string().email(),
			password: z.string(),
		});

		const validated = schema.parse(body);

		// Find user
		const result = await db
			.select()
			.from(users)
			.where(eq(users.email, validated.email))
			.limit(1);

		if (result.length === 0) {
			return c.json(
				{
					success: false,
					error: "Invalid email or password",
				},
				401
			);
		}

		const user = result[0];

		// Check if user is active
		if (!user.isActive) {
			return c.json(
				{
					success: false,
					error: "User account is inactive",
				},
				401
			);
		}

		// Verify password
		const isValid = await comparePassword(validated.password, user.passwordHash || "");

		if (!isValid) {
			return c.json(
				{
					success: false,
					error: "Invalid email or password",
				},
				401
			);
		}

		// Generate token
		const token = generateToken({
			userId: user.id,
			email: user.email,
			username: user.username,
		});

		return c.json({
			success: true,
			data: {
				user: {
					id: user.id,
					email: user.email,
					username: user.username,
					fullName: user.fullName,
				},
				token,
			},
		});
	} catch (error) {
		console.error("Login error:", error);

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Login failed",
			},
			400
		);
	}
});

// GET /auth/me - Get current user (protected)
authRoutes.get("/me", authMiddleware, async (c) => {
	try {
		const user = getAuthUser(c);

		// Get fresh user data from DB
		const result = await db
			.select()
			.from(users)
			.where(eq(users.id, user.userId))
			.limit(1);

		if (result.length === 0) {
			return c.json(
				{
					success: false,
					error: "User not found",
				},
				404
			);
		}

		const dbUser = result[0];

		return c.json({
			success: true,
			data: {
				id: dbUser.id,
				email: dbUser.email,
				username: dbUser.username,
				fullName: dbUser.fullName,
				isActive: dbUser.isActive,
				createdAt: dbUser.createdAt,
			},
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed to fetch user",
			},
			500
		);
	}
});

/**
 * JWT Authentication
 *
 * Simple JWT-based auth for the workflow platform.
 */

import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";
const BCRYPT_ROUNDS = 10;

// ============================================================================
// TYPES
// ============================================================================

export interface JWTPayload {
	userId: string;
	email: string;
	username: string;
	iat?: number;
	exp?: number;
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
	return bcryptjs.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
	return bcryptjs.compare(password, hash);
}

// ============================================================================
// JWT GENERATION
// ============================================================================

/**
 * Generate a JWT token
 */
export function generateToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
	return jwt.sign(payload, JWT_SECRET, {
		expiresIn: JWT_EXPIRY,
	} as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload {
	try {
		return jwt.verify(token, JWT_SECRET) as JWTPayload;
	} catch (error) {
		throw new Error("Invalid or expired token");
	}
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader?: string): string | null {
	if (!authHeader) return null;

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") {
		return null;
	}

	return parts[1];
}

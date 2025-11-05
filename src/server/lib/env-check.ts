/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup
 */

import { generateEncryptionKey, validateEncryptionKey } from "./crypto";

export function validateEnvironment(): void {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check encryption key
	const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

	if (!encryptionKey) {
		errors.push(
			"CREDENTIALS_ENCRYPTION_KEY is not set. " +
				"Credentials cannot be encrypted/decrypted without this key.",
		);
		console.error(
			"\n❌ MISSING: CREDENTIALS_ENCRYPTION_KEY environment variable\n",
		);
		console.error("To fix this, add to your .env file:");
		console.error(`CREDENTIALS_ENCRYPTION_KEY="${generateEncryptionKey()}"\n`);
	} else if (!validateEncryptionKey(encryptionKey)) {
		errors.push(
			"CREDENTIALS_ENCRYPTION_KEY is invalid. " +
				"It must be a valid base64-encoded 32-byte key.",
		);
		console.error("\n❌ INVALID: CREDENTIALS_ENCRYPTION_KEY\n");
		console.error("Generate a new key with:");
		console.error(
			"node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n",
		);
	}

	// Check database connection
	if (!process.env.DATABASE_URL) {
		warnings.push("DATABASE_URL is not set");
	}

	// Log warnings
	if (warnings.length > 0) {
		console.warn("\n⚠️  Environment Warnings:");
		for (const warning of warnings) {
			console.warn(`   - ${warning}`);
		}
		console.warn("");
	}

	// Throw on errors
	if (errors.length > 0) {
		console.error("\n❌ Environment Validation Failed:");
		for (const error of errors) {
			console.error(`   - ${error}`);
		}
		console.error("");
		throw new Error("Environment validation failed. See errors above.");
	}

	// Success message
	if (errors.length === 0 && warnings.length === 0) {
		console.log("✅ Environment validation passed");
	}
}

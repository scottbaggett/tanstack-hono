/**
 * Encryption/Decryption Utilities
 *
 * Uses AES-256-GCM for secure credential storage
 */

import crypto from 'node:crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 10000;

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Derive encryption key from master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
	return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Get master encryption key from environment
 */
export function getEncryptionKey(): string {
	const key = process.env.CREDENTIALS_ENCRYPTION_KEY;

	if (!key) {
		throw new Error(
			'CREDENTIALS_ENCRYPTION_KEY environment variable is not set. ' +
				'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
		);
	}

	return key;
}

// ============================================================================
// ENCRYPTION
// ============================================================================

/**
 * Encrypt data using AES-256-GCM
 *
 * @param data - Plain object to encrypt
 * @param encryptionKey - Master encryption key (optional, uses env by default)
 * @returns Encrypted string in format: salt:iv:authTag:encrypted (base64)
 */
export function encrypt(
	data: Record<string, any>,
	encryptionKey?: string,
): string {
	const masterKey = encryptionKey || getEncryptionKey();
	const plaintext = JSON.stringify(data);

	// Generate random salt and IV
	const salt = crypto.randomBytes(SALT_LENGTH);
	const iv = crypto.randomBytes(IV_LENGTH);

	// Derive key from master key + salt
	const key = deriveKey(masterKey, salt);

	// Create cipher
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	// Encrypt data
	const encrypted = Buffer.concat([
		cipher.update(plaintext, 'utf8'),
		cipher.final(),
	]);

	// Get authentication tag
	const authTag = cipher.getAuthTag();

	// Return format: salt:iv:authTag:encrypted (all base64)
	return [
		salt.toString('base64'),
		iv.toString('base64'),
		authTag.toString('base64'),
		encrypted.toString('base64'),
	].join(':');
}

// ============================================================================
// DECRYPTION
// ============================================================================

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - Encrypted string (salt:iv:authTag:encrypted)
 * @param encryptionKey - Master encryption key (optional, uses env by default)
 * @returns Decrypted object
 */
export function decrypt(
	encryptedData: string,
	encryptionKey?: string,
): Record<string, any> {
	const masterKey = encryptionKey || getEncryptionKey();

	// Parse encrypted data
	const parts = encryptedData.split(':');
	if (parts.length !== 4) {
		throw new Error('Invalid encrypted data format');
	}

	const [saltB64, ivB64, authTagB64, encryptedB64] = parts;

	// Decode from base64
	const salt = Buffer.from(saltB64, 'base64');
	const iv = Buffer.from(ivB64, 'base64');
	const authTag = Buffer.from(authTagB64, 'base64');
	const encrypted = Buffer.from(encryptedB64, 'base64');

	// Derive key from master key + salt
	const key = deriveKey(masterKey, salt);

	// Create decipher
	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	// Decrypt data
	const decrypted = Buffer.concat([
		decipher.update(encrypted),
		decipher.final(),
	]);

	// Parse JSON
	return JSON.parse(decrypted.toString('utf8'));
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a new encryption key (for setup)
 */
export function generateEncryptionKey(): string {
	return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Validate that an encryption key can encrypt/decrypt properly
 */
export function validateEncryptionKey(key: string): boolean {
	try {
		const testData = { test: 'value' };
		const encrypted = encrypt(testData, key);
		const decrypted = decrypt(encrypted, key);
		return decrypted.test === 'value';
	} catch (error) {
		return false;
	}
}

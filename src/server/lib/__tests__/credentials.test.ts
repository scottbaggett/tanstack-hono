/**
 * Credential System Test
 *
 * Tests encryption/decryption and credential flow
 */

import { describe, it, expect } from "vitest";
import { encrypt, decrypt, generateEncryptionKey } from "../crypto";

describe("Credential Encryption System", () => {
	const testKey = generateEncryptionKey();
	const credentialData = {
		username: "admin",
		password: "secret123",
		apiKey: "sk-1234567890abcdef",
	};

	it("should generate encryption key", () => {
		const key = generateEncryptionKey();
		expect(key).toMatch(/^[A-Za-z0-9+/]+={0,2}$/); // Base64 format
		expect(key).toHaveLength(44); // 32 bytes = 44 base64 chars
	});

	it("should encrypt and decrypt data correctly", () => {
		const encrypted = encrypt(credentialData, testKey);
		const decrypted = decrypt(encrypted, testKey);

		expect(JSON.stringify(decrypted)).toBe(JSON.stringify(credentialData));
	});

	it("should produce different ciphertexts for same data", () => {
		const encrypted1 = encrypt(credentialData, testKey);
		const encrypted2 = encrypt(credentialData, testKey);

		expect(encrypted1).not.toBe(encrypted2);
		expect(JSON.stringify(decrypt(encrypted1, testKey))).toBe(
			JSON.stringify(credentialData),
		);
		expect(JSON.stringify(decrypt(encrypted2, testKey))).toBe(
			JSON.stringify(credentialData),
		);
	});

	it("should fail with wrong key", () => {
		const encrypted = encrypt(credentialData, testKey);
		const wrongKey = generateEncryptionKey();

		expect(() => {
			decrypt(encrypted, wrongKey);
		}).toThrow();
	});

	it("should fail with tampered data", () => {
		const encrypted = encrypt(credentialData, testKey);
		const parts = encrypted.split(":");
		parts[3] = parts[3].substring(0, parts[3].length - 1) + "X"; // Tamper
		const tampered = parts.join(":");

		expect(() => {
			decrypt(tampered, testKey);
		}).toThrow();
	});

	it("should have proper encryption format", () => {
		const encrypted = encrypt(credentialData, testKey);
		const parts = encrypted.split(":");

		expect(parts).toHaveLength(4); // salt:iv:authTag:encrypted
		expect(parts[0]).toBeTruthy(); // salt
		expect(parts[1]).toBeTruthy(); // iv
		expect(parts[2]).toBeTruthy(); // authTag
		expect(parts[3]).toBeTruthy(); // encrypted
	});
});

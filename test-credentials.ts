/**
 * Credential System Test
 *
 * Tests encryption/decryption and credential flow
 */

import { encrypt, decrypt, generateEncryptionKey } from './src/server/lib/crypto';

console.log('=== Testing Credential Encryption System ===\n');

// Test 1: Generate encryption key
console.log('Test 1: Generate Encryption Key');
const testKey = generateEncryptionKey();
console.log('Generated key (save this in .env):');
console.log(`CREDENTIALS_ENCRYPTION_KEY="${testKey}"`);
console.log();

// Test 2: Encrypt credential data
console.log('Test 2: Encrypt Credential Data');
const credentialData = {
	username: 'admin',
	password: 'secret123',
	apiKey: 'sk-1234567890abcdef',
};
console.log('Original data:', credentialData);

const encrypted = encrypt(credentialData, testKey);
console.log('Encrypted:', encrypted.substring(0, 50) + '...');
console.log('Format parts:', encrypted.split(':').map((p, i) =>
	['salt', 'iv', 'authTag', 'encrypted'][i] + ': ' + p.substring(0, 20) + '...'
));
console.log();

// Test 3: Decrypt credential data
console.log('Test 3: Decrypt Credential Data');
const decrypted = decrypt(encrypted, testKey);
console.log('Decrypted data:', decrypted);
console.log('Match:', JSON.stringify(credentialData) === JSON.stringify(decrypted) ? '✅' : '❌');
console.log();

// Test 4: Verify different encryptions produce different ciphertexts
console.log('Test 4: Verify Random Salt/IV (security check)');
const encrypted1 = encrypt(credentialData, testKey);
const encrypted2 = encrypt(credentialData, testKey);
console.log('First encryption (start):', encrypted1.substring(0, 50) + '...');
console.log('Second encryption (start):', encrypted2.substring(0, 50) + '...');
console.log('Different ciphertexts:', encrypted1 !== encrypted2 ? '✅ (Good!)' : '❌ (Bad!)');
console.log('Both decrypt correctly:',
	JSON.stringify(decrypt(encrypted1, testKey)) === JSON.stringify(credentialData) &&
	JSON.stringify(decrypt(encrypted2, testKey)) === JSON.stringify(credentialData) ? '✅' : '❌'
);
console.log();

// Test 5: Wrong key should fail
console.log('Test 5: Wrong Key Should Fail');
const wrongKey = generateEncryptionKey();
try {
	decrypt(encrypted, wrongKey);
	console.log('❌ Decryption succeeded with wrong key (SECURITY ISSUE!)');
} catch (error) {
	console.log('✅ Decryption failed with wrong key (expected)');
	console.log('Error:', (error as Error).message);
}
console.log();

// Test 6: Tampered data should fail
console.log('Test 6: Tampered Data Should Fail');
const parts = encrypted.split(':');
parts[3] = parts[3].substring(0, parts[3].length - 1) + 'X'; // Tamper with encrypted data
const tampered = parts.join(':');
try {
	decrypt(tampered, testKey);
	console.log('❌ Decryption succeeded with tampered data (SECURITY ISSUE!)');
} catch (error) {
	console.log('✅ Decryption failed with tampered data (expected)');
	console.log('Error:', (error as Error).message);
}
console.log();

console.log('=== Tests Complete ===');
console.log('\nTo run: npx tsx test-credentials.ts');
console.log('\nNext steps:');
console.log('1. Add the generated CREDENTIALS_ENCRYPTION_KEY to your .env file');
console.log('2. Start the server: pnpm run dev');
console.log('3. Test API endpoints:');
console.log('   - GET /api/credentials/types');
console.log('   - POST /api/credentials');
console.log('   - GET /api/credentials/:id');
console.log('   - PUT /api/credentials/:id');
console.log('   - DELETE /api/credentials/:id');

/**
 * Key Vault — Encrypted storage for delegated signing keys
 *
 * Used by Hyperliquid (agent wallet) and Lighter (API key) exchanges
 * where the backend signs orders on behalf of the user.
 *
 * Pacifica does NOT use this — signing happens client-side in the browser.
 *
 * Security:
 * - AES-256-GCM encryption with random IV per key
 * - Encryption secret from EXCHANGE_KEY_ENCRYPTION_SECRET env var
 * - Never log or expose plaintext keys
 * - Encrypted format: base64(iv:ciphertext:authTag)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Get the encryption key from environment variable.
 * Must be exactly 32 bytes (256 bits) hex-encoded (64 hex chars).
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.EXCHANGE_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      'EXCHANGE_KEY_ENCRYPTION_SECRET is not set. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Support both hex-encoded (64 chars) and raw 32-byte keys
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  // Hash arbitrary-length secrets to get a 32-byte key
  const { createHash } = require('crypto');
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext key for storage in the database.
 * Returns a base64-encoded string containing IV + ciphertext + auth tag.
 *
 * @param plaintext The raw private key or API key to encrypt
 * @returns Encrypted string safe for database storage
 */
export function encryptKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: base64(iv + ciphertext + authTag)
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypt a stored key back to plaintext.
 *
 * @param encryptedData The base64-encoded encrypted data from the database
 * @returns The original plaintext key
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decryptKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Check if the encryption secret is configured.
 * Useful for conditional logic — Pacifica doesn't need it.
 */
export function isKeyVaultConfigured(): boolean {
  return !!process.env.EXCHANGE_KEY_ENCRYPTION_SECRET;
}

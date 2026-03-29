import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Credential Encryption Service
 *
 * Uses AES-256-GCM for encrypting cloud credentials.
 * Derives per-organization keys from a master key using HKDF.
 *
 * Security considerations:
 * - Master key stored in environment variable (CREDENTIAL_ENCRYPTION_KEY)
 * - Per-org derived keys ensure credential isolation
 * - GCM mode provides both confidentiality and integrity
 * - Random IV for each encryption operation
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the master encryption key from environment
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (!masterKeyHex) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is required');
  }

  // Key should be provided as hex string (64 characters for 256 bits)
  if (masterKeyHex.length !== 64) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 64 hex characters (256 bits)');
  }

  return Buffer.from(masterKeyHex, 'hex');
}

/**
 * Derive an organization-specific key from the master key using HKDF
 * This ensures credentials from different orgs are encrypted with different keys
 */
function deriveOrgKey(orgId: string): Buffer {
  const masterKey = getMasterKey();

  // Use HKDF to derive org-specific key
  // Salt is the org ID, info is the purpose
  const derived = crypto.hkdfSync(
    'sha256',
    masterKey,
    `org-${orgId}`, // Salt includes org ID
    'cloud-credentials', // Info/context
    KEY_LENGTH
  );
  return Buffer.from(derived);
}

/**
 * Encrypt credential data for a specific organization
 * @param data - The credential data to encrypt (will be JSON stringified)
 * @param orgId - The organization ID (used to derive encryption key)
 * @returns Encrypted data as base64 string (format: iv:authTag:ciphertext)
 */
export function encryptCredentials(data: object, orgId: string): string {
  try {
    const key = deriveOrgKey(orgId);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and ciphertext
    // Format: base64(iv):base64(authTag):base64(ciphertext)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    logger.error('Failed to encrypt credentials', { error, orgId });
    throw new Error('Failed to encrypt credentials');
  }
}

/**
 * Decrypt credential data for a specific organization
 * @param encryptedData - The encrypted data string (format: iv:authTag:ciphertext)
 * @param orgId - The organization ID (used to derive decryption key)
 * @returns Decrypted credential data as object
 */
export function decryptCredentials<T = object>(encryptedData: string, orgId: string): T {
  try {
    const key = deriveOrgKey(orgId);

    // Parse the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as T;
  } catch (error) {
    logger.error('Failed to decrypt credentials', { error, orgId });
    throw new Error('Failed to decrypt credentials');
  }
}

/**
 * Generate a new random encryption key (for initial setup)
 * @returns A 64-character hex string suitable for CREDENTIAL_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Validate that the encryption system is properly configured
 * @returns true if encryption is ready to use
 */
export function validateEncryptionSetup(): boolean {
  try {
    // Try to get the master key
    getMasterKey();

    // Test encryption/decryption round-trip
    const testOrgId = 'test-org-validation';
    const testData = { test: 'validation', timestamp: Date.now() };

    const encrypted = encryptCredentials(testData, testOrgId);
    const decrypted = decryptCredentials<typeof testData>(encrypted, testOrgId);

    if (decrypted.test !== testData.test) {
      throw new Error('Encryption round-trip validation failed');
    }

    return true;
  } catch (error) {
    logger.error('Encryption setup validation failed', { error });
    return false;
  }
}

/**
 * Re-encrypt credentials with a new key (for key rotation)
 * @param encryptedData - Currently encrypted data
 * @param orgId - Organization ID
 * @param newMasterKey - New master key (hex string)
 * @returns Re-encrypted data with new key
 */
export function rotateEncryptionKey(
  encryptedData: string,
  orgId: string,
  newMasterKeyHex: string
): string {
  // First, decrypt with current key
  const decrypted = decryptCredentials(encryptedData, orgId);

  // Temporarily override the master key for re-encryption
  const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  process.env.CREDENTIAL_ENCRYPTION_KEY = newMasterKeyHex;

  try {
    // Re-encrypt with new key
    const reEncrypted = encryptCredentials(decrypted, orgId);
    return reEncrypted;
  } finally {
    // Restore original key
    if (originalKey) {
      process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    }
  }
}

export default {
  encryptCredentials,
  decryptCredentials,
  generateEncryptionKey,
  validateEncryptionSetup,
  rotateEncryptionKey,
};

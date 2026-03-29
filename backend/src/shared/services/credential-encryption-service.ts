import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '../utils/logger';

const scryptAsync = promisify(scrypt);

// Cache the master key
let cachedMasterKey: Buffer | null = null;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the master encryption key from environment or Secrets Manager
 */
async function getMasterKey(): Promise<Buffer> {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  // Try environment variable first (for local development)
  if (process.env.CREDENTIAL_ENCRYPTION_KEY) {
    // Derive a 32-byte key from the provided key
    const salt = Buffer.from('oncallshift-credential-salt', 'utf8');
    cachedMasterKey = (await scryptAsync(process.env.CREDENTIAL_ENCRYPTION_KEY, salt, 32)) as Buffer;
    return cachedMasterKey;
  }

  // Try Secrets Manager
  try {
    const secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const secretId = `${process.env.PROJECT_NAME || 'oncallshift'}-${process.env.ENVIRONMENT || 'dev'}-credential-key`;

    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretId })
    );

    if (response.SecretString) {
      const salt = Buffer.from('oncallshift-credential-salt', 'utf8');
      cachedMasterKey = (await scryptAsync(response.SecretString, salt, 32)) as Buffer;
      return cachedMasterKey;
    }
  } catch (error) {
    logger.warn('Could not fetch encryption key from Secrets Manager:', error);
  }

  throw new Error('No encryption key available. Set CREDENTIAL_ENCRYPTION_KEY environment variable or configure Secrets Manager.');
}

/**
 * Encrypt a credential (API key or OAuth token)
 * Returns base64-encoded string containing: salt + iv + authTag + encrypted
 */
export async function encryptCredential(plaintext: string): Promise<string> {
  const masterKey = await getMasterKey();

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key with unique salt
  const key = (await scryptAsync(masterKey, salt, 32)) as Buffer;

  // Encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a credential
 */
export async function decryptCredential(encryptedBase64: string): Promise<string> {
  const masterKey = await getMasterKey();

  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract parts
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key with same salt
  const key = (await scryptAsync(masterKey, salt, 32)) as Buffer;

  // Decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Detect the type of Anthropic credential from its prefix
 */
export function detectCredentialType(credential: string): 'api_key' | 'oauth' | null {
  if (credential.startsWith('sk-ant-api')) {
    return 'api_key';
  }
  if (credential.startsWith('sk-ant-oat')) {
    return 'oauth';
  }
  // Legacy API key format
  if (credential.startsWith('sk-ant-') && !credential.startsWith('sk-ant-oat') && !credential.startsWith('sk-ant-ort')) {
    return 'api_key';
  }
  return null;
}

/**
 * Generate a display hint for a credential (shows prefix and last 4 chars)
 * Example: "sk-ant-api...1234"
 */
export function generateCredentialHint(credential: string): string {
  if (credential.length < 12) {
    return '***';
  }

  // Get prefix (up to first 10 chars or first dash section)
  const prefixMatch = credential.match(/^(sk-ant-[a-z]+)/);
  const prefix = prefixMatch ? prefixMatch[1] : credential.substring(0, 8);

  // Get last 4 characters
  const suffix = credential.substring(credential.length - 4);

  return `${prefix}...${suffix}`;
}

/**
 * Validate an Anthropic credential by making a test API call
 */
export async function validateCredential(credential: string): Promise<boolean> {
  try {
    // Dynamically import to avoid circular dependencies
    const Anthropic = (await import('@anthropic-ai/sdk')).default;

    const client = new Anthropic({
      apiKey: credential,
    });

    // Make a minimal API call to validate the credential
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    return true;
  } catch (error: any) {
    // Check for auth errors vs other errors
    if (error.status === 401 || error.status === 403) {
      return false;
    }
    // Rate limit or other errors might mean the key is valid
    if (error.status === 429) {
      return true; // Key is valid, just rate limited
    }
    logger.warn('Credential validation error:', error.message);
    return false;
  }
}

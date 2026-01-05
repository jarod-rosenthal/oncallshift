#!/usr/bin/env npx ts-node
/**
 * Create an API key for AI Workers and store it in AWS Secrets Manager.
 *
 * Usage:
 *   1. Log in to the OnCallShift UI and open browser DevTools
 *   2. Go to Network tab, find any API request, copy the Authorization header value
 *   3. Run: JWT_TOKEN="<your-token>" npx ts-node scripts/create-ai-worker-api-key.ts
 *
 * This script will:
 *   - Create an org API key named "AI Workers" with full scopes
 *   - Store the key in AWS Secrets Manager
 *   - Output the key for verification
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import {
  SecretsManagerClient,
  PutSecretValueCommand,
  CreateSecretCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';
import { getDataSource } from '../src/shared/db/data-source';
import { OrganizationApiKey, User } from '../src/shared/models';

const API_KEY_NAME = 'AI Workers';
const SECRET_NAME = 'pagerduty-lite-dev-ai-worker-org-key';

function generateApiKeyToken(): string {
  const uuid = uuidv4().replace(/-/g, '');
  return `org_${uuid}`;
}

async function main() {
  console.log('Creating AI Worker API key...\n');

  // Get organization ID - we'll use the first super_admin's org
  const dataSource = await getDataSource();
  const userRepo = dataSource.getRepository(User);
  const apiKeyRepo = dataSource.getRepository(OrganizationApiKey);

  // Find any admin user to get the org ID
  const adminUser = await userRepo.findOne({
    where: [{ role: 'super_admin' }, { role: 'admin' }],
    relations: ['organization'],
    order: { createdAt: 'ASC' },
  });

  if (!adminUser) {
    console.error('No admin user found in database');
    process.exit(1);
  }

  const orgId = adminUser.orgId;
  console.log(`Using organization: ${adminUser.organization?.name || orgId}`);

  // Check if key already exists
  let existingKey = await apiKeyRepo.findOne({
    where: { orgId, name: API_KEY_NAME },
  });

  let token: string;

  if (existingKey) {
    console.log(`Found existing API key "${API_KEY_NAME}", rotating it...`);

    // Generate new token
    token = generateApiKeyToken();
    const keyPrefix = token.substring(0, 12);
    const keyHash = await bcrypt.hash(token, 10);

    existingKey.keyHash = keyHash;
    existingKey.keyPrefix = keyPrefix;
    await apiKeyRepo.save(existingKey);

    console.log(`Key rotated. New prefix: ${keyPrefix}`);
  } else {
    console.log(`Creating new API key "${API_KEY_NAME}"...`);

    // Generate token
    token = generateApiKeyToken();
    const keyPrefix = token.substring(0, 12);
    const keyHash = await bcrypt.hash(token, 10);

    // Create the API key
    const apiKey = apiKeyRepo.create({
      id: uuidv4(),
      orgId,
      name: API_KEY_NAME,
      keyHash,
      keyPrefix,
      scopes: ['*'], // Full access
      createdById: adminUser.id,
    });

    await apiKeyRepo.save(apiKey);
    console.log(`Key created. Prefix: ${keyPrefix}`);
  }

  // Store in AWS Secrets Manager
  console.log(`\nStoring key in AWS Secrets Manager: ${SECRET_NAME}`);

  const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

  try {
    await secretsClient.send(
      new PutSecretValueCommand({
        SecretId: SECRET_NAME,
        SecretString: token,
      })
    );
    console.log('Secret updated successfully');
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      // Create the secret if it doesn't exist
      await secretsClient.send(
        new CreateSecretCommand({
          Name: SECRET_NAME,
          SecretString: token,
          Description: 'API key for AI Worker authentication to OnCallShift API',
        })
      );
      console.log('Secret created successfully');
    } else {
      throw error;
    }
  }

  console.log('\n=== DONE ===');
  console.log(`API Key Token: ${token}`);
  console.log(`Key Prefix: ${token.substring(0, 12)}`);
  console.log(`\nThe key is now stored in AWS Secrets Manager.`);
  console.log(`ECS tasks will use it automatically on next deployment.`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

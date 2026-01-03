/**
 * Global Setup for Integration Tests
 *
 * This file runs once before all integration tests.
 * It authenticates with the API and caches the auth token for use by all tests.
 */

import axios from 'axios';

// Environment configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://oncallshift.com/api';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TestUser {
  email: string;
  id?: string;
  orgId?: string;
}

// Store auth data in global state for tests to access
declare global {
  // eslint-disable-next-line no-var
  var __INTEGRATION_TEST_AUTH_TOKEN__: string;
  // eslint-disable-next-line no-var
  var __INTEGRATION_TEST_USER__: TestUser;
  // eslint-disable-next-line no-var
  var __INTEGRATION_TEST_API_BASE_URL__: string;
}

async function login(email: string, password: string): Promise<AuthTokens> {
  const response = await axios.post(`${API_BASE_URL}/v1/auth/login`, {
    email,
    password,
  });

  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }

  return response.data.tokens;
}

async function verifyUserExists(token: string): Promise<TestUser> {
  try {
    const response = await axios.get(`${API_BASE_URL}/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      email: response.data.email,
      id: response.data.id,
      orgId: response.data.orgId,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to verify test user: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    }
    throw error;
  }
}

export default async function globalSetup(): Promise<void> {
  console.log('\n========================================');
  console.log('Integration Test Setup');
  console.log('========================================\n');

  // Validate required environment variables
  if (!TEST_USER_EMAIL) {
    throw new Error('TEST_USER_EMAIL environment variable is required for integration tests');
  }

  if (!TEST_USER_PASSWORD) {
    throw new Error('TEST_USER_PASSWORD environment variable is required for integration tests');
  }

  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test User: ${TEST_USER_EMAIL}`);

  try {
    // Authenticate test user
    console.log('\nAuthenticating test user...');
    const tokens = await login(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    console.log('Authentication successful');

    // Verify user exists and get user details
    console.log('Verifying test user...');
    const testUser = await verifyUserExists(tokens.accessToken);
    console.log(`User verified: ${testUser.email} (ID: ${testUser.id})`);

    // Store auth data in global state
    // Jest runs globalSetup in a separate process, so we need to use process.env
    // to pass data to tests
    process.env.__INTEGRATION_TEST_AUTH_TOKEN__ = tokens.accessToken;
    process.env.__INTEGRATION_TEST_USER__ = JSON.stringify(testUser);
    process.env.__INTEGRATION_TEST_API_BASE_URL__ = API_BASE_URL;

    console.log('\n========================================');
    console.log('Setup complete - ready to run tests');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n========================================');
    console.error('Setup failed!');
    console.error('========================================\n');

    if (axios.isAxiosError(error)) {
      console.error(`API Error: ${error.response?.status} - ${error.message}`);
      console.error('Response:', JSON.stringify(error.response?.data, null, 2));
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }

    throw error;
  }
}

// Export helper functions for use in tests
export function getAuthToken(): string {
  const token = process.env.__INTEGRATION_TEST_AUTH_TOKEN__;
  if (!token) {
    throw new Error('Auth token not available. Did globalSetup run successfully?');
  }
  return token;
}

export function getTestUser(): TestUser {
  const userJson = process.env.__INTEGRATION_TEST_USER__;
  if (!userJson) {
    throw new Error('Test user not available. Did globalSetup run successfully?');
  }
  return JSON.parse(userJson);
}

export function getApiBaseUrl(): string {
  return process.env.__INTEGRATION_TEST_API_BASE_URL__ || process.env.API_BASE_URL || 'https://oncallshift.com/api';
}

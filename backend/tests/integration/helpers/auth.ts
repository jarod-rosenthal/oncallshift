/**
 * Authentication Helpers for Integration Tests
 *
 * Helper functions for authentication and common test data operations.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { registerTestData } from '../teardown';

// Get environment configuration
function getApiBaseUrl(): string {
  return process.env.__INTEGRATION_TEST_API_BASE_URL__ || process.env.API_BASE_URL || 'https://oncallshift.com/api';
}

function getAuthToken(): string {
  const token = process.env.__INTEGRATION_TEST_AUTH_TOKEN__;
  if (!token) {
    throw new Error('Auth token not available. Did globalSetup run successfully?');
  }
  return token;
}

interface TestUser {
  email: string;
  id?: string;
  orgId?: string;
}

export function getTestUser(): TestUser {
  const userJson = process.env.__INTEGRATION_TEST_USER__;
  if (!userJson) {
    throw new Error('Test user not available. Did globalSetup run successfully?');
  }
  return JSON.parse(userJson);
}

export interface LoginResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Login with email and password
 * Returns auth tokens on success
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await axios.post(`${getApiBaseUrl()}/v1/auth/login`, {
    email,
    password,
  });

  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }

  return response.data.tokens;
}

/**
 * Get authorization headers for authenticated requests
 */
export function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAuthToken()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get the current auth token
 */
export function getCurrentAuthToken(): string {
  return getAuthToken();
}

export interface TestIncident {
  id: string;
  title: string;
  status: string;
  urgency: string;
  serviceId: string;
}

export interface CreateTestIncidentOptions {
  title?: string;
  description?: string;
  urgency?: 'high' | 'low';
  serviceId?: string;
}

/**
 * Create a test incident for integration tests
 * Automatically registers the incident for cleanup in teardown
 */
export async function createTestIncident(options: CreateTestIncidentOptions = {}): Promise<TestIncident> {
  const apiBaseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();

  // Generate unique title if not provided
  const title = options.title || `Integration Test Incident ${uuidv4().substring(0, 8)}`;

  // First, we need a service to create an incident
  // Get existing services or use provided serviceId
  let serviceId = options.serviceId;

  if (!serviceId) {
    // Get first available service
    const servicesResponse = await axios.get(`${apiBaseUrl}/v1/services`, { headers });
    const services = servicesResponse.data.services || servicesResponse.data;

    if (!services || services.length === 0) {
      throw new Error('No services available. Create a service first before creating test incidents.');
    }

    serviceId = services[0].id;
  }

  // Create the incident via webhook (the standard way to create incidents)
  const incidentData = {
    title,
    description: options.description || 'Test incident created by integration tests',
    urgency: options.urgency || 'low',
  };

  // First get the service to find its API key
  const serviceResponse = await axios.get(`${apiBaseUrl}/v1/services/${serviceId}`, { headers });
  const service = serviceResponse.data;

  // Create incident via the authenticated API
  const response = await axios.post(
    `${apiBaseUrl}/v1/incidents`,
    {
      ...incidentData,
      serviceId,
    },
    { headers }
  );

  const incident = response.data;

  // Register for cleanup
  registerTestData({
    type: 'incident',
    id: incident.id,
    name: incident.title,
  });

  return {
    id: incident.id,
    title: incident.title,
    status: incident.status,
    urgency: incident.urgency,
    serviceId: incident.serviceId,
  };
}

/**
 * Cleanup a specific test incident
 * Usually called automatically by teardown, but can be called manually
 */
export async function cleanupTestIncident(incidentId: string): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();

  try {
    // First resolve the incident if it's not already resolved
    await axios.post(
      `${apiBaseUrl}/v1/incidents/${incidentId}/resolve`,
      {},
      { headers }
    );
  } catch (error) {
    // Ignore errors - incident may already be resolved
  }

  try {
    // Then delete it
    await axios.delete(`${apiBaseUrl}/v1/incidents/${incidentId}`, { headers });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status !== 404) {
      console.warn(`Failed to cleanup incident ${incidentId}:`, error.message);
    }
  }
}

export interface TestService {
  id: string;
  name: string;
  apiKey: string;
}

/**
 * Create a test service for integration tests
 * Automatically registers the service for cleanup in teardown
 */
export async function createTestService(name?: string): Promise<TestService> {
  const apiBaseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();

  const serviceName = name || `Test Service ${uuidv4().substring(0, 8)}`;

  const response = await axios.post(
    `${apiBaseUrl}/v1/services`,
    {
      name: serviceName,
      description: 'Test service created by integration tests',
    },
    { headers }
  );

  const service = response.data;

  // Register for cleanup
  registerTestData({
    type: 'service',
    id: service.id,
    name: service.name,
  });

  return {
    id: service.id,
    name: service.name,
    apiKey: service.apiKey,
  };
}

/**
 * Cleanup a specific test service
 */
export async function cleanupTestService(serviceId: string): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();

  try {
    await axios.delete(`${apiBaseUrl}/v1/services/${serviceId}`, { headers });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status !== 404) {
      console.warn(`Failed to cleanup service ${serviceId}:`, error.message);
    }
  }
}

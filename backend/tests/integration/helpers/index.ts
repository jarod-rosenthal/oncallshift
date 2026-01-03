/**
 * Integration Test Helpers
 *
 * Re-exports all helper functions for convenient imports in tests.
 *
 * Usage:
 *   import { get, post, createTestIncident, getAuthHeaders } from '../helpers';
 */

// API Client - HTTP request methods
export {
  get,
  post,
  put,
  patch,
  del,
  resetClient,
  isApiError,
  getApiErrorDetails,
  ApiResponse,
  ApiError,
} from './api-client';

// Also export api client as default object
export { default as api } from './api-client';

// Authentication helpers
export {
  login,
  getAuthHeaders,
  getCurrentAuthToken,
  getTestUser,
  // Test data helpers
  createTestIncident,
  cleanupTestIncident,
  createTestService,
  cleanupTestService,
  // Types
  LoginResponse,
  TestIncident,
  CreateTestIncidentOptions,
  TestService,
} from './auth';

// Re-export from setup
export { getAuthToken, getApiBaseUrl } from '../setup';

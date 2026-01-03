/**
 * Integration Tests: Incidents - List
 *
 * Tests for the GET /api/v1/incidents endpoint.
 * Validates listing incidents with various filters and pagination.
 */

import { get, getAuthHeaders, isApiError } from '../helpers';
import axios from 'axios';

describe('Incidents - List', () => {
  let authHeaders: Record<string, string>;

  beforeAll(() => {
    authHeaders = getAuthHeaders();
  });

  describe('GET /v1/incidents', () => {
    it('should list incidents', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('incidents');
      expect(Array.isArray(response.data.incidents)).toBe(true);
      expect(response.data).toHaveProperty('pagination');
      expect(response.data.pagination).toHaveProperty('total');
      expect(response.data.pagination).toHaveProperty('limit');
      expect(response.data.pagination).toHaveProperty('offset');
    });

    it('should filter incidents by state=triggered', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { state: 'triggered' },
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.incidents)).toBe(true);

      // All returned incidents should have state 'triggered'
      for (const incident of response.data.incidents) {
        expect(incident.state).toBe('triggered');
      }
    });

    it('should filter incidents by state=acknowledged', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { state: 'acknowledged' },
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.incidents)).toBe(true);

      // All returned incidents should have state 'acknowledged'
      for (const incident of response.data.incidents) {
        expect(incident.state).toBe('acknowledged');
      }
    });

    it('should filter incidents by state=resolved', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { state: 'resolved' },
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.incidents)).toBe(true);

      // All returned incidents should have state 'resolved'
      for (const incident of response.data.incidents) {
        expect(incident.state).toBe('resolved');
      }
    });

    it('should limit results with limit parameter', async () => {
      const limit = 5;
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { limit },
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.incidents)).toBe(true);
      expect(response.data.incidents.length).toBeLessThanOrEqual(limit);
      expect(response.data.pagination.limit).toBe(limit);
    });

    it('should support pagination with offset', async () => {
      const limit = 3;
      const offset = 0;

      // Get first page
      const firstPage = await get('/v1/incidents', {
        headers: authHeaders,
        params: { limit, offset },
      });

      expect(firstPage.status).toBe(200);
      expect(firstPage.data.pagination.offset).toBe(offset);

      // Get second page if there are more results
      if (firstPage.data.pagination.total > limit) {
        const secondPage = await get('/v1/incidents', {
          headers: authHeaders,
          params: { limit, offset: limit },
        });

        expect(secondPage.status).toBe(200);
        expect(secondPage.data.pagination.offset).toBe(limit);

        // First page and second page should have different incidents (if enough exist)
        if (firstPage.data.incidents.length > 0 && secondPage.data.incidents.length > 0) {
          expect(firstPage.data.incidents[0].id).not.toBe(secondPage.data.incidents[0].id);
        }
      }
    });

    it('should return incidents with expected fields', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { limit: 1 },
      });

      expect(response.status).toBe(200);

      if (response.data.incidents.length > 0) {
        const incident = response.data.incidents[0];

        // Check required fields are present
        expect(incident).toHaveProperty('id');
        expect(incident).toHaveProperty('incidentNumber');
        expect(incident).toHaveProperty('summary');
        expect(incident).toHaveProperty('severity');
        expect(incident).toHaveProperty('state');
        expect(incident).toHaveProperty('service');
        expect(incident).toHaveProperty('triggeredAt');
        expect(incident).toHaveProperty('currentEscalationStep');

        // Check service sub-object
        expect(incident.service).toHaveProperty('id');
        expect(incident.service).toHaveProperty('name');

        // State should be one of the valid states
        expect(['triggered', 'acknowledged', 'resolved']).toContain(incident.state);
      }
    });

    it('should return 400 for invalid state filter', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { state: 'invalid_state' },
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('errors');
    });

    it('should return 400 for invalid limit value', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { limit: -1 },
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('errors');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const response = await get('/v1/incidents', {
        headers: authHeaders,
        params: { limit: 101 },
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('errors');
    });
  });

  describe('Authentication', () => {
    it('should require authentication (401 without token)', async () => {
      // Use axios directly without auth headers
      const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';
      const response = await axios.get(`${apiBaseUrl}/v1/incidents`, {
        validateStatus: () => true, // Don't throw on error status
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid tokens (401 with bad token)', async () => {
      const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';
      const response = await axios.get(`${apiBaseUrl}/v1/incidents`, {
        headers: {
          Authorization: 'Bearer invalid-token-here',
        },
        validateStatus: () => true,
      });

      expect(response.status).toBe(401);
    });
  });
});

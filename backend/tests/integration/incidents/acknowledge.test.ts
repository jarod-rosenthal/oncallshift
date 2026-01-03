/**
 * Integration Tests: Incidents - Acknowledge
 *
 * Tests for the PUT /api/v1/incidents/:id/acknowledge endpoint.
 * Validates acknowledging incidents in various states.
 */

import { get, put, getAuthHeaders } from '../helpers';
import axios from 'axios';

describe('Incidents - Acknowledge', () => {
  let authHeaders: Record<string, string>;

  beforeAll(() => {
    authHeaders = getAuthHeaders();
  });

  /**
   * Helper to find a triggered incident or skip test if none available
   */
  async function findTriggeredIncident(): Promise<{ id: string; incidentNumber: number } | null> {
    const response = await get('/v1/incidents', {
      headers: authHeaders,
      params: { state: 'triggered', limit: 1 },
    });

    if (response.status !== 200 || response.data.incidents.length === 0) {
      return null;
    }

    return {
      id: response.data.incidents[0].id,
      incidentNumber: response.data.incidents[0].incidentNumber,
    };
  }

  /**
   * Helper to find or create a resolved incident for negative testing
   */
  async function findResolvedIncident(): Promise<{ id: string; incidentNumber: number } | null> {
    const response = await get('/v1/incidents', {
      headers: authHeaders,
      params: { state: 'resolved', limit: 1 },
    });

    if (response.status !== 200 || response.data.incidents.length === 0) {
      return null;
    }

    return {
      id: response.data.incidents[0].id,
      incidentNumber: response.data.incidents[0].incidentNumber,
    };
  }

  /**
   * Helper to revert an acknowledged incident back to triggered (for cleanup)
   */
  async function unacknowledgeIncident(incidentId: string): Promise<void> {
    try {
      await put(`/v1/incidents/${incidentId}/unacknowledge`, {}, {
        headers: authHeaders,
      });
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  describe('PUT /v1/incidents/:id/acknowledge', () => {
    it('should acknowledge a triggered incident', async () => {
      const incident = await findTriggeredIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const response = await put(`/v1/incidents/${incident.id}/acknowledge`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('incident');
      expect(response.data.incident.state).toBe('acknowledged');
      expect(response.data.incident.acknowledgedAt).toBeTruthy();
      expect(response.data.incident.acknowledgedBy).toBeTruthy();
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('acknowledged');

      // Cleanup: unacknowledge the incident so test is repeatable
      await unacknowledgeIncident(incident.id);
    });

    it('should return incident details after acknowledging', async () => {
      const incident = await findTriggeredIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const response = await put(`/v1/incidents/${incident.id}/acknowledge`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(200);

      // Verify the incident object has all expected fields
      const returnedIncident = response.data.incident;
      expect(returnedIncident).toHaveProperty('id');
      expect(returnedIncident).toHaveProperty('incidentNumber');
      expect(returnedIncident).toHaveProperty('summary');
      expect(returnedIncident).toHaveProperty('severity');
      expect(returnedIncident).toHaveProperty('state');
      expect(returnedIncident).toHaveProperty('service');
      expect(returnedIncident).toHaveProperty('triggeredAt');
      expect(returnedIncident).toHaveProperty('acknowledgedAt');
      expect(returnedIncident).toHaveProperty('acknowledgedBy');

      // Verify acknowledgedBy contains user info
      expect(returnedIncident.acknowledgedBy).toHaveProperty('id');
      expect(returnedIncident.acknowledgedBy).toHaveProperty('email');

      // Cleanup
      await unacknowledgeIncident(incident.id);
    });

    it('should return 400 when acknowledging an already resolved incident', async () => {
      const incident = await findResolvedIncident();

      if (!incident) {
        console.log('SKIPPED: No resolved incidents available for testing');
        return;
      }

      const response = await put(`/v1/incidents/${incident.id}/acknowledge`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error.toLowerCase()).toContain('cannot');
    });

    it('should return 404 for non-existent incident', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await put(`/v1/incidents/${fakeId}/acknowledge`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 400 for invalid incident ID format', async () => {
      const response = await put('/v1/incidents/invalid-uuid/acknowledge', {}, {
        headers: authHeaders,
      });

      // Could be 400 or 404 depending on validation
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Idempotency', () => {
    it('should handle acknowledging an already acknowledged incident', async () => {
      const incident = await findTriggeredIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      // First acknowledge
      const firstResponse = await put(`/v1/incidents/${incident.id}/acknowledge`, {}, {
        headers: authHeaders,
      });

      expect(firstResponse.status).toBe(200);

      // Second acknowledge attempt - should fail since it's already acknowledged
      const secondResponse = await put(`/v1/incidents/${incident.id}/acknowledge`, {}, {
        headers: authHeaders,
      });

      // The API returns 400 for already acknowledged incidents
      expect(secondResponse.status).toBe(400);

      // Cleanup
      await unacknowledgeIncident(incident.id);
    });
  });

  describe('Authentication', () => {
    it('should require authentication (401 without token)', async () => {
      const incident = await findTriggeredIncident();
      const incidentId = incident?.id || '00000000-0000-0000-0000-000000000000';

      const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';
      const response = await axios.put(
        `${apiBaseUrl}/v1/incidents/${incidentId}/acknowledge`,
        {},
        {
          validateStatus: () => true,
        }
      );

      expect(response.status).toBe(401);
    });

    it('should reject invalid tokens (401 with bad token)', async () => {
      const incident = await findTriggeredIncident();
      const incidentId = incident?.id || '00000000-0000-0000-0000-000000000000';

      const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';
      const response = await axios.put(
        `${apiBaseUrl}/v1/incidents/${incidentId}/acknowledge`,
        {},
        {
          headers: {
            Authorization: 'Bearer invalid-token-here',
          },
          validateStatus: () => true,
        }
      );

      expect(response.status).toBe(401);
    });
  });
});

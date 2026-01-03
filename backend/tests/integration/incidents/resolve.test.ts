/**
 * Integration Tests: Incidents - Resolve
 *
 * Tests for the PUT /api/v1/incidents/:id/resolve endpoint.
 * Validates resolving incidents from various states.
 */

import { get, put, getAuthHeaders } from '../helpers';
import axios from 'axios';

describe('Incidents - Resolve', () => {
  let authHeaders: Record<string, string>;

  beforeAll(() => {
    authHeaders = getAuthHeaders();
  });

  /**
   * Helper to find a triggered incident
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
   * Helper to find an acknowledged incident
   */
  async function findAcknowledgedIncident(): Promise<{ id: string; incidentNumber: number } | null> {
    const response = await get('/v1/incidents', {
      headers: authHeaders,
      params: { state: 'acknowledged', limit: 1 },
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
   * Helper to find a resolved incident
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
   * Helper to revert a resolved incident back to triggered (for cleanup)
   */
  async function unresolveIncident(incidentId: string): Promise<void> {
    try {
      await put(`/v1/incidents/${incidentId}/unresolve`, {}, {
        headers: authHeaders,
      });
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  describe('PUT /v1/incidents/:id/resolve', () => {
    it('should resolve a triggered incident', async () => {
      const incident = await findTriggeredIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const response = await put(`/v1/incidents/${incident.id}/resolve`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('incident');
      expect(response.data.incident.state).toBe('resolved');
      expect(response.data.incident.resolvedAt).toBeTruthy();
      expect(response.data.incident.resolvedBy).toBeTruthy();
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('resolved');

      // Cleanup: unresolve the incident so test is repeatable
      await unresolveIncident(incident.id);
    });

    it('should resolve an acknowledged incident', async () => {
      const incident = await findAcknowledgedIncident();

      if (!incident) {
        console.log('SKIPPED: No acknowledged incidents available for testing');
        return;
      }

      const response = await put(`/v1/incidents/${incident.id}/resolve`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('incident');
      expect(response.data.incident.state).toBe('resolved');
      expect(response.data.incident.resolvedAt).toBeTruthy();

      // Cleanup
      await unresolveIncident(incident.id);
    });

    it('should accept a resolution note', async () => {
      const incident = await findTriggeredIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const resolutionNote = 'Fixed by restarting the service';

      const response = await put(
        `/v1/incidents/${incident.id}/resolve`,
        { note: resolutionNote },
        { headers: authHeaders }
      );

      expect(response.status).toBe(200);
      expect(response.data.incident.state).toBe('resolved');

      // Cleanup
      await unresolveIncident(incident.id);
    });

    it('should return incident details after resolving', async () => {
      const incident = await findTriggeredIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const response = await put(`/v1/incidents/${incident.id}/resolve`, {}, {
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
      expect(returnedIncident).toHaveProperty('resolvedAt');
      expect(returnedIncident).toHaveProperty('resolvedBy');

      // Verify resolvedBy contains user info
      expect(returnedIncident.resolvedBy).toHaveProperty('id');
      expect(returnedIncident.resolvedBy).toHaveProperty('email');

      // Cleanup
      await unresolveIncident(incident.id);
    });

    it('should return 400 when resolving an already resolved incident', async () => {
      const incident = await findResolvedIncident();

      if (!incident) {
        console.log('SKIPPED: No resolved incidents available for testing');
        return;
      }

      const response = await put(`/v1/incidents/${incident.id}/resolve`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error.toLowerCase()).toContain('already resolved');
    });

    it('should return 404 for non-existent incident', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await put(`/v1/incidents/${fakeId}/resolve`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 400 for invalid incident ID format', async () => {
      const response = await put('/v1/incidents/invalid-uuid/resolve', {}, {
        headers: authHeaders,
      });

      // Could be 400 or 404 depending on validation
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('State transitions', () => {
    it('should be able to resolve directly from triggered state', async () => {
      const incident = await findTriggeredIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      // Verify incident is triggered
      const beforeResponse = await get(`/v1/incidents/${incident.id}`, {
        headers: authHeaders,
      });
      expect(beforeResponse.data.incident.state).toBe('triggered');

      // Resolve directly
      const resolveResponse = await put(`/v1/incidents/${incident.id}/resolve`, {}, {
        headers: authHeaders,
      });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.data.incident.state).toBe('resolved');

      // Cleanup
      await unresolveIncident(incident.id);
    });

    it('should be able to resolve from acknowledged state', async () => {
      const incident = await findAcknowledgedIncident();

      if (!incident) {
        console.log('SKIPPED: No acknowledged incidents available for testing');
        return;
      }

      // Verify incident is acknowledged
      const beforeResponse = await get(`/v1/incidents/${incident.id}`, {
        headers: authHeaders,
      });
      expect(beforeResponse.data.incident.state).toBe('acknowledged');

      // Resolve from acknowledged
      const resolveResponse = await put(`/v1/incidents/${incident.id}/resolve`, {}, {
        headers: authHeaders,
      });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.data.incident.state).toBe('resolved');

      // Cleanup
      await unresolveIncident(incident.id);
    });
  });

  describe('Authentication', () => {
    it('should require authentication (401 without token)', async () => {
      const incident = await findTriggeredIncident();
      const incidentId = incident?.id || '00000000-0000-0000-0000-000000000000';

      const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';
      const response = await axios.put(
        `${apiBaseUrl}/v1/incidents/${incidentId}/resolve`,
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
        `${apiBaseUrl}/v1/incidents/${incidentId}/resolve`,
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

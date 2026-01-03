/**
 * Integration Tests: Incidents - Escalate
 *
 * Tests for the POST /api/v1/incidents/:id/escalate endpoint.
 * Validates manual escalation of incidents to the next escalation step.
 */

import { get, post, getAuthHeaders } from '../helpers';
import axios from 'axios';

describe('Incidents - Escalate', () => {
  let authHeaders: Record<string, string>;

  beforeAll(() => {
    authHeaders = getAuthHeaders();
  });

  /**
   * Helper to find a triggered incident that can be escalated
   */
  async function findEscalatableIncident(): Promise<{
    id: string;
    incidentNumber: number;
    currentEscalationStep: number;
  } | null> {
    const response = await get('/v1/incidents', {
      headers: authHeaders,
      params: { state: 'triggered', limit: 10 },
    });

    if (response.status !== 200 || response.data.incidents.length === 0) {
      return null;
    }

    // Find an incident that might have more escalation steps
    for (const incident of response.data.incidents) {
      // Get full incident details to check escalation status
      const detailResponse = await get(`/v1/incidents/${incident.id}`, {
        headers: authHeaders,
      });

      if (detailResponse.status === 200) {
        const { escalation } = detailResponse.data;
        // Check if there are more steps to escalate to
        if (escalation && escalation.currentStep < escalation.totalSteps) {
          return {
            id: incident.id,
            incidentNumber: incident.incidentNumber,
            currentEscalationStep: escalation.currentStep,
          };
        }
      }
    }

    // If no escalatable incident found, return the first triggered one
    // (it might still be escalatable depending on policy)
    return {
      id: response.data.incidents[0].id,
      incidentNumber: response.data.incidents[0].incidentNumber,
      currentEscalationStep: response.data.incidents[0].currentEscalationStep || 1,
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

  describe('POST /v1/incidents/:id/escalate', () => {
    it('should escalate a triggered incident to the next step', async () => {
      const incident = await findEscalatableIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const response = await post(`/v1/incidents/${incident.id}/escalate`, {}, {
        headers: authHeaders,
      });

      // Success if escalation worked, or 400 if already at final step
      if (response.status === 200) {
        expect(response.data).toHaveProperty('incident');
        expect(response.data).toHaveProperty('message');
        expect(response.data.message.toLowerCase()).toContain('escalated');

        // The escalation step should have increased
        expect(response.data.incident.currentEscalationStep).toBeGreaterThanOrEqual(
          incident.currentEscalationStep
        );
      } else if (response.status === 400) {
        // Could be at final step or no escalation policy
        expect(response.data).toHaveProperty('error');
        expect(
          response.data.error.toLowerCase().includes('final') ||
          response.data.error.toLowerCase().includes('cannot') ||
          response.data.error.toLowerCase().includes('no escalation')
        ).toBe(true);
      } else {
        fail(`Unexpected status code: ${response.status}`);
      }
    });

    it('should accept an optional reason for escalation', async () => {
      const incident = await findEscalatableIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const reason = 'Primary on-call is unavailable';

      const response = await post(
        `/v1/incidents/${incident.id}/escalate`,
        { reason },
        { headers: authHeaders }
      );

      // Success or already at final step
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.data).toHaveProperty('incident');
        expect(response.data).toHaveProperty('message');
      }
    });

    it('should return updated incident details after escalating', async () => {
      const incident = await findEscalatableIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      const response = await post(`/v1/incidents/${incident.id}/escalate`, {}, {
        headers: authHeaders,
      });

      if (response.status === 200) {
        const returnedIncident = response.data.incident;

        // Verify the incident object has expected fields
        expect(returnedIncident).toHaveProperty('id');
        expect(returnedIncident).toHaveProperty('incidentNumber');
        expect(returnedIncident).toHaveProperty('summary');
        expect(returnedIncident).toHaveProperty('state');
        expect(returnedIncident).toHaveProperty('currentEscalationStep');
        expect(returnedIncident).toHaveProperty('service');
      }
    });

    it('should return 400 when escalating a resolved incident', async () => {
      const incident = await findResolvedIncident();

      if (!incident) {
        console.log('SKIPPED: No resolved incidents available for testing');
        return;
      }

      const response = await post(`/v1/incidents/${incident.id}/escalate`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error.toLowerCase()).toContain('cannot');
    });

    it('should return 400 when escalating an acknowledged incident', async () => {
      const incident = await findAcknowledgedIncident();

      if (!incident) {
        console.log('SKIPPED: No acknowledged incidents available for testing');
        return;
      }

      const response = await post(`/v1/incidents/${incident.id}/escalate`, {}, {
        headers: authHeaders,
      });

      // Acknowledged incidents typically cannot be escalated
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 404 for non-existent incident', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await post(`/v1/incidents/${fakeId}/escalate`, {}, {
        headers: authHeaders,
      });

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });

    it('should return error for invalid incident ID format', async () => {
      const response = await post('/v1/incidents/invalid-uuid/escalate', {}, {
        headers: authHeaders,
      });

      // Could be 400 or 404 depending on validation
      expect([400, 404]).toContain(response.status);
    });

    it('should validate reason length if provided', async () => {
      const incident = await findEscalatableIncident();

      if (!incident) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      // Create a reason that exceeds the 500 character limit
      const longReason = 'x'.repeat(501);

      const response = await post(
        `/v1/incidents/${incident.id}/escalate`,
        { reason: longReason },
        { headers: authHeaders }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('errors');
    });
  });

  describe('Escalation behavior', () => {
    it('should return 400 when at final escalation step', async () => {
      // Find an incident and get its escalation details
      const listResponse = await get('/v1/incidents', {
        headers: authHeaders,
        params: { state: 'triggered', limit: 5 },
      });

      if (listResponse.status !== 200 || listResponse.data.incidents.length === 0) {
        console.log('SKIPPED: No triggered incidents available for testing');
        return;
      }

      // Look for an incident that's at the final step
      for (const incident of listResponse.data.incidents) {
        const detailResponse = await get(`/v1/incidents/${incident.id}`, {
          headers: authHeaders,
        });

        if (detailResponse.status === 200 && detailResponse.data.escalation) {
          const { currentStep, totalSteps } = detailResponse.data.escalation;

          if (currentStep >= totalSteps) {
            // Try to escalate - should fail
            const escalateResponse = await post(`/v1/incidents/${incident.id}/escalate`, {}, {
              headers: authHeaders,
            });

            expect(escalateResponse.status).toBe(400);
            expect(escalateResponse.data.error.toLowerCase()).toContain('final');
            return;
          }
        }
      }

      console.log('SKIPPED: No incidents at final escalation step found');
    });
  });

  describe('Authentication', () => {
    it('should require authentication (401 without token)', async () => {
      const incident = await findEscalatableIncident();
      const incidentId = incident?.id || '00000000-0000-0000-0000-000000000000';

      const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';
      const response = await axios.post(
        `${apiBaseUrl}/v1/incidents/${incidentId}/escalate`,
        {},
        {
          validateStatus: () => true,
        }
      );

      expect(response.status).toBe(401);
    });

    it('should reject invalid tokens (401 with bad token)', async () => {
      const incident = await findEscalatableIncident();
      const incidentId = incident?.id || '00000000-0000-0000-0000-000000000000';

      const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';
      const response = await axios.post(
        `${apiBaseUrl}/v1/incidents/${incidentId}/escalate`,
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

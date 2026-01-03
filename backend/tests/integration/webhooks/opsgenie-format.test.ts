/**
 * Integration Tests: Opsgenie-Format Webhook Ingestion
 *
 * Tests the webhook endpoint's ability to accept Opsgenie-style event payloads
 * and create incidents accordingly.
 *
 * These tests run against the production API at https://oncallshift.com/api
 *
 * Required environment variables:
 * - TEST_USER_EMAIL: Email for authenticated API access
 * - TEST_USER_PASSWORD: Password for authenticated API access
 */

import axios, { AxiosInstance } from 'axios';
import { createTestService, cleanupTestService, TestService } from '../helpers';
import { getApiBaseUrl } from '../setup';

describe('Webhooks - Opsgenie Format', () => {
  let testService: TestService;
  let webhookClient: AxiosInstance;

  // Get API base URL
  const apiBaseUrl = getApiBaseUrl();

  beforeAll(async () => {
    // Create a test service to get an API key for webhook calls
    testService = await createTestService('Opsgenie Webhook Test Service');

    // Create a client configured with the service API key
    webhookClient = axios.create({
      baseURL: apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': testService.apiKey,
      },
      validateStatus: () => true, // Don't throw on non-2xx
    });
  });

  afterAll(async () => {
    // Cleanup test service
    if (testService?.id) {
      await cleanupTestService(testService.id);
    }
  });

  /**
   * Helper to generate a unique alert ID
   */
  function generateAlertId(): string {
    return `og-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Helper to create an Opsgenie-style alert payload
   */
  function createOpsgenieAlertPayload(
    action: 'Create' | 'Acknowledge' | 'Close' | 'AddNote' | 'Escalate',
    overrides: Record<string, any> = {}
  ): Record<string, any> {
    const alertId = overrides.alertId || generateAlertId();

    return {
      action,
      alert: {
        alertId,
        message: overrides.message || 'E2E Test Alert - Opsgenie Format',
        priority: overrides.priority || 'P1',
        source: overrides.source || 'e2e-tests',
        ...overrides.alert,
      },
      // Transform to OnCallShift format
      summary: overrides.summary || overrides.message || 'E2E Test Alert - Opsgenie Format',
      severity: overrides.severity || mapPriorityToSeverity(overrides.priority || 'P1'),
      dedup_key: overrides.dedup_key || alertId,
      details: {
        source: 'opsgenie',
        action,
        alertId,
        ...overrides.details,
      },
    };
  }

  /**
   * Map Opsgenie priority to OnCallShift severity
   */
  function mapPriorityToSeverity(priority: string): 'critical' | 'error' | 'warning' | 'info' {
    const mapping: Record<string, 'critical' | 'error' | 'warning' | 'info'> = {
      P1: 'critical',
      P2: 'error',
      P3: 'warning',
      P4: 'info',
      P5: 'info',
    };
    return mapping[priority] || 'warning';
  }

  describe('Basic Alert Actions', () => {
    it('should accept Opsgenie Create action', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `OG Create Test ${Date.now()}`,
        priority: 'P1',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data.message).toContain('received');
      expect(response.data.service).toBeDefined();
      expect(response.data.service.id).toBe(testService.id);
    });

    it('should accept Opsgenie Acknowledge action', async () => {
      const alertId = generateAlertId();

      // First create an alert
      const createPayload = createOpsgenieAlertPayload('Create', {
        alertId,
        message: `OG Ack Test ${Date.now()}`,
        priority: 'P2',
      });

      const createResponse = await webhookClient.post('/v1/alerts/webhook', createPayload);
      expect(createResponse.status).toBe(202);

      // Then acknowledge it
      const ackPayload = createOpsgenieAlertPayload('Acknowledge', {
        alertId,
        message: `Acknowledged: OG Ack Test`,
        severity: 'warning',
      });

      const ackResponse = await webhookClient.post('/v1/alerts/webhook', ackPayload);

      expect(ackResponse.status).toBe(202);
      expect(ackResponse.data.message).toContain('received');
    });

    it('should accept Opsgenie Close action', async () => {
      const alertId = generateAlertId();

      // First create an alert
      const createPayload = createOpsgenieAlertPayload('Create', {
        alertId,
        message: `OG Close Test ${Date.now()}`,
        priority: 'P3',
      });

      await webhookClient.post('/v1/alerts/webhook', createPayload);

      // Then close it
      const closePayload = createOpsgenieAlertPayload('Close', {
        alertId,
        message: `Closed: OG Close Test`,
        severity: 'info',
      });

      const closeResponse = await webhookClient.post('/v1/alerts/webhook', closePayload);

      expect(closeResponse.status).toBe(202);
      expect(closeResponse.data.message).toContain('received');
    });

    it('should accept Opsgenie AddNote action', async () => {
      const alertId = generateAlertId();

      // First create an alert
      const createPayload = createOpsgenieAlertPayload('Create', {
        alertId,
        message: `OG AddNote Test ${Date.now()}`,
        priority: 'P2',
      });

      await webhookClient.post('/v1/alerts/webhook', createPayload);

      // Then add a note
      const notePayload = createOpsgenieAlertPayload('AddNote', {
        alertId,
        message: `Note added: Investigation started`,
        severity: 'info',
        details: {
          note: 'Investigating the root cause',
        },
      });

      const noteResponse = await webhookClient.post('/v1/alerts/webhook', notePayload);

      expect(noteResponse.status).toBe(202);
    });

    it('should accept Opsgenie Escalate action', async () => {
      const alertId = generateAlertId();

      // First create an alert
      const createPayload = createOpsgenieAlertPayload('Create', {
        alertId,
        message: `OG Escalate Test ${Date.now()}`,
        priority: 'P1',
      });

      await webhookClient.post('/v1/alerts/webhook', createPayload);

      // Then escalate
      const escalatePayload = createOpsgenieAlertPayload('Escalate', {
        alertId,
        message: `Escalated: OG Escalate Test`,
        severity: 'critical',
      });

      const escalateResponse = await webhookClient.post('/v1/alerts/webhook', escalatePayload);

      expect(escalateResponse.status).toBe(202);
    });
  });

  describe('Priority Mapping', () => {
    it('should accept P1 priority as critical severity', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `P1 Priority Test ${Date.now()}`,
        priority: 'P1',
        severity: 'critical',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept P2 priority as error severity', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `P2 Priority Test ${Date.now()}`,
        priority: 'P2',
        severity: 'error',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept P3 priority as warning severity', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `P3 Priority Test ${Date.now()}`,
        priority: 'P3',
        severity: 'warning',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept P4/P5 priority as info severity', async () => {
      const payloadP4 = createOpsgenieAlertPayload('Create', {
        message: `P4 Priority Test ${Date.now()}`,
        priority: 'P4',
        severity: 'info',
      });

      const payloadP5 = createOpsgenieAlertPayload('Create', {
        message: `P5 Priority Test ${Date.now()}`,
        priority: 'P5',
        severity: 'info',
      });

      const responseP4 = await webhookClient.post('/v1/alerts/webhook', payloadP4);
      const responseP5 = await webhookClient.post('/v1/alerts/webhook', payloadP5);

      expect(responseP4.status).toBe(202);
      expect(responseP5.status).toBe(202);
    });
  });

  describe('Alert Details', () => {
    it('should accept alert with tags', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Tags Test ${Date.now()}`,
        priority: 'P2',
        alert: {
          tags: ['production', 'database', 'urgent'],
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept alert with entity', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Entity Test ${Date.now()}`,
        priority: 'P2',
        alert: {
          entity: 'prod-db-cluster-01',
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept alert with alias (dedup key)', async () => {
      const alias = `custom-alias-${Date.now()}`;
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Alias Test ${Date.now()}`,
        priority: 'P3',
        dedup_key: alias,
        alert: {
          alias,
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept alert with description', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Description Test ${Date.now()}`,
        priority: 'P2',
        alert: {
          description: 'This is a detailed description of the alert that includes additional context about the issue.',
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept alert with custom details', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Custom Details Test ${Date.now()}`,
        priority: 'P2',
        details: {
          source: 'opsgenie',
          action: 'Create',
          serverName: 'prod-server-01',
          region: 'us-east-1',
          cpuUsage: 95,
          memoryUsage: 88,
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept alert with responders', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Responders Test ${Date.now()}`,
        priority: 'P1',
        alert: {
          responders: [
            { type: 'team', id: 'team-123' },
            { type: 'user', id: 'user-456' },
          ],
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept alert with actions', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Actions Test ${Date.now()}`,
        priority: 'P2',
        alert: {
          actions: ['Restart Service', 'Check Logs', 'Scale Up'],
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });
  });

  describe('Deduplication', () => {
    it('should handle duplicate alerts with same alias', async () => {
      const alias = generateAlertId();

      // Send first alert
      const payload1 = createOpsgenieAlertPayload('Create', {
        message: `Dedup Test 1 ${Date.now()}`,
        priority: 'P2',
        dedup_key: alias,
        alert: { alias },
      });

      const response1 = await webhookClient.post('/v1/alerts/webhook', payload1);
      expect(response1.status).toBe(202);

      // Send duplicate with same alias
      const payload2 = createOpsgenieAlertPayload('Create', {
        message: `Dedup Test 2 ${Date.now()}`,
        priority: 'P2',
        dedup_key: alias,
        alert: { alias },
      });

      const response2 = await webhookClient.post('/v1/alerts/webhook', payload2);

      // Should still accept (dedup happens in processing)
      expect(response2.status).toBe(202);
    });

    it('should create separate alerts for different aliases', async () => {
      const alias1 = generateAlertId();
      const alias2 = generateAlertId();

      const payload1 = createOpsgenieAlertPayload('Create', {
        message: `Unique Alert 1 ${Date.now()}`,
        priority: 'P3',
        dedup_key: alias1,
        alert: { alias: alias1 },
      });

      const payload2 = createOpsgenieAlertPayload('Create', {
        message: `Unique Alert 2 ${Date.now()}`,
        priority: 'P3',
        dedup_key: alias2,
        alert: { alias: alias2 },
      });

      const response1 = await webhookClient.post('/v1/alerts/webhook', payload1);
      const response2 = await webhookClient.post('/v1/alerts/webhook', payload2);

      expect(response1.status).toBe(202);
      expect(response2.status).toBe(202);
    });
  });

  describe('Error Handling', () => {
    it('should reject request without API key', async () => {
      const unauthenticatedClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      });

      const payload = createOpsgenieAlertPayload('Create', {
        message: `No Auth Test ${Date.now()}`,
      });

      const response = await unauthenticatedClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid API key', async () => {
      const invalidKeyClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid-opsgenie-key',
        },
        validateStatus: () => true,
      });

      const payload = createOpsgenieAlertPayload('Create', {
        message: `Invalid Key Test ${Date.now()}`,
      });

      const response = await invalidKeyClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
    });

    it('should reject request missing summary/message', async () => {
      const payload = {
        action: 'Create',
        alert: {
          alertId: generateAlertId(),
          priority: 'P1',
          source: 'e2e-tests',
          // Missing message
        },
        // Missing summary
        severity: 'critical',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
    });

    it('should reject request with invalid severity', async () => {
      const payload = {
        action: 'Create',
        alert: {
          alertId: generateAlertId(),
          message: `Invalid Severity Test ${Date.now()}`,
          priority: 'P1',
        },
        summary: `Invalid Severity Test ${Date.now()}`,
        severity: 'P1', // Invalid - should be info/warning/error/critical
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
    });
  });

  describe('Response Structure', () => {
    it('should return expected response fields', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Response Test ${Date.now()}`,
        priority: 'P3',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('service');
      expect(response.data.service).toHaveProperty('id');
      expect(response.data.service).toHaveProperty('name');
    });

    it('should return correct service information', async () => {
      const payload = createOpsgenieAlertPayload('Create', {
        message: `Service Info Test ${Date.now()}`,
        priority: 'P4',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data.service.id).toBe(testService.id);
      expect(response.data.service.name).toBe(testService.name);
    });
  });
});

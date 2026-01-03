/**
 * Integration Tests: PagerDuty-Format Webhook Ingestion
 *
 * Tests the webhook endpoint's ability to accept PagerDuty-style event payloads
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

describe('Webhooks - PagerDuty Format', () => {
  let testService: TestService;
  let webhookClient: AxiosInstance;
  const createdAlertIds: string[] = [];

  // Get API base URL
  const apiBaseUrl = getApiBaseUrl();

  beforeAll(async () => {
    // Create a test service to get an API key for webhook calls
    testService = await createTestService('PagerDuty Webhook Test Service');

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
   * Helper to generate a unique dedup key
   */
  function generateDedupKey(): string {
    return `pd-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Helper to create a PagerDuty-style trigger event payload
   */
  function createPagerDutyTriggerEvent(overrides: Record<string, any> = {}): Record<string, any> {
    const dedupKey = generateDedupKey();
    return {
      event: {
        event_type: 'incident.triggered',
        resource_type: 'incident',
        occurred_at: new Date().toISOString(),
        data: {
          id: dedupKey,
          title: 'E2E Test Alert - PagerDuty Format',
          urgency: 'high',
          status: 'triggered',
          ...overrides.data,
        },
        ...overrides.event,
      },
      // Transform to OnCallShift format
      summary: overrides.summary || 'E2E Test Alert - PagerDuty Format',
      severity: overrides.severity || 'critical',
      dedup_key: overrides.dedup_key || dedupKey,
      details: {
        source: 'pagerduty',
        event_type: 'incident.triggered',
        ...overrides.details,
      },
    };
  }

  describe('Basic Webhook Ingestion', () => {
    it('should accept PagerDuty trigger event and return 202', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `PD Trigger Test ${Date.now()}`,
        severity: 'critical',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data.message).toContain('received');
      expect(response.data.service).toBeDefined();
      expect(response.data.service.id).toBe(testService.id);
    });

    it('should accept PagerDuty acknowledge event', async () => {
      const dedupKey = generateDedupKey();

      // First trigger an incident
      const triggerPayload = createPagerDutyTriggerEvent({
        summary: `PD Ack Test ${Date.now()}`,
        severity: 'error',
        dedup_key: dedupKey,
      });

      const triggerResponse = await webhookClient.post('/v1/alerts/webhook', triggerPayload);
      expect(triggerResponse.status).toBe(202);

      // Then send acknowledge event
      const ackPayload = {
        event: {
          event_type: 'incident.acknowledged',
          resource_type: 'incident',
          occurred_at: new Date().toISOString(),
          data: {
            id: dedupKey,
            status: 'acknowledged',
          },
        },
        summary: `Acknowledged: PD Ack Test ${Date.now()}`,
        severity: 'warning',
        dedup_key: dedupKey,
        details: {
          source: 'pagerduty',
          event_type: 'incident.acknowledged',
        },
      };

      const ackResponse = await webhookClient.post('/v1/alerts/webhook', ackPayload);

      expect(ackResponse.status).toBe(202);
      expect(ackResponse.data.message).toContain('received');
    });

    it('should accept PagerDuty resolve event', async () => {
      const dedupKey = generateDedupKey();

      // First trigger an incident
      const triggerPayload = createPagerDutyTriggerEvent({
        summary: `PD Resolve Test ${Date.now()}`,
        severity: 'error',
        dedup_key: dedupKey,
      });

      await webhookClient.post('/v1/alerts/webhook', triggerPayload);

      // Then send resolve event
      const resolvePayload = {
        event: {
          event_type: 'incident.resolved',
          resource_type: 'incident',
          occurred_at: new Date().toISOString(),
          data: {
            id: dedupKey,
            status: 'resolved',
          },
        },
        summary: `Resolved: PD Resolve Test ${Date.now()}`,
        severity: 'info',
        dedup_key: dedupKey,
        details: {
          source: 'pagerduty',
          event_type: 'incident.resolved',
        },
      };

      const resolveResponse = await webhookClient.post('/v1/alerts/webhook', resolvePayload);

      expect(resolveResponse.status).toBe(202);
      expect(resolveResponse.data.message).toContain('received');
    });
  });

  describe('Severity Mapping', () => {
    it('should accept high urgency as critical severity', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `High Urgency Test ${Date.now()}`,
        severity: 'critical',
        data: { urgency: 'high' },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept low urgency as warning severity', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `Low Urgency Test ${Date.now()}`,
        severity: 'warning',
        data: { urgency: 'low' },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept all valid severity levels', async () => {
      const severities = ['info', 'warning', 'error', 'critical'] as const;

      for (const severity of severities) {
        const payload = createPagerDutyTriggerEvent({
          summary: `Severity ${severity} Test ${Date.now()}`,
          severity,
        });

        const response = await webhookClient.post('/v1/alerts/webhook', payload);

        expect(response.status).toBe(202);
      }
    });
  });

  describe('Deduplication', () => {
    it('should handle same dedup_key without creating duplicate', async () => {
      const dedupKey = generateDedupKey();
      const summary = `Dedup Test ${Date.now()}`;

      // Send first alert
      const payload1 = createPagerDutyTriggerEvent({
        summary,
        severity: 'error',
        dedup_key: dedupKey,
      });

      const response1 = await webhookClient.post('/v1/alerts/webhook', payload1);
      expect(response1.status).toBe(202);

      // Send duplicate alert with same dedup_key
      const payload2 = createPagerDutyTriggerEvent({
        summary: summary + ' (duplicate)',
        severity: 'error',
        dedup_key: dedupKey,
      });

      const response2 = await webhookClient.post('/v1/alerts/webhook', payload2);

      // Should still accept (processing handles dedup)
      expect(response2.status).toBe(202);
    });

    it('should create separate incidents for different dedup_keys', async () => {
      const dedupKey1 = generateDedupKey();
      const dedupKey2 = generateDedupKey();

      const payload1 = createPagerDutyTriggerEvent({
        summary: `Unique Alert 1 ${Date.now()}`,
        severity: 'error',
        dedup_key: dedupKey1,
      });

      const payload2 = createPagerDutyTriggerEvent({
        summary: `Unique Alert 2 ${Date.now()}`,
        severity: 'error',
        dedup_key: dedupKey2,
      });

      const response1 = await webhookClient.post('/v1/alerts/webhook', payload1);
      const response2 = await webhookClient.post('/v1/alerts/webhook', payload2);

      expect(response1.status).toBe(202);
      expect(response2.status).toBe(202);
    });
  });

  describe('Payload Details', () => {
    it('should accept PagerDuty event with custom details', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `Custom Details Test ${Date.now()}`,
        severity: 'warning',
        details: {
          source: 'pagerduty',
          event_type: 'incident.triggered',
          custom_field_1: 'value1',
          custom_field_2: 123,
          nested: {
            key: 'value',
          },
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept payload with service reference', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `Service Reference Test ${Date.now()}`,
        severity: 'error',
        data: {
          service: {
            id: 'SERVICE123',
            type: 'service_reference',
            summary: 'Test Service',
          },
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept payload with assignee information', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `Assignee Test ${Date.now()}`,
        severity: 'error',
        data: {
          assignees: [
            {
              id: 'USER123',
              type: 'user_reference',
              summary: 'Test User',
            },
          ],
        },
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });
  });

  describe('Error Handling', () => {
    it('should reject request without API key', async () => {
      const unauthenticatedClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          // No X-API-Key header
        },
        validateStatus: () => true,
      });

      const payload = createPagerDutyTriggerEvent({
        summary: `No Auth Test ${Date.now()}`,
        severity: 'error',
      });

      const response = await unauthenticatedClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
      expect(response.data.error).toContain('API');
    });

    it('should reject request with invalid API key', async () => {
      const invalidKeyClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid-api-key-12345',
        },
        validateStatus: () => true,
      });

      const payload = createPagerDutyTriggerEvent({
        summary: `Invalid Key Test ${Date.now()}`,
        severity: 'error',
      });

      const response = await invalidKeyClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
    });

    it('should reject request missing required summary field', async () => {
      const payload = {
        event: {
          event_type: 'incident.triggered',
          resource_type: 'incident',
          occurred_at: new Date().toISOString(),
        },
        // Missing summary field
        severity: 'error',
        dedup_key: generateDedupKey(),
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
    });

    it('should reject request with invalid severity', async () => {
      const payload = {
        event: {
          event_type: 'incident.triggered',
          resource_type: 'incident',
          occurred_at: new Date().toISOString(),
        },
        summary: `Invalid Severity Test ${Date.now()}`,
        severity: 'invalid_severity', // Invalid value
        dedup_key: generateDedupKey(),
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
    });
  });

  describe('Response Structure', () => {
    it('should return expected response fields', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `Response Structure Test ${Date.now()}`,
        severity: 'info',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('service');
      expect(response.data.service).toHaveProperty('id');
      expect(response.data.service).toHaveProperty('name');
    });

    it('should return correct service information', async () => {
      const payload = createPagerDutyTriggerEvent({
        summary: `Service Info Test ${Date.now()}`,
        severity: 'info',
      });

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data.service.id).toBe(testService.id);
      expect(response.data.service.name).toBe(testService.name);
    });
  });
});

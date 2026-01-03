/**
 * Integration Tests: Generic/Simple Webhook Format
 *
 * Tests the webhook endpoint's ability to accept simple JSON payloads
 * with the basic fields required by the OnCallShift API.
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

describe('Webhooks - Generic Format', () => {
  let testService: TestService;
  let webhookClient: AxiosInstance;

  // Get API base URL
  const apiBaseUrl = getApiBaseUrl();

  beforeAll(async () => {
    // Create a test service to get an API key for webhook calls
    testService = await createTestService('Generic Webhook Test Service');

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
    return `generic-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  describe('Required Fields', () => {
    it('should accept minimal payload with only required fields', async () => {
      const payload = {
        summary: `Minimal Alert ${Date.now()}`,
        severity: 'warning',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data.message).toContain('received');
      expect(response.data.service.id).toBe(testService.id);
    });

    it('should reject payload missing summary', async () => {
      const payload = {
        // Missing summary
        severity: 'error',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
      expect(response.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'summary',
          }),
        ])
      );
    });

    it('should reject payload missing severity', async () => {
      const payload = {
        summary: `No Severity Alert ${Date.now()}`,
        // Missing severity
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
    });

    it('should reject empty summary', async () => {
      const payload = {
        summary: '',
        severity: 'error',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
    });

    it('should reject non-string summary', async () => {
      const payload = {
        summary: 12345,
        severity: 'error',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
    });
  });

  describe('Severity Validation', () => {
    it('should accept severity: info', async () => {
      const payload = {
        summary: `Info Severity Test ${Date.now()}`,
        severity: 'info',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept severity: warning', async () => {
      const payload = {
        summary: `Warning Severity Test ${Date.now()}`,
        severity: 'warning',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept severity: error', async () => {
      const payload = {
        summary: `Error Severity Test ${Date.now()}`,
        severity: 'error',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept severity: critical', async () => {
      const payload = {
        summary: `Critical Severity Test ${Date.now()}`,
        severity: 'critical',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should reject invalid severity value', async () => {
      const payload = {
        summary: `Invalid Severity Test ${Date.now()}`,
        severity: 'high', // Invalid - not in [info, warning, error, critical]
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
    });

    it('should reject uppercase severity', async () => {
      const payload = {
        summary: `Uppercase Severity Test ${Date.now()}`,
        severity: 'ERROR', // Invalid - should be lowercase
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
    });

    it('should reject numeric severity', async () => {
      const payload = {
        summary: `Numeric Severity Test ${Date.now()}`,
        severity: 1,
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
    });
  });

  describe('Optional Fields', () => {
    it('should accept payload with dedup_key', async () => {
      const dedupKey = generateDedupKey();
      const payload = {
        summary: `Dedup Key Test ${Date.now()}`,
        severity: 'warning',
        dedup_key: dedupKey,
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept payload with details object', async () => {
      const payload = {
        summary: `Details Test ${Date.now()}`,
        severity: 'error',
        details: {
          source: 'monitoring-system',
          host: 'prod-server-01',
          metric: 'cpu_usage',
          value: 95.5,
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept payload with nested details', async () => {
      const payload = {
        summary: `Nested Details Test ${Date.now()}`,
        severity: 'warning',
        details: {
          source: 'kubernetes',
          cluster: {
            name: 'prod-cluster',
            region: 'us-east-1',
          },
          pod: {
            name: 'api-pod-abc123',
            namespace: 'production',
            containers: ['api', 'sidecar'],
          },
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept payload with all optional fields', async () => {
      const dedupKey = generateDedupKey();
      const payload = {
        summary: `Full Payload Test ${Date.now()}`,
        severity: 'critical',
        dedup_key: dedupKey,
        details: {
          source: 'custom-integration',
          environment: 'production',
          service: 'api',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept empty details object', async () => {
      const payload = {
        summary: `Empty Details Test ${Date.now()}`,
        severity: 'info',
        details: {},
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should reject details as non-object', async () => {
      const payload = {
        summary: `Invalid Details Test ${Date.now()}`,
        severity: 'warning',
        details: 'string-instead-of-object',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
    });

    it('should reject details as array', async () => {
      const payload = {
        summary: `Array Details Test ${Date.now()}`,
        severity: 'warning',
        details: ['item1', 'item2'],
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
    });
  });

  describe('Deduplication Behavior', () => {
    it('should accept multiple alerts with same dedup_key', async () => {
      const dedupKey = generateDedupKey();

      // First alert
      const payload1 = {
        summary: `Dedup Test Alert 1 ${Date.now()}`,
        severity: 'error',
        dedup_key: dedupKey,
      };

      const response1 = await webhookClient.post('/v1/alerts/webhook', payload1);
      expect(response1.status).toBe(202);

      // Second alert with same dedup_key
      const payload2 = {
        summary: `Dedup Test Alert 2 ${Date.now()}`,
        severity: 'error',
        dedup_key: dedupKey,
      };

      const response2 = await webhookClient.post('/v1/alerts/webhook', payload2);

      // API should still accept (dedup happens during processing)
      expect(response2.status).toBe(202);
    });

    it('should accept alerts without dedup_key', async () => {
      const payload = {
        summary: `No Dedup Key ${Date.now()}`,
        severity: 'info',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });
  });

  describe('Authentication', () => {
    it('should reject request without X-API-Key header', async () => {
      const unauthenticatedClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      });

      const payload = {
        summary: `Unauthenticated Test ${Date.now()}`,
        severity: 'error',
      };

      const response = await unauthenticatedClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
      expect(response.data.error).toBeDefined();
    });

    it('should reject request with empty API key', async () => {
      const emptyKeyClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': '',
        },
        validateStatus: () => true,
      });

      const payload = {
        summary: `Empty Key Test ${Date.now()}`,
        severity: 'error',
      };

      const response = await emptyKeyClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid API key', async () => {
      const invalidKeyClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'not-a-valid-api-key-12345',
        },
        validateStatus: () => true,
      });

      const payload = {
        summary: `Invalid Key Test ${Date.now()}`,
        severity: 'error',
      };

      const response = await invalidKeyClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
    });

    it('should reject request with malformed API key', async () => {
      const malformedKeyClient = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': '   spaces-and-invalid-chars!@#$%   ',
        },
        validateStatus: () => true,
      });

      const payload = {
        summary: `Malformed Key Test ${Date.now()}`,
        severity: 'error',
      };

      const response = await malformedKeyClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(401);
    });
  });

  describe('Response Structure', () => {
    it('should return 202 Accepted for valid webhook', async () => {
      const payload = {
        summary: `Response Status Test ${Date.now()}`,
        severity: 'info',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should include message in response', async () => {
      const payload = {
        summary: `Response Message Test ${Date.now()}`,
        severity: 'warning',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data.message).toBeDefined();
      expect(typeof response.data.message).toBe('string');
      expect(response.data.message.length).toBeGreaterThan(0);
    });

    it('should include service information in response', async () => {
      const payload = {
        summary: `Response Service Test ${Date.now()}`,
        severity: 'error',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
      expect(response.data.service).toBeDefined();
      expect(response.data.service.id).toBe(testService.id);
      expect(response.data.service.name).toBe(testService.name);
    });

    it('should return 400 for validation errors with details', async () => {
      const payload = {
        // Missing required fields
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
      expect(Array.isArray(response.data.errors)).toBe(true);
    });
  });

  describe('Content-Type Handling', () => {
    it('should accept application/json content type', async () => {
      const response = await webhookClient.post('/v1/alerts/webhook', {
        summary: `JSON Content Type Test ${Date.now()}`,
        severity: 'info',
      });

      expect(response.status).toBe(202);
    });

    it('should accept request with charset in content type', async () => {
      const client = axios.create({
        baseURL: apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-API-Key': testService.apiKey,
        },
        validateStatus: () => true,
      });

      const payload = {
        summary: `Charset Test ${Date.now()}`,
        severity: 'info',
      };

      const response = await client.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long summary', async () => {
      const longSummary = 'A'.repeat(1000);
      const payload = {
        summary: longSummary,
        severity: 'warning',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      // Should accept or reject gracefully (no 500 error)
      expect([200, 202, 400]).toContain(response.status);
    });

    it('should handle unicode characters in summary', async () => {
      const payload = {
        summary: `Unicode Test: Japanese:, Emoji: Alert ${Date.now()}`,
        severity: 'info',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should handle special characters in summary', async () => {
      const payload = {
        summary: `Special chars: <>&"' test @ ${Date.now()}`,
        severity: 'warning',
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should handle null values in details', async () => {
      const payload = {
        summary: `Null Details Values ${Date.now()}`,
        severity: 'info',
        details: {
          value1: null,
          value2: 'not-null',
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should handle very deep nested details', async () => {
      const payload = {
        summary: `Deep Nesting Test ${Date.now()}`,
        severity: 'info',
        details: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: 'deep value',
                },
              },
            },
          },
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });
  });

  describe('Common Integration Scenarios', () => {
    it('should accept Prometheus-style alert', async () => {
      const payload = {
        summary: `[FIRING:1] HighMemoryUsage ${Date.now()}`,
        severity: 'warning',
        details: {
          alertname: 'HighMemoryUsage',
          instance: 'prod-server-01:9090',
          job: 'node-exporter',
          severity: 'warning',
          value: '85.5',
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept Datadog-style alert', async () => {
      const payload = {
        summary: `[Triggered] CPU is high on prod-server-01`,
        severity: 'error',
        dedup_key: `datadog-cpu-${Date.now()}`,
        details: {
          source: 'datadog',
          alert_type: 'metric alert',
          metric: 'system.cpu.user',
          threshold: 80,
          actual_value: 92.3,
          host: 'prod-server-01',
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept CloudWatch-style alert', async () => {
      const payload = {
        summary: `ALARM: High-CPU-Utilization`,
        severity: 'critical',
        dedup_key: `cloudwatch-${Date.now()}`,
        details: {
          source: 'aws-cloudwatch',
          alarm_name: 'High-CPU-Utilization',
          alarm_description: 'CPU utilization exceeded 90%',
          state_reason: 'Threshold Crossed: 1 datapoint was >= 90.0',
          region: 'us-east-1',
          namespace: 'AWS/EC2',
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });

    it('should accept custom application alert', async () => {
      const payload = {
        summary: `Payment processing failed for order ORD-12345`,
        severity: 'error',
        dedup_key: `payment-failure-${Date.now()}`,
        details: {
          source: 'payment-service',
          order_id: 'ORD-12345',
          customer_id: 'CUST-67890',
          error_code: 'PAYMENT_DECLINED',
          amount: 99.99,
          currency: 'USD',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await webhookClient.post('/v1/alerts/webhook', payload);

      expect(response.status).toBe(202);
    });
  });
});

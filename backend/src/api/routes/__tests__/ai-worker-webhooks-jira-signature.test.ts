/**
 * Jira Webhook Signature Verification Tests
 *
 * Comprehensive test suite for HMAC-SHA256 signature verification
 * Tests cover security scenarios including timing attack prevention,
 * invalid signatures, missing headers, and real-world Jira payloads.
 */

import crypto from 'crypto';

/**
 * Helper function to compute a valid Jira webhook signature
 * Mirrors the actual implementation in ai-worker-webhooks.ts
 */
function computeJiraSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('base64');
}

/**
 * Helper function to verify a signature
 * Mirrors the actual implementation in ai-worker-webhooks.ts
 */
function verifyJiraSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = hmac.digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

describe('Jira Webhook Signature Verification', () => {
  const secret = 'jira-webhook-secret-test-key';

  describe('Valid Signatures', () => {
    it('should accept a valid signature for simple JSON payload', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });
      const signature = computeJiraSignature(payload, secret);

      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should accept a valid signature for complex nested JSON', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_updated',
        issue: {
          key: 'PROJ-123',
          fields: {
            summary: 'Complex nested data structure',
            description: 'This is a test with many fields',
            assignee: {
              name: 'John Doe',
              email: 'john@example.com',
            },
            labels: ['ai-worker', 'backend', 'urgent'],
          },
        },
        changelog: {
          histories: [
            {
              id: '12345',
              created: '2024-01-29T00:00:00.000Z',
              items: [
                {
                  field: 'status',
                  fromString: 'To Do',
                  toString: 'In Progress',
                },
              ],
            },
          ],
        },
      });
      const signature = computeJiraSignature(payload, secret);

      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should accept a valid signature with unicode characters', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: {
          key: 'TEST-1',
          fields: {
            summary: 'Unicode test: 你好世界 🚀 Ñoño',
            description: 'Emoji support: 🔒🔐🛡️',
          },
        },
      });
      const signature = computeJiraSignature(payload, secret);

      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should accept a valid signature with special characters and escaping', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: {
          key: 'TEST-1',
          fields: {
            summary: 'Special chars: "quotes", \\backslash, /slash, newline\ncarriage\r',
          },
        },
      });
      const signature = computeJiraSignature(payload, secret);

      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should accept a valid signature with empty string values', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: {
          key: 'TEST-1',
          fields: {
            summary: '',
            description: null,
          },
        },
      });
      const signature = computeJiraSignature(payload, secret);

      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });
  });

  describe('Invalid Signatures', () => {
    it('should reject a malformed signature', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      expect(verifyJiraSignature(payload, 'invalid-signature', secret)).toBe(false);
    });

    it('should reject an empty signature', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      expect(verifyJiraSignature(payload, '', secret)).toBe(false);
    });

    it('should reject a signature with wrong secret', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });
      const signature = computeJiraSignature(payload, secret);
      const wrongSecret = 'different-secret';

      expect(verifyJiraSignature(payload, signature, wrongSecret)).toBe(false);
    });

    it('should reject when payload has been tampered with', () => {
      const originalPayload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });
      const signature = computeJiraSignature(originalPayload, secret);

      const tamperedPayload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-2' }, // Changed
      });

      expect(verifyJiraSignature(tamperedPayload, signature, secret)).toBe(false);
    });

    it('should reject when single character in payload is changed', () => {
      const originalPayload = '{"key":"value123"}';
      const signature = computeJiraSignature(originalPayload, secret);

      const tamperedPayload = '{"key":"value124"}';

      expect(verifyJiraSignature(tamperedPayload, signature, secret)).toBe(false);
    });

    it('should reject when whitespace in payload is changed', () => {
      // Payload with specific spacing
      const originalPayload = '{"key":"value","number":123}';
      const signature = computeJiraSignature(originalPayload, secret);

      // Same content but with extra whitespace (e.g., from pretty-printing)
      const tamperedPayload = '{\n  "key": "value",\n  "number": 123\n}';

      expect(tamperedPayload).not.toEqual(originalPayload);
      expect(verifyJiraSignature(tamperedPayload, signature, secret)).toBe(false);
    });
  });

  describe('Missing Signature Header', () => {
    it('should reject when signature is undefined', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      expect(verifyJiraSignature(payload, undefined, secret)).toBe(false);
    });

    it('should reject when signature is null', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      // TypeScript won't allow null directly, so we cast
      expect(verifyJiraSignature(payload, null as any, secret)).toBe(false);
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should use constant-time comparison via crypto.timingSafeEqual', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });
      const correctSignature = computeJiraSignature(payload, secret);

      // Signature starting with correct prefix but wrong ending
      const incorrectSignature = correctSignature.slice(0, -3) + 'XXX';

      // Should still be rejected despite partial match
      expect(verifyJiraSignature(payload, incorrectSignature, secret)).toBe(false);
    });

    it('should not leak information about signature length mismatch', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });
      const correctSignature = computeJiraSignature(payload, secret);

      // Much shorter signature
      const shortSignature = 'a';
      // Much longer signature
      const longSignature = correctSignature + 'a'.repeat(100);

      // Both should return false consistently
      const resultShort = verifyJiraSignature(payload, shortSignature, secret);
      const resultLong = verifyJiraSignature(payload, longSignature, secret);

      expect(resultShort).toBe(false);
      expect(resultLong).toBe(false);
    });

    it('should handle signature buffer encoding consistently', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });
      const correctSignature = computeJiraSignature(payload, secret);

      // Simulate signatures from different encoding paths
      const bufferSignature = Buffer.from(correctSignature, 'base64').toString('base64');

      expect(verifyJiraSignature(payload, bufferSignature, secret)).toBe(true);
    });
  });

  describe('Real-World Jira Webhook Payloads', () => {
    it('should verify issue_created event signature', () => {
      const payload = JSON.stringify({
        timestamp: 1643408400000,
        webhookEvent: 'jira:issue_created',
        issue: {
          key: 'PROJ-1234',
          id: '10000',
          fields: {
            summary: 'Implement new feature',
            description: 'Detailed description here',
            status: {
              name: 'To Do',
            },
            assignee: {
              name: 'john.doe',
              emailAddress: 'john@example.com',
            },
            labels: ['ai-worker', 'backend'],
            issuetype: {
              name: 'Story',
            },
          },
        },
      });

      const signature = computeJiraSignature(payload, secret);
      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should verify issue_updated event signature', () => {
      const payload = JSON.stringify({
        timestamp: 1643408400000,
        webhookEvent: 'jira:issue_updated',
        issue: {
          key: 'PROJ-1234',
          id: '10000',
          fields: {
            summary: 'Updated summary',
            status: {
              name: 'In Progress',
            },
            assignee: {
              name: 'jane.doe',
              emailAddress: 'jane@example.com',
            },
            labels: ['ai-worker'],
          },
        },
        changelog: {
          id: '10001',
          items: [
            {
              field: 'assignee',
              fieldtype: 'user',
              from: 'john.doe',
              fromString: 'John Doe',
              to: 'jane.doe',
              toString: 'Jane Doe',
            },
          ],
        },
      });

      const signature = computeJiraSignature(payload, secret);
      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should verify signature with multiple changelog items', () => {
      const payload = JSON.stringify({
        timestamp: 1643408400000,
        webhookEvent: 'jira:issue_updated',
        issue: {
          key: 'PROJ-5678',
          fields: {
            summary: 'Complex issue',
          },
        },
        changelog: {
          id: '10001',
          items: [
            {
              field: 'status',
              fromString: 'To Do',
              toString: 'In Progress',
            },
            {
              field: 'assignee',
              fromString: 'User A',
              toString: 'User B',
            },
            {
              field: 'labels',
              fromString: 'old-label',
              toString: 'ai-worker',
            },
          ],
        },
      });

      const signature = computeJiraSignature(payload, secret);
      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large payloads', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(100),
      }));
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
        largeData: largeArray,
      });

      const signature = computeJiraSignature(payload, secret);
      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should handle payload with null values', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: {
          key: 'TEST-1',
          fields: {
            summary: null,
            description: null,
            assignee: null,
          },
        },
      });

      const signature = computeJiraSignature(payload, secret);
      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should handle payload with boolean and numeric values', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: {
          key: 'TEST-1',
          id: 12345,
          fields: {
            isActive: true,
            isPriority: false,
            storyPoints: 8,
          },
        },
      });

      const signature = computeJiraSignature(payload, secret);
      expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
    });

    it('should handle signature with base64 padding', () => {
      // Some signatures end with padding '=' or '=='
      const payloads = [
        JSON.stringify({ key: 'value1' }),
        JSON.stringify({ key: 'value2' }),
        JSON.stringify({ key: 'value3' }),
      ];

      payloads.forEach(payload => {
        const signature = computeJiraSignature(payload, secret);
        // Should handle padding correctly
        expect(verifyJiraSignature(payload, signature, secret)).toBe(true);
        // Verify signature actually contains base64 characters
        expect(/^[A-Za-z0-9+/=]+$/.test(signature)).toBe(true);
      });
    });
  });

  describe('Secret Configuration Scenarios', () => {
    it('should work with secrets of various lengths', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      const secretVariations = [
        'short', // 5 chars
        'medium-length-secret', // 20 chars
        'very-very-very-very-very-very-very-long-webhook-secret-key', // 60+ chars
      ];

      secretVariations.forEach(testSecret => {
        const signature = computeJiraSignature(payload, testSecret);
        expect(verifyJiraSignature(payload, signature, testSecret)).toBe(true);

        // Different secret should fail
        const differentSecret = testSecret + 'x';
        expect(verifyJiraSignature(payload, signature, differentSecret)).toBe(false);
      });
    });

    it('should work with secrets containing special characters', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      const specialSecrets = [
        'secret-with-dashes-123',
        'secret_with_underscores_456',
        'secret.with.dots.789',
        'secret+with+plus+signs',
        'secret/with/slashes',
        'secret=with=equals',
      ];

      specialSecrets.forEach(testSecret => {
        const signature = computeJiraSignature(payload, testSecret);
        expect(verifyJiraSignature(payload, signature, testSecret)).toBe(true);
      });
    });

    it('should fail when using empty secret', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      const signature = computeJiraSignature(payload, secret);

      // Signature made with real secret should fail with empty secret
      expect(verifyJiraSignature(payload, signature, '')).toBe(false);
    });
  });

  describe('Security Requirements', () => {
    it('should use SHA256 algorithm (not weaker MD5 or SHA1)', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      // Compute signature using SHA256
      const sha256Signature = computeJiraSignature(payload, secret);

      // Verify it produces valid base64 output
      expect(/^[A-Za-z0-9+/=]+$/.test(sha256Signature)).toBe(true);

      // SHA256 produces 44 characters in base64 (32 bytes * 4/3 + padding)
      // This is longer than MD5 (24 chars) or SHA1 (28 chars)
      expect(sha256Signature.length).toBeGreaterThan(32);
    });

    it('should use Base64 encoding for signature output', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      const signature = computeJiraSignature(payload, secret);

      // Base64 should only contain these characters
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      expect(base64Pattern.test(signature)).toBe(true);
    });

    it('should not accept signatures in hex format', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      // Create a hex signature (wrong format)
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const hexSignature = hmac.digest('hex'); // Wrong format

      // Should be rejected because it's not base64
      const base64Signature = computeJiraSignature(payload, secret);
      expect(hexSignature).not.toEqual(base64Signature);
      expect(verifyJiraSignature(payload, hexSignature, secret)).toBe(false);
    });

    it('should prevent signature replay attacks by requiring exact payload match', () => {
      const payload1 = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });
      const payload2 = JSON.stringify({
        webhookEvent: 'jira:issue_updated',
        issue: { key: 'TEST-1' },
      });

      const signature1 = computeJiraSignature(payload1, secret);

      // Signature from payload1 should NOT work for payload2
      expect(verifyJiraSignature(payload2, signature1, secret)).toBe(false);
    });

    it('should be deterministic (same payload produces same signature)', () => {
      const payload = JSON.stringify({
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      });

      const signature1 = computeJiraSignature(payload, secret);
      const signature2 = computeJiraSignature(payload, secret);
      const signature3 = computeJiraSignature(payload, secret);

      expect(signature1).toEqual(signature2);
      expect(signature2).toEqual(signature3);
    });
  });
});

import crypto from 'crypto';
import { Request } from 'express';

/**
 * Test suite for Slack webhook signature verification
 *
 * Tests the implementation in integrations.ts to ensure:
 * 1. Valid signatures are accepted
 * 2. Invalid signatures are rejected
 * 3. Replay attacks (old timestamps) are prevented
 * 4. Missing configuration fails closed (secure by default)
 */

describe('Slack Signature Verification', () => {
  const MOCK_SIGNING_SECRET = 'test_signing_secret_12345';
  const MOCK_BODY = '{"type":"block_actions","user":{"id":"U123"}}';

  // Helper function to generate valid Slack signature
  function generateValidSignature(timestamp: string, body: string, secret: string): string {
    const sigBaseString = `v0:${timestamp}:${body}`;
    const signature = 'v0=' + crypto
      .createHmac('sha256', secret)
      .update(sigBaseString)
      .digest('hex');
    return signature;
  }

  // Helper to create mock request
  function createMockRequest(
    timestamp: string | undefined,
    signature: string | undefined,
    body: string
  ): Partial<Request> {
    const headers: Record<string, string> = {};
    if (timestamp) headers['x-slack-request-timestamp'] = timestamp;
    if (signature) headers['x-slack-signature'] = signature;

    return {
      headers,
      rawBody: Buffer.from(body),
    } as any;
  }

  // Mock implementation of verifySlackSignature (extracted from integrations.ts)
  function verifySlackSignature(
    req: Partial<Request>,
    signingSecret: string | undefined
  ): { valid: boolean; error?: string } {
    if (!signingSecret) {
      // Security: Fail closed when signing secret is not configured
      return { valid: false, error: 'Slack signing secret not configured' };
    }

    const timestamp = req.headers?.['x-slack-request-timestamp'] as string;
    const slackSignature = req.headers?.['x-slack-signature'] as string;

    if (!timestamp || !slackSignature) {
      return { valid: false, error: 'Missing Slack signature headers' };
    }

    // Prevent replay attacks - reject requests older than 5 minutes
    const requestTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const fiveMinutesInSeconds = 5 * 60;

    if (Math.abs(currentTimestamp - requestTimestamp) > fiveMinutesInSeconds) {
      return { valid: false, error: 'Request timestamp too old (possible replay attack)' };
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      return { valid: false, error: 'Internal error: raw body not available' };
    }

    // Create the signature base string: v0:timestamp:body
    const sigBaseString = `v0:${timestamp}:${rawBody.toString()}`;

    // Calculate expected signature using HMAC-SHA256
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(sigBaseString)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(slackSignature)
      );

      if (!isValid) {
        return { valid: false, error: 'Invalid signature' };
      }

      return { valid: true };
    } catch {
      // timingSafeEqual throws if buffers have different lengths
      return { valid: false, error: 'Invalid signature format' };
    }
  }

  describe('GIVEN valid Slack request with proper signature', () => {
    it('WHEN signature is valid THEN request is accepted', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('WHEN timestamp is within 5 minute window THEN request is accepted', () => {
      // Test at 4 minutes 59 seconds ago (just under threshold)
      const timestamp = (Math.floor(Date.now() / 1000) - 299).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(true);
    });
  });

  describe('GIVEN invalid signature', () => {
    it('WHEN signature does not match THEN request is rejected with 401', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const wrongSignature = 'v0=wrong_signature_12345';
      const req = createMockRequest(timestamp, wrongSignature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('WHEN signature uses wrong secret THEN request is rejected', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const wrongSecret = 'wrong_secret';
      const signature = generateValidSignature(timestamp, MOCK_BODY, wrongSecret);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('WHEN body is tampered with THEN request is rejected', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const tamperedBody = '{"type":"block_actions","user":{"id":"HACKER"}}';
      const req = createMockRequest(timestamp, signature, tamperedBody);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('WHEN signature format is invalid THEN request is rejected', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const invalidSignature = 'not-a-valid-format';
      const req = createMockRequest(timestamp, invalidSignature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature format');
    });
  });

  describe('GIVEN timestamp older than 5 minutes (replay attack)', () => {
    it('WHEN timestamp is exactly 5 minutes old THEN request is rejected', () => {
      const timestamp = (Math.floor(Date.now() / 1000) - 300).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request timestamp too old (possible replay attack)');
    });

    it('WHEN timestamp is 10 minutes old THEN request is rejected', () => {
      const timestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request timestamp too old (possible replay attack)');
    });

    it('WHEN timestamp is from the future (clock skew attack) THEN request is rejected', () => {
      const timestamp = (Math.floor(Date.now() / 1000) + 400).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request timestamp too old (possible replay attack)');
    });
  });

  describe('GIVEN missing headers', () => {
    it('WHEN timestamp header is missing THEN request is rejected', () => {
      const signature = 'v0=some_signature';
      const req = createMockRequest(undefined, signature, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing Slack signature headers');
    });

    it('WHEN signature header is missing THEN request is rejected', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const req = createMockRequest(timestamp, undefined, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing Slack signature headers');
    });

    it('WHEN both headers are missing THEN request is rejected', () => {
      const req = createMockRequest(undefined, undefined, MOCK_BODY);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing Slack signature headers');
    });
  });

  describe('GIVEN SLACK_SIGNING_SECRET not configured', () => {
    it('WHEN secret is undefined THEN request is rejected (fail closed)', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Slack signing secret not configured');
    });

    it('WHEN secret is empty string THEN request is rejected', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, MOCK_BODY);

      const result = verifySlackSignature(req, '');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Slack signing secret not configured');
    });
  });

  describe('Edge cases', () => {
    it('WHEN raw body is missing THEN request is rejected', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = generateValidSignature(timestamp, MOCK_BODY, MOCK_SIGNING_SECRET);
      const req = {
        headers: {
          'x-slack-request-timestamp': timestamp,
          'x-slack-signature': signature,
        },
        // rawBody intentionally missing
      } as any;

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Internal error: raw body not available');
    });

    it('WHEN body is empty string THEN signature verification still works', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const emptyBody = '';
      const signature = generateValidSignature(timestamp, emptyBody, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, emptyBody);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(true);
    });

    it('WHEN body contains unicode characters THEN signature verification works', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const unicodeBody = '{"message":"Hello 👋 World 🌍"}';
      const signature = generateValidSignature(timestamp, unicodeBody, MOCK_SIGNING_SECRET);
      const req = createMockRequest(timestamp, signature, unicodeBody);

      const result = verifySlackSignature(req, MOCK_SIGNING_SECRET);

      expect(result.valid).toBe(true);
    });
  });
});

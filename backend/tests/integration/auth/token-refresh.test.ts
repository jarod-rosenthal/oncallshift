import { apiClient, login } from '../helpers';

/**
 * Integration tests for the token refresh flow.
 * Tests run against the production API at https://oncallshift.com/api
 *
 * Required environment variables:
 * - TEST_USER_EMAIL: Valid user email for testing
 * - TEST_USER_PASSWORD: Valid user password for testing
 */
describe('Auth - Token Refresh', () => {
  const validEmail = process.env.TEST_USER_EMAIL;
  const validPassword = process.env.TEST_USER_PASSWORD;
  let validRefreshToken: string;

  beforeAll(async () => {
    if (!validEmail || !validPassword) {
      console.warn(
        'Warning: TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required for token refresh tests'
      );
      return;
    }

    // Get a valid refresh token by logging in
    try {
      const loginResult = await login(validEmail, validPassword);
      validRefreshToken = loginResult.refreshToken;
    } catch (error) {
      console.error('Failed to obtain refresh token during test setup:', error);
    }
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new access token with valid refresh token', async () => {
      if (!validRefreshToken) {
        console.log('Skipping test: No valid refresh token available');
        return;
      }

      const response = await apiClient.post('/auth/refresh', {
        refreshToken: validRefreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Token refreshed successfully');
      expect(response.data).toHaveProperty('tokens');
      expect(response.data.tokens).toHaveProperty('accessToken');
      expect(response.data.tokens).toHaveProperty('idToken');
      expect(response.data.tokens).toHaveProperty('expiresIn');

      // Access token should be a valid JWT
      expect(response.data.tokens.accessToken).toMatch(
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
      );

      // ID token should be a valid JWT
      expect(response.data.tokens.idToken).toMatch(
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
      );

      expect(response.data.tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should return 401 with invalid refresh token', async () => {
      try {
        await apiClient.post('/auth/refresh', {
          refreshToken: 'invalid-refresh-token-that-does-not-exist',
        });
        fail('Expected request to fail with 401');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
        expect(error.response.data.error).toBe('Invalid refresh token');
      }
    });

    it('should return 401 with malformed refresh token', async () => {
      try {
        await apiClient.post('/auth/refresh', {
          refreshToken: 'malformed.token',
        });
        fail('Expected request to fail with 401');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    it('should return 401 with empty refresh token', async () => {
      try {
        await apiClient.post('/auth/refresh', {
          refreshToken: '',
        });
        fail('Expected request to fail with 400 or 401');
      } catch (error: any) {
        // Could be 400 (validation) or 401 (auth)
        expect([400, 401]).toContain(error.response.status);
      }
    });

    it('should return 400 for missing refreshToken field', async () => {
      try {
        await apiClient.post('/auth/refresh', {});
        fail('Expected request to fail with 400');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
        expect(Array.isArray(error.response.data.errors)).toBe(true);
        const tokenError = error.response.data.errors.find(
          (e: any) => e.path === 'refreshToken' || e.param === 'refreshToken'
        );
        expect(tokenError).toBeDefined();
      }
    });

    it('should return new tokens that can be used for authenticated requests', async () => {
      if (!validRefreshToken) {
        console.log('Skipping test: No valid refresh token available');
        return;
      }

      // Get new tokens
      const refreshResponse = await apiClient.post('/auth/refresh', {
        refreshToken: validRefreshToken,
      });

      expect(refreshResponse.status).toBe(200);

      const newAccessToken = refreshResponse.data.tokens.accessToken;

      // Use the new access token to make an authenticated request
      const authenticatedResponse = await apiClient.get('/users/me', {
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
        },
      });

      expect(authenticatedResponse.status).toBe(200);
      expect(authenticatedResponse.data).toHaveProperty('id');
      expect(authenticatedResponse.data).toHaveProperty('email');
    });
  });

  describe('Token refresh behavior', () => {
    it('should return different access token on each refresh', async () => {
      if (!validRefreshToken) {
        console.log('Skipping test: No valid refresh token available');
        return;
      }

      const response1 = await apiClient.post('/auth/refresh', {
        refreshToken: validRefreshToken,
      });

      // Small delay to ensure tokens are different
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response2 = await apiClient.post('/auth/refresh', {
        refreshToken: validRefreshToken,
      });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Access tokens should be different (new tokens issued each time)
      expect(response1.data.tokens.accessToken).not.toBe(
        response2.data.tokens.accessToken
      );
    });

    it('should not return a new refresh token on refresh', async () => {
      if (!validRefreshToken) {
        console.log('Skipping test: No valid refresh token available');
        return;
      }

      const response = await apiClient.post('/auth/refresh', {
        refreshToken: validRefreshToken,
      });

      expect(response.status).toBe(200);

      // Cognito REFRESH_TOKEN_AUTH flow does not return a new refresh token
      // The original refresh token remains valid until it expires
      expect(response.data.tokens.refreshToken).toBeUndefined();
    });
  });

  describe('Expired token handling', () => {
    it('should return 401 for expired refresh token', async () => {
      // Note: We cannot easily test with a truly expired token
      // as refresh tokens typically have a long validity period (30 days for Cognito)
      // This test uses a fake token format that mimics an expired token

      const fakeExpiredToken = 'eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.expired';

      try {
        await apiClient.post('/auth/refresh', {
          refreshToken: fakeExpiredToken,
        });
        fail('Expected request to fail with 401');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('Concurrent refresh requests', () => {
    it('should handle multiple concurrent refresh requests', async () => {
      if (!validRefreshToken) {
        console.log('Skipping test: No valid refresh token available');
        return;
      }

      // Make 3 concurrent refresh requests
      const requests = [
        apiClient.post('/auth/refresh', { refreshToken: validRefreshToken }),
        apiClient.post('/auth/refresh', { refreshToken: validRefreshToken }),
        apiClient.post('/auth/refresh', { refreshToken: validRefreshToken }),
      ];

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response: { status: number; data: { tokens: { accessToken: string } } }) => {
        expect(response.status).toBe(200);
        expect(response.data.tokens).toHaveProperty('accessToken');
      });
    });
  });
});

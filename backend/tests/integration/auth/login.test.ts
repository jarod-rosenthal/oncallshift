import { apiClient } from '../helpers';

/**
 * Integration tests for the login authentication flow.
 * Tests run against the production API at https://oncallshift.com/api
 *
 * Required environment variables:
 * - TEST_USER_EMAIL: Valid user email for testing
 * - TEST_USER_PASSWORD: Valid user password for testing
 */
describe('Auth - Login', () => {
  const validEmail = process.env.TEST_USER_EMAIL;
  const validPassword = process.env.TEST_USER_PASSWORD;

  beforeAll(() => {
    if (!validEmail || !validPassword) {
      console.warn(
        'Warning: TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required for login tests'
      );
    }
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      if (!validEmail || !validPassword) {
        console.log('Skipping test: Missing test credentials');
        return;
      }

      const response = await apiClient.post('/auth/login', {
        email: validEmail,
        password: validPassword,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Login successful');
      expect(response.data).toHaveProperty('tokens');
      expect(response.data.tokens).toHaveProperty('accessToken');
      expect(response.data.tokens).toHaveProperty('idToken');
      expect(response.data.tokens).toHaveProperty('refreshToken');
      expect(response.data.tokens).toHaveProperty('expiresIn');
      expect(typeof response.data.tokens.accessToken).toBe('string');
      expect(typeof response.data.tokens.refreshToken).toBe('string');
      expect(typeof response.data.tokens.expiresIn).toBe('number');
    });

    it('should return 401 with invalid password', async () => {
      if (!validEmail) {
        console.log('Skipping test: Missing test email');
        return;
      }

      try {
        await apiClient.post('/auth/login', {
          email: validEmail,
          password: 'wrongpassword123!',
        });
        fail('Expected request to fail with 401');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
        expect(error.response.data.error).toBe('Invalid email or password');
      }
    });

    it('should return 401 with non-existent email', async () => {
      try {
        await apiClient.post('/auth/login', {
          email: 'nonexistent-user-test@example.com',
          password: 'SomePassword123!',
        });
        fail('Expected request to fail with 401');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('error');
        expect(error.response.data.error).toBe('Invalid email or password');
      }
    });

    it('should return 400 for missing email', async () => {
      try {
        await apiClient.post('/auth/login', {
          password: 'SomePassword123!',
        });
        fail('Expected request to fail with 400');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
        expect(Array.isArray(error.response.data.errors)).toBe(true);
        const emailError = error.response.data.errors.find(
          (e: any) => e.path === 'email' || e.param === 'email'
        );
        expect(emailError).toBeDefined();
        expect(emailError.msg).toBe('Valid email is required');
      }
    });

    it('should return 400 for missing password', async () => {
      try {
        await apiClient.post('/auth/login', {
          email: 'test@example.com',
        });
        fail('Expected request to fail with 400');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
        expect(Array.isArray(error.response.data.errors)).toBe(true);
        const passwordError = error.response.data.errors.find(
          (e: any) => e.path === 'password' || e.param === 'password'
        );
        expect(passwordError).toBeDefined();
      }
    });

    it('should return 400 for invalid email format', async () => {
      try {
        await apiClient.post('/auth/login', {
          email: 'not-an-email',
          password: 'SomePassword123!',
        });
        fail('Expected request to fail with 400');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
        expect(Array.isArray(error.response.data.errors)).toBe(true);
        const emailError = error.response.data.errors.find(
          (e: any) => e.path === 'email' || e.param === 'email'
        );
        expect(emailError).toBeDefined();
        expect(emailError.msg).toBe('Valid email is required');
      }
    });

    it('should return 400 for empty request body', async () => {
      try {
        await apiClient.post('/auth/login', {});
        fail('Expected request to fail with 400');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
        expect(Array.isArray(error.response.data.errors)).toBe(true);
        expect(error.response.data.errors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Token structure validation', () => {
    it('should return tokens in expected format', async () => {
      if (!validEmail || !validPassword) {
        console.log('Skipping test: Missing test credentials');
        return;
      }

      const response = await apiClient.post('/auth/login', {
        email: validEmail,
        password: validPassword,
      });

      expect(response.status).toBe(200);

      // Access token should be a JWT (three base64 parts separated by dots)
      const accessToken = response.data.tokens.accessToken;
      expect(accessToken).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);

      // ID token should also be a JWT
      const idToken = response.data.tokens.idToken;
      expect(idToken).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);

      // Refresh token format may vary (Cognito uses a different format)
      expect(response.data.tokens.refreshToken).toBeTruthy();
      expect(response.data.tokens.refreshToken.length).toBeGreaterThan(0);

      // expiresIn should be a positive number (typically 3600 seconds for Cognito)
      expect(response.data.tokens.expiresIn).toBeGreaterThan(0);
    });
  });
});

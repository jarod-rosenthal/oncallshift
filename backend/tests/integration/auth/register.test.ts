import { apiClient } from '../helpers';

/**
 * Integration tests for the user registration flow.
 * Tests run against the production API at https://oncallshift.com/api
 *
 * Note: Registration is restricted to specific email domains (oncallshift.com).
 * Most registration tests verify validation and error handling rather than
 * successful registration to avoid creating test accounts in production.
 */
describe('Auth - Register', () => {
  describe('POST /api/v1/auth/register', () => {
    describe('Validation errors', () => {
      it('should return 400 for missing email', async () => {
        try {
          await apiClient.post('/auth/register', {
            password: 'ValidPassword123!',
            fullName: 'Test User',
            organizationName: 'Test Organization',
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
        }
      });

      it('should return 400 for invalid email format', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'not-a-valid-email',
            password: 'ValidPassword123!',
            fullName: 'Test User',
            organizationName: 'Test Organization',
          });
          fail('Expected request to fail with 400');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('errors');
          const emailError = error.response.data.errors.find(
            (e: any) => e.path === 'email' || e.param === 'email'
          );
          expect(emailError).toBeDefined();
        }
      });

      it('should return 400 for weak password (less than 8 characters)', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'test@example.com',
            password: 'short',
            fullName: 'Test User',
            organizationName: 'Test Organization',
          });
          fail('Expected request to fail with 400');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('errors');
          const passwordError = error.response.data.errors.find(
            (e: any) => e.path === 'password' || e.param === 'password'
          );
          expect(passwordError).toBeDefined();
          expect(passwordError.msg).toContain('8 characters');
        }
      });

      it('should return 400 for missing fullName', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'test@example.com',
            password: 'ValidPassword123!',
            organizationName: 'Test Organization',
          });
          fail('Expected request to fail with 400');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('errors');
          const fullNameError = error.response.data.errors.find(
            (e: any) => e.path === 'fullName' || e.param === 'fullName'
          );
          expect(fullNameError).toBeDefined();
        }
      });

      it('should return 400 for missing organizationName', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'test@example.com',
            password: 'ValidPassword123!',
            fullName: 'Test User',
          });
          fail('Expected request to fail with 400');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('errors');
          const orgError = error.response.data.errors.find(
            (e: any) => e.path === 'organizationName' || e.param === 'organizationName'
          );
          expect(orgError).toBeDefined();
        }
      });

      it('should return 400 for empty fullName', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'test@example.com',
            password: 'ValidPassword123!',
            fullName: '',
            organizationName: 'Test Organization',
          });
          fail('Expected request to fail with 400');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('errors');
          const fullNameError = error.response.data.errors.find(
            (e: any) => e.path === 'fullName' || e.param === 'fullName'
          );
          expect(fullNameError).toBeDefined();
        }
      });

      it('should return 400 for empty organizationName', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'test@example.com',
            password: 'ValidPassword123!',
            fullName: 'Test User',
            organizationName: '',
          });
          fail('Expected request to fail with 400');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('errors');
          const orgError = error.response.data.errors.find(
            (e: any) => e.path === 'organizationName' || e.param === 'organizationName'
          );
          expect(orgError).toBeDefined();
        }
      });

      it('should return 400 for empty request body', async () => {
        try {
          await apiClient.post('/auth/register', {});
          fail('Expected request to fail with 400');
        } catch (error: any) {
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty('errors');
          expect(Array.isArray(error.response.data.errors)).toBe(true);
          // Should have errors for all required fields
          expect(error.response.data.errors.length).toBeGreaterThanOrEqual(4);
        }
      });
    });

    describe('Domain restriction', () => {
      it('should return 403 for non-whitelisted email domain', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'newuser@notallowed.com',
            password: 'ValidPassword123!',
            fullName: 'Test User',
            organizationName: 'Test Organization',
          });
          fail('Expected request to fail with 403');
        } catch (error: any) {
          expect(error.response.status).toBe(403);
          expect(error.response.data).toHaveProperty('error');
          expect(error.response.data.error).toContain('restricted');
        }
      });

      it('should return 403 for common public email domains', async () => {
        const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];

        for (const domain of publicDomains) {
          try {
            await apiClient.post('/auth/register', {
              email: `testuser@${domain}`,
              password: 'ValidPassword123!',
              fullName: 'Test User',
              organizationName: 'Test Organization',
            });
            fail(`Expected request to fail with 403 for domain: ${domain}`);
          } catch (error: any) {
            expect(error.response.status).toBe(403);
            expect(error.response.data).toHaveProperty('error');
            expect(error.response.data.error).toContain('restricted');
          }
        }
      });
    });

    describe('Duplicate user handling', () => {
      it('should reject registration with existing user email', async () => {
        const existingEmail = process.env.TEST_USER_EMAIL;

        if (!existingEmail) {
          console.log('Skipping test: Missing TEST_USER_EMAIL environment variable');
          return;
        }

        try {
          await apiClient.post('/auth/register', {
            email: existingEmail,
            password: 'ValidPassword123!',
            fullName: 'Duplicate User',
            organizationName: 'Duplicate Org',
          });
          fail('Expected request to fail');
        } catch (error: any) {
          // Could be 400 (user exists) or 403 (domain restricted)
          // depending on which check runs first
          expect([400, 403]).toContain(error.response.status);
        }
      });
    });

    describe('Optional fields', () => {
      it('should accept registration without phoneNumber (validation only)', async () => {
        // This test verifies validation passes without phoneNumber
        // but domain restriction will still prevent actual registration
        try {
          await apiClient.post('/auth/register', {
            email: 'newuser@notallowed.com',
            password: 'ValidPassword123!',
            fullName: 'Test User',
            organizationName: 'Test Organization',
            // phoneNumber is intentionally omitted
          });
        } catch (error: any) {
          // Domain restriction kicks in after validation passes
          expect(error.response.status).toBe(403);
          expect(error.response.data.error).toContain('restricted');
        }
      });

      it('should accept null phoneNumber (validation only)', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'newuser@notallowed.com',
            password: 'ValidPassword123!',
            fullName: 'Test User',
            organizationName: 'Test Organization',
            phoneNumber: null,
          });
        } catch (error: any) {
          // Domain restriction kicks in after validation passes
          expect(error.response.status).toBe(403);
        }
      });

      it('should accept empty string phoneNumber (validation only)', async () => {
        try {
          await apiClient.post('/auth/register', {
            email: 'newuser@notallowed.com',
            password: 'ValidPassword123!',
            fullName: 'Test User',
            organizationName: 'Test Organization',
            phoneNumber: '',
          });
        } catch (error: any) {
          // Domain restriction kicks in after validation passes
          expect(error.response.status).toBe(403);
        }
      });
    });

    describe('Response format on successful registration', () => {
      // Note: We cannot test successful registration without whitelisted domain
      // This is documented for reference when testing manually with whitelisted email

      it.skip('should return 201 with user and organization on successful registration', async () => {
        // This test would need a whitelisted email domain to run
        // Expected response format:
        // {
        //   message: 'Registration successful',
        //   user: { id, email, fullName, role },
        //   organization: { id, name }
        // }
      });
    });
  });
});

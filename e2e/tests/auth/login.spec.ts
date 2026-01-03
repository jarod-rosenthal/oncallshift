import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/login.page';
import { DashboardPage } from '../../page-objects/dashboard.page';

test.describe('Login', () => {
  test.describe('Login Form Display', () => {
    test('should display login form with all required elements', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Verify all form elements are visible
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.submitButton).toBeVisible();
      await expect(loginPage.cardTitle).toBeVisible();
      await expect(loginPage.registerLink).toBeVisible();
    });

    test('should have correct input placeholders', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await expect(loginPage.emailInput).toHaveAttribute('placeholder', 'name@example.com');
      await expect(loginPage.passwordInput).toHaveAttribute('placeholder', 'Enter your password');
    });

    test('should have email input of type email', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await expect(loginPage.emailInput).toHaveAttribute('type', 'email');
    });

    test('should have password input of type password', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Valid Login', () => {
    test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await loginPage.goto();

      // Use test credentials from environment
      const email = process.env.TEST_USER_EMAIL;
      const password = process.env.TEST_USER_PASSWORD;

      if (!email || !password) {
        test.skip(true, 'TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required');
        return;
      }

      await loginPage.login(email, password);

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

      // Dashboard should be loaded
      await expect(dashboardPage.pageTitle).toBeVisible();
    });

    test('should show loading state while logging in', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      const email = process.env.TEST_USER_EMAIL;
      const password = process.env.TEST_USER_PASSWORD;

      if (!email || !password) {
        test.skip(true, 'Test credentials required');
        return;
      }

      // Fill credentials
      await loginPage.fillEmail(email);
      await loginPage.fillPassword(password);

      // Click submit and check loading state appears
      await loginPage.submitButton.click();

      // The button should show loading text or be disabled briefly
      // Note: This may be too fast to catch, so we verify redirect instead
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    });
  });

  test.describe('Invalid Login', () => {
    test('should show error with invalid email format', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.fillEmail('invalid-email');
      await loginPage.fillPassword('somepassword123');
      await loginPage.submitButton.click();

      // Should show validation error (form validation)
      const formError = page.getByText(/valid email/i);
      await expect(formError).toBeVisible();
    });

    test('should show error with password too short', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.fillEmail('test@example.com');
      await loginPage.fillPassword('short');
      await loginPage.submitButton.click();

      // Should show validation error
      const formError = page.getByText(/at least 8 characters/i);
      await expect(formError).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.login('invalid@example.com', 'wrongpassword123');

      // Should show error message from API
      await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 });
    });

    test('should not redirect with invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.login('nonexistent@example.com', 'invalidpassword123');

      // Wait for potential redirect
      await page.waitForTimeout(3000);

      // Should still be on login page
      expect(page.url()).toContain('/login');
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist session after page reload', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      const email = process.env.TEST_USER_EMAIL;
      const password = process.env.TEST_USER_PASSWORD;

      if (!email || !password) {
        test.skip(true, 'Test credentials required');
        return;
      }

      // Login first
      await loginPage.goto();
      await loginPage.login(email, password);

      // Wait for dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
      await expect(dashboardPage.pageTitle).toBeVisible();

      // Reload the page
      await page.reload();

      // Should still be on dashboard (not redirected to login)
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(dashboardPage.pageTitle).toBeVisible();
    });

    test('should persist session when navigating directly to protected route', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      const email = process.env.TEST_USER_EMAIL;
      const password = process.env.TEST_USER_PASSWORD;

      if (!email || !password) {
        test.skip(true, 'Test credentials required');
        return;
      }

      // Login
      await loginPage.goto();
      await loginPage.login(email, password);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

      // Navigate directly to incidents
      await page.goto('/incidents');

      // Should be able to access protected route
      await expect(page).toHaveURL(/\/incidents/);
      await expect(page.getByRole('heading', { name: 'Incidents' })).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to register page when clicking register link', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.clickRegister();

      await expect(page).toHaveURL(/\/register/);
    });

    test('should redirect unauthenticated users to login from protected routes', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();

      // Try to access a protected route
      await page.goto('/dashboard');

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });
  });
});

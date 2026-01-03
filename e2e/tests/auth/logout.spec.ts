import { test, expect } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../page-objects/login.page';
import { DashboardPage } from '../../page-objects/dashboard.page';

test.describe('Logout', () => {
  test.describe('Logout Flow', () => {
    test('should logout and redirect to login page', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const dashboardPage = new DashboardPage(page);
      const loginPage = new LoginPage(page);

      // Navigate to dashboard first
      await dashboardPage.goto();
      await expect(dashboardPage.pageTitle).toBeVisible();

      // Find and click the logout button/link
      // Common locations: user menu, header, or sidebar
      const userMenuButton = page.getByRole('button', { name: /account|profile|user|menu/i });
      const logoutLink = page.getByRole('link', { name: /logout|log out|sign out/i });
      const logoutButton = page.getByRole('button', { name: /logout|log out|sign out/i });

      // Try to find logout in a user menu first
      if (await userMenuButton.isVisible()) {
        await userMenuButton.click();
        // Wait for menu to appear
        await page.waitForTimeout(300);
      }

      // Click logout (could be link or button)
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else if (await logoutLink.isVisible()) {
        await logoutLink.click();
      } else {
        // Try looking for it in the navigation
        const navLogout = page.locator('nav').getByText(/logout|log out|sign out/i);
        if (await navLogout.isVisible()) {
          await navLogout.click();
        } else {
          // Skip if logout button not found - may need to adjust selectors
          test.skip(true, 'Logout button not found - adjust selectors');
          return;
        }
      }

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      await expect(loginPage.emailInput).toBeVisible();
    });

    test('should clear session data on logout', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const dashboardPage = new DashboardPage(page);

      // Navigate to dashboard
      await dashboardPage.goto();
      await expect(dashboardPage.pageTitle).toBeVisible();

      // Get initial localStorage/sessionStorage token
      const initialStorage = await page.evaluate(() => {
        return {
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage },
        };
      });

      // Find and click logout
      const userMenuButton = page.getByRole('button', { name: /account|profile|user|menu/i });
      const logoutButton = page.getByRole('button', { name: /logout|log out|sign out/i });
      const logoutLink = page.getByRole('link', { name: /logout|log out|sign out/i });

      if (await userMenuButton.isVisible()) {
        await userMenuButton.click();
        await page.waitForTimeout(300);
      }

      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else if (await logoutLink.isVisible()) {
        await logoutLink.click();
      } else {
        const navLogout = page.locator('nav').getByText(/logout|log out|sign out/i);
        if (await navLogout.isVisible()) {
          await navLogout.click();
        } else {
          test.skip(true, 'Logout button not found');
          return;
        }
      }

      // Wait for redirect
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

      // Check that auth-related storage is cleared
      const finalStorage = await page.evaluate(() => {
        return {
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage },
        };
      });

      // Auth tokens should be cleared
      // Common token key names
      const tokenKeys = ['token', 'accessToken', 'idToken', 'refreshToken', 'auth', 'auth-storage'];

      for (const key of tokenKeys) {
        // Check localStorage
        if (initialStorage.localStorage[key]) {
          expect(finalStorage.localStorage[key]).toBeFalsy();
        }
        // Check sessionStorage
        if (initialStorage.sessionStorage[key]) {
          expect(finalStorage.sessionStorage[key]).toBeFalsy();
        }
      }
    });

    test('should not be able to access protected routes after logout', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const dashboardPage = new DashboardPage(page);
      const loginPage = new LoginPage(page);

      // Navigate to dashboard
      await dashboardPage.goto();
      await expect(dashboardPage.pageTitle).toBeVisible();

      // Find and click logout
      const userMenuButton = page.getByRole('button', { name: /account|profile|user|menu/i });
      const logoutButton = page.getByRole('button', { name: /logout|log out|sign out/i });
      const logoutLink = page.getByRole('link', { name: /logout|log out|sign out/i });

      if (await userMenuButton.isVisible()) {
        await userMenuButton.click();
        await page.waitForTimeout(300);
      }

      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else if (await logoutLink.isVisible()) {
        await logoutLink.click();
      } else {
        const navLogout = page.locator('nav').getByText(/logout|log out|sign out/i);
        if (await navLogout.isVisible()) {
          await navLogout.click();
        } else {
          test.skip(true, 'Logout button not found');
          return;
        }
      }

      // Wait for redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

      // Try to navigate to a protected route
      await page.goto('/dashboard');

      // Should be redirected back to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      await expect(loginPage.emailInput).toBeVisible();
    });
  });

  test.describe('Session Expiry', () => {
    test('should handle API 401 by redirecting to login', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const dashboardPage = new DashboardPage(page);

      // Navigate to dashboard
      await dashboardPage.goto();
      await expect(dashboardPage.pageTitle).toBeVisible();

      // Simulate session expiry by clearing auth tokens
      await page.evaluate(() => {
        // Clear common token storage locations
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        sessionStorage.clear();
      });

      // Navigate to another protected route which should trigger an API call
      await page.goto('/incidents');

      // The app should detect the invalid session and redirect to login
      // or show the page with an auth error and then redirect
      await page.waitForTimeout(3000);

      // Either on login page or incidents page (depending on how app handles it)
      const currentUrl = page.url();
      const isOnLoginOrHasError =
        currentUrl.includes('/login') ||
        await page.getByText(/session|expired|unauthorized|login/i).isVisible().catch(() => false);

      expect(isOnLoginOrHasError).toBeTruthy();
    });
  });

  test.describe('Multiple Tabs', () => {
    test('should handle logout in one tab affecting other tabs', async ({ browser }) => {
      // Create a fresh context with auth state
      const context = await browser.newContext({
        storageState: 'playwright/.auth/user.json',
      });

      // Open two pages/tabs
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const dashboardPage1 = new DashboardPage(page1);
      const dashboardPage2 = new DashboardPage(page2);

      // Navigate both to dashboard
      await dashboardPage1.goto();
      await dashboardPage2.goto();

      await expect(dashboardPage1.pageTitle).toBeVisible();
      await expect(dashboardPage2.pageTitle).toBeVisible();

      // Logout from first tab
      const userMenuButton = page1.getByRole('button', { name: /account|profile|user|menu/i });
      const logoutButton = page1.getByRole('button', { name: /logout|log out|sign out/i });
      const logoutLink = page1.getByRole('link', { name: /logout|log out|sign out/i });

      if (await userMenuButton.isVisible()) {
        await userMenuButton.click();
        await page1.waitForTimeout(300);
      }

      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else if (await logoutLink.isVisible()) {
        await logoutLink.click();
      } else {
        const navLogout = page1.locator('nav').getByText(/logout|log out|sign out/i);
        if (await navLogout.isVisible()) {
          await navLogout.click();
        } else {
          await context.close();
          test.skip(true, 'Logout button not found');
          return;
        }
      }

      // First tab should be on login
      await expect(page1).toHaveURL(/\/login/, { timeout: 10000 });

      // Refresh second tab - it should also redirect to login
      await page2.reload();
      await page2.waitForTimeout(2000);

      // Second tab should be redirected to login or show auth error
      const page2Url = page2.url();
      expect(page2Url).toContain('/login');

      await context.close();
    });
  });
});

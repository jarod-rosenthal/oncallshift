import { test as base, Page } from '@playwright/test';
import * as path from 'path';

interface AuthFixtures {
  authenticatedPage: Page;
}

/**
 * Custom Playwright fixture that provides an authenticated page.
 * Uses the stored auth state from global-setup to skip login for each test.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const authStatePath = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');

    // Create a new context with the stored authentication state
    const context = await browser.newContext({
      storageState: authStatePath,
    });

    const page = await context.newPage();

    // Provide the authenticated page to the test
    await use(page);

    // Cleanup after test
    await context.close();
  },
});

export { expect } from '@playwright/test';

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig): Promise<void> {
  // Cleanup any test data if needed
  // This could include:
  // - Deleting test incidents created during tests
  // - Resetting test user state
  // - Cleaning up temporary resources

  console.log('E2E test teardown complete.');
}

export default globalTeardown;

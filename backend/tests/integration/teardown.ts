/**
 * Global Teardown for Integration Tests
 *
 * This file runs once after all integration tests complete.
 * It cleans up any test data created during the test run and logs a summary.
 */

import axios from 'axios';

interface TestDataItem {
  type: string;
  id: string;
  name?: string;
}

// Track test data created during test run
// Tests should register created data here for cleanup
const testDataToCleanup: TestDataItem[] = [];

export function registerTestData(item: TestDataItem): void {
  testDataToCleanup.push(item);
}

async function cleanupTestData(): Promise<void> {
  const token = process.env.__INTEGRATION_TEST_AUTH_TOKEN__;
  const apiBaseUrl = process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api';

  if (!token) {
    console.log('No auth token available for cleanup');
    return;
  }

  if (testDataToCleanup.length === 0) {
    console.log('No test data to clean up');
    return;
  }

  console.log(`\nCleaning up ${testDataToCleanup.length} test data items...`);

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  // Clean up in reverse order (newest first, to handle dependencies)
  const itemsToClean = [...testDataToCleanup].reverse();

  for (const item of itemsToClean) {
    try {
      let endpoint: string;

      switch (item.type) {
        case 'incident':
          endpoint = `/v1/incidents/${item.id}`;
          break;
        case 'service':
          endpoint = `/v1/services/${item.id}`;
          break;
        case 'team':
          endpoint = `/v1/teams/${item.id}`;
          break;
        case 'schedule':
          endpoint = `/v1/schedules/${item.id}`;
          break;
        case 'escalation-policy':
          endpoint = `/v1/escalation-policies/${item.id}`;
          break;
        case 'runbook':
          endpoint = `/v1/runbooks/${item.id}`;
          break;
        default:
          console.log(`  - Unknown type: ${item.type} (${item.id}) - skipping`);
          continue;
      }

      await axios.delete(`${apiBaseUrl}${endpoint}`, { headers });
      console.log(`  - Deleted ${item.type}: ${item.name || item.id}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 404 is okay - item may have been deleted by test
        if (error.response?.status === 404) {
          console.log(`  - ${item.type} ${item.id} already deleted`);
        } else {
          console.log(`  - Failed to delete ${item.type} ${item.id}: ${error.response?.status} - ${error.message}`);
        }
      } else {
        console.log(`  - Error cleaning up ${item.type} ${item.id}: ${error}`);
      }
    }
  }
}

export default async function globalTeardown(): Promise<void> {
  console.log('\n========================================');
  console.log('Integration Test Teardown');
  console.log('========================================\n');

  // Get test run stats from Jest's global state if available
  const testsFailed = process.env.JEST_TESTS_FAILED || 'unknown';
  const testsPassed = process.env.JEST_TESTS_PASSED || 'unknown';
  const testsTotal = process.env.JEST_TESTS_TOTAL || 'unknown';

  try {
    // Clean up any test data created during tests
    await cleanupTestData();

    console.log('\n----------------------------------------');
    console.log('Test Run Summary');
    console.log('----------------------------------------');
    console.log(`API Base URL: ${process.env.__INTEGRATION_TEST_API_BASE_URL__ || 'https://oncallshift.com/api'}`);
    console.log(`Test User: ${process.env.TEST_USER_EMAIL || 'unknown'}`);

    if (testsTotal !== 'unknown') {
      console.log(`Tests: ${testsPassed} passed, ${testsFailed} failed, ${testsTotal} total`);
    }

    console.log('\n========================================');
    console.log('Teardown complete');
    console.log('========================================\n');
  } catch (error) {
    console.error('Teardown error:', error);
    // Don't throw - we don't want to fail the test run during teardown
  }
}

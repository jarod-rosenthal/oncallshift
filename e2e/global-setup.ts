import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = process.env.BASE_URL || 'https://oncallshift.com';
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required');
  }

  // Create auth directory if it doesn't exist
  const authDir = path.join(__dirname, 'playwright', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(`${baseURL}/login`);

    // Wait for login form to be visible
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    // Submit the login form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard after successful login
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    // Save storage state (cookies and localStorage)
    const storageStatePath = path.join(authDir, 'user.json');
    await context.storageState({ path: storageStatePath });

    console.log('Authentication successful, storage state saved.');
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;

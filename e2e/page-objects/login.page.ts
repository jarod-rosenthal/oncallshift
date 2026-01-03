import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Login page.
 * Encapsulates all login page interactions for maintainable tests.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;
  readonly cardTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    // Use semantic locators following Playwright best practices
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /login|log in|sign in/i });
    // Error message appears in a styled div within the form
    this.errorMessage = page.locator('.text-destructive, [role="alert"]');
    this.registerLink = page.getByRole('link', { name: /register/i });
    this.cardTitle = page.getByRole('heading', { name: 'Login' });
  }

  /**
   * Navigate to the login page
   */
  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForLoad();
  }

  /**
   * Wait for the login page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await expect(this.emailInput).toBeVisible({ timeout: 10000 });
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Fill in login credentials and submit the form
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Fill only the email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill only the password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Check if the login form is displayed
   */
  async isDisplayed(): Promise<boolean> {
    return await this.emailInput.isVisible() &&
           await this.passwordInput.isVisible() &&
           await this.submitButton.isVisible();
  }

  /**
   * Get the current URL of the page
   */
  getUrl(): string {
    return this.page.url();
  }

  /**
   * Check if an error message is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get the error message text
   */
  async getErrorText(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Check if the submit button is disabled (loading state)
   */
  async isLoading(): Promise<boolean> {
    const buttonText = await this.submitButton.textContent();
    return buttonText?.includes('Logging in') || await this.submitButton.isDisabled();
  }

  /**
   * Click the register link
   */
  async clickRegister(): Promise<void> {
    await this.registerLink.click();
  }
}

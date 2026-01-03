import { Page, Locator } from '@playwright/test';

/**
 * Base page object class providing common functionality
 * for all page objects in the test suite.
 */
export class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific path within the application.
   * @param path - The path to navigate to (e.g., '/dashboard', '/incidents')
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for the page to fully load.
   * Waits for network to be idle and DOM content to be loaded.
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Get an element by its data-testid attribute.
   * @param testId - The value of the data-testid attribute
   * @returns Playwright Locator for the element
   */
  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /**
   * Get an element by its role and accessible name.
   * @param role - The ARIA role of the element
   * @param options - Options including the accessible name
   * @returns Playwright Locator for the element
   */
  getByRole(
    role: Parameters<Page['getByRole']>[0],
    options?: Parameters<Page['getByRole']>[1]
  ): Locator {
    return this.page.getByRole(role, options);
  }

  /**
   * Get an element by its visible text.
   * @param text - The text to search for
   * @param options - Options for text matching
   * @returns Playwright Locator for the element
   */
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByText(text, options);
  }

  /**
   * Get a form input by its label.
   * @param label - The label text of the input
   * @param options - Options for label matching
   * @returns Playwright Locator for the input element
   */
  getByLabel(label: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByLabel(label, options);
  }

  /**
   * Get a button or link by its placeholder text.
   * @param placeholder - The placeholder text
   * @param options - Options for placeholder matching
   * @returns Playwright Locator for the element
   */
  getByPlaceholder(placeholder: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByPlaceholder(placeholder, options);
  }

  /**
   * Wait for a specific URL pattern.
   * @param urlPattern - URL string or regex pattern to wait for
   * @param options - Wait options including timeout
   */
  async waitForURL(
    urlPattern: string | RegExp,
    options?: { timeout?: number }
  ): Promise<void> {
    await this.page.waitForURL(urlPattern, options);
  }

  /**
   * Get the current page URL.
   * @returns The current URL as a string
   */
  getCurrentURL(): string {
    return this.page.url();
  }

  /**
   * Take a screenshot of the current page.
   * @param name - Name for the screenshot file
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }
}

import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Dashboard page.
 * Encapsulates all dashboard page interactions for maintainable tests.
 */
export class DashboardPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly liveIndicator: Locator;
  readonly weeklyCalendar: Locator;
  readonly setupBanner: Locator;
  readonly startSetupButton: Locator;
  readonly dismissSetupButton: Locator;

  // Analytics Cards
  readonly mttrCard: Locator;
  readonly mttaCard: Locator;
  readonly resolutionRateCard: Locator;
  readonly openIncidentsCard: Locator;

  // Stats Cards
  readonly criticalCard: Locator;
  readonly warningCard: Locator;
  readonly triggeredCard: Locator;
  readonly resolvedCard: Locator;

  // Recent Incidents
  readonly recentIncidentsSection: Locator;
  readonly viewAllIncidentsButton: Locator;
  readonly recentIncidentItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: 'Dashboard' });
    this.liveIndicator = page.getByText(/Live/);
    this.weeklyCalendar = page.locator('[class*="WeeklyCalendar"]');
    this.setupBanner = page.locator('.bg-gradient-to-r');
    this.startSetupButton = page.getByRole('link', { name: 'Start Setup Wizard' });
    this.dismissSetupButton = page.getByRole('button', { name: 'Dismiss' });

    // Analytics Cards - by description text
    this.mttrCard = page.locator('text=Mean Time to Resolve').locator('..');
    this.mttaCard = page.locator('text=Mean Time to Acknowledge').locator('..');
    this.resolutionRateCard = page.locator('text=Resolution Rate').locator('..');
    this.openIncidentsCard = page.locator('text=Open Incidents').locator('..');

    // Stats Cards
    this.criticalCard = page.getByText('Critical').locator('..').locator('..');
    this.warningCard = page.getByText('Warning').locator('..').locator('..');
    this.triggeredCard = page.getByText('Triggered').locator('..').locator('..');
    this.resolvedCard = page.getByText('Resolved').locator('..').locator('..');

    // Recent Incidents
    this.recentIncidentsSection = page.getByRole('heading', { name: 'Recent Incidents' }).locator('..');
    this.viewAllIncidentsButton = page.getByRole('link', { name: 'View All' });
    this.recentIncidentItems = page.locator('.border.rounded-lg.hover\\:bg-accent');
  }

  /**
   * Navigate to the dashboard page
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForLoad();
  }

  /**
   * Wait for the dashboard to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await expect(this.pageTitle).toBeVisible({ timeout: 15000 });
    // Wait for live indicator which appears after data loads
    await expect(this.liveIndicator).toBeVisible({ timeout: 10000 });
  }

  /**
   * Check if the dashboard is fully loaded
   */
  async isLoaded(): Promise<boolean> {
    const titleVisible = await this.pageTitle.isVisible();
    const liveVisible = await this.liveIndicator.isVisible();
    return titleVisible && liveVisible;
  }

  /**
   * Get the count of open incidents from the dashboard card
   */
  async getOpenIncidentCount(): Promise<number> {
    const card = this.openIncidentsCard;
    const valueText = await card.locator('.text-3xl').textContent();
    return parseInt(valueText || '0', 10);
  }

  /**
   * Get the count of critical incidents
   */
  async getCriticalCount(): Promise<number> {
    const valueText = await this.criticalCard.locator('.text-3xl').textContent();
    return parseInt(valueText || '0', 10);
  }

  /**
   * Get the count of warning incidents
   */
  async getWarningCount(): Promise<number> {
    const valueText = await this.warningCard.locator('.text-3xl').textContent();
    return parseInt(valueText || '0', 10);
  }

  /**
   * Get the count of triggered incidents
   */
  async getTriggeredCount(): Promise<number> {
    const valueText = await this.triggeredCard.locator('.text-3xl').textContent();
    return parseInt(valueText || '0', 10);
  }

  /**
   * Get the count of resolved incidents
   */
  async getResolvedCount(): Promise<number> {
    const valueText = await this.resolvedCard.locator('.text-3xl').textContent();
    return parseInt(valueText || '0', 10);
  }

  /**
   * Get MTTR value as displayed text
   */
  async getMTTR(): Promise<string> {
    const card = this.mttrCard;
    const value = await card.locator('.text-3xl').textContent();
    return value?.trim() || '-';
  }

  /**
   * Get MTTA value as displayed text
   */
  async getMTTA(): Promise<string> {
    const card = this.mttaCard;
    const value = await card.locator('.text-3xl').textContent();
    return value?.trim() || '-';
  }

  /**
   * Get the resolution rate percentage
   */
  async getResolutionRate(): Promise<string> {
    const card = this.resolutionRateCard;
    const value = await card.locator('.text-3xl').textContent();
    return value?.trim() || '0%';
  }

  /**
   * Get the number of recent incidents displayed
   */
  async getRecentIncidentCount(): Promise<number> {
    return await this.recentIncidentItems.count();
  }

  /**
   * Click on a recent incident to view details
   */
  async clickRecentIncident(index: number): Promise<void> {
    await this.recentIncidentItems.nth(index).click();
  }

  /**
   * Navigate to all incidents page
   */
  async goToAllIncidents(): Promise<void> {
    await this.viewAllIncidentsButton.click();
  }

  /**
   * Check if the setup wizard banner is displayed
   */
  async hasSetupBanner(): Promise<boolean> {
    return await this.setupBanner.isVisible();
  }

  /**
   * Click the start setup wizard button
   */
  async startSetupWizard(): Promise<void> {
    await this.startSetupButton.click();
  }

  /**
   * Dismiss the setup wizard banner
   */
  async dismissSetupBanner(): Promise<void> {
    await this.dismissSetupButton.click();
  }

  /**
   * Get the last updated time text
   */
  async getLastUpdatedTime(): Promise<string> {
    const text = await this.liveIndicator.textContent();
    const match = text?.match(/Updated (.+)/);
    return match?.[1] || '';
  }

  /**
   * Wait for dashboard data to refresh
   */
  async waitForRefresh(): Promise<void> {
    const initialTime = await this.getLastUpdatedTime();
    // Dashboard refreshes every 30 seconds
    await this.page.waitForFunction(
      (initial) => {
        const text = document.body.textContent || '';
        const match = text.match(/Updated (.+)/);
        return match && match[1] !== initial;
      },
      initialTime,
      { timeout: 35000 }
    );
  }
}

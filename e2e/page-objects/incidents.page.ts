import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Incidents list page.
 * Encapsulates all incidents page interactions for maintainable tests.
 */
export class IncidentsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly createIncidentButton: Locator;
  readonly filtersButton: Locator;
  readonly loadingIndicator: Locator;
  readonly errorBanner: Locator;
  readonly emptyState: Locator;
  readonly incidentCards: Locator;
  readonly activeIncidentsSection: Locator;
  readonly resolvedIncidentsSection: Locator;

  constructor(page: Page) {
    this.page = page;
    // Use exact match to avoid ambiguity with "Active Incidents" heading
    this.pageTitle = page.getByRole('heading', { name: 'Incidents', exact: true });
    this.createIncidentButton = page.getByRole('button', { name: /create incident/i });
    this.filtersButton = page.getByRole('button', { name: /filters/i });
    this.loadingIndicator = page.getByText('Loading incidents...');
    this.errorBanner = page.locator('.text-danger, [role="alert"]');
    this.emptyState = page.locator('[class*="EmptyState"]');
    // Incident cards are in a container with specific styling
    this.incidentCards = page.locator('[class*="IncidentCard"], .border-l-4');
    // Use role selector for heading to avoid matching paragraph text
    this.activeIncidentsSection = page.getByRole('heading', { name: 'Active Incidents' });
    this.resolvedIncidentsSection = page.getByText('Recently Resolved');
  }

  /**
   * Navigate to the incidents page
   */
  async goto(): Promise<void> {
    await this.page.goto('/incidents');
    await this.waitForLoad();
  }

  /**
   * Wait for the incidents page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    // Wait for loading to finish
    await expect(this.loadingIndicator).toBeHidden({ timeout: 15000 });
    // Page should be visible
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Get the total number of incident cards displayed
   */
  async getIncidentCount(): Promise<number> {
    return await this.incidentCards.count();
  }

  /**
   * Get all incident cards
   */
  async getIncidents(): Promise<Locator[]> {
    return await this.incidentCards.all();
  }

  /**
   * Get the nth incident card (0-indexed)
   */
  getIncidentAt(index: number): Locator {
    return this.incidentCards.nth(index);
  }

  /**
   * Click on an incident card to view details
   */
  async clickIncident(index: number): Promise<void> {
    const incident = this.getIncidentAt(index);
    const viewButton = incident.getByRole('button', { name: /view/i });
    await viewButton.click();
  }

  /**
   * Get incident by its summary text
   */
  getIncidentBySummary(summary: string): Locator {
    return this.page.locator('.border-l-4').filter({ hasText: summary });
  }

  /**
   * Acknowledge the first triggered incident
   */
  async acknowledgeFirst(): Promise<void> {
    const acknowledgeButton = this.incidentCards
      .first()
      .getByRole('button', { name: 'Acknowledge' });
    await acknowledgeButton.click();
  }

  /**
   * Acknowledge incident at specific index
   */
  async acknowledgeAt(index: number): Promise<void> {
    const incident = this.getIncidentAt(index);
    const acknowledgeButton = incident.getByRole('button', { name: 'Acknowledge' });
    await acknowledgeButton.click();
  }

  /**
   * Resolve the first unresolved incident
   */
  async resolveFirst(): Promise<void> {
    const resolveButton = this.incidentCards
      .first()
      .getByRole('button', { name: 'Resolve' });
    await resolveButton.click();
  }

  /**
   * Resolve incident at specific index
   */
  async resolveAt(index: number): Promise<void> {
    const incident = this.getIncidentAt(index);
    const resolveButton = incident.getByRole('button', { name: 'Resolve' });
    await resolveButton.click();
  }

  /**
   * Escalate incident at specific index
   */
  async escalateAt(index: number): Promise<void> {
    const incident = this.getIncidentAt(index);
    const escalateButton = incident.getByRole('button', { name: 'Escalate' });
    await escalateButton.click();
  }

  /**
   * Check if there are any active incidents
   */
  async hasActiveIncidents(): Promise<boolean> {
    const emptyStateVisible = await this.emptyState.isVisible();
    return !emptyStateVisible;
  }

  /**
   * Get the state badge of an incident at index
   */
  async getIncidentState(index: number): Promise<string> {
    const incident = this.getIncidentAt(index);
    const stateBadge = incident.locator('[class*="StateBadge"], .rounded').first();
    const text = await stateBadge.textContent();
    return text?.toLowerCase().trim() || '';
  }

  /**
   * Check if the resolve modal is visible
   */
  async isResolveModalVisible(): Promise<boolean> {
    const modal = this.page.getByRole('dialog');
    return await modal.isVisible();
  }

  /**
   * Submit the resolve modal with optional note
   */
  async submitResolveModal(note?: string): Promise<void> {
    const modal = this.page.getByRole('dialog');
    if (note) {
      const noteInput = modal.getByRole('textbox');
      await noteInput.fill(note);
    }
    const resolveButton = modal.getByRole('button', { name: /resolve/i });
    await resolveButton.click();
  }

  /**
   * Cancel the resolve modal
   */
  async cancelResolveModal(): Promise<void> {
    const modal = this.page.getByRole('dialog');
    const cancelButton = modal.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
  }

  /**
   * Expand the resolved incidents section
   */
  async expandResolvedIncidents(): Promise<void> {
    const details = this.page.locator('details');
    const isOpen = await details.getAttribute('open');
    if (isOpen === null) {
      await this.resolvedIncidentsSection.click();
    }
  }

  /**
   * Check if a toast notification is visible with specific text
   */
  async hasToast(text: string): Promise<boolean> {
    const toast = this.page.getByText(text);
    return await toast.isVisible();
  }

  /**
   * Wait for toast to appear and disappear
   */
  async waitForToast(): Promise<void> {
    // Toast notifications typically appear briefly
    await this.page.waitForTimeout(500);
  }
}

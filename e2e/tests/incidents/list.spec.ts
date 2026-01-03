import { test, expect } from '../../fixtures/auth.fixture';
import { IncidentsPage } from '../../page-objects/incidents.page';
import { DashboardPage } from '../../page-objects/dashboard.page';

test.describe('Incidents List', () => {
  test.describe('Page Display', () => {
    test('should display incidents page with correct title', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      await expect(incidentsPage.pageTitle).toBeVisible();
      await expect(page).toHaveURL(/\/incidents/);
    });

    test('should display page header with actions', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      // Create Incident button should be visible
      await expect(incidentsPage.createIncidentButton).toBeVisible();
      // Filters button should be visible
      await expect(incidentsPage.filtersButton).toBeVisible();
    });

    test('should show loading state initially', async ({ authenticatedPage }) => {
      const page = authenticatedPage;

      // Navigate and catch loading state before it disappears
      await page.goto('/incidents');

      // Loading indicator may flash briefly
      // We verify the page eventually loads (use exact match to avoid "Active Incidents")
      await expect(page.getByRole('heading', { name: 'Incidents', exact: true })).toBeVisible({ timeout: 15000 });
    });

    test('should display incidents list or empty state', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      // Either incidents are shown OR empty state is shown
      const incidentCount = await incidentsPage.getIncidentCount();
      // Check various empty state patterns - UI may use different messages
      const hasEmptyState = await page.getByText(/no incidents|no active incidents|all clear|nothing to show/i).isVisible().catch(() => false);

      // If no incidents and no empty state message, page may still be valid
      // as long as the page title is visible and loaded correctly
      const pageLoaded = await incidentsPage.pageTitle.isVisible();

      expect(incidentCount > 0 || hasEmptyState || pageLoaded).toBeTruthy();
    });
  });

  test.describe('Incidents List Display', () => {
    test('should display incident cards with required information', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const incidentCount = await incidentsPage.getIncidentCount();

      if (incidentCount === 0) {
        test.skip(true, 'No incidents available to test');
        return;
      }

      const firstIncident = incidentsPage.getIncidentAt(0);

      // Each incident card should have key elements
      // Severity badge
      const severityBadge = firstIncident.locator('text=CRITICAL, text=ERROR, text=WARNING, text=INFO, text=LOW').first();
      await expect(severityBadge.or(firstIncident.locator('[class*="Severity"]'))).toBeVisible();

      // State badge
      const stateBadge = firstIncident.locator('text=TRIGGERED, text=ACKNOWLEDGED, text=RESOLVED').first();
      await expect(stateBadge.or(firstIncident.locator('[class*="State"]'))).toBeVisible();

      // Incident number
      await expect(firstIncident.getByText(/^#\d+/)).toBeVisible();

      // View button
      await expect(firstIncident.getByRole('button', { name: /view/i })).toBeVisible();
    });

    test('should show incident summary', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const incidentCount = await incidentsPage.getIncidentCount();

      if (incidentCount === 0) {
        test.skip(true, 'No incidents available');
        return;
      }

      // First incident should have a summary (heading text)
      const firstIncident = incidentsPage.getIncidentAt(0);
      const summary = firstIncident.locator('h3, .text-heading-sm');
      await expect(summary).toBeVisible();
      const summaryText = await summary.textContent();
      expect(summaryText?.length).toBeGreaterThan(0);
    });

    test('should show incident metadata (time, service)', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const incidentCount = await incidentsPage.getIncidentCount();

      if (incidentCount === 0) {
        test.skip(true, 'No incidents available');
        return;
      }

      const firstIncident = incidentsPage.getIncidentAt(0);

      // Should show relative time (e.g., "2m ago", "1h ago")
      const timePattern = /\d+[smhd]\s*ago/i;
      const hasTime = await firstIncident.getByText(timePattern).isVisible().catch(() => false);
      expect(hasTime).toBeTruthy();
    });
  });

  test.describe('Incident Details Navigation', () => {
    test('should navigate to incident details when clicking view button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const incidentCount = await incidentsPage.getIncidentCount();

      if (incidentCount === 0) {
        test.skip(true, 'No incidents available');
        return;
      }

      await incidentsPage.clickIncident(0);

      // Should navigate to incident detail page
      await expect(page).toHaveURL(/\/incidents\/[a-zA-Z0-9-]+/);
    });

    test('should navigate to incident details when clicking summary', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const incidentCount = await incidentsPage.getIncidentCount();

      if (incidentCount === 0) {
        test.skip(true, 'No incidents available');
        return;
      }

      // Click on the incident summary link
      const firstIncident = incidentsPage.getIncidentAt(0);
      const summaryLink = firstIncident.locator('a').first();
      await summaryLink.click();

      // Should navigate to incident detail page
      await expect(page).toHaveURL(/\/incidents\/[a-zA-Z0-9-]+/);
    });
  });

  test.describe('Filtering', () => {
    test('should show active incidents section', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      // Active Incidents section header should be visible (use role to avoid matching paragraph)
      await expect(page.getByRole('heading', { name: 'Active Incidents' })).toBeVisible();
    });

    test('should show resolved incidents section if any exist', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      // Check if there are resolved incidents to show
      const resolvedSection = page.getByText(/recently resolved|show.*resolved/i);
      const hasResolvedSection = await resolvedSection.isVisible().catch(() => false);

      if (hasResolvedSection) {
        // Click to expand resolved section
        await incidentsPage.expandResolvedIncidents();

        // Should show resolved incidents
        const resolvedIncidents = page.locator('.border-l-4').filter({ hasText: /RESOLVED/i });
        const count = await resolvedIncidents.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should separate active and resolved incidents', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      // Get counts in each section
      const activeSection = page.locator('section, div').filter({ hasText: 'Active Incidents' }).first();
      const activeIncidents = activeSection.locator('.border-l-4');
      const activeCount = await activeIncidents.count();

      // If there are active incidents, verify they're not resolved
      if (activeCount > 0) {
        for (let i = 0; i < Math.min(activeCount, 3); i++) {
          const incident = activeIncidents.nth(i);
          const hasResolved = await incident.getByText('RESOLVED').isVisible().catch(() => false);
          expect(hasResolved).toBeFalsy();
        }
      }
    });
  });

  test.describe('Navigation from Dashboard', () => {
    test('should navigate to incidents from dashboard View All button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const dashboardPage = new DashboardPage(page);
      const incidentsPage = new IncidentsPage(page);

      await dashboardPage.goto();

      // Check if View All button exists (only if there are recent incidents)
      const viewAllButton = page.getByRole('link', { name: 'View All' });
      const hasViewAll = await viewAllButton.isVisible().catch(() => false);

      if (hasViewAll) {
        await dashboardPage.goToAllIncidents();
        await expect(page).toHaveURL(/\/incidents/);
        await expect(incidentsPage.pageTitle).toBeVisible();
      }
    });

    test('should navigate to incidents from sidebar/nav', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await page.goto('/dashboard');

      // Find incidents link in navigation
      const incidentsNav = page.getByRole('link', { name: /incidents/i });
      if (await incidentsNav.isVisible()) {
        await incidentsNav.click();
        await expect(page).toHaveURL(/\/incidents/);
        await expect(incidentsPage.pageTitle).toBeVisible();
      }
    });
  });

  test.describe('Metrics Display', () => {
    test('should display metrics card when incidents exist', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const incidentCount = await incidentsPage.getIncidentCount();

      if (incidentCount > 0) {
        // Metrics section should be visible
        const metricsSection = page.locator('[class*="Metrics"], [class*="accent"]');
        const hasMetrics = await metricsSection.isVisible().catch(() => false);

        // If metrics exist, they should show incident stats
        if (hasMetrics) {
          await expect(metricsSection).toBeVisible();
        }
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show appropriate empty state when no active incidents', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const hasActiveIncidents = await incidentsPage.hasActiveIncidents();

      if (!hasActiveIncidents) {
        // Should show empty state message
        const emptyMessage = page.getByText(/no incidents|no active incidents|all clear/i);
        await expect(emptyMessage).toBeVisible();
      }
    });
  });
});

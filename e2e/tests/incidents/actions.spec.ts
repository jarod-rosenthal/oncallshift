import { test, expect } from '../../fixtures/auth.fixture';
import { IncidentsPage } from '../../page-objects/incidents.page';

test.describe('Incident Actions', () => {
  // Helper to find a triggered incident
  async function findTriggeredIncident(incidentsPage: IncidentsPage): Promise<number> {
    const count = await incidentsPage.getIncidentCount();
    for (let i = 0; i < count; i++) {
      const incident = incidentsPage.getIncidentAt(i);
      const isTriggered = await incident.getByText('TRIGGERED').isVisible().catch(() => false);
      if (isTriggered) {
        return i;
      }
    }
    return -1;
  }

  // Helper to find an unresolved incident
  async function findUnresolvedIncident(incidentsPage: IncidentsPage): Promise<number> {
    const count = await incidentsPage.getIncidentCount();
    for (let i = 0; i < count; i++) {
      const incident = incidentsPage.getIncidentAt(i);
      const isResolved = await incident.getByText('RESOLVED').isVisible().catch(() => false);
      if (!isResolved) {
        return i;
      }
    }
    return -1;
  }

  test.describe('Acknowledge Incident', () => {
    test('should show acknowledge button for triggered incidents', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const triggeredIndex = await findTriggeredIncident(incidentsPage);

      if (triggeredIndex === -1) {
        test.skip(true, 'No triggered incidents available to test');
        return;
      }

      const incident = incidentsPage.getIncidentAt(triggeredIndex);
      const acknowledgeButton = incident.getByRole('button', { name: 'Acknowledge' });

      await expect(acknowledgeButton).toBeVisible();
    });

    test('should acknowledge incident when clicking acknowledge button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const triggeredIndex = await findTriggeredIncident(incidentsPage);

      if (triggeredIndex === -1) {
        test.skip(true, 'No triggered incidents available');
        return;
      }

      // Get the incident number before acknowledging for verification
      const incident = incidentsPage.getIncidentAt(triggeredIndex);
      const incidentNumberText = await incident.getByText(/^#\d+/).textContent();

      // Click acknowledge
      await incidentsPage.acknowledgeAt(triggeredIndex);

      // Wait for the action to complete
      await page.waitForTimeout(1000);

      // Verify state changed (look for toast or state badge change)
      // The incident should now show ACKNOWLEDGED instead of TRIGGERED
      await page.waitForTimeout(500);

      // Re-find the incident and check its state
      // Note: The page may reload or update in place
      const updatedIncident = incidentsPage.page.locator('.border-l-4').filter({ hasText: incidentNumberText || '' });
      if (await updatedIncident.isVisible()) {
        const acknowledgedBadge = updatedIncident.getByText('ACKNOWLEDGED');
        const wasAcknowledged = await acknowledgedBadge.isVisible().catch(() => false);

        // Either the incident is now acknowledged or a toast appeared
        const hasToast = await page.getByText(/acknowledged|success/i).isVisible().catch(() => false);
        expect(wasAcknowledged || hasToast).toBeTruthy();
      }
    });

    test('should not show acknowledge button for already acknowledged incidents', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const count = await incidentsPage.getIncidentCount();

      // Find an acknowledged incident
      for (let i = 0; i < count; i++) {
        const incident = incidentsPage.getIncidentAt(i);
        const isAcknowledged = await incident.getByText('ACKNOWLEDGED').isVisible().catch(() => false);

        if (isAcknowledged) {
          // Acknowledge button should NOT be visible
          const acknowledgeButton = incident.getByRole('button', { name: 'Acknowledge' });
          await expect(acknowledgeButton).not.toBeVisible();
          return;
        }
      }

      test.skip(true, 'No acknowledged incidents to verify');
    });
  });

  test.describe('Resolve Incident', () => {
    test('should show resolve button for unresolved incidents', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const unresolvedIndex = await findUnresolvedIncident(incidentsPage);

      if (unresolvedIndex === -1) {
        test.skip(true, 'No unresolved incidents available');
        return;
      }

      const incident = incidentsPage.getIncidentAt(unresolvedIndex);
      const resolveButton = incident.getByRole('button', { name: 'Resolve' });

      await expect(resolveButton).toBeVisible();
    });

    test('should open resolve modal when clicking resolve button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const unresolvedIndex = await findUnresolvedIncident(incidentsPage);

      if (unresolvedIndex === -1) {
        test.skip(true, 'No unresolved incidents available');
        return;
      }

      // Click resolve
      await incidentsPage.resolveAt(unresolvedIndex);

      // Resolve modal should appear
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Modal should have resolve-related content
      const modalTitle = modal.getByText(/resolve/i);
      await expect(modalTitle).toBeVisible();
    });

    test('should resolve incident when submitting resolve modal', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const unresolvedIndex = await findUnresolvedIncident(incidentsPage);

      if (unresolvedIndex === -1) {
        test.skip(true, 'No unresolved incidents available');
        return;
      }

      // Get incident info before resolving
      const incident = incidentsPage.getIncidentAt(unresolvedIndex);
      const incidentNumberText = await incident.getByText(/^#\d+/).textContent();

      // Click resolve
      await incidentsPage.resolveAt(unresolvedIndex);

      // Wait for modal
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Submit resolve modal (with optional note)
      await incidentsPage.submitResolveModal('Resolved via E2E test');

      // Wait for action to complete
      await page.waitForTimeout(1500);

      // Verify resolution
      // The incident should either move to resolved section or show success toast
      const hasToast = await page.getByText(/resolved|success/i).isVisible().catch(() => false);

      // Or check if confetti appeared (the app triggers confetti on resolve)
      const hasConfetti = await page.locator('canvas').isVisible().catch(() => false);

      expect(hasToast || hasConfetti).toBeTruthy();
    });

    test('should cancel resolve when clicking cancel in modal', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const unresolvedIndex = await findUnresolvedIncident(incidentsPage);

      if (unresolvedIndex === -1) {
        test.skip(true, 'No unresolved incidents available');
        return;
      }

      // Click resolve to open modal
      await incidentsPage.resolveAt(unresolvedIndex);

      // Wait for modal
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Cancel
      await incidentsPage.cancelResolveModal();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Incident should still be unresolved
      const incident = incidentsPage.getIncidentAt(unresolvedIndex);
      const isResolved = await incident.getByText('RESOLVED').isVisible().catch(() => false);
      expect(isResolved).toBeFalsy();
    });

    test('should not show resolve button for already resolved incidents', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      // Expand resolved section if it exists
      const resolvedSection = page.getByText(/recently resolved|show.*resolved/i);
      if (await resolvedSection.isVisible()) {
        await incidentsPage.expandResolvedIncidents();
        await page.waitForTimeout(500);
      }

      // Find a resolved incident
      const resolvedIncidents = page.locator('.border-l-4').filter({ hasText: 'RESOLVED' });
      const count = await resolvedIncidents.count();

      if (count > 0) {
        const resolvedIncident = resolvedIncidents.first();
        const resolveButton = resolvedIncident.getByRole('button', { name: 'Resolve' });
        await expect(resolveButton).not.toBeVisible();
      } else {
        test.skip(true, 'No resolved incidents to verify');
      }
    });
  });

  test.describe('Escalate Incident', () => {
    test('should show escalate button for triggered incidents', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const triggeredIndex = await findTriggeredIncident(incidentsPage);

      if (triggeredIndex === -1) {
        test.skip(true, 'No triggered incidents available');
        return;
      }

      const incident = incidentsPage.getIncidentAt(triggeredIndex);
      const escalateButton = incident.getByRole('button', { name: 'Escalate' });

      await expect(escalateButton).toBeVisible();
    });

    test('should open escalate dialog when clicking escalate button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const triggeredIndex = await findTriggeredIncident(incidentsPage);

      if (triggeredIndex === -1) {
        test.skip(true, 'No triggered incidents available');
        return;
      }

      // Click escalate
      await incidentsPage.escalateAt(triggeredIndex);

      // Dialog should appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Dialog should have escalate-related content
      const dialogTitle = dialog.getByText(/escalate/i);
      await expect(dialogTitle).toBeVisible();
    });

    test('should close escalate dialog when clicking cancel', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const triggeredIndex = await findTriggeredIncident(incidentsPage);

      if (triggeredIndex === -1) {
        test.skip(true, 'No triggered incidents available');
        return;
      }

      // Click escalate
      await incidentsPage.escalateAt(triggeredIndex);

      // Dialog should appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Cancel
      const cancelButton = dialog.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('Toast Notifications', () => {
    test('should show success toast after acknowledging', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const triggeredIndex = await findTriggeredIncident(incidentsPage);

      if (triggeredIndex === -1) {
        test.skip(true, 'No triggered incidents available');
        return;
      }

      // Acknowledge
      await incidentsPage.acknowledgeAt(triggeredIndex);

      // Toast should appear
      const toast = page.getByText(/acknowledged|success/i);
      await expect(toast).toBeVisible({ timeout: 5000 });
    });

    test('should show success toast after resolving', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const unresolvedIndex = await findUnresolvedIncident(incidentsPage);

      if (unresolvedIndex === -1) {
        test.skip(true, 'No unresolved incidents available');
        return;
      }

      // Resolve
      await incidentsPage.resolveAt(unresolvedIndex);

      // Submit modal
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await incidentsPage.submitResolveModal();

      // Toast should appear
      await page.waitForTimeout(1000);
      const toast = page.getByText(/resolved|success/i);
      await expect(toast).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Action Confirmation', () => {
    test('should update incident state in UI after acknowledge', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const triggeredIndex = await findTriggeredIncident(incidentsPage);

      if (triggeredIndex === -1) {
        test.skip(true, 'No triggered incidents available');
        return;
      }

      // Get incident identifier
      const incident = incidentsPage.getIncidentAt(triggeredIndex);
      const incidentNumber = await incident.getByText(/^#\d+/).textContent();

      // Acknowledge
      await incidentsPage.acknowledgeAt(triggeredIndex);

      // Wait for update
      await page.waitForTimeout(1500);

      // Find the incident again by number and verify state
      if (incidentNumber) {
        const updatedIncident = page.locator('.border-l-4').filter({ hasText: incidentNumber });
        if (await updatedIncident.isVisible()) {
          const acknowledgedBadge = updatedIncident.getByText('ACKNOWLEDGED');
          await expect(acknowledgedBadge).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should move incident to resolved section after resolve', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const incidentsPage = new IncidentsPage(page);

      await incidentsPage.goto();

      const unresolvedIndex = await findUnresolvedIncident(incidentsPage);

      if (unresolvedIndex === -1) {
        test.skip(true, 'No unresolved incidents available');
        return;
      }

      // Get incident identifier
      const incident = incidentsPage.getIncidentAt(unresolvedIndex);
      const incidentNumber = await incident.getByText(/^#\d+/).textContent();

      // Resolve
      await incidentsPage.resolveAt(unresolvedIndex);
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await incidentsPage.submitResolveModal();

      // Wait for update
      await page.waitForTimeout(2000);

      // The incident should now be in the resolved section or show RESOLVED badge
      if (incidentNumber) {
        // Check in resolved section (may need to expand)
        const resolvedSection = page.getByText(/recently resolved|show.*resolved/i);
        if (await resolvedSection.isVisible()) {
          await incidentsPage.expandResolvedIncidents();
        }

        // Find the incident and verify it shows RESOLVED
        const resolvedIncident = page.locator('.border-l-4').filter({ hasText: incidentNumber });
        if (await resolvedIncident.isVisible()) {
          const resolvedBadge = resolvedIncident.getByText('RESOLVED');
          await expect(resolvedBadge).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});

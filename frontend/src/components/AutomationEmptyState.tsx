/**
 * AutomationEmptyState Component
 *
 * Displays a message when no automated runbooks are available for a service.
 * This component is extracted from RunbookAutomationPanel for better composition.
 */

interface AutomationEmptyStateProps {
  serviceId: string;
}

export function AutomationEmptyState({ serviceId }: AutomationEmptyStateProps) {
  return (
    <div className="text-center py-4 text-muted-foreground">
      <p className="text-sm">No automated runbooks found for this service.</p>
      <p className="text-xs mt-1">Service ID: {serviceId}</p>
    </div>
  );
}

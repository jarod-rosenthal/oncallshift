/**
 * AutomationErrorDisplay Component
 *
 * Displays error messages that occur during runbook automation.
 * This component is extracted from RunbookAutomationPanel for better composition.
 */

interface AutomationErrorDisplayProps {
  error: string | null;
}

export function AutomationErrorDisplay({ error }: AutomationErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
      {error}
    </div>
  );
}

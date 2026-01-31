/**
 * RunbookPreview Component
 *
 * Displays a preview of the selected runbook including title, description, and steps list.
 * Highlights which steps are automated. This component is extracted from RunbookAutomationPanel
 * for better composition.
 */

interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type?: string;
}

interface RunbookPreviewProps {
  title: string;
  description?: string | null;
  steps: RunbookStep[];
}

export function RunbookPreview({
  title,
  description,
  steps,
}: RunbookPreviewProps) {
  return (
    <div className="mb-4 p-3 bg-muted rounded-lg">
      <h4 className="font-medium mb-2">{title}</h4>
      {description && (
        <p className="text-sm text-muted-foreground mb-3">
          {description}
        </p>
      )}
      <div className="space-y-1">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{idx + 1}.</span>
            <span>{step.title}</span>
            {step.type === 'automated' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                Automated
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

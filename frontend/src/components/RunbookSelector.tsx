/**
 * RunbookSelector Component
 *
 * Displays a dropdown selector for choosing which runbook to execute.
 * This component is extracted from RunbookAutomationPanel for better composition.
 */

interface RunbookOption {
  id: string;
  title: string;
}

interface RunbookSelectorProps<T extends RunbookOption> {
  runbooks: T[];
  selectedId: string | null;
  onChange: (runbook: T | null) => void;
}

export function RunbookSelector<T extends RunbookOption>({
  runbooks,
  selectedId,
  onChange,
}: RunbookSelectorProps<T>) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2">
        Select Runbook
      </label>
      <select
        value={selectedId || ''}
        onChange={(e) => {
          const rb = runbooks.find(r => r.id === e.target.value);
          onChange(rb || null);
        }}
        className="w-full px-3 py-2 border rounded-lg bg-background"
      >
        {runbooks.map(rb => (
          <option key={rb.id} value={rb.id}>
            {rb.title}
          </option>
        ))}
      </select>
    </div>
  );
}

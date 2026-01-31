/**
 * AutomationStartButton Component
 *
 * Button to start runbook automation execution with loading state.
 * This component is extracted from RunbookAutomationPanel for better composition.
 */

import { Button } from './ui/button';
import { Play, RefreshCw } from 'lucide-react';

interface AutomationStartButtonProps {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export function AutomationStartButton({
  disabled,
  isLoading,
  onClick,
}: AutomationStartButtonProps) {
  return (
    <>
      <Button
        onClick={onClick}
        disabled={disabled || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Execute Runbook
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        Automated steps will execute sequentially with approval gates
      </p>
    </>
  );
}

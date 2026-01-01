import { CheckCircle, AlertTriangle, ArrowUpCircle, MessageSquare, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';

type IncidentState = 'triggered' | 'acknowledged' | 'resolved';

interface StickyActionBarProps {
  state: IncidentState;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  onEscalate?: () => void;
  onAddNote?: () => void;
  onMoreActions?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function StickyActionBar({
  state,
  onAcknowledge,
  onResolve,
  onEscalate,
  onAddNote,
  onMoreActions,
  isLoading = false,
  className = '',
}: StickyActionBarProps) {
  // Don't show for resolved incidents
  if (state === 'resolved') {
    return null;
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left side - Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                state === 'triggered' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-sm font-medium text-muted-foreground capitalize">
              {state}
            </span>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {/* Add Note - always available */}
            {onAddNote && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddNote}
                disabled={isLoading}
                className="hidden sm:flex"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Note
              </Button>
            )}

            {/* Escalate - for triggered incidents */}
            {state === 'triggered' && onEscalate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEscalate}
                disabled={isLoading}
                className="hidden sm:flex"
              >
                <ArrowUpCircle className="h-4 w-4 mr-1" />
                Escalate
              </Button>
            )}

            {/* Acknowledge - only for triggered incidents */}
            {state === 'triggered' && onAcknowledge && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onAcknowledge}
                disabled={isLoading}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-200"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Acknowledge
              </Button>
            )}

            {/* Resolve - for triggered or acknowledged */}
            {onResolve && (
              <Button
                size="sm"
                onClick={onResolve}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Resolve
              </Button>
            )}

            {/* More actions - mobile */}
            {onMoreActions && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoreActions}
                disabled={isLoading}
                className="sm:hidden"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Spacer component to prevent content from being hidden behind sticky bar
export function StickyActionBarSpacer() {
  return <div className="h-16" />;
}

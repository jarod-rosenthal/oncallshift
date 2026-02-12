import { Link } from 'react-router-dom';
import { Clock, User, Server, ChevronRight, BellOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSeverityBorderColor } from '../../lib/colors';
import { Button } from '../ui/button';
import { SeverityBadge } from './SeverityBadge';
import { StateBadge } from './StateBadge';
import type { IncidentCardProps } from '../types';

/**
 * IncidentCard component for displaying a single incident
 *
 * Features:
 * - Severity-colored left border
 * - Severity and state badges
 * - Incident metadata (time, assignee, service)
 * - Action buttons (acknowledge, resolve)
 * - Click to view details
 *
 * @example
 * <IncidentCard
 *   incident={incident}
 *   onAcknowledge={() => handleAcknowledge(incident.id)}
 *   onResolve={() => handleResolve(incident.id)}
 * />
 */
export function IncidentCard({
  incident,
  onAcknowledge,
  onResolve,
  onEscalate,
  readOnly = false,
  className,
}: IncidentCardProps) {
  const severityBorder = getSeverityBorderColor(incident.severity);

  return (
    <div
      className={cn(
        'bg-card border border-neutral-300 rounded-lg shadow-sm hover:shadow-md transition-shadow',
        'border-l-4',
        severityBorder,
        className
      )}
    >
      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Incident info */}
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center flex-wrap gap-2 mb-3">
              <SeverityBadge severity={incident.severity} size="sm" />
              <StateBadge state={incident.state} size="sm" />
              <span className="text-body-sm text-neutral-500">
                #{incident.incidentNumber}
              </span>
              {incident.currentEscalationStep > 0 && (
                <span className="text-body-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  Step {incident.currentEscalationStep}
                </span>
              )}
              {incident.snoozedUntil && new Date(incident.snoozedUntil) > new Date() && (
                <span className="flex items-center gap-1 text-body-xs text-purple-700 bg-purple-100 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded">
                  <BellOff className="w-3 h-3" />
                  Snoozed
                </span>
              )}
            </div>

            {/* Title */}
            <Link
              to={`/incidents/${incident.id}`}
              className="block group"
            >
              <h3 className="text-heading-sm text-neutral-900 group-hover:text-primary transition-colors line-clamp-2">
                {incident.summary}
              </h3>
            </Link>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-body-sm text-neutral-600">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span>{formatRelativeTime(incident.triggeredAt)}</span>
              </div>
              {incident.assignedTo && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-neutral-400" />
                  <span>{incident.assignedTo.fullName || incident.assignedTo.email}</span>
                </div>
              )}
              {incident.service && (
                <div className="flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-neutral-400" />
                  <span>{incident.service.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!readOnly && incident.state === 'triggered' && onAcknowledge && (
              <Button variant="outline" size="sm" onClick={onAcknowledge}>
                Acknowledge
              </Button>
            )}
            {!readOnly && incident.state === 'triggered' && onEscalate && (
              <Button variant="outline" size="sm" onClick={onEscalate}>
                Escalate
              </Button>
            )}
            {!readOnly && incident.state !== 'resolved' && onResolve && (
              <Button variant="success" size="sm" onClick={onResolve}>
                Resolve
              </Button>
            )}
            <Link to={`/incidents/${incident.id}`}>
              <Button variant="ghost" size="sm" className="gap-1">
                View
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Format a timestamp as relative time (e.g., "2 min ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default IncidentCard;

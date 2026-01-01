import { TrendingUp, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import type { Incident } from '../../types/api';

interface MetricsCardProps {
  incidents: Incident[];
  className?: string;
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

function MetricItem({ icon, label, value, color }: MetricItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 ${color}`}>{icon}</div>
      <div>
        <p className="text-body-sm text-neutral-600">{label}</p>
        <p className="text-heading-lg text-neutral-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/**
 * MetricsCard component for displaying incident statistics
 *
 * Shows:
 * - Open incident count
 * - Average time to acknowledge (MTTA)
 * - Average time to resolve (MTTR)
 * - Resolved count (last 24h)
 *
 * @example
 * <MetricsCard incidents={incidents} />
 */
export function MetricsCard({ incidents, className }: MetricsCardProps) {
  const openCount = incidents.filter(i => i.state !== 'resolved').length;
  const resolvedCount = incidents.filter(i => i.state === 'resolved').length;
  const avgMTTA = calculateMTTA(incidents);
  const avgMTTR = calculateMTTR(incidents);

  return (
    <div className={`bg-card border border-neutral-300 rounded-lg p-6 shadow-sm ${className || ''}`}>
      <h3 className="text-heading-md text-neutral-900 mb-6">Metrics Overview</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricItem
          icon={<AlertCircle className="w-5 h-5" />}
          label="Open Incidents"
          value={openCount.toString()}
          color={openCount > 0 ? 'text-danger' : 'text-success'}
        />
        <MetricItem
          icon={<Clock className="w-5 h-5" />}
          label="Avg. Time to Ack"
          value={avgMTTA}
          color="text-primary"
        />
        <MetricItem
          icon={<TrendingUp className="w-5 h-5" />}
          label="Avg. Time to Resolve"
          value={avgMTTR}
          color="text-success"
        />
        <MetricItem
          icon={<CheckCircle className="w-5 h-5" />}
          label="Resolved (24h)"
          value={resolvedCount.toString()}
          color="text-success"
        />
      </div>
    </div>
  );
}

/**
 * Calculate Mean Time to Acknowledge
 */
function calculateMTTA(incidents: Incident[]): string {
  const acknowledged = incidents.filter(i => i.acknowledgedAt);
  if (acknowledged.length === 0) return 'N/A';

  const totalSeconds = acknowledged.reduce((sum, inc) => {
    const ackTime = new Date(inc.acknowledgedAt!).getTime();
    const createTime = new Date(inc.triggeredAt).getTime();
    return sum + (ackTime - createTime) / 1000;
  }, 0);

  const avgSeconds = totalSeconds / acknowledged.length;
  return formatDuration(avgSeconds);
}

/**
 * Calculate Mean Time to Resolve
 */
function calculateMTTR(incidents: Incident[]): string {
  const resolved = incidents.filter(i => i.resolvedAt);
  if (resolved.length === 0) return 'N/A';

  const totalSeconds = resolved.reduce((sum, inc) => {
    const resolveTime = new Date(inc.resolvedAt!).getTime();
    const createTime = new Date(inc.triggeredAt).getTime();
    return sum + (resolveTime - createTime) / 1000;
  }, 0);

  const avgSeconds = totalSeconds / resolved.length;
  return formatDuration(avgSeconds);
}

/**
 * Format seconds as human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export default MetricsCard;

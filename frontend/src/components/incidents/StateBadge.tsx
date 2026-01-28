import { AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getStateBadgeColor, getStateLabel } from '../../lib/colors';
import type { StateBadgeProps } from '../types';

const iconMap = {
  triggered: AlertCircle,
  acknowledged: Clock,
  resolved: CheckCircle,
} as const;

/**
 * StateBadge component for displaying incident state
 *
 * @example
 * <StateBadge state="triggered" />
 * <StateBadge state="resolved" size="sm" />
 */
export function StateBadge({
  state,
  size = 'md',
  showIcon = true,
  className,
}: StateBadgeProps) {
  const Icon = iconMap[state as keyof typeof iconMap] || AlertCircle;
  const colors = getStateBadgeColor(state);
  const label = getStateLabel(state);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border rounded-md',
        colors,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {label}
    </span>
  );
}

export default StateBadge;

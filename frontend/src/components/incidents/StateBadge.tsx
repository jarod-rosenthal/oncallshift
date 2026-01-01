import { AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StateBadgeProps {
  state: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const stateConfig = {
  triggered: {
    icon: AlertCircle,
    label: 'Triggered',
    colors: 'bg-danger/10 text-danger border-danger/20',
  },
  acknowledged: {
    icon: Clock,
    label: 'Acknowledged',
    colors: 'bg-warning/10 text-warning border-warning/20',
  },
  resolved: {
    icon: CheckCircle,
    label: 'Resolved',
    colors: 'bg-success/10 text-success border-success/20',
  },
};

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
  const config = stateConfig[state as keyof typeof stateConfig] || stateConfig.triggered;
  const Icon = config.icon;

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
        config.colors,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );
}

export default StateBadge;

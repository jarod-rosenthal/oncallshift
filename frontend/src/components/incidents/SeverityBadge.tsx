import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    label: 'Critical',
    colors: 'bg-danger/10 text-danger border-danger/20',
  },
  error: {
    icon: AlertTriangle,
    label: 'Error',
    colors: 'bg-warning/10 text-warning border-warning/20',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    colors: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  },
  info: {
    icon: Info,
    label: 'Info',
    colors: 'bg-primary/10 text-primary border-primary/20',
  },
  low: {
    icon: Info,
    label: 'Low',
    colors: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  },
};

/**
 * SeverityBadge component for displaying incident severity
 *
 * @example
 * <SeverityBadge severity="critical" />
 * <SeverityBadge severity="warning" size="sm" showIcon={false} />
 */
export function SeverityBadge({
  severity,
  size = 'md',
  showIcon = true,
  className,
}: SeverityBadgeProps) {
  const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;
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

export default SeverityBadge;

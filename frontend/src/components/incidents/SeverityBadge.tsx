import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSeverityBadgeColor, getSeverityLabel } from '../../lib/colors';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const iconMap = {
  critical: AlertCircle,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  low: Info,
} as const;

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
  const Icon = iconMap[severity as keyof typeof iconMap] || Info;
  const colors = getSeverityBadgeColor(severity);
  const label = getSeverityLabel(severity);

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

export default SeverityBadge;

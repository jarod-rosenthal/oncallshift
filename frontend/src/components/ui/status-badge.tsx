import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
  {
    variants: {
      variant: {
        triggered: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        acknowledged: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        sev1: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        sev2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        sev3: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        sev4: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        primary: 'bg-primary/10 text-primary',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5',
        default: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'default',
    },
  }
);

// Status dot component for inline indicators
const statusDotVariants = cva('rounded-full', {
  variants: {
    variant: {
      triggered: 'bg-red-500',
      acknowledged: 'bg-yellow-500',
      resolved: 'bg-green-500',
      sev1: 'bg-red-500',
      sev2: 'bg-amber-500',
      sev3: 'bg-yellow-500',
      sev4: 'bg-blue-500',
      info: 'bg-blue-500',
      warning: 'bg-amber-500',
      error: 'bg-red-500',
      success: 'bg-green-500',
      neutral: 'bg-gray-500',
      primary: 'bg-primary',
      online: 'bg-green-500',
      offline: 'bg-gray-400',
    },
    size: {
      sm: 'w-1.5 h-1.5',
      default: 'w-2 h-2',
      lg: 'w-2.5 h-2.5',
    },
    pulse: {
      true: 'animate-pulse',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'neutral',
    size: 'default',
    pulse: false,
  },
});

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean;
  dotPulse?: boolean;
}

export function StatusBadge({
  className,
  variant,
  size,
  showDot = false,
  dotPulse = false,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant, size }), className)} {...props}>
      {showDot && (
        <span
          className={cn(
            statusDotVariants({
              variant,
              size: size === 'lg' ? 'default' : 'sm',
              pulse: dotPulse,
            })
          )}
        />
      )}
      {children}
    </span>
  );
}

interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusDotVariants> {}

export function StatusDot({ className, variant, size, pulse, ...props }: StatusDotProps) {
  return <span className={cn(statusDotVariants({ variant, size, pulse }), className)} {...props} />;
}

// Convenience components for common statuses
export function TriggeredBadge({ children = 'Triggered', ...props }: Omit<StatusBadgeProps, 'variant'>) {
  return (
    <StatusBadge variant="triggered" showDot {...props}>
      {children}
    </StatusBadge>
  );
}

export function AcknowledgedBadge({ children = 'Acknowledged', ...props }: Omit<StatusBadgeProps, 'variant'>) {
  return (
    <StatusBadge variant="acknowledged" showDot {...props}>
      {children}
    </StatusBadge>
  );
}

export function ResolvedBadge({ children = 'Resolved', ...props }: Omit<StatusBadgeProps, 'variant'>) {
  return (
    <StatusBadge variant="resolved" showDot {...props}>
      {children}
    </StatusBadge>
  );
}

export function SeverityBadge({
  severity,
  ...props
}: Omit<StatusBadgeProps, 'variant' | 'children'> & { severity: 'critical' | 'high' | 'medium' | 'low' | 1 | 2 | 3 | 4 }) {
  const variantMap: Record<string | number, VariantProps<typeof statusBadgeVariants>['variant']> = {
    critical: 'sev1',
    high: 'sev2',
    medium: 'sev3',
    low: 'sev4',
    1: 'sev1',
    2: 'sev2',
    3: 'sev3',
    4: 'sev4',
  };

  const labelMap: Record<string | number, string> = {
    critical: 'SEV1',
    high: 'SEV2',
    medium: 'SEV3',
    low: 'SEV4',
    1: 'SEV1',
    2: 'SEV2',
    3: 'SEV3',
    4: 'SEV4',
  };

  return (
    <StatusBadge variant={variantMap[severity]} showDot {...props}>
      {labelMap[severity]}
    </StatusBadge>
  );
}

export default StatusBadge;

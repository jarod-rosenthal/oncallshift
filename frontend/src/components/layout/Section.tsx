import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface SectionProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  variant?: 'default' | 'accent' | 'gradient' | 'card';
  className?: string;
  innerClassName?: string;
  titleClassName?: string;
  action?: ReactNode;
}

/**
 * Section component for consistent content sections
 *
 * Variants:
 * - default: Standard background
 * - accent: Slightly lighter background for visual separation
 * - gradient: Hero-style gradient background
 * - card: White card with border
 *
 * @example
 * <Section title="Active Incidents" subtitle="Incidents requiring attention">
 *   <IncidentList />
 * </Section>
 *
 * @example
 * <Section variant="card" title="Metrics">
 *   <MetricsCard />
 * </Section>
 */
export function Section({
  title,
  subtitle,
  children,
  variant = 'default',
  className,
  innerClassName,
  titleClassName,
  action,
}: SectionProps) {
  const variantClasses = {
    default: 'bg-background',
    accent: 'bg-neutral-50',
    gradient: 'gradient-hero',
    card: 'bg-card border border-neutral-300 rounded-lg shadow-sm',
  };

  const paddingClasses = variant === 'card' ? 'p-6' : 'py-8 lg:py-12';

  return (
    <section className={cn(paddingClasses, variantClasses[variant], className)}>
      <div className={cn(
        variant !== 'card' && 'max-w-7xl mx-auto px-6 lg:px-10',
        innerClassName
      )}>
        {/* Section header */}
        {(title || action) && (
          <div className={cn(
            'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6',
            titleClassName
          )}>
            <div>
              {title && (
                <h2 className="text-heading-lg text-neutral-900 font-semibold">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-body-md text-neutral-600 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {action && (
              <div className="flex-shrink-0">
                {action}
              </div>
            )}
          </div>
        )}

        {/* Section content */}
        {children}
      </div>
    </section>
  );
}

export default Section;

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline';
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  breadcrumb?: {
    label: string;
    href: string;
  };
  className?: string;
  children?: ReactNode;
}

/**
 * PageHeader component for consistent page headers
 *
 * Features:
 * - Title and optional subtitle
 * - Optional breadcrumb navigation
 * - Primary and secondary action buttons
 * - Responsive layout (stacks on mobile)
 *
 * @example
 * <PageHeader
 *   title="Incidents"
 *   subtitle="Monitor and manage all incidents"
 *   breadcrumb={{ label: "Dashboard", href: "/dashboard" }}
 *   primaryAction={{
 *     label: "Create Incident",
 *     onClick: () => {},
 *     icon: <Plus className="w-4 h-4" />
 *   }}
 * />
 */
export function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  breadcrumb,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn('border-b border-neutral-300 bg-card', className)}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 lg:py-8">
        {/* Breadcrumb */}
        {breadcrumb && (
          <Link
            to={breadcrumb.href}
            className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600 hover:text-neutral-900 mb-4 transition-colors no-underline"
          >
            <ChevronLeft className="w-4 h-4" />
            {breadcrumb.label}
          </Link>
        )}

        {/* Header content */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
          {/* Title section */}
          <div className="flex-1 min-w-0">
            <h1 className="text-heading-xl text-neutral-900 font-semibold truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-body-lg text-neutral-600 mt-1.5">
                {subtitle}
              </p>
            )}
          </div>

          {/* Actions */}
          {(primaryAction || secondaryActions) && (
            <div className="flex flex-wrap items-center gap-3">
              {secondaryActions?.map((action, idx) => (
                <Button
                  key={idx}
                  variant={action.variant || 'outline'}
                  onClick={action.onClick}
                  className="gap-2"
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
              {primaryAction && (
                <Button
                  variant={primaryAction.variant || 'default'}
                  onClick={primaryAction.onClick}
                  className="gap-2"
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Optional children (tabs, filters, etc.) */}
        {children && (
          <div className="mt-6">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;

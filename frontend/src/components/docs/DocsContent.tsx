import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Breadcrumb {
  label: string;
  href: string;
}

interface DocsContentProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  lastUpdated?: string;
  children: ReactNode;
}

export function DocsContent({
  title,
  description,
  breadcrumbs = [],
  lastUpdated,
  children,
}: DocsContentProps) {
  return (
    <article className="flex-1 min-w-0 max-w-3xl">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href || index} className="flex items-center gap-2">
              {index > 0 && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {title}
        </h1>
        {description && (
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}
        {lastUpdated && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
            Last updated: {lastUpdated}
          </p>
        )}
      </header>

      {/* Content */}
      <div className="prose prose-slate dark:prose-invert max-w-none
        prose-headings:scroll-mt-20
        prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-10 prose-h2:mb-4
        prose-h3:text-lg prose-h3:font-medium prose-h3:mt-8 prose-h3:mb-3
        prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-p:mb-4
        prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-code:text-sm prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-slate-900 prose-pre:text-slate-100
        prose-ul:my-4 prose-li:my-1
        prose-img:rounded-lg prose-img:shadow-sm
      ">
        {children}
      </div>
    </article>
  );
}

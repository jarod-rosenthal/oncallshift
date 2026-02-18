import { Link } from 'react-router-dom';

interface RelatedPage {
  title: string;
  href: string;
  description?: string;
}

interface RelatedPagesProps {
  pages: RelatedPage[];
  title?: string;
}

export function RelatedPages({ pages, title = 'Related articles' }: RelatedPagesProps) {
  if (pages.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-white/5">
      <h3 className="text-lg font-semibold text-white mb-4">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {pages.map((page) => (
          <Link
            key={page.href}
            to={page.href}
            className="group block p-4 rounded-lg border border-white/5 hover:border-teal-500/30 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-white group-hover:text-teal-400">
                {page.title}
              </span>
              <svg className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            {page.description && (
              <p className="mt-1 text-sm text-slate-500">
                {page.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

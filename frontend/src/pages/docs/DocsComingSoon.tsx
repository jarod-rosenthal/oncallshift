import { useLocation } from 'react-router-dom';
import { DocsLayout, docsNav } from '../../components/docs';
import { Card, CardContent } from '../../components/ui/card';

export function DocsComingSoon() {
  const location = useLocation();

  // Extract a readable title from the path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName = pathParts[pathParts.length - 1] || 'page';
  const sectionName = pathParts.length > 2 ? pathParts[pathParts.length - 2] : null;

  const formatName = (name: string) =>
    name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  return (
    <DocsLayout navigation={docsNav} variant="docs">
      <div className="max-w-2xl">
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 text-2xl">
                🚧
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {formatName(pageName)}
                </h1>
                {sectionName && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                    {formatName(sectionName)} section
                  </p>
                )}
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  This documentation page is coming soon. We're working hard to bring you comprehensive guides and tutorials.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="/docs"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Docs Home
                  </a>
                  <a
                    href="/company/contact"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Contact us for help
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Looking for something specific?
          </h2>
          <ul className="space-y-3">
            <li>
              <a
                href="/docs/getting-started/quick-start"
                className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Start Guide - Get up and running in 5 minutes
              </a>
            </li>
            <li>
              <a
                href="/api-docs"
                className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                API Reference - Interactive API documentation
              </a>
            </li>
            <li>
              <a
                href="/help"
                className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Help Center - Common questions and troubleshooting
              </a>
            </li>
          </ul>
        </div>
      </div>
    </DocsLayout>
  );
}

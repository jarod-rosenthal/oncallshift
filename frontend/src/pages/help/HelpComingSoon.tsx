import { useLocation } from 'react-router-dom';
import { DocsLayout, helpNav } from '../../components/docs';

export function HelpComingSoon() {
  const location = useLocation();

  // Extract a readable title from the path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName = pathParts[pathParts.length - 1] || 'page';
  const sectionName = pathParts.length > 2 ? pathParts[pathParts.length - 2] : null;

  const formatName = (name: string) =>
    name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  // Special handling for contact page
  const isContactPage = location.pathname.includes('/contact');

  if (isContactPage) {
    return (
      <DocsLayout navigation={helpNav} variant="help">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-white mb-6">
            Contact Support
          </h1>

          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  Email Us
                </h2>
                <p className="text-slate-300 mb-3">
                  Have a question or need help? Our team typically responds within 24 hours.
                </p>
                <a
                  href="mailto:support@oncallshift.com"
                  className="inline-flex items-center gap-2 text-teal-400 font-medium hover:underline"
                >
                  support@oncallshift.com
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  Browse Documentation
                </h2>
                <p className="text-slate-300 mb-3">
                  Find answers in our technical documentation and guides.
                </p>
                <a
                  href="/docs"
                  className="inline-flex items-center gap-2 text-teal-400 font-medium hover:underline"
                >
                  View Documentation
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </DocsLayout>
    );
  }

  return (
    <DocsLayout navigation={helpNav} variant="help">
      <div className="max-w-2xl">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0 text-2xl">
              ?
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white mb-2">
                {formatName(pageName)}
              </h1>
              {sectionName && (
                <p className="text-sm text-slate-500 mb-3">
                  {formatName(sectionName)} section
                </p>
              )}
              <p className="text-slate-300 mb-4">
                This help article is coming soon. We're working on creating comprehensive guides to help you get the most out of OnCallShift.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/help"
                  className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Help Center
                </a>
                <a
                  href="/help/contact"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Contact support
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-white/[0.02] rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">
            Popular help articles
          </h2>
          <ul className="space-y-3">
            <li>
              <a
                href="/help/getting-started/first-steps"
                className="flex items-center gap-3 text-sm text-slate-300 hover:text-teal-400"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                First Steps - Get started with OnCallShift
              </a>
            </li>
            <li>
              <a
                href="/docs"
                className="flex items-center gap-3 text-sm text-slate-300 hover:text-teal-400"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Documentation - Technical guides and reference
              </a>
            </li>
            <li>
              <a
                href="/help/contact"
                className="flex items-center gap-3 text-sm text-slate-300 hover:text-teal-400"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Contact Support - Get help from our team
              </a>
            </li>
          </ul>
        </div>
      </div>
    </DocsLayout>
  );
}

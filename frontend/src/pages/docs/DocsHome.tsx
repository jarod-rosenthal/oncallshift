import { Link } from 'react-router-dom';
import { DocsLayout, docsNav } from '../../components/docs';

const categories = [
  {
    title: 'Getting Started',
    description: 'Set up OnCallShift in 5 minutes',
    href: '/docs/getting-started/quick-start',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Core Concepts',
    description: 'Understand incidents, schedules, and escalations',
    href: '/docs/concepts/incidents',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: 'Integrations',
    description: 'Connect Slack, webhooks, and more',
    href: '/docs/integrations',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    title: 'AI Features',
    description: 'Leverage AI for incident diagnosis',
    href: '/docs/ai',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: 'API Reference',
    description: 'Build integrations with our REST API',
    href: '/docs/api',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    title: 'Migration',
    description: 'Switch from PagerDuty or Opsgenie',
    href: '/docs/migration/opsgenie',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
];

const popularArticles = [
  { title: 'Quick Start Guide', href: '/docs/getting-started/quick-start' },
  { title: 'Setting Up Slack Integration', href: '/docs/integrations/slack' },
  { title: 'Understanding Escalation Policies', href: '/docs/concepts/escalation' },
  { title: 'AI Diagnosis Setup', href: '/docs/ai/diagnosis' },
  { title: 'API Authentication', href: '/docs/api/authentication' },
  { title: 'Migrating from Opsgenie', href: '/docs/migration/opsgenie' },
];

export function DocsHome() {
  return (
    <DocsLayout navigation={docsNav} variant="docs">
      <div className="max-w-4xl">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-4">
            OnCallShift Documentation
          </h1>
          <p className="text-lg text-slate-400">
            Everything you need to set up, configure, and master OnCallShift for your team.
          </p>
        </div>

        {/* Category Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {categories.map((category) => (
            <Link key={category.href} to={category.href}>
              <div className="h-full rounded-xl border border-white/5 bg-white/[0.03] p-5 hover:border-teal-500/30 hover:bg-white/[0.05] transition-all">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
                  {category.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{category.title}</h3>
                <p className="text-sm text-slate-400">
                  {category.description}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Popular Articles */}
        <div className="bg-white/[0.02] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Popular articles
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {popularArticles.map((article) => (
              <Link
                key={article.href}
                to={article.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors text-sm text-slate-300 hover:text-teal-400"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {article.title}
              </Link>
            ))}
          </div>
        </div>

        {/* API Docs Link */}
        <div className="mt-8 p-6 border border-white/5 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">
                Interactive API Reference
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                Explore our full API with interactive examples and try requests in real-time.
              </p>
              <a
                href="/api-docs"
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:underline"
              >
                Open API Docs
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  );
}

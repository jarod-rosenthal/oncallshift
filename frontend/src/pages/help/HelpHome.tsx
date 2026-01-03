import { Link } from 'react-router-dom';
import { DocsLayout, helpNav } from '../../components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const categories = [
  {
    title: 'Getting Started',
    description: 'New to OnCallShift? Start here.',
    href: '/help/getting-started/first-steps',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Incidents',
    description: 'Acknowledge, resolve, and escalate incidents',
    href: '/help/incidents',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    title: 'Schedules',
    description: 'Set up rotations and manage overrides',
    href: '/help/schedules',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Account Settings',
    description: 'Manage notifications and preferences',
    href: '/help/account',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const quickLinks = [
  { title: 'How do I acknowledge an incident?', href: '/help/incidents/acknowledge' },
  { title: 'How do I set up my first schedule?', href: '/help/getting-started/first-schedule' },
  { title: 'How do I invite team members?', href: '/help/getting-started/invite-team' },
  { title: 'How do I configure notifications?', href: '/help/account/notifications' },
];

const troubleshootingTopics = [
  { title: "I'm not receiving notifications", href: '/help/troubleshooting#notifications' },
  { title: 'My schedule is not showing correctly', href: '/help/troubleshooting#schedules' },
  { title: 'Incidents are not being created', href: '/help/troubleshooting#incidents' },
];

export function HelpHome() {
  return (
    <DocsLayout navigation={helpNav} variant="help">
      <div className="max-w-4xl">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            How can we help?
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Find answers, guides, and solutions to get the most out of OnCallShift.
          </p>
        </div>

        {/* Category Cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-12">
          {categories.map((category) => (
            <Link key={category.href} to={category.href}>
              <Card className="h-full hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                <CardHeader className="pb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 flex items-center justify-center mb-2">
                    {category.icon}
                  </div>
                  <CardTitle className="text-base">{category.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {category.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Common questions
            </h2>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/help/faq"
              className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all FAQs
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Troubleshooting
            </h2>
            <ul className="space-y-2">
              {troubleshootingTopics.map((topic) => (
                <li key={topic.href}>
                  <Link
                    to={topic.href}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {topic.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/help/troubleshooting"
              className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View troubleshooting guide
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Contact Support */}
        <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Still need help?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <Link
                to="/help/contact"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Contact support
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  );
}

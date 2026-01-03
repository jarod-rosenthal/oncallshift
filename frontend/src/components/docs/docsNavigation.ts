// Navigation structure for Documentation and Help Center

export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const docsNav: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Quick Start', href: '/docs/getting-started/quick-start' },
      { title: 'Account Setup', href: '/docs/getting-started/account' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      { title: 'Incidents', href: '/docs/concepts/incidents' },
      { title: 'Schedules', href: '/docs/concepts/schedules' },
      { title: 'Escalation Policies', href: '/docs/concepts/escalation' },
      { title: 'Services', href: '/docs/concepts/services' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { title: 'Overview', href: '/docs/integrations' },
      { title: 'Slack', href: '/docs/integrations/slack' },
      { title: 'Webhooks', href: '/docs/integrations/webhooks' },
    ],
  },
  {
    title: 'AI Features',
    items: [
      { title: 'Overview', href: '/docs/ai' },
      { title: 'AI Diagnosis', href: '/docs/ai/diagnosis' },
      { title: 'Runbooks', href: '/docs/ai/runbooks' },
      { title: 'Bring Your Own Key', href: '/docs/ai/byok' },
      { title: 'MCP Server', href: '/docs/ai/mcp' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'Overview', href: '/docs/api' },
      { title: 'Authentication', href: '/docs/api/authentication' },
      { title: 'Incidents API', href: '/docs/api/incidents' },
      { title: 'Webhooks API', href: '/docs/api/webhooks' },
    ],
  },
  {
    title: 'Infrastructure as Code',
    items: [
      { title: 'Terraform Provider', href: '/docs/iac/terraform' },
    ],
  },
  {
    title: 'Migration',
    items: [
      { title: 'From Opsgenie', href: '/docs/migration/opsgenie' },
      { title: 'From PagerDuty', href: '/docs/migration/pagerduty' },
    ],
  },
];

export const helpNav: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'First Steps', href: '/help/getting-started/first-steps' },
      { title: 'Invite Your Team', href: '/help/getting-started/invite-team' },
      { title: 'Create First Service', href: '/help/getting-started/first-service' },
      { title: 'Set Up Schedules', href: '/help/getting-started/first-schedule' },
    ],
  },
  {
    title: 'Incidents',
    items: [
      { title: 'Overview', href: '/help/incidents' },
      { title: 'Acknowledging', href: '/help/incidents/acknowledge' },
      { title: 'Resolving', href: '/help/incidents/resolve' },
      { title: 'Escalating', href: '/help/incidents/escalate' },
    ],
  },
  {
    title: 'Schedules',
    items: [
      { title: 'Overview', href: '/help/schedules' },
      { title: 'Rotations', href: '/help/schedules/rotations' },
      { title: 'Overrides', href: '/help/schedules/overrides' },
    ],
  },
  {
    title: 'Account',
    items: [
      { title: 'Settings', href: '/help/account' },
      { title: 'Notifications', href: '/help/account/notifications' },
    ],
  },
  {
    title: 'Support',
    items: [
      { title: 'FAQ', href: '/help/faq' },
      { title: 'Troubleshooting', href: '/help/troubleshooting' },
      { title: 'Contact Us', href: '/help/contact' },
    ],
  },
];

// Helper function to find current section and item
export function findCurrentNavItem(
  pathname: string,
  nav: NavSection[]
): { section: NavSection | null; item: NavItem | null } {
  for (const section of nav) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return { section, item };
      }
    }
  }
  return { section: null, item: null };
}

// Generate breadcrumbs from current path
export function generateBreadcrumbs(
  pathname: string,
  nav: NavSection[],
  rootLabel: string,
  rootHref: string
): Array<{ label: string; href: string }> {
  const breadcrumbs = [{ label: rootLabel, href: rootHref }];
  const { section, item } = findCurrentNavItem(pathname, nav);

  if (section) {
    // Add section as breadcrumb (no link - it's a category)
    breadcrumbs.push({ label: section.title, href: '' });
  }

  if (item) {
    breadcrumbs.push({ label: item.title, href: item.href });
  }

  return breadcrumbs;
}

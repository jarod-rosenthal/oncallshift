import { Link } from 'react-router-dom';
import {
  DocsLayout,
  DocsContent,
  Callout,
  Step,
  RelatedPages,
  FeedbackWidget,
  docsNav,
} from '../../components/docs';

export function DocsQuickStart() {
  return (
    <DocsLayout navigation={docsNav} variant="docs">
      <DocsContent
        title="Quick Start Guide"
        description="Get OnCallShift up and running in 5 minutes"
        breadcrumbs={[
          { label: 'Docs', href: '/docs' },
          { label: 'Getting Started', href: '' },
          { label: 'Quick Start', href: '/docs/getting-started/quick-start' },
        ]}
        lastUpdated="January 2, 2026"
      >
        <p>
          Welcome to OnCallShift! This guide will walk you through setting up your account,
          creating your first service, and configuring on-call schedules for your team.
        </p>

        <Callout type="tip" title="Before you begin">
          Make sure you have admin access to your organization's OnCallShift account.
          If you're the first user, you'll automatically have admin privileges.
        </Callout>

        <h2>Step-by-Step Setup</h2>

        <Step number={1} title="Create your account">
          <p>
            Join the waitlist at <a href="https://oncallshift.com/register" className="text-teal-400 hover:underline">oncallshift.com/register</a> with
            your work email. We'll notify you when early access is available.
          </p>
          <p className="mt-2">
            If your organization already uses OnCallShift, ask an admin to invite you instead.
          </p>
        </Step>

        <Step number={2} title="Set up your organization">
          <p>
            After logging in for the first time, you'll be prompted to complete the setup wizard.
            This includes:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Naming your organization</li>
            <li>Inviting team members</li>
            <li>Setting your timezone</li>
          </ul>
        </Step>

        <Step number={3} title="Create your first service">
          <p>
            Services represent the applications or infrastructure components your team is
            responsible for. To create a service:
          </p>
          <ol className="list-decimal ml-6 mt-2 space-y-1">
            <li>Navigate to <strong>Configure &rarr; Services</strong></li>
            <li>Click <strong>Create Service</strong></li>
            <li>Enter a name and description</li>
            <li>Select an escalation policy (you can create one in the next step)</li>
          </ol>
        </Step>

        <Step number={4} title="Configure escalation policies">
          <p>
            Escalation policies define who gets notified and when. A simple policy might look like:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li><strong>Level 1:</strong> Notify the on-call engineer (wait 5 minutes)</li>
            <li><strong>Level 2:</strong> Notify the team lead (wait 10 minutes)</li>
            <li><strong>Level 3:</strong> Notify the entire team</li>
          </ul>
        </Step>

        <Step number={5} title="Set up on-call schedules">
          <p>
            Create schedules to automatically rotate who's on-call. Navigate to{' '}
            <strong>People &rarr; Schedules</strong> and create a new schedule with:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Rotation type (daily, weekly, custom)</li>
            <li>Team members in the rotation</li>
            <li>Handoff time and timezone</li>
          </ul>
        </Step>

        <Step number={6} title="Connect your monitoring tools">
          <p>
            Set up integrations to automatically create incidents from your monitoring tools.
            Go to <strong>Settings &rarr; Integrations</strong> and follow the setup guide for:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Prometheus/Alertmanager</li>
            <li>Datadog</li>
            <li>CloudWatch</li>
            <li>Custom webhooks</li>
          </ul>
        </Step>

        <Callout type="info">
          <p>
            <strong>Need to migrate from another platform?</strong> Check out our{' '}
            <Link to="/docs/migration/opsgenie" className="text-teal-400 hover:underline">
              migration guides
            </Link>{' '}
            for PagerDuty and Opsgenie.
          </p>
        </Callout>

        <h2>What's Next?</h2>

        <p>
          Now that you have the basics set up, explore these features to get the most out of
          OnCallShift:
        </p>

        <ul className="list-disc ml-6 space-y-2">
          <li>
            <Link to="/docs/ai" className="text-teal-400 hover:underline">
              <strong>AI Diagnosis</strong>
            </Link>{' '}
            -- Let AI analyze incidents and suggest resolutions
          </li>
          <li>
            <Link to="/docs/ai/runbooks" className="text-teal-400 hover:underline">
              <strong>Runbooks</strong>
            </Link>{' '}
            -- Automate incident response with step-by-step procedures
          </li>
          <li>
            <Link to="/docs/integrations/slack" className="text-teal-400 hover:underline">
              <strong>Slack Integration</strong>
            </Link>{' '}
            -- Manage incidents directly from Slack
          </li>
        </ul>

        <RelatedPages
          pages={[
            {
              title: 'Account Setup',
              href: '/docs/getting-started/account',
              description: 'Configure your organization settings',
            },
            {
              title: 'Understanding Incidents',
              href: '/docs/concepts/incidents',
              description: 'Learn about the incident lifecycle',
            },
            {
              title: 'Creating Schedules',
              href: '/docs/concepts/schedules',
              description: 'Set up on-call rotations',
            },
          ]}
        />

        <FeedbackWidget pageId="docs-quick-start" />
      </DocsContent>
    </DocsLayout>
  );
}

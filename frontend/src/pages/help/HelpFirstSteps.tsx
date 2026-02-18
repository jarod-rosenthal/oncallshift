import { Link } from 'react-router-dom';
import {
  DocsLayout,
  DocsContent,
  Callout,
  Step,
  RelatedPages,
  FeedbackWidget,
  helpNav,
} from '../../components/docs';

export function HelpFirstSteps() {
  return (
    <DocsLayout navigation={helpNav} variant="help">
      <DocsContent
        title="First Steps"
        description="Your guide to getting started with OnCallShift"
        breadcrumbs={[
          { label: 'Help', href: '/help' },
          { label: 'Getting Started', href: '' },
          { label: 'First Steps', href: '/help/getting-started/first-steps' },
        ]}
        lastUpdated="January 2, 2026"
      >
        <p>
          Welcome to OnCallShift! Whether you've just signed up or been invited to join your
          team, this guide will help you get oriented and start using the platform effectively.
        </p>

        <h2>Logging In</h2>

        <p>
          After receiving your invitation email, click the link to set your password. Once
          you've done that, you can log in at{' '}
          <a href="https://oncallshift.com/login" className="text-teal-400 hover:underline">
            oncallshift.com/login
          </a>
          .
        </p>

        <Callout type="tip" title="Bookmark the Dashboard">
          The dashboard is your home base. Consider bookmarking{' '}
          <strong>oncallshift.com/dashboard</strong> for quick access.
        </Callout>

        <h2>Understanding the Dashboard</h2>

        <p>When you first log in, you'll see the dashboard with several key sections:</p>

        <ul className="list-disc ml-6 space-y-2 mt-4">
          <li>
            <strong>Active Incidents</strong> -- Any ongoing incidents that need attention
          </li>
          <li>
            <strong>Your On-Call Status</strong> -- Whether you're currently on-call
          </li>
          <li>
            <strong>Upcoming Shifts</strong> -- Your scheduled on-call shifts
          </li>
          <li>
            <strong>Recent Activity</strong> -- What's been happening in your organization
          </li>
        </ul>

        <h2>Setting Up Your Profile</h2>

        <Step number={1} title="Add your contact information">
          <p>
            Navigate to your profile (click your avatar in the bottom left) and make sure your:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Phone number is correct for SMS notifications</li>
            <li>Email is up to date</li>
            <li>Timezone matches your location</li>
          </ul>
        </Step>

        <Step number={2} title="Configure notifications">
          <p>
            Go to <strong>Notification Preferences</strong> to set up how you want to be
            contacted during incidents. You can configure:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Push notifications (mobile app)</li>
            <li>SMS messages</li>
            <li>Email alerts</li>
            <li>Phone calls for critical incidents</li>
          </ul>
        </Step>

        <Step number={3} title="Install the mobile app">
          <p>
            Download the OnCallShift app for{' '}
            <a href="#" className="text-teal-400 hover:underline">iOS</a> or{' '}
            <a href="#" className="text-teal-400 hover:underline">Android</a>. The mobile app
            lets you:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Receive push notifications</li>
            <li>Acknowledge and resolve incidents</li>
            <li>Use AI diagnosis on the go</li>
            <li>View your schedule</li>
          </ul>
        </Step>

        <Callout type="warning" title="Test your notifications">
          After setting up your contact methods, ask your admin to send a test notification
          to make sure everything works before you go on-call.
        </Callout>

        <h2>Your First On-Call Shift</h2>

        <p>
          When you're on-call and an incident comes in, you'll be notified through your
          configured channels. Here's what to do:
        </p>

        <ol className="list-decimal ml-6 space-y-3 mt-4">
          <li>
            <strong>Acknowledge the incident</strong> -- This stops escalation and lets your
            team know you're on it
          </li>
          <li>
            <strong>Investigate the issue</strong> -- Check the incident details, view AI
            diagnosis if available
          </li>
          <li>
            <strong>Take action</strong> -- Follow runbooks, execute fixes, or escalate if
            needed
          </li>
          <li>
            <strong>Resolve the incident</strong> -- Once the issue is fixed, resolve it and
            add notes
          </li>
        </ol>

        <h2>Getting Help</h2>

        <p>If you need assistance:</p>

        <ul className="list-disc ml-6 space-y-2">
          <li>
            Check the <Link to="/help/faq" className="text-teal-400 hover:underline">FAQ</Link>{' '}
            for common questions
          </li>
          <li>
            Visit our{' '}
            <Link to="/help/troubleshooting" className="text-teal-400 hover:underline">
              Troubleshooting guide
            </Link>{' '}
            for known issues
          </li>
          <li>
            <Link to="/help/contact" className="text-teal-400 hover:underline">
              Contact support
            </Link>{' '}
            for personalized help
          </li>
        </ul>

        <RelatedPages
          pages={[
            {
              title: 'Invite Your Team',
              href: '/help/getting-started/invite-team',
              description: 'Add team members to OnCallShift',
            },
            {
              title: 'Acknowledging Incidents',
              href: '/help/incidents/acknowledge',
              description: 'How to acknowledge and respond to incidents',
            },
            {
              title: 'Notification Preferences',
              href: '/help/account/notifications',
              description: 'Configure how you receive alerts',
            },
          ]}
        />

        <FeedbackWidget pageId="help-first-steps" />
      </DocsContent>
    </DocsLayout>
  );
}

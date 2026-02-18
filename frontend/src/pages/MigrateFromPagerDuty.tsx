import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function MigrateFromPagerDuty() {
  const migrationSteps = [
    {
      step: 1,
      title: 'Export from PagerDuty',
      description: 'Download your users, schedules, services, and escalation policies from PagerDuty.',
      details: [
        'Go to People > Users > Export CSV',
        'Go to Services > Export (if available)',
        'Document your escalation policies manually',
        'List all monitoring tool integrations',
      ],
    },
    {
      step: 2,
      title: 'Set up OnCallShift',
      description: 'Create your organization and configure the basics.',
      details: [
        'Sign up at oncallshift.com/register',
        'Run the setup wizard',
        'Import users via CSV or add manually',
        'Configure notification preferences',
      ],
    },
    {
      step: 3,
      title: 'Recreate schedules',
      description: 'Build your on-call schedules in OnCallShift.',
      details: [
        'Create schedules matching your rotation patterns',
        'Add team members to each schedule',
        'Set handoff times and coverage',
        'Test with the schedule preview',
      ],
    },
    {
      step: 4,
      title: 'Configure escalation policies',
      description: 'Set up your escalation chains.',
      details: [
        'Create policies for each service/team',
        'Configure escalation steps and timeouts',
        'Link schedules to escalation steps',
        'Add fallback contacts',
      ],
    },
    {
      step: 5,
      title: 'Update integrations',
      description: 'Point your monitoring tools to OnCallShift.',
      details: [
        'Replace PagerDuty webhook URLs with OnCallShift',
        'Our endpoint accepts PagerDuty Events API v2 format',
        'Test each integration with a test alert',
        'Verify notifications are received',
      ],
    },
  ];

  const integrationExamples = [
    {
      tool: 'Datadog',
      before: 'https://events.pagerduty.com/integration/YOUR_KEY/enqueue',
      after: 'https://api.oncallshift.com/webhooks/pagerduty/YOUR_SERVICE_KEY',
    },
    {
      tool: 'Prometheus Alertmanager',
      before: 'url: https://events.pagerduty.com/v2/enqueue',
      after: 'url: https://api.oncallshift.com/webhooks/pagerduty',
    },
    {
      tool: 'Grafana',
      before: 'Integration Key: YOUR_PAGERDUTY_KEY',
      after: 'Webhook URL: https://api.oncallshift.com/webhooks/generic/YOUR_SERVICE_KEY',
    },
  ];

  const whatWeImport = [
    { item: 'Users', status: 'supported', note: 'Via CSV export' },
    { item: 'Teams', status: 'supported', note: 'Manual recreation' },
    { item: 'Services', status: 'supported', note: 'Manual recreation' },
    { item: 'Schedules', status: 'partial', note: 'Basic patterns supported' },
    { item: 'Escalation policies', status: 'supported', note: 'Manual recreation' },
    { item: 'Incident history', status: 'not-supported', note: 'Fresh start' },
    { item: 'Integrations', status: 'supported', note: 'URL change only' },
  ];

  return (
    <div className="relative">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          Migrate from PagerDuty to OnCallShift
        </h1>
        <p className="text-xl text-slate-400 mb-8 max-w-3xl mx-auto">
          Complete migration guide to switch from PagerDuty while keeping your monitoring integrations working.
          Most teams complete the migration in under 2 hours.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950">
              Start Migration
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">
              View Demo First
            </Button>
          </Link>
        </div>
      </section>

      {/* Key benefit */}
      <section className="bg-green-500/5 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg">
            <span className="font-semibold text-green-400">Zero-downtime migration:</span>{' '}
            <span className="text-slate-400">
              Our PagerDuty-compatible webhook accepts the same JSON format. Just change the URL.
            </span>
          </p>
        </div>
      </section>

      {/* Migration Steps */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4 text-white">Migration Steps</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Follow these steps to migrate your incident management from PagerDuty to OnCallShift.
        </p>

        <div className="max-w-3xl mx-auto space-y-6">
          {migrationSteps.map((step) => (
            <Card key={step.step} className="border border-white/5 bg-white/[0.03]">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-teal-500/10 rounded-full flex items-center justify-center">
                    <span className="text-teal-400 font-bold">{step.step}</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">{step.title}</CardTitle>
                    <p className="text-sm text-slate-400 mt-1">{step.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-18">
                <ul className="space-y-2 ml-14">
                  {step.details.map((detail, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Integration Examples */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4 text-white">Integration URL Changes</h2>
          <p className="text-slate-400 text-center mb-8 max-w-2xl mx-auto">
            Here's how to update common monitoring tools. The payload format stays the same.
          </p>

          <div className="max-w-4xl mx-auto space-y-6">
            {integrationExamples.map((example, i) => (
              <Card key={i} className="border border-white/5 bg-white/[0.03]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">{example.tool}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="bg-red-500/5 p-3 rounded border border-red-500/10">
                      <p className="text-xs text-red-400 font-medium mb-1">Before (PagerDuty):</p>
                      <code className="text-sm text-slate-300 break-all">{example.before}</code>
                    </div>
                    <div className="bg-green-500/5 p-3 rounded border border-green-500/10">
                      <p className="text-xs text-green-400 font-medium mb-1">After (OnCallShift):</p>
                      <code className="text-sm text-slate-300 break-all">{example.after}</code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-slate-500">
              Don't see your tool? Contact support and we'll help you migrate.
            </p>
          </div>
        </div>
      </section>

      {/* What We Import */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4 text-white">Migration Checklist</h2>
        <p className="text-slate-400 text-center mb-8 max-w-2xl mx-auto">
          What you can bring over from PagerDuty.
        </p>

        <div className="max-w-2xl mx-auto">
          <Card className="border border-white/5 bg-white/[0.03]">
            <CardContent className="pt-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="pb-3 font-medium text-white">Item</th>
                    <th className="pb-3 font-medium text-center text-white">Status</th>
                    <th className="pb-3 font-medium text-white">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {whatWeImport.map((item, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-b-0">
                      <td className="py-3 text-slate-300">{item.item}</td>
                      <td className="py-3 text-center">
                        {item.status === 'supported' && (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <span>✓</span> Supported
                          </span>
                        )}
                        {item.status === 'partial' && (
                          <span className="inline-flex items-center gap-1 text-yellow-400">
                            <span>~</span> Partial
                          </span>
                        )}
                        {item.status === 'not-supported' && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <span>—</span> N/A
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-400">{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* API Compatibility */}
      <section className="bg-teal-500/5 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4 text-white">PagerDuty API Compatibility</h2>
          <p className="text-slate-400 text-center mb-8 max-w-2xl mx-auto">
            Our webhook endpoint speaks the same language as PagerDuty Events API v2.
          </p>

          <div className="max-w-3xl mx-auto bg-white/[0.03] rounded-lg p-6 border border-white/5">
            <h3 className="font-semibold mb-4 text-white">Supported Event Types</h3>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-500/5 p-4 rounded text-center border border-green-500/20">
                <p className="font-mono text-sm text-green-400">trigger</p>
                <p className="text-xs text-slate-500 mt-1">Create incident</p>
              </div>
              <div className="bg-green-500/5 p-4 rounded text-center border border-green-500/20">
                <p className="font-mono text-sm text-green-400">acknowledge</p>
                <p className="text-xs text-slate-500 mt-1">Ack incident</p>
              </div>
              <div className="bg-green-500/5 p-4 rounded text-center border border-green-500/20">
                <p className="font-mono text-sm text-green-400">resolve</p>
                <p className="text-xs text-slate-500 mt-1">Close incident</p>
              </div>
            </div>

            <h3 className="font-semibold mb-4 text-white">Example Payload</h3>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded text-sm overflow-x-auto border border-white/5">
{`{
  "routing_key": "YOUR_SERVICE_KEY",
  "event_action": "trigger",
  "dedup_key": "unique-alert-id",
  "payload": {
    "summary": "CPU usage above 90%",
    "severity": "critical",
    "source": "monitoring.example.com"
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-white">Migration FAQ</h2>

        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-white">Can I run both systems during migration?</h3>
            <p className="text-slate-400 text-sm">
              Yes. Many teams configure their monitoring tools to send to both PagerDuty and OnCallShift
              during a transition period. Once you're confident, disable PagerDuty.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-white">What about my PagerDuty mobile app?</h3>
            <p className="text-slate-400 text-sm">
              OnCallShift has native iOS and Android apps with push notifications.
              Download them from the App Store or Google Play after signing up.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-white">Do you support PagerDuty's REST API?</h3>
            <p className="text-slate-400 text-sm">
              We support the Events API v2 (webhook ingestion). REST API compatibility for
              reading incidents/schedules programmatically uses OnCallShift's own API format.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-white">How do I handle complex schedule rotations?</h3>
            <p className="text-slate-400 text-sm">
              OnCallShift supports weekly rotations, custom handoff times, and schedule overrides.
              If you have complex multi-layer schedules, contact support and we'll help you set them up.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-white">Is there downtime during migration?</h3>
            <p className="text-slate-400 text-sm">
              No. Since you're just changing webhook URLs, alerts continue flowing.
              You can migrate one service at a time if you prefer a gradual rollout.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-teal-500 to-cyan-500 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-slate-950">Ready to Migrate?</h2>
          <p className="text-teal-950/70 mb-6">
            Start your free trial and follow this guide. Most teams are fully migrated in under 2 hours.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/alternatives/pagerduty">
              <Button size="lg" variant="outline" className="text-slate-950 border-slate-950/20 hover:bg-slate-950/10">
                Compare to PagerDuty
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

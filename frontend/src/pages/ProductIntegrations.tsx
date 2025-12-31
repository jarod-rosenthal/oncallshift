import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function ProductIntegrations() {
  const categories = [
    {
      name: 'Monitoring',
      tools: ['Datadog', 'Prometheus', 'Grafana', 'New Relic', 'CloudWatch', 'Splunk'],
    },
    {
      name: 'APM',
      tools: ['Sentry', 'Rollbar', 'Bugsnag', 'Airbrake'],
    },
    {
      name: 'Cloud',
      tools: ['AWS', 'Google Cloud', 'Azure', 'DigitalOcean'],
    },
    {
      name: 'Communication',
      tools: ['Slack', 'Microsoft Teams', 'Discord', 'Email'],
    },
    {
      name: 'Ticketing',
      tools: ['Jira', 'Linear', 'GitHub Issues', 'Asana'],
    },
  ];

  const webhookFormats = [
    {
      name: 'PagerDuty Events API v2',
      description: 'Drop-in replacement for PagerDuty webhooks. Same payload format.',
      endpoint: '/webhooks/pagerduty',
    },
    {
      name: 'Opsgenie Alert API',
      description: 'Compatible with Opsgenie webhook format for easy migration.',
      endpoint: '/webhooks/opsgenie',
    },
    {
      name: 'Generic Webhook',
      description: 'Flexible JSON format for custom integrations.',
      endpoint: '/webhooks/generic/{serviceKey}',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📟</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              OnCallShift
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/pricing">
              <Button variant="ghost" size="sm">Pricing</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>Product</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Integrations That<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Just Work
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Connect your existing monitoring tools in minutes. PagerDuty and Opsgenie compatible webhooks
          mean you can migrate without reconfiguring every integration.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <a href="https://oncallshift.com/api-docs" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline">
              API Documentation
            </Button>
          </a>
        </div>
      </section>

      {/* Tool Categories */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Works With Your Stack</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Any tool that can send webhooks can integrate with OnCallShift.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {categories.map((category, i) => (
              <Card key={i} className="border bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {category.tools.map((tool, j) => (
                      <span key={j} className="bg-slate-100 px-3 py-1 rounded-full text-sm text-slate-700">
                        {tool}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-center mt-8 text-slate-500 text-sm">
            + Any tool that supports webhooks
          </p>
        </div>
      </section>

      {/* Webhook Formats */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Webhook Endpoints</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          Choose the format that matches your existing setup. Migration is just a URL change.
        </p>

        <div className="space-y-6 max-w-3xl mx-auto">
          {webhookFormats.map((format, i) => (
            <Card key={i} className="border">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{format.name}</h3>
                    <p className="text-sm text-slate-600">{format.description}</p>
                  </div>
                  <code className="bg-slate-100 px-3 py-2 rounded text-sm font-mono text-slate-700 whitespace-nowrap">
                    {format.endpoint}
                  </code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Migration Ease */}
      <section className="bg-green-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Migrate Without Touching Every Tool</h2>
          <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
            Because we support PagerDuty and Opsgenie webhook formats, migrating is as simple as changing a URL.
            No payload changes. No reconfiguration.
          </p>
          <div className="bg-white rounded-lg p-6 max-w-2xl mx-auto shadow-sm">
            <div className="grid gap-3">
              <div className="flex items-center gap-4 text-left">
                <span className="text-red-500">Before:</span>
                <code className="bg-red-50 px-3 py-1 rounded text-sm flex-1 overflow-x-auto">
                  events.pagerduty.com/v2/enqueue
                </code>
              </div>
              <div className="flex items-center gap-4 text-left">
                <span className="text-green-500">After:</span>
                <code className="bg-green-50 px-3 py-1 rounded text-sm flex-1 overflow-x-auto">
                  api.oncallshift.com/webhooks/pagerduty
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Outbound Integrations */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Outbound Notifications</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          Reach your team wherever they are.
        </p>

        <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <Card className="border text-center">
            <CardContent className="pt-6">
              <span className="text-3xl block mb-2">📱</span>
              <p className="font-semibold">Push Notifications</p>
              <p className="text-xs text-slate-500">iOS & Android apps</p>
            </CardContent>
          </Card>
          <Card className="border text-center">
            <CardContent className="pt-6">
              <span className="text-3xl block mb-2">📧</span>
              <p className="font-semibold">Email</p>
              <p className="text-xs text-slate-500">Instant delivery</p>
            </CardContent>
          </Card>
          <Card className="border text-center">
            <CardContent className="pt-6">
              <span className="text-3xl block mb-2">💬</span>
              <p className="font-semibold">SMS</p>
              <p className="text-xs text-slate-500">Professional plan</p>
            </CardContent>
          </Card>
          <Card className="border text-center">
            <CardContent className="pt-6">
              <span className="text-3xl block mb-2">📞</span>
              <p className="font-semibold">Voice Call</p>
              <p className="text-xs text-slate-500">Professional plan</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* API */}
      <section className="bg-slate-900 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Full REST API</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            Build custom integrations with our documented REST API.
            Manage incidents, schedules, and users programmatically.
          </p>
          <a href="https://oncallshift.com/api-docs" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="secondary">
              View API Documentation
            </Button>
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Connect Your Tools?</h2>
        <p className="text-slate-600 mb-6">
          Start free. Integrations are available on all plans.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/migrate/from-pagerduty">
            <Button size="lg" variant="outline">
              Migration Guide
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-slate-50">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>&copy; 2025 OnCallShift. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link to="/legal/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-slate-700">Terms</Link>
            <Link to="/company/contact" className="hover:text-slate-700">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

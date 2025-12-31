import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function OpsgenieAlternative() {
  const timeline = [
    { date: 'Nov 2024', event: 'Atlassian announces Opsgenie standalone sunset' },
    { date: 'Apr 2025', event: 'No new Opsgenie-only customers' },
    { date: 'Apr 2027', event: 'Opsgenie standalone end of life' },
  ];

  const comparisonFeatures = [
    { feature: 'Standalone product', jira: 'No - requires JSM', oncallshift: 'Yes' },
    { feature: 'Starting price', jira: '$21/agent/mo (JSM Premium)', oncallshift: '$0 (Free tier)' },
    { feature: 'Unlimited users', jira: 'Per-agent pricing', oncallshift: 'Professional ($15/user)' },
    { feature: 'Migration complexity', jira: 'High (new platform)', oncallshift: 'Low (webhook compatible)' },
    { feature: 'Setup time', jira: 'Days to weeks', oncallshift: '< 30 minutes' },
    { feature: 'Atlassian lock-in', jira: 'Required', oncallshift: 'None' },
    { feature: 'AI-powered diagnosis', jira: 'Atlassian Intelligence', oncallshift: 'Anthropic Claude (BYOK)' },
  ];

  const painPoints = [
    {
      title: 'Stay independent',
      problem: "Atlassian wants to migrate you to Jira Service Management, which means buying into their entire ecosystem.",
      solution: 'OnCallShift is a focused incident management tool. No upsells to project management or service desk software.',
    },
    {
      title: 'Keep your workflow',
      problem: 'JSM has a different UI and workflow. Your team will need retraining and processes will change.',
      solution: 'OnCallShift works similarly to Opsgenie. Familiar concepts: schedules, escalation policies, services.',
    },
    {
      title: 'Simple pricing',
      problem: "JSM's pricing is complex with multiple tiers and agent-based licensing. Costs can spiral quickly.",
      solution: 'Clear per-user pricing. Free tier for small teams. Professional at $15/user/mo with everything included.',
    },
    {
      title: 'Faster migration',
      problem: 'Moving to JSM requires significant configuration, especially if you use other Atlassian products.',
      solution: 'Opsgenie-compatible webhooks mean you change one URL per integration. Import your teams and schedules in minutes.',
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

      {/* Sunset Banner */}
      <div className="bg-amber-50 border-b border-amber-200 py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-amber-800">
            <span className="font-semibold">Opsgenie standalone ends April 2027.</span>{' '}
            Don't get forced into Jira Service Management.{' '}
            <Link to="/migrate/from-opsgenie" className="underline font-medium">
              Migrate now
            </Link>
          </p>
        </div>
      </div>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          The Opsgenie Alternative That<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Stays Independent
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
          Atlassian is sunsetting Opsgenie standalone to push you into Jira Service Management.
          OnCallShift gives you a focused alternative without the Atlassian lock-in.
        </p>
        <div className="flex items-center justify-center gap-4 mb-8">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/migrate/from-opsgenie">
            <Button size="lg" variant="outline">
              Migration Guide
            </Button>
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          Opsgenie-compatible webhooks. Import your config in minutes.
        </p>
      </section>

      {/* Timeline */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Opsgenie Sunset Timeline</h2>
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 max-w-4xl mx-auto">
            {timeline.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                  i === timeline.length - 1 ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  <span className={`text-2xl ${i === timeline.length - 1 ? 'text-red-600' : 'text-blue-600'}`}>
                    {i === timeline.length - 1 ? '!' : i + 1}
                  </span>
                </div>
                <p className="font-semibold">{item.date}</p>
                <p className="text-sm text-slate-600 max-w-[200px]">{item.event}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-slate-600">
            Don't wait until the last minute. Migrate on your own timeline, not Atlassian's.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">OnCallShift vs Jira Service Management</h2>
        <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto">
          See how OnCallShift compares to Atlassian's forced migration path.
        </p>

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <table className="w-full text-left bg-white rounded-lg shadow-sm border">
            <thead>
              <tr className="border-b">
                <th className="py-4 px-6 font-medium">Feature</th>
                <th className="py-4 px-6 text-center">
                  <span className="text-slate-500">Jira Service Management</span>
                </th>
                <th className="py-4 px-6 text-center">
                  <span className="text-blue-600 font-semibold">OnCallShift</span>
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {comparisonFeatures.map((row, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-4 px-6 font-medium">{row.feature}</td>
                  <td className="py-4 px-6 text-center text-slate-600">{row.jira}</td>
                  <td className="py-4 px-6 text-center text-green-600 font-medium">{row.oncallshift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pain Points */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Why Teams Choose OnCallShift Over JSM</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            We built OnCallShift for teams who want incident management without the baggage.
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {painPoints.map((point, i) => (
              <Card key={i} className="border bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">{point.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-red-600 mb-1">The problem:</p>
                    <p className="text-sm text-slate-600">{point.problem}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">Our approach:</p>
                    <p className="text-sm text-slate-600">{point.solution}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Migration CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Migrate Before Atlassian Decides for You
          </h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Our import wizard supports Opsgenie exports. Bring your teams, schedules, and escalation policies.
            Most teams complete migration in under an hour.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/migrate/from-opsgenie">
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
                View Migration Guide
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Is OnCallShift really compatible with Opsgenie integrations?</h3>
              <p className="text-slate-600 text-sm">
                Yes. Our webhook endpoint accepts the same JSON payload format as Opsgenie's Alert API.
                Most monitoring tools just need a URL change.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">What if I already use other Atlassian products?</h3>
              <p className="text-slate-600 text-sm">
                OnCallShift can integrate with Jira for ticket creation and Confluence for runbooks.
                You don't need to leave the Atlassian ecosystem entirely.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Do you support Opsgenie's API?</h3>
              <p className="text-slate-600 text-sm">
                We support the Alert API (webhook ingestion) for compatibility. Our REST API for
                reading/managing incidents uses OnCallShift's own format.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">What about Opsgenie features OnCallShift doesn't have?</h3>
              <p className="text-slate-600 text-sm">
                We focus on core incident management. If you need Statuspage integration, Heartbeats,
                or advanced post-incident reviews, those may not have direct equivalents yet.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Can I export my data from Opsgenie?</h3>
              <p className="text-slate-600 text-sm">
                Yes. Opsgenie allows exports of teams, users, schedules, and escalation policies.
                Our import wizard can parse these exports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Break Free from Atlassian Lock-in?</h2>
        <p className="text-slate-600 mb-6">
          Start free. No credit card required. Migrate from Opsgenie in under an hour.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline">
              View Demo
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

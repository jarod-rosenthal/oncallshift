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
    <div className="relative">
      {/* Sunset Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-amber-400">
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
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          The Opsgenie Alternative That<br />
          <span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
            Stays Independent
          </span>
        </h1>
        <p className="text-xl text-slate-400 mb-8 max-w-3xl mx-auto">
          Atlassian is sunsetting Opsgenie standalone to push you into Jira Service Management.
          OnCallShift gives you a focused alternative without the Atlassian lock-in.
        </p>
        <div className="flex items-center justify-center gap-4 mb-8">
          <Link to="/register">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/migrate/from-opsgenie">
            <Button size="lg" variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">
              Migration Guide
            </Button>
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          Opsgenie-compatible webhooks. Import your config in minutes.
        </p>
      </section>

      {/* Timeline */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Opsgenie Sunset Timeline</h2>
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 max-w-4xl mx-auto">
            {timeline.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                  i === timeline.length - 1 ? 'bg-red-500/10' : 'bg-teal-500/10'
                }`}>
                  <span className={`text-2xl ${i === timeline.length - 1 ? 'text-red-400' : 'text-teal-400'}`}>
                    {i === timeline.length - 1 ? '!' : i + 1}
                  </span>
                </div>
                <p className="font-semibold text-white">{item.date}</p>
                <p className="text-sm text-slate-400 max-w-[200px]">{item.event}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-slate-400">
            Don't wait until the last minute. Migrate on your own timeline, not Atlassian's.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4 text-white">OnCallShift vs Jira Service Management</h2>
        <p className="text-slate-400 text-center mb-8 max-w-2xl mx-auto">
          See how OnCallShift compares to Atlassian's forced migration path.
        </p>

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <table className="w-full text-left bg-white/[0.03] rounded-lg border border-white/5">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-4 px-6 font-medium text-white">Feature</th>
                <th className="py-4 px-6 text-center">
                  <span className="text-slate-500">Jira Service Management</span>
                </th>
                <th className="py-4 px-6 text-center">
                  <span className="text-teal-400 font-semibold">OnCallShift</span>
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {comparisonFeatures.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-b-0">
                  <td className="py-4 px-6 font-medium text-white">{row.feature}</td>
                  <td className="py-4 px-6 text-center text-slate-400">{row.jira}</td>
                  <td className="py-4 px-6 text-center text-green-400 font-medium">{row.oncallshift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pain Points */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4 text-white">Why Teams Choose OnCallShift Over JSM</h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            We built OnCallShift for teams who want incident management without the baggage.
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {painPoints.map((point, i) => (
              <Card key={i} className="border border-white/5 bg-white/[0.03]">
                <CardHeader>
                  <CardTitle className="text-lg text-white">{point.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-red-400 mb-1">The problem:</p>
                    <p className="text-sm text-slate-400">{point.problem}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-400 mb-1">Our approach:</p>
                    <p className="text-sm text-slate-400">{point.solution}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Migration CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-slate-950">
            Migrate Before Atlassian Decides for You
          </h2>
          <p className="text-teal-950/70 mb-8 max-w-2xl mx-auto">
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
              <Button size="lg" variant="outline" className="text-slate-950 border-slate-950/20 hover:bg-slate-950/10">
                View Migration Guide
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">Is OnCallShift really compatible with Opsgenie integrations?</h3>
              <p className="text-slate-400 text-sm">
                Yes. Our webhook endpoint accepts the same JSON payload format as Opsgenie's Alert API.
                Most monitoring tools just need a URL change.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">What if I already use other Atlassian products?</h3>
              <p className="text-slate-400 text-sm">
                OnCallShift can integrate with Jira for ticket creation and Confluence for runbooks.
                You don't need to leave the Atlassian ecosystem entirely.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">Do you support Opsgenie's API?</h3>
              <p className="text-slate-400 text-sm">
                We support the Alert API (webhook ingestion) for compatibility. Our REST API for
                reading/managing incidents uses OnCallShift's own format.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">What about Opsgenie features OnCallShift doesn't have?</h3>
              <p className="text-slate-400 text-sm">
                We focus on core incident management. If you need Statuspage integration, Heartbeats,
                or advanced post-incident reviews, those may not have direct equivalents yet.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">Can I export my data from Opsgenie?</h3>
              <p className="text-slate-400 text-sm">
                Yes. Opsgenie allows exports of teams, users, schedules, and escalation policies.
                Our import wizard can parse these exports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4 text-white">Ready to Break Free from Atlassian Lock-in?</h2>
        <p className="text-slate-400 mb-6">
          Start free. No credit card required. Migrate from Opsgenie in under an hour.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">
              View Demo
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

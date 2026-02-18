import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function PagerDutyAlternative() {
  const comparisonFeatures = [
    { feature: 'Terraform Provider', pagerduty: 'Available', oncallshift: 'Full IaC support', highlight: true },
    { feature: 'MCP Server (AI Assistants)', pagerduty: 'None', oncallshift: 'Full integration', highlight: true },
    { feature: 'Self-Healing (Auto-Resolution)', pagerduty: 'Suggestions only', oncallshift: '80% target', highlight: false },
    { feature: 'CLI Tool', pagerduty: 'pd CLI', oncallshift: 'ocs CLI + GitHub Action', highlight: false },
    { feature: 'Cloud Investigation', pagerduty: 'Via integrations', oncallshift: 'Direct AWS/GCP/Azure', highlight: false },
    { feature: 'AI-powered diagnosis', pagerduty: 'AIOps add-on ($$$)', oncallshift: 'Included (BYOK)', highlight: false },
    { feature: 'SSO (SAML/OIDC)', pagerduty: 'Business tier+', oncallshift: 'Professional tier', highlight: false },
    { feature: 'Starting price', pagerduty: '$21/user/mo', oncallshift: '$0 (Free tier)', highlight: false },
    { feature: 'Setup time', pagerduty: 'Days to weeks', oncallshift: '5 min (or via Terraform)', highlight: false },
  ];

  const painPoints = [
    {
      title: 'Infrastructure as Code, Finally',
      problem: "Managing on-call schedules through a UI doesn't scale. You can't version control it, review changes, or automate team onboarding. PagerDuty has a Terraform provider, but it's a second-class citizen.",
      solution: 'OnCallShift is Terraform-native. Define schedules, escalation policies, and services in HCL. GitOps your on-call config. terraform apply to production.',
    },
    {
      title: 'AI-native from day one',
      problem: "PagerDuty bolted on AI features as expensive add-ons. They don't have an MCP server, can't integrate with your AI assistant, and charge enterprise prices for basic AI diagnosis.",
      solution: 'OnCallShift was built for the AI era. Configure your org from Claude Code. AI that actually resolves incidents—80% without waking you up.',
    },
    {
      title: 'Cloud investigation that actually works',
      problem: "PagerDuty's AI can only suggest generic fixes. It can't actually query your CloudWatch logs, check your ECS services, or investigate what's happening in your infrastructure.",
      solution: 'Connect your AWS/GCP/Azure credentials. Our AI queries your infrastructure directly to find root causes in seconds—not hours.',
    },
    {
      title: 'Developer experience matters',
      problem: "PagerDuty was built for NOCs and enterprise ops teams. If you're an engineer who lives in the terminal, their web-first approach feels clunky.",
      solution: 'Full CLI (ocs), GitHub Action for CI/CD, MCP server for AI assistants. Built by engineers who still get paged.',
    },
  ];

  const testimonials = [
    {
      quote: "We cut our incident management costs by 70% switching from PagerDuty. The migration took 2 hours.",
      author: 'Platform Lead',
      company: 'Series B Startup',
    },
    {
      quote: "PagerDuty wanted us to upgrade to Business just for schedule coverage gaps. OnCallShift has it in the base plan.",
      author: 'Engineering Manager',
      company: 'E-commerce Company',
    },
  ];

  return (
    <div className="relative">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>🤖</span>
          <span>The AI-native PagerDuty alternative with MCP server integration</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          PagerDuty, But Built for the<br />
          <span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
            AI Era
          </span>
        </h1>
        <p className="text-xl text-slate-400 mb-8 max-w-3xl mx-auto">
          Configure your org from Claude Code. Migrate with a conversation. Let AI diagnose and
          fix incidents. Built by DevOps veterans who got tired of enterprise tools that don't work.
        </p>
        <div className="flex items-center justify-center gap-4 mb-8">
          <Link to="/register">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/migrate/from-pagerduty">
            <Button size="lg" variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">
              Migration Guide
            </Button>
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          No credit card required. PagerDuty-compatible webhooks. Migrate via AI conversation.
        </p>
      </section>

      {/* Price Comparison */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4 text-white">Side-by-Side Comparison</h2>
          <p className="text-slate-400 text-center mb-8 max-w-2xl mx-auto">
            See how OnCallShift stacks up against PagerDuty on the features that matter.
          </p>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-left bg-white/[0.03] rounded-lg border border-white/5">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-4 px-6 font-medium text-white">Feature</th>
                  <th className="py-4 px-6 text-center">
                    <span className="text-slate-500">PagerDuty</span>
                  </th>
                  <th className="py-4 px-6 text-center">
                    <span className="text-teal-400 font-semibold">OnCallShift</span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {comparisonFeatures.map((row, i) => (
                  <tr key={i} className={`border-b border-white/5 last:border-b-0 ${row.highlight ? 'bg-green-500/5' : ''}`}>
                    <td className="py-4 px-6 font-medium text-white">{row.feature}</td>
                    <td className="py-4 px-6 text-center text-slate-400">{row.pagerduty}</td>
                    <td className="py-4 px-6 text-center text-green-400 font-medium">{row.oncallshift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-8">
            <Link to="/pricing">
              <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">View Full Pricing</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4 text-white">Why Teams Switch from PagerDuty</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          We built OnCallShift because incident management shouldn't require an enterprise budget.
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
      </section>

      {/* Migration Path */}
      <section className="bg-teal-500/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Migrate in Under an Hour</h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            Our PagerDuty-compatible webhook API means your monitoring tools just need a URL change.
            No reconfiguration. No downtime.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <div className="text-3xl font-bold text-teal-400 mb-2">1</div>
              <h3 className="font-semibold mb-2 text-white">Sign up</h3>
              <p className="text-sm text-slate-400">
                Create your account and import users from PagerDuty export
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <div className="text-3xl font-bold text-teal-400 mb-2">2</div>
              <h3 className="font-semibold mb-2 text-white">Configure</h3>
              <p className="text-sm text-slate-400">
                Set up schedules and escalation policies (takes minutes)
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <div className="text-3xl font-bold text-teal-400 mb-2">3</div>
              <h3 className="font-semibold mb-2 text-white">Switch URLs</h3>
              <p className="text-sm text-slate-400">
                Update your monitoring tools to point to OnCallShift webhooks
              </p>
            </div>
          </div>

          <div className="bg-white/[0.03] rounded-lg p-6 max-w-2xl mx-auto border border-white/5">
            <p className="text-sm font-medium mb-3 text-white">Webhook URL change:</p>
            <div className="grid gap-2 text-left">
              <div className="bg-red-500/5 p-3 rounded font-mono text-sm border border-red-500/10">
                <span className="text-red-400">Before:</span>{' '}
                <span className="text-slate-400">events.pagerduty.com/v2/enqueue</span>
              </div>
              <div className="bg-green-500/5 p-3 rounded font-mono text-sm border border-green-500/10">
                <span className="text-green-400">After:</span>{' '}
                <span className="text-slate-400">api.oncallshift.com/webhooks/pagerduty</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link to="/migrate/from-pagerduty">
              <Button className="bg-teal-500 hover:bg-teal-400 text-slate-950">
                View Full Migration Guide
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-white">What Teams Say</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {testimonials.map((testimonial, i) => (
            <Card key={i} className="border border-white/5 bg-white/[0.03]">
              <CardContent className="pt-6">
                <p className="text-slate-400 mb-4 italic">"{testimonial.quote}"</p>
                <div>
                  <p className="font-medium text-white">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">{testimonial.company}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">Is OnCallShift really compatible with PagerDuty integrations?</h3>
              <p className="text-slate-400 text-sm">
                Yes. Our webhook endpoint accepts the same JSON payload format as PagerDuty's Events API v2.
                Most monitoring tools (Datadog, Prometheus, Grafana, etc.) just need a URL change.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">What about PagerDuty features OnCallShift doesn't have?</h3>
              <p className="text-slate-400 text-sm">
                We focus on core incident management: schedules, escalations, notifications, and integrations.
                If you need advanced runbooks, status pages, or stakeholder communications,
                PagerDuty's enterprise plans may be a better fit.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">Can I export my data from PagerDuty?</h3>
              <p className="text-slate-400 text-sm">
                Yes. PagerDuty allows CSV exports of users, schedules, and services.
                Our import wizard can parse these exports to speed up migration.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">How does the AI diagnosis compare to PagerDuty AIOps?</h3>
              <p className="text-slate-400 text-sm">
                OnCallShift uses Anthropic Claude for incident analysis, with BYOK (bring your own key)
                so you control costs and data privacy. It's included in Professional,
                not a separate expensive add-on.
              </p>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5">
              <h3 className="font-semibold mb-2 text-white">What if I need to switch back?</h3>
              <p className="text-slate-400 text-sm">
                No lock-in. Export your data anytime. Since we use standard webhook formats,
                switching back (or to any other tool) is straightforward.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4 text-white">Ready to Cut Your Incident Management Costs?</h2>
        <p className="text-slate-400 mb-6">
          Start free. No credit card required. Migrate from PagerDuty in under an hour.
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

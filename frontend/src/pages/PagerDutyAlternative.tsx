import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function PagerDutyAlternative() {
  const comparisonFeatures = [
    { feature: 'Starting price', pagerduty: '$21/user/mo', oncallshift: '$0 (Free tier)' },
    { feature: 'Professional tier', pagerduty: '$41/user/mo', oncallshift: '$15/user/mo' },
    { feature: 'Unlimited schedules', pagerduty: 'Business plan ($59+)', oncallshift: 'Professional ($15)' },
    { feature: 'AI-powered diagnosis', pagerduty: 'AIOps add-on ($$$)', oncallshift: 'Included (BYOK)' },
    { feature: 'Webhook API compatibility', pagerduty: 'Native', oncallshift: 'PagerDuty-compatible' },
    { feature: 'Setup time', pagerduty: 'Days to weeks', oncallshift: '< 30 minutes' },
    { feature: 'Contract required', pagerduty: 'Annual (most plans)', oncallshift: 'Month-to-month' },
    { feature: 'Free trial', pagerduty: '14 days', oncallshift: '14 days + free tier' },
  ];

  const painPoints = [
    {
      title: 'Pricing that scales with you',
      problem: "PagerDuty's pricing jumps dramatically as you grow. The gap between Professional ($41/user) and Business ($59/user) forces you to pay for features you don't need.",
      solution: 'OnCallShift Professional at $15/user/mo includes unlimited schedules, escalation policies, and integrations. No forced upgrades.',
    },
    {
      title: 'No nickel-and-diming',
      problem: 'PagerDuty charges extra for Event Intelligence, AIOps, and advanced analytics. The base product often feels incomplete.',
      solution: 'AI diagnosis is included with BYOK (bring your own key). All core features work out of the box.',
    },
    {
      title: 'Simpler migration',
      problem: 'Switching incident management tools typically means reconfiguring every monitoring integration and retraining your team.',
      solution: 'Our PagerDuty-compatible webhook API means you just change the URL. Your monitoring tools keep working.',
    },
    {
      title: 'Actually talk to support',
      problem: "Enterprise support at PagerDuty requires expensive plans. Getting help on lower tiers means waiting for email responses.",
      solution: 'Priority email support on Professional. Direct access to engineers who built the product.',
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
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>Save 60%+ vs PagerDuty</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          The PagerDuty Alternative That<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Won't Break the Bank
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
          Same reliability. Same integrations. Fraction of the cost. OnCallShift delivers
          enterprise-grade incident management without the enterprise price tag.
        </p>
        <div className="flex items-center justify-center gap-4 mb-8">
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
        <p className="text-sm text-slate-500">
          No credit card required. PagerDuty-compatible webhooks.
        </p>
      </section>

      {/* Price Comparison */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Side-by-Side Comparison</h2>
          <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto">
            See how OnCallShift stacks up against PagerDuty on the features that matter.
          </p>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-left bg-white rounded-lg shadow-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-4 px-6 font-medium">Feature</th>
                  <th className="py-4 px-6 text-center">
                    <span className="text-slate-500">PagerDuty</span>
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
                    <td className="py-4 px-6 text-center text-slate-600">{row.pagerduty}</td>
                    <td className="py-4 px-6 text-center text-green-600 font-medium">{row.oncallshift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-8">
            <Link to="/pricing">
              <Button variant="outline">View Full Pricing</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Why Teams Switch from PagerDuty</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          We built OnCallShift because incident management shouldn't require an enterprise budget.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {painPoints.map((point, i) => (
            <Card key={i} className="border">
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
      </section>

      {/* Migration Path */}
      <section className="bg-blue-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Migrate in Under an Hour</h2>
          <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
            Our PagerDuty-compatible webhook API means your monitoring tools just need a URL change.
            No reconfiguration. No downtime.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-2">1</div>
              <h3 className="font-semibold mb-2">Sign up</h3>
              <p className="text-sm text-slate-600">
                Create your account and import users from PagerDuty export
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-2">2</div>
              <h3 className="font-semibold mb-2">Configure</h3>
              <p className="text-sm text-slate-600">
                Set up schedules and escalation policies (takes minutes)
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-2">3</div>
              <h3 className="font-semibold mb-2">Switch URLs</h3>
              <p className="text-sm text-slate-600">
                Update your monitoring tools to point to OnCallShift webhooks
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 max-w-2xl mx-auto shadow-sm">
            <p className="text-sm font-medium mb-3">Webhook URL change:</p>
            <div className="grid gap-2 text-left">
              <div className="bg-red-50 p-3 rounded font-mono text-sm">
                <span className="text-red-600">Before:</span>{' '}
                <span className="text-slate-600">events.pagerduty.com/v2/enqueue</span>
              </div>
              <div className="bg-green-50 p-3 rounded font-mono text-sm">
                <span className="text-green-600">After:</span>{' '}
                <span className="text-slate-600">api.oncallshift.com/webhooks/pagerduty</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link to="/migrate/from-pagerduty">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                View Full Migration Guide
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">What Teams Say</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {testimonials.map((testimonial, i) => (
            <Card key={i} className="border">
              <CardContent className="pt-6">
                <p className="text-slate-600 mb-4 italic">"{testimonial.quote}"</p>
                <div>
                  <p className="font-medium">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">{testimonial.company}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Is OnCallShift really compatible with PagerDuty integrations?</h3>
              <p className="text-slate-600 text-sm">
                Yes. Our webhook endpoint accepts the same JSON payload format as PagerDuty's Events API v2.
                Most monitoring tools (Datadog, Prometheus, Grafana, etc.) just need a URL change.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">What about PagerDuty features OnCallShift doesn't have?</h3>
              <p className="text-slate-600 text-sm">
                We focus on core incident management: schedules, escalations, notifications, and integrations.
                If you need advanced runbooks, status pages, or stakeholder communications,
                PagerDuty's enterprise plans may be a better fit.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Can I export my data from PagerDuty?</h3>
              <p className="text-slate-600 text-sm">
                Yes. PagerDuty allows CSV exports of users, schedules, and services.
                Our import wizard can parse these exports to speed up migration.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">How does the AI diagnosis compare to PagerDuty AIOps?</h3>
              <p className="text-slate-600 text-sm">
                OnCallShift uses Anthropic Claude for incident analysis, with BYOK (bring your own key)
                so you control costs and data privacy. It's included in Professional,
                not a separate expensive add-on.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">What if I need to switch back?</h3>
              <p className="text-slate-600 text-sm">
                No lock-in. Export your data anytime. Since we use standard webhook formats,
                switching back (or to any other tool) is straightforward.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Cut Your Incident Management Costs?</h2>
        <p className="text-slate-600 mb-6">
          Start free. No credit card required. Migrate from PagerDuty in under an hour.
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

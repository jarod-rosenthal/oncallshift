import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');

  const plans = [
    {
      name: 'Free',
      description: 'For small teams getting started',
      monthlyPrice: 0,
      annualPrice: 0,
      features: [
        'Up to 5 users',
        '1 on-call schedule',
        'Email alerts',
        'Basic incident management',
        'Community support',
        '7-day incident history',
      ],
      cta: 'Start Free',
      ctaLink: '/register',
      highlighted: false,
    },
    {
      name: 'Professional',
      description: 'For growing teams who need more',
      monthlyPrice: 19,
      annualPrice: 15,
      features: [
        'Unlimited users',
        'Unlimited schedules',
        'All notification channels',
        'AI-powered diagnosis',
        'Escalation policies',
        'Integrations (Slack, Teams, etc)',
        'Priority email support',
        '90-day incident history',
        'API access',
      ],
      cta: 'Start Free Trial',
      ctaLink: '/register?plan=professional',
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      description: 'For organizations with advanced needs',
      monthlyPrice: null,
      annualPrice: null,
      features: [
        'Everything in Professional',
        'SSO/SAML authentication',
        'Custom SLA',
        'Dedicated account manager',
        'On-premise deployment option',
        'Advanced analytics',
        'Custom integrations',
        'Unlimited incident history',
        '24/7 phone support',
      ],
      cta: 'Contact Sales',
      ctaLink: '/company/contact',
      highlighted: false,
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
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          No hidden fees. No "contact sales" surprises. Start free and upgrade when you're ready.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-4 bg-slate-100 p-1 rounded-lg mb-12">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly' ? 'bg-white shadow-sm' : 'text-slate-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'annual' ? 'bg-white shadow-sm' : 'text-slate-600'
            }`}
          >
            Annual
            <span className="ml-2 text-xs text-green-600 font-semibold">Save 20%</span>
          </button>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.highlighted
                  ? 'border-2 border-blue-500 shadow-lg scale-105'
                  : 'border'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-slate-500">{plan.description}</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <span className="text-4xl font-bold">
                        ${billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-slate-500">/user/mo</span>
                      {billingPeriod === 'annual' && plan.monthlyPrice > 0 && (
                        <div className="text-sm text-slate-500 mt-1">
                          billed annually
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-3xl font-bold">Custom</span>
                  )}
                </div>

                <Link to={plan.ctaLink}>
                  <Button
                    className={`w-full mb-6 ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                        : ''
                    }`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>

                <ul className="text-left space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Feature comparison */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Compare Plans</h2>

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-4 px-4 font-medium">Feature</th>
                <th className="py-4 px-4 text-center">Free</th>
                <th className="py-4 px-4 text-center text-blue-600">Professional</th>
                <th className="py-4 px-4 text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b">
                <td className="py-4 px-4">Users</td>
                <td className="py-4 px-4 text-center">Up to 5</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">On-call schedules</td>
                <td className="py-4 px-4 text-center">1</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">Notification channels</td>
                <td className="py-4 px-4 text-center">Email only</td>
                <td className="py-4 px-4 text-center">All (Push, SMS, Voice, Email)</td>
                <td className="py-4 px-4 text-center">All + Custom</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">AI Diagnosis</td>
                <td className="py-4 px-4 text-center">—</td>
                <td className="py-4 px-4 text-center text-green-500">✓</td>
                <td className="py-4 px-4 text-center text-green-500">✓</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">Escalation policies</td>
                <td className="py-4 px-4 text-center">—</td>
                <td className="py-4 px-4 text-center text-green-500">✓</td>
                <td className="py-4 px-4 text-center text-green-500">✓</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">Integrations</td>
                <td className="py-4 px-4 text-center">Webhook only</td>
                <td className="py-4 px-4 text-center">All standard</td>
                <td className="py-4 px-4 text-center">All + Custom</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">SSO/SAML</td>
                <td className="py-4 px-4 text-center">—</td>
                <td className="py-4 px-4 text-center">—</td>
                <td className="py-4 px-4 text-center text-green-500">✓</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">SLA</td>
                <td className="py-4 px-4 text-center">—</td>
                <td className="py-4 px-4 text-center">99.9%</td>
                <td className="py-4 px-4 text-center">99.99% + Custom</td>
              </tr>
              <tr className="border-b">
                <td className="py-4 px-4">Support</td>
                <td className="py-4 px-4 text-center">Community</td>
                <td className="py-4 px-4 text-center">Priority email</td>
                <td className="py-4 px-4 text-center">24/7 phone + CSM</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Can I upgrade or downgrade at any time?</h3>
              <p className="text-slate-600 text-sm">
                Yes! You can upgrade instantly and the new features are available immediately.
                Downgrades take effect at the end of your billing cycle.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Do you offer discounts for startups or non-profits?</h3>
              <p className="text-slate-600 text-sm">
                Yes, we offer 50% off for eligible startups and non-profit organizations.
                Contact us at support@oncallshift.com with details about your organization.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">What happens when I exceed my user limit on Free?</h3>
              <p className="text-slate-600 text-sm">
                We'll notify you when you're approaching the limit. You won't lose access
                to any features—you'll just need to upgrade to add more users.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Is there a free trial for Professional?</h3>
              <p className="text-slate-600 text-sm">
                Yes! You get a 14-day free trial of all Professional features.
                No credit card required to start.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">How does the AI diagnosis feature work with data privacy?</h3>
              <p className="text-slate-600 text-sm">
                You can bring your own Anthropic API key (BYOK), so your incident data
                is processed directly with Anthropic and never stored by OnCallShift for AI purposes.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Can I import from PagerDuty or Opsgenie?</h3>
              <p className="text-slate-600 text-sm">
                Yes! We have built-in import tools that can migrate your users, schedules,
                escalation policies, and services from both PagerDuty and Opsgenie.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Not sure which plan is right for you?</h2>
        <p className="text-slate-600 mb-6">
          Start free and upgrade anytime. No credit card required.
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

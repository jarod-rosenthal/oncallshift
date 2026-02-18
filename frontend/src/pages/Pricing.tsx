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
        'Up to 10 users',
        '3 on-call schedules',
        'Email + Push notifications',
        'AI diagnosis (10/month)',
        'Mobile app (full access)',
        'Community support',
        '30-day incident history',
      ],
      cta: 'Start Free',
      ctaLink: '/register',
      highlighted: false,
    },
    {
      name: 'Starter',
      description: 'For teams ready to scale',
      monthlyPrice: 9,
      annualPrice: 7,
      features: [
        'Unlimited users',
        'Unlimited schedules',
        'All notification channels (SMS, Voice)',
        'AI diagnosis (100/month)',
        'Escalation policies',
        'Standard integrations',
        'Priority email support',
        '90-day incident history',
      ],
      cta: 'Join Waitlist',
      ctaLink: '/register?plan=starter',
      highlighted: false,
      badge: 'Best Value',
    },
    {
      name: 'Professional',
      description: 'For teams who need unlimited AI',
      monthlyPrice: 19,
      annualPrice: 15,
      features: [
        'Everything in Starter',
        'Unlimited AI diagnosis',
        'AI execution (runbooks + cloud)',
        'Cloud credentials (AWS/Azure/GCP)',
        'Custom AI models (Haiku/Sonnet/Opus)',
        'All integrations',
        '1-year incident history',
        'Priority email + chat support',
      ],
      cta: 'Join Waitlist',
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
        'Custom SLA (99.99%)',
        'Dedicated account manager',
        'On-premise deployment option',
        'White-label option',
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
    <div className="relative">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-slate-400 mb-4 max-w-2xl mx-auto">
          No hidden fees. No "contact sales" surprises. Start free and upgrade when you're ready.
        </p>
        <p className="text-lg text-slate-500 italic max-w-2xl mx-auto mb-8">
          We price it how we'd want to pay. Because we're DevOps engineers, not a sales team.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-4 bg-white/[0.05] p-1 rounded-lg mb-12">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly' ? 'bg-white/10 shadow-sm text-white' : 'text-slate-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'annual' ? 'bg-white/10 shadow-sm text-white' : 'text-slate-400'
            }`}
          >
            Annual
            <span className="ml-2 text-xs text-teal-400 font-semibold">Save 20%</span>
          </button>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative bg-white/[0.03] ${
                plan.highlighted
                  ? 'border-2 border-teal-500 shadow-lg shadow-teal-500/10 scale-105'
                  : 'border border-white/5'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-teal-500 text-slate-950 text-xs font-semibold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                <p className="text-sm text-slate-500">{plan.description}</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <span className="text-4xl font-bold text-white">
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
                    <span className="text-3xl font-bold text-white">Custom</span>
                  )}
                </div>

                <Link to={plan.ctaLink}>
                  <Button
                    className={`w-full mb-6 ${
                      plan.highlighted
                        ? 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                        : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>

                <ul className="text-left space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-teal-400 mt-0.5">&#10003;</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* BYOK Option */}
      <section className="bg-purple-500/5 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/[0.03] rounded-2xl shadow-lg p-8 border-2 border-purple-400/20">
              <div className="flex items-start gap-4">
                <div className="text-4xl">&#128273;</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2 text-white">Professional + BYOK (Bring Your Own Key)</h3>
                  <p className="text-slate-400 mb-4">
                    Want complete control over your AI costs? Use your own Anthropic API key and pay them directly.
                  </p>
                  <div className="grid md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="font-semibold text-lg mb-2 text-white">$29/month flat fee</p>
                      <p className="text-sm text-slate-400">Not per user! One price for your whole team.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-lg mb-2 text-white">+ Your Anthropic costs</p>
                      <p className="text-sm text-slate-400">~$0.01-0.05 per incident. You control the model.</p>
                    </div>
                  </div>
                  <div className="bg-teal-500/5 border border-teal-500/20 rounded p-4 mb-4">
                    <p className="text-sm font-semibold text-teal-300 mb-1">Example: 50-person team</p>
                    <p className="text-sm text-teal-400/80">
                      Professional: 50 x $19 = <strong className="text-teal-300">$950/month</strong><br />
                      Pro + BYOK: $29 + (500 incidents x $0.03) = <strong className="text-teal-300">$44/month</strong><br />
                      <strong className="text-teal-200">You save: $906/month ($10,872/year)</strong>
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-400 mb-4">
                    <li>&#10003; All Professional features</li>
                    <li>&#10003; Your data goes directly to Anthropic (never stored by us)</li>
                    <li>&#10003; Choose your model (Haiku for speed, Opus for depth)</li>
                    <li>&#10003; No per-user AI fees</li>
                  </ul>
                  <Link to="/register?plan=byok">
                    <Button className="bg-purple-500 hover:bg-purple-400 text-white">
                      Start with BYOK
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature comparison */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-white">Compare Plans</h2>

        <div className="max-w-5xl mx-auto overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-4 px-4 font-medium text-slate-300">Feature</th>
                <th className="py-4 px-4 text-center text-slate-300">Free</th>
                <th className="py-4 px-4 text-center text-slate-300">Starter</th>
                <th className="py-4 px-4 text-center text-teal-400">Professional</th>
                <th className="py-4 px-4 text-center text-slate-300">Enterprise</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-400">
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">Users</td>
                <td className="py-4 px-4 text-center">Up to 10</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">On-call schedules</td>
                <td className="py-4 px-4 text-center">3</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
                <td className="py-4 px-4 text-center">Unlimited</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">AI Diagnosis</td>
                <td className="py-4 px-4 text-center text-teal-400">10/month</td>
                <td className="py-4 px-4 text-center text-teal-400">100/month</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003; Unlimited</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003; Unlimited</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">AI Execution</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">Notification channels</td>
                <td className="py-4 px-4 text-center">Email + Push</td>
                <td className="py-4 px-4 text-center">All (+ SMS, Voice)</td>
                <td className="py-4 px-4 text-center">All</td>
                <td className="py-4 px-4 text-center">All + Custom</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">Escalation policies</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">Cloud investigation</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">SSO/SAML</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center">&#8212;</td>
                <td className="py-4 px-4 text-center text-teal-400">&#10003;</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-4 px-4 text-slate-300">Support</td>
                <td className="py-4 px-4 text-center">Community</td>
                <td className="py-4 px-4 text-center">Priority email</td>
                <td className="py-4 px-4 text-center">Email + Chat</td>
                <td className="py-4 px-4 text-center">24/7 phone + CSM</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">Can I upgrade or downgrade at any time?</h3>
              <p className="text-slate-400 text-sm">
                Yes! You can upgrade instantly and the new features are available immediately.
                Downgrades take effect at the end of your billing cycle.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">Do you offer discounts for startups or non-profits?</h3>
              <p className="text-slate-400 text-sm">
                Yes, we offer 50% off for eligible startups and non-profit organizations.
                Contact us at support@oncallshift.com with details about your organization.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">What happens when I exceed my user limit on Free?</h3>
              <p className="text-slate-400 text-sm">
                We'll notify you when you're approaching the limit. You won't lose access
                to any features--you'll just need to upgrade to add more users.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">Is there a free trial for Professional?</h3>
              <p className="text-slate-400 text-sm">
                Yes! You get a 14-day free trial of all Professional features.
                No credit card required to start.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">How does the AI diagnosis feature work with data privacy?</h3>
              <p className="text-slate-400 text-sm">
                You can bring your own Anthropic API key (BYOK with Pro + BYOK plan), so your incident data
                is processed directly with Anthropic and never stored by OnCallShift for AI purposes.
                Or use our included AI (we provide the key) on Starter/Professional tiers.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">Why would I choose BYOK over Professional?</h3>
              <p className="text-slate-400 text-sm">
                If you have 30+ users, BYOK saves significant money. For example, 50 users on Professional
                costs $950/month. Pro + BYOK costs $29 + your Anthropic usage (~$15-50/month) = huge savings.
                Plus, you get complete control over AI costs and data privacy.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">Can I import from PagerDuty or Opsgenie?</h3>
              <p className="text-slate-400 text-sm">
                Yes! We have built-in import tools that can migrate your users, schedules,
                escalation policies, and services from both PagerDuty and Opsgenie.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4 text-white">Not sure which plan is right for you?</h2>
        <p className="text-slate-400 mb-6">
          Join the waitlist. Early access coming soon.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950">
              Join Waitlist
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

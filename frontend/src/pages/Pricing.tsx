import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function Pricing() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
          Pricing
        </h1>
        <p className="text-xl text-slate-400 mb-4 max-w-2xl mx-auto">
          We're finalizing our plans. Join the waitlist to be notified when pricing is available.
        </p>
        <p className="text-lg text-slate-500 italic max-w-2xl mx-auto mb-12">
          We price it how we'd want to pay. Because we're DevOps engineers, not a sales team.
        </p>

        {/* Coming Soon Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/[0.03] border-2 border-teal-500/20 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-3xl font-bold text-white mb-4">Coming Soon</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              We're putting the finishing touches on our pricing plans. Join the waitlist and we'll notify you as soon as they're ready.
            </p>
            <Link to="/register">
              <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-lg px-8 h-12 shadow-lg shadow-teal-500/25">
                Join Waitlist
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-white">What to Expect</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">💸</div>
            <h3 className="font-semibold text-white mb-2">Free Tier</h3>
            <p className="text-sm text-slate-400">A generous free tier for small teams getting started.</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="font-semibold text-white mb-2">Pay As You Grow</h3>
            <p className="text-sm text-slate-400">Simple per-user pricing that scales with your team.</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="font-semibold text-white mb-2">AI Included</h3>
            <p className="text-sm text-slate-400">AI diagnosis included at every tier. No enterprise upsell.</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🔑</div>
            <h3 className="font-semibold text-white mb-2">BYOK Option</h3>
            <p className="text-sm text-slate-400">Bring your own Anthropic API key for full cost control.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">When will pricing be available?</h3>
              <p className="text-slate-400 text-sm">
                We're finalizing our plans now. Join the waitlist and you'll be the first to know.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">Will there be a free tier?</h3>
              <p className="text-slate-400 text-sm">
                Yes! We'll have a free tier for small teams. No credit card required to start.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">Do you offer discounts for startups or non-profits?</h3>
              <p className="text-slate-400 text-sm">
                Yes, we'll offer discounts for eligible startups and non-profit organizations.
                Contact us at support@oncallshift.com with details about your organization.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-2 text-white">How does the AI diagnosis feature work with data privacy?</h3>
              <p className="text-slate-400 text-sm">
                You can bring your own Anthropic API key (BYOK), so your incident data
                is processed directly with Anthropic and never stored by OnCallShift for AI purposes.
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

import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function ForSmallTeams() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-white">
            Enterprise-Grade Incident Management
            <br />
            <span className="bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
              For Teams That Aren't Enterprise
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-4">
            Built by a 5-person team, for 5-person teams.
          </p>
          <p className="text-lg text-slate-400 mb-8">
            You don't need 500 engineers to deserve AI-powered incident response.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-teal-500 to-cyan-500">
                Start Free (10 Users)
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline">
                See Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-slate-400 mt-4">
            Free forever for small teams • No credit card required
          </p>
        </div>
      </section>

      {/* Why Big Tools Don't Work */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">
              Why Big Tools Don't Work for Small Teams
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-2 border-red-500/20 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="text-2xl mb-3">❌</div>
                  <h3 className="font-bold text-red-300 mb-2">"Contact Sales" Pricing</h3>
                  <p className="text-sm text-red-200">
                    Waste hours on sales calls just to see a price. They won't even give you a quote under 20 seats.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-500/20 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="text-2xl mb-3">❌</div>
                  <h3 className="font-bold text-red-300 mb-2">Minimum Seat Requirements</h3>
                  <p className="text-sm text-red-200">
                    "Sorry, our minimum is 25 users." Pay for 20 users you don't have.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-500/20 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="text-2xl mb-3">❌</div>
                  <h3 className="font-bold text-red-300 mb-2">Long Contracts</h3>
                  <p className="text-sm text-red-200">
                    12-month minimum. Annual prepay. Locked in even if it doesn't work for you.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-500/20 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="text-2xl mb-3">❌</div>
                  <h3 className="font-bold text-red-300 mb-2">Complex Setup</h3>
                  <p className="text-sm text-red-200">
                    "Schedule a kickoff call with your CSM." Just let me set it up myself!
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-500/20 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="text-2xl mb-3">❌</div>
                  <h3 className="font-bold text-red-300 mb-2">AI Locked Behind Enterprise</h3>
                  <p className="text-sm text-red-200">
                    The features that would actually help? Enterprise tier only. $$$$
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-500/20 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="text-2xl mb-3">❌</div>
                  <h3 className="font-bold text-red-300 mb-2">Built for Procurement Teams</h3>
                  <p className="text-sm text-red-200">
                    Designed for enterprise buyers, not the engineers who actually use it.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* OnCallShift for Small Teams */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">
            OnCallShift for Small Teams
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2 border-green-500/20 bg-green-500/10">
              <CardContent className="pt-6">
                <div className="text-2xl mb-3">✅</div>
                <h3 className="font-bold text-green-300 mb-2">Free Tier That Actually Works</h3>
                <p className="text-sm text-green-200 mb-3">
                  Up to 10 users. AI diagnosis included (10/month). 3 on-call schedules. Full mobile app. Forever free.
                </p>
                <p className="text-xs text-green-300 italic">
                  Not a "trial." Not "limited." Just free.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500/20 bg-green-500/10">
              <CardContent className="pt-6">
                <div className="text-2xl mb-3">✅</div>
                <h3 className="font-bold text-green-300 mb-2">$9/user When You Grow</h3>
                <p className="text-sm text-green-200 mb-3">
                  Starter tier unlocks unlimited AI, all channels (SMS, Voice), and escalation policies.
                </p>
                <p className="text-xs text-green-300 italic">
                  Not $41/user like PagerDuty.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500/20 bg-green-500/10">
              <CardContent className="pt-6">
                <div className="text-2xl mb-3">✅</div>
                <h3 className="font-bold text-green-300 mb-2">AI Included At Every Tier</h3>
                <p className="text-sm text-green-200 mb-3">
                  Even the free tier gets AI diagnosis. Pro tier ($19) gets AI execution. No enterprise upsell.
                </p>
                <p className="text-xs text-green-300 italic">
                  We democratize AI, not paywall it.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500/20 bg-green-500/10">
              <CardContent className="pt-6">
                <div className="text-2xl mb-3">✅</div>
                <h3 className="font-bold text-green-300 mb-2">5-Minute Setup</h3>
                <p className="text-sm text-green-200 mb-3">
                  Guided wizard. Pre-built runbooks. Test incident included. No CSM required.
                </p>
                <p className="text-xs text-green-300 italic">
                  Self-serve like it should be.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500/20 bg-green-500/10">
              <CardContent className="pt-6">
                <div className="text-2xl mb-3">✅</div>
                <h3 className="font-bold text-green-300 mb-2">Cancel Anytime</h3>
                <p className="text-sm text-green-200 mb-3">
                  Monthly billing. No long-term contracts. No minimums. Pay for what you use.
                </p>
                <p className="text-xs text-green-300 italic">
                  Because we're confident you'll stay.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500/20 bg-green-500/10">
              <CardContent className="pt-6">
                <div className="text-2xl mb-3">✅</div>
                <h3 className="font-bold text-green-300 mb-2">Built by a Small Team</h3>
                <p className="text-sm text-green-200 mb-3">
                  We know what it's like to be 5 people on-call. We built the tool we wished we had.
                </p>
                <p className="text-xs text-green-300 italic">
                  Email the founder directly: jarod@oncallshift.com
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Real Example */}
      <section className="bg-teal-500/10 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8 text-white">Real Example: 6-Person Startup</h2>

            <div className="bg-white/[0.03] rounded-lg shadow-lg p-8 border border-white/5">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Tier</p>
                  <p className="text-2xl font-bold text-teal-400">Free</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Cost</p>
                  <p className="text-2xl font-bold text-green-400">$0/month</p>
                </div>
              </div>

              <div className="border-t border-white/5 pt-6">
                <p className="font-semibold mb-3 text-white">What You Get:</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>✓ 10 user accounts (only using 6)</li>
                  <li>✓ 3 on-call schedules</li>
                  <li>✓ AI diagnosis (10 incidents/month)</li>
                  <li>✓ Email + Push notifications</li>
                  <li>✓ Native iOS & Android apps</li>
                  <li>✓ 30-day incident history</li>
                  <li>✓ Community support</li>
                </ul>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 bg-green-500/10 rounded-lg p-4">
                <p className="font-semibold text-green-300 mb-2">Compared to PagerDuty:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">PagerDuty (6 users):</p>
                    <p className="text-2xl font-bold text-slate-300">~$150/mo</p>
                  </div>
                  <div>
                    <p className="text-green-300 font-semibold">Your Savings:</p>
                    <p className="text-2xl font-bold text-green-400">$1,800/year</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 border-teal-500/20">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-lg italic text-slate-300 mb-6">
                "We're a 4-person team and PagerDuty wanted $1,200/year minimum. OnCallShift's free tier does everything we need. When we grow, the pricing actually makes sense."
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold">
                  SR
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Sarah R.</p>
                  <p className="text-sm text-slate-400">CTO, Early-Stage SaaS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-teal-500 to-cyan-500 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Free. Scale When Ready.
          </h2>
          <p className="text-teal-100 text-lg mb-8 max-w-2xl mx-auto">
            No credit card. No sales calls. No minimum seats. Just sign up and start using it.
          </p>
          <Link to="/register">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Start Free Trial (10 Users)
            </Button>
          </Link>
          <p className="text-teal-100 text-sm mt-4">
            Questions? Email the founder: <a href="mailto:jarod@oncallshift.com" className="underline hover:text-white">jarod@oncallshift.com</a>
          </p>
        </div>
      </section>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function About() {
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
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Why We Built OnCallShift
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          We were tired of waking up at 3am with no answers.
        </p>
      </section>

      {/* The Story */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-8 md:p-12">
            <div className="prose prose-lg max-w-none">
              <p className="text-lg leading-relaxed mb-6">
                We were SREs at a fast-growing startup.
              </p>

              <p className="text-slate-700 mb-6">
                3am pages. Laptop scrambles. No context in the alert. Digging through CloudWatch
                half-asleep. Restarting services manually. Writing the same runbook for the 10th time.
              </p>

              <p className="text-slate-700 mb-6">
                Then the bill came: <strong className="text-slate-900">$2,400/month for PagerDuty.</strong> For 8 people.
              </p>

              <p className="text-slate-700 mb-6">
                We thought: <em>"This should be easier. And way cheaper."</em>
              </p>

              <p className="text-lg font-semibold text-slate-900 mb-6">
                So we built OnCallShift.
              </p>

              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8">
                <p className="font-semibold text-blue-900 mb-3">The tool we wish we had:</p>
                <ul className="space-y-2 text-blue-800">
                  <li>• AI that actually investigates (not just suggests generic fixes)</li>
                  <li>• Mobile-first (your laptop stays in your bag)</li>
                  <li>• Transparent pricing (because we hate "contact sales" too)</li>
                  <li>• No BS features that look good in demos but suck in production</li>
                </ul>
              </div>

              <p className="text-slate-700 mb-6">
                We're still a small team. We still get paged. <strong>We use OnCallShift every day.</strong>
              </p>

              <p className="text-xl font-bold text-slate-900">
                If it doesn't work for us at 3am, we don't ship it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Meet the Team</h2>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg p-8 shadow-sm border">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                  JR
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">Jarod Rosenthal</h3>
                  <p className="text-slate-600 mb-4">Founder & CEO</p>
                  <p className="text-slate-700 mb-4">
                    Former SRE, tired of enterprise tools that don't work. Builds what he'd want to use.
                  </p>
                  <a
                    href="mailto:jarod@oncallshift.com"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    jarod@oncallshift.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Principles */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How We Work</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-2 border-slate-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-3">1. Eat Our Own Dog Food</h3>
              <p className="text-slate-600">
                We use OnCallShift for OnCallShift incidents. If it sucks at 3am, we fix it.
              </p>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-3">2. No Sales BS</h3>
              <p className="text-slate-600">
                Transparent pricing. Self-serve signup. No "contact sales" gatekeeping.
              </p>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-3">3. Developer Experience First</h3>
              <p className="text-slate-600">
                Every feature must work on mobile. Every API must have great docs. Every error message must be actionable.
              </p>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-3">4. Privacy Matters</h3>
              <p className="text-slate-600">
                BYOK means your data goes directly to Anthropic. We never train models on your incidents. You can self-host if you need to.
              </p>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-3">5. Build for Practitioners</h3>
              <p className="text-slate-600">
                We're not building "enterprise software." We're building tools for people who get paged. There's a difference.
              </p>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-3">6. Ship Fast, Learn Faster</h3>
              <p className="text-slate-600">
                We iterate based on real usage. Your feedback shapes the roadmap. No feature requests disappear into a void.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Want to Build With Us?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            We're building tools for DevOps engineers with a team that actually understands on-call.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary">
                Try OnCallShift Free
              </Button>
            </Link>
            <a href="mailto:jarod@oncallshift.com">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Email Us
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-4">
            <p className="text-slate-500 text-sm italic">
              Built by DevOps engineers who get paged. Questions?{' '}
              <a href="mailto:jarod@oncallshift.com" className="text-blue-600 hover:text-blue-700">
                Email the founder
              </a>
            </p>
          </div>
          <div className="text-center text-sm text-slate-500">
            <p>&copy; 2025 OnCallShift. All rights reserved.</p>
            <div className="mt-2 space-x-4">
              <Link to="/legal/privacy" className="hover:text-slate-700">Privacy</Link>
              <Link to="/legal/terms" className="hover:text-slate-700">Terms</Link>
              <Link to="/company/contact" className="hover:text-slate-700">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

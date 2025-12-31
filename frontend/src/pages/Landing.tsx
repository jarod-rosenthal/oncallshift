import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Navigation */}
      <nav className="border-b bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-2xl">📟</span>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  OnCallShift
                </span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-6">
                <div className="relative group">
                  <button className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
                    Product
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="bg-white rounded-lg shadow-lg border p-4 w-64">
                      <Link to="/product/on-call-scheduling" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">On-Call Scheduling</Link>
                      <Link to="/product/incident-management" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Incident Management</Link>
                      <Link to="/product/escalation-policies" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Escalation Policies</Link>
                      <Link to="/product/ai-diagnosis" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">AI Diagnosis</Link>
                      <Link to="/product/integrations" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Integrations</Link>
                      <Link to="/product/mobile-app" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Mobile App</Link>
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <button className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
                    Solutions
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="bg-white rounded-lg shadow-lg border p-4 w-72">
                      <div className="text-xs font-semibold text-slate-400 uppercase mb-2 px-3">Alternatives</div>
                      <Link to="/alternatives/pagerduty" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">PagerDuty Alternative</Link>
                      <Link to="/alternatives/opsgenie" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Opsgenie Alternative</Link>
                      <div className="border-t my-2"></div>
                      <div className="text-xs font-semibold text-slate-400 uppercase mb-2 px-3">Migration</div>
                      <Link to="/migrate/from-opsgenie" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm text-orange-600 font-medium">From Opsgenie</Link>
                      <Link to="/migrate/from-pagerduty" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">From PagerDuty</Link>
                    </div>
                  </div>
                </div>

                <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  Pricing
                </Link>

                <div className="relative group">
                  <button className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
                    Resources
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="bg-white rounded-lg shadow-lg border p-4 w-56">
                      <a href="/api-docs" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Documentation</a>
                      <a href="/api-docs" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">API Reference</a>
                      <Link to="/blog" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Blog</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login" className="hidden md:block">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Start Free Trial
                </Button>
              </Link>
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t pt-4">
              <div className="space-y-2">
                <Link to="/pricing" className="block py-2 text-sm font-medium">Pricing</Link>
                <Link to="/migrate/from-opsgenie" className="block py-2 text-sm font-medium text-orange-600">Migrate from Opsgenie</Link>
                <Link to="/migrate/from-pagerduty" className="block py-2 text-sm font-medium">Migrate from PagerDuty</Link>
                <Link to="/login" className="block py-2 text-sm font-medium">Login</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Coming Soon Banner */}
      <div className="bg-amber-500 text-amber-950 py-3 text-center">
        <div className="container mx-auto px-4">
          <p className="font-semibold">
            🚧 Coming Soon - This site is under development. Features shown are not yet available.
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-16 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="animate-pulse">🔔</span>
            Opsgenie sunsetting April 2027?
            <Link to="/migrate/from-opsgenie" className="underline hover:no-underline">
              Migrate in minutes →
            </Link>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            On-Call Scheduling &amp; Incident Management
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> for Teams Who Ship Fast</span>
          </h1>

          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Get your team on-call in minutes, not days. AI-powered diagnosis, smart escalations, and a mobile app your engineers will actually use.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg px-8 h-12">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 h-12">
                Watch Demo
              </Button>
            </Link>
          </div>

          <p className="text-sm text-slate-500">
            No credit card required · Set up in 5 minutes · Cancel anytime
          </p>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="border-y bg-slate-50 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">★★★★★</span>
              <span>4.8/5 rating</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🚀</span>
              <span>5-minute setup</span>
            </div>
            <div className="flex items-center gap-2">
              <span>💳</span>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span>SOC 2 compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            On-Call Shouldn't Be This Hard
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-red-50 border border-red-100 rounded-lg p-6">
              <div className="text-red-500 font-medium mb-2">The Problem</div>
              <p className="text-slate-700">"Alerts wake up the wrong person at 3am"</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-6">
              <div className="text-green-600 font-medium mb-2">OnCallShift Solution</div>
              <p className="text-slate-700">Smart escalations route to whoever's actually on-call</p>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-lg p-6">
              <div className="text-red-500 font-medium mb-2">The Problem</div>
              <p className="text-slate-700">"Setting up schedules takes hours"</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-6">
              <div className="text-green-600 font-medium mb-2">OnCallShift Solution</div>
              <p className="text-slate-700">Build rotations in minutes with our visual scheduler</p>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-lg p-6">
              <div className="text-red-500 font-medium mb-2">The Problem</div>
              <p className="text-slate-700">"Nobody knows what's happening during incidents"</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-6">
              <div className="text-green-600 font-medium mb-2">OnCallShift Solution</div>
              <p className="text-slate-700">Real-time incident timeline with AI-powered diagnosis</p>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-lg p-6">
              <div className="text-red-500 font-medium mb-2">The Problem</div>
              <p className="text-slate-700">"Engineers hate our clunky mobile app"</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-6">
              <div className="text-green-600 font-medium mb-2">OnCallShift Solution</div>
              <p className="text-slate-700">Native iOS &amp; Android apps built for speed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need. Nothing You Don't.</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Enterprise-grade incident management without the enterprise complexity
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">📅</div>
                <CardTitle className="text-lg">On-Call Scheduling</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li>• Visual rotation builder</li>
                  <li>• Override management</li>
                  <li>• Follow-the-sun support</li>
                </ul>
                <Link to="/product/on-call-scheduling" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">🔔</div>
                <CardTitle className="text-lg">Smart Escalations</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li>• Multi-step policies</li>
                  <li>• Schedule-aware routing</li>
                  <li>• Repeat until acknowledged</li>
                </ul>
                <Link to="/product/escalation-policies" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">🤖</div>
                <CardTitle className="text-lg">AI-Powered Diagnosis</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li>• Instant root cause analysis</li>
                  <li>• Log correlation</li>
                  <li>• Suggested remediation</li>
                </ul>
                <Link to="/product/ai-diagnosis" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">📱</div>
                <CardTitle className="text-lg">Mobile-First</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li>• Native iOS &amp; Android</li>
                  <li>• One-tap acknowledge</li>
                  <li>• Push, SMS, Voice, Email</li>
                </ul>
                <Link to="/product/mobile-app" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Differentiator Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Teams Choose OnCallShift
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-4 px-4 font-semibold"></th>
                  <th className="py-4 px-4 font-semibold text-blue-600">OnCallShift</th>
                  <th className="py-4 px-4 font-semibold text-slate-500">Typical Enterprise Tools</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Setup time</td>
                  <td className="py-4 px-4 text-green-600 font-medium">5 minutes</td>
                  <td className="py-4 px-4 text-slate-500">Days to weeks</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">AI diagnosis</td>
                  <td className="py-4 px-4 text-green-600 font-medium">Included</td>
                  <td className="py-4 px-4 text-slate-500">$$ add-on</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Pricing</td>
                  <td className="py-4 px-4 text-green-600 font-medium">Transparent</td>
                  <td className="py-4 px-4 text-slate-500">"Contact sales"</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Data privacy</td>
                  <td className="py-4 px-4 text-green-600 font-medium">Your key, your data</td>
                  <td className="py-4 px-4 text-slate-500">Trains on your incidents</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Migration CTA Section */}
      <section className="bg-orange-50 border-y border-orange-100 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-4xl mb-4">🔔</div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Migrating from Opsgenie?
            </h2>
            <p className="text-slate-600 mb-6">
              Opsgenie sunsets April 2027. Don't get forced into expensive JSM licenses.
              OnCallShift imports your schedules, policies, and teams in one click.
            </p>
            <Link to="/migrate/from-opsgenie">
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700">
                See Migration Guide →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            What Teams Are Saying
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-slate-600 italic mb-4">
                  "We switched from PagerDuty and cut our bill by 60%. Setup took 20 minutes."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                    JD
                  </div>
                  <div>
                    <div className="font-medium text-sm">James D.</div>
                    <div className="text-xs text-slate-500">SRE Lead</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-slate-600 italic mb-4">
                  "The AI diagnosis feature found a memory leak we'd been hunting for weeks."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold">
                    SK
                  </div>
                  <div>
                    <div className="font-medium text-sm">Sarah K.</div>
                    <div className="text-xs text-slate-500">Platform Engineer</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-slate-600 italic mb-4">
                  "Finally, an on-call tool our team doesn't complain about."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold">
                    MT
                  </div>
                  <div>
                    <div className="font-medium text-sm">Mike T.</div>
                    <div className="text-xs text-slate-500">Engineering Manager</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Fix On-Call?
          </h2>
          <p className="text-blue-100 text-xl mb-8 max-w-2xl mx-auto">
            Start your free trial today. No credit card required. Set up in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8 h-12">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white text-white hover:bg-white/10">
                Schedule Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-16 bg-slate-900 text-slate-300">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📟</span>
                <span className="font-bold text-lg text-white">OnCallShift</span>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                On-call scheduling and incident management for teams who ship fast.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-slate-400 hover:text-white">
                  <span className="sr-only">Twitter</span>
                  𝕏
                </a>
                <a href="#" className="text-slate-400 hover:text-white">
                  <span className="sr-only">GitHub</span>
                  GH
                </a>
                <a href="#" className="text-slate-400 hover:text-white">
                  <span className="sr-only">LinkedIn</span>
                  in
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/product/on-call-scheduling" className="hover:text-white">On-Call Scheduling</Link></li>
                <li><Link to="/product/incident-management" className="hover:text-white">Incident Management</Link></li>
                <li><Link to="/product/escalation-policies" className="hover:text-white">Escalation Policies</Link></li>
                <li><Link to="/product/ai-diagnosis" className="hover:text-white">AI Diagnosis</Link></li>
                <li><Link to="/product/integrations" className="hover:text-white">Integrations</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/api-docs" className="hover:text-white">Documentation</a></li>
                <li><a href="/api-docs" className="hover:text-white">API Reference</a></li>
                <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link to="/demo" className="hover:text-white">Live Demo</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/company/about" className="hover:text-white">About</Link></li>
                <li><Link to="/company/security" className="hover:text-white">Security</Link></li>
                <li><Link to="/legal/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link to="/legal/terms" className="hover:text-white">Terms</Link></li>
                <li><Link to="/company/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              &copy; 2025 OnCallShift. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>🔒 SOC 2 Type II</span>
              <span>99.9% Uptime SLA</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

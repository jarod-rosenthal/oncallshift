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
                      <Link to="/docs" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Documentation</Link>
                      <Link to="/help" className="block px-3 py-2 rounded hover:bg-slate-50 text-sm">Help Center</Link>
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
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span>🤖</span>
            The first incident platform with an MCP server
            <Link to="/docs/ai/mcp" className="underline hover:no-underline">
              Learn more →
            </Link>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            The AI-Native
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Incident Platform</span>
          </h1>

          <p className="text-xl text-slate-600 mb-4 max-w-2xl mx-auto">
            Configure your org through Claude Code. Migrate from competitors with a conversation.
            Let AI diagnose and fix incidents while you sleep.
          </p>

          <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto">
            Built by DevOps veterans with 15+ years of on-call experience. We've carried the pager,
            managed the escalations, and written the runbooks. Now we're building the platform we always wanted.
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
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            The Old Way vs. The OnCallShift Way
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
              <div className="text-red-600 font-bold text-xl mb-4">❌ The Old Way</div>
              <ul className="space-y-3 text-slate-700">
                <li>• Alert goes off at 3am</li>
                <li>• Scramble to laptop</li>
                <li>• Dig through logs</li>
                <li>• Google the error</li>
                <li>• Try random fixes</li>
                <li>• 2 hours later: finally resolved</li>
              </ul>
            </div>
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-8">
              <div className="text-green-600 font-bold text-xl mb-4">✅ The OnCallShift Way</div>
              <ul className="space-y-3 text-slate-700">
                <li>• Alert goes off at 3am</li>
                <li>• Open phone, see AI diagnosis</li>
                <li>• Tap "Restart Pods"</li>
                <li>• AI confirms it worked</li>
                <li>• Back to sleep in 60 seconds</li>
                <li>• <strong className="text-green-700">Your laptop stays in your bag</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built for the AI Era</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              The only incident platform your AI assistant can configure, migrate, and operate
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow border-2 border-purple-200 bg-purple-50">
              <CardHeader>
                <div className="text-3xl mb-2">🔌</div>
                <CardTitle className="text-lg">MCP Server Integration</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="space-y-2">
                  <li>• <strong>Configure</strong> your org from Claude Code</li>
                  <li>• <strong>Migrate</strong> from PagerDuty with a conversation</li>
                  <li>• Manage incidents from your IDE</li>
                  <li>• Works with Cursor, VS Code, any MCP client</li>
                </ul>
                <Link to="/docs/ai/mcp" className="text-purple-700 font-medium text-sm mt-3 inline-block hover:underline">
                  Set up MCP →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-2 border-blue-200 bg-blue-50">
              <CardHeader>
                <div className="text-3xl mb-2">🤖</div>
                <CardTitle className="text-lg">AI That Fixes Problems</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="space-y-2">
                  <li>• <strong>Auto-diagnoses</strong> every incident</li>
                  <li>• <strong>Executes</strong> remediation actions</li>
                  <li>• Queries your AWS/Azure/GCP directly</li>
                  <li>• BYOK for enterprise compliance</li>
                </ul>
                <Link to="/product/ai-diagnosis" className="text-blue-700 font-medium text-sm mt-3 inline-block hover:underline">
                  See how it works →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">☁️</div>
                <CardTitle className="text-lg">Cloud Investigation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-2">
                  <li>• Connect your AWS/GCP/Azure credentials</li>
                  <li>• AI queries CloudWatch, ECS, EC2 directly</li>
                  <li>• Root cause analysis in seconds</li>
                  <li>• Your credentials, your data, your control</li>
                </ul>
                <Link to="/product/cloud-investigation" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">🔔</div>
                <CardTitle className="text-lg">Always Reach the Right Person</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-2">
                  <li>• Smart escalations</li>
                  <li>• Multi-channel (Push, SMS, Voice)</li>
                  <li>• Repeat until acknowledged</li>
                  <li>• Visual schedule builder</li>
                </ul>
                <Link to="/product/incident-management" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">📱</div>
                <CardTitle className="text-lg">Designed for 3am Wake-Ups</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-2">
                  <li>• Native iOS & Android apps</li>
                  <li>• One-tap incident actions</li>
                  <li>• Execute runbooks from phone</li>
                  <li>• AI chat on mobile</li>
                </ul>
                <Link to="/product/mobile-app" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">🔄</div>
                <CardTitle className="text-lg">Zero-Friction Migration</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-2">
                  <li>• Import from PagerDuty or Opsgenie</li>
                  <li>• Preserves integration keys</li>
                  <li>• Migrate via AI conversation</li>
                  <li>• Zero downtime cutover</li>
                </ul>
                <Link to="/migrate/from-pagerduty" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Migration guide →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Differentiator Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Built by DevOps Veterans, for DevOps Teams
          </h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            We've spent 15+ years managing production systems, carrying pagers, and building infrastructure at scale.
            This isn't a side project—it's the platform we always needed.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2">
                  <th className="py-4 px-4 font-semibold"></th>
                  <th className="py-4 px-4 font-semibold text-blue-600">OnCallShift</th>
                  <th className="py-4 px-4 font-semibold text-slate-500">PagerDuty</th>
                  <th className="py-4 px-4 font-semibold text-slate-500">OpsGenie</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b bg-purple-50">
                  <td className="py-3 px-4 font-medium">MCP Server (AI Assistant)</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Full integration</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Built By</td>
                  <td className="py-3 px-4 text-green-600 font-medium">DevOps Veterans (15+ yrs)</td>
                  <td className="py-3 px-4 text-slate-500">Enterprise Co.</td>
                  <td className="py-3 px-4 text-slate-500">Atlassian (sunsetting)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Cloud Investigation</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Direct (AWS/Azure/GCP)</td>
                  <td className="py-3 px-4 text-slate-500">Via integrations</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">AI Diagnosis + Execution</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Included</td>
                  <td className="py-3 px-4 text-slate-500">$$$ Add-on</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">BYOK (Bring Your Own Key)</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Yes</td>
                  <td className="py-3 px-4 text-slate-500">✗ No</td>
                  <td className="py-3 px-4 text-slate-500">✗ No</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Mobile Runbooks + AI</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Full</td>
                  <td className="py-3 px-4 text-slate-500">✗ Limited</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Starting Price</td>
                  <td className="py-3 px-4 text-green-600 font-medium">$0/month</td>
                  <td className="py-3 px-4 text-slate-500">$21/user</td>
                  <td className="py-3 px-4 text-slate-500">Bundled w/ JSM</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Sales Process</td>
                  <td className="py-3 px-4 text-green-600 font-medium">Self-serve</td>
                  <td className="py-3 px-4 text-slate-500">Required</td>
                  <td className="py-3 px-4 text-slate-500">Required</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 text-center">
            <p className="text-slate-600 italic text-lg">
              "We've carried the pager. We've written the runbooks at 3am. We've dealt with the enterprise vendors.
              OnCallShift is the platform we built because we couldn't find one that actually worked."
            </p>
            <Link to="/company/about" className="text-blue-600 hover:underline text-sm mt-3 inline-block">
              Meet the team →
            </Link>
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
                <li><Link to="/docs" className="hover:text-white">Documentation</Link></li>
                <li><Link to="/help" className="hover:text-white">Help Center</Link></li>
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

          <div className="border-t border-slate-800 mt-12 pt-8">
            <div className="text-center mb-4">
              <p className="text-slate-400 text-sm italic">
                Built by DevOps engineers who get paged. Questions?{' '}
                <a href="mailto:jarod@oncallshift.com" className="text-blue-400 hover:text-blue-300">
                  Email the founder
                </a>
              </p>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-slate-500">
                &copy; 2025 OnCallShift. All rights reserved.
              </p>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>🔒 SOC 2 Type II</span>
                <span>99.9% Uptime SLA</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

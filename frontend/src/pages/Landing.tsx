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

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow border-2 border-green-200 bg-green-50">
              <CardHeader>
                <div className="text-3xl mb-2">🏗️</div>
                <CardTitle className="text-lg">Terraform Provider</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="space-y-2">
                  <li>• <strong>Everything in code</strong> - schedules, policies, services</li>
                  <li>• <code className="bg-green-100 px-1 rounded text-xs">terraform apply</code> your on-call config</li>
                  <li>• GitOps workflows for incident management</li>
                  <li>• State management, drift detection, import</li>
                </ul>
                <Link to="/docs/terraform" className="text-green-700 font-medium text-sm mt-3 inline-block hover:underline">
                  Terraform docs →
                </Link>
              </CardContent>
            </Card>

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
                <CardTitle className="text-lg">Self-Healing Infrastructure</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="space-y-2">
                  <li>• AI <strong>resolves incidents</strong> while you sleep</li>
                  <li>• Auto-restarts, scales, and remediates</li>
                  <li>• <strong>80% target</strong> auto-resolution rate</li>
                  <li>• Human review for novel problems only</li>
                </ul>
                <Link to="/product/ai-diagnosis" className="text-blue-700 font-medium text-sm mt-3 inline-block hover:underline">
                  See how it works →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">🔮</div>
                <CardTitle className="text-lg">Predictive AI</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-2">
                  <li>• <strong>Prevent</strong> incidents before they happen</li>
                  <li>• Anomaly detection & capacity prediction</li>
                  <li>• Auto-scale before traffic spikes hit</li>
                  <li>• Risk scoring for deployments</li>
                </ul>
                <Link to="/product/predictive-ai" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Learn more →
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
                <div className="text-3xl mb-2">💻</div>
                <CardTitle className="text-lg">CLI & Developer Tools</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-2">
                  <li>• <code className="bg-slate-100 px-1 rounded text-xs">ocs incidents ack</code> from terminal</li>
                  <li>• GitHub Action for CI/CD integration</li>
                  <li>• Complete OpenAPI spec + SDKs</li>
                  <li>• Scriptable, automatable, developer-first</li>
                </ul>
                <Link to="/docs/cli" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  CLI reference →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-3xl mb-2">🔐</div>
                <CardTitle className="text-lg">Enterprise Ready</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-2">
                  <li>• <strong>SAML/OIDC SSO</strong> (Okta, Azure AD)</li>
                  <li>• SCIM provisioning for user sync</li>
                  <li>• SOC 2 Type II compliance</li>
                  <li>• RBAC, audit logs, data residency</li>
                </ul>
                <Link to="/company/security" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
                  Security details →
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

      {/* DevOps Integration Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-4">
            Built for the Modern DevOps Stack
          </h2>
          <p className="text-slate-600 text-center mb-10 max-w-2xl mx-auto">
            Integrates with the tools you already use. Infrastructure as code from day one.
          </p>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-6 mb-12">
            {[
              { name: 'Terraform', icon: '🏗️', category: 'IaC' },
              { name: 'Kubernetes', icon: '☸️', category: 'Orchestration' },
              { name: 'AWS', icon: '☁️', category: 'Cloud' },
              { name: 'Datadog', icon: '📊', category: 'Monitoring' },
              { name: 'Prometheus', icon: '🔥', category: 'Metrics' },
              { name: 'Slack', icon: '💬', category: 'Chat' },
              { name: 'GitHub', icon: '🐙', category: 'CI/CD' },
              { name: 'Docker', icon: '🐳', category: 'Container' },
              { name: 'GitLab', icon: '🦊', category: 'CI/CD' },
              { name: 'Grafana', icon: '📈', category: 'Dashboards' },
              { name: 'Azure', icon: '☁️', category: 'Cloud' },
              { name: 'GCP', icon: '☁️', category: 'Cloud' },
            ].map((tool, i) => (
              <div key={i} className="flex flex-col items-center text-center p-4 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="text-3xl mb-2">{tool.icon}</div>
                <div className="text-sm font-medium text-slate-900">{tool.name}</div>
                <div className="text-xs text-slate-500">{tool.category}</div>
              </div>
            ))}
          </div>

          {/* Terminal-style code example */}
          <div className="bg-slate-900 rounded-lg p-6 max-w-3xl mx-auto shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-500 text-sm ml-2 font-mono">terminal</span>
            </div>
            <div className="font-mono text-sm space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-green-400 select-none">$</span>
                <span className="text-slate-100">ocs incidents list --triggered</span>
              </div>
              <div className="text-slate-400 pl-4">
                <div className="text-red-400">INC-1234</div>
                <div>[P1] API Gateway 500 Errors - 5m ago</div>
              </div>
              <div className="flex items-start gap-2 mt-3">
                <span className="text-green-400 select-none">$</span>
                <span className="text-slate-100">ocs incidents ack INC-1234</span>
              </div>
              <div className="text-green-400 pl-4">Incident acknowledged.</div>
              <div className="flex items-start gap-2 mt-3">
                <span className="text-green-400 select-none">$</span>
                <span className="text-slate-100">terraform apply -target=oncallshift_schedule.primary</span>
              </div>
              <div className="text-slate-400 pl-4">Apply complete! Resources: 1 updated.</div>
            </div>
          </div>

          <p className="text-center text-slate-500 text-sm mt-6">
            Everything as code. Everything automated. Everything auditable.
          </p>
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
                <tr className="border-b bg-green-50">
                  <td className="py-3 px-4 font-medium">Terraform Provider</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Full IaC support</td>
                  <td className="py-3 px-4 text-slate-500">✓ Available</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b bg-purple-50">
                  <td className="py-3 px-4 font-medium">MCP Server (AI Assistant)</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Full integration</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Self-Healing (Auto-Resolution)</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ 80% target</td>
                  <td className="py-3 px-4 text-slate-500">Suggestions only</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Cloud Investigation</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Direct (AWS/Azure/GCP)</td>
                  <td className="py-3 px-4 text-slate-500">Via integrations</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">CLI Tool</td>
                  <td className="py-3 px-4 text-green-600 font-medium">✓ Full CLI (ocs)</td>
                  <td className="py-3 px-4 text-slate-500">✓ pd CLI</td>
                  <td className="py-3 px-4 text-slate-500">Limited</td>
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

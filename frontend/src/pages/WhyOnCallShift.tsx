import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function WhyOnCallShift() {
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
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span>🤖</span>
            The only incident platform with MCP server integration
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Why Choose OnCallShift?
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Built by DevOps veterans with 15+ years of on-call experience.
            An honest comparison with PagerDuty and OpsGenie—from people who've used them all.
          </p>
        </div>
      </section>

      {/* OnCallShift vs PagerDuty */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">OnCallShift vs. PagerDuty</h2>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2">
                  <th className="py-4 px-4 font-semibold">Feature</th>
                  <th className="py-4 px-4 font-semibold text-blue-600">OnCallShift</th>
                  <th className="py-4 px-4 font-semibold text-slate-500">PagerDuty</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b bg-green-50">
                  <td className="py-3 px-4 font-medium">Terraform Provider</td>
                  <td className="py-3 px-4 text-green-600">✓ Full IaC support</td>
                  <td className="py-3 px-4 text-slate-500">✓ Available</td>
                </tr>
                <tr className="border-b bg-purple-50">
                  <td className="py-3 px-4 font-medium">MCP Server (AI Assistants)</td>
                  <td className="py-3 px-4 text-green-600">✓ Full integration (Claude, Cursor)</td>
                  <td className="py-3 px-4 text-slate-500">✗ None</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Self-Healing (Auto-Resolution)</td>
                  <td className="py-3 px-4 text-green-600">✓ 80% target auto-resolution</td>
                  <td className="py-3 px-4 text-slate-500">Suggestions only</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Cloud Investigation</td>
                  <td className="py-3 px-4 text-green-600">✓ Direct (AWS/Azure/GCP)</td>
                  <td className="py-3 px-4 text-slate-500">Via Slack/Integrations</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">CLI Tool</td>
                  <td className="py-3 px-4 text-green-600">✓ Full CLI (ocs)</td>
                  <td className="py-3 px-4 text-slate-500">✓ pd CLI</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">BYOK (Bring Your Own Key)</td>
                  <td className="py-3 px-4 text-green-600">✓ Use your Anthropic API key</td>
                  <td className="py-3 px-4 text-slate-500">✗ Not available</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Setup Time</td>
                  <td className="py-3 px-4 text-green-600">5 minutes (or via AI/Terraform)</td>
                  <td className="py-3 px-4 text-slate-500">Days (CSM required)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Starting Price</td>
                  <td className="py-3 px-4 text-green-600">$0/month (10 users free)</td>
                  <td className="py-3 px-4 text-slate-500">$21/user/month</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-bold text-green-900 mb-3">Where We Win</h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li><strong>Terraform Provider:</strong> Full IaC support—manage on-call as code</li>
                <li><strong>MCP Server:</strong> Configure your org from Claude Code or Cursor</li>
                <li><strong>Self-Healing:</strong> AI resolves 80% of incidents without waking you</li>
                <li><strong>Cloud Investigation:</strong> AI queries your AWS/GCP/Azure directly</li>
                <li><strong>CLI Tool:</strong> Full <code className="bg-green-100 px-1 rounded">ocs</code> CLI for automation</li>
                <li><strong>BYOK:</strong> Use your own Anthropic API key for compliance</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <h3 className="font-bold text-slate-900 mb-3">Where They Have an Edge</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>15+ years of brand recognition</li>
                <li>Larger third-party integration ecosystem</li>
                <li>Enterprise sales team (some buyers prefer this)</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mb-8">
            <p className="font-semibold text-blue-900 mb-2">When to Choose OnCallShift:</p>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• You're an engineer/DevOps practitioner (not a procurement team)</li>
              <li>• You have &lt; 100 on-call engineers</li>
              <li>• You want AI without enterprise contract</li>
              <li>• You need mobile-first experience</li>
              <li>• You value transparent pricing</li>
              <li>• You want software built by people who get paged</li>
            </ul>
          </div>

          <div className="bg-slate-50 border-l-4 border-slate-400 p-6">
            <p className="font-semibold text-slate-900 mb-2">When to Choose PagerDuty:</p>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>• You have 500+ users</li>
              <li>• You need extensive legacy integrations</li>
              <li>• You have budget for enterprise sales process</li>
              <li>• You prefer talking to sales reps over trying the product</li>
            </ul>
          </div>
        </div>
      </section>

      {/* OnCallShift vs OpsGenie */}
      <section className="bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">OnCallShift vs. OpsGenie</h2>

            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-6 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-orange-900 mb-2">OpsGenie Sunsetting April 2027</p>
                  <p className="text-orange-800 text-sm">
                    Atlassian is forcing users to migrate to Jira Service Management (JSM). Don't get locked into expensive JSM licenses.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left border-collapse bg-white">
                <thead>
                  <tr className="border-b-2">
                    <th className="py-4 px-4 font-semibold">Feature</th>
                    <th className="py-4 px-4 font-semibold text-blue-600">OnCallShift</th>
                    <th className="py-4 px-4 font-semibold text-slate-500">OpsGenie</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Future-Proof</td>
                    <td className="py-3 px-4 text-green-600">✓ Active development</td>
                    <td className="py-3 px-4 text-red-600">✗ Sunsetting Apr 2027</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">AI Capabilities</td>
                    <td className="py-3 px-4 text-green-600">✓ Diagnosis + Execution</td>
                    <td className="py-3 px-4 text-slate-500">✗ None</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Mobile Experience</td>
                    <td className="py-3 px-4 text-green-600">✓ Full-featured</td>
                    <td className="py-3 px-4 text-slate-500">Basic</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Pricing</td>
                    <td className="py-3 px-4 text-green-600">Standalone ($0-19/user)</td>
                    <td className="py-3 px-4 text-red-600">Forces JSM bundle</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Migration</td>
                    <td className="py-3 px-4 text-green-600">One-click import</td>
                    <td className="py-3 px-4 text-slate-500">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-blue-600 text-white rounded-lg p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Migrate from OpsGenie in 30 Minutes</h3>
              <p className="mb-6">
                OnCallShift imports your schedules, policies, and teams in one click. Plus AI features OpsGenie never had.
              </p>
              <Link to="/migrate/from-opsgenie">
                <Button size="lg" variant="secondary">
                  View Migration Guide →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Enterprise-Grade Security</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Your incident data is sensitive. We protect it with the same rigor we'd use for our own production systems.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="border-2 border-slate-200 rounded-lg p-6">
              <div className="text-2xl mb-3">🔐</div>
              <h3 className="font-bold mb-2">Encryption Everywhere</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• TLS 1.3 for all data in transit</li>
                <li>• AES-256 encryption at rest</li>
                <li>• AWS KMS for key management</li>
                <li>• API keys hashed with bcrypt</li>
              </ul>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <div className="text-2xl mb-3">🏛️</div>
              <h3 className="font-bold mb-2">SOC 2 Type II Compliant</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• Annual third-party audits</li>
                <li>• Continuous monitoring</li>
                <li>• Documented security policies</li>
                <li>• Vendor security assessments</li>
              </ul>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <div className="text-2xl mb-3">🔑</div>
              <h3 className="font-bold mb-2">Authentication & Access</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• SAML 2.0 / OIDC SSO</li>
                <li>• SCIM user provisioning</li>
                <li>• Role-based access control (RBAC)</li>
                <li>• MFA enforcement</li>
              </ul>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-bold mb-2">Audit & Compliance</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• Immutable audit logs</li>
                <li>• User activity tracking</li>
                <li>• Data retention controls</li>
                <li>• GDPR data export/deletion</li>
              </ul>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <div className="text-2xl mb-3">🏗️</div>
              <h3 className="font-bold mb-2">Infrastructure Security</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• AWS VPC isolation</li>
                <li>• Private subnets for databases</li>
                <li>• WAF protection</li>
                <li>• DDoS mitigation via CloudFront</li>
              </ul>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-6">
              <div className="text-2xl mb-3">🤖</div>
              <h3 className="font-bold mb-2">AI Data Privacy</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• BYOK—your API key, your data</li>
                <li>• No training on your incidents</li>
                <li>• PII redaction options</li>
                <li>• AI audit trail per request</li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-8">
            <h3 className="font-bold text-lg mb-4">Your Cloud Credentials Are Safe</h3>
            <p className="text-slate-600 mb-4">
              When you connect AWS, GCP, or Azure for cloud investigation, we treat your credentials with extreme care:
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Encrypted storage:</strong> Credentials encrypted with AES-256 via AWS Secrets Manager</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Minimal permissions:</strong> We request only read-only access to logs and metrics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Your account, our SDK:</strong> AI uses your credentials via AWS SDK—we never store query results</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Revoke anytime:</strong> Instantly revoke access from your OnCallShift settings</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Cost Comparison */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Real Cost Comparison</h2>

          <div className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b-2">
              <p className="font-semibold">Example: 20-person engineering team</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <div>
                    <p className="font-semibold">PagerDuty Professional</p>
                    <p className="text-sm text-slate-500">20 users × $41/month (no AI)</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-700">$820/mo</p>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <div>
                    <p className="font-semibold">OpsGenie Standard + JSM</p>
                    <p className="text-sm text-slate-500">20 users × $35/month (estimated)</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-700">$700/mo</p>
                </div>
                <div className="flex justify-between items-center py-3 bg-green-50 px-4 rounded-lg">
                  <div>
                    <p className="font-semibold text-green-900">OnCallShift Professional</p>
                    <p className="text-sm text-green-700">20 users × $19/month (AI included)</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">$380/mo</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t-2">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-semibold">Your Savings with OnCallShift:</p>
                  <p className="text-3xl font-bold text-green-600">$5,280/year</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Switch?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Start your free trial today. Import from PagerDuty or OpsGenie in minutes. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                View Pricing
              </Button>
            </Link>
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

import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function WhyOnCallShift() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span>🤖</span>
            The only incident platform with MCP server integration
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Why Choose OnCallShift?
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Built by DevOps veterans with 15+ years of on-call experience.
            An honest comparison with PagerDuty and OpsGenie—from people who've used them all.
          </p>
        </div>
      </section>

      {/* OnCallShift vs PagerDuty */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-white">OnCallShift vs. PagerDuty</h2>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-white/5">
                  <th className="py-4 px-4 font-semibold text-white">Feature</th>
                  <th className="py-4 px-4 font-semibold text-teal-400">OnCallShift</th>
                  <th className="py-4 px-4 font-semibold text-slate-400">PagerDuty</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-white/5 bg-green-500/10">
                  <td className="py-3 px-4 font-medium text-white">Terraform Provider</td>
                  <td className="py-3 px-4 text-green-400">✓ Full IaC support</td>
                  <td className="py-3 px-4 text-slate-400">✓ Available</td>
                </tr>
                <tr className="border-b border-white/5 bg-purple-500/10">
                  <td className="py-3 px-4 font-medium text-white">MCP Server (AI Assistants)</td>
                  <td className="py-3 px-4 text-green-400">✓ Full integration (Claude, Cursor)</td>
                  <td className="py-3 px-4 text-slate-400">✗ None</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 font-medium text-white">Self-Healing (Auto-Resolution)</td>
                  <td className="py-3 px-4 text-green-400">✓ 80% target auto-resolution</td>
                  <td className="py-3 px-4 text-slate-400">Suggestions only</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 font-medium text-white">Cloud Investigation</td>
                  <td className="py-3 px-4 text-green-400">✓ Direct (AWS/Azure/GCP)</td>
                  <td className="py-3 px-4 text-slate-400">Via Slack/Integrations</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 font-medium text-white">CLI Tool</td>
                  <td className="py-3 px-4 text-green-400">✓ Full CLI (ocs)</td>
                  <td className="py-3 px-4 text-slate-400">✓ pd CLI</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 font-medium text-white">BYOK (Bring Your Own Key)</td>
                  <td className="py-3 px-4 text-green-400">✓ Use your Anthropic API key</td>
                  <td className="py-3 px-4 text-slate-400">✗ Not available</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-4 font-medium text-white">Setup Time</td>
                  <td className="py-3 px-4 text-green-400">5 minutes (or via AI/Terraform)</td>
                  <td className="py-3 px-4 text-slate-400">Days (CSM required)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
              <h3 className="font-bold text-green-300 mb-3">Where We Win</h3>
              <ul className="space-y-2 text-sm text-green-200">
                <li><strong>Terraform Provider:</strong> Full IaC support—manage on-call as code</li>
                <li><strong>MCP Server:</strong> Configure your org from Claude Code or Cursor</li>
                <li><strong>Self-Healing:</strong> AI resolves 80% of incidents without waking you</li>
                <li><strong>Cloud Investigation:</strong> AI queries your AWS/GCP/Azure directly</li>
                <li><strong>CLI Tool:</strong> Full <code className="bg-green-500/20 px-1 rounded">ocs</code> CLI for automation</li>
                <li><strong>BYOK:</strong> Use your own Anthropic API key for compliance</li>
              </ul>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6">
              <h3 className="font-bold text-white mb-3">Where They Have an Edge</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>15+ years of brand recognition</li>
                <li>Larger third-party integration ecosystem</li>
                <li>Enterprise sales team (some buyers prefer this)</li>
              </ul>
            </div>
          </div>

          <div className="bg-teal-500/10 border-l-4 border-teal-500 p-6 mb-8">
            <p className="font-semibold text-teal-300 mb-2">When to Choose OnCallShift:</p>
            <ul className="space-y-1 text-sm text-teal-200">
              <li>• You're an engineer/DevOps practitioner (not a procurement team)</li>
              <li>• You have &lt; 100 on-call engineers</li>
              <li>• You want AI without enterprise contract</li>
              <li>• You need mobile-first experience</li>
              <li>• You value transparency and self-serve tooling</li>
              <li>• You want software built by people who get paged</li>
            </ul>
          </div>

          <div className="bg-white/[0.02] border-l-4 border-slate-500 p-6">
            <p className="font-semibold text-white mb-2">When to Choose PagerDuty:</p>
            <ul className="space-y-1 text-sm text-slate-300">
              <li>• You have 500+ users</li>
              <li>• You need extensive legacy integrations</li>
              <li>• You have budget for enterprise sales process</li>
              <li>• You prefer talking to sales reps over trying the product</li>
            </ul>
          </div>
        </div>
      </section>

      {/* OnCallShift vs OpsGenie */}
      <section className="bg-white/[0.02] py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-white">OnCallShift vs. OpsGenie</h2>

            <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-lg p-6 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-orange-300 mb-2">OpsGenie Sunsetting April 2027</p>
                  <p className="text-orange-200 text-sm">
                    Atlassian is forcing users to migrate to Jira Service Management (JSM). Don't get locked into expensive JSM licenses.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left border-collapse bg-white/[0.03]">
                <thead>
                  <tr className="border-b-2 border-white/5">
                    <th className="py-4 px-4 font-semibold text-white">Feature</th>
                    <th className="py-4 px-4 font-semibold text-teal-400">OnCallShift</th>
                    <th className="py-4 px-4 font-semibold text-slate-400">OpsGenie</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-medium text-white">Future-Proof</td>
                    <td className="py-3 px-4 text-green-400">✓ Active development</td>
                    <td className="py-3 px-4 text-red-400">✗ Sunsetting Apr 2027</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-medium text-white">AI Capabilities</td>
                    <td className="py-3 px-4 text-green-400">✓ Diagnosis + Execution</td>
                    <td className="py-3 px-4 text-slate-400">✗ None</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-medium text-white">Mobile Experience</td>
                    <td className="py-3 px-4 text-green-400">✓ Full-featured</td>
                    <td className="py-3 px-4 text-slate-400">Basic</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4 font-medium text-white">Migration</td>
                    <td className="py-3 px-4 text-green-400">One-click import</td>
                    <td className="py-3 px-4 text-slate-400">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-teal-500 text-white rounded-lg p-8 text-center">
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
          <h2 className="text-3xl font-bold text-center mb-4 text-white">Enterprise-Grade Security</h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Your incident data is sensitive. We protect it with the same rigor we'd use for our own production systems.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="border-2 border-white/5 rounded-lg p-6">
              <div className="text-2xl mb-3">🔐</div>
              <h3 className="font-bold mb-2 text-white">Encryption Everywhere</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• TLS 1.3 for all data in transit</li>
                <li>• AES-256 encryption at rest</li>
                <li>• AWS KMS for key management</li>
                <li>• API keys hashed with bcrypt</li>
              </ul>
            </div>

            <div className="border-2 border-white/5 rounded-lg p-6">
              <div className="text-2xl mb-3">🏛️</div>
              <h3 className="font-bold mb-2 text-white">SOC 2 Type II Compliant</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• Annual third-party audits</li>
                <li>• Continuous monitoring</li>
                <li>• Documented security policies</li>
                <li>• Vendor security assessments</li>
              </ul>
            </div>

            <div className="border-2 border-white/5 rounded-lg p-6">
              <div className="text-2xl mb-3">🔑</div>
              <h3 className="font-bold mb-2 text-white">Authentication & Access</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• SAML 2.0 / OIDC SSO</li>
                <li>• SCIM user provisioning</li>
                <li>• Role-based access control (RBAC)</li>
                <li>• MFA enforcement</li>
              </ul>
            </div>

            <div className="border-2 border-white/5 rounded-lg p-6">
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-bold mb-2 text-white">Audit & Compliance</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• Immutable audit logs</li>
                <li>• User activity tracking</li>
                <li>• Data retention controls</li>
                <li>• GDPR data export/deletion</li>
              </ul>
            </div>

            <div className="border-2 border-white/5 rounded-lg p-6">
              <div className="text-2xl mb-3">🏗️</div>
              <h3 className="font-bold mb-2 text-white">Infrastructure Security</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• AWS VPC isolation</li>
                <li>• Private subnets for databases</li>
                <li>• WAF protection</li>
                <li>• DDoS mitigation via CloudFront</li>
              </ul>
            </div>

            <div className="border-2 border-white/5 rounded-lg p-6">
              <div className="text-2xl mb-3">🤖</div>
              <h3 className="font-bold mb-2 text-white">AI Data Privacy</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• BYOK—your API key, your data</li>
                <li>• No training on your incidents</li>
                <li>• PII redaction options</li>
                <li>• AI audit trail per request</li>
              </ul>
            </div>
          </div>

          <div className="bg-white/[0.02] border-2 border-white/5 rounded-lg p-8">
            <h3 className="font-bold text-lg mb-4 text-white">Your Cloud Credentials Are Safe</h3>
            <p className="text-slate-400 mb-4">
              When you connect AWS, GCP, or Azure for cloud investigation, we treat your credentials with extreme care:
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span><strong>Encrypted storage:</strong> Credentials encrypted with AES-256 via AWS Secrets Manager</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span><strong>Minimal permissions:</strong> We request only read-only access to logs and metrics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span><strong>Your account, our SDK:</strong> AI uses your credentials via AWS SDK—we never store query results</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span><strong>Revoke anytime:</strong> Instantly revoke access from your OnCallShift settings</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-r from-teal-500 to-cyan-500 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Switch?
          </h2>
          <p className="text-teal-100 text-lg mb-8 max-w-2xl mx-auto">
            Join the waitlist today. Be first to know when we launch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary">
                Join Waitlist
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

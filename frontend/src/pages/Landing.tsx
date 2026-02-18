import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

/* ── WorkerMill logo icon (layered-diamond SVG matching workermill.com) ── */
function WorkerMillIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── "Built by WorkerMill" badge (matches workermill.com showcase style) ── */
function BuiltByBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'md'
    ? 'px-4 py-2 text-sm gap-2'
    : 'px-3 py-1.5 text-xs gap-1.5';
  return (
    <a
      href="https://workermill.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center ${sizeClasses} rounded-full bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30 text-teal-300 hover:text-teal-200 hover:border-teal-400/40 transition-colors`}
    >
      <span className="w-4 h-4 rounded bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
        <WorkerMillIcon className="w-2.5 h-2.5 text-white" />
      </span>
      Built by WorkerMill
    </a>
  );
}

export function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-teal-500/30">
      {/* ── Subtle grid pattern overlay ── */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════
          NAVIGATION
      ══════════════════════════════════════════════════════════════════ */}
      <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5">
                <span className="text-2xl">📟</span>
                <span className="text-xl font-bold text-white tracking-tight">
                  OnCallShift
                </span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1">
                <div className="relative group">
                  <button className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-1 transition-colors">
                    Product
                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="bg-slate-900 rounded-xl shadow-2xl shadow-black/50 border border-white/10 p-2 w-64 backdrop-blur-xl">
                      <Link to="/product/on-call-scheduling" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">On-Call Scheduling</Link>
                      <Link to="/product/incident-management" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Incident Management</Link>
                      <Link to="/product/escalation-policies" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Escalation Policies</Link>
                      <Link to="/product/ai-diagnosis" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">AI Diagnosis</Link>
                      <Link to="/product/integrations" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Integrations</Link>
                      <Link to="/product/mobile-app" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Mobile App</Link>
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <button className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-1 transition-colors">
                    Solutions
                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="bg-slate-900 rounded-xl shadow-2xl shadow-black/50 border border-white/10 p-2 w-72 backdrop-blur-xl">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1 px-3 pt-1">Alternatives</div>
                      <Link to="/alternatives/pagerduty" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">PagerDuty Alternative</Link>
                      <Link to="/alternatives/opsgenie" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Opsgenie Alternative</Link>
                      <div className="border-t border-white/5 my-1.5"></div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1 px-3">Migration</div>
                      <Link to="/migrate/from-opsgenie" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-amber-400 font-medium transition-colors">Migrate from Opsgenie</Link>
                      <Link to="/migrate/from-pagerduty" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Migrate from PagerDuty</Link>
                    </div>
                  </div>
                </div>

                <Link to="/pricing" className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  Pricing
                </Link>

                <div className="relative group">
                  <button className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-1 transition-colors">
                    Resources
                    <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="bg-slate-900 rounded-xl shadow-2xl shadow-black/50 border border-white/10 p-2 w-56 backdrop-blur-xl">
                      <Link to="/docs" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Documentation</Link>
                      <Link to="/help" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Help Center</Link>
                      <a href="/api-docs" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">API Reference</a>
                      <Link to="/blog" className="block px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-slate-300 hover:text-white transition-colors">Blog</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login" className="hidden md:block">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/5">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-lg shadow-teal-500/20">
                  Start Free Trial
                </Button>
              </Link>
              <button
                className="lg:hidden p-2 text-slate-400 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 pb-4 border-t border-white/5 pt-4">
              <div className="space-y-1">
                <Link to="/product/on-call-scheduling" className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">On-Call Scheduling</Link>
                <Link to="/product/incident-management" className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Incident Management</Link>
                <Link to="/pricing" className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Pricing</Link>
                <Link to="/migrate/from-opsgenie" className="block py-2.5 px-3 rounded-lg text-sm font-medium text-amber-400">Migrate from Opsgenie</Link>
                <Link to="/migrate/from-pagerduty" className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Migrate from PagerDuty</Link>
                <Link to="/docs" className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Documentation</Link>
                <Link to="/login" className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Login</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-teal-500/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300">
                <span>🤖</span>
                The first incident platform with an MCP server
                <Link to="/docs/ai/mcp" className="text-teal-400 hover:text-teal-300 font-medium">
                  Learn more →
                </Link>
              </div>
              <BuiltByBadge size="md" />
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
              The AI-Native{' '}
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Incident Platform
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 mb-4 max-w-2xl mx-auto leading-relaxed">
              Configure your org through Claude Code. Migrate from competitors with a conversation.
              Let AI diagnose and fix incidents while you sleep.
            </p>

            <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
              Built by DevOps veterans with 15+ years of on-call experience. We've carried the pager,
              managed the escalations, and written the runbooks. Now we're building the platform we always wanted.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Link to="/register">
                <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-lg px-8 h-12 shadow-lg shadow-teal-500/25 hover:shadow-teal-400/30 transition-all">
                  Start Free Trial
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                  Watch Demo
                </Button>
              </Link>
            </div>

            <p className="text-sm text-slate-500">
              No credit card required · Set up in 5 minutes · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── Social proof bar ── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">★★★★★</span>
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

      {/* ══════════════════════════════════════════════════════════════════
          PROBLEM / SOLUTION
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-14">
            The Old Way vs. The OnCallShift Way
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-8 bg-red-500/5 border border-red-500/20">
              <div className="text-red-400 font-bold text-xl mb-5 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-base">✕</span>
                The Old Way
              </div>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-start gap-2"><span className="text-red-500/50 mt-0.5">•</span> Alert goes off at 3am</li>
                <li className="flex items-start gap-2"><span className="text-red-500/50 mt-0.5">•</span> Scramble to laptop</li>
                <li className="flex items-start gap-2"><span className="text-red-500/50 mt-0.5">•</span> Dig through logs</li>
                <li className="flex items-start gap-2"><span className="text-red-500/50 mt-0.5">•</span> Google the error</li>
                <li className="flex items-start gap-2"><span className="text-red-500/50 mt-0.5">•</span> Try random fixes</li>
                <li className="flex items-start gap-2"><span className="text-red-500/50 mt-0.5">•</span> 2 hours later: finally resolved</li>
              </ul>
            </div>
            <div className="rounded-2xl p-8 bg-teal-500/5 border border-teal-500/20">
              <div className="text-teal-400 font-bold text-xl mb-5 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-base">✓</span>
                The OnCallShift Way
              </div>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-2"><span className="text-teal-500/50 mt-0.5">•</span> Alert goes off at 3am</li>
                <li className="flex items-start gap-2"><span className="text-teal-500/50 mt-0.5">•</span> Open phone, see AI diagnosis</li>
                <li className="flex items-start gap-2"><span className="text-teal-500/50 mt-0.5">•</span> Tap "Restart Pods"</li>
                <li className="flex items-start gap-2"><span className="text-teal-500/50 mt-0.5">•</span> AI confirms it worked</li>
                <li className="flex items-start gap-2"><span className="text-teal-500/50 mt-0.5">•</span> Back to sleep in 60 seconds</li>
                <li className="flex items-start gap-2"><span className="text-teal-500/50 mt-0.5">•</span> <strong className="text-teal-300">Your laptop stays in your bag</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Built for the AI Era</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              The only incident platform your AI assistant can configure, migrate, and operate
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {/* Highlight cards */}
            <FeatureCard
              icon="🏗️"
              title="Terraform Provider"
              accent="teal"
              items={[
                <><strong>Everything in code</strong> — schedules, policies, services</>,
                <><code className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">terraform apply</code> your on-call config</>,
                'GitOps workflows for incident management',
                'State management, drift detection, import',
              ]}
              link={{ to: '/docs/terraform', label: 'Terraform docs →' }}
            />
            <FeatureCard
              icon="🔌"
              title="MCP Server Integration"
              accent="cyan"
              items={[
                <><strong>Configure</strong> your org from Claude Code</>,
                <><strong>Migrate</strong> from PagerDuty with a conversation</>,
                'Manage incidents from your IDE',
                'Works with Cursor, VS Code, any MCP client',
              ]}
              link={{ to: '/docs/ai/mcp', label: 'Set up MCP →' }}
            />
            <FeatureCard
              icon="🤖"
              title="Self-Healing Infrastructure"
              accent="blue"
              items={[
                <>AI <strong>resolves incidents</strong> while you sleep</>,
                'Auto-restarts, scales, and remediates',
                <><strong>80% target</strong> auto-resolution rate</>,
                'Human review for novel problems only',
              ]}
              link={{ to: '/product/ai-diagnosis', label: 'See how it works →' }}
            />
            <FeatureCard
              icon="🔮"
              title="Predictive AI"
              items={[
                <><strong>Prevent</strong> incidents before they happen</>,
                'Anomaly detection & capacity prediction',
                'Auto-scale before traffic spikes hit',
                'Risk scoring for deployments',
              ]}
              link={{ to: '/product/predictive-ai', label: 'Learn more →' }}
            />
            <FeatureCard
              icon="☁️"
              title="Cloud Investigation"
              items={[
                'Connect your AWS/GCP/Azure credentials',
                'AI queries CloudWatch, ECS, EC2 directly',
                'Root cause analysis in seconds',
                'Your credentials, your data, your control',
              ]}
              link={{ to: '/product/cloud-investigation', label: 'Learn more →' }}
            />
            <FeatureCard
              icon="💻"
              title="CLI & Developer Tools"
              items={[
                <><code className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">ocs incidents ack</code> from terminal</>,
                'GitHub Action for CI/CD integration',
                'Complete OpenAPI spec + SDKs',
                'Scriptable, automatable, developer-first',
              ]}
              link={{ to: '/docs/cli', label: 'CLI reference →' }}
            />
            <FeatureCard
              icon="🔐"
              title="Enterprise Ready"
              items={[
                <><strong>SAML/OIDC SSO</strong> (Okta, Azure AD)</>,
                'SCIM provisioning for user sync',
                'SOC 2 Type II compliance',
                'RBAC, audit logs, data residency',
              ]}
              link={{ to: '/company/security', label: 'Security details →' }}
            />
            <FeatureCard
              icon="📱"
              title="Designed for 3am Wake-Ups"
              items={[
                'Native iOS & Android apps',
                'One-tap incident actions',
                'Execute runbooks from phone',
                'AI chat on mobile',
              ]}
              link={{ to: '/product/mobile-app', label: 'Learn more →' }}
            />
            <FeatureCard
              icon="🔄"
              title="Zero-Friction Migration"
              items={[
                'Import from PagerDuty or Opsgenie',
                'Preserves integration keys',
                'Migrate via AI conversation',
                'Zero downtime cutover',
              ]}
              link={{ to: '/migrate/from-pagerduty', label: 'Migration guide →' }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          DEVOPS INTEGRATION
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-3">
            Built for the Modern DevOps Stack
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Integrates with the tools you already use. Infrastructure as code from day one.
          </p>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-14">
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
              <div key={i} className="flex flex-col items-center text-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                <div className="text-2xl mb-1.5">{tool.icon}</div>
                <div className="text-sm font-medium text-slate-300">{tool.name}</div>
                <div className="text-xs text-slate-600">{tool.category}</div>
              </div>
            ))}
          </div>

          {/* Terminal */}
          <div className="bg-slate-900 rounded-2xl p-6 max-w-3xl mx-auto shadow-2xl shadow-black/50 border border-white/5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <span className="text-slate-600 text-xs ml-2 font-mono">terminal</span>
            </div>
            <div className="font-mono text-sm space-y-3 text-slate-400">
              <div className="flex items-start gap-2">
                <span className="text-teal-400 select-none">$</span>
                <span className="text-slate-200">ocs incidents list --triggered</span>
              </div>
              <div className="pl-4">
                <div className="text-red-400">INC-1234</div>
                <div>[P1] API Gateway 500 Errors — 5m ago</div>
              </div>
              <div className="flex items-start gap-2 mt-1">
                <span className="text-teal-400 select-none">$</span>
                <span className="text-slate-200">ocs incidents ack INC-1234</span>
              </div>
              <div className="text-teal-400 pl-4">Incident acknowledged.</div>
              <div className="flex items-start gap-2 mt-1">
                <span className="text-teal-400 select-none">$</span>
                <span className="text-slate-200">terraform apply -target=oncallshift_schedule.primary</span>
              </div>
              <div className="text-slate-500 pl-4">Apply complete! Resources: 1 updated.</div>
            </div>
          </div>

          <p className="text-center text-slate-600 text-sm mt-6">
            Everything as code. Everything automated. Everything auditable.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          COMPARISON TABLE
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Built by DevOps Veterans, for DevOps Teams
          </h2>
          <p className="text-slate-400 text-center mb-14 max-w-2xl mx-auto">
            We've spent 15+ years managing production systems, carrying pagers, and building infrastructure at scale.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="py-4 px-5 font-semibold text-slate-400 text-sm"></th>
                  <th className="py-4 px-5 font-semibold text-teal-400 text-sm">OnCallShift</th>
                  <th className="py-4 px-5 font-semibold text-slate-500 text-sm">PagerDuty</th>
                  <th className="py-4 px-5 font-semibold text-slate-500 text-sm">OpsGenie</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['Terraform Provider', '✓ Full IaC support', '✓ Available', '✗ None', true],
                  ['MCP Server (AI Assistant)', '✓ Full integration', '✗ None', '✗ None', true],
                  ['Self-Healing (Auto-Resolution)', '✓ 80% target', 'Suggestions only', '✗ None', false],
                  ['Cloud Investigation', '✓ Direct (AWS/Azure/GCP)', 'Via integrations', '✗ None', false],
                  ['CLI Tool', '✓ Full CLI (ocs)', '✓ pd CLI', 'Limited', false],
                  ['BYOK (Bring Your Own Key)', '✓ Yes', '✗ No', '✗ No', false],
                  ['Mobile Runbooks + AI', '✓ Full', '✗ Limited', '✗ None', false],
                  ['Starting Price', '$0/month', '$21/user', 'Bundled w/ JSM', false],
                ].map(([feature, ocs, pd, og, highlight], i) => (
                  <tr key={i} className={`border-b border-white/5 ${highlight ? 'bg-teal-500/5' : 'hover:bg-white/[0.02]'}`}>
                    <td className="py-3.5 px-5 font-medium text-slate-300">{feature as string}</td>
                    <td className="py-3.5 px-5 text-teal-400 font-medium">{ocs as string}</td>
                    <td className="py-3.5 px-5 text-slate-500">{pd as string}</td>
                    <td className="py-3.5 px-5 text-slate-500">{og as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 text-center">
            <p className="text-slate-400 italic text-lg max-w-2xl mx-auto leading-relaxed">
              "We've carried the pager. We've written the runbooks at 3am. We've dealt with the enterprise vendors.
              OnCallShift is the platform we built because we couldn't find one that actually worked."
            </p>
            <Link to="/company/about" className="text-teal-400 hover:text-teal-300 text-sm mt-3 inline-block font-medium">
              Meet the team →
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          OPSGENIE MIGRATION CTA
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-4xl mb-4">🔔</div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Migrating from Opsgenie?
          </h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            Opsgenie sunsets April 2027. Don't get forced into expensive JSM licenses.
            OnCallShift imports your schedules, policies, and teams in one click.
          </p>
          <Link to="/migrate/from-opsgenie">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-500/20">
              See Migration Guide →
            </Button>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-14">
            What Teams Are Saying
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                quote: "We switched from PagerDuty and cut our bill by 60%. Setup took 20 minutes.",
                initials: 'JD', name: 'James D.', role: 'SRE Lead',
                color: 'from-teal-400 to-cyan-400',
              },
              {
                quote: "The AI diagnosis feature found a memory leak we'd been hunting for weeks.",
                initials: 'SK', name: 'Sarah K.', role: 'Platform Engineer',
                color: 'from-violet-400 to-purple-400',
              },
              {
                quote: "Finally, an on-call tool our team doesn't complain about.",
                initials: 'MT', name: 'Mike T.', role: 'Engineering Manager',
                color: 'from-emerald-400 to-green-400',
              },
            ].map((t, i) => (
              <div key={i} className="rounded-2xl p-6 bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-slate-300 italic mb-5 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-semibold text-sm`}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-white">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[200px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Ready to Fix On-Call?
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Start your free trial today. No credit card required. Set up in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-lg px-8 h-12 shadow-lg shadow-teal-500/25">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                Schedule Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/5 pt-16 pb-10 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-2xl">📟</span>
                <span className="font-bold text-lg text-white">OnCallShift</span>
              </div>
              <p className="text-sm text-slate-500 mb-5 max-w-xs leading-relaxed">
                On-call scheduling and incident management for teams who ship fast.
              </p>

              {/* Built by WorkerMill — footer badge */}
              <a
                href="https://workermill.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-teal-500/30 transition-colors group mb-6"
              >
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
                  <WorkerMillIcon className="w-4 h-4 text-white" />
                </span>
                <span className="flex flex-col">
                  <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors leading-tight">Built by</span>
                  <span className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors leading-tight">WorkerMill</span>
                </span>
              </a>

              <div className="flex gap-4">
                <a href="#" className="text-slate-600 hover:text-white transition-colors text-sm">
                  𝕏
                </a>
                <a href="#" className="text-slate-600 hover:text-white transition-colors text-sm">
                  GitHub
                </a>
                <a href="#" className="text-slate-600 hover:text-white transition-colors text-sm">
                  LinkedIn
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Product</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/product/on-call-scheduling" className="text-slate-500 hover:text-white transition-colors">On-Call Scheduling</Link></li>
                <li><Link to="/product/incident-management" className="text-slate-500 hover:text-white transition-colors">Incident Management</Link></li>
                <li><Link to="/product/escalation-policies" className="text-slate-500 hover:text-white transition-colors">Escalation Policies</Link></li>
                <li><Link to="/product/ai-diagnosis" className="text-slate-500 hover:text-white transition-colors">AI Diagnosis</Link></li>
                <li><Link to="/product/integrations" className="text-slate-500 hover:text-white transition-colors">Integrations</Link></li>
                <li><Link to="/pricing" className="text-slate-500 hover:text-white transition-colors">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Resources</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/docs" className="text-slate-500 hover:text-white transition-colors">Documentation</Link></li>
                <li><Link to="/help" className="text-slate-500 hover:text-white transition-colors">Help Center</Link></li>
                <li><a href="/api-docs" className="text-slate-500 hover:text-white transition-colors">API Reference</a></li>
                <li><Link to="/blog" className="text-slate-500 hover:text-white transition-colors">Blog</Link></li>
                <li><Link to="/demo" className="text-slate-500 hover:text-white transition-colors">Live Demo</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Company</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/company/about" className="text-slate-500 hover:text-white transition-colors">About</Link></li>
                <li><Link to="/company/security" className="text-slate-500 hover:text-white transition-colors">Security</Link></li>
                <li><Link to="/legal/privacy" className="text-slate-500 hover:text-white transition-colors">Privacy</Link></li>
                <li><Link to="/legal/terms" className="text-slate-500 hover:text-white transition-colors">Terms</Link></li>
                <li><Link to="/company/contact" className="text-slate-500 hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 mt-12 pt-8">
            <div className="text-center mb-4">
              <p className="text-slate-600 text-sm">
                Built by DevOps engineers who get paged. Questions?{' '}
                <a href="mailto:jarod@oncallshift.com" className="text-teal-500 hover:text-teal-400 transition-colors">
                  Email the founder
                </a>
              </p>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-slate-600">
                &copy; 2026 OnCallShift &middot;{' '}
                <a href="https://workermill.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-teal-400 transition-colors">
                  A WorkerMill product
                </a>
              </p>
              <div className="flex items-center gap-4 text-sm text-slate-600">
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

/* ── Feature card component ── */
function FeatureCard({
  icon,
  title,
  accent,
  items,
  link,
}: {
  icon: string;
  title: string;
  accent?: 'teal' | 'cyan' | 'blue';
  items: React.ReactNode[];
  link: { to: string; label: string };
}) {
  const accentClasses = accent
    ? {
        teal: 'border-teal-500/20 bg-teal-500/5',
        cyan: 'border-cyan-500/20 bg-cyan-500/5',
        blue: 'border-blue-500/20 bg-blue-500/5',
      }[accent]
    : 'border-white/5 bg-white/[0.02]';

  const linkColor = accent
    ? {
        teal: 'text-teal-400 hover:text-teal-300',
        cyan: 'text-cyan-400 hover:text-cyan-300',
        blue: 'text-blue-400 hover:text-blue-300',
      }[accent]
    : 'text-teal-400 hover:text-teal-300';

  return (
    <div className={`rounded-2xl p-6 border ${accentClasses} hover:border-white/10 transition-colors`}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
      <ul className="space-y-2 text-sm text-slate-400 mb-4">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-slate-600 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link to={link.to} className={`${linkColor} font-medium text-sm inline-block transition-colors`}>
        {link.label}
      </Link>
    </div>
  );
}

export default Landing;

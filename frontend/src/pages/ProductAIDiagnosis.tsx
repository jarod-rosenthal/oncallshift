import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function ProductAIDiagnosis() {
  const capabilities = [
    {
      title: 'Auto-Diagnosis',
      description: 'Every incident is automatically analyzed. No button clicks. AI examines logs, metrics, and past incidents.',
      icon: '🔍'
    },
    {
      title: 'Cloud Investigation',
      description: 'AI uses your cloud credentials to query CloudWatch logs, check ECS services, review deployments—in real-time.',
      icon: '☁️'
    },
    {
      title: 'Execute Remediation',
      description: 'One tap to restart services, scale deployments, rollback releases. AI doesn\'t just suggest—it executes.',
      icon: '⚡'
    },
    {
      title: 'Learning Loop',
      description: 'AI tracks what worked, learns from your team, and gets smarter with every resolution.',
      icon: '🧠'
    },
  ];

  const useCases = [
    {
      scenario: '"CPU at 95% on prod-api-3"',
      analysis: 'Claude identifies recent deployment, checks metrics patterns, suggests it may be a memory leak introduced in the last release.',
    },
    {
      scenario: '"Database connection timeout"',
      analysis: 'AI correlates with high traffic alerts, identifies connection pool exhaustion, recommends increasing pool size.',
    },
    {
      scenario: '"Payment service 500 errors"',
      analysis: 'Claude traces dependency chain, identifies upstream payment gateway degradation, suggests failover.',
    },
  ];

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
        <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>Powered by Anthropic Claude</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          AI That Doesn't Just Talk.<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            It Takes Action.
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-6 max-w-2xl mx-auto">
          While other tools suggest fixes, OnCallShift's AI actually executes them. From diagnosis to remediation in seconds.
        </p>
        <p className="text-lg text-slate-500 italic mb-8 max-w-2xl mx-auto">
          Built by DevOps engineers tired of AI that only talks. We wanted AI that does.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline">
              View Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* BYOK Banner */}
      <section className="bg-purple-50 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-purple-800">
            <span className="font-semibold">Bring Your Own Key (BYOK):</span>{' '}
            Use your Anthropic API key. Your incident data goes directly to Anthropic and is never stored by OnCallShift for AI purposes.
          </p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">The Complete AI Workflow</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          From detection to resolution. Automatically.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {capabilities.map((cap, i) => (
            <Card key={i} className="border-2 hover:border-blue-300 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-3xl">{cap.icon}</span>
                  <span>{cap.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{cap.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-block bg-blue-50 border-2 border-blue-200 rounded-lg p-6 max-w-2xl">
            <p className="font-semibold text-blue-900 mb-2">The Difference</p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-red-600 font-medium mb-1">❌ Other Tools</p>
                <p className="text-slate-600">"Here's what might be wrong. Good luck!"</p>
              </div>
              <div>
                <p className="text-green-600 font-medium mb-1">✅ OnCallShift</p>
                <p className="text-slate-600">"I found the issue AND I fixed it."</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">See It In Action</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Examples of how AI diagnosis helps during real incidents.
          </p>

          <div className="space-y-6 max-w-3xl mx-auto">
            {useCases.map((uc, i) => (
              <Card key={i} className="border bg-white">
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-500 mb-1">Alert:</p>
                    <p className="font-mono text-sm bg-red-50 text-red-700 px-3 py-2 rounded">
                      {uc.scenario}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">AI Analysis:</p>
                    <p className="text-sm text-slate-600 bg-purple-50 px-3 py-2 rounded">
                      {uc.analysis}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">See It In Action: 60 Seconds to Resolution</h2>
        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚨</span>
            </div>
            <h3 className="font-semibold mb-2">0:00 - Alert Arrives</h3>
            <p className="text-sm text-slate-600">AI starts analyzing immediately</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="font-semibold mb-2">0:15 - AI Investigates</h3>
            <p className="text-sm text-slate-600">Queries logs, checks cloud, finds root cause</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="font-semibold mb-2">0:30 - You Tap "Fix"</h3>
            <p className="text-sm text-slate-600">AI executes: restart pods, scale up</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <h3 className="font-semibold mb-2">1:00 - Resolved</h3>
            <p className="text-sm text-slate-600">Back to sleep. Laptop untouched.</p>
          </div>
        </div>
      </section>

      {/* AI Tools Available */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">What AI Can Actually Do</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            These aren't hypothetical. These are the actual tools OnCallShift's AI has access to.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-lg p-6 border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">🔍</span>
                Incident Analysis
              </h3>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Get incident timeline & events</li>
                <li>• Fetch application logs</li>
                <li>• Compare with past incidents</li>
                <li>• Identify patterns</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-6 border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">☁️</span>
                Cloud Investigation
              </h3>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Query CloudWatch logs (AWS)</li>
                <li>• Check ECS service health</li>
                <li>• Review recent deployments</li>
                <li>• Analyze metrics & errors</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-6 border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">⚡</span>
                Remediation Actions
              </h3>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Restart ECS services</li>
                <li>• Scale deployments</li>
                <li>• Execute custom runbooks</li>
                <li>• Trigger webhooks</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-slate-900 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Your Data, Your Control</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            With BYOK (Bring Your Own Key), your incident data goes directly to Anthropic—never stored by OnCallShift for AI training.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div>
              <p className="text-2xl mb-2">🔐</p>
              <p className="font-semibold">Encrypted Storage</p>
              <p className="text-sm text-slate-400">Your API key encrypted at rest</p>
            </div>
            <div>
              <p className="text-2xl mb-2">🚀</p>
              <p className="font-semibold">Direct to Claude</p>
              <p className="text-sm text-slate-400">No proxy, no middleman</p>
            </div>
            <div>
              <p className="text-2xl mb-2">💰</p>
              <p className="font-semibold">You Control Costs</p>
              <p className="text-sm text-slate-400">Choose Haiku (fast) or Opus (thorough)</p>
            </div>
          </div>
          <div className="mt-8">
            <Link to="/pricing">
              <Button variant="secondary" size="lg">
                See Pricing (BYOK from $29/month)
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready for AI That Actually Works at 3am?</h2>
        <p className="text-slate-600 mb-2">
          AI execution included in Professional ($19/user). Or bring your own key ($29/month flat).
        </p>
        <p className="text-sm text-slate-500 italic mb-6">
          Built by engineers who get paged. We use this every day.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register?plan=professional">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="lg" variant="outline">
              View Pricing
            </Button>
          </Link>
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

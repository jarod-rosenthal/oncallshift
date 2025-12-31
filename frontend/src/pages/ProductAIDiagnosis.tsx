import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function ProductAIDiagnosis() {
  const capabilities = [
    {
      title: 'Root Cause Analysis',
      description: 'Claude analyzes alert context, service metadata, and recent changes to suggest likely root causes.',
    },
    {
      title: 'Remediation Steps',
      description: 'Get actionable suggestions based on similar past incidents and best practices.',
    },
    {
      title: 'Impact Assessment',
      description: 'Understand which services and users are affected by the current incident.',
    },
    {
      title: 'Runbook Recommendations',
      description: 'AI suggests relevant runbooks from your library based on the incident type.',
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
          AI-Powered<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Incident Diagnosis
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Let Claude analyze your incidents and suggest root causes, remediation steps, and relevant runbooks.
          Reduce MTTR with AI-assisted troubleshooting.
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
        <h2 className="text-2xl font-bold text-center mb-4">What AI Diagnosis Does</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          Claude uses your incident context to provide actionable insights.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {capabilities.map((cap, i) => (
            <Card key={i} className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-purple-600">🤖</span>
                  {cap.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{cap.description}</p>
              </CardContent>
            </Card>
          ))}
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
        <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 font-bold">1</span>
            </div>
            <h3 className="font-semibold mb-2">Incident Created</h3>
            <p className="text-xs text-slate-600">Alert comes in with context</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <h3 className="font-semibold mb-2">Click "Diagnose"</h3>
            <p className="text-xs text-slate-600">One click from incident page</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-purple-600 font-bold">3</span>
            </div>
            <h3 className="font-semibold mb-2">Claude Analyzes</h3>
            <p className="text-xs text-slate-600">Your API key, direct to Anthropic</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 font-bold">4</span>
            </div>
            <h3 className="font-semibold mb-2">Get Insights</h3>
            <p className="text-xs text-slate-600">Root cause + remediation</p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-slate-900 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Your Data, Your Keys</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            With BYOK (Bring Your Own Key), AI requests go directly from your browser to Anthropic.
            OnCallShift never sees or stores the AI conversation.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div>
              <p className="text-2xl mb-2">🔐</p>
              <p className="font-semibold">Your API Key</p>
              <p className="text-sm text-slate-400">Stored encrypted, used only for AI calls</p>
            </div>
            <div>
              <p className="text-2xl mb-2">🚀</p>
              <p className="font-semibold">Direct to Anthropic</p>
              <p className="text-sm text-slate-400">No proxy through OnCallShift servers</p>
            </div>
            <div>
              <p className="text-2xl mb-2">📊</p>
              <p className="font-semibold">Your Usage</p>
              <p className="text-sm text-slate-400">Billed directly by Anthropic</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Diagnose Faster?</h2>
        <p className="text-slate-600 mb-6">
          AI diagnosis is included in Professional. Start your free trial today.
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
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>&copy; 2025 OnCallShift. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link to="/legal/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-slate-700">Terms</Link>
            <Link to="/company/contact" className="hover:text-slate-700">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

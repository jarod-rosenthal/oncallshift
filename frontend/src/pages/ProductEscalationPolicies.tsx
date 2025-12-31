import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function ProductEscalationPolicies() {
  const features = [
    {
      title: 'Multi-Step Escalation',
      description: 'Define who gets notified first, second, third. Automatic escalation after configurable timeouts.',
      icon: '📶',
    },
    {
      title: 'Schedule Integration',
      description: 'Link escalation steps to on-call schedules. Always notify whoever is currently on call.',
      icon: '📅',
    },
    {
      title: 'User & Team Targets',
      description: 'Escalate to specific users, entire teams, or on-call schedules at each step.',
      icon: '👥',
    },
    {
      title: 'Repeat Until Resolved',
      description: 'Optionally repeat the entire escalation chain until someone responds.',
      icon: '🔁',
    },
    {
      title: 'Manual Escalation',
      description: 'Responders can manually escalate to the next level if they need backup.',
      icon: '⬆️',
    },
    {
      title: 'Fallback Contacts',
      description: 'Define final-resort contacts when all escalation steps have been exhausted.',
      icon: '🆘',
    },
  ];

  const examplePolicy = [
    { step: 1, target: 'On-call schedule: Primary', delay: '0 min', note: 'Immediate' },
    { step: 2, target: 'On-call schedule: Secondary', delay: '5 min', note: 'If not acknowledged' },
    { step: 3, target: 'Team: Backend Engineers', delay: '10 min', note: 'Escalate to team' },
    { step: 4, target: 'User: Engineering Manager', delay: '15 min', note: 'Manager escalation' },
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
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>Product</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Escalation Policies<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            That Ensure Response
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Never let an incident go unnoticed. Define multi-step escalation chains
          that automatically notify backup responders when alerts aren't acknowledged.
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

      {/* Example Policy */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Example Escalation Policy</h2>
          <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto">
            A typical policy for a critical production service.
          </p>

          <div className="max-w-2xl mx-auto">
            <Card className="border bg-white">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {examplePolicy.map((step, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold">{step.step}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{step.target}</p>
                        <p className="text-sm text-slate-500">{step.note}</p>
                      </div>
                      <div className="text-right">
                        <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                          +{step.delay}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t text-center">
                  <p className="text-sm text-slate-500">
                    If still unacknowledged after step 4, repeat from step 1
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Powerful Escalation Features</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          Build escalation chains that match how your team actually works.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <Card key={i} className="border">
              <CardContent className="pt-6">
                <span className="text-3xl mb-3 block">{feature.icon}</span>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How Escalation Works */}
      <section className="bg-blue-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">How Escalation Works</h2>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Alert Fires</h3>
              <p className="text-xs text-slate-600">Incident created from webhook</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">Step 1 Notified</h3>
              <p className="text-xs text-slate-600">Primary on-call gets alert</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Timer Starts</h3>
              <p className="text-xs text-slate-600">Countdown to next step</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-blue-600 font-bold">4</span>
              </div>
              <h3 className="font-semibold mb-2">Auto-Escalate</h3>
              <p className="text-xs text-slate-600">Next step if not acked</p>
            </div>
          </div>
        </div>
      </section>

      {/* Linking */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Connect Everything</h2>
        <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto">
          Escalation policies tie together services, schedules, and teams.
        </p>

        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="bg-slate-100 p-6 rounded-lg text-center">
              <p className="text-2xl mb-2">🛠️</p>
              <p className="font-semibold">Services</p>
              <p className="text-xs text-slate-500">Assign policies to services</p>
            </div>
            <div className="text-3xl text-slate-300">→</div>
            <div className="bg-blue-100 p-6 rounded-lg text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="font-semibold">Escalation Policy</p>
              <p className="text-xs text-slate-500">Defines who to notify</p>
            </div>
            <div className="text-3xl text-slate-300">→</div>
            <div className="bg-slate-100 p-6 rounded-lg text-center">
              <p className="text-2xl mb-2">📅</p>
              <p className="font-semibold">Schedules</p>
              <p className="text-xs text-slate-500">Targets in each step</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Never Miss Another Incident</h2>
          <p className="text-blue-100 mb-6">
            Start free. Escalation policies are available on all plans.
          </p>
          <Link to="/register">
            <Button size="lg" variant="secondary">
              Start Free Trial
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

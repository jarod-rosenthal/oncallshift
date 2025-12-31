import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function ProductIncidentManagement() {
  const features = [
    {
      title: 'Real-Time Alerts',
      description: 'Receive alerts via push notification, email, SMS, or voice call. Never miss a critical incident.',
      icon: '🔔',
    },
    {
      title: 'Acknowledge & Resolve',
      description: 'One-click actions from mobile or web. Update incident status without logging into dashboards.',
      icon: '✅',
    },
    {
      title: 'Incident Timeline',
      description: 'Full audit trail of every action: who acknowledged, when it escalated, how it was resolved.',
      icon: '📜',
    },
    {
      title: 'Runbook Integration',
      description: 'Attach runbooks to services. Execute common fixes directly from the incident page.',
      icon: '📋',
    },
    {
      title: 'Escalate & Reassign',
      description: 'Not the right person? Reassign to a teammate. Need backup? Escalate to the next level immediately.',
      icon: '⬆️',
    },
    {
      title: 'AI-Powered Diagnosis',
      description: 'Let Claude analyze your incident context and suggest root causes and remediation steps.',
      icon: '🤖',
    },
  ];

  const workflow = [
    {
      step: 'Alert Triggered',
      description: 'Monitoring tool sends webhook to OnCallShift',
      status: 'triggered',
    },
    {
      step: 'Notification Sent',
      description: 'On-call engineer receives push/SMS/call',
      status: 'notified',
    },
    {
      step: 'Acknowledged',
      description: 'Engineer clicks acknowledge, team knows someone is on it',
      status: 'acknowledged',
    },
    {
      step: 'Investigated',
      description: 'Use AI diagnosis, runbooks, and timeline to understand',
      status: 'investigating',
    },
    {
      step: 'Resolved',
      description: 'Fix applied, incident closed, source notified',
      status: 'resolved',
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
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>Product</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Incident Management<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            That Actually Works
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          From alert to resolution, manage the entire incident lifecycle.
          Get the right person on it fast, give them the tools to fix it.
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

      {/* Workflow */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">The Incident Lifecycle</h2>
          <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-4 max-w-5xl mx-auto">
            {workflow.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                  item.status === 'resolved' ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  <span className={`font-bold ${
                    item.status === 'resolved' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {i + 1}
                  </span>
                </div>
                <p className="font-semibold text-sm">{item.step}</p>
                <p className="text-xs text-slate-600 mt-1 max-w-[150px]">{item.description}</p>
                {i < workflow.length - 1 && (
                  <div className="hidden md:block absolute transform translate-x-[80px] translate-y-5">
                    <span className="text-slate-300">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Powerful Tools for Every Incident</h2>
        <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
          Everything you need to manage incidents from anywhere.
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

      {/* Response Time Stats */}
      <section className="bg-blue-600 py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <p className="text-4xl font-bold mb-2">&lt; 30s</p>
              <p className="text-blue-200">Average alert delivery time</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">4</p>
              <p className="text-blue-200">Notification channels</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">99.9%</p>
              <p className="text-blue-200">Platform uptime SLA</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Improve Your Incident Response?</h2>
        <p className="text-slate-600 mb-6">
          Start free. No credit card required. Be up and running in minutes.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/product/ai-diagnosis">
            <Button size="lg" variant="outline">
              Learn About AI Diagnosis
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

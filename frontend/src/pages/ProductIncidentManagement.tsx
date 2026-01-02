import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function ProductIncidentManagement() {
  const features = [
    {
      title: 'AI Auto-Diagnosis',
      description: 'Every incident analyzed automatically. Root cause, suggested fixes, relevant runbooks—before you even look.',
      icon: '🤖',
    },
    {
      title: 'One-Tap Remediation',
      description: 'Execute runbooks from your phone. Restart services, scale deployments, trigger webhooks. No laptop required.',
      icon: '⚡',
    },
    {
      title: 'Smart Escalations',
      description: 'Multi-channel notifications (Push, SMS, Voice). Repeat until acknowledged. Auto-escalate to the next level.',
      icon: '🔔',
    },
    {
      title: 'Mobile-First',
      description: 'Full featured native iOS & Android apps. Designed for one-handed use at 3am.',
      icon: '📱',
    },
    {
      title: 'Timeline & Audit',
      description: 'Complete incident history. Who did what, when. AI tracks actions taken for learning loop.',
      icon: '📜',
    },
    {
      title: 'Collaboration',
      description: 'Add responders, chat in real-time, share context. The whole team can see what\'s happening.',
      icon: '👥',
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
            From Your Phone
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-6 max-w-2xl mx-auto">
          AI-enhanced incident response. From alert to resolution without opening your laptop.
        </p>
        <p className="text-lg text-slate-500 italic mb-8 max-w-2xl mx-auto">
          Built for 3am wake-ups. By people who've had way too many of them.
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

      {/* The Difference Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-600 py-16 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">The Traditional Flow vs. OnCallShift</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <p className="text-xl font-semibold mb-4">❌ Traditional Tools</p>
              <ul className="space-y-2 text-blue-100">
                <li>• Alert wakes you up</li>
                <li>• No context in notification</li>
                <li>• Open laptop, VPN, dashboards</li>
                <li>• Dig through logs manually</li>
                <li>• Google the error</li>
                <li>• SSH to production</li>
                <li>• Try fixes until something works</li>
                <li><strong className="text-white">⏱️ Average: 45 minutes</strong></li>
              </ul>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-6 border-2 border-white/30">
              <p className="text-xl font-semibold mb-4">✅ OnCallShift</p>
              <ul className="space-y-2 text-blue-100">
                <li>• Alert wakes you up</li>
                <li>• AI diagnosis in notification</li>
                <li>• Open phone app</li>
                <li>• See root cause + fix suggestions</li>
                <li>• Tap "Restart Pods"</li>
                <li>• AI executes and confirms</li>
                <li>• Back to sleep</li>
                <li><strong className="text-white">⏱️ Average: 90 seconds</strong></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 text-center">
            <p className="text-2xl font-bold">67x Faster Resolution</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Stop Waking Up to Scramble. Start Resolving From Your Phone.</h2>
        <p className="text-slate-600 mb-2">
          Free tier includes AI diagnosis. Upgrade for execution capabilities.
        </p>
        <p className="text-sm text-slate-500 italic mb-6">
          We use this every night. If it doesn't work at 3am, we don't ship it.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/product/ai-diagnosis">
            <Button size="lg" variant="outline">
              Learn About AI
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

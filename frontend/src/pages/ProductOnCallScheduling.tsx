import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function ProductOnCallScheduling() {
  const features = [
    {
      title: 'Weekly Rotations',
      description: 'Set up simple weekly rotations with customizable handoff times. Perfect for teams with predictable schedules.',
      icon: '🔄',
    },
    {
      title: 'Schedule Overrides',
      description: 'Easily swap shifts for vacations, sick days, or schedule changes. Notify affected team members automatically.',
      icon: '📝',
    },
    {
      title: 'Coverage Gaps Alert',
      description: 'Automatically detect when no one is scheduled and alert admins before gaps become incidents.',
      icon: '⚠️',
    },
    {
      title: 'Timezone Support',
      description: 'Manage global teams across timezones. See schedules in local time or UTC.',
      icon: '🌍',
    },
    {
      title: 'Calendar Export',
      description: 'Sync your on-call schedule to Google Calendar, Outlook, or any iCal-compatible app.',
      icon: '📅',
    },
    {
      title: 'Mobile Access',
      description: 'View and manage schedules from the iOS and Android apps. Accept or swap shifts on the go.',
      icon: '📱',
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
          On-Call Scheduling<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Made Simple
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Build rotating schedules, manage overrides, and ensure 24/7 coverage without spreadsheets.
          Know who's on call at any moment.
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

      {/* Screenshot placeholder */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto bg-slate-100 rounded-lg p-8 text-center">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="h-64 flex items-center justify-center text-slate-400">
              <div>
                <p className="text-4xl mb-2">📅</p>
                <p>Schedule calendar view</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Everything You Need for On-Call</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Built-in features that just work. No complex configuration required.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <Card key={i} className="border bg-white">
                <CardContent className="pt-6">
                  <span className="text-3xl mb-3 block">{feature.icon}</span>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">Set Up in Minutes</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 font-bold">1</span>
            </div>
            <h3 className="font-semibold mb-2">Add team members</h3>
            <p className="text-sm text-slate-600">
              Invite your team via email or import from your existing tool.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <h3 className="font-semibold mb-2">Create a schedule</h3>
            <p className="text-sm text-slate-600">
              Pick your rotation type and set handoff times. Assign members to the rotation.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 font-bold">3</span>
            </div>
            <h3 className="font-semibold mb-2">Link to services</h3>
            <p className="text-sm text-slate-600">
              Connect schedules to escalation policies. Alerts route to whoever is on call.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Simplify Your On-Call?</h2>
          <p className="text-blue-100 mb-6">
            Start free. Set up your first schedule in under 5 minutes.
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

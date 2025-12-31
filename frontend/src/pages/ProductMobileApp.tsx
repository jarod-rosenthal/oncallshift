import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function ProductMobileApp() {
  const features = [
    {
      title: 'Push Notifications',
      description: 'Instant alerts that break through Do Not Disturb mode for critical incidents.',
      icon: '🔔',
    },
    {
      title: 'One-Tap Actions',
      description: 'Acknowledge, resolve, or escalate incidents without opening the full app.',
      icon: '👆',
    },
    {
      title: 'AI Diagnosis',
      description: 'Get AI-powered analysis and chat with Claude directly from your phone.',
      icon: '🤖',
    },
    {
      title: 'Schedule View',
      description: 'See who is on call now and upcoming shifts. View and manage overrides.',
      icon: '📅',
    },
    {
      title: 'Runbook Execution',
      description: 'Execute runbook steps with one tap. SSH, API calls, and more.',
      icon: '📋',
    },
    {
      title: 'Offline Support',
      description: 'View cached incidents and schedules even without connectivity.',
      icon: '📶',
    },
  ];

  const screens = [
    { name: 'Dashboard', description: 'Active incidents at a glance' },
    { name: 'Incident Detail', description: 'Full context + AI diagnosis' },
    { name: 'On-Call Now', description: 'Current on-call across services' },
    { name: 'Schedules', description: 'Upcoming shifts + overrides' },
    { name: 'Profile', description: 'Notification preferences' },
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
          <span>iOS & Android</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          On-Call From<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Anywhere
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Native mobile apps for iOS and Android. Get alerts, respond to incidents,
          and manage schedules from your pocket.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a href="#" className="inline-block">
            <div className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-3">
              <span className="text-2xl"></span>
              <div className="text-left">
                <p className="text-xs text-slate-300">Download on the</p>
                <p className="font-semibold">App Store</p>
              </div>
            </div>
          </a>
          <a href="#" className="inline-block">
            <div className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-3">
              <span className="text-2xl">▶</span>
              <div className="text-left">
                <p className="text-xs text-slate-300">Get it on</p>
                <p className="font-semibold">Google Play</p>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* Phone Mockup */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-md mx-auto">
          <div className="bg-slate-900 rounded-[3rem] p-4 shadow-2xl">
            <div className="bg-slate-100 rounded-[2.5rem] p-6 min-h-[500px] flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-6xl mb-4">📱</p>
                <p>Mobile app screenshot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">Full-Featured Mobile Experience</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Not just a notification viewer. A complete incident management tool in your pocket.
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

      {/* Screens List */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">20+ Screens, Native Experience</h2>
        <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
          {screens.map((screen, i) => (
            <div key={i} className="bg-slate-100 px-4 py-3 rounded-lg text-center min-w-[150px]">
              <p className="font-semibold text-sm">{screen.name}</p>
              <p className="text-xs text-slate-500">{screen.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Critical Alerts */}
      <section className="bg-red-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Never Miss a Critical Alert</h2>
          <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
            Our push notifications are designed to break through. Critical alerts bypass
            Do Not Disturb and ensure you wake up when it matters.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-2xl mb-2">🔊</p>
              <p className="font-semibold">Critical Sound</p>
              <p className="text-sm text-slate-500">Distinct alert tone</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-2xl mb-2">🌙</p>
              <p className="font-semibold">DND Override</p>
              <p className="text-sm text-slate-500">iOS critical alerts</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-2xl mb-2">🔄</p>
              <p className="font-semibold">Repeat Until Ack</p>
              <p className="text-sm text-slate-500">Configurable escalation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Platform Support</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <Card className="border">
            <CardContent className="pt-6 text-center">
              <span className="text-4xl block mb-3"></span>
              <h3 className="font-semibold mb-2">iOS</h3>
              <p className="text-sm text-slate-600 mb-2">iPhone & iPad</p>
              <p className="text-xs text-slate-400">Requires iOS 14.0 or later</p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="pt-6 text-center">
              <span className="text-4xl block mb-3">🤖</span>
              <h3 className="font-semibold mb-2">Android</h3>
              <p className="text-sm text-slate-600 mb-2">Phones & Tablets</p>
              <p className="text-xs text-slate-400">Requires Android 8.0 or later</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Go Mobile?</h2>
          <p className="text-blue-100 mb-6">
            Sign up on web, then download the app. Your account syncs automatically.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
                View Demo
              </Button>
            </Link>
          </div>
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

import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function About() {
  const values = [
    {
      title: 'Simplicity First',
      description: 'Complex problems deserve simple solutions. We strip away unnecessary features to deliver what engineers actually need.',
      icon: '✨',
    },
    {
      title: 'Transparent Pricing',
      description: 'No hidden fees, no "contact sales" gotchas. See our pricing page and know exactly what you\'ll pay.',
      icon: '💰',
    },
    {
      title: 'Engineer Empathy',
      description: 'Built by engineers who\'ve been woken up at 3am. We understand the on-call experience.',
      icon: '🤝',
    },
    {
      title: 'Privacy Matters',
      description: 'Your incident data is yours. BYOK for AI ensures your data goes directly to Anthropic, not our servers.',
      icon: '🔐',
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
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          About OnCallShift
        </h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
          We're building the incident management platform we wished existed.
          Simple, affordable, and designed for teams who ship fast.
        </p>
      </section>

      {/* Mission */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-slate-600 mb-6">
              Incident management shouldn't require an enterprise budget or a week of configuration.
              We believe every team deserves professional-grade on-call tools at a price that makes sense.
            </p>
            <p className="text-lg text-slate-600">
              OnCallShift exists to democratize incident management. Whether you're a startup with 5 engineers
              or a growing company with 100, you should have access to the same powerful tools
              without paying per-seat enterprise prices.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">What We Believe</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {values.map((value, i) => (
            <Card key={i} className="border">
              <CardContent className="pt-6">
                <span className="text-3xl block mb-3">{value.icon}</span>
                <h3 className="font-semibold mb-2">{value.title}</h3>
                <p className="text-sm text-slate-600">{value.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="bg-blue-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Why We Built This</h2>
            <div className="prose prose-slate max-w-none">
              <p className="text-slate-600 mb-4">
                We've been on the other side of the pager. We've seen how incident management tools
                can become bloated with features most teams never use, while the core experience
                suffers. We've watched pricing climb to levels that force startups to choose between
                proper tooling and their runway.
              </p>
              <p className="text-slate-600 mb-4">
                When Atlassian announced Opsgenie's sunset, we saw an opportunity: build the
                incident management platform we always wanted. One that's fast to set up, easy to use,
                and priced fairly.
              </p>
              <p className="text-slate-600">
                OnCallShift is that platform. It's opinionated about simplicity, generous with its free tier,
                and built with AI from the ground up (not bolted on as an expensive add-on).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Try OnCallShift?</h2>
        <p className="text-slate-600 mb-6">
          Start free. No credit card required.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Start Free Trial
            </Button>
          </Link>
          <Link to="/company/contact">
            <Button size="lg" variant="outline">
              Contact Us
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

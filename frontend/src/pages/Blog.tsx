import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function Blog() {
  const posts = [
    {
      title: 'Why We Built OnCallShift',
      excerpt: 'The story behind building a simpler, more affordable incident management platform.',
      date: 'Coming Soon',
      category: 'Company',
      slug: 'why-we-built-oncallshift',
    },
    {
      title: 'Migrating from Opsgenie: A Complete Guide',
      excerpt: 'Step-by-step instructions for moving your team from Opsgenie before the 2027 sunset.',
      date: 'Coming Soon',
      category: 'Migration',
      slug: 'migrating-from-opsgenie',
    },
    {
      title: 'AI-Powered Incident Diagnosis: How It Works',
      excerpt: 'A deep dive into how we use Claude to help engineers diagnose incidents faster.',
      date: 'Coming Soon',
      category: 'Product',
      slug: 'ai-powered-incident-diagnosis',
    },
    {
      title: 'On-Call Best Practices for Growing Teams',
      excerpt: 'Lessons learned from scaling on-call rotations from 5 to 50 engineers.',
      date: 'Coming Soon',
      category: 'Best Practices',
      slug: 'oncall-best-practices',
    },
    {
      title: 'Reducing Alert Fatigue Without Missing Critical Issues',
      excerpt: 'How to configure alerts and escalations that respect your team\'s attention.',
      date: 'Coming Soon',
      category: 'Best Practices',
      slug: 'reducing-alert-fatigue',
    },
    {
      title: 'PagerDuty vs OnCallShift: Feature Comparison',
      excerpt: 'An honest comparison of features, pricing, and use cases.',
      date: 'Coming Soon',
      category: 'Comparison',
      slug: 'pagerduty-vs-oncallshift',
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
          OnCallShift Blog
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Insights on incident management, on-call best practices, and building reliable systems.
        </p>
      </section>

      {/* Coming Soon Notice */}
      <section className="container mx-auto px-4 pb-8">
        <div className="max-w-4xl mx-auto bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800">
            <span className="font-semibold">Blog launching soon!</span>{' '}
            Sign up for updates and be the first to read our posts.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="px-4 py-2 border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Subscribe
            </Button>
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Upcoming Posts</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((post, i) => (
              <Card key={i} className="border hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded">
                      {post.category}
                    </span>
                    <span className="text-xs text-slate-400">{post.date}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{post.title}</h3>
                  <p className="text-sm text-slate-600">{post.excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold mb-6 text-center">Topics We'll Cover</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {['Incident Management', 'On-Call Best Practices', 'AI & Automation', 'Migration Guides', 'Product Updates', 'Case Studies', 'DevOps Culture', 'Reliability Engineering'].map((topic, i) => (
                <span key={i} className="bg-white border px-4 py-2 rounded-full text-sm">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Want to Contribute?</h2>
        <p className="text-slate-600 mb-6">
          We're looking for guest posts from practitioners. Share your on-call war stories.
        </p>
        <Link to="/company/contact">
          <Button variant="outline">
            Get in Touch
          </Button>
        </Link>
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

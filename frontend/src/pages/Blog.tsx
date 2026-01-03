import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function Blog() {
  const posts = [
    {
      title: "Stop Clicking Around: Why Your On-Call Configuration Belongs in Git",
      excerpt: "Every time you click through a UI to update an on-call schedule, you're creating configuration drift that will haunt you at 3am.",
      date: 'January 2025',
      category: 'Infrastructure as Code',
      slug: 'stop-clicking-around',
      readTime: '8 min',
      featured: true,
    },
    {
      title: 'Terraform Patterns for Multi-Team On-Call: Lessons from Scaling to 50 Services',
      excerpt: "Managing on-call for one team is straightforward. Managing it for 50 services across 12 teams requires patterns.",
      date: 'January 2025',
      category: 'Infrastructure as Code',
      slug: 'terraform-multi-team',
      readTime: '12 min',
      featured: true,
    },
    {
      title: "I've Acknowledged 10,000 Alerts. Here's What I Learned About Signal vs. Noise",
      excerpt: "After 15 years of carrying pagers and phones, I've clicked 'acknowledge' more times than I can count. Most of those clicks were unnecessary.",
      date: 'January 2025',
      category: 'Alert Fatigue',
      slug: 'ten-thousand-alerts',
      readTime: '10 min',
    },
    {
      title: 'Alert Fatigue Is a System Design Problem, Not a Tuning Problem',
      excerpt: "You can't tune your way out of bad architecture. If your system generates too many alerts, the problem isn't your thresholds.",
      date: 'January 2025',
      category: 'Architecture',
      slug: 'alert-fatigue-system-design',
      readTime: '9 min',
    },
    {
      title: "The Deafening Silence: What Happens When Your Team Stops Trusting Alerts",
      excerpt: "The scariest moment in incident management isn't the alert that fires. It's the alert that fires and no one responds.",
      date: 'January 2025',
      category: 'Team Health',
      slug: 'when-teams-stop-trusting',
      readTime: '8 min',
    },
    {
      title: 'The CLI-First On-Call Workflow: For Engineers Who Live in the Terminal',
      excerpt: "You spend all day in the terminal. Why should incident management require a browser?",
      date: 'January 2025',
      category: 'Developer Experience',
      slug: 'cli-first-workflow',
      readTime: '7 min',
    },
    {
      title: 'The Incident Response Playbook: Building Reflexes, Not Procedures',
      excerpt: "When your database is melting at 3am, you don't have time to read documentation. You need muscle memory.",
      date: 'January 2025',
      category: 'Preparation',
      slug: 'building-reflexes',
      readTime: '11 min',
    },
    {
      title: "Running LLMs Locally: A DevOps Engineer's Guide to AI on Your Own Hardware",
      excerpt: "You don't need a cloud API to run powerful AI models. With the right hardware—or even modest hardware—you can run LLMs locally.",
      date: 'January 2025',
      category: 'AI & Automation',
      slug: 'running-llms-locally',
      readTime: '14 min',
    },
    {
      title: 'Building Your Own MCP Server: Extending AI Assistants with Custom Tools',
      excerpt: "MCP lets you give AI assistants access to your own tools and data. Here's how to build an MCP server for your infrastructure.",
      date: 'January 2025',
      category: 'AI & Automation',
      slug: 'building-mcp-servers',
      readTime: '12 min',
    },
  ];

  const featuredPosts = posts.filter(p => p.featured);
  const regularPosts = posts.filter(p => !p.featured);

  const categories = ['All', 'Infrastructure as Code', 'Alert Fatigue', 'AI & Automation', 'Architecture', 'Preparation'];

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
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>🏗️</span>
          <span>Terraform &bull; SRE &bull; DevOps &bull; AI</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          The OnCallShift Blog
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Battle-tested insights on incident management, infrastructure as code, and building reliable systems.
          Written by engineers who still get paged.
        </p>
      </section>

      {/* Category Pills */}
      <section className="container mx-auto px-4 pb-8">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                cat === 'All'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Featured Posts */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="text-green-600">🏗️</span>
            Featured: Infrastructure as Code
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {featuredPosts.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`}>
                <Card className="border-2 border-green-200 bg-green-50/50 hover:shadow-lg hover:border-green-300 transition-all h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium">
                        {post.category}
                      </span>
                      <span className="text-xs text-slate-400">{post.date}</span>
                      <span className="text-xs text-slate-400">&bull;</span>
                      <span className="text-xs text-slate-400">{post.readTime}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-slate-900">{post.title}</h3>
                    <p className="text-sm text-slate-600">{post.excerpt}</p>
                    <p className="text-green-600 text-sm font-medium mt-4">Read article &rarr;</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* All Posts Grid */}
      <section className="bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold mb-6">All Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularPosts.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`}>
                  <Card className="border bg-white hover:shadow-md transition-shadow h-full">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          post.category === 'Alert Fatigue' ? 'bg-red-100 text-red-700' :
                          post.category === 'AI & Automation' ? 'bg-purple-100 text-purple-700' :
                          post.category === 'Architecture' ? 'bg-blue-100 text-blue-700' :
                          post.category === 'Team Health' ? 'bg-amber-100 text-amber-700' :
                          post.category === 'Developer Experience' ? 'bg-cyan-100 text-cyan-700' :
                          post.category === 'Preparation' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {post.category}
                        </span>
                        <span className="text-xs text-slate-400">{post.readTime}</span>
                      </div>
                      <h3 className="font-semibold mb-2">{post.title}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2">{post.excerpt}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-6 text-center">Topics We Cover</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: 'Terraform & IaC', icon: '🏗️' },
              { name: 'Alert Fatigue', icon: '🔕' },
              { name: 'Incident Response', icon: '🚨' },
              { name: 'AI & LLMs', icon: '🤖' },
              { name: 'CLI Workflows', icon: '💻' },
              { name: 'SRE Culture', icon: '🛠️' },
              { name: 'On-Call Best Practices', icon: '📟' },
              { name: 'System Design', icon: '📐' },
            ].map((topic, i) => (
              <span key={i} className="bg-slate-100 border px-4 py-2 rounded-full text-sm flex items-center gap-2">
                <span>{topic.icon}</span>
                <span>{topic.name}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Stay Updated</h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            Get new articles on incident management, IaC, and DevOps delivered to your inbox.
          </p>
          <div className="flex justify-center gap-2 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
            />
            <Button variant="secondary">Subscribe</Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Want to Contribute?</h2>
        <p className="text-slate-600 mb-6">
          We're looking for guest posts from practitioners. Share your on-call war stories and lessons learned.
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

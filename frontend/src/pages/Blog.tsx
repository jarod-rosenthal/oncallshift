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
    <div className="min-h-screen">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span>Terraform &bull; SRE &bull; DevOps &bull; AI</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          The OnCallShift Blog
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
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
                  ? 'bg-teal-500 text-white'
                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
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
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
            Featured: Infrastructure as Code
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {featuredPosts.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`}>
                <Card className="border border-teal-500/20 bg-teal-500/[0.05] hover:bg-teal-500/[0.08] hover:border-teal-500/30 transition-all h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-teal-500/10 text-teal-400 text-xs px-2 py-1 rounded font-medium">
                        {post.category}
                      </span>
                      <span className="text-xs text-slate-500">{post.date}</span>
                      <span className="text-xs text-slate-500">&bull;</span>
                      <span className="text-xs text-slate-500">{post.readTime}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-white">{post.title}</h3>
                    <p className="text-sm text-slate-400">{post.excerpt}</p>
                    <p className="text-teal-400 text-sm font-medium mt-4">Read article &rarr;</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* All Posts Grid */}
      <section className="bg-white/[0.02] py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold mb-6 text-white">All Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularPosts.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`}>
                  <Card className="border border-white/5 bg-white/[0.03] hover:bg-white/[0.05] transition-all h-full">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          post.category === 'Alert Fatigue' ? 'bg-red-500/10 text-red-400' :
                          post.category === 'AI & Automation' ? 'bg-purple-500/10 text-purple-400' :
                          post.category === 'Architecture' ? 'bg-blue-500/10 text-blue-400' :
                          post.category === 'Team Health' ? 'bg-amber-500/10 text-amber-400' :
                          post.category === 'Developer Experience' ? 'bg-cyan-500/10 text-cyan-400' :
                          post.category === 'Preparation' ? 'bg-orange-500/10 text-orange-400' :
                          'bg-white/[0.05] text-slate-300'
                        }`}>
                          {post.category}
                        </span>
                        <span className="text-xs text-slate-500">{post.readTime}</span>
                      </div>
                      <h3 className="font-semibold mb-2 text-white">{post.title}</h3>
                      <p className="text-sm text-slate-400 line-clamp-2">{post.excerpt}</p>
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
          <h2 className="text-xl font-semibold mb-6 text-center text-white">Topics We Cover</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: 'Terraform & IaC', icon: '' },
              { name: 'Alert Fatigue', icon: '' },
              { name: 'Incident Response', icon: '' },
              { name: 'AI & LLMs', icon: '' },
              { name: 'CLI Workflows', icon: '' },
              { name: 'SRE Culture', icon: '' },
              { name: 'On-Call Best Practices', icon: '' },
              { name: 'System Design', icon: '' },
            ].map((topic, i) => (
              <span key={i} className="bg-white/[0.05] border border-white/5 px-4 py-2 rounded-full text-sm flex items-center gap-2 text-slate-300">
                <span>{topic.name}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="bg-gradient-to-r from-teal-500 to-cyan-500 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Stay Updated</h2>
          <p className="text-white/80 mb-6 max-w-xl mx-auto">
            Get new articles on incident management, IaC, and DevOps delivered to your inbox.
          </p>
          <div className="flex justify-center gap-2 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white bg-white/10 text-white placeholder-white/50 border border-white/20"
            />
            <Button variant="secondary">Subscribe</Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4 text-white">Want to Contribute?</h2>
        <p className="text-slate-400 mb-6">
          We're looking for guest posts from practitioners. Share your on-call war stories and lessons learned.
        </p>
        <Link to="/company/contact">
          <Button variant="outline" className="border-white/20 text-slate-300 hover:bg-white/5">
            Get in Touch
          </Button>
        </Link>
      </section>
    </div>
  );
}

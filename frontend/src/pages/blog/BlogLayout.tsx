import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';

interface BlogLayoutProps {
  title: string;
  date: string;
  category: string;
  readTime: string;
  children: React.ReactNode;
}

export function BlogLayout({ title, date, category, readTime, children }: BlogLayoutProps) {
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
            <Link to="/blog">
              <Button variant="ghost" size="sm">Blog</Button>
            </Link>
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

      {/* Article Header */}
      <header className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Link to="/blog" className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block">
            &larr; Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">
              {category}
            </span>
            <span className="text-slate-500 text-sm">{date}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 text-sm">{readTime}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            {title}
          </h1>
        </div>
      </header>

      {/* Article Content */}
      <article className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto prose prose-lg prose-slate prose-headings:font-bold prose-a:text-blue-600 prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-slate-900 prose-pre:text-slate-100">
          {children}
        </div>
      </article>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to Modernize Your On-Call?
          </h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            Start free. No credit card required. Infrastructure as code from day one.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/docs">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Read the Docs
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

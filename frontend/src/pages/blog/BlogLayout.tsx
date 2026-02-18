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
    <div className="min-h-screen">
      {/* Article Header */}
      <header className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Link to="/blog" className="text-teal-400 hover:text-teal-300 text-sm mb-4 inline-block">
            &larr; Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-teal-500/10 text-teal-400 text-xs px-3 py-1 rounded-full font-medium">
              {category}
            </span>
            <span className="text-slate-500 text-sm">{date}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-500 text-sm">{readTime}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {title}
          </h1>
        </div>
      </header>

      {/* Article Content */}
      <article className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto prose prose-lg prose-invert prose-headings:font-bold prose-headings:text-white prose-p:text-slate-300 prose-a:text-teal-400 prose-strong:text-white prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-white/[0.03] prose-pre:text-slate-100 prose-li:text-slate-300 prose-blockquote:text-slate-400 prose-blockquote:border-white/10">
          {children}
        </div>
      </article>

      {/* CTA */}
      <section className="bg-gradient-to-r from-teal-500 to-cyan-500 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to Modernize Your On-Call?
          </h2>
          <p className="text-white/80 mb-6 max-w-xl mx-auto">
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
    </div>
  );
}

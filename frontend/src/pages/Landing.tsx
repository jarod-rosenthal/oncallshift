import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function Landing() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, just show confirmation - could integrate with email service later
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="relative z-10 p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📟</span>
            <span className="text-xl font-bold text-white">OnCallShift</span>
          </div>
          <Link to="/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl mx-auto text-center">
          {/* Glowing orb effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />

          {/* Badge */}
          <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            In Development
          </div>

          {/* Headline */}
          <h1 className="relative text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Coming Soon
          </h1>

          {/* Subheadline */}
          <p className="relative text-xl md:text-2xl text-slate-400 mb-4 leading-relaxed">
            Incident management for people who've carried the pager.
          </p>

          <p className="relative text-lg text-slate-500 mb-12 max-w-lg mx-auto">
            At 3am, muscle memory and good tooling make all the difference.
          </p>

          {/* Email Signup */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button
                type="submit"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Notify Me
              </Button>
            </form>
          ) : (
            <div className="relative inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              We'll notify you when we launch!
            </div>
          )}

          {/* Features preview */}
          <div className="relative mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-2xl mb-3">🤖</div>
              <h3 className="text-white font-semibold mb-2">AI-Powered</h3>
              <p className="text-slate-400 text-sm">Intelligent diagnosis and automated remediation for faster resolution.</p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-2xl mb-3">🏗️</div>
              <h3 className="text-white font-semibold mb-2">Infrastructure as Code</h3>
              <p className="text-slate-400 text-sm">Terraform provider and MCP server for GitOps workflows.</p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-2xl mb-3">📱</div>
              <h3 className="text-white font-semibold mb-2">Mobile First</h3>
              <p className="text-slate-400 text-sm">Native apps designed for 3am wake-ups. One-tap actions.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center">
        <p className="text-slate-600 text-sm">
          &copy; 2025 OnCallShift. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default Landing;

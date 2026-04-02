import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { waitlistAPI } from '../lib/api-client';

export function Register() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await waitlistAPI.join({
        email,
        fullName: fullName || undefined,
        source: searchParams.get('source') || 'register',
        plan: searchParams.get('plan') || undefined,
      });
      setIsSuccess(true);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.errors?.[0]?.msg || data?.error || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-teal-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Join the{' '}
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Waitlist
              </span>
            </h1>
            <p className="text-lg text-slate-400 max-w-md mx-auto">
              Be among the first to experience the AI-native incident platform built for modern DevOps teams.
            </p>
          </div>

          {/* Form / Success */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            {isSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">You're on the list!</h2>
                <p className="text-slate-400 mb-6">
                  We'll send you an invite as soon as early access is available. Check your email for a confirmation.
                </p>
                <Link
                  to="/"
                  className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
                >
                  Back to home
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Work email <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Full name <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full py-3 px-6 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-lg shadow-lg shadow-teal-500/25 hover:shadow-teal-400/30 transition-all text-base"
                >
                  {isLoading ? 'Joining...' : 'Join Waitlist'}
                </button>

                <p className="text-center text-sm text-slate-500">
                  No spam, ever. We'll only email you about launch updates.
                </p>
              </form>
            )}
          </div>

          {/* Value props */}
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">MCP Server</h3>
              <p className="text-xs text-slate-500">Manage incidents from Claude Code, Cursor, or any AI agent</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">AI Diagnosis</h3>
              <p className="text-xs text-slate-500">Claude analyzes incidents and suggests fixes automatically</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Zero-Friction Migration</h3>
              <p className="text-xs text-slate-500">Import from your existing platform with a single API call</p>
            </div>
          </div>

          {/* Already have an account */}
          <p className="text-center text-sm text-slate-500 mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-400 hover:text-teal-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

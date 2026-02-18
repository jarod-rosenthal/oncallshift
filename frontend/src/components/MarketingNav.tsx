import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'text-white bg-white/5'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </Link>
  );
}

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-2xl">📟</span>
              <span className="text-xl font-bold text-white tracking-tight">OnCallShift</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <NavLink to="/product" active={isActive('/product')}>Product</NavLink>
              <NavLink to="/pricing" active={isActive('/pricing')}>Pricing</NavLink>
              <NavLink to="/docs" active={isActive('/docs')}>Docs</NavLink>
              <NavLink to="/blog" active={isActive('/blog')}>Blog</NavLink>
              <NavLink to="/help" active={isActive('/help')}>Help</NavLink>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/5">
                Login
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-lg shadow-teal-500/20">
                Join Waitlist
              </Button>
            </Link>
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-white/5 pt-4">
            <div className="space-y-1">
              <Link to="/product" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Product</Link>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Pricing</Link>
              <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Docs</Link>
              <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Blog</Link>
              <Link to="/help" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Help</Link>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Login</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { DocsSidebar } from './DocsSidebar';
import type { NavSection } from './docsNavigation';

interface DocsLayoutProps {
  children: ReactNode;
  navigation: NavSection[];
  variant: 'docs' | 'help';
}

export function DocsLayout({ children, navigation, variant }: DocsLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isHelp = variant === 'help';
  const title = isHelp ? 'Help Center' : 'Documentation';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Navigation */}
      <nav className="border-b bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-2xl">📟</span>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  OnCallShift
                </span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-1">
                <Link
                  to="/docs"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !isHelp
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Docs
                </Link>
                <Link
                  to="/help"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isHelp
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Help Center
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Mobile sidebar toggle */}
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Link to="/login" className="hidden md:block">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Start Free Trial
                </Button>
              </Link>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t pt-4">
              <div className="space-y-2">
                <Link to="/docs" className="block py-2 text-sm font-medium">Documentation</Link>
                <Link to="/help" className="block py-2 text-sm font-medium">Help Center</Link>
                <Link to="/pricing" className="block py-2 text-sm font-medium">Pricing</Link>
                <Link to="/login" className="block py-2 text-sm font-medium">Login</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Page Header */}
      <div className="border-b bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {isHelp
              ? 'Find answers and learn how to use OnCallShift effectively.'
              : 'Technical documentation, guides, and API reference.'
            }
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <DocsSidebar
            navigation={navigation}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />

          {/* Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>&copy; 2026 OnCallShift. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link to="/docs" className="hover:text-slate-700 dark:hover:text-slate-200">Docs</Link>
            <Link to="/help" className="hover:text-slate-700 dark:hover:text-slate-200">Help</Link>
            <Link to="/legal/privacy" className="hover:text-slate-700 dark:hover:text-slate-200">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-slate-700 dark:hover:text-slate-200">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

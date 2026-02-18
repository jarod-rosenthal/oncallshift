import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DocsSidebar } from './DocsSidebar';
import type { NavSection } from './docsNavigation';

interface DocsLayoutProps {
  children: ReactNode;
  navigation: NavSection[];
  variant: 'docs' | 'help';
}

export function DocsLayout({ children, navigation, variant }: DocsLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isHelp = variant === 'help';
  const title = isHelp ? 'Help Center' : 'Documentation';

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="border-b border-white/5 bg-white/[0.02]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                {/* Mobile sidebar toggle */}
                <button
                  className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-slate-400">
                {isHelp
                  ? 'Find answers and learn how to use OnCallShift effectively.'
                  : 'Technical documentation, guides, and API reference.'
                }
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1">
              <Link
                to="/docs"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !isHelp
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Docs
              </Link>
              <Link
                to="/help"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isHelp
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Help Center
              </Link>
            </div>
          </div>
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
    </div>
  );
}

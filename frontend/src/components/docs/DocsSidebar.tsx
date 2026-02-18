import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavSection } from './docsNavigation';

interface DocsSidebarProps {
  navigation: NavSection[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DocsSidebar({ navigation, mobileOpen = false, onMobileClose }: DocsSidebarProps) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Auto-expand section containing current page
    const expanded = new Set<string>();
    for (const section of navigation) {
      for (const item of section.items) {
        if (location.pathname === item.href || location.pathname.startsWith(item.href + '/')) {
          expanded.add(section.title);
          break;
        }
      }
    }
    // If no section is expanded, expand the first one
    if (expanded.size === 0 && navigation.length > 0) {
      expanded.add(navigation[0].title);
    }
    return expanded;
  });

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const sidebarContent = (
    <nav className="space-y-1">
      {navigation.map((section) => {
        const isExpanded = expandedSections.has(section.title);
        const hasActiveItem = section.items.some((item) => isActive(item.href));

        return (
          <div key={section.title} className="mb-4">
            <button
              onClick={() => toggleSection(section.title)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                hasActiveItem
                  ? 'text-teal-400'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>{section.title}</span>
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <ul className="mt-1 ml-3 border-l border-white/10 pl-3 space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={onMobileClose}
                      className={`block px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        isActive(item.href)
                          ? 'bg-teal-500/10 text-teal-400 font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-20 overflow-y-auto max-h-[calc(100vh-5rem)] pb-8 pr-4">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onMobileClose}
          />

          {/* Sidebar panel */}
          <div className="fixed inset-y-0 left-0 w-72 bg-slate-900 shadow-xl overflow-y-auto border-r border-white/5">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <span className="font-semibold text-white">Navigation</span>
              <button
                onClick={onMobileClose}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">{sidebarContent}</div>
          </div>
        </div>
      )}
    </>
  );
}

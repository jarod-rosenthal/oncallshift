import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  incidentCount?: number;
}

// Icons as simple SVG components
const Icons = {
  Home: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Bell: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  Server: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  ArrowUp: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ),
  Chart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Link: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  Book: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Team: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Building: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Network: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7 4.006l-.75-1.3m9.063 16.658l-.26-1.477m2.605-14.772l-.26-1.477" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Tag: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  Import: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  Menu: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Sun: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Moon: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Cloud: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  Key: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Robot: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
    </svg>
  ),
};

export function Sidebar({ collapsed, onToggle, incidentCount = 0 }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['People']));
  const [showQuickActions, setShowQuickActions] = useState(true);

  const isAdmin = user?.role === 'admin';

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const navSections: NavSection[] = [
    {
      title: 'Respond',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: <Icons.Home /> },
        { path: '/incidents', label: 'Incidents', icon: <Icons.Bell />, badge: incidentCount },
        { path: '/status-dashboard', label: 'Status Dashboard', icon: <Icons.Globe /> },
      ],
    },
    {
      title: 'Configure',
      items: [
        { path: '/services', label: 'Services', icon: <Icons.Server />, adminOnly: true },
        { path: '/business-services', label: 'Business Services', icon: <Icons.Building />, adminOnly: true },
        { path: '/status-pages/admin', label: 'Status Pages', icon: <Icons.Globe />, adminOnly: true },
        { path: '/service-dependencies', label: 'Dependencies', icon: <Icons.Network />, adminOnly: true },
        { path: '/tags', label: 'Tags', icon: <Icons.Tag />, adminOnly: true },
        { path: '/runbooks', label: 'Runbooks', icon: <Icons.Book />, adminOnly: true },
        { path: '/routing-rules', label: 'Routing Rules', icon: <Icons.ArrowUp />, adminOnly: true },
        { path: '/workflows', label: 'Workflows', icon: <Icons.Settings />, adminOnly: true },
        { path: '/ai-workers', label: 'AI Workers', icon: <Icons.Robot />, adminOnly: true },
      ],
    },
    {
      title: 'People',
      items: [
        { path: '/people/users', label: 'Users', icon: <Icons.Users />, adminOnly: true },
        { path: '/people/teams', label: 'Teams', icon: <Icons.Team /> },
        { path: '/schedules', label: 'Schedules', icon: <Icons.Calendar /> },
        { path: '/escalation-policies', label: 'Escalation Policies', icon: <Icons.ArrowUp /> },
      ],
    },
    {
      title: 'Analyze',
      items: [
        { path: '/analytics', label: 'Analytics', icon: <Icons.Chart /> },
        { path: '/reports', label: 'Reports', icon: <Icons.Book />, adminOnly: true },
        { path: '/postmortems', label: 'Postmortems', icon: <Icons.FileText /> },
      ],
    },
  ];

  const renderNavItem = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return null;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive(item.path)
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <span className={isActive(item.path) ? 'text-primary' : 'text-muted-foreground'}>
          {item.icon}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    if (section.adminOnly && !isAdmin) return null;

    const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
    if (visibleItems.length === 0) return null;

    const isExpanded = expandedSections.has(section.title);
    const hasSubItems = section.title === 'People';

    return (
      <div key={section.title} className="mb-2">
        {!collapsed && (
          <button
            onClick={() => hasSubItems && toggleSection(section.title)}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${
              hasSubItems ? 'hover:text-foreground cursor-pointer' : ''
            }`}
          >
            <span>{section.title}</span>
            {hasSubItems && (
              <span className="transition-transform duration-200">
                {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
              </span>
            )}
          </button>
        )}
        {(collapsed || isExpanded || !hasSubItems) && (
          <div className="space-y-1">
            {visibleItems.map(renderNavItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        {!collapsed && (
          <Link to="/dashboard" className="text-xl font-bold text-foreground">
            OnCallShift
          </Link>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <Icons.Menu />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {/* Quick Actions Panel - for admins */}
        {isAdmin && !collapsed && showQuickActions && (
          <div className="mb-4 mx-1 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Quick Setup</span>
              <button
                onClick={() => setShowQuickActions(false)}
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="Hide quick actions"
              >
                <Icons.ChevronDown />
              </button>
            </div>
            <div className="space-y-1.5">
              <Link
                to="/people/teams"
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                Create Team
              </Link>
              <Link
                to="/schedules"
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                Create Schedule
              </Link>
              <Link
                to="/escalation-policies"
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                Create Escalation Policy
              </Link>
              <Link
                to="/services"
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">4</span>
                Create Service
              </Link>
            </div>
          </div>
        )}
        {isAdmin && !collapsed && !showQuickActions && (
          <button
            onClick={() => setShowQuickActions(true)}
            className="mb-4 mx-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg flex items-center gap-2 w-full transition-colors"
          >
            <Icons.ChevronRight />
            Show Quick Setup
          </button>
        )}

        {navSections.map(renderSection)}
      </nav>
    </aside>
  );
}

export default Sidebar;

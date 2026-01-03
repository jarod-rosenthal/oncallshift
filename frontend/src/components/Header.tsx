import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { authAPI } from '../lib/api-client';
import { ThemeSwitcher } from './ui/theme-switcher';
import { UserAvatar } from './UserAvatar';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

// Icons as simple SVG components
const Icons = {
  Search: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Bell: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  Question: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  User: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Key: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Link: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  Cloud: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  Import: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
};

export function Header({ sidebarCollapsed }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const isAdmin = user?.role === 'admin';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement global search
    console.log('Search:', searchQuery);
  };

  const handleLogout = () => {
    authAPI.logout();
    clearAuth();
    navigate('/');
  };

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-6 z-30 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className={`relative flex items-center ${searchFocused ? 'ring-2 ring-ring' : ''} rounded-lg`}>
          <div className="absolute left-3 text-muted-foreground">
            <Icons.Search />
          </div>
          <input
            type="text"
            placeholder="Search incidents, services, users... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full pl-10 pr-4 py-2 bg-muted border border-transparent rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:bg-background focus:border-border"
          />
        </div>
      </form>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 ml-4">
        {/* Help Menu */}
        <div className="relative">
          <button
            onClick={() => setHelpMenuOpen(!helpMenuOpen)}
            className={`p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors ${helpMenuOpen ? 'bg-muted' : ''}`}
            title="Help & Documentation"
          >
            <Icons.Question />
          </button>

          {/* Help Dropdown */}
          {helpMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setHelpMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Resources
                </div>
                <Link
                  to="/help"
                  onClick={() => setHelpMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Help Center
                </Link>
                <Link
                  to="/docs"
                  onClick={() => setHelpMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Documentation
                </Link>
                <a
                  href="/api-docs"
                  onClick={() => setHelpMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  API Reference
                </a>
                <hr className="my-1 border-border" />
                <Link
                  to="/help/contact"
                  onClick={() => setHelpMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Contact Support
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeSwitcher />

        {/* Notifications */}
        <Link
          to="/incidents"
          className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          title="Notifications"
        >
          <Icons.Bell />
        </Link>

        {/* User Profile Menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-muted transition-colors ${userMenuOpen ? 'bg-muted' : ''}`}
          >
            <UserAvatar
              src={user?.profilePictureUrl}
              name={user?.fullName}
              size="sm"
            />
            <span className="text-sm font-medium text-foreground hidden sm:block">
              {user?.fullName?.split(' ')[0] || 'User'}
            </span>
            <Icons.ChevronDown />
          </button>

          {/* User Dropdown */}
          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="text-sm font-medium text-foreground">{user?.fullName || 'User'}</div>
                  <div className="text-xs text-muted-foreground">{user?.email || ''}</div>
                </div>

                {/* Profile Links */}
                <div className="py-1">
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                  >
                    <Icons.User />
                    <span>My Profile</span>
                  </Link>
                  <Link
                    to="/availability"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                  >
                    <Icons.Clock />
                    <span>My Availability</span>
                  </Link>
                  <Link
                    to="/notification-preferences"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                  >
                    <Icons.Bell />
                    <span>Notification Preferences</span>
                  </Link>
                </div>

                {/* Admin Settings */}
                {isAdmin && (
                  <>
                    <hr className="my-1 border-border" />
                    <div className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Settings
                    </div>
                    <Link
                      to="/integrations"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                    >
                      <Icons.Link />
                      <span>Integrations</span>
                    </Link>
                    <Link
                      to="/settings/cloud-credentials"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                    >
                      <Icons.Cloud />
                      <span>Cloud Credentials</span>
                    </Link>
                    <Link
                      to="/import"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                    >
                      <Icons.Import />
                      <span>Import Data</span>
                    </Link>
                    <Link
                      to="/settings/semantic-import"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                    >
                      <Icons.Import />
                      <span>AI Import</span>
                    </Link>
                    <Link
                      to="/settings/api-keys"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                    >
                      <Icons.Key />
                      <span>API Keys</span>
                    </Link>
                    <Link
                      to="/settings/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-popover-foreground hover:bg-muted"
                    >
                      <Icons.Settings />
                      <span>Account Settings</span>
                    </Link>
                  </>
                )}

                {/* Logout */}
                <hr className="my-1 border-border" />
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Icons.Logout />
                  <span>Log Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;

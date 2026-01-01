import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { authAPI } from '../lib/api-client';

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
  Logout: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
};

export function Header({ sidebarCollapsed }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

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
        {/* Help */}
        <button
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          title="Help & Documentation"
        >
          <Icons.Question />
        </button>

        {/* Notifications */}
        <Link
          to="/incidents"
          className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          title="Notifications"
        >
          <Icons.Bell />
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Log Out"
        >
          <Icons.Logout />
        </button>
      </div>
    </header>
  );
}

export default Header;

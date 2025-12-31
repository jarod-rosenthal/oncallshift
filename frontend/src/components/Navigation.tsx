import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuthStore } from '../store/auth-store';
import { authAPI } from '../lib/api-client';

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    authAPI.logout();
    clearAuth();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/incidents', label: 'Incidents' },
    { path: '/schedules', label: 'Schedules' },
    { path: '/escalation-policies', label: 'Escalation Policies' },
    { path: '/availability', label: 'Availability' },
    { path: '/profile', label: 'Profile' },
    ...(user?.role === 'admin' ? [{ path: '/admin/users', label: 'Admin' }] : []),
  ];

  return (
    <header className="border-b bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/dashboard" className="text-2xl font-bold tracking-tight hover:opacity-90">
            OnCallShift
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Button
            variant="ghost"
            className="border border-white/50 text-white hover:bg-white/20 hover:text-white"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

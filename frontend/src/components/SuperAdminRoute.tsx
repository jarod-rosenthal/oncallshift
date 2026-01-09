import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { ProtectedRoute } from './ProtectedRoute';

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

export function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const user = useAuthStore((state) => state.user);

  return (
    <ProtectedRoute>
      {/* Wait for user to load before checking role - prevents redirect on F5 refresh */}
      {!user ? (
        <div className="flex items-center justify-center min-h-screen">Loading...</div>
      ) : user.role === 'super_admin' ? (
        children
      ) : (
        <Navigate to="/dashboard" replace />
      )}
    </ProtectedRoute>
  );
}

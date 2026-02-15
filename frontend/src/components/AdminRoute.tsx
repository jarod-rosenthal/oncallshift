import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { ProtectedRoute } from './ProtectedRoute';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const user = useAuthStore((state) => state.user);

  const isAdmin = user?.role === 'admin';

  return (
    <ProtectedRoute>
      {isAdmin ? (
        children
      ) : (
        <Navigate to="/dashboard" replace />
      )}
    </ProtectedRoute>
  );
}

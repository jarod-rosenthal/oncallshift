import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { usersAPI } from '../lib/api-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  useEffect(() => {
    // Fetch user data when authenticated but no user data
    if (isAuthenticated && !user && !isLoadingUser) {
      setIsLoadingUser(true);
      usersAPI.getMe()
        .then((response) => {
          setUser(response.user);
        })
        .catch(() => {
          // If fetching user fails, the 401 interceptor will handle logout
        })
        .finally(() => {
          setIsLoadingUser(false);
        });
    }
  }, [isAuthenticated, user, setUser, isLoadingUser]);

  // Wait for auth to initialize before redirecting
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Wait for user data to load
  if (!user && isLoadingUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return <>{children}</>;
}

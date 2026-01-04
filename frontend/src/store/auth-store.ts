import { create } from 'zustand';
import type { AuthTokens, User } from '../types/api';

interface AuthState {
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  user: User | null;
  isInitialized: boolean;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
  initializeAuth: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  tokens: null,
  user: null,
  isInitialized: false,

  setTokens: (tokens: AuthTokens) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('idToken', tokens.idToken);
    set({ tokens, isAuthenticated: true });
  },

  setUser: (user: User | null) => {
    set({ user });
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('idToken');
    set({ tokens: null, user: null, isAuthenticated: false });
  },

  initializeAuth: () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const idToken = localStorage.getItem('idToken');

    if (accessToken && refreshToken && idToken) {
      set({
        tokens: {
          accessToken,
          refreshToken,
          idToken,
          expiresIn: 3600, // Will be refreshed automatically
        },
        isAuthenticated: true,
        isInitialized: true,
      });
    } else {
      set({ isInitialized: true });
    }
  },

  isAdmin: () => {
    const state = get();
    return state.user?.role === 'admin' || state.user?.role === 'super_admin';
  },
}));

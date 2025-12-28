import { create } from 'zustand';
import type { AuthTokens } from '../types/api';

interface AuthState {
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  setTokens: (tokens: AuthTokens) => void;
  clearAuth: () => void;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  tokens: null,

  setTokens: (tokens: AuthTokens) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('idToken', tokens.idToken);
    set({ tokens, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('idToken');
    set({ tokens: null, isAuthenticated: false });
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
      });
    }
  },
}));

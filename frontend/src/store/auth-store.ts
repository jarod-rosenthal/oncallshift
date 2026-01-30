import { create } from 'zustand';
import type { AuthTokens, User } from '../types/api';

interface AuthState {
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  user: User | null;
  isInitialized: boolean;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => Promise<void>;
  initializeAuth: () => void;
  isAdmin: () => boolean;
}

// Promise-based sign-out deduplication
let signOutPromise: Promise<void> | null = null;

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

  clearAuth: async () => {
    // If a sign-out is already in progress, return the existing promise
    if (signOutPromise) {
      return signOutPromise;
    }

    // Create a new sign-out promise
    signOutPromise = (async () => {
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('idToken');
        set({ tokens: null, user: null, isAuthenticated: false });
      } finally {
        // Clear the promise after completion to allow future sign-outs
        signOutPromise = null;
      }
    })();

    return signOutPromise;
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

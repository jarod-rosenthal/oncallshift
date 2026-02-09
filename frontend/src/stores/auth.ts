import { create } from "zustand";

interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  organizationId: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem("accessToken"),
  isAuthenticated: !!localStorage.getItem("accessToken"),

  setAuth: (user, accessToken) => {
    localStorage.setItem("accessToken", accessToken);
    set({ user, accessToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem("accessToken");
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));

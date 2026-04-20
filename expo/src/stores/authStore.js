import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user,
  isAuthenticated: false,
  isLoading: true,
  error,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ user, isAuthenticated: false, isLoading: false, error: null }),
}));

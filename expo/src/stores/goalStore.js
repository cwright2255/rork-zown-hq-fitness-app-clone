import { create } from 'zustand';

export const useGoalStore = create((set) => ({
  goals: [],
  isLoading: false,
  error: null,
  setGoals: (goals) => set({ goals, isLoading: false }),
  addGoal: (goal) => set((state) => ({ goals: [goal, ...state.goals] })),
  updateGoal: (id, patch) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g))
    })),
  removeGoal: (id) =>
    set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ goals: [], isLoading: false, error: null })
}));

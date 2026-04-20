import { create } from 'zustand';

export const useAIStore = create((set) => ({
  recommendations: [],
  isGenerating: false,
  isLoading: false,
  error,
  setRecommendations: (recommendations) => set({ recommendations, isLoading: false }),
  addRecommendation: (item) =>
    set((state) => ({ recommendations: [item, ...state.recommendations] })),
  markAsRead: (id) =>
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, isRead: true } : r,
      ),
    })),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false, isGenerating: false }),
  reset: () =>
    set({
      recommendations: [],
      isGenerating: false,
      isLoading: false,
      error,
    }),
}));

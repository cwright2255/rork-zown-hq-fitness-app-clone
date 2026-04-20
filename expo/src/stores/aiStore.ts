import { create } from 'zustand';
import type { AIRecommendation } from '../types/firestore';

interface AIState {
  recommendations: AIRecommendation[];
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  setRecommendations: (items: AIRecommendation[]) => void;
  addRecommendation: (item: AIRecommendation) => void;
  markAsRead: (id: string) => void;
  setGenerating: (generating: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  recommendations: [],
  isGenerating: false,
  isLoading: false,
  error: null,
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
      error: null,
    }),
}));

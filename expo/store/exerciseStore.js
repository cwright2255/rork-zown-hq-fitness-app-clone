import { create } from 'zustand';
import {
  fetchExercises,
  fetchEquipments,
  fetchMuscles,
  filterExercises,
} from '../services/exerciseDbService';

export const useExerciseStore = create((set, get) => ({
  exercises: [],
  filteredExercises: [],
  equipments: [],
  muscles: [],
  isLoading: false,
  error: null,
  cursor: null,
  hasNextPage: false,
  filters: { query: '', equipment: '', bodyPart: '', muscle: '' },

  loadEquipments: async () => {
    try {
      const data = await fetchEquipments();
      set({ equipments: data.map((e) => e.name) });
    } catch (e) {
      console.error('[ExerciseStore] loadEquipments:', e);
    }
  },

  loadMuscles: async () => {
    try {
      const data = await fetchMuscles();
      set({ muscles: data.map((m) => m.name) });
    } catch (e) {
      console.error('[ExerciseStore] loadMuscles:', e);
    }
  },

  loadExercises: async (reset = false) => {
    const { cursor, isLoading, hasNextPage, exercises } = get();
    if (isLoading) return;
    if (!reset && !hasNextPage && exercises.length > 0) return;

    set({ isLoading: true, error: null });
    try {
      const result = await fetchExercises({ limit: 50, cursor: reset ? null : cursor });
      const data = Array.isArray(result?.data) ? result.data : [];
      const meta = result?.meta || {};
      const newExercises = reset ? data : [...exercises, ...data];
      set({
        exercises: newExercises,
        cursor: meta.nextCursor || null,
        hasNextPage: !!meta.hasNextPage,
        isLoading: false,
      });
      get().applyFilters();
    } catch (e) {
      console.error('[ExerciseStore] loadExercises:', e);
      set({ isLoading: false, error: e.message || 'Failed to load exercises' });
    }
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
    get().applyFilters();
  },

  applyFilters: () => {
    const { exercises, filters } = get();
    set({ filteredExercises: filterExercises(exercises, filters) });
  },
}));

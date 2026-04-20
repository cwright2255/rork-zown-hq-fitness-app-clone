import { create } from 'zustand';

export const useWorkoutStore = create((set) => ({
  workouts: [],
  activeWorkout,
  isLoading: false,
  error,
  setWorkouts: (workouts) => set({ workouts, isLoading: false }),
  addWorkout: (workout) =>
    set((state) => ({ workouts: [workout, ...state.workouts] })),
  updateWorkout: (id, patch) =>
    set((state) => ({
      workouts: state.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      activeWorkout:
        state.activeWorkout?.id === id
          ? { ...state.activeWorkout, ...patch }
          : state.activeWorkout,
    })),
  removeWorkout: (id) =>
    set((state) => ({
      workouts: state.workouts.filter((w) => w.id !== id),
      activeWorkout: state.activeWorkout?.id === id ? null : state.activeWorkout,
    })),
  setActiveWorkout: (activeWorkout) => set({ activeWorkout }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () =>
    set({ workouts: [], activeWorkout, isLoading: false, error: null }),
}));

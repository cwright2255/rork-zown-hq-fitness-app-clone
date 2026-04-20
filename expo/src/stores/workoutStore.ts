import { create } from 'zustand';
import type { Workout } from '../types/firestore';

interface WorkoutState {
  workouts: Workout[];
  activeWorkout: Workout | null;
  isLoading: boolean;
  error: string | null;
  setWorkouts: (workouts: Workout[]) => void;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, patch: Partial<Workout>) => void;
  removeWorkout: (id: string) => void;
  setActiveWorkout: (workout: Workout | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  workouts: [],
  activeWorkout: null,
  isLoading: false,
  error: null,
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
    set({ workouts: [], activeWorkout: null, isLoading: false, error: null }),
}));

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Workout, Exercise, WorkoutSession, WorkoutCategory, WorkoutPlan, WorkoutEquipment } from '@/types';

interface WorkoutStore {
  workouts: Workout[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  plans: WorkoutPlan[];
  categories: WorkoutCategory[];
  equipment: WorkoutEquipment[];
  activeWorkout: Workout | null;
  activeSession: WorkoutSession | null;
  currentPlan: WorkoutPlan | null;
  isLoading: boolean;
  error: string | null;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, workout: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (exercise: Exercise) => void;
  updateExercise: (id: string, exercise: Partial<Exercise>) => void;
  deleteExercise: (id: string) => void;
  addSession: (session: WorkoutSession) => void;
  updateSession: (id: string, session: Partial<WorkoutSession>) => void;
  deleteSession: (id: string) => void;
  setActiveWorkout: (workout: Workout | null) => void;
  setActiveSession: (session: WorkoutSession | null) => void;
  setCurrentPlan: (plan: WorkoutPlan | null) => void;
  addPlan: (plan: WorkoutPlan) => void;
  updatePlan: (id: string, plan: Partial<WorkoutPlan>) => void;
  deletePlan: (id: string) => void;
  addCategory: (category: WorkoutCategory) => void;
  updateCategory: (id: string, category: Partial<WorkoutCategory>) => void;
  deleteCategory: (id: string) => void;
  addEquipment: (equipment: WorkoutEquipment) => void;
  updateEquipment: (id: string, equipment: Partial<WorkoutEquipment>) => void;
  deleteEquipment: (id: string) => void;
  setLoading: (status: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  workouts: [],
  exercises: [],
  sessions: [],
  plans: [],
  categories: [],
  equipment: [],
  activeWorkout: null,
  activeSession: null,
  currentPlan: null,
  isLoading: false,
  error: null,
};

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addWorkout: (workout) => set({ workouts: [...get().workouts, workout] }),
      updateWorkout: (id, workout) => set({
        workouts: get().workouts.map(w => w.id === id ? { ...w, ...workout } : w)
      }),
      deleteWorkout: (id) => set({
        workouts: get().workouts.filter(w => w.id !== id)
      }),

      addExercise: (exercise) => set({ exercises: [...get().exercises, exercise] }),
      updateExercise: (id, exercise) => set({
        exercises: get().exercises.map(e => e.id === id ? { ...e, ...exercise } : e)
      }),
      deleteExercise: (id) => set({
        exercises: get().exercises.filter(e => e.id !== id)
      }),

      addSession: (session) => set({ sessions: [...get().sessions, session] }),
      updateSession: (id, session) => set({
        sessions: get().sessions.map(s => s.id === id ? { ...s, ...session } : s)
      }),
      deleteSession: (id) => set({
        sessions: get().sessions.filter(s => s.id !== id)
      }),

      setActiveWorkout: (workout) => set({ activeWorkout: workout }),
      setActiveSession: (session) => set({ activeSession: session }),
      setCurrentPlan: (plan) => set({ currentPlan: plan }),

      addPlan: (plan) => set({ plans: [...get().plans, plan] }),
      updatePlan: (id, plan) => set({
        plans: get().plans.map(p => p.id === id ? { ...p, ...plan } : p)
      }),
      deletePlan: (id) => set({
        plans: get().plans.filter(p => p.id !== id)
      }),

      addCategory: (category) => set({ categories: [...get().categories, category] }),
      updateCategory: (id, category) => set({
        categories: get().categories.map(c => {
          if (typeof c === 'string') {
            return c === id ? (category as WorkoutCategory) : c;
          } else if (typeof c === 'object' && c !== null && 'id' in c) {
            const categoryObj = c as { id: string; name: string };
            return categoryObj.id === id ? { ...categoryObj, ...(category as Partial<{ id: string; name: string }>) } as WorkoutCategory : c;
          }
          return c;
        })
      }),
      deleteCategory: (id) => set({
        categories: get().categories.filter(c => {
          if (typeof c === 'string') {
            return c !== id;
          } else if (typeof c === 'object' && c !== null && 'id' in c) {
            return c.id !== id;
          }
          return true;
        })
      }),

      addEquipment: (equipment) => set({ equipment: [...get().equipment, equipment] }),
      updateEquipment: (id, equipment) => set({
        equipment: get().equipment.map(e => e.id === id ? { ...e, ...equipment } : e)
      }),
      deleteEquipment: (id) => set({
        equipment: get().equipment.filter(e => e.id !== id)
      }),

      setLoading: (status) => set({ isLoading: status }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: 'workout-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Selectors
export const workoutsSelector = (state: WorkoutStore) => state.workouts;
export const exercisesSelector = (state: WorkoutStore) => state.exercises;
export const sessionsSelector = (state: WorkoutStore) => state.sessions;
export const plansSelector = (state: WorkoutStore) => state.plans;
export const categoriesSelector = (state: WorkoutStore) => state.categories;
export const equipmentSelector = (state: WorkoutStore) => state.equipment;
export const activeWorkoutSelector = (state: WorkoutStore) => state.activeWorkout;
export const activeSessionSelector = (state: WorkoutStore) => state.activeSession;
export const currentPlanSelector = (state: WorkoutStore) => state.currentPlan;
export const workoutLoadingSelector = (state: WorkoutStore) => state.isLoading;
export const workoutErrorSelector = (state: WorkoutStore) => state.error;

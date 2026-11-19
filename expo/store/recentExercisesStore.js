// store/recentExercisesStore.js
//
// The exercises the person has opened lately, newest first, kept on the phone for the "Recent" choice under Browse Exercises on the Workouts
// tab (the list itself is built by lib/exerciseBrowse.js). It belongs to the person, not the phone: lib/logOut.js puts it back to empty and
// removes what was saved.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addToRecent } from '../lib/exerciseBrowse';

export const useRecentExercisesStore = create(
  persist(
    (set) => ({
      recent: [],
      /** Called when an exercise is opened. */
      addRecent: (exercise) => set((state) => {
        const recent = addToRecent(state.recent, exercise);
        return recent === state.recent ? state : { recent };
      }),
    }),
    {
      name: 'zown-recent-exercises',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ recent: state.recent }),
    },
  ),
);

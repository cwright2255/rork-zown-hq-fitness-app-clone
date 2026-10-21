import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { serverTotalsFrom } from '../lib/lifetimeTotals';

// The server's count of everything the person has saved (workouts, time, calories), kept at users/{uid}/stats/totals and only ever
// written there. The phone holds it to show before the server answers, and services/progressSync.js keeps it up to date. Screens do
// not read it directly: lib/lifetimeTotals.js puts it together with the workouts the phone holds.
export const useLifetimeStore = create(
  persist(
    (set) => ({
      // { totalWorkouts, finishedWorkouts, totalSeconds, totalCalories, bestCalories }, or null before the server has counted
      totals: null,

      // `data` is the totals document as the server wrote it; one that is missing or is the old running count leaves nothing to show.
      applyTotals: (data) => set({ totals: serverTotalsFrom(data) }),

      clearTotals: () => set({ totals: null }),
    }),
    {
      name: 'zown-lifetime-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ totals: state.totals }),
    }
  )
);

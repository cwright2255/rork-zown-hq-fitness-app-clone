import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const useRunningStore = create(
  persist(
    (set, get) => ({
      runs: [],
      activeRun: null,
      isLoading: false,

      loadRuns: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'running'));
          if (snap.exists()) {
            set({ runs: snap.data().runs || [] });
          }
        } catch (e) {
          console.warn('[runningStore] loadRuns error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      _persist: async (uid) => {
        if (!uid) return;
        try {
          await setDoc(doc(db, 'users', uid, 'data', 'running'), {
            runs: get().runs.slice(-100),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[runningStore] _persist error:', e?.message);
        }
      },

      startRun: () => {
        set({ activeRun: { startTime: new Date().toISOString(), distance: 0, duration: 0, pace: 0, calories: 0, coords: [] } });
      },

      updateActiveRun: (data) => {
        set((s) => ({ activeRun: s.activeRun ? { ...s.activeRun, ...data } : null }));
      },

      endRun: (uid) => {
        const { activeRun } = get();
        if (!activeRun) return null;
        const completed = { ...activeRun, id: Date.now().toString(), endTime: new Date().toISOString() };
        set((s) => ({ runs: [completed, ...s.runs], activeRun: null }));
        get()._persist(uid);
        return completed;
      },

      getStats: () => {
        const { runs } = get();
        const totalDistance = runs.reduce((s, r) => s + (r.distance || 0), 0);
        const totalDuration = runs.reduce((s, r) => s + (r.duration || 0), 0);
        const totalCalories = runs.reduce((s, r) => s + (r.calories || 0), 0);
        const avgPace = runs.length > 0 ? runs.reduce((s, r) => s + (r.pace || 0), 0) / runs.length : 0;
        return { totalRuns: runs.length, totalDistance, totalDuration, totalCalories, avgPace };
      },
    }),
    {
      name: 'running-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ runs: s.runs.slice(-100) }),
    }
  )
);

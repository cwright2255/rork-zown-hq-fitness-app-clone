import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { RUNNING_PROGRAMS as STATIC_RUNNING_PROGRAMS } from '@/data/runningPrograms';

export const useRunningStore = create(
  persist(
    (set, get) => ({
      runs: [],
      activeRun: null,
      isLoading: false,
      // Real program catalog, loaded from Firestore so the admin console
      // (see admin/) can actually edit it - falls back to the verified
      // static data (data/runningPrograms.js) if Firestore's collection
      // is empty or unreachable, so the app never shows nothing just
      // because a migration hasn't run yet or a device is offline.
      programs: STATIC_RUNNING_PROGRAMS,
      programsLoaded: false,

      loadRunningPrograms: async () => {
        try {
          const snap = await getDocs(collection(db, 'runningPrograms'));
          if (!snap.empty) {
            const programs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            set({ programs, programsLoaded: true });
          } else {
            set({ programsLoaded: true }); // stays on the static fallback already in state
          }
        } catch (e) {
          console.warn('[runningStore] loadRunningPrograms error, using static fallback:', e?.message);
          set({ programsLoaded: true });
        }
      },

      // Program tracking - which structured program (e.g. Couch to 5K) the
      // user has started, and how far through it they are. Real content
      // lives in data/runningPrograms.js, not duplicated here.
      activeProgramId: null,
      programProgress: {}, // { [programId]: { currentWeek, completedSessionIndexes: [] } }

      loadRuns: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'running'));
          if (snap.exists()) {
            const d = snap.data();
            set({
              runs: d.runs || [],
              activeProgramId: d.activeProgramId || null,
              programProgress: d.programProgress || {},
            });
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
            activeProgramId: get().activeProgramId,
            programProgress: get().programProgress,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[runningStore] _persist error:', e?.message);
        }
      },

      startProgram: (programId, uid) => {
        set((s) => ({
          activeProgramId: programId,
          programProgress: {
            ...s.programProgress,
            [programId]: s.programProgress[programId] || { currentWeek: 1, completedSessionIndexes: [] },
          },
        }));
        get()._persist(uid);
      },

      // Marks the current session done and advances to the next week once
      // that week's sessionsPerWeek target is hit. sessionsPerWeek is
      // passed in rather than imported from data/runningPrograms.js here,
      // keeping the store free of a hard dependency on the program catalog
      // shape.
      completeProgramSession: (programId, sessionsPerWeek, uid) => {
        set((s) => {
          const progress = s.programProgress[programId] || { currentWeek: 1, completedSessionIndexes: [] };
          const completedSessionIndexes = [...progress.completedSessionIndexes, progress.completedSessionIndexes.length];
          const advancesWeek = completedSessionIndexes.length >= sessionsPerWeek;
          return {
            programProgress: {
              ...s.programProgress,
              [programId]: advancesWeek
                ? { currentWeek: progress.currentWeek + 1, completedSessionIndexes: [] }
                : { ...progress, completedSessionIndexes },
            },
          };
        });
        get()._persist(uid);
      },

      // Real personal records, computed from actual run history - not
      // fabricated placeholder numbers. Returns null for any record with
      // no qualifying run yet, so the UI can show an honest "not set yet"
      // state instead of a fake number.
      getPersonalRecords: () => {
        const { runs } = get();
        if (runs.length === 0) {
          return { longestRun: null, fastestPace: null, best5k: null, totalDistance: 0 };
        }
        const longestRun = runs.reduce((best, r) => (!best || r.distance > best.distance ? r : best), null);
        const runsWithPace = runs.filter((r) => r.pace > 0);
        const fastestPace = runsWithPace.length
          ? runsWithPace.reduce((best, r) => (r.pace < best.pace ? r : best))
          : null;
        // "5K" here means any run of at least 4.5km - real-world GPS runs
        // rarely land on exactly 5.00km, so this uses the same tolerance
        // most running apps use for a qualifying 5K time.
        const fiveKRuns = runs.filter((r) => r.distance >= 4.5);
        const best5k = fiveKRuns.length
          ? fiveKRuns.reduce((best, r) => (r.duration < best.duration ? r : best))
          : null;
        const totalDistance = runs.reduce((s, r) => s + (r.distance || 0), 0);
        return { longestRun, fastestPace, best5k, totalDistance };
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
      partialize: (s) => ({
        runs: s.runs.slice(-100),
        activeProgramId: s.activeProgramId,
        programProgress: s.programProgress,
      }),
    }
  )
);

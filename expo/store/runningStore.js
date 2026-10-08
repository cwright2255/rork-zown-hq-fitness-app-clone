import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { RUNNING_PROGRAMS as STATIC_RUNNING_PROGRAMS } from '@/data/runningPrograms';
import {
  MAX_SAVED_RUNS, newestRuns, fitRunsToSize, buildSavedRun, shouldSaveRun, personalRecords, summarizeRuns,
} from '../lib/runStats';

export const useRunningStore = create(
  persist(
    (set, get) => ({
      runs: [],
      activeRun: null,
      isLoading: false,
      // Real program catalog, loaded from Firestore so the admin console
      // (see admin/) can actually edit it — falls back to the verified
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

      // Program tracking — which structured program (e.g. Couch to 5K) the
      // user has started, and how far through it they are. Real content
      // lives in data/runningPrograms.js, not duplicated here.
      activeProgramId: null,
      programProgress: {}, // { [programId]: { currentWeek, completedSessionIndexes: [] } }
      favoriteProgramIds: [],

      loadRuns: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'running'));
          if (snap.exists()) {
            const d = snap.data();
            const serverRuns = Array.isArray(d.runs) ? d.runs : [];
            // A run that finished on this phone but never reached Firestore
            // (no signal, signed out for a moment) must not be wiped by the
            // older list from the server: keep this user's unsynced runs and
            // send them up again.
            const onServer = new Set(serverRuns.filter(Boolean).map((r) => String(r.id)));
            const unsynced = get().runs.filter((r) => r && r.uid === uid && !onServer.has(String(r.id)));
            set({
              runs: newestRuns([...serverRuns, ...unsynced]),
              activeProgramId: d.activeProgramId || null,
              programProgress: d.programProgress || {},
              favoriteProgramIds: d.favoriteProgramIds || [],
            });
            if (unsynced.length > 0) get()._persist(uid);
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
            runs: fitRunsToSize(get().runs),
            activeProgramId: get().activeProgramId,
            programProgress: get().programProgress,
            favoriteProgramIds: get().favoriteProgramIds,
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

      // Real, Firestore-persisted favorites - reuses the exact same
      // _persist write already proven for programProgress, rather than
      // the local-only pattern seen elsewhere (store/workoutStore.js's
      // toggleFavorite has no Firestore write at all).
      toggleFavoriteProgram: (programId, uid) => {
        set((s) => ({
          favoriteProgramIds: s.favoriteProgramIds.includes(programId)
            ? s.favoriteProgramIds.filter((id) => id !== programId)
            : [...s.favoriteProgramIds, programId],
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

      // Real personal records, computed from actual run history — not
      // fabricated placeholder numbers. Returns null for any record with
      // no qualifying run yet, so the UI can show an honest "not set yet"
      // state instead of a fake number.
      getPersonalRecords: () => personalRecords(get().runs),

      startRun: () => {
        set({ activeRun: { startTime: new Date().toISOString(), distance: 0, duration: 0, pace: 0, calories: 0, coords: [] } });
      },

      updateActiveRun: (data) => {
        set((s) => ({ activeRun: s.activeRun ? { ...s.activeRun, ...data } : null }));
      },

      // Saves a finished run and returns it (null if it was too short to
      // keep). `data` is what the run screen tracked (distance in km,
      // duration in seconds, calories, coords). It is passed in directly
      // because nothing ever called startRun(), so there was no activeRun to
      // hold it and every finished run was silently thrown away.
      endRun: (uid, data) => {
        const completed = buildSavedRun(get().activeRun, data, { uid });
        if (!shouldSaveRun(completed)) {
          set({ activeRun: null });
          return null;
        }
        set((s) => ({ runs: newestRuns([completed, ...s.runs]), activeRun: null }));
        get()._persist(uid);
        return completed;
      },

      getStats: () => summarizeRuns(get().runs),
    }),
    {
      name: 'running-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        runs: s.runs.slice(0, MAX_SAVED_RUNS),
        activeProgramId: s.activeProgramId,
        programProgress: s.programProgress,
      }),
    }
  )
);

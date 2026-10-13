// store/runTrackerStore.js
//
// The run being recorded right now. It lives outside any screen so GPS
// readings keep arriving while the app is in the background or the run screen
// is closed. All the logic is in lib/runTracker.js; this only holds the state.
//
// A hike (and only a hike) is also kept on the phone while it is recorded, so it
// is not lost if the app is closed under it: it is saved every few seconds (and
// at once when it is paused, resumed, finished or the app leaves the screen), and
// read back when the app opens. What a saved hike turns into is decided in
// lib/hikeRecovery.js; `recovered` says one was found, until someone has been
// asked what to do with it (components/HikeRecoveryPrompt.jsx).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createTracker, startTracker, applyFixes, pauseTracker, resumeTracker,
  setAutoPause as setAutoPauseOn, finishTracker, shouldAdoptSession,
} from '../lib/runTracker';
import { durableTracker, restoreTracker, canResumeSession, cleanContext } from '../lib/hikeRecovery';
import { createThrottledStorage } from '../lib/throttledStorage';
import { cleanGoalKm } from '../lib/runGoal';

// The phone's key/value storage, or null where there is none (a test, an old
// build): then a hike is simply not kept, and nothing else changes.
let phoneStorage;
function asyncStorage() {
  if (phoneStorage === undefined) {
    try {
      // eslint-disable-next-line global-require
      const mod = require('@react-native-async-storage/async-storage');
      const found = mod && (mod.default || mod);
      phoneStorage = found && typeof found.getItem === 'function' ? found : null;
    } catch (e) {
      phoneStorage = null;
    }
  }
  return phoneStorage;
}

const storage = createThrottledStorage(asyncStorage);

/** Writes the hike to the phone now, instead of waiting for the next save. */
export const flushRunTracker = () => storage.flush();

// Whether the saved hike (if any) has been read back. GPS readings that arrive
// before that wait for it (services/runTracking.js).
let hydrated = false;
const waiting = [];
function markReady() {
  hydrated = true;
  waiting.splice(0).forEach((resolve) => resolve());
}
export const isTrackerReady = () => hydrated;
export const whenTrackerReady = () => (hydrated ? Promise.resolve() : new Promise((resolve) => waiting.push(resolve)));

export const useRunTrackerStore = create(
  persist(
    (set, get) => ({
      tracker: createTracker(),
      context: null, // the map and path chosen for the hike being recorded: { mapId?, pathName? }
      recovered: false,
      goalKm: null, // the distance goal picked on the run screen, in km; kept while the app is open, not saved to the phone

      /**
       * Starts a run, unless one of the same kind was left a short while ago
       * (paused when you backed out of the screen), in which case that one is
       * picked up again. `kind` says what is being recorded ('run', 'walk' or a
       * program session). With `resume`, a recording of that kind is picked up
       * however long ago it was left (an unfinished hike opened from the prompt).
       * `context` is kept with a hike. Returns 'new' or 'resumed'.
       */
      begin: ({ autoPause = true, now = Date.now(), kind, context, resume = false } = {}) => {
        const { tracker } = get();
        if (resume ? canResumeSession(tracker, kind) : shouldAdoptSession(tracker, now, kind)) {
          set((s) => ({ recovered: false, context: cleanContext(context) || s.context }));
          flushRunTracker();
          return 'resumed';
        }
        set({ tracker: startTracker(createTracker({ autoPause, kind }), now), context: cleanContext(context), recovered: false, goalKm: null });
        flushRunTracker();
        return 'new';
      },

      /** GPS readings, as expo-location delivers them. */
      ingest: (locations) => set((s) => ({ tracker: applyFixes(s.tracker, locations) })),

      pause: (now = Date.now()) => {
        set((s) => ({ tracker: pauseTracker(s.tracker, now) }));
        flushRunTracker();
      },
      resume: (now = Date.now()) => {
        set((s) => ({ tracker: resumeTracker(s.tracker, now) }));
        flushRunTracker();
      },
      setAutoPause: (enabled, now = Date.now()) => {
        set((s) => ({ tracker: setAutoPauseOn(s.tracker, enabled, now) }));
        flushRunTracker();
      },

      /** The distance goal for this run, in km (null for none). */
      setGoalKm: (km) => set({ goalKm: cleanGoalKm(km) }),

      /** Ends the run and returns what to save (see finishTracker). */
      finish: (now = Date.now()) => {
        const summary = finishTracker(get().tracker, now);
        set({ tracker: createTracker(), context: null, recovered: false, goalKm: null });
        flushRunTracker();
        return summary;
      },

      /** Throws the run away. */
      reset: () => {
        set({ tracker: createTracker(), context: null, recovered: false, goalKm: null });
        flushRunTracker();
      },

      /** Someone has been asked what to do with the hike that was found. */
      acknowledgeRecovery: () => set({ recovered: false }),
    }),
    {
      name: 'zown-run-tracker',
      version: 1,
      storage,
      partialize: (s) => {
        const tracker = durableTracker(s.tracker);
        return { tracker, context: tracker ? s.context : null };
      },
      merge: (saved, current) => {
        // Something has been started since the app opened: that wins.
        if (current.tracker.status !== 'idle') return current;
        const tracker = restoreTracker(saved && saved.tracker, Date.now());
        if (!tracker) return current;
        return { ...current, tracker, context: cleanContext(saved.context), recovered: true };
      },
      onRehydrateStorage: () => markReady,
    },
  ),
);

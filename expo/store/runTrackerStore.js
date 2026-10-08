// store/runTrackerStore.js
//
// The run being recorded right now. It lives outside any screen so GPS
// readings keep arriving while the app is in the background or the run screen
// is closed. All the logic is in lib/runTracker.js; this only holds the state.
// Not persisted: it describes a run in progress, not history.

import { create } from 'zustand';
import {
  createTracker, startTracker, applyFixes, pauseTracker, resumeTracker,
  setAutoPause as setAutoPauseOn, finishTracker, shouldAdoptSession,
} from '../lib/runTracker';

export const useRunTrackerStore = create((set, get) => ({
  tracker: createTracker(),

  /**
   * Starts a run, unless one of the same kind was left a short while ago
   * (paused when you backed out of the screen), in which case that one is
   * picked up again. `kind` says what is being recorded ('run', 'walk' or a
   * program session). Returns 'new' or 'resumed'.
   */
  begin: ({ autoPause = true, now = Date.now(), kind } = {}) => {
    if (shouldAdoptSession(get().tracker, now, kind)) return 'resumed';
    set({ tracker: startTracker(createTracker({ autoPause, kind }), now) });
    return 'new';
  },

  /** GPS readings, as expo-location delivers them. */
  ingest: (locations) => set((s) => ({ tracker: applyFixes(s.tracker, locations) })),

  pause: (now = Date.now()) => set((s) => ({ tracker: pauseTracker(s.tracker, now) })),
  resume: (now = Date.now()) => set((s) => ({ tracker: resumeTracker(s.tracker, now) })),
  setAutoPause: (enabled, now = Date.now()) => set((s) => ({ tracker: setAutoPauseOn(s.tracker, enabled, now) })),

  /** Ends the run and returns what to save (see finishTracker). */
  finish: (now = Date.now()) => {
    const summary = finishTracker(get().tracker, now);
    set({ tracker: createTracker() });
    return summary;
  },

  /** Throws the run away. */
  reset: () => set({ tracker: createTracker() }),
}));

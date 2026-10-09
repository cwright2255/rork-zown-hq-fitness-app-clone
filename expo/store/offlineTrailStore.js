// store/offlineTrailStore.js
//
// Trails kept on the phone so the trail page, the saved list and the hike screen
// still work with no signal (see lib/offlineTrails.js for what a record holds and
// how it is kept small). Separate from store/hikingStore.js on purpose: a trail's
// line is big, and that store is written to the phone on every change.
//
// There is nothing personal in a record (it is the same public trail data for
// everyone), so records are not tied to a user.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeOfflineTrail, limitOfflineTrails } from '../lib/offlineTrails';

export const useOfflineTrailStore = create(
  persist(
    (set, get) => ({
      // { [trailId]: record }
      trails: {},

      /**
       * Keeps what was found for a trail, added to what is already kept for it.
       * `input`: { trail, maps?, routes?, pinned? }. `pinned` marks a trail the
       * person saved, which is the last to be dropped when space runs out.
       */
      keepTrail: (input) => {
        const id = input && input.trail && input.trail.id;
        if (!id) return;
        const previous = get().trails[id] || null;
        const next = mergeOfflineTrail(previous, input, Date.now());
        if (!next || next === previous) return;
        set({ trails: limitOfflineTrails({ ...get().trails, [id]: next }, { keepId: id }) });
      },

      removeTrail: (id) => {
        if (!id || !get().trails[id]) return;
        const { [id]: removed, ...rest } = get().trails;
        set({ trails: rest });
      },
    }),
    {
      name: 'offline-trails',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ trails: s.trails }),
    },
  ),
);

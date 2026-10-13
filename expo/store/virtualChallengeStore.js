// store/virtualChallengeStore.js
//
// Virtual journeys (lib/virtualJourneys.js): pick a real-world route, e.g. the
// 34 km Grand Canyon Rim Trail, and the distance of every run and walk you record
// after joining counts toward finishing it. This store keeps what each person has
// joined and covered.
//
// Progress is kept on the phone first, per person, so a run finished with no
// signal still counts, and copied to the person's own private document
// (users/{uid}/data/virtualChallenges) so a new phone starts where the old one
// stopped. The two copies are joined by keeping, for each journey, whichever is
// further along. Nothing here is shared with other people.
//
// Finishing a journey pays XP and a badge (services/journeyRewards.js), once. There
// is no physical medal.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { JOURNEYS, journeyById } from '../lib/virtualJourneys';
import { rewardJourney } from '../services/journeyRewards';

/** The catalogue of routes (kept under its old name for anything that still imports it). */
export const VIRTUAL_CHALLENGES = JOURNEYS;

const ref = (uid) => doc(db, 'users', uid, 'data', 'virtualChallenges');

const earlier = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  return a <= b ? a : b;
};

/**
 * Two copies of one person's journeys, joined: every journey from either, and for a
 * journey in both, the copy that is further along (the earliest start and finish).
 */
export function mergeJourneys(a, b) {
  const merged = {};
  for (const id of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = (a || {})[id];
    const y = (b || {})[id];
    if (!x || !y) {
      merged[id] = x || y;
    } else {
      merged[id] = {
        startedAt: earlier(x.startedAt, y.startedAt),
        distanceKm: Math.max(Number(x.distanceKm) || 0, Number(y.distanceKm) || 0),
        completedAt: earlier(x.completedAt, y.completedAt),
      };
    }
  }
  return merged;
}

// True when the account copy already holds everything in the merged copy, so there is
// nothing to send it. (The merged copy has every journey either copy has.)
const holds = (remote, merged) => Object.entries(merged).every(([id, m]) => {
  const r = remote[id];
  return !!r && m.distanceKm === r.distanceKm && m.startedAt === r.startedAt && (m.completedAt || null) === (r.completedAt || null);
});

let loading = null; // { uid, promise } while a load is under way

export const useVirtualChallengeStore = create(
  persist(
    (set, get) => ({
      byUser: {}, // { [uid]: { [journeyId]: { startedAt, distanceKm, completedAt } } }
      loadedFor: null, // the person whose account copy has been read this time the app was open

      /** Joins a journey. Returns false for nobody or a route that does not exist. */
      joinChallenge: (challengeId, uid) => {
        if (!uid || !journeyById(challengeId)) return false;
        const mine = get().byUser[uid] || {};
        if (mine[challengeId]) return true;
        set((s) => ({
          byUser: {
            ...s.byUser,
            [uid]: { ...mine, [challengeId]: { startedAt: new Date().toISOString(), distanceKm: 0, completedAt: null } },
          },
        }));
        get()._persist(uid);
        return true;
      },

      /**
       * Called after a run or walk is saved (app/running/active.jsx): adds its distance to
       * every journey the person has joined and not finished. A journey that reaches its
       * length is finished at that moment, once, and paid. Returns { completed: [ids] }.
       */
      creditDistance: (distanceKm, uid) => {
        const km = Number(distanceKm);
        if (!uid || !Number.isFinite(km) || km <= 0) return { completed: [] };
        const mine = get().byUser[uid] || {};
        const next = { ...mine };
        const completed = [];
        let credited = false;
        for (const [id, record] of Object.entries(mine)) {
          const journey = journeyById(id);
          if (journey && !record.completedAt) {
            const distance = Math.min(journey.distanceKm, (Number(record.distanceKm) || 0) + km);
            const done = distance >= journey.distanceKm;
            next[id] = { ...record, distanceKm: distance, completedAt: done ? new Date().toISOString() : null };
            credited = true;
            if (done) completed.push(id);
          }
        }
        if (!credited) return { completed };
        set((s) => ({ byUser: { ...s.byUser, [uid]: next } }));
        completed.forEach((id) => rewardJourney(journeyById(id), uid));
        get()._persist(uid);
        return { completed };
      },

      /**
       * Reads the person's account copy and joins it with the phone's. Done once per person
       * each time the app opens, unless it failed (no signal), when the next call tries again.
       * Resolves true when the account copy has been read.
       */
      loadChallenges: (uid) => {
        if (!uid) return Promise.resolve(false);
        if (get().loadedFor === uid) return Promise.resolve(true);
        if (loading && loading.uid === uid) return loading.promise;
        const read = async () => {
          try {
            const snap = await getDoc(ref(uid));
            const remote = snap.exists() ? (snap.data().activeChallenges || {}) : {};
            const merged = mergeJourneys(get().byUser[uid], remote);
            set((s) => ({ byUser: { ...s.byUser, [uid]: merged }, loadedFor: uid }));
            if (!holds(remote, merged)) await get()._persist(uid);
            return true;
          } catch (e) {
            console.warn('[virtualChallengeStore] loadChallenges error:', e?.message);
            return false;
          }
        };
        const promise = read().finally(() => {
          if (loading && loading.promise === promise) loading = null;
        });
        loading = { uid, promise };
        return promise;
      },

      // Copies the person's journeys to their account. Never before their account copy has
      // been read, or a phone that is behind could write over a copy that is further on.
      _persist: async (uid) => {
        if (!uid) return;
        try {
          if (get().loadedFor !== uid) {
            await get().loadChallenges(uid); // joins and writes what the account lacks
            return;
          }
          await setDoc(ref(uid), {
            activeChallenges: get().byUser[uid] || {},
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[virtualChallengeStore] persist error:', e?.message);
        }
      },
    }),
    {
      name: 'zown-virtual-journeys',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byUser: state.byUser }),
    },
  ),
);

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
//
// A person can leave a journey that is not finished. The record is kept, marked with
// leftAt, so the leaving reaches their other phones: two copies are joined by keeping
// whichever is further along, and without the mark a phone that had not heard of the
// leave would bring the journey back. Joining again starts from nothing.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { JOURNEYS, journeyById, isActiveRecord } from '../lib/virtualJourneys';
import { rewardJourney } from '../services/journeyRewards';

/** The catalogue of routes (kept under its old name for anything that still imports it). */
export const VIRTUAL_CHALLENGES = JOURNEYS;

const ref = (uid) => doc(db, 'users', uid, 'data', 'virtualChallenges');

const earlier = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  return a <= b ? a : b;
};

const later = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
};

// A time (ISO text) that is after `iso` and as near to now as can be.
const after = (iso) => {
  const t = Date.parse(iso);
  const now = Date.now();
  return new Date(now <= t ? t + 1 : now).toISOString(); // (no time in `iso` is NaN, and now <= NaN is false)
};

// Two copies of one journey that are both still being followed: the further along.
const joinRecords = (x, y) => ({
  startedAt: earlier(x.startedAt, y.startedAt),
  distanceKm: Math.max(Number(x.distanceKm) || 0, Number(y.distanceKm) || 0),
  completedAt: earlier(x.completedAt, y.completedAt),
});

function mergeRecords(x, y) {
  // A finished journey cannot be left, so a leave on one copy only means that phone had
  // not heard of the finish.
  if (x.completedAt || y.completedAt) return joinRecords(x, y);
  const left = later(x.leftAt, y.leftAt);
  if (!left) return joinRecords(x, y);
  // What was started before the latest leave belongs to a journey that was left.
  const live = [x, y].filter((record) => record.startedAt > left);
  if (!live.length) return { startedAt: later(x.startedAt, y.startedAt), distanceKm: 0, completedAt: null, leftAt: left };
  return { ...joinRecords(live[0], live[live.length - 1]), leftAt: left };
}

/**
 * Two copies of one person's journeys, joined: every journey from either, and for a
 * journey in both, the copy that is further along (the earliest start and finish), or,
 * if it was left, the leaving.
 */
export function mergeJourneys(a, b) {
  const merged = {};
  for (const id of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = (a || {})[id];
    const y = (b || {})[id];
    merged[id] = !x || !y ? x || y : mergeRecords(x, y);
  }
  return merged;
}

// True when the account copy already holds everything in the merged copy, so there is
// nothing to send it. (The merged copy has every journey either copy has.)
const holds = (remote, merged) => Object.entries(merged).every(([id, m]) => {
  const r = remote[id];
  return !!r && m.distanceKm === r.distanceKm && m.startedAt === r.startedAt
    && (m.completedAt || null) === (r.completedAt || null) && (m.leftAt || null) === (r.leftAt || null);
});

let loading = null; // { uid, promise } while a load is under way

export const useVirtualChallengeStore = create(
  persist(
    (set, get) => ({
      byUser: {}, // { [uid]: { [journeyId]: { startedAt, distanceKm, completedAt } } }
      loadedFor: null, // the person whose account copy has been read this time the app was open

      /**
       * Joins a journey, from nothing; one already joined is left as it is. Returns false for
       * nobody or a route that does not exist.
       */
      joinChallenge: (challengeId, uid) => {
        if (!uid || !journeyById(challengeId)) return false;
        const mine = get().byUser[uid] || {};
        const existing = mine[challengeId];
        if (isActiveRecord(existing)) return true;
        const record = { startedAt: after(existing && existing.leftAt), distanceKm: 0, completedAt: null };
        if (existing) record.leftAt = existing.leftAt; // a record that is not active has been left; kept, so an older copy cannot bring the old journey back
        set((s) => ({ byUser: { ...s.byUser, [uid]: { ...mine, [challengeId]: record } } }));
        get()._persist(uid);
        return true;
      },

      /**
       * Leaves a journey that is not finished, clearing what was covered. A finished journey
       * cannot be left. Returns true when it was left.
       */
      leaveChallenge: (challengeId, uid) => {
        if (!uid) return false;
        const mine = get().byUser[uid] || {};
        const record = mine[challengeId];
        if (!isActiveRecord(record) || record.completedAt) return false;
        const now = new Date().toISOString();
        const left = { startedAt: record.startedAt, distanceKm: 0, completedAt: null, leftAt: now > record.startedAt ? now : record.startedAt };
        set((s) => ({ byUser: { ...s.byUser, [uid]: { ...mine, [challengeId]: left } } }));
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
          if (journey && isActiveRecord(record) && !record.completedAt) {
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

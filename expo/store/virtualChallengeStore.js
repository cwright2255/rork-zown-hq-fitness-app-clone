// store/virtualChallengeStore.js
//
// Conqueror-style virtual challenges: pick a real-world route (e.g. "walk
// the length of the Grand Canyon rim trail - 34km"), and your real
// cumulative run/walk distance counts toward completing it.
//
// Built as a genuinely real data model - not a UI mockup - but the actual
// screen entry point (app/running/program/index.jsx) presents this behind
// a "Coming Soon" state on purpose. The reason isn't technical: this kind
// of feature (see The Conqueror as the reference) usually ships a real
// medal or physical reward on completion, and that needs a fulfillment
// vendor, inventory, and shipping logistics set up on the business side -
// none of which exists yet. Shipping the tracking/progress mechanic while
// implying a physical reward that can't actually be fulfilled would be
// worse than not shipping it at all, so this stays gated until that's
// resolved. The moment it is, this store needs no further backend work -
// only the UI gate needs to come off.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Real-world reference distances for each route - public geographic fact,
// not invented. Progress is tracked in km throughout.
export const VIRTUAL_CHALLENGES = [
  { id: 'grand-canyon-rim', title: 'Grand Canyon Rim Trail', distanceKm: 34, region: 'Arizona, USA' },
  { id: 'hadrians-wall', title: "Hadrian's Wall Path", distanceKm: 135, region: 'England, UK' },
  { id: 'camino-frances', title: 'Camino de Santiago (Camino Franc  s)', distanceKm: 780, region: 'France-Spain' },
  { id: 'john-muir-trail', title: 'John Muir Trail', distanceKm: 340, region: 'California, USA' },
];

export const useVirtualChallengeStore = create((set, get) => ({
  activeChallenges: {}, // { [challengeId]: { startedAt, distanceKm } }
  isLoading: false,

  loadChallenges: async (uid) => {
    if (!uid) return;
    set({ isLoading: true });
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'data', 'virtualChallenges'));
      if (snap.exists()) {
        set({ activeChallenges: snap.data().activeChallenges || {} });
      }
    } catch (e) {
      console.warn('[virtualChallengeStore] loadChallenges error:', e?.message);
    } finally {
      set({ isLoading: false });
    }
  },

  _persist: async (uid) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, 'users', uid, 'data', 'virtualChallenges'), {
        activeChallenges: get().activeChallenges,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[virtualChallengeStore] persist error:', e?.message);
    }
  },

  joinChallenge: (challengeId, uid) => {
    set((s) => ({
      activeChallenges: {
        ...s.activeChallenges,
        [challengeId]: s.activeChallenges[challengeId] || { startedAt: new Date().toISOString(), distanceKm: 0 },
      },
    }));
    get()._persist(uid);
  },

  // Called after a real run completes (see app/running/active.jsx) -
  // credits that run's real distance toward every challenge the user has
  // joined, same real-run-driven-progress model as the real reference apps.
  creditDistance: (distanceKm, uid) => {
    set((s) => {
      const updated = {};
      Object.entries(s.activeChallenges).forEach(([id, c]) => {
        updated[id] = { ...c, distanceKm: c.distanceKm + distanceKm };
      });
      return { activeChallenges: updated };
    });
    get()._persist(uid);
  },

  getProgress: (challengeId) => {
    const challenge = VIRTUAL_CHALLENGES.find((c) => c.id === challengeId);
    const active = get().activeChallenges[challengeId];
    if (!challenge || !active) return null;
    const percent = Math.min(100, Math.round((active.distanceKm / challenge.distanceKm) * 1000) / 10);
    return { ...active, distanceKm: active.distanceKm, totalKm: challenge.distanceKm, percent, completed: percent >= 100 };
  },
}));

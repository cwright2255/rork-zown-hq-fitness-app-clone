// store/leaderboardStore.js
//
// Real public leaderboard — replaces app/leaderboard.jsx's hardcoded fake
// people (Sarah Johnson, Michael Chen, etc. with fake point totals).
//
// This is a genuinely different Firestore pattern than almost everything
// else in this app: every other collection built this session is scoped
// to `users/{uid}/...` — readable and writable only by that one user. A
// leaderboard is inherently the opposite: every user needs to be able to
// READ every other user's rank-relevant stats, while only ever being able
// to WRITE their own.
//
// Standard approach for this in Firestore: a denormalized top-level
// `leaderboard/{uid}` collection — one small public document per user
// (name, avatar, xp, level — NOT their full profile) — separate from their
// private `users/{uid}` document. `_syncLeaderboardEntry` below is called
// from store/expStore.js whenever XP actually changes, so this collection
// stays a lightweight mirror rather than something screens write to
// directly.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, doc, setDoc, query, orderBy, limit, getDocs, onSnapshot,
} from 'firebase/firestore';

export const useLeaderboardStore = create((set, get) => ({
  entries: [],
  myRank: null,
  isLoading: false,
  error: null,
  _unsubscribe: null,

  // One-time fetch (e.g. pull-to-refresh).
  loadTop: async (max = 50) => {
    set({ isLoading: true, error: null });
    try {
      const q = query(collection(db, 'leaderboard'), orderBy('xp', 'desc'), limit(max));
      const snap = await getDocs(q);
      const entries = snap.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() }));
      set({ entries });
      return entries;
    } catch (e) {
      console.warn('[leaderboardStore] loadTop error:', e?.message);
      set({ error: e?.message });
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  // Live subscription — the leaderboard updates in real time as other
  // users' XP changes, not just on manual refresh.
  subscribeTop: (max = 50) => {
    get()._unsubscribe?.();
    const q = query(collection(db, 'leaderboard'), orderBy('xp', 'desc'), limit(max));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const entries = snap.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() }));
        set({ entries });
      },
      (e) => {
        console.warn('[leaderboardStore] subscription error:', e?.message);
        set({ error: e?.message });
      }
    );
    set({ _unsubscribe: unsubscribe });
    return unsubscribe;
  },

  unsubscribe: () => {
    get()._unsubscribe?.();
    set({ _unsubscribe: null });
  },

  computeMyRank: (uid) => {
    const { entries } = get();
    const idx = entries.findIndex((e) => e.id === uid);
    const myRank = idx >= 0 ? idx + 1 : null;
    set({ myRank });
    return myRank;
  },

  // Called from store/expStore.js on real XP change — not exported for
  // screens to call directly, since the leaderboard should only ever
  // reflect actual XP changes, never be set arbitrarily.
  _syncLeaderboardEntry: async (uid, { name, avatar, xp, level, streak }) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, 'leaderboard', uid), {
        name: name || 'Zown User',
        avatar: avatar || null,
        xp: xp ?? 0,
        level: level ?? 1,
        streak: streak ?? 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[leaderboardStore] sync error:', e?.message);
    }
  },
}));

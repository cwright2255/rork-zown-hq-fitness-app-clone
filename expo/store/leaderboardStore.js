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
  collection, doc, setDoc, query, orderBy, limit, getDocs, onSnapshot, where, documentId, deleteField,
} from 'firebase/firestore';
import { chunk, rankEntries } from '../lib/audience';
import { boardField, boardValue, distanceTotals, isDistanceBoard } from '../lib/runLeaderboard';

export const useLeaderboardStore = create((set, get) => ({
  entries: [],
  // Leaderboard entries for just the people in the Following / Close Friends
  // filter (plus you). Fetched by id, so a friend ranked below the global
  // top 50 still shows up.
  audienceEntries: [],
  isLoadingAudience: false,
  myRank: null,
  isLoading: false,
  error: null,
  _unsubscribe: null,
  _board: 'xp',
  _distanceSignature: null,

  // One-time fetch (e.g. pull-to-refresh). `board` is 'xp' (the default),
  // 'week' or 'month' (distance), see lib/runLeaderboard.js.
  loadTop: async (max = 50, board = 'xp') => {
    set({ isLoading: true, error: null });
    try {
      const q = query(collection(db, 'leaderboard'), orderBy(boardField(board), 'desc'), limit(max));
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
  subscribeTop: (max = 50, board = 'xp') => {
    get()._unsubscribe?.();
    // Switching boards: the old board's people are not this board's, so clear
    // them until the new list arrives rather than showing them for a moment.
    if (get()._board !== board) set({ entries: [], _board: board });
    const q = query(collection(db, 'leaderboard'), orderBy(boardField(board), 'desc'), limit(max));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const entries = snap.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() }));
        set({ entries, isLoading: false });
      },
      (e) => {
        console.warn('[leaderboardStore] subscription error:', e?.message);
        set({ error: e?.message, isLoading: false });
      }
    );
    set({ _unsubscribe: unsubscribe, isLoading: get().entries.length === 0 });
    return unsubscribe;
  },

  // One-time fetch of specific people's entries (ids are Firestore `in`
  // queries, 10 at a time). Always includes `myUid` so you can see where you stand.
  loadForUids: async (uids, myUid, board = 'xp') => {
    const ids = Array.from(new Set([...(uids || []), ...(myUid ? [myUid] : [])]));
    if (ids.length === 0) {
      set({ audienceEntries: [] });
      return [];
    }
    set({ isLoadingAudience: true });
    try {
      const groups = await Promise.all(
        chunk(ids, 10).map((group) =>
          getDocs(query(collection(db, 'leaderboard'), where(documentId(), 'in', group)))
        )
      );
      const now = Date.now();
      let found = groups.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      // A distance board only lists people who have logged some this period.
      if (isDistanceBoard(board)) found = found.filter((e) => boardValue(e, board, now) > 0);
      const entries = rankEntries(found, (e) => boardValue(e, board, now));
      set({ audienceEntries: entries });
      return entries;
    } catch (e) {
      console.warn('[leaderboardStore] loadForUids error:', e?.message);
      return [];
    } finally {
      set({ isLoadingAudience: false });
    }
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

  // Publishes this week's and this month's distance (runs and walks recorded
  // in Zown) on the person's public leaderboard document. The whole `distance`
  // map is replaced each time, so last week's number disappears by itself.
  // `visible` false (the "Show me in leaderboards" setting is off) removes it.
  // Skips the write when nothing changed since the last one. Returns true
  // when the document is up to date.
  _syncDistanceEntry: async (uid, { name, avatar, runs, visible = true, now = Date.now() } = {}) => {
    if (!uid) return false;
    const distance = visible ? distanceTotals(runs, now) : null;
    const signature = JSON.stringify([uid, distance, name || '', avatar || '']);
    if (get()._distanceSignature === signature) return true;
    try {
      // Only the fields this writes are touched, and the name and picture only
      // when known, so the XP entry's own copy of them is never blanked.
      // A person who has chosen not to be shown gets only the removal: nothing
      // about them (not even their name) is written for others to see.
      const data = { distance: distance === null ? deleteField() : distance };
      const fields = ['distance'];
      if (distance !== null) {
        data.updatedAt = new Date().toISOString();
        fields.push('updatedAt');
        if (name) { data.name = name; fields.push('name'); }
        if (avatar) { data.avatar = avatar; fields.push('avatar'); }
      }
      await setDoc(doc(db, 'leaderboard', uid), data, { mergeFields: fields });
      set({ _distanceSignature: signature });
      return true;
    } catch (e) {
      console.warn('[leaderboardStore] distance sync error:', e?.message);
      return false;
    }
  },
}));

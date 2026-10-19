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
// (name, avatar, xp, level, streak, distance — NOT their full profile) —
// separate from their private `users/{uid}` document.
//
// The app writes only WHO the person is on their entry (name and picture,
// `_syncProfile` below). XP, level, streak and distance are the server's: the
// XP ledger (functions/src/xpLedger.js) works them out from claims the app files
// and writes them here, and the rules do not let the app write them. So nobody can
// put a score they did not earn on the board, whatever requests they send.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, doc, setDoc, deleteDoc, query, orderBy, limit, getDocs, onSnapshot, where, documentId,
} from 'firebase/firestore';
import { chunk, rankEntries } from '../lib/audience';
import { boardField, boardValue, isDistanceBoard } from '../lib/runLeaderboard';

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
  _profileSignature: null,

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

  // Takes the person's whole entry (name, picture, XP, level, streak and
  // distance) off the boards, for someone who has chosen not to be shown.
  // Nothing about them is left for others to see. Returns true when it is gone
  // (it is also true when there was no entry to remove).
  _removeEntry: async (uid) => {
    if (!uid) return false;
    try {
      await deleteDoc(doc(db, 'leaderboard', uid));
      // The next publish has to write the entry again.
      set({ _profileSignature: null });
      return true;
    } catch (e) {
      console.warn('[leaderboardStore] remove error:', e?.message);
      return false;
    }
  },

  // Puts the person's name and picture on their entry: all the app writes there (see the note at the top). The entry's XP, level,
  // streak and distance are put on it by the server, which also fills them in on an entry made here (functions/src/xpLedger.js).
  // `visible` false (the "Show in Leaderboards" setting is off) takes the whole entry off the boards instead. Only the fields
  // written are touched, and the name and picture only when known, so the other copy of them is never blanked. Skips the write when
  // nothing changed since the last one. Returns true when the entry is as it should be.
  _syncProfile: async (uid, { name, avatar, visible = true } = {}) => {
    if (!uid) return false;
    const shown = visible !== false;
    const signature = JSON.stringify([uid, shown, name || '', avatar || '']);
    if (get()._profileSignature === signature) return true;
    if (!shown) {
      if (!(await get()._removeEntry(uid))) return false;
      set({ _profileSignature: signature });
      return true;
    }
    try {
      const data = { updatedAt: new Date().toISOString() };
      const fields = ['updatedAt'];
      if (name) { data.name = name; fields.push('name'); }
      if (avatar) { data.avatar = avatar; fields.push('avatar'); }
      await setDoc(doc(db, 'leaderboard', uid), data, { mergeFields: fields });
      set({ _profileSignature: signature });
      return true;
    } catch (e) {
      console.warn('[leaderboardStore] profile sync error:', e?.message);
      return false;
    }
  },
}));

// store/duelStore.js
//
// Real 1-on-1 duels. Progress is never written by a client, only ever
// by functions/src/index.js's onWorkoutComplete trigger, which is
// exactly the mechanism that makes real-time cross-user progress
// possible without either participant's device being able to read the
// other's private workout history (see firestore.rules: workouts/{id}
// is owner-only read). What this store does client-side is limited to
// what firestore.rules actually allows a client to do: propose a duel
// (always starts pending), accept or decline one aimed at you, and
// read duels you're actually in.
//
// Running/distance duels are deliberately not supported yet — see the
// module comment in functions/src/index.js's onWorkoutComplete for why
// (runs aren't stored as individually-created documents the way
// workouts are, so there's no equivalent trigger to hook progress off
// of without a bigger, separate change to how store/runningStore.js
// persists runs).

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, doc, addDoc, updateDoc, query, where, onSnapshot,
} from 'firebase/firestore';

// Kept simple and preset-based rather than a free-form parameter form —
// real, immediately usable duel shapes rather than a sprawling settings
// UI. Add more presets here if a real need for one shows up.
export const DUEL_PRESETS = [
  {
    key: 'workout_race_10',
    label: '10 Workout Race',
    description: 'First to complete 10 workouts wins.',
    type: 'workout_count',
    mode: 'first_to_target',
    goalTarget: 10,
    durationDays: null,
  },
  {
    key: 'most_workouts_week',
    label: 'Most Workouts This Week',
    description: 'Whoever logs more workouts by Sunday wins.',
    type: 'workout_count',
    mode: 'most_by_deadline',
    goalTarget: null,
    durationDays: 7,
  },
  {
    key: 'most_calories_week',
    label: 'Most Calories This Week',
    description: 'Whoever burns more real calories by Sunday wins.',
    type: 'calories',
    mode: 'most_by_deadline',
    goalTarget: null,
    durationDays: 7,
  },
];

export const useDuelStore = create((set, get) => ({
  duels: [],
  isLoading: false,
  error: null,
  _unsubscribe: null,

  subscribeDuels: (uid) => {
    if (!uid) return;
    get()._unsubscribe?.();
    const q = query(collection(db, 'duels'), where('participantIds', 'array-contains', uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const duels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ duels, isLoading: false });
      },
      (e) => {
        console.warn('[duelStore] subscribeDuels error:', e?.message);
        set({ error: e?.message, isLoading: false });
      }
    );
    set({ _unsubscribe: unsubscribe, isLoading: true });
  },

  unsubscribeDuels: () => {
    get()._unsubscribe?.();
    set({ _unsubscribe: null });
  },

  proposeDuel: async ({ fromUid, fromName, toUid, toName, preset }) => {
    if (!fromUid || !toUid || fromUid === toUid) return null;
    const endDate = preset.durationDays
      ? new Date(Date.now() + preset.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    try {
      const ref = await addDoc(collection(db, 'duels'), {
        participantIds: [fromUid, toUid].sort(),
        participantNames: { [fromUid]: fromName || 'Zown User', [toUid]: toName || 'Zown User' },
        type: preset.type,
        mode: preset.mode,
        goalTarget: preset.goalTarget,
        label: preset.label,
        endDate,
        progress: { [fromUid]: 0, [toUid]: 0 },
        status: 'pending',
        proposedBy: fromUid,
        createdAt: new Date().toISOString(),
      });
      return ref.id;
    } catch (e) {
      console.warn('[duelStore] proposeDuel error:', e?.message);
      throw e;
    }
  },

  acceptDuel: async (duelId) => {
    try {
      await updateDoc(doc(db, 'duels', duelId), { status: 'active' });
    } catch (e) {
      console.warn('[duelStore] acceptDuel error:', e?.message);
    }
  },

  declineDuel: async (duelId) => {
    try {
      await updateDoc(doc(db, 'duels', duelId), { status: 'declined' });
    } catch (e) {
      console.warn('[duelStore] declineDuel error:', e?.message);
    }
  },

  // Real, live-updating progress from Firestore -- never estimated.
  // most_by_deadline duels have no single server-settled winner (see
  // the module header), so "who's ahead" / "who won" for that mode is
  // computed here, purely for display, by comparing the same real
  // progress numbers the server wrote.
  getDisplayStatus: (duel, myUid) => {
    const opponentId = duel.participantIds.find((id) => id !== myUid);
    const mine = duel.progress?.[myUid] || 0;
    const theirs = duel.progress?.[opponentId] || 0;
    const opponentName = duel.participantNames?.[opponentId] || 'Opponent';

    if (duel.status === 'completed') {
      return { opponentName, mine, theirs, ended: true, won: duel.winnerId === myUid };
    }
    if (duel.mode === 'most_by_deadline' && duel.endDate && new Date(duel.endDate) < new Date()) {
      return { opponentName, mine, theirs, ended: true, won: mine > theirs };
    }
    return { opponentName, mine, theirs, ended: false, won: null };
  },
}));

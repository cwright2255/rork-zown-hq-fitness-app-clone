// store/challengeStore.js
//
// Real AI-generated community challenges, one current challenge per
// cadence (daily/weekly/monthly/seasonal), each tied to a real calendar
// boundary rather than an arbitrary day count. Generation logic lives
// server-side in functions/src/index.js's generateChallenges; this
// store loads what's there, mirrors the SAME period-boundary math
// client-side so it can identify which loaded challenge is the current
// one for each cadence, and auto-fills whatever's missing.
//
// Progress is never stored or faked — it's computed live from the
// user's own completedWorkouts in store/workoutStore.js, same principle
// store/virtualChallengeStore.js already uses for crediting real run
// distance toward a route challenge. Joining a challenge just records
// that this user opted in.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, query, orderBy, limit, getDocs, doc, setDoc, deleteDoc, where, documentId,
} from 'firebase/firestore';
import { chunk, rankEntries, challengeEntryId } from '../lib/audience';

export const CADENCES = ['daily', 'weekly', 'monthly', 'seasonal'];

// Mirrors functions/src/index.js's getDayBounds/getWeekBounds/
// getMonthBounds/getSeasonBounds exactly — must stay in sync with that
// file if the boundary logic ever changes there.
function getDayPeriodKey(now) {
  return `day-${now.toISOString().slice(0, 10)}`;
}

function getWeekPeriodKey(now) {
  const dayNum = (now.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayNum));
  return `week-${monday.toISOString().slice(0, 10)}`;
}

function getMonthPeriodKey(now) {
  return `month-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getSeasonPeriodKey(now) {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  if (month === 11) return `season-winter-${year}`;
  if (month <= 1) return `season-winter-${year - 1}`;
  if (month <= 4) return `season-spring-${year}`;
  if (month <= 7) return `season-summer-${year}`;
  return `season-fall-${year}`;
}

export function getCurrentPeriodKey(cadence, now = new Date()) {
  if (cadence === 'daily') return getDayPeriodKey(now);
  if (cadence === 'weekly') return getWeekPeriodKey(now);
  if (cadence === 'monthly') return getMonthPeriodKey(now);
  if (cadence === 'seasonal') return getSeasonPeriodKey(now);
  return null;
}

export const useChallengeStore = create((set, get) => ({
  challenges: [],
  joinedChallengeIds: new Set(),
  isLoading: false,
  isGenerating: false,
  error: null,
  // Who else is doing each challenge: { [challengeId]: [{ id, uid, name, current, target, percent, completed, rank }] }
  participants: {},
  participantsLoading: {},

  loadChallenges: async (uid) => {
    set({ isLoading: true, error: null });
    try {
      // 40, not 20 — now storing distinct history across 4 cadences
      // rather than one flat batch, so more headroom is needed to
      // reliably still include each cadence's current entry.
      const q = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'), limit(40));
      const snap = await getDocs(q);
      const challenges = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      set({ challenges });

      if (uid) {
        const joinsSnap = await getDocs(collection(db, 'users', uid, 'challengeJoins'));
        set({ joinedChallengeIds: new Set(joinsSnap.docs.map((d) => d.id)) });
      }

      return challenges;
    } catch (e) {
      console.warn('[challengeStore] loadChallenges error:', e?.message);
      set({ error: e?.message || 'Failed to load challenges' });
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  // Returns { daily: challenge|null, weekly: ..., monthly: ..., seasonal: ... }
  // — whichever loaded challenge matches TODAY's real period key for
  // each cadence. A challenge from yesterday's daily or last season
  // simply won't match and won't show, no separate cleanup needed.
  getCurrentByCadence: () => {
    const { challenges } = get();
    const now = new Date();
    const result = {};
    CADENCES.forEach((cadence) => {
      const currentKey = getCurrentPeriodKey(cadence, now);
      result[cadence] = challenges.find((c) => c.cadence === cadence && c.periodKey === currentKey) || null;
    });
    return result;
  },

  // Real Cloud Function call — server-side checks which cadences are
  // missing a current challenge, computes real community stats (workout
  // category/difficulty distribution over the last 30 days, real
  // leaderboard streak/level distribution), and asks GPT-4o to generate
  // only what's needed, grounded in that data plus standard industry
  // guidelines. Not a canned response, and safe to call repeatedly —
  // cadences that already have a current challenge are left alone.
  generateNewChallenges: async (uid) => {
    set({ isGenerating: true, error: null });
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../src/config/firebase');
      const fn = httpsCallable(functions, 'generateChallenges');
      await fn({});
      await get().loadChallenges(uid);
    } catch (e) {
      console.error('[challengeStore] generateNewChallenges failed:', e?.message);
      set({ error: "Couldn't generate new challenges right now. Please try again." });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  joinChallenge: async (challengeId, uid) => {
    if (!uid) return;
    set((s) => ({ joinedChallengeIds: new Set(s.joinedChallengeIds).add(challengeId) }));
    try {
      await setDoc(doc(db, 'users', uid, 'challengeJoins', challengeId), {
        joinedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[challengeStore] joinChallenge error:', e?.message);
    }
  },

  // Everyone joins and tracks a challenge privately, so other people's
  // progress only exists where each person publishes it to the public
  // challengeEntries collection (one small document per person per challenge,
  // see firestore.rules). The filter picks whose entries to read:
  //   everyone  - the 100 most recent entries for that challenge
  //   following / close - exactly those people's entries, looked up by id
  loadParticipants: async (challengeId, uids, myUid) => {
    if (!challengeId) return [];
    set((s) => ({ participantsLoading: { ...s.participantsLoading, [challengeId]: true } }));
    try {
      let docs = [];
      if (uids === null) {
        const snap = await getDocs(
          query(collection(db, 'challengeEntries'), where('challengeId', '==', challengeId), limit(100))
        );
        docs = snap.docs;
      } else {
        const ids = Array.from(new Set([...(uids || []), ...(myUid ? [myUid] : [])])).map((u) => challengeEntryId(challengeId, u));
        const groups = await Promise.all(
          chunk(ids, 10).map((group) =>
            getDocs(query(collection(db, 'challengeEntries'), where(documentId(), 'in', group)))
          )
        );
        docs = groups.flatMap((snap) => snap.docs);
      }
      const list = rankEntries(
        docs.map((d) => ({ id: d.id, ...d.data() })),
        'current'
      );
      set((s) => ({ participants: { ...s.participants, [challengeId]: list } }));
      return list;
    } catch (e) {
      console.warn('[challengeStore] loadParticipants error:', e?.message);
      return [];
    } finally {
      set((s) => ({ participantsLoading: { ...s.participantsLoading, [challengeId]: false } }));
    }
  },

  // Publishes YOUR progress (computed from your own workouts) so people who
  // follow you, or everyone, can see it on the challenge board.
  publishMyProgress: async ({ challenge, progress, user }) => {
    if (!challenge?.id || !progress || !user?.uid) return;
    try {
      await setDoc(doc(db, 'challengeEntries', challengeEntryId(challenge.id, user.uid)), {
        challengeId: challenge.id,
        uid: user.uid,
        name: user.name || 'Zown User',
        avatar: typeof user.profileImage === 'string' && user.profileImage.startsWith('http') ? user.profileImage : null,
        current: progress.current,
        target: progress.target,
        percent: progress.percent,
        completed: !!progress.completed,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[challengeStore] publishMyProgress error:', e?.message);
    }
  },

  leaveChallenge: async (challengeId, uid) => {
    if (!uid) return;
    // Take your progress off the public board too.
    deleteDoc(doc(db, 'challengeEntries', challengeEntryId(challengeId, uid))).catch(() => {});
    set((s) => {
      const next = new Set(s.joinedChallengeIds);
      next.delete(challengeId);
      return { joinedChallengeIds: next };
    });
    try {
      await deleteDoc(doc(db, 'users', uid, 'challengeJoins', challengeId));
    } catch (e) {
      console.warn('[challengeStore] leaveChallenge error:', e?.message);
    }
  },

  // Real progress from the user's actual completed workouts within the
  // challenge's real calendar window — never a separately stored or
  // invented number. goalType is either 'workout_count' (how many
  // completed workouts fall in the window) or 'streak_days' (how many
  // distinct calendar days had at least one). total_minutes was
  // deliberately left out of the generated goal types: workout.duration
  // is stored in seconds for real completed sessions (see
  // app/workout/active.jsx) but in minutes for saved templates (see
  // app/workout/quick.jsx) — a real, pre-existing inconsistency
  // elsewhere in this app that a minutes-based challenge goal would
  // silently inherit. Not fixing that here; it's a separate issue.
  getProgress: (challenge, completedWorkouts) => {
    if (!challenge) return null;
    const startMs = challenge.startDate ? new Date(challenge.startDate).getTime() : 0;
    const endMs = challenge.endDate ? new Date(challenge.endDate).getTime() : Date.now();

    const relevant = (completedWorkouts || []).filter((w) => {
      const t = new Date(w.completedAt || w.date || w.timestamp).getTime();
      return Number.isFinite(t) && t >= startMs && t <= endMs;
    });

    let current;
    if (challenge.goalType === 'streak_days') {
      const days = new Set(
        relevant
          .map((w) => (w.completedAt || w.date || w.timestamp || '').slice(0, 10))
          .filter(Boolean)
      );
      current = days.size;
    } else {
      current = relevant.length;
    }

    const target = challenge.goalTarget || 1;
    const percent = Math.min(100, Math.round((current / target) * 100));
    return { current, target, percent, completed: percent >= 100 };
  },
}));

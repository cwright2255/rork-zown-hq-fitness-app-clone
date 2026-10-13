// store/virtualRaceStore.js
//
// Virtual races (lib/virtualRaces.js): which races you have joined, your finish
// in each (kept on the phone, so it is never lost and is only paid for once), and
// the boards of other people's times.
//
// Each finish is one small public document, raceEntries/{raceId}_{uid}, like
// challengeEntries: the name and picture shown on the leaderboards, the time, and
// for the local race only the coarse map square the run started in (never a
// position). Anyone signed in can read the boards; you can only write your own
// result, and only to make it faster (see firestore.rules).
//
// Whether a result may be posted at all ("Show in Leaderboards") is decided in
// services/raceBoard.js, which is what screens call.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, orderBy, limit,
} from 'firebase/firestore';
import { chunk } from '../lib/audience';
import { areasNear, buildRaceEntry, raceEntryId, rankByTime } from '../lib/virtualRaces';

/** Rows on a board. */
export const BOARD_SIZE = 50;
// How many results one query reads. The local board asks once per group of ten squares.
const LOCAL_READ = 200;
const WORLD_FALLBACK_READ = 200;
/** Races kept on the phone, newest first; older ones are dropped. */
export const KEEP_RACES = 12;

/** The newest `keep` items of a { id: item } map, newest by `item[field]` (an ISO time). */
export function keepRecent(record, field, keep = KEEP_RACES) {
  const newest = Object.entries(record || {})
    .sort((a, b) => String(b[1][field] || '').localeCompare(String(a[1][field] || '')) || (a[0] < b[0] ? 1 : -1))
    .slice(0, keep);
  return Object.fromEntries(newest);
}

const entryRef = (raceId, uid) => doc(db, 'raceEntries', raceEntryId(raceId, uid));

const fresh = {
  joined: {}, // { [raceId_uid]: { raceId, joinedAt } }
  finished: {}, // { [raceId_uid]: { raceId, kind, distanceKm, timeSec, finishedAt, areaId, posted } }
  boards: {}, // { local|world: { raceId, status: 'loading' | 'done' | 'error', entries } }
};

export const useVirtualRaceStore = create(
  persist(
    (set, get) => ({
      ...fresh,

      /** Puts you in the race (only a record on this phone; nothing is posted until you finish). */
      join: (race, uid) => {
        if (!race || !uid) return false;
        const key = raceEntryId(race.id, uid);
        set((s) => ({
          joined: keepRecent({ ...s.joined, [key]: { raceId: race.id, joinedAt: new Date().toISOString() } }, 'joinedAt'),
        }));
        return true;
      },

      leave: (race, uid) => {
        if (!race || !uid) return false;
        const key = raceEntryId(race.id, uid);
        set((s) => {
          const joined = { ...s.joined };
          delete joined[key];
          return { joined };
        });
        return true;
      },

      /**
       * Keeps your finish. Only your first finish and a faster one change anything; a
       * slower run leaves your best as it was. Returns
       * { first, improved, record } where `record` is your best now (null with no race or person).
       */
      recordFinish: (race, uid, { timeSec, finishedAt, areaId = null } = {}) => {
        if (!race || !uid) return { first: false, improved: false, record: null };
        const key = raceEntryId(race.id, uid);
        const existing = get().finished[key];
        const first = !existing;
        const improved = !!existing && timeSec < existing.timeSec;
        if (!first && !improved) return { first, improved, record: existing };
        const record = {
          raceId: race.id, kind: race.kind, distanceKm: race.distanceKm, timeSec, finishedAt, areaId, posted: false,
        };
        set((s) => ({ finished: keepRecent({ ...s.finished, [key]: record }, 'finishedAt') }));
        return { first, improved, record };
      },

      /**
       * Puts a kept finish on the board unless a faster time of yours is already there.
       * Returns 'posted', 'noArea' (a local result needs its map square), 'failed' (try
       * again later) or 'none' (nothing kept under that key).
       */
      publish: async (key, user) => {
        const record = get().finished[key];
        if (!record || !user || !user.uid) return 'none';
        if (record.kind === 'local' && !record.areaId) return 'noArea';
        try {
          const ref = entryRef(record.raceId, user.uid);
          const there = await getDoc(ref);
          const fasterThere = there.exists() && there.data().timeSec <= record.timeSec;
          if (!fasterThere) {
            await setDoc(ref, buildRaceEntry({
              race: { id: record.raceId, kind: record.kind, distanceKm: record.distanceKm },
              user,
              timeSec: record.timeSec,
              finishedAt: record.finishedAt,
              areaId: record.areaId,
            }));
          }
          set((s) => (s.finished[key] ? { finished: { ...s.finished, [key]: { ...s.finished[key], posted: true } } } : {}));
          return 'posted';
        } catch (e) {
          console.warn('[virtualRaceStore] publish error:', e?.message);
          return 'failed';
        }
      },

      /** Keys of kept finishes that have not been posted. */
      unposted: (uid) => Object.entries(get().finished)
        .filter(([key, record]) => key === raceEntryId(record.raceId, uid) && !record.posted)
        .map(([key]) => key),

      /**
       * Takes all your results off the boards (for someone who hides themselves from the
       * leaderboards). They stay on the phone and go back up if you show yourself again.
       * Returns true when they are all gone.
       */
      withdraw: async (uid) => {
        if (!uid) return false;
        const mine = Object.entries(get().finished).filter(([key, record]) => key === raceEntryId(record.raceId, uid));
        let ok = true;
        for (const [key, record] of mine) {
          try {
            await deleteDoc(entryRef(record.raceId, uid));
            set((s) => (s.finished[key] ? { finished: { ...s.finished, [key]: { ...s.finished[key], posted: false } } } : {}));
          } catch (e) {
            console.warn('[virtualRaceStore] withdraw error:', e?.message);
            ok = false;
          }
        }
        return ok;
      },

      /**
       * Loads a race's board into `boards[race.kind]`.
       *   worldwide  the fastest times, from the whole race
       *   local      the times from the map squares around `position` (see areasNear); with no
       *              position the status is 'needsLocation'
       * Returns the entries (fastest first), or [] when it could not be loaded.
       */
      loadBoard: async (race, { position = null } = {}) => {
        if (!race) return [];
        const setBoard = (board) => set((s) => ({ boards: { ...s.boards, [race.kind]: { raceId: race.id, ...board } } }));
        const areas = race.kind === 'local' ? areasNear(position) : [];
        if (race.kind === 'local' && areas.length === 0) {
          setBoard({ status: 'needsLocation', entries: [] });
          return [];
        }
        const kept = get().boards[race.kind];
        setBoard({ status: 'loading', entries: kept && kept.raceId === race.id ? kept.entries : [] });
        try {
          const docs = race.kind === 'world' ? await readWorld(race.id) : await readLocal(race.id, areas);
          const entries = rankByTime(docs.map((d) => ({ id: d.id, ...d.data() }))).slice(0, BOARD_SIZE);
          setBoard({ status: 'done', entries });
          return entries;
        } catch (e) {
          console.warn('[virtualRaceStore] loadBoard error:', e?.message);
          setBoard({ status: 'error', entries: [] });
          return [];
        }
      },
    }),
    {
      name: 'zown-virtual-races',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ joined: state.joined, finished: state.finished }),
    },
  ),
);

async function readWorld(raceId) {
  const entries = collection(db, 'raceEntries');
  try {
    return (await getDocs(query(entries, where('raceId', '==', raceId), orderBy('timeSec', 'asc'), limit(BOARD_SIZE)))).docs;
  } catch (e) {
    // The index that orders by time may not be deployed yet: read some and sort them here.
    console.warn('[virtualRaceStore] ordered read failed, reading unordered:', e?.message);
    return (await getDocs(query(entries, where('raceId', '==', raceId), limit(WORLD_FALLBACK_READ)))).docs;
  }
}

async function readLocal(raceId, areas) {
  const entries = collection(db, 'raceEntries');
  const groups = await Promise.all(
    chunk(areas, 10).map((group) => getDocs(query(entries, where('raceId', '==', raceId), where('areaId', 'in', group), limit(LOCAL_READ)))),
  );
  const seen = new Set();
  return groups.flatMap((snap) => snap.docs).filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
}

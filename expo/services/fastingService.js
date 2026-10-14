import { db } from '../src/config/firebase';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { finishFast, normalizeFast } from '../lib/fastingStats';

// The fast that is running now: one document (start time, target hours, the
// plan it came from) under users/{uid}/data, the same "single document" pattern
// store/homeWidgetsStore.js uses. That path is already covered by the
// users/{userId}/data/{docId} Firestore rule. Ending a fast deletes it.
//
// Every finished fast is kept in users/{uid}/fastingHistory (see firestore.rules),
// one document each, named by the fast's start time in milliseconds so saving
// the same fast twice writes the same document instead of a second one.
const HISTORY = 'fastingHistory';
const HISTORY_LIMIT = 500; // more than a year of daily fasts

const activeRef = (uid) => doc(db, 'users', uid, 'data', 'fasting');

export async function getActiveFast(uid) {
  if (!uid) return null;
  const snap = await getDoc(activeRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data?.startedAt) return null;
  return {
    startedAt: data.startedAt.toDate ? data.startedAt.toDate() : new Date(data.startedAt),
    targetHours: data.targetHours || 16,
    plan: typeof data.plan === 'string' ? data.plan : null,
  };
}

/** Starts a fast now (or at `startedAt`) and returns it as saved. */
export async function startFast(uid, targetHours = 16, { plan = null, startedAt = new Date() } = {}) {
  if (!uid) return null;
  await setDoc(activeRef(uid), { startedAt, targetHours, plan });
  return { startedAt, targetHours, plan };
}

/** Changes when the running fast started (the person forgot to tap Start). */
export async function updateFastStart(uid, startedAt) {
  if (!uid) return;
  await updateDoc(activeRef(uid), { startedAt });
}

/**
 * Ends the running fast `active` ({ startedAt, targetHours, plan }): keeps it in the
 * history, then removes the running one. A fast under ten minutes is a start tapped
 * by mistake and is not kept. If keeping it fails the fast still ends, so the
 * person is never stuck on a timer they can not stop; `saved` says what happened.
 * Returns { entry, saved } where entry is the finished fast, or null with no uid.
 */
export async function endFast(uid, active, endedAt = new Date()) {
  if (!uid) return null;
  const entry = finishFast(active, endedAt);
  let saved = false;
  if (entry && entry.saveable) {
    try {
      await setDoc(doc(db, 'users', uid, HISTORY, entry.id), {
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        targetHours: entry.targetHours,
        plan: entry.plan,
        hours: entry.hours,
        completed: entry.completed,
      });
      saved = true;
    } catch (e) {
      console.warn('[fastingService] could not save the finished fast:', e?.message);
    }
  }
  await deleteDoc(activeRef(uid));
  return { entry, saved };
}

/** The finished fasts, newest first. `max` asks for fewer than the usual 500 (the Coach only needs the last week). */
export async function getFastHistory(uid, max = HISTORY_LIMIT) {
  if (!uid) return [];
  const count = Number.isInteger(max) && max > 0 ? Math.min(max, HISTORY_LIMIT) : HISTORY_LIMIT;
  const snap = await getDocs(query(
    collection(db, 'users', uid, HISTORY),
    orderBy('endedAt', 'desc'),
    limit(count),
  ));
  return snap.docs.map((d) => normalizeFast({ id: d.id, ...d.data() })).filter(Boolean);
}

/** Removes one finished fast from the history. */
export async function deleteFast(uid, id) {
  if (!uid || !id) return;
  await deleteDoc(doc(db, 'users', uid, HISTORY, String(id)));
}

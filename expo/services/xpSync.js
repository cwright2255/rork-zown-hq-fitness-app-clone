// services/xpSync.js
//
// Follows the person's XP on the server. XP is worked out there (functions/src/xpLedger.js): the app files a claim for what it
// earned and the server keeps the total in a ledger at users/{uid}/stats/xp, which the rules let only the server write. This listens
// to that ledger and hands every change to store/expStore.js, which shows it (with the claims still on their way added) and stops
// waiting for the claims the server has dealt with. Started when the person signs in (app/_layout.jsx), stopped when they sign out.
// It never throws; a listener that fails to start leaves the XP on screen as it was, and starts again the next time the app opens.
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { useExpStore } from '../store/expStore';
import { getActivityDayKeys } from './streakService';

let stopListening = null;

/** Stops following the ledger (a second call, or a call with nothing started, does nothing). */
export function stopXpSync() {
  if (stopListening) {
    try { stopListening(); } catch (e) { console.warn('[xpSync] stop failed:', e?.message); }
    stopListening = null;
  }
  useExpStore.getState().endXpSync();
}

/**
 * Starts following this person's ledger, in place of any earlier one.
 * The workout, run and hike records should be loaded first: the days they fall on carry the streak over when the XP the phone had
 * before the server kept the record is brought in, once.
 */
export function startXpSync(uid) {
  if (!uid) return;
  stopXpSync();
  let activeDays = [];
  try { activeDays = getActivityDayKeys(); } catch (e) { console.warn('[xpSync] could not read the active days:', e?.message); }
  useExpStore.getState().beginXpSync(uid, { activeDays });
  try {
    stopListening = onSnapshot(
      doc(db, 'users', uid, 'stats', 'xp'),
      (snap) => useExpStore.getState().applyLedger(uid, snap.exists() ? snap.data() : null),
      (e) => console.warn('[xpSync] ledger listener error:', e?.message)
    );
  } catch (e) {
    console.warn('[xpSync] could not start:', e?.message);
  }
}

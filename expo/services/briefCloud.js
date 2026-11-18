// services/briefCloud.js
//
// The Today brief (lib/todayBrief.js) kept in the person's own account as well as on the phone: users/{uid}/data/todayBrief, one document
// that holds the brief for the day it was written. The rules let only that person read and write it, and it is erased with the rest of the
// account. The phone's own copy is removed when the person logs out (lib/logOut.js) and when the app finds at launch that Firebase has
// nobody signed in; this copy is what brings the same brief back afterwards, so a day has one brief and not one for each sign-in.
//
// Both calls throw when the account cannot be reached; services/briefService.js treats that as "nothing to go on" and never shows it.
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { BRIEF_DOC, briefFromAccount } from '../lib/todayBrief';

const briefRef = (uid) => doc(db, 'users', uid, 'data', BRIEF_DOC);

/** The text of the brief filed in the account for `day`, or null when there is none. Throws when the account cannot be read. */
export async function readCloudBrief(uid, day) {
  const snap = await getDoc(briefRef(uid));
  return briefFromAccount(snap.exists() ? snap.data() : null, day);
}

/**
 * Files `text` as the account's brief for `day` unless one is already filed for that day (another phone, or an earlier try from this one),
 * and resolves to the text that stands. One step, so two phones writing at the same moment end up with the same brief.
 */
export async function fileCloudBrief(uid, day, text) {
  const ref = briefRef(uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const there = briefFromAccount(snap.exists() ? snap.data() : null, day);
    if (there) return there;
    tx.set(ref, { day, text, at: Date.now() });
    return text;
  });
}

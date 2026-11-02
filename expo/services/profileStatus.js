// services/profileStatus.js
//
// Whether a person has finished onboarding, judged from their saved profile (users/{uid} in Firestore) rather than from a flag on the
// phone. Two places use it: the login screen (app/auth/login.jsx) and the launch gate (app/index.jsx). Someone who signed up and quit
// part way through has a profile that was never completed, so they go back to onboarding; someone who finished goes home.
//
// What counts as finished:
//   - onboardedAt: a time the app writes when Finish is pressed (store/userStore.js, saveProfile). Every account that finishes
//     onboarding from this version on has it, even one that left height and weight blank.
//   - or, for an account that finished before onboardedAt existed: an activity level saved in fitnessMetrics, or a saved height and
//     weight. Only the Finish button saved these (the old onboarding also made the numbers up when they were left blank, so they are
//     always there), and an older version saved the activity level but not the top-level height and weight.
//
// If the profile cannot be read (offline, or the read is refused) the answer is null, "not known": the caller decides what to do.
import { db } from '../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const positive = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** @param {object|null|undefined} data  the fields of users/{uid} */
export function isProfileComplete(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.onboardedAt === 'string' && data.onboardedAt.length > 0) return true;
  const level = data.fitnessMetrics && data.fitnessMetrics.activityLevel;
  if (typeof level === 'string' && level.length > 0) return true;
  return positive(data.heightCm) && positive(data.weightKg);
}

/**
 * @param {string} uid
 * @returns {Promise<boolean|null>} true: finished, false: not finished (or no profile yet), null: could not be read
 */
export async function fetchProfileComplete(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap || !snap.exists()) return false;
    return isProfileComplete(snap.data());
  } catch (e) {
    console.warn('[profileStatus] could not read the profile:', e?.message);
    return null;
  }
}

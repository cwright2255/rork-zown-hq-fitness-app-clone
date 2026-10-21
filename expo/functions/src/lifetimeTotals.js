// A person's lifetime workout totals: users/{uid}/stats/totals, written only by a function (the rules let nobody write under stats/).
//
// The app used to count these from the workouts it holds, the newest 240, so Total Workouts stopped rising at 240. The server counts
// from the person's own workout records instead (the `workouts` collection, one document each), so the figures keep counting however
// long the history is. It counts again from the records every time, rather than adding one to a running total: Firebase can deliver
// the same event twice, and a total that ever went wrong puts itself right with the next workout.
//
// What is counted:
//   totalWorkouts     every saved workout record, finished or saved part way (Workout History lists both)
//   finishedWorkouts  the records marked completed (what "Complete 10 workouts" asks for)
//   totalSeconds, totalCalories   the sum over every saved record, the way Workout History adds them up
//   bestCalories      the most calories burned in one finished workout
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.

/** Totals written before this version (a bare running count of finished workouts) are counted again from the records. */
export const TOTALS_VERSION = 2;

const positive = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const twoDecimals = (v) => Math.round(v * 100) / 100;

/** The totals for a list of workout records (each the data of a `workouts` document). */
export function summarizeWorkouts(records) {
  let totalWorkouts = 0;
  let finishedWorkouts = 0;
  let totalSeconds = 0;
  let totalCalories = 0;
  let bestCalories = 0;
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || typeof record !== 'object') return;
    totalWorkouts += 1;
    const calories = positive(record.caloriesBurned);
    totalSeconds += positive(record.duration);
    totalCalories += calories;
    if (record.completed === true) {
      finishedWorkouts += 1;
      if (calories > bestCalories) bestCalories = calories;
    }
  });
  return {
    totalWorkouts,
    finishedWorkouts,
    totalSeconds: twoDecimals(totalSeconds),
    totalCalories: twoDecimals(totalCalories),
    bestCalories: twoDecimals(bestCalories),
  };
}

/** What the app reads: the numbers of a stored totals document, or null when it is missing or from before this version. */
export function currentTotals(stored) {
  if (!stored || typeof stored !== 'object' || !(stored.v >= TOTALS_VERSION)) return null;
  const { totalWorkouts, finishedWorkouts, totalSeconds, totalCalories, bestCalories } = stored;
  return { totalWorkouts, finishedWorkouts, totalSeconds, totalCalories, bestCalories };
}

/**
 * Counts the person's workout records again and stores the result.
 * @param {object} args
 *   db       Firestore (firebase-admin)
 *   uid      whose totals
 *   stamp    the time as text, recorded on the document
 *   extra    more fields to write with the totals (the time of the latest finished workout)
 * @returns {Promise<object>} the totals
 */
export async function refreshTotals({ db, uid, stamp = new Date().toISOString(), extra = {} }) {
  const snap = await db.collection('workouts').where('userId', '==', uid).select('completed', 'duration', 'caloriesBurned').get();
  const totals = summarizeWorkouts(snap.docs.map((d) => d.data()));
  await db.doc(`users/${uid}/stats/totals`).set(
    { ...totals, totalMinutes: Math.round(totals.totalSeconds / 60), v: TOTALS_VERSION, updatedAt: stamp, ...extra },
    { merge: true }
  );
  return totals;
}

/** The stored totals when they are up to date, otherwise counted from the records first. */
export async function ensureTotals({ db, uid, stamp }) {
  const snap = await db.doc(`users/${uid}/stats/totals`).get();
  const stored = snap.exists ? currentTotals(snap.data()) : null;
  return stored || refreshTotals({ db, uid, stamp });
}

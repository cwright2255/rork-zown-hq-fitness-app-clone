// Lifetime workout totals for the screens: how many workouts, how much time and how many calories, over everything the person has
// ever saved, not just the newest 240 the phone holds.
//
// The server counts them (functions/src/lifetimeTotals.js, kept at users/{uid}/stats/totals, which the phone can read and never
// write) and services/progressSync.js hands what it counted to store/lifetimeStore.js. A screen asks for the numbers here: the
// server's count, or the workouts the phone holds if that is more (a workout just finished is on the phone a moment before the
// server has counted it, and a phone that has not heard from the server yet knows only what it holds).

/** The server marks a totals document with this version once it counts from the records. An older document is the old running count. */
export const TOTALS_MIN_VERSION = 2;

const positive = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/** The totals document from the server as the five numbers, or null when it is missing or is the old running count. */
export function serverTotalsFrom(data) {
  if (!data || typeof data !== 'object' || typeof data.v !== 'number' || !(data.v >= TOTALS_MIN_VERSION)) return null;
  return {
    totalWorkouts: positive(data.totalWorkouts),
    finishedWorkouts: positive(data.finishedWorkouts),
    totalSeconds: positive(data.totalSeconds),
    totalCalories: positive(data.totalCalories),
    bestCalories: positive(data.bestCalories),
  };
}

/**
 * What the workouts held on the phone add up to: every saved record counts (the way Workout History lists them), and a record is
 * finished unless it is marked not completed (one saved on the phone before the server has added `completed` to it is finished).
 */
export function heldTotals(records) {
  const list = (Array.isArray(records) ? records : []).filter((w) => w && typeof w === 'object');
  let finishedWorkouts = 0;
  let totalSeconds = 0;
  let totalCalories = 0;
  let bestCalories = 0;
  list.forEach((w) => {
    totalSeconds += positive(w.duration);
    totalCalories += positive(w.caloriesBurned);
    if (w.completed !== false) {
      finishedWorkouts += 1;
      bestCalories = Math.max(bestCalories, positive(w.caloriesBurned));
    }
  });
  return {
    totalWorkouts: list.length,
    finishedWorkouts,
    totalSeconds: round2(totalSeconds),
    totalCalories: round2(totalCalories),
    bestCalories,
  };
}

/**
 * The lifetime totals to show: for each number, the server's or the phone's, whichever is more.
 * @param {{ held?: object[], server?: object|null }} args  held: the workout store's completedWorkouts; server: serverTotalsFrom(...)
 */
export function lifetimeOf({ held, server } = {}) {
  const mine = heldTotals(held);
  const theirs = server && typeof server === 'object' ? server : {};
  const pick = (key) => Math.max(mine[key], positive(theirs[key]));
  return {
    totalWorkouts: pick('totalWorkouts'),
    finishedWorkouts: pick('finishedWorkouts'),
    totalSeconds: pick('totalSeconds'),
    totalCalories: pick('totalCalories'),
    bestCalories: pick('bestCalories'),
  };
}

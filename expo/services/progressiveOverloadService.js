// services/progressiveOverloadService.js
//
// The one-rep-max estimate and the grouping of logged sets into sessions, and the entry point the workout screen calls for "what to lift
// next". The rules themselves - rep ranges by goal, heavy and light days, steps by lift, loads set from the one-rep max, deloads, the
// reps-left rating and the outlier guard - are in lib/loadRules.js, with the numbers in one table at the top of it.
//
// Pure functions only - no Firestore, no store, no UI. The workout screen supplies the logged sets (store/workoutStore.js's
// getExerciseHistory) and the person's goal and level, and persists nothing from here.

import { dayKeyOf } from '../lib/localDate';
import { prescribeNext } from '../lib/loadRules';

// Epley formula - one of the two or three most commonly used 1RM
// estimators in strength training, textbook-standard, not tied to any
// single app or product.
export function estimateOneRepMax(weight, reps) {
  if (!weight || !reps || weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// A "session" for progression purposes is every logged set for one
// exercise that shares the same date (calendar day) - multiple sets in
// the same workout are one data point for advancing the prescription,
// not several.
export function groupSetsBySession(loggedSets) {
  const bySession = new Map();
  for (const set of loggedSets) {
    // The calendar day the person lived it: a session that runs past 8 PM is still one session.
    const day = dayKeyOf(set.date);
    if (!day) continue; // a set with no usable date cannot be placed in a session
    if (!bySession.has(day)) bySession.set(day, []);
    bySession.get(day).push(set);
  }
  return Array.from(bySession.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, sets]) => ({ day, sets }));
}

/**
 * Given every logged set for one exercise, the next session's prescribed weight and reps (and the reason, the kind of day, the rep range
 * and so on - see prescribeNext in lib/loadRules.js for the options and the full result), or null when there is nothing to build on.
 */
export function getNextPrescription(loggedSets, options = {}) {
  return prescribeNext(loggedSets, options);
}

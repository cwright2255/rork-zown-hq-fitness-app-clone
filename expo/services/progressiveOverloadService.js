// services/progressiveOverloadService.js
//
// Real, deterministic progressive overload - the actual gap identified
// against Gravl's approach: estimate a working one-rep max from logged
// sets, then prescribe next session's specific weight and rep target
// from it, using standard double progression (climb reps within a
// range, then step weight up and reset reps) plus an Easy/Hard
// modifier. This is the well-established, generic strength-training
// method Gravl's own marketing describes, not anything proprietary to
// them - same reasoning already used for data/workoutPrograms.js and
// data/runningPrograms.js's own sourcing.
//
// Pure functions only - no Firestore, no store, no UI. Something else
// (the store/active workout screen, wired in as a follow-up) is
// responsible for supplying real logged sets and persisting the
// result; this file only does the math, which is what makes it
// possible to verify directly and thoroughly on its own.

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
    const day = new Date(set.date).toISOString().slice(0, 10);
    if (!bySession.has(day)) bySession.set(day, []);
    bySession.get(day).push(set);
  }
  return Array.from(bySession.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, sets]) => ({ day, sets }));
}

const DEFAULT_REP_RANGE = { min: 8, max: 12 };
const DEFAULT_WEIGHT_INCREMENT = 5; // conservative, generic default; not exercise-specific yet

// Given every logged set for one exercise (across however many past
// sessions), returns the next session's prescribed weight and reps, or
// null if there's no history yet to base one on - the very first
// logged session for a given exercise has nothing to progress from.
// options.readiness ('high' | 'medium' | 'low', from
// wearableService.getCurrentReadiness) is optional - when omitted,
// behaves exactly as before.
export function getNextPrescription(loggedSets, options = {}) {
  const repRange = options.repRange || DEFAULT_REP_RANGE;
  const weightIncrement = options.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT;
  const readiness = options.readiness;

  if (!loggedSets || loggedSets.length === 0) return null;

  const sessions = groupSetsBySession(loggedSets);
  const lastSession = sessions[sessions.length - 1];
  const lastSets = lastSession.sets;

  const lastWeight = lastSets[lastSets.length - 1].weight;
  const repsThisSession = lastSets.map((s) => s.reps);
  const minRepsAchieved = Math.min(...repsThisSession);
  const allSetsHitTop = repsThisSession.every((r) => r >= repRange.max);

  const anyRatedHard = lastSets.some((s) => s.rpe === 'hard');
  const anyRatedEasy = lastSets.some((s) => s.rpe === 'easy');

  const estimatedOneRepMax = estimateOneRepMax(lastWeight, Math.round(
    repsThisSession.reduce((sum, r) => sum + r, 0) / repsThisSession.length
  ));

  // Real, new: low readiness (today's actual wearable recovery data,
  // not last session's rating) holds the prescription steady, same
  // treatment as a hard rating - checked first, ahead of anyRatedHard,
  // since a fresh recovery signal for today is at least as good a
  // reason to hold back as how a past session felt. High/medium
  // readiness don't independently push progression faster; only a low
  // reading intervenes, since automatically prescribing more just
  // because readiness looks good risks encouraging overtraining
  // without the user's own in-the-moment feedback (the Easy rating)
  // actually calling for it.
  if (readiness === 'low') {
    return {
      weight: lastWeight,
      targetReps: Math.max(repRange.min, minRepsAchieved),
      estimatedOneRepMax,
      reason: "Today's recovery data suggests low readiness - holding steady rather than pushing for more.",
    };
  }

  // Hard caps advancement regardless of what the rep range logic would
  // otherwise do - repeat the exact same prescription so the user
  // isn't pushed past what they signaled was already tough.
  if (anyRatedHard) {
    return {
      weight: lastWeight,
      targetReps: Math.max(repRange.min, minRepsAchieved),
      estimatedOneRepMax,
      reason: 'Last session was rated hard - holding steady before advancing again.',
    };
  }

  if (allSetsHitTop) {
    return {
      weight: lastWeight + weightIncrement,
      targetReps: repRange.min,
      estimatedOneRepMax,
      reason: `Hit the top of your rep range every set - stepping weight up to ${lastWeight + weightIncrement}.`,
    };
  }

  if (minRepsAchieved < repRange.min) {
    // Missed the bottom of the range - repeat the same target rather
    // than advancing or regressing, giving another attempt at the same
    // weight/rep combination first.
    return {
      weight: lastWeight,
      targetReps: repRange.min,
      estimatedOneRepMax,
      reason: 'Below target rep range last time - repeating the same weight and target.',
    };
  }

  // Within range but not yet at the top: climb reps. Easy sessions
  // climb by 2 instead of 1, capped at the top of the range either way.
  const step = anyRatedEasy ? 2 : 1;
  const nextTargetReps = Math.min(repRange.max, minRepsAchieved + step);
  return {
    weight: lastWeight,
    targetReps: nextTargetReps,
    estimatedOneRepMax,
    reason: anyRatedEasy
      ? 'Rated easy last time - climbing reps by 2.'
      : 'Climbing reps toward the top of your range before the next weight increase.',
  };
}

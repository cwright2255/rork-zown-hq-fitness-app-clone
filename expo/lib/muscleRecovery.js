// lib/muscleRecovery.js
//
// How recovered each muscle is, from the sets that were done, on a fixed 0 to 100 scale (100 is fully recovered).
//
// This replaces the muscle fatigue map (lib/muscleFatigue.js calculateMuscleFatigue) on the screens. That map split a workout's calories evenly
// over its exercises and muscle tags, scaled every muscle against the busiest one (so one muscle always read 100, even after a light week) and
// cleared everything on one 5-day line. This one counts sets, says how tired a muscle is in absolute terms, and lets the time to recover depend
// on how much was done and which muscle it was. It is a model built from common training guidance, not a measurement: nobody has checked it
// against how sore or ready real people are, and the numbers below are starting points to tune on real logs, which is why they are all in one
// place (RECOVERY_RULES) and every one is tested.
//
// The rules, in order:
//   1. Which muscles an exercise works. The exercise library (data/exerciseLibrary.js) is asked first, by name: its primary muscles count 1 and its
//      secondary muscles count 0.5. An exercise the library does not know falls back to the muscle tags on the workout (the first muscle named
//      counts 1, the others 0.5). An exercise with neither works no muscle. Because the library is asked first, program-day sessions, which carry no
//      muscle tags, now count.
//   2. How many sets, and how hard. Each set logged in the workout counts by the button the person pressed: Hard 1, Moderate 0.6, Easy 0.3. A set
//      with no rating, and the planned sets of an exercise that was finished without logging any, count 0.6 (3 sets when the workout does not say).
//      Workouts saved before sets were recorded with them count their planned sets, scaled by how much of the workout was finished.
//   3. How tired that makes a muscle. The sets a muscle got in the session, each times its muscle count (1 or 0.5), add up to "effective sets".
//      12 effective sets in one session is the most that is counted (100% tired); fewer is that share of it (3 is 25%).
//   4. How long it takes to clear. After a light session (0 to 25% of the ceiling) 48 to 72 hours; after a very hard one (the full 12) 168 hours
//      (7 days); in between it rises evenly. Small muscles (shoulders, arms, calves, traps, core, the inner and outer thigh, neck) take 0.75 of that
//      time and large ones (chest, lats, upper and lower back, quads, hamstrings, glutes) the whole of it.
//   5. How it clears. Straight down to zero over that time. Sessions add (capped at 100% tired), each clearing on its own clock.
//   6. Sleep and heart-rate variability. The same rule the screens already use (lib/muscleFatigue.js getRecoveryModifier): good recovery shortens
//      the time, poor recovery lengthens it.
//   7. Runs and hikes. Every 20 minutes counts as one effective set for the muscles that run or hike works the most (quads for a run, quads and
//      glutes for a hike); the other muscles they work get their share of it (the weights in lib/muscleFatigue.js RUNNING_MUSCLES and
//      HIKING_MUSCLES, scaled so the biggest is 1). A run or hike with no duration counts for nothing.
//
// Pure functions, no stores: the screens pass in the records.
import { findExercise } from './exerciseLibrary';
import { resolveMuscle, isMuscle } from './muscleVocabulary';
import { getRecoveryModifier, RUNNING_MUSCLES, HIKING_MUSCLES } from './muscleFatigue';

const HOUR_MS = 60 * 60 * 1000;

/** Every number the model uses. Change them here; nothing else in the app holds a copy. */
export const RECOVERY_RULES = Object.freeze({
  /** What one set counts by the button pressed (Easy, Moderate or Hard), and for a set with no rating. */
  setEffort: Object.freeze({ hard: 1, moderate: 0.6, easy: 0.3 }),
  unratedSetEffort: 0.6,
  /** What a secondary muscle counts compared with a primary one. */
  secondaryShare: 0.5,
  /** Sets assumed for an exercise that says none. */
  setsWhenNotStated: 3,
  /** The most sets read from one exercise, so a typo cannot fill the whole scale. */
  maxSetsPerExercise: 30,
  /** Effective sets in one session that make a muscle 100% tired. */
  setsForFullFatigue: 12,
  /** Hours to clear after almost nothing, after a light session (lightShare of the ceiling) and after a session at the ceiling. */
  hoursAtLeast: 48,
  hoursAfterLight: 72,
  hoursAtMost: 168,
  lightShare: 0.25,
  /** Small muscles clear in this share of the time large ones do. */
  smallMuscleHours: 0.75,
  /** Minutes of a run or hike that count as one effective set. */
  minutesPerSet: 20,
});

/** The muscles that clear at the full time; every other muscle is "small" and clears faster. */
export const LARGE_MUSCLES = Object.freeze(['chest', 'lats', 'upper_back', 'lower_back', 'quadriceps', 'hamstrings', 'glutes']);

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));

// A date field that is a Firestore timestamp, a Date, a number or a date string, as a number of milliseconds; null for anything else.
// `new Date(null)` is the start of 1970 and `new Date(true)` is a millisecond after it, so those are turned away first.
export const timeOf = (value) => {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const d = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  const t = d instanceof Date ? d.getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

/** The moment a workout finished, read the way Workout History reads it (completedAt, then date, then timestamp), so the two agree. */
export const workoutTime = (w) => (w && typeof w === 'object' ? timeOf(w.completedAt || w.date || w.timestamp) : null);

/**
 * The muscles an exercise works and how much each counts: { muscle: 1 | 0.5 }. The library answers first (by the exercise's name); an
 * exercise it does not know uses the workout's own muscle tags, the first one named counting as the main one. {} when neither names a muscle.
 */
export function exerciseMuscles(exercise) {
  if (!exercise || typeof exercise !== 'object') return {};
  const { secondaryShare } = RECOVERY_RULES;
  const known = typeof exercise.name === 'string' ? findExercise(exercise.name) : null;
  const out = {};
  if (known) {
    known.primary.forEach((m) => { out[m] = 1; });
    known.secondary.forEach((m) => { if (!(m in out)) out[m] = secondaryShare; });
    return out;
  }
  let mainDone = false;
  (Array.isArray(exercise.muscleGroups) ? exercise.muscleGroups : []).forEach((tag) => {
    const muscles = resolveMuscle(tag);
    if (muscles.length === 0) return;
    muscles.forEach((m) => {
      if (!mainDone) out[m] = 1;
      else if (!(m in out)) out[m] = secondaryShare;
    });
    mainDone = true;
  });
  return out;
}

const effortOf = (rpe) => {
  const key = typeof rpe === 'string' ? rpe.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(RECOVERY_RULES.setEffort, key) ? RECOVERY_RULES.setEffort[key] : RECOVERY_RULES.unratedSetEffort;
};

// The effort of each set of one exercise. `legacyShare` is how much of a workout saved before sets were recorded was finished (1 when all).
//   - sets that were logged (exercise.performed) count as logged, whether or not the exercise was finished;
//   - otherwise an exercise marked not done counts nothing, one marked done counts its planned sets, and one with no mark (an older
//     record) counts its planned sets scaled by legacyShare.
function setEfforts(exercise, legacyShare) {
  const { maxSetsPerExercise, setsWhenNotStated, unratedSetEffort } = RECOVERY_RULES;
  const performed = Array.isArray(exercise.performed) ? exercise.performed.filter((p) => p && typeof p === 'object') : [];
  if (performed.length > 0) return performed.slice(0, maxSetsPerExercise).map((p) => effortOf(p.rpe));
  if (exercise.done === false) return [];
  const planned = Number(exercise.sets);
  const sets = Number.isFinite(planned) && planned >= 1 ? Math.min(maxSetsPerExercise, Math.round(planned)) : setsWhenNotStated;
  const share = exercise.done === true ? 1 : legacyShare;
  return Array.from({ length: sets }, () => unratedSetEffort * share);
}

/**
 * The effective sets each muscle got from one workout: { muscle: number }. Muscles the workout did not work are left out.
 */
export function workoutLoads(workout) {
  const loads = {};
  if (!workout || typeof workout !== 'object') return loads;
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const total = Number(workout.totalExercises);
  const finished = Number(workout.exercisesCompleted);
  const partial = workout.partial === true || workout.completed === false;
  const legacyShare = partial && total > 0 && Number.isFinite(finished) ? clamp(finished / total, 0, 1) : 1;

  exercises.forEach((exercise) => {
    if (!exercise || typeof exercise !== 'object') return;
    const muscles = exerciseMuscles(exercise);
    const names = Object.keys(muscles);
    if (names.length === 0) return;
    const sets = setEfforts(exercise, legacyShare).reduce((sum, e) => sum + e, 0);
    if (sets <= 0) return;
    names.forEach((m) => { loads[m] = (loads[m] || 0) + sets * muscles[m]; });
  });
  return loads;
}

// The effective sets a run or hike of `seconds` gives each muscle in `weights` (lib/muscleFatigue.js RUNNING_MUSCLES / HIKING_MUSCLES).
function activityLoads(seconds, weights) {
  const loads = {};
  if (!finite(seconds) || seconds <= 0) return loads;
  const biggest = Math.max(...Object.values(weights));
  const sets = seconds / 60 / RECOVERY_RULES.minutesPerSet;
  Object.entries(weights).forEach(([muscle, weight]) => { loads[muscle] = sets * (weight / biggest); });
  return loads;
}

/** Hours a muscle takes to clear after a session that took it to `share` (0 to 1) of the fatigue ceiling, before the muscle and sleep adjustments. */
export function recoveryHours(share) {
  const { hoursAtLeast, hoursAfterLight, hoursAtMost, lightShare } = RECOVERY_RULES;
  const x = clamp(finite(share) ? share : 0, 0, 1);
  return x <= lightShare
    ? hoursAtLeast + (hoursAfterLight - hoursAtLeast) * (x / lightShare)
    : hoursAfterLight + (hoursAtMost - hoursAfterLight) * ((x - lightShare) / (1 - lightShare));
}

const sizeFactor = (muscle) => (LARGE_MUSCLES.includes(muscle) ? 1 : RECOVERY_RULES.smallMuscleHours);

/**
 * How recovered each muscle is right now: { muscle: 0 to 100 }, whole numbers, for the muscles that are not fully recovered. A muscle that is
 * missing is fully recovered (or was never worked); the answer is {} when nothing is still being carried.
 *
 * @param {object} p
 * @param {object[]} [p.completedWorkouts]  workoutStore.completedWorkouts
 * @param {object[]} [p.runs]
 * @param {object[]} [p.completedHikes]
 * @param {object}   [p.recovery]   { sleepHours, sleepQuality, hrv } as the Health screen passes it (lib/homeWidgetData.js recoveryInputs)
 * @param {Date}     [p.now]
 */
export function calculateMuscleRecovery({ completedWorkouts, runs, completedHikes, recovery, now = new Date() } = {}) {
  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : Date.now();
  // A modifier above 1 (well recovered) shortens every time; below 1 lengthens it. The floor matches the one the old map used.
  const slower = 1 / Math.max(0.3, getRecoveryModifier(recovery || {}));
  const tired = {};

  const add = (loads, atMs) => {
    if (atMs === null) return;
    const hoursAgo = (nowMs - atMs) / HOUR_MS;
    if (hoursAgo < 0) return;
    Object.entries(loads).forEach(([muscle, sets]) => {
      if (!isMuscle(muscle) || !(sets > 0)) return;
      const share = Math.min(1, sets / RECOVERY_RULES.setsForFullFatigue);
      const hours = recoveryHours(share) * sizeFactor(muscle) * slower;
      const left = 1 - hoursAgo / hours;
      if (left > 0) tired[muscle] = (tired[muscle] || 0) + 100 * share * left;
    });
  };

  (Array.isArray(completedWorkouts) ? completedWorkouts : []).forEach((w) => add(workoutLoads(w), workoutTime(w)));
  (Array.isArray(runs) ? runs : []).forEach((r) => {
    if (r && typeof r === 'object') add(activityLoads(Number(r.duration), RUNNING_MUSCLES), timeOf(r.endTime || r.startTime));
  });
  (Array.isArray(completedHikes) ? completedHikes : []).forEach((h) => {
    if (h && typeof h === 'object') add(activityLoads(Number(h.durationSeconds), HIKING_MUSCLES), timeOf(h.completedAt));
  });

  const out = {};
  Object.entries(tired).forEach(([muscle, fatigue]) => {
    const percent = Math.round(100 - Math.min(100, fatigue));
    if (percent < 100) out[muscle] = percent;
  });
  return out;
}

/**
 * calculateMuscleRecovery's answer the other way round, { muscle: 1 to 100 } for how tired each muscle is, which is what the heatmap and the
 * Home card draw (fatigueToColor in lib/muscleFatigue.js colours it).
 */
export function fatigueFromRecovery(recovery) {
  const out = {};
  if (!recovery || typeof recovery !== 'object') return out;
  Object.entries(recovery).forEach(([muscle, percent]) => {
    if (!isMuscle(muscle) || !finite(percent)) return;
    const fatigue = Math.round(100 - clamp(percent, 0, 100));
    if (fatigue > 0) out[muscle] = fatigue;
  });
  return out;
}

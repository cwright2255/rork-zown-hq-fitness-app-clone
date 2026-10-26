// lib/trainingMeasures.js
//
// The figures the training engine's claims can be backed with (the plan's "Claims" section: say what you measured, not adjectives). Plain counters kept
// for one person by store/trainingFeedbackStore.js, a few pure functions that add to them, and the one place that says what each counter and each rate
// means. Nothing here changes what the engine picks; it only counts.
//
// What is counted, and when:
//   - sessionsStarted, exercisesOffered, exercisesSwapped, exercisesExcluded: when Start Workout is pressed on Today's Session. exercisesOffered is
//     the number of exercises in the session as it was started; the other two are how many of its exercises the person swapped for another or
//     excluded on that screen first.
//   - sessionsFinished, sessionsCutShort: when a workout the engine built (a template saved with source "engine_session") ends: finished all the way,
//     or saved part way ("Save and exit"). exercisesSkipped is how many exercises in it were marked done with no sets logged (not a timed hold,
//     which is done without logging a set).
//   - setsWithTarget, setsHitTarget: each time a set is logged on an exercise that had a target from the load rules, and whether the weight and reps
//     logged reached it. This counts every workout, not only the engine's: the target is the load rules' own.
// Not counted here: how many people are still training after four weeks. That needs more than one person: it is read from the workouts that are
// already saved (their dates), not from these counters.
//
// Counters never hold a name, an email or a weight: only whole numbers and the day counting began.
import { findExercise } from './exerciseLibrary';
import { describeLift } from './loadRules';
import { feedbackKey } from './trainingFeedback';

export const MEASURE_FIELDS = Object.freeze([
  'sessionsStarted', 'exercisesOffered', 'exercisesSwapped', 'exercisesExcluded',
  'sessionsFinished', 'sessionsCutShort', 'exercisesSkipped',
  'setsWithTarget', 'setsHitTarget',
]);

/** The most any one counter can hold: far beyond real use, so a damaged copy cannot hold something absurd. */
export const MEASURE_MAX = 1000000;

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(MEASURE_MAX, Math.floor(v)) : 0);
const stampOf = (now) => {
  const ms = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.now();
  return new Date(Number.isFinite(ms) ? ms : Date.now()).toISOString();
};

/** All counters at zero. `since` is the day counting began, filled in by the first thing counted. */
export function emptyMeasures() {
  return { v: 1, since: '', ...Object.fromEntries(MEASURE_FIELDS.map((f) => [f, 0])) };
}

/** Counters that can be trusted from whatever was read: whole non-negative numbers, and a `since` that is text. Never throws. */
export function sanitizeMeasures(raw) {
  const out = emptyMeasures();
  if (!isPlain(raw)) return out;
  MEASURE_FIELDS.forEach((f) => { out[f] = count(raw[f]); });
  out.since = typeof raw.since === 'string' ? raw.since : '';
  return out;
}

function bump(measures, now, changes) {
  const next = sanitizeMeasures(measures);
  if (next.since === '') next.since = stampOf(now);
  Object.entries(changes).forEach(([field, by]) => { next[field] = Math.min(MEASURE_MAX, next[field] + count(by)); });
  return next;
}

/** Counts Start Workout on Today's Session: `exercises` in the session, of which `swapped` were swapped and `excluded` excluded first. */
export function noteStart(measures, { exercises, swapped, excluded } = {}, now) {
  return bump(measures, now, { sessionsStarted: 1, exercisesOffered: exercises, exercisesSwapped: swapped, exercisesExcluded: excluded });
}

/** Counts one logged set that had a target: `hit` is whether it reached it. */
export function noteSet(measures, hit, now) {
  return bump(measures, now, { setsWithTarget: 1, setsHitTarget: hit === true ? 1 : 0 });
}

/** Counts the end of an engine workout: cut short or finished, and how many of its exercises were skipped. */
export function noteEnd(measures, { cutShort, skipped } = {}, now) {
  return bump(measures, now, cutShort === true ? { sessionsCutShort: 1, exercisesSkipped: skipped } : { sessionsFinished: 1, exercisesSkipped: skipped });
}

const ratio = (part, whole) => (whole > 0 ? Math.round((part / whole) * 10000) / 10000 : null);

/**
 * The rates the counters make (0 to 1, four places), each null until it has something to divide by:
 *   setsHit      sets that reached their target / sets that had one
 *   cutShort     engine workouts saved part way / engine workouts that ended
 *   swapped      exercises swapped before starting / exercises in the sessions started
 *   skipped      exercises marked done with no sets logged / exercises in the sessions started
 */
export function measureRates(measures) {
  const m = sanitizeMeasures(measures);
  return {
    setsHit: ratio(m.setsHitTarget, m.setsWithTarget),
    cutShort: ratio(m.sessionsCutShort, m.sessionsCutShort + m.sessionsFinished),
    swapped: ratio(m.exercisesSwapped, m.exercisesOffered),
    skipped: ratio(m.exercisesSkipped, m.exercisesOffered),
  };
}

/**
 * Whether a logged set reached the target the load rules gave: true or false, or null when there was no target to reach (nothing is counted then).
 * `weight` and the prescription's weight are in the same unit (the one on screen); a bodyweight exercise is judged on its reps alone, and a loaded
 * one with no weight in its target is not judged at all.
 */
export function setHitTarget({ weight, reps, prescription, bodyweight } = {}) {
  if (!isPlain(prescription)) return null;
  const targetReps = prescription.targetReps;
  if (typeof targetReps !== 'number' || !Number.isFinite(targetReps) || targetReps <= 0) return null;
  if (typeof reps !== 'number' || !Number.isFinite(reps)) return null;
  if (bodyweight === true) return reps >= targetReps;
  const targetWeight = prescription.weight;
  if (typeof targetWeight !== 'number' || !Number.isFinite(targetWeight) || typeof weight !== 'number' || !Number.isFinite(weight)) return null;
  return reps >= targetReps && weight + 0.005 >= targetWeight;
}

/**
 * The feedback keys of the exercises that were skipped in a workout: those marked done with no set logged, other than a timed hold (a plank is
 * done without logging a set). `exercises` is the list a workout is saved with ({ name, done, performed }); an exercise the library does not know has no key and is not counted.
 */
export function skippedKeys(exercises) {
  const keys = [];
  (Array.isArray(exercises) ? exercises : []).forEach((x) => {
    if (!isPlain(x) || x.done !== true || (Array.isArray(x.performed) && x.performed.length > 0)) return;
    const found = typeof x.name === 'string' ? findExercise(x.name) : null;
    if (!found || describeLift(found.name).timed) return;
    const key = feedbackKey(found);
    if (!keys.includes(key)) keys.push(key);
  });
  return keys;
}

/**
 * What an ended workout tells the engine, or null when it was not one the engine built (only an engine workout's skips and cut-short count).
 * { cutShort, skipped: the keys of the skipped exercises }.
 */
export function sessionOutcome(source, exercises, partial) {
  if (source !== 'engine_session') return null;
  return { cutShort: partial === true, skipped: skippedKeys(exercises) };
}

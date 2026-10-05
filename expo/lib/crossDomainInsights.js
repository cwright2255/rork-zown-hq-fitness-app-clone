// lib/crossDomainInsights.js
//
// Real cross-domain reasoning: connects a genuine lifting plateau (real
// estimated-1RM trend, flat or declining across recent sessions) to real,
// elevated running/hiking volume in the days before those sessions - but
// ONLY when the plateaued lift's own muscleGroups genuinely overlap with
// lib/muscleFatigue.js's RUNNING_MUSCLES/HIKING_MUSCLES weighting, the
// same real exercise-science mapping Recovery Map's fatigue engine
// already uses. No overlap, no claim - this never invents a cause the
// anatomy doesn't support, the same principle services/aiService.js's
// generateTrainingLoadInsight prompt already states for its own,
// different (systemic, AI-narrated) signal. Deliberately deterministic,
// not AI-generated, for the same reason services/progressiveOverloadService.js's
// prescriptions are: "did X happen, and does the data support Y as the
// reason" is a real-or-not computation, not open-ended commentary - an
// LLM here would only add latency and a chance of narrating a cause the
// numbers don't actually show.
//
// Scoped to the three primary barbell lifts for a first real version -
// same scoping services/strengthStandardsService.js already uses for
// "well-understood, consistently-logged, cleanly-named" lifts. Squat and
// Deadlift are also exactly where a real running/hiking connection is
// anatomically plausible in the first place (both genuinely leg-dominant);
// Bench Press has no real muscle overlap with running/hiking, so it will
// correctly never get a cross-domain cause attributed to it, only a
// plain plateau note if one is real.

import { groupSetsBySession, estimateOneRepMax } from '../services/progressiveOverloadService';
import { aggregateDailyLoad } from './trainingLoad';
import { RUNNING_MUSCLES, HIKING_MUSCLES, canonicalizeMuscle } from './muscleFatigue';

// recentWindow + priorWindow sessions needed before saying anything real -
// fewer than that and "flat" vs "still ramping up" genuinely can't be
// told apart yet.
const RECENT_WINDOW = 3;
const PRIOR_WINDOW = 2;
// Recent window's best e1RM must beat the prior window's best by at
// least this fraction to NOT count as a plateau - roughly one real
// weight increment on a moderate load, so normal rounding/plate-size
// noise doesn't get flagged as stalled progress.
const PLATEAU_THRESHOLD = 0.03;
// Pre-session week's cardio load must exceed this multiple of the
// user's own baseline daily cardio load (x7) to count as "elevated" -
// a real, meaningful jump above their normal pattern, not noise.
const CARDIO_ELEVATED_MULTIPLIER = 1.3;
const MIN_CARDIO_DAYS_FOR_BASELINE = 5;

// Real, standard primary muscle groups for the three lifts this module
// covers - the same three services/strengthStandardsService.js already
// treats as canonical, well-understood, consistently-named lifts. Used
// directly here rather than relying on any specific logged workout's own
// muscleGroups tag, since these three lifts' real primary muscles are
// well-established regardless of which workout or AI generation they
// came from (and plenty of real logged history predates app/workout/
// active.jsx even carrying muscleGroups through to begin with).
export const PRIMARY_LIFT_MUSCLES = {
  'Bench Press': ['chest', 'triceps', 'shoulders'],
  'Squat': ['quadriceps', 'glutes', 'hamstrings'],
  'Deadlift': ['hamstrings', 'glutes', 'back'],
};

function bestE1RMForSession(sets) {
  let best = null;
  sets.forEach((s) => {
    const e1rm = estimateOneRepMax(s.weight, s.reps);
    if (e1rm && (best === null || e1rm > best)) best = e1rm;
  });
  return best;
}

/**
 * Real plateau detection from one exercise's real logged-set history:
 * compares the best estimated 1RM across the most recent `recentWindow`
 * sessions against the `priorWindow` sessions right before that. Flat or
 * declining (< plateauThreshold improvement) across that boundary counts
 * as a plateau. Returns null - not a {plateaued:false} object - when
 * there's simply not enough session history yet to say anything real:
 * an honest "don't know" rather than a confident negative.
 */
export function detectPlateau(loggedSets, { recentWindow = RECENT_WINDOW, priorWindow = PRIOR_WINDOW, plateauThreshold = PLATEAU_THRESHOLD } = {}) {
  const sessions = groupSetsBySession(loggedSets || []);
  if (sessions.length < recentWindow + priorWindow) return null;

  const recent = sessions.slice(-recentWindow);
  const prior = sessions.slice(-(recentWindow + priorWindow), -recentWindow);

  const recentBests = recent.map((s) => bestE1RMForSession(s.sets)).filter((v) => v != null);
  const priorBests = prior.map((s) => bestE1RMForSession(s.sets)).filter((v) => v != null);
  if (recentBests.length === 0 || priorBests.length === 0) return null;

  const recentBest = Math.max(...recentBests);
  const priorBest = Math.max(...priorBests);
  const improvement = (recentBest - priorBest) / priorBest;

  return {
    plateaued: improvement < plateauThreshold,
    recentBest: Math.round(recentBest * 10) / 10,
    priorBest: Math.round(priorBest * 10) / 10,
    improvementPercent: Math.round(improvement * 1000) / 10,
    plateauSessionDays: recent.map((s) => s.day),
  };
}

/**
 * Checks whether elevated running/hiking volume in the week before each
 * plateaued session is a real, data-supported explanation - and only
 * when this lift's own muscleGroups genuinely overlap with the muscles
 * running/hiking actually work (lib/muscleFatigue.js's own real
 * weighting). Returns null - honestly, not a weak/empty cause object -
 * whenever the data doesn't actually support a cross-domain claim:  no
 * real muscle overlap, not enough cardio history to know what "elevated"
 * even means for this user, or the cardio load around these sessions
 * wasn't actually elevated.
 */
export function findCrossDomainCause({ muscleGroups, plateauSessionDays, runs = [], completedHikes = [] }) {
  const sharedMuscles = [...new Set((muscleGroups || []).map(canonicalizeMuscle))]
    .filter((m) => m in RUNNING_MUSCLES || m in HIKING_MUSCLES);
  if (sharedMuscles.length === 0 || !plateauSessionDays?.length) return null;

  const cardioDailyLoad = aggregateDailyLoad({ runs, completedHikes });
  const loadValues = Object.values(cardioDailyLoad);
  if (loadValues.length < MIN_CARDIO_DAYS_FOR_BASELINE) return null;

  // This user's own average daily cardio load, across every day they've
  // logged any real running/hiking activity - the baseline "elevated"
  // gets compared against, not an arbitrary fixed number.
  const baseline = loadValues.reduce((a, b) => a + b, 0) / loadValues.length;
  if (baseline <= 0) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  let elevatedCount = 0;
  plateauSessionDays.forEach((day) => {
    const sessionTime = new Date(day).getTime();
    let weekSum = 0;
    for (let i = 1; i <= 7; i++) {
      const key = new Date(sessionTime - i * dayMs).toISOString().split('T')[0];
      weekSum += cardioDailyLoad[key] || 0;
    }
    if (weekSum > baseline * 7 * CARDIO_ELEVATED_MULTIPLIER) elevatedCount++;
  });

  if (elevatedCount <= plateauSessionDays.length / 2) return null; // not a majority - not a real pattern

  return {
    sharedMuscles,
    elevatedSessionCount: elevatedCount,
    totalSessionsChecked: plateauSessionDays.length,
  };
}

/**
 * Top-level, per-lift insight for one of the three primary lifts: a real
 * plateau plus a real, data-supported cross-domain cause when both
 * exist; a plain plateau-only note when the plateau is real but nothing
 * in the data explains it (honest - never forces a cause that isn't
 * there); null when there's simply nothing notable to say (still
 * progressing, or not enough history yet either way).
 */
export function getLiftInsight({ exerciseName, muscleGroups, loggedSets, runs = [], completedHikes = [] }) {
  const plateau = detectPlateau(loggedSets);
  if (!plateau || !plateau.plateaued) return null;

  const cause = findCrossDomainCause({
    muscleGroups,
    plateauSessionDays: plateau.plateauSessionDays,
    runs,
    completedHikes,
  });

  if (cause) {
    return {
      exerciseName,
      hasCause: true,
      sharedMuscles: cause.sharedMuscles,
      message: `Your ${exerciseName} has been flat the last few sessions (est. 1RM ~${Math.round(plateau.recentBest)} lb, barely above ~${Math.round(plateau.priorBest)} lb before that) - likely connected to your running/hiking load, which works your ${cause.sharedMuscles.join('/')} too.`,
    };
  }

  return {
    exerciseName,
    hasCause: false,
    message: `Your ${exerciseName} has been flat the last few sessions (est. 1RM ~${Math.round(plateau.recentBest)} lb, barely above ~${Math.round(plateau.priorBest)} lb before that). Nothing in your running/hiking load explains it - could be worth a deload week.`,
  };
}

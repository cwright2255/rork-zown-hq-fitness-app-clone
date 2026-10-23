// lib/trainingState.js
//
// What the app already knows about how someone is training right now, gathered into one small plain object so the AI plan generator and
// the Coach are told the same things: how many workouts in the last 14 days, which muscles those workouts, runs and hikes worked, which
// muscles are still carrying load from the last 5 days, the best set and estimated one-rep max for each main lift, today's readiness
// and the training load. Every piece comes from a calculation the app already runs for its own screens (muscleFatigue, readiness,
// trainingLoad, summarizeLiftPRs) or a plain count of the same records; nothing else is worked out here.
//
// Honest about what the numbers are:
//   - Muscle load is relative. calculateMuscleFatigue scales every muscle to the busiest one, so 100 means "the most worked muscle in the
//     last 5 days", not "worked to the limit", and it is described that way. It fades over 5 days, which is why it cannot cover 14.
//   - Muscles worked is a count of how many workouts, runs or hikes in the last 14 days worked each muscle. It says how often, not how hard.
//   - A piece that is missing is left out, never filled with a zero. An empty list of workouts is what a person who never trains has and
//     also what a phone that has not finished loading has, so "0 workouts" and "no muscles worked" are only said when there is some
//     history to count from.
//   - Weights are in whatever unit the person logs. This file never converts and never adds a unit.
//   - Injuries are not matched to muscles here: the app's injury list is joints (knee, shoulder, lower back) and its muscle names are free
//     text, so a match would be a guess. The state only says whether any injury was reported, so the Coach and the plan are told that the
//     reported injuries come before any of these figures.
//
// Pure functions: the stores are read by services/trainingStateService.js, which passes the values in.
import { topMuscles, muscleLabel } from './homeWidgetData';
import { RUNNING_MUSCLES, HIKING_MUSCLES, canonicalizeMuscle } from './muscleFatigue';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bumped if the shape changes, so the server can ignore a shape it does not know. */
export const TRAINING_STATE_VERSION = 2;
export const MAX_MUSCLES = 8;
export const MAX_LIFTS = 6;
/** The days the workout count and the muscles worked look back over. */
export const RECENT_DAYS = 14;
/** The days muscle load looks back over (lib/muscleFatigue.js fades it out over this window). */
export const MUSCLE_WINDOW_DAYS = 5;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => (finite(v) && v > 0 ? v : null);
const whole = (v) => Math.round(v);

// A date field that is a Firestore timestamp, a Date, a number or a date string, as a number of milliseconds; null for anything else.
// `new Date(null)` is the start of 1970 and `new Date(true)` is a millisecond after it, so those are turned away first.
const timeOf = (value) => {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const d = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  const t = d instanceof Date ? d.getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

// The moment a workout finished, read the way Workout History reads it (completedAt, then date, then timestamp), so the two agree.
const workoutTime = (w) => (w && typeof w === 'object' ? timeOf(w.completedAt || w.date || w.timestamp) : null);

const inWindow = (t, now, days) => t !== null && t >= now.getTime() - days * DAY_MS && t <= now.getTime();

/** How many of `workouts` fall in the `days` days up to `now`. A record whose date is not a date is not counted. */
export function countWorkoutsSince(workouts, now = new Date(), days = RECENT_DAYS) {
  return (Array.isArray(workouts) ? workouts : []).filter((w) => inWindow(workoutTime(w), now, days)).length;
}

/**
 * Which muscles the last `days` days of workouts, runs and hikes worked, and in how many of them: [{ muscle, sessions }], the most
 * often first, equal ones in alphabetical order. A muscle counts once for a workout however many of its exercises used it. Runs and
 * hikes count for the muscles lib/muscleFatigue.js gives them. Names are the app's own (a muscle called "quads" in one workout and
 * "quadriceps" in another is one muscle, by the same synonyms the muscle map uses).
 */
export function musclesWorkedSince({ workouts, runs, hikes, now = new Date(), days = RECENT_DAYS } = {}) {
  const sessions = new Map();
  const add = (names) => {
    new Set(names).forEach((name) => { if (name) sessions.set(name, (sessions.get(name) || 0) + 1); });
  };

  (Array.isArray(workouts) ? workouts : []).forEach((w) => {
    if (!inWindow(workoutTime(w), now, days)) return;
    const exercises = Array.isArray(w.exercises) ? w.exercises : [];
    add(exercises.flatMap((ex) => (ex && Array.isArray(ex.muscleGroups) ? ex.muscleGroups : []))
      .filter((m) => typeof m === 'string')
      .map(canonicalizeMuscle));
  });
  (Array.isArray(runs) ? runs : []).forEach((r) => {
    if (r && inWindow(timeOf(r.endTime || r.startTime), now, days)) add(Object.keys(RUNNING_MUSCLES));
  });
  (Array.isArray(hikes) ? hikes : []).forEach((h) => {
    if (h && inWindow(timeOf(h.completedAt), now, days)) add(Object.keys(HIKING_MUSCLES));
  });

  return [...sessions.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([muscle, count]) => ({ muscle, sessions: count }));
}

const liftFrom = (p) => {
  if (!p || typeof p !== 'object') return null;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const e1rm = positive(p.bestE1RM);
  const bestWeight = positive(p.bestWeight);
  const bestReps = positive(p.bestReps);
  if (!name || !e1rm || !bestWeight || !bestReps) return null;
  return {
    name,
    e1rm: whole(e1rm),
    bestWeight,
    bestReps: whole(bestReps),
    lastSessionDate: typeof p.lastSessionDate === 'string' ? p.lastSessionDate : null,
    sessions: positive(p.sessionCount) ? whole(p.sessionCount) : null,
  };
};

/**
 * The training state, from the answers the app already computes.
 *
 * @param {object} p
 * @param {Date} [p.now]
 * @param {object[]} [p.workouts]    completed workouts (workoutStore.completedWorkouts)
 * @param {object[]} [p.runs]
 * @param {object[]} [p.hikes]
 * @param {Record<string, number>} [p.fatigue]   calculateMuscleFatigue's answer, { muscle: 0 to 100 }
 * @param {object[]} [p.liftPRs]     summarizeLiftPRs' answer
 * @param {object} [p.readiness]     computeReadiness' answer
 * @param {object} [p.trainingLoad]  calculateTrainingLoad's answer
 * @param {string[]} [p.injuries]    the injuries the person reported (only whether there are any is kept)
 * @returns {{
 *   v: number,
 *   recentWorkouts: number | null,             workouts in the last 14 days; null when there are no workouts to count from
 *   musclesWorked: { muscle: string, sessions: number }[] | null,   how many workouts, runs or hikes in the last 14 days worked each muscle,
 *                                              most often first; [] when none did, null when there is no history at all
 *   muscleLoad: { muscle: string, load: number }[] | null,   load still carried from the last 5 days, most first; same empty and null rules
 *   lifts: { name: string, e1rm: number, bestWeight: number, bestReps: number, lastSessionDate: string | null, sessions: number | null }[],
 *   readiness: { score: number, label: string | null } | null,
 *   trainingLoad: { zone: string, ratio: number } | null,
 *   hasInjuries: boolean,
 * }}
 */
export function buildTrainingState({
  now = new Date(), workouts, runs, hikes, fatigue, liftPRs, readiness, trainingLoad, injuries,
} = {}) {
  const workoutList = Array.isArray(workouts) ? workouts : [];
  const hasHistory = workoutList.length > 0
    || (Array.isArray(runs) && runs.length > 0)
    || (Array.isArray(hikes) && hikes.length > 0);

  const lifts = (Array.isArray(liftPRs) ? liftPRs : []).map(liftFrom).filter(Boolean).slice(0, MAX_LIFTS);

  return {
    v: TRAINING_STATE_VERSION,
    recentWorkouts: workoutList.length > 0 ? countWorkoutsSince(workoutList, now, RECENT_DAYS) : null,
    musclesWorked: hasHistory
      ? musclesWorkedSince({ workouts: workoutList, runs, hikes, now, days: RECENT_DAYS }).slice(0, MAX_MUSCLES)
      : null,
    muscleLoad: hasHistory
      ? topMuscles(fatigue, MAX_MUSCLES).map(({ muscle, intensity }) => ({ muscle, load: Math.min(100, Math.max(1, whole(intensity))) }))
      : null,
    lifts,
    readiness: readiness && readiness.ready === true && finite(readiness.score)
      ? { score: Math.min(100, Math.max(0, whole(readiness.score))), label: typeof readiness.label === 'string' ? readiness.label : null }
      : null,
    trainingLoad: trainingLoad && typeof trainingLoad.zone === 'string' && trainingLoad.zone !== 'insufficient_data' && finite(trainingLoad.ratio)
      ? { zone: trainingLoad.zone, ratio: trainingLoad.ratio }
      : null,
    hasInjuries: Array.isArray(injuries) && injuries.some((i) => typeof i === 'string' && i.trim() !== ''),
  };
}

/**
 * True when the state tells the AI nothing at all (every piece missing), so there is nothing worth sending. Whether an injury was
 * reported does not count: it only changes how the other pieces are to be read.
 */
export function isEmptyTrainingState(state) {
  if (!state || typeof state !== 'object') return true;
  return state.recentWorkouts == null
    && state.musclesWorked == null
    && state.muscleLoad == null
    && !(Array.isArray(state.lifts) && state.lifts.length > 0)
    && !state.readiness
    && !state.trainingLoad;
}

const namedWith = (list, key) => list.filter((m) => m && typeof m.muscle === 'string' && m.muscle && finite(m[key]));

/**
 * The Coach's sentences for the parts of the state its data message does not already carry (it already has the lift history and the
 * training load from their own summaries): the workouts in the last 14 days, the muscles those worked, the muscle load still carried,
 * readiness, and, when an injury was reported, that it comes before all of these. A part that is missing, or not the shape it should
 * be, is null.
 * @returns {{ recent: string | null, worked: string | null, load: string | null, readiness: string | null, injuries: string | null }}
 */
export function coachTrainingFacts(state) {
  const none = { recent: null, worked: null, load: null, readiness: null, injuries: null };
  if (!state || typeof state !== 'object') return none;

  const recent = Number.isInteger(state.recentWorkouts) && state.recentWorkouts >= 0
    ? `Workouts logged in the last ${RECENT_DAYS} days: ${state.recentWorkouts}.`
    : null;

  let worked = null;
  if (Array.isArray(state.musclesWorked)) {
    const list = namedWith(state.musclesWorked, 'sessions');
    worked = list.length > 0
      ? `Muscles worked in the last ${RECENT_DAYS} days, with how many workouts, runs or hikes worked each (how often, not how hard): ` +
        `${list.map((m) => `${muscleLabel(m.muscle)} ${whole(m.sessions)}`).join(', ')}.`
      : `No muscles worked by logged workouts, runs or hikes in the last ${RECENT_DAYS} days.`;
  }

  let load = null;
  if (Array.isArray(state.muscleLoad)) {
    const list = namedWith(state.muscleLoad, 'load');
    load = list.length > 0
      ? `Muscle load still being carried from the last ${MUSCLE_WINDOW_DAYS} days, as a share of the most worked muscle (100 is the most worked of them, not a maximum): ` +
        `${list.map((m) => `${muscleLabel(m.muscle)} ${whole(m.load)}`).join(', ')}.`
      : `No muscle load from logged workouts, runs or hikes in the last ${MUSCLE_WINDOW_DAYS} days.`;
  }

  const r = state.readiness;
  const readiness = r && finite(r.score)
    ? `Readiness today: ${whole(r.score)} of 100${typeof r.label === 'string' && r.label ? ` (${r.label})` : ''}, ` +
      "a guide made from this person's own sleep, heart-rate and training-load readings. It is not medical advice."
    : null;

  // Only worth saying beside figures that could be read as "this area is fresh, so train it".
  const injuries = state.hasInjuries === true && (worked || load)
    ? 'The injuries this person reported come before the muscle figures above: never suggest training an injured area because it shows little recent load, ' +
      'and do not advise on an injury beyond suggesting they see a professional.'
    : null;

  return { recent, worked, load, readiness, injuries };
}

/**
 * The data for a generateWorkoutPlan request. The defaults are the ones the request always had (a beginner, no goals, no profile). The
 * training state goes with it only when there is one, so a request for a person with nothing to tell the AI is exactly what it was.
 */
export function workoutPlanRequest({ fitnessLevel, goals, history, profile, trainingState } = {}) {
  return {
    fitnessLevel: fitnessLevel || 'beginner',
    goals: goals || [],
    history,
    profile: profile || {},
    ...(trainingState ? { trainingState } : {}),
  };
}

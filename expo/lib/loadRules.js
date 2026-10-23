// lib/loadRules.js
//
// What to lift next, from the sets already logged for one exercise. Pure functions: no store, no Firestore, no screen. The workout screen
// (through services/progressiveOverloadService.js's getNextPrescription) hands in the logged sets and the person's goal and level, and gets
// back a weight, a rep target and the reason in a sentence.
//
// Every number is in LOAD_RULES below. They are starting points taken from common coaching guidance (functions/EXERCISE_SCIENCE_KNOWLEDGE.md
// has the sources), not measurements, and not tuned on the app's own users yet. Change a number there and the tests that read the table
// show what else moves.
//
// The rules, in the order they are applied to a lift that has a history:
//   1. Sets are grouped into sessions (one calendar day each). Today's sets never count towards today's target. A set far above what the
//      person has recently done (more than 1.5 times their recent estimated one-rep max) is ignored, unless the session before or after
//      shows the same jump, in which case it was real. This is the "outlier guard": one mistyped weight cannot move anything.
//   2. A rep range comes from the goal: strength 3-5 reps on a heavy day, muscle growth 6-8, general fitness 8-10. Main lifts (squat,
//      hinge, press, row, pull) alternate a heavy day with a lighter, higher-rep one (strength 6-8, muscle growth 10-15, general fitness
//      12-15); everything else uses one range. Exercises done with the body alone have their own rep ranges and a ladder of harder variations.
//   3. The weight is set from the estimated one-rep max when there is no earlier session of the same kind to build on (the first heavy day,
//      or a change of goal, or history done at very different reps): weight = one-rep max / (1 + (reps + reps left) / 30), the Epley formula the
//      rest of the app uses turned round, rounded to the smallest plate jump. The reps left is 3 for a beginner and 2 or 1 after that.
//   4. Otherwise the earlier session of the same kind is built on, as double progression: climb the reps inside the range, and when every
//      set reaches the top, raise the weight by 2.5% (upper body, isolation) or 5% (lower body), rounded to the plate jump, never more than
//      10% in one session (unless one plate jump is already more than that, as on a 15 lb dumbbell). A set rated Hard, low readiness, or
//      more than three weeks since the last session hold the weight instead.
//   5. A deload (10% lighter, about half the sets) comes every 4-8 weeks of steady training by level, sooner after two sessions in a row
//      with most sets below the bottom of the rep range, and sooner after three low-readiness days in the last week. A scheduled deload is
//      followed by a return to the weight from before it; an early one is followed by building back up from the lighter weight, and it
//      starts the count of weeks again. Nothing about a deload is stored: it is found again from the dates and weights in the log.
//
// Weights are in whatever unit the person logs. The workout screen logs pounds, so that is the default; 'kg' changes the plate jump only.
import { dayKeyOf, localDateKey, parseDateKey } from './localDate';
import { findExercise, getLadder } from './exerciseLibrary';
import { computeReadiness } from './readiness';

export const LOAD_RULES = Object.freeze({
  // Rep ranges by goal. heavy and light are the two kinds of day on a main lift; accessory is every other exercise. Heavy tops out below
  // where light starts, so a light day is always lighter than a heavy one.
  repRanges: Object.freeze({
    strength: Object.freeze({ heavy: { min: 3, max: 5 }, light: { min: 6, max: 8 }, accessory: { min: 6, max: 8 } }),
    muscle: Object.freeze({ heavy: { min: 6, max: 8 }, light: { min: 10, max: 15 }, accessory: { min: 8, max: 12 } }),
    general: Object.freeze({ heavy: { min: 8, max: 10 }, light: { min: 12, max: 15 }, accessory: { min: 12, max: 15 } }),
  }),
  // Exercises done with the body alone: reps only, no heavy and light.
  bodyweightRepRanges: Object.freeze({
    strength: { min: 5, max: 8 },
    muscle: { min: 8, max: 15 },
    general: { min: 10, max: 20 },
  }),
  // Reps to leave in the tank on a working set, by level (beginners stay three or more short of failure).
  repsLeft: Object.freeze({ beginner: 3, intermediate: 2, advanced: 1 }),
  // What the three effort buttons mean, in reps left. Unrated sets (older logs) count as the middle one.
  ratingRepsLeft: Object.freeze({ easy: 3, moderate: 2, hard: 1 }),
  unratedRepsLeft: 2,
  // The smallest change of weight: one pair of the smallest plates.
  plateJump: Object.freeze({ lb: 5, kg: 2.5 }),
  // How much to add when every set reaches the top of the range, as a share of the load.
  stepShare: Object.freeze({ lower: 0.05, upper: 0.025, isolation: 0.025 }),
  maxStepShare: 0.1,
  // Never start a lift above this share of the estimated one-rep max.
  maxShareOfOneRepMax: 0.9,
  // Deload.
  deloadAfterWeeks: Object.freeze({ beginner: 8, intermediate: 6, advanced: 4 }),
  deloadLoadFactor: 0.9,
  deloadSetsFactor: 0.5,
  // A session at 95% of the weight of the session of its kind before it, or less, was a lighter week: the count of weeks starts again from it.
  lighterSessionShare: 0.95,
  belowRangeSessionsForDeload: 2,
  lowReadinessDaysForDeload: 3,
  lowReadinessWindowDays: 7,
  // Steady training: sessions of one exercise no more than this many days apart belong to the same block.
  blockGapDays: 10,
  // After this many days without the exercise the weight is repeated, not raised.
  holdAfterGapDays: 21,
  // A session counts as the same kind as today's when its reps are within this many of today's range.
  zoneTolerance: 2,
  // Outlier guard.
  outlierFactor: 1.5,
  outlierLookbackSessions: 5,
  outlierMinSessions: 3,
});

export const GOALS = Object.freeze(['strength', 'muscle', 'general']);

/** The three effort buttons on the workout screen, in order, with what each one means in reps left. The saved values stay easy / moderate / hard. */
export const EFFORT_OPTIONS = Object.freeze([
  Object.freeze({ rating: 'easy', label: 'Easy', repsLeft: '3+ left' }),
  Object.freeze({ rating: 'moderate', label: 'OK', repsLeft: '1-2 left' }),
  Object.freeze({ rating: 'hard', label: 'Hard', repsLeft: '0-1 left' }),
]);

const MAIN_PATTERNS = ['squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'];
const FREE_WEIGHTS = ['barbell', 'trap_bar', 'dumbbell', 'kettlebell'];
const LOWER_PATTERNS = ['squat', 'hinge', 'lunge'];
const UPPER_PATTERNS = ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'];

/** The goal the load rules use, from the goal ids on the person's profile: strength first, then muscle growth, otherwise general fitness. */
export function goalForLoad(goalIds) {
  const ids = Array.isArray(goalIds) ? goalIds : [];
  if (ids.includes('increase_strength')) return 'strength';
  if (ids.includes('build_muscle')) return 'muscle';
  return 'general';
}

/** beginner, intermediate or advanced (elite counts as advanced); anything else is a beginner, the safer side. */
export function levelKey(level) {
  const v = typeof level === 'string' ? level.trim().toLowerCase() : '';
  if (v === 'intermediate') return 'intermediate';
  if (v === 'advanced' || v === 'elite') return 'advanced';
  return 'beginner';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Numbers

const epley = (weight, repsToFailure) => weight * (1 + repsToFailure / 30);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const unitKey = (unit) => (unit === 'kg' ? 'kg' : 'lb');
const plateJump = (unit) => LOAD_RULES.plateJump[unitKey(unit)];

/** A weight rounded to the nearest plate jump, and never less than one jump. */
export function roundToPlates(weight, unit) {
  const jump = plateJump(unit);
  return Math.max(jump, Math.round(weight / jump) * jump);
}

/**
 * The weight that should leave `repsLeft` reps in the tank after `reps` reps, for someone whose estimated one-rep max is `oneRepMax`:
 * the Epley formula turned round, rounded to the plate jump, and never above 90% of the one-rep max.
 */
export function weightFromOneRepMax(oneRepMax, reps, repsLeft, unit) {
  if (!(oneRepMax > 0) || !(reps > 0)) return null;
  const jump = plateJump(unit);
  const raw = oneRepMax / (1 + (reps + repsLeft) / 30);
  // The cap is a safety limit and plates are coarse, so the ceiling is the heaviest whole jump at or under 90%.
  const ceiling = Math.floor((oneRepMax * LOAD_RULES.maxShareOfOneRepMax) / jump) * jump;
  return Math.max(jump, Math.min(Math.round(raw / jump) * jump, ceiling));
}

/** A step of `wanted` on top of `load`, held to 10% of the load in whole plate jumps; one plate jump is allowed even where it is more than 10%. */
export function capStep(wanted, load, unit) {
  const jump = plateJump(unit);
  const cap = Math.max(jump, Math.floor((load * LOAD_RULES.maxStepShare) / jump) * jump);
  return Math.min(wanted, cap);
}

/** How much to add to `load` after a session that reached the top of the range: the lift's share of the load, in whole plate jumps, at most 10%. */
export function stepUp(load, liftClass, unit) {
  const jump = plateJump(unit);
  const share = LOAD_RULES.stepShare[liftClass] ?? LOAD_RULES.stepShare.isolation;
  return capStep(Math.max(jump, Math.round((load * share) / jump) * jump), load, unit);
}

/** The reps in the rep range, goal, level and kind of day: { min, max }. */
export function repRangeFor(goal, dayType, { bodyweight = false } = {}) {
  const g = GOALS.includes(goal) ? goal : 'general';
  if (bodyweight) return { ...LOAD_RULES.bodyweightRepRanges[g] };
  const key = dayType === 'heavy' || dayType === 'light' ? dayType : 'accessory';
  return { ...LOAD_RULES.repRanges[g][key] };
}

/** True when a set's estimated one-rep max is so far above `recentBest` that it is more likely a typing slip than a lift. */
export function isOutlierOneRepMax(oneRepMax, recentBest) {
  return recentBest > 0 && oneRepMax > recentBest * LOAD_RULES.outlierFactor;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// What kind of exercise it is

const NAME_PATTERNS = [
  [/dead\s?lift|romanian|good morning|hip thrust/i, 'hinge'],
  [/lunge|split squat|step[- ]?up/i, 'lunge'],
  [/squat/i, 'squat'],
  [/overhead press|shoulder press|military press|push press/i, 'vertical_push'],
  [/bench|chest press|incline press|push[- ]?up/i, 'horizontal_push'],
  [/pull[- ]?down|pull[- ]?up|chin[- ]?up/i, 'vertical_pull'],
  [/\brow\b/i, 'horizontal_pull'],
];
// Holds are timed, not counted: a rep range means nothing for them, so they get no prescription.
const TIMED_HOLD = /plank|hollow hold|wall sit|dead hang|l-sit|side bridge/i;

/**
 * What the load rules need to know about an exercise by name: whether it is a main lift (heavy and light days), which share to add when it
 * goes up (lower, upper or isolation), whether it is a timed hold, and where it sits on a bodyweight ladder. The exercise library decides
 * when it knows the name; otherwise the name is read for the common lifts, and anything else is treated as an accessory.
 */
export function describeLift(name) {
  const text = typeof name === 'string' ? name : '';
  const found = findExercise(text);
  const pattern = found ? found.pattern : (NAME_PATTERNS.find(([re]) => re.test(text)) || [null, null])[1];
  const liftClass = LOWER_PATTERNS.includes(pattern) ? 'lower' : UPPER_PATTERNS.includes(pattern) ? 'upper' : 'isolation';
  const timed = TIMED_HOLD.test(text) || (!!found && !!found.ladder && found.ladder.name === 'plank' && found.ladder.rung >= 2);
  return {
    exercise: found,
    pattern,
    // A main lift is a free-weight compound. Machines, cables and bodyweight moves (push-ups, pull-ups) get one rep range, or the bodyweight rules.
    main: MAIN_PATTERNS.includes(pattern) && (found ? found.equipment.some((e) => FREE_WEIGHTS.includes(e)) : true),
    liftClass,
    timed,
    ladder: found && found.ladder ? { name: found.ladder.name, rung: found.ladder.rung } : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Sessions

const MS_PER_DAY = 86400000;
function daysBetween(fromKey, toKey) {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  return a && b ? Math.round((b.getTime() - a.getTime()) / MS_PER_DAY) : 0;
}

const usableSet = (s, today) => {
  if (!s || typeof s !== 'object') return null;
  const day = dayKeyOf(s.date);
  const reps = Number(s.reps);
  const weight = Number(s.weight);
  if (!day || day >= today) return null;
  if (!Number.isFinite(reps) || reps < 1 || reps > 100) return null;
  if (!Number.isFinite(weight) || weight < 0 || weight > 2000) return null;
  return { day, weight, reps: Math.round(reps), rating: Object.prototype.hasOwnProperty.call(LOAD_RULES.ratingRepsLeft, s.rpe) ? s.rpe : null };
};

const repsLeftOf = (set) => (set.rating ? LOAD_RULES.ratingRepsLeft[set.rating] : LOAD_RULES.unratedRepsLeft);
const rawOneRepMax = (set) => (set.weight > 0 ? epley(set.weight, set.reps) : null);
const adjustedOneRepMax = (set) => (set.weight > 0 ? epley(set.weight, set.reps + repsLeftOf(set)) : null);

// The sets of one day, in the shape the rules read: the weight most of the sets were done at (the heavier one when tied), the reps and
// ratings of those sets, and the best estimates from any set. The order sets come back from the database in is not the order they were
// done in, so nothing here depends on it.
function summarizeSession(day, sets) {
  const counts = new Map();
  sets.forEach((s) => counts.set(s.weight, (counts.get(s.weight) || 0) + 1));
  let weight = null;
  counts.forEach((count, w) => {
    if (weight === null || count > counts.get(weight) || (count === counts.get(weight) && w > weight)) weight = w;
  });
  const main = sets.filter((s) => s.weight === weight);
  const raw = sets.map(rawOneRepMax).filter((v) => v !== null);
  const adjusted = sets.map(adjustedOneRepMax).filter((v) => v !== null);
  return {
    day,
    sets,
    weight,
    reps: main.map((s) => s.reps),
    ratings: main.map((s) => s.rating),
    bestRaw: raw.length ? Math.max(...raw) : null,
    bestAdjusted: adjusted.length ? Math.max(...adjusted) : null,
  };
}

function groupSessions(history, today) {
  const byDay = new Map();
  (Array.isArray(history) ? history : []).forEach((raw) => {
    const s = usableSet(raw, today);
    if (!s) return;
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day).push(s);
  });
  return [...byDay.keys()].sort().map((day) => summarizeSession(day, byDay.get(day)));
}

/**
 * The outlier guard. For each session, the recent level is the median of the best one-rep-max estimates of the (up to) five sessions before
 * it; a set whose own estimate is more than 1.5 times that is dropped, unless the session before or after has a best within 1.5 times of it
 * and is itself above the same level (the jump was real, or at least not a single slip). A session left with no sets disappears. With fewer
 * than three earlier sessions there is no level to compare with, so nothing is dropped.
 */
function withoutOutliers(sessions) {
  const { outlierFactor, outlierLookbackSessions, outlierMinSessions } = LOAD_RULES;
  const levels = sessions.map((_, i) => {
    const earlier = sessions.slice(Math.max(0, i - outlierLookbackSessions), i).map((s) => s.bestRaw).filter((v) => v !== null);
    return earlier.length >= outlierMinSessions ? median(earlier) : null;
  });
  const kept = sessions.map((session, i) => {
    const level = levels[i];
    if (level === null) return session;
    const high = (v) => v !== null && v > level * outlierFactor;
    const neighbors = [sessions[i - 1], sessions[i + 1]].filter(Boolean);
    const sets = session.sets.filter((s) => {
      const v = rawOneRepMax(s);
      if (!high(v)) return true;
      return neighbors.some((n) => high(n.bestRaw) && n.bestRaw <= v * outlierFactor && n.bestRaw >= v / outlierFactor);
    });
    return sets.length === session.sets.length ? session : (sets.length ? summarizeSession(session.day, sets) : null);
  });
  return kept.filter(Boolean);
}

/** The sets that survive the outlier guard, newest last, for callers that only want a clean list (a personal-best check, for one). */
export function trustedSets(history, today = localDateKey()) {
  return withoutOutliers(groupSessions(history, today)).flatMap((s) => s.sets);
}

/** The estimated one-rep max the loads are set from: the lower middle of the last three sessions' best estimates, which count the reps left. */
function workingOneRepMax(sessions) {
  const recent = sessions.slice(-3).map((s) => s.bestAdjusted).filter((v) => v !== null).sort((a, b) => a - b);
  return recent.length ? recent[Math.floor((recent.length - 1) / 2)] : null;
}

// Which sessions fall in a deload week. A block of steady training starts at the first session after a gap of more than blockGapDays, or at
// a lighter session (see lighterSessionShare), and runs for the weeks the level calls for; the week after those is the deload week, and
// then the count starts again. Worked out from the dates and weights alone, so nothing has to be stored. `step` is how far back the session
// of the same kind is: two for a main lift (heavy and light days alternate), one for everything else.
function blocks(sessions, today, level, step) {
  const length = LOAD_RULES.deloadAfterWeeks[level];
  const inDeloadWeek = (start, day) => Math.floor(daysBetween(start, day) / 7) % (length + 1) === length;
  let start = null;
  let previous = null;
  const marked = sessions.map((s, i) => {
    if (previous === null || daysBetween(previous, s.day) > LOAD_RULES.blockGapDays) start = s.day;
    previous = s.day;
    const deload = inDeloadWeek(start, s.day);
    const before = sessions[i - step];
    const lighter = !deload && !!before && s.weight <= before.weight * LOAD_RULES.lighterSessionShare;
    if (lighter) start = s.day;
    return { ...s, deload, lighter };
  });
  const last = marked[marked.length - 1];
  const carries = last && daysBetween(last.day, today) <= LOAD_RULES.blockGapDays;
  return { marked, deloadWeekToday: carries ? inDeloadWeek(start, today) : false };
}

const middleReps = (reps) => median(reps);
const inZone = (reps, range) => {
  const m = middleReps(reps);
  return m >= range.min - LOAD_RULES.zoneTolerance && m <= range.max + LOAD_RULES.zoneTolerance;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// The prescription

/**
 * The next session's weight and reps for one exercise, or null when there is nothing to build on (no usable earlier session) or the exercise
 * is a timed hold.
 *
 * @param {Array<{weight:number, reps:number, rpe?:string, date:any}>} history every logged set for this exercise
 * @param {object} [options]
 * @param {string} [options.exerciseName]   read for the kind of lift (main lift or not, lower or upper body, ladder)
 * @param {string} [options.goal]           'strength' | 'muscle' | 'general' (see goalForLoad)
 * @param {string} [options.level]          'beginner' | 'intermediate' | 'advanced'
 * @param {string} [options.unit]           'lb' (default) | 'kg'
 * @param {string} [options.readiness]      'high' | 'medium' | 'low' (today's; only 'low' changes anything)
 * @param {number} [options.lowReadinessDays] low-readiness days in the last week
 * @param {boolean} [options.bodyweight]    true for exercises done with the body alone (otherwise read from the weights logged)
 * @param {any} [options.today]             a date or day key; defaults to now
 * @returns {null | {
 *   weight: number, targetReps: number, estimatedOneRepMax: number | null, reason: string,
 *   dayType: 'heavy' | 'light' | null, repRange: {min:number,max:number}, repsLeft: number | null, shareOfOneRepMax: number | null,
 *   deload: boolean, setsFactor: number, moveUpTo: {id:string, name:string} | null
 * }}
 */
export function prescribeNext(history, options = {}) {
  const today = options.today ? (dayKeyOf(options.today) || localDateKey()) : localDateKey();
  const lift = describeLift(options.exerciseName);
  if (lift.timed) return null;
  const goal = GOALS.includes(options.goal) ? options.goal : 'general';
  const level = levelKey(options.level);
  const unit = unitKey(options.unit);

  const sessions = groupSessions(history, today);
  if (!sessions.length) return null;
  const bodyweight = typeof options.bodyweight === 'boolean' ? options.bodyweight : sessions.every((s) => s.weight === 0);

  if (bodyweight) return prescribeBodyweight(sessions, { lift, goal, today, readiness: options.readiness });
  return prescribeWeighted(withoutOutliers(sessions.map((s) => {
    const sets = s.sets.filter((x) => x.weight > 0);
    return sets.length ? summarizeSession(s.day, sets) : null;
  }).filter(Boolean)), { lift, goal, level, unit, today, readiness: options.readiness, lowReadinessDays: Number(options.lowReadinessDays) || 0 });
}

function result(fields) {
  return {
    weight: 0, targetReps: 0, estimatedOneRepMax: null, reason: '', dayType: null, repRange: { min: 0, max: 0 }, repsLeft: null,
    shareOfOneRepMax: null, deload: false, setsFactor: 1, moveUpTo: null, ...fields,
  };
}

function prescribeWeighted(sessions, { lift, goal, level, unit, today, readiness, lowReadinessDays }) {
  if (!sessions.length) return null;
  const { marked, deloadWeekToday } = blocks(sessions, today, level, lift.main ? 2 : 1);
  const working = marked.filter((s) => !s.deload);
  const last = marked[marked.length - 1];
  const daysSince = daysBetween(last.day, today);
  const oneRepMax = workingOneRepMax(marked);
  const repsLeft = LOAD_RULES.repsLeft[level];

  // Heavy on every second session of a main lift, counting the sessions of that exercise outside deload weeks. Other lifts keep one range.
  const dayTypeOf = (index) => (lift.main ? (index % 2 === 1 ? 'heavy' : 'light') : null);
  const dayType = dayTypeOf(working.length);
  const range = repRangeFor(goal, dayType);
  const chain = working.length >= (lift.main ? 2 : 1) ? working[working.length - (lift.main ? 2 : 1)] : null;
  const chainUsable = chain && inZone(chain.reps, range);

  // Sooner-than-scheduled deloads.
  const belowRange = (session, index) => middleReps(session.reps) < repRangeFor(goal, dayTypeOf(index)).min;
  const need = LOAD_RULES.belowRangeSessionsForDeload;
  const recentWorking = working.slice(-need);
  const belowTwice = recentWorking.length === need
    && recentWorking.every((s, k) => belowRange(s, working.length - need + k));
  const tired = lowReadinessDays >= LOAD_RULES.lowReadinessDaysForDeload;
  // The session this one builds on was itself a lighter one: another early deload on top of it would take the weight down twice.
  const earlyAllowed = !(chainUsable && chain.lighter);

  const startWeight = () => weightFromOneRepMax(oneRepMax, range.min, repsLeft, unit);
  const finish = (weight, targetReps, reason, extra = {}) => result({
    weight,
    targetReps,
    estimatedOneRepMax: oneRepMax,
    reason,
    dayType,
    repRange: range,
    repsLeft,
    shareOfOneRepMax: oneRepMax ? Math.round((weight / oneRepMax) * 100) : null,
    ...extra,
  });

  if (deloadWeekToday || (earlyAllowed && (belowTwice || tired))) {
    const base = chainUsable ? chain.weight : startWeight();
    const weight = roundToPlates(base * LOAD_RULES.deloadLoadFactor, unit);
    const why = deloadWeekToday
      ? `${LOAD_RULES.deloadAfterWeeks[level]} weeks of steady training - a lighter week`
      : tired ? 'several low-readiness days this week' : 'two sessions in a row below the rep range';
    return finish(weight, range.min,
      `Deload (${why}): about 10% lighter and about half the usual sets, every rep smooth and easy.`,
      { deload: true, setsFactor: LOAD_RULES.deloadSetsFactor });
  }

  if (!chainUsable) {
    const weight = startWeight();
    return finish(weight, range.min,
      `Set from your estimated 1-rep max of about ${Math.round(oneRepMax)} ${unit}.`);
  }

  const reps = chain.reps;
  const minReps = Math.min(...reps);
  const hold = (reason) => finish(chain.weight, Math.min(range.max, Math.max(range.min, minReps)), reason);
  if (readiness === 'low') return hold("Today's recovery data suggests low readiness - holding steady rather than pushing for more.");
  if (chain.ratings.includes('hard')) return hold('Last time was rated hard - the same weight again before adding more.');
  if (daysSince > LOAD_RULES.holdAfterGapDays) {
    return hold(`It has been ${daysSince} days since your last session - the same weight again, no increase yet.`);
  }
  if (reps.every((r) => r >= range.max)) {
    const step = stepUp(chain.weight, lift.liftClass, unit);
    return finish(chain.weight + step, range.min,
      `Every set reached ${range.max} reps - the weight goes up ${step} ${unit}.`);
  }
  if (minReps < range.min) {
    return finish(chain.weight, range.min, 'Below the rep range last time - the same weight again.');
  }
  const climb = chain.ratings.includes('easy') ? 2 : 1;
  return finish(chain.weight, Math.min(range.max, minReps + climb),
    `${climb === 2 ? 'Rated easy last time - up 2 reps' : 'Up a rep'}, working toward ${range.max} before the weight goes up.`);
}

function prescribeBodyweight(sessions, { lift, goal, today, readiness }) {
  const range = repRangeFor(goal, null, { bodyweight: true });
  const last = sessions[sessions.length - 1];
  const reps = last.sets.map((s) => s.reps);
  const minReps = Math.min(...reps);
  const ratings = last.sets.map((s) => s.rating);
  const daysSince = daysBetween(last.day, today);
  const finish = (targetReps, reason, extra = {}) => result({ weight: 0, targetReps, reason, repRange: range, ...extra });
  const hold = (reason) => finish(Math.min(range.max, Math.max(range.min, minReps)), reason);

  if (readiness === 'low') return hold("Today's recovery data suggests low readiness - holding steady rather than pushing for more.");
  if (ratings.includes('hard')) return hold('Last time was rated hard - the same reps again before adding more.');
  if (daysSince > LOAD_RULES.holdAfterGapDays) {
    return hold(`It has been ${daysSince} days since your last session - the same reps again, no increase yet.`);
  }
  if (reps.every((r) => r >= range.max)) {
    const rung = lift.ladder ? getLadder(lift.ladder.name).find((e) => e.ladder.rung === lift.ladder.rung + 1) : null;
    if (rung) {
      return finish(range.max, `Every set reached ${range.max} reps - ready for a harder version: ${rung.name}. Start it at ${range.min} reps.`,
        { moveUpTo: { id: rung.id, name: rung.name } });
    }
    return finish(range.max, `Every set reached ${range.max} reps - make each rep harder (lower for about 3 seconds, or go through a longer range) before adding more.`);
  }
  if (minReps < range.min) return finish(range.min, 'Below the rep range last time - the same target again.');
  const climb = ratings.includes('easy') ? 2 : 1;
  return finish(Math.min(range.max, minReps + climb),
    `${climb === 2 ? 'Rated easy last time - up 2 reps' : 'Up a rep'}, working toward ${range.max} before making it harder.`);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// What the workout screen shows

/** One line telling the person what the three effort buttons mean. */
export function effortLegend() {
  return `Rate each set by the reps you had left: ${EFFORT_OPTIONS.map((o) => `${o.label} = ${o.repsLeft}`).join(', ')}.`;
}

/**
 * The words for the prescription card: { target, detail, reason }. `target` is the headline ("Today's target: 160 lb x 6 reps"), `detail` the
 * kind of day, the rep range and how hard to push, `reason` the sentence from prescribeNext.
 */
export function prescriptionText(p, { bodyweight = false, unit = 'lb' } = {}) {
  if (!p) return null;
  const target = bodyweight
    ? `Today's target: ${p.targetReps} reps`
    : `Today's target: ${p.weight} ${unitKey(unit)} x ${p.targetReps} reps`;
  const dayWord = p.deload ? 'Deload' : p.dayType === 'heavy' ? 'Heavy day' : p.dayType === 'light' ? 'Light day' : null;
  const parts = [
    dayWord,
    p.repRange && p.repRange.max > 0 ? `${p.repRange.min}-${p.repRange.max} reps` : null,
    p.deload ? 'about half the usual sets' : p.repsLeft !== null && p.repsLeft !== undefined ? `stop with about ${p.repsLeft} ${p.repsLeft === 1 ? 'rep' : 'reps'} left` : null,
    !p.deload && p.shareOfOneRepMax ? `about ${p.shareOfOneRepMax}% of your estimated 1-rep max` : null,
  ].filter(Boolean);
  return { target, detail: parts.join(' · '), reason: p.reason };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Low-readiness days, for the deload rule

/**
 * How many of the last seven days (today included) had a readiness the Health screen calls Low (below 50), from the daily readings the Health screen keeps
 * (healthStore.readingsHistory). A day with too little to build a score from does not count, so a person without a wearable always gets 0.
 */
export function countLowReadinessDays(readingsHistory, today = localDateKey()) {
  const end = parseDateKey(today);
  if (!end || !readingsHistory || typeof readingsHistory !== 'object' || Array.isArray(readingsHistory)) return 0;
  let count = 0;
  for (let back = 0; back < LOAD_RULES.lowReadinessWindowDays; back += 1) {
    const day = localDateKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - back));
    const r = computeReadiness({ history: readingsHistory, today: day });
    if (r.label === 'Low') count += 1;
  }
  return count;
}

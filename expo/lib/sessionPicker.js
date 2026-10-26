// lib/sessionPicker.js
//
// Picks today's session from the exercise library: which exercises, how many sets, in what order, and why each one.
//
// This is the engine's choosing step. The pieces it reads were built before it: the library (data/exerciseLibrary.js) says what each exercise
// works and needs, muscle recovery (lib/muscleRecovery.js) says how rested each muscle is, the load rules (lib/loadRules.js) say how many reps and
// how heavy, and the injury list (lib/injuryRules.js) says what to leave out. Like those, this is a model built from common training guidance, not
// a measurement: nobody has checked that the sessions it picks are the best ones for anybody, and every number below is a starting value kept in
// one place (SESSION_RULES) so it can be tuned on real logs. It is deterministic: the same inputs always give the same session.
//
// The rules, in order:
//   1. What is allowed. An exercise is a candidate when the person has what it needs (EQUIPMENT_PRESETS), it is not one the person excluded, it is
//      no harder than their level (a beginner is not offered an advanced move), and none of their reported injuries rules it out. A bodyweight
//      ladder (push-ups, pull-ups, squats...) is one slot: only the rung the person is on is offered (the rung they last did, or, with no history,
//      one level below their own).
//   2. Who is ready. A candidate is only picked when every muscle it mainly works is at least 70% recovered. The muscles it only helps may be
//      more tired; they count for less the more tired they are.
//   3. What is missing. Each muscle should get about 10 to 20 sets a week (10 for a beginner, 14 for intermediate, 18 for advanced is the aim) in about two
//      sessions. An exercise is worth more the further the muscles it mainly works are below that aim and the fewer sessions they had this week (the
//      sets of the last 7 days come from the logged workouts; runs and hikes tire a muscle but do not count as sets). The big muscles matter most
//      when choosing (chest, back, shoulders, legs), forearms and the neck least; the muscles an exercise only helps count a quarter as much. A
//      muscle never goes over 20 a week, nor more than 10% over what it got in the 7 days before that (but always up to 10, so a new lifter can start).
//   4. Goal. A compound lift is worth more than an isolation move, a lot more when the goal is strength; a bodyweight move is worth a little less
//      to someone who has weights and wants strength or size, and the classic lifts (bench press, squat, deadlift, row...) are worth a little more
//      than their lookalikes. Conditioning moves (burpees, jumps) are cardio and are never picked here, and a session never has more than one
//      compound lift of the same movement pattern (one squat, one hinge, one horizontal press...), nor more than two isolation moves.
//      The person's feedback (lib/trainingFeedback.js: More, Less, a swap away, a skip) multiplies an exercise's score and nothing else: it only changes
//      the order among exercises that are already allowed and ready, lets none through that the rules above left out, and changes no weight, rep or limit.
//   5. Fill the time. The best exercise is taken, what it adds is counted against the muscles it works (so the next one is worth less to them),
//      and so on until the minutes run out, 8 exercises are in, or nothing worthwhile still fits. If the last one does not fit at full sets it
//      is taken at fewer (never fewer than 2).
//   6. Say why. Each pick carries one line made only from the figures above ("Chest: about 92% recovered, 6 sets short of this week's 14-set aim.").
//
// A person can also swap one exercise of the session for another (swapOptions, replaceExercise, dropExercise): the rest of the session stays as it is.
//
// Pure functions, no stores: services/sessionService.js reads the stores and passes the records in.
import { LIBRARY, LEVELS, EQUIPMENT, getLadder, getExercise, findExercise } from './exerciseLibrary';
import { workoutLoads, workoutTime } from './muscleRecovery';
import { GOALS, levelKey, repRangeFor, describeLift, prescriptionText } from './loadRules';
import { blockedBy } from './injuryRules';
import { muscleLabel } from './homeWidgetData';
import { calculateXpReward } from './coachActions';
import { FEEDBACK_RULES, feedbackKey } from './trainingFeedback';

const DAY_MS = 24 * 60 * 60 * 1000;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));

/** Every number the picker uses. Change them here; nothing else holds a copy. */
export const SESSION_RULES = Object.freeze({
  /** A candidate's main muscles must be at least this recovered (0 to 100). */
  readyRecovery: 70,
  /** Sets a week per muscle: never under `min` as a ceiling, never over `max`, and `aim` is what the picker works towards. */
  weeklySets: Object.freeze({ min: 10, max: 20, aim: Object.freeze({ beginner: 10, intermediate: 14, advanced: 18 }) }),
  /** A muscle's sets in the last 7 days plus today's may be at most this much over the 7 days before. */
  maxWeeklyRise: 1.1,
  /** Effective sets in one workout for it to count as a session for that muscle. */
  sessionMinSets: 2,
  /** A muscle should be trained about twice a week: added to its need when it has had no session this week, and when it has had one. Only until the session itself works it. */
  frequencyBonus: Object.freeze({ none: 0.3, once: 0.15 }),
  /** The least a muscle still ready is worth, so a session can still be built when every aim has been met. */
  needFloor: 0.1,
  /** How much each muscle matters when choosing: the big ones first. A starting judgement, not a measurement. */
  muscleWeight: Object.freeze({
    chest: 1, lats: 1, upper_back: 1, shoulders: 1, quadriceps: 1, hamstrings: 1, glutes: 1,
    biceps: 0.7, triceps: 0.7, core: 0.6, lower_back: 0.5, calves: 0.5, traps: 0.4, adductors: 0.3, abductors: 0.3, forearms: 0.25, neck: 0.2,
  }),
  /** What a muscle an exercise only helps counts compared with one it mainly works, when choosing (not when counting sets). */
  secondaryWeight: 0.25,
  /** A bodyweight move, when the goal is strength or size, is worth this share of a loaded move (it only matters where a loaded one is on offer). */
  bodyweightShare: 0.8,
  /** The most exercises of one movement pattern in a session: one of each compound pattern, two isolation or core moves. */
  perPatternMax: Object.freeze({ default: 1, isolation: 2, core: 2 }),
  /** The classic lifts, each worth this much more than a lookalike (so the barbell bench press beats the floor press). */
  stapleBonus: 0.1,
  staples: Object.freeze([
    'barbell-bench-press', 'dumbbell-bench-press', 'barbell-overhead-press', 'seated-dumbbell-shoulder-press',
    'barbell-row', 'seated-cable-row', 'pull-up', 'lat-pulldown',
    'barbell-back-squat', 'goblet-squat', 'leg-press', 'deadlift', 'trap-bar-deadlift', 'romanian-deadlift', 'dumbbell-romanian-deadlift', 'dumbbell-lunge',
    'dumbbell-curl', 'triceps-pushdown', 'dumbbell-lateral-raise', 'lying-leg-curl', 'leg-extension', 'standing-calf-raise', 'plank', 'cable-crunch',
  ]),
  /** How much more an exercise is worth, by goal, when it is a compound lift or anything else. */
  goalBonus: Object.freeze({
    strength: Object.freeze({ compound: 0.5, other: 0 }),
    muscle: Object.freeze({ compound: 0.25, other: 0.1 }),
    general: Object.freeze({ compound: 0.25, other: 0 }),
  }),
  /** Sets per exercise, by level. */
  setsPerExercise: Object.freeze({
    compound: Object.freeze({ beginner: 3, intermediate: 3, advanced: 4 }),
    other: Object.freeze({ beginner: 2, intermediate: 3, advanced: 3 }),
  }),
  minSets: 2,
  /** Rest between sets in seconds, by goal. */
  restSeconds: Object.freeze({
    compound: Object.freeze({ strength: 180, muscle: 120, general: 90 }),
    other: Object.freeze({ strength: 90, muscle: 60, general: 45 }),
  }),
  /** Seconds a set takes, a held position (plank) counts its hold time instead. */
  workSecondsPerSet: 45,
  holdSeconds: Object.freeze({ beginner: 30, intermediate: 40, advanced: 45 }),
  /** Seconds to get set up for an exercise. */
  transitionSeconds: 60,
  maxExercises: 8,
  /** The most exercises in one session that mainly work the same muscle. */
  perMuscleMax: 2,
  defaultMinutes: 30,
  minutesRange: Object.freeze({ min: 10, max: 120 }),
  /** The times the screen offers. */
  minutesOptions: Object.freeze([15, 30, 45, 60]),
});

/** What a person can train with: a set of the equipment words in the library (lib/exerciseLibrary.js EQUIPMENT). Bodyweight needs nothing. */
export const EQUIPMENT_PRESETS = Object.freeze({
  gym: Object.freeze([...EQUIPMENT]),
  dumbbells: Object.freeze(['dumbbell', 'bench']),
  bodyweight: Object.freeze([]),
});
export const EQUIPMENT_LABELS = Object.freeze({ gym: 'Full gym', dumbbells: 'Dumbbells and a bench', bodyweight: 'No equipment' });

/** The line the session screen shows under the session, so the engine is never presented as more than it is. */
export const SESSION_DISCLAIMER = 'Built on common strength-training guidelines and adjusted to what you log. Not clinically validated and not medical advice.';

const GOAL_LABELS = Object.freeze({ strength: 'Strength', muscle: 'Build Muscle', general: 'General Fitness' });

// ---------------------------------------------------------------------------------------------------------------------------------
// What the last two weeks of workouts say

/**
 * The sets each muscle got from the workouts of the last 7 days, the 7 days before that, and in how many workouts of the last 7 days it got at
 * least `sessionMinSets`: { thisWeek: { muscle: sets }, lastWeek: { muscle: sets }, sessions: { muscle: count } }. Sets are the effective sets of
 * lib/muscleRecovery.js workoutLoads (Hard counts 1, OK 0.6, Easy 0.3; a helper muscle counts half). A workout dated in the future, or with no
 * date, counts for nothing.
 */
export function weeklyVolume({ workouts, now = new Date() } = {}) {
  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : Date.now();
  const thisWeek = {};
  const lastWeek = {};
  const sessions = {};
  (Array.isArray(workouts) ? workouts : []).forEach((w) => {
    const t = workoutTime(w);
    if (t === null || t > nowMs) return;
    const age = (nowMs - t) / DAY_MS;
    if (age >= 14) return;
    const loads = workoutLoads(w);
    Object.entries(loads).forEach(([muscle, sets]) => {
      if (age < 7) {
        thisWeek[muscle] = (thisWeek[muscle] || 0) + sets;
        if (sets >= SESSION_RULES.sessionMinSets) sessions[muscle] = (sessions[muscle] || 0) + 1;
      } else {
        lastWeek[muscle] = (lastWeek[muscle] || 0) + sets;
      }
    });
  });
  return { thisWeek, lastWeek, sessions };
}

/**
 * The rung each bodyweight ladder is on: the one the person did most recently, { ladderName: rung }. An exercise marked not done, with no sets
 * logged, does not count. Newest workout first wins.
 */
export function currentRungs(workouts) {
  const dated = (Array.isArray(workouts) ? workouts : [])
    .map((w) => ({ w, t: workoutTime(w) }))
    .filter((x) => x.t !== null)
    .sort((a, b) => b.t - a.t);
  const rungs = {};
  dated.forEach(({ w }) => {
    (Array.isArray(w.exercises) ? w.exercises : []).forEach((ex) => {
      if (!ex || typeof ex !== 'object') return;
      const logged = Array.isArray(ex.performed) && ex.performed.length > 0;
      if (ex.done === false && !logged) return;
      const found = typeof ex.name === 'string' ? findExercise(ex.name) : null;
      if (found && found.ladder && !(found.ladder.name in rungs)) rungs[found.ladder.name] = found.ladder.rung;
    });
  });
  return rungs;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Picking

const rankOf = (level) => LEVELS.indexOf(level);

// With no history on a ladder: the hardest rung that is easier than the person's level (the easiest rung for a beginner), so they start below
// their level and climb as the load rules say.
function startingRung(ladderName, level) {
  const rungs = getLadder(ladderName);
  if (rungs.length === 0) return 0;
  const easier = rungs.filter((e) => rankOf(e.difficulty) < rankOf(level));
  return (easier.length > 0 ? easier[easier.length - 1] : rungs[0]).ladder.rung;
}

function resolveEquipment(value) {
  if (value === undefined || value === null) return EQUIPMENT_PRESETS.gym;
  if (typeof value === 'string') return Object.prototype.hasOwnProperty.call(EQUIPMENT_PRESETS, value) ? EQUIPMENT_PRESETS[value] : [];
  return Array.isArray(value) ? value : [];
}

function resolveMinutes(value) {
  const { minutesRange, defaultMinutes } = SESSION_RULES;
  return finite(value) && value > 0 ? clamp(Math.round(value), minutesRange.min, minutesRange.max) : defaultMinutes;
}

/** The minutes the profile's preferred session length stands for ("45min" is 45, "60min+" is 60); the default when it is not one of the times offered. */
export function minutesFromPreference(text) {
  const found = typeof text === 'string' ? text.match(/\d+/) : null;
  const minutes = found ? Number(found[0]) : NaN;
  return SESSION_RULES.minutesOptions.includes(minutes) ? minutes : SESSION_RULES.defaultMinutes;
}

const textList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x !== '') : []);

const timedCache = new Map();
const isTimed = (e) => {
  if (!timedCache.has(e.id)) timedCache.set(e.id, describeLift(e.name).timed);
  return timedCache.get(e.id);
};

const minutesOf = (workSeconds, restSeconds, sets) => (sets * (workSeconds + restSeconds) + SESSION_RULES.transitionSeconds) / 60;
const oneDecimal = (v) => Math.round(v * 10) / 10;

function nameFor(planned) {
  const ranked = Object.entries(planned)
    .filter(([, sets]) => sets > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (ranked.length === 0) return 'Session';
  const top = ranked[0][1];
  const lead = ranked.filter(([, sets]) => sets >= top * 0.5);
  if (lead.length > 3) return 'Full Body';
  const labels = lead.slice(0, 3).map(([m]) => muscleLabel(m));
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * Everything pickSession and swapOptions share: which exercises are allowed and ready, and the working of value, pace, fit and reason that depends on
 * what has been planned so far (`commit` adds a pick to that). The answer is { done } when no session can be built (done is the answer to give),
 * else { ctx }.
 */
function prepare(options) {
  const o = options && typeof options === 'object' ? options : {};
  const rules = SESSION_RULES;
  const level = levelKey(o.level);
  const goal = GOALS.includes(o.goal) ? o.goal : 'general';
  const have = new Set(resolveEquipment(o.equipment));
  const injuries = textList(o.injuries);
  const excluded = new Set(textList(o.excluded));
  const budget = resolveMinutes(o.minutes);
  const recovery = o.recovery && typeof o.recovery === 'object' ? o.recovery : {};
  const volume = o.volume && typeof o.volume === 'object' ? o.volume : {};
  const thisWeek = volume.thisWeek && typeof volume.thisWeek === 'object' ? volume.thisWeek : {};
  const lastWeek = volume.lastWeek && typeof volume.lastWeek === 'object' ? volume.lastWeek : {};
  const weekSessions = volume.sessions && typeof volume.sessions === 'object' ? volume.sessions : {};
  const rungs = o.ladderRungs && typeof o.ladderRungs === 'object' ? o.ladderRungs : {};
  const weights = o.weights && typeof o.weights === 'object' ? o.weights : {};
  const aim = rules.weeklySets.aim[level];

  const num = (map, m) => (finite(map[m]) && map[m] > 0 ? map[m] : 0);
  const recoveryOf = (m) => (finite(recovery[m]) ? clamp(recovery[m], 0, 100) : 100);
  const capOf = (m) => clamp(Math.ceil(num(lastWeek, m) * rules.maxWeeklyRise), rules.weeklySets.min, rules.weeklySets.max);

  const result = (status, message, extra = {}) => ({
    status, message, name: 'Session', goal, level, minutes: 0, totalSets: 0, exercises: [], leftOutFor: [], ...extra,
  });

  // 1. What is allowed
  const leftOut = [];
  const allowed = [];
  LIBRARY.forEach((e) => {
    if (excluded.has(e.id) || excluded.has(feedbackKey(e)) || e.pattern === 'conditioning') return;
    if (!e.equipment.every((q) => q === 'bodyweight' || have.has(q))) return;
    if (!e.ladder && rankOf(e.difficulty) > rankOf(level)) return;
    const hit = blockedBy(e, injuries);
    if (hit.length > 0) {
      hit.forEach((id) => { if (!leftOut.includes(id)) leftOut.push(id); });
      return;
    }
    allowed.push(e);
  });

  // ... one rung of each ladder: the rung the person is on, or the nearest easier one they can do
  const ladders = new Map();
  allowed.forEach((e) => {
    if (!e.ladder) return;
    if (!ladders.has(e.ladder.name)) ladders.set(e.ladder.name, []);
    ladders.get(e.ladder.name).push(e);
  });
  const chosenRung = new Map();
  ladders.forEach((members, name) => {
    const known = finite(rungs[name]);
    const target = known ? rungs[name] : startingRung(name, level);
    const atOrBelow = members.filter((m) => m.ladder.rung <= target).sort((a, b) => a.ladder.rung - b.ladder.rung);
    const chosen = atOrBelow.length > 0 ? atOrBelow[atOrBelow.length - 1] : null;
    // With nothing done on it yet, a ladder whose easiest rung is harder than the person's level (the pike push-up for a beginner) is left out.
    chosenRung.set(name, chosen && (known || rankOf(chosen.difficulty) <= rankOf(level)) ? chosen : null);
  });
  const pool = allowed.filter((e) => !e.ladder || chosenRung.get(e.ladder.name) === e);

  if (pool.length === 0) {
    const because = excluded.size > 0 ? 'your equipment, your level, the injuries you reported and the exercises you excluded' : 'your equipment, your level and the injuries you reported';
    return { done: result('limited', `Nothing in the exercise library fits ${because}.`, { leftOutFor: leftOut }) };
  }

  // 2. Who is ready
  const ready = pool.filter((e) => e.primary.every((m) => recoveryOf(m) >= rules.readyRecovery));
  if (ready.length === 0) {
    return { done: result('rest', 'The muscles you can train with your equipment are still recovering. A rest day, or an easy walk, is the better choice today.', { leftOutFor: leftOut }) };
  }

  // 3-5. What is missing, goal, and filling the time
  const planned = {};
  const plannedMain = {};
  const sessionCount = (m) => (finite(weekSessions[m]) ? weekSessions[m] : 0);
  const plannedOf = (m) => planned[m] || 0;
  const compoundOf = (e) => e.compound && !isTimed(e);

  const needOf = (m) => {
    const volumeNeed = Math.max(0, 1 - (num(thisWeek, m) + plannedOf(m)) / aim);
    const sessions = sessionCount(m);
    const frequency = plannedOf(m) > 0 ? 0 : sessions === 0 ? rules.frequencyBonus.none : sessions === 1 ? rules.frequencyBonus.once : 0;
    return Math.max(rules.needFloor, volumeNeed + frequency);
  };
  // What the muscles an exercise works count for when counting sets: 1 for a main muscle, half for a helper.
  const shares = (e) => {
    const out = {};
    e.primary.forEach((m) => { out[m] = 1; });
    e.secondary.forEach((m) => { out[m] = 0.5; }); // the library never lists a muscle as both (data/exerciseLibrary tests)
    return out;
  };
  const weightOf = (m) => (finite(rules.muscleWeight[m]) ? rules.muscleWeight[m] : 0);
  // What the person's feedback makes the exercise's score (lib/trainingFeedback.js weightsFor); 1 for no feedback. Kept inside the range the feedback
  // rules can produce, so a wrong number handed in can never swamp everything else.
  const feedbackOf = (e) => {
    const w = weights[feedbackKey(e)];
    return finite(w) && w > 0 ? clamp(w, FEEDBACK_RULES.less * FEEDBACK_RULES.floor, FEEDBACK_RULES.more) : 1;
  };
  // How much an exercise is worth now: what it would give each muscle it mainly works (and, less, each it helps), by how much that muscle needs
  // it, matters and is rested.
  const valueOf = (e) => {
    let total = 0;
    e.primary.forEach((m) => { total += weightOf(m) * needOf(m) * (recoveryOf(m) / 100); });
    e.secondary.forEach((m) => { total += rules.secondaryWeight * weightOf(m) * needOf(m) * (recoveryOf(m) / 100); });
    const bonus = rules.goalBonus[goal][compoundOf(e) ? 'compound' : 'other'];
    const discount = e.bodyweight && goal !== 'general' ? rules.bodyweightShare : 1;
    const staple = rules.staples.includes(e.id) ? 1 + rules.stapleBonus : 1;
    return total * (1 + bonus) * discount * staple * feedbackOf(e);
  };
  const paceOf = (e) => {
    const kind = compoundOf(e) ? 'compound' : 'other';
    return {
      work: isTimed(e) ? rules.holdSeconds[level] : rules.workSecondsPerSet,
      rest: rules.restSeconds[kind][goal],
      sets: rules.setsPerExercise[kind][level],
    };
  };
  const pickedPrimary = {};
  const pickedPattern = {};
  const patternMax = (pattern) => (pattern in rules.perPatternMax ? rules.perPatternMax[pattern] : rules.perPatternMax.default);
  let remaining = budget;

  // The most sets (at most the usual number, at least minSets) that fit the time left and every muscle's weekly limit; 0 when none do.
  const setsThatFit = (e) => {
    const pace = paceOf(e);
    const share = shares(e);
    const fitsCaps = (sets) => Object.entries(share).every(([m, s]) => num(thisWeek, m) + plannedOf(m) + sets * s <= capOf(m) + 1e-9);
    for (let sets = pace.sets; sets >= rules.minSets; sets -= 1) {
      if (minutesOf(pace.work, pace.rest, sets) <= remaining + 1e-9 && fitsCaps(sets)) return sets;
    }
    return 0;
  };

  // The sets the exercise would get if it were added now: 0 when a muscle or a pattern already has its share, or there is no time or room left.
  const fitFor = (e) => {
    if (e.primary.some((m) => (pickedPrimary[m] || 0) >= rules.perMuscleMax)) return 0;
    if ((pickedPattern[e.pattern] || 0) >= patternMax(e.pattern)) return 0;
    return setsThatFit(e);
  };

  // The line that says why, and the figures it is made from: the muscle the exercise is picked for (the one that most needs it, by what
  // matters), how rested it is, and how far it still is from this week's aim counting what this session has already given it. The figures
  // ({ muscle, recovered, done, short, aim }) are kept on the pick, so whatever words the reason later gets (the AI's, in Step 6) can be
  // checked against the numbers the engine used.
  const whyFor = (e) => {
    const main = e.primary.reduce((best, m) => (weightOf(m) * needOf(m) > weightOf(best) * needOf(best) + 1e-9 ? m : best), e.primary[0]);
    const recovered = Math.round(recoveryOf(main));
    const done = Math.round(num(thisWeek, main));
    const short = Math.round(aim - num(thisWeek, main) - plannedOf(main));
    const restText = recovered >= 100 ? 'fully rested' : `about ${recovered}% recovered`;
    const volumeText = done === 0 && plannedOf(main) === 0
      ? `no sets logged this week (aim ${aim})`
      : short >= 1
        ? `${short} ${short === 1 ? 'set' : 'sets'} short of this week's ${aim}-set aim`
        : `at this week's ${aim}-set aim, a top-up`;
    return { reason: `${muscleLabel(main)}: ${restText}, ${volumeText}.`, facts: { muscle: main, recovered, done, short, aim } };
  };

  // The exercise as a pick: what it is, how many sets, and why, worked out from what has been planned so far (so before it is committed).
  const makePick = (e, sets) => {
    const pace = paceOf(e);
    const why = whyFor(e);
    return {
      id: e.id,
      name: e.name,
      sets,
      role: compoundOf(e) ? 'compound' : 'accessory',
      primary: [...e.primary],
      secondary: [...e.secondary],
      bodyweight: e.bodyweight,
      timed: isTimed(e),
      workSeconds: pace.work,
      restSeconds: pace.rest,
      reason: why.reason,
      facts: why.facts,
    };
  };

  // Counts the exercise, at `sets`, against what is planned: the muscles it works (so the next one is worth less to them), its pattern and the time.
  const commit = (e, sets, workSeconds, restSeconds) => {
    Object.entries(shares(e)).forEach(([m, share]) => { planned[m] = plannedOf(m) + sets * share; });
    e.primary.forEach((m) => {
      pickedPrimary[m] = (pickedPrimary[m] || 0) + 1;
      plannedMain[m] = (plannedMain[m] || 0) + sets;
    });
    pickedPattern[e.pattern] = (pickedPattern[e.pattern] || 0) + 1;
    remaining -= minutesOf(workSeconds, restSeconds, sets);
  };

  return {
    ctx: {
      goal, level, ready, leftOut, plannedMain, recovery, recoveryOf, result, valueOf, compoundOf, fitFor, makePick, commit,
    },
  };
}

// The exercise as the session shows it: the pick plus the reps (or hold) from the goal and the fields the load rules fill in later.
function toExercise(p, goal) {
  const lib = findExercise(p.name);
  // With no history the exercise is its first session, which the load rules make a light day for a main lift.
  const range = repRangeFor(goal, describeLift(p.name).main ? 'light' : null, { bodyweight: p.bodyweight });
  return {
    ...p,
    repRange: p.timed ? null : range,
    reps: p.timed ? null : `${range.min}-${range.max}`,
    holdSeconds: p.timed ? p.workSeconds : null,
    weight: null,
    unit: null,
    dayType: null,
    deload: false,
    target: null,
    detail: null,
    muscleGroups: lib ? [...lib.primary, ...lib.secondary] : [],
  };
}

/**
 * Today's session.
 *
 * @param {object} p
 * @param {Record<string, number>} [p.recovery]  lib/muscleRecovery.js calculateMuscleRecovery's answer ({ muscle: 0 to 99 }); a muscle missing is fully recovered
 * @param {{ thisWeek: object, lastWeek: object, sessions: object }} [p.volume]  weeklyVolume's answer
 * @param {string} [p.goal]           'strength', 'muscle' or 'general' (lib/loadRules.js goalForLoad); anything else is general
 * @param {string} [p.level]          beginner, intermediate or advanced; anything else is a beginner
 * @param {string|string[]} [p.equipment]  a preset ('gym', 'dumbbells', 'bodyweight') or a list of equipment words; no value is 'gym'
 * @param {string[]} [p.injuries]     injury ids (lib/injuryRules.js)
 * @param {string[]} [p.excluded]     exercise ids never to pick; "ladder:<name>" (lib/trainingFeedback.js feedbackKey) leaves a whole bodyweight ladder out
 * @param {Record<string, number>} [p.weights]  what the person's feedback multiplies an exercise's score by ({ key: multiplier }, lib/trainingFeedback.js weightsFor);
 *                                    an exercise missing counts 1. It only changes the order of what is allowed and ready; it lets nothing through and changes no number
 * @param {number} [p.minutes]        the time available
 * @param {Record<string, number>} [p.ladderRungs]  currentRungs' answer
 * @returns {{
 *   status: 'ok'|'rest'|'limited'|'full', message: string|null, name: string, goal: string, level: string, minutes: number, totalSets: number,
 *   exercises: object[], leftOutFor: string[],
 * }}
 *   status 'rest': everything the equipment and injuries allow is still recovering; 'limited': nothing in the library fits the equipment, level and
 *   injuries; 'full': every muscle that is ready has reached its weekly limit.
 */
export function pickSession(options = {}) {
  const prepared = prepare(options);
  if (prepared.done) return prepared.done;
  const {
    goal, level, ready, leftOut, plannedMain, recovery, recoveryOf, result, compoundOf, fitFor, valueOf, makePick, commit,
  } = prepared.ctx;
  const rules = SESSION_RULES;

  const picks = [];
  let live = ready.slice();
  while (picks.length < rules.maxExercises && live.length > 0) {
    // Drop what can no longer be picked (a muscle or a pattern already has its share, no time, or at the weekly limit); that only gets truer.
    const next = [];
    const fitted = new Map();
    live.forEach((e) => {
      const sets = fitFor(e);
      if (sets === 0) return;
      fitted.set(e.id, sets);
      next.push(e);
    });
    live = next;
    if (live.length === 0) break;
    // The most valuable; a tie goes to a compound lift, then to the one that needs less equipment, then to the earlier id, so the answer never wobbles.
    let best = null;
    let bestValue = -1;
    live.forEach((e) => {
      const v = valueOf(e);
      const tie = best !== null && Math.abs(v - bestValue) <= 1e-9;
      const beatsOnTie = tie && (compoundOf(e) !== compoundOf(best)
        ? compoundOf(e)
        : e.equipment.length !== best.equipment.length ? e.equipment.length < best.equipment.length : e.id < best.id);
      if (best === null || (!tie && v > bestValue) || beatsOnTie) { best = e; bestValue = v; }
    });
    const pick = makePick(best, fitted.get(best.id));
    picks.push(pick);
    commit(best, pick.sets, pick.workSeconds, pick.restSeconds);
    live = live.filter((e) => e.id !== best.id);
  }

  // Nothing fits only when every muscle that is ready is at its weekly limit: the shortest allowed session (10 minutes) always has room for one
  // exercise at its fewest sets.
  if (picks.length === 0) {
    return result('full', "Every muscle that is ready has already reached this week's set limit. Resting, or easy cardio, is the better choice today.", { leftOutFor: leftOut });
  }

  // Compound lifts first, in the order they were picked, then the rest.
  const ordered = [...picks.filter((p) => p.role === 'compound'), ...picks.filter((p) => p.role !== 'compound')];
  const exercises = ordered.map((p) => toExercise(p, goal));

  // The muscles still under the readiness line, least recovered first: what the words around the session may mention. Not a pick.
  const tired = Object.keys(recovery)
    .filter((m) => recoveryOf(m) < rules.readyRecovery) // a figure that is not a number counts as fully recovered
    .map((m) => ({ muscle: m, recovered: Math.round(recoveryOf(m)) }))
    .sort((a, b) => a.recovered - b.recovered || (a.muscle < b.muscle ? -1 : 1));

  return finishSession({ status: 'ok', message: null, name: nameFor(plannedMain), goal, level, exercises, leftOutFor: leftOut, tired });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Swapping one exercise

/**
 * The exercises the engine would put in the place of one in the session: up to `limit` (3 by default), best first. Everything else in the session
 * stays exactly as it is and is counted against the muscles, the patterns and the time, so what is offered fits the session as it now stands. An
 * alternative has to train one of the muscles the exercise mainly works, be allowed (equipment, level, injuries, exercises excluded), be ready, not
 * already be in the session, and fit the time and the weekly limits; the exercise being replaced is never offered back. Each is a full exercise as
 * pickSession gives them (sets, reps, the reason worked out for its place), without a weight; services/sessionService.js adds the target.
 * Pass the same options the session was picked with. An empty list when there is nothing to offer, or the exercise is not in the session.
 */
export function swapOptions(options, session, exerciseId, { limit = 3 } = {}) {
  if (!session || session.status !== 'ok' || !Array.isArray(session.exercises)) return [];
  const target = session.exercises.find((x) => x && x.id === exerciseId);
  if (!target) return [];
  const prepared = prepare(options);
  if (prepared.done) return [];
  const {
    goal, ready, valueOf, compoundOf, fitFor, makePick, commit,
  } = prepared.ctx;
  const inSession = new Set(session.exercises.map((x) => x && x.id));
  session.exercises.forEach((x) => {
    const lib = x && x.id !== exerciseId ? getExercise(x.id) : null;
    if (lib) commit(lib, x.sets, x.workSeconds, x.restSeconds);
  });
  const muscles = new Set(Array.isArray(target.primary) ? target.primary : []);
  const compare = (a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (Math.abs(va - vb) > 1e-9) return vb - va;
    if (compoundOf(a) !== compoundOf(b)) return compoundOf(a) ? -1 : 1;
    if (a.equipment.length !== b.equipment.length) return a.equipment.length - b.equipment.length;
    return a.id < b.id ? -1 : 1;
  };
  const wanted = finite(limit) ? Math.max(0, Math.floor(limit)) : 3;
  return ready
    .filter((e) => !inSession.has(e.id) && e.primary.some((m) => muscles.has(m)) && fitFor(e) > 0)
    .sort(compare)
    .slice(0, wanted)
    .map((e) => toExercise(makePick(e, fitFor(e)), goal));
}

// The session with the person's change in it: compound lifts first again, the name and the totals worked out again from what is in it, and marked
// `edited`, so nothing that was said about the session as it was picked (the AI's words on it) is taken for what it now is.
function reshape(session, list) {
  const plannedMain = {};
  list.forEach((x) => (Array.isArray(x.primary) ? x.primary : []).forEach((m) => { plannedMain[m] = (plannedMain[m] || 0) + x.sets; }));
  const exercises = [...list.filter((x) => x.role === 'compound'), ...list.filter((x) => x.role !== 'compound')];
  return finishSession({ ...session, name: nameFor(plannedMain), exercises, edited: true });
}

/** A new session with `replacement` (an exercise from swapOptions) in place of the one with `exerciseId`; the same session when that is not in it. */
export function replaceExercise(session, exerciseId, replacement) {
  if (!session || session.status !== 'ok' || !Array.isArray(session.exercises) || !replacement || typeof replacement !== 'object') return session;
  if (!session.exercises.some((x) => x && x.id === exerciseId)) return session;
  return reshape(session, session.exercises.map((x) => (x && x.id === exerciseId ? replacement : x)));
}

/** A new session without the exercise with `exerciseId`; null when that leaves nothing, and the same session when it is not in it. */
export function dropExercise(session, exerciseId) {
  if (!session || session.status !== 'ok' || !Array.isArray(session.exercises)) return session;
  if (!session.exercises.some((x) => x && x.id === exerciseId)) return session;
  const rest = session.exercises.filter((x) => x && x.id !== exerciseId);
  return rest.length === 0 ? null : reshape(session, rest);
}

// The totals that depend on the exercises, worked out in one place so attachTargets can redo them when it changes the sets.
function finishSession(session) {
  const minutes = session.exercises.reduce((sum, x) => sum + minutesOf(x.workSeconds, x.restSeconds, x.sets), 0);
  const totalSets = session.exercises.reduce((sum, x) => sum + x.sets, 0);
  return { ...session, minutes: Math.round(minutes), exactMinutes: oneDecimal(minutes), totalSets };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Targets from the load rules

/**
 * Adds the weight and reps from the load rules to a session's exercises. `prescriptions` is { exerciseId: prescribeNext's answer } for the
 * exercises that have a history to build on; an exercise without one keeps the goal's rep range and no weight. A deload week has fewer sets.
 * A new session is returned; the one passed in is not changed.
 */
export function attachTargets(session, prescriptions, { unit = 'lb' } = {}) {
  if (!session || !Array.isArray(session.exercises)) return session;
  const exercises = session.exercises.map((x) => {
    const p = prescriptions && typeof prescriptions === 'object' ? prescriptions[x.id] : null;
    if (!p || typeof p !== 'object' || x.timed) return x;
    const text = prescriptionText(p, { bodyweight: x.bodyweight, unit });
    const range = p.repRange && p.repRange.max > 0 ? { min: p.repRange.min, max: p.repRange.max } : x.repRange;
    const sets = p.deload && finite(p.setsFactor) ? Math.max(1, Math.round(x.sets * p.setsFactor)) : x.sets;
    return {
      ...x,
      sets,
      repRange: range,
      reps: range ? `${range.min}-${range.max}` : x.reps,
      weight: x.bodyweight || !finite(p.weight) ? null : p.weight,
      unit: x.bodyweight || !finite(p.weight) ? null : unit,
      dayType: p.dayType || null,
      deload: p.deload === true,
      target: text ? text.target.replace(/^Today's target: /, '') : null,
      detail: text ? text.detail : null,
    };
  });
  return finishSession({ ...session, exercises });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Saving it as a workout

/** The session as a workout the app can save and start (store/workoutStore.js addWorkout), in the shape app/workout/quick.jsx saves. */
export function sessionToWorkout(session) {
  if (!session || session.status !== 'ok' || !Array.isArray(session.exercises)) return null;
  const minutes = Math.max(5, session.minutes);
  return {
    name: session.name,
    description: `Built from your recovery and this week's training: ${session.exercises.length} exercises, about ${minutes} minutes.`,
    category: GOAL_LABELS[session.goal] || 'General Fitness',
    difficulty: session.level,
    duration: minutes,
    xpReward: calculateXpReward(session.level, minutes), // the formula Quick Workout and the Coach use, so the same length earns the same XP
    exercises: session.exercises.map((x) => ({
      name: x.name,
      sets: x.sets,
      ...(x.timed ? { duration: x.holdSeconds } : { reps: x.reps }),
      restSeconds: x.restSeconds,
      muscleGroups: [...x.muscleGroups],
    })),
    source: 'engine_session',
  };
}

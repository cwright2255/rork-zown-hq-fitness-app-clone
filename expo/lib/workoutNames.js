// lib/workoutNames.js
//
// The names of generated workouts and programs. A workout used to be called whatever the AI wrote as its focus ("Trap Bar Deadlift Day"), or, for the
// training engine's sessions, the muscles it works ("Chest, Back and Core"). Now each one gets a short, playful or energetic name from a fixed list
// ("Quad Squad", "Plank You, Next", "Shift & Lift"), picked to fit what the workout trains. The muscles stay on screen as a smaller line, so a name is
// never the only thing that says what the workout is.
//
// Why a fixed list and not the AI: the same workout always gets the same name, a name can never be an exercise or a claim, it costs nothing, it works
// offline, and nothing on the server has to change.
//
// The pick is a hash of a seed, so it is the same on every phone and every time: nothing here uses chance or the clock. Pure functions, no React and
// no stores.
import { findExercise } from './exerciseLibrary';

/**
 * The names, by what a workout trains. Every list has at least 12 names (the engine's four ways to train the same muscles are told apart by `variant`,
 * 0 to 11, so those four never get the same name), and no name is on two lists. __tests__/workoutNames.test.js holds the rules every name follows:
 * short, no digits, not the name of an exercise, nothing a plan or a result could be mistaken for.
 */
export const NAME_POOLS = Object.freeze({
  legs: Object.freeze([
    'Leg Day Royalty', 'Quad Squad', 'Squat Goals', 'Lunge Life', 'Leg-acy Builders', 'Pillars of Power', 'Hamstring Hustle',
    'Leg Day or Bust', 'Ground Control', 'Thunder Legs', 'Stairway to Quads', 'Strong Foundations', 'Walking Tall', 'Power Pins',
  ]),
  glutes: Object.freeze([
    'Glute Gains', 'Thrust Hustle', 'Rear Admiral', 'Back It Up', 'Seat of Power', 'Hip Hip Hooray', 'Glute Camp', 'Bridge Builders',
    'Hinge & Shine', 'Thrust Fund', 'Glute Guardians', 'Power Posterior',
  ]),
  push: Object.freeze([
    'Press Conference', 'Chest Fest', 'Push Notification', 'Shoulder to Shine', 'Press Play', 'Bench Mark', 'Pec Appeal', 'Push Your Limits',
    'Delt Force', 'Pec-tacular', 'Door Opener', 'Pushing Boundaries', 'Press Forward', 'Chest Pounders',
  ]),
  pull: Object.freeze([
    'Back in Action', 'Pull Request', 'Lat Night', 'Row the Boat', 'Reel It In', 'Lat Attack', 'Pull Your Weight', 'Backbone Builders',
    'Hang Time', 'Wingspan', 'Draw the Bow', 'Rowdy Rows', 'Back Attack', 'Strong Back Story',
  ]),
  upper: Object.freeze([
    'Upper Hand', 'Top Shelf', 'Upper Echelon', 'Above the Belt', 'Top Notch Torso', 'Upper Cut', 'Torso Tune-Up', 'Top Floor',
    'Skyline Session', 'Upper Class', 'Heavy Hitters', 'Upper Deck', 'Top Billing',
  ]),
  lower: Object.freeze([
    'Lower the Boom', 'Foundation Day', 'Ground Game', 'Down Under', 'Bottom Line', 'Base Camp', 'Lower Power', 'Deep Roots',
    'Basement Gains', 'Underdog Day', 'Low and Mighty', 'Floor Show',
  ]),
  core: Object.freeze([
    'Plank You, Next', 'Abs Fab', 'Core Values', 'Crunch Time', 'Core Curriculum', 'Midsection Mastery', 'Center Stage', 'Core Revival',
    'Ab-solutely', 'Trunk Show', 'Lunch Crunch', 'Brace Yourself', 'Core Competency', 'Middle Ground',
  ]),
  arms: Object.freeze([
    'Arm Candy', 'Flex Appeal', 'Bicep Bash', 'Tricep Treat', 'Sleeve Stretchers', 'Biceps & Brunch', 'Armed & Ready', 'Curl Power',
    'Pump Season', 'Sleeve Busters', 'Arm Day Anthem', 'Hammer Time',
  ]),
  fullBody: Object.freeze([
    'Shift & Lift', 'Head to Toe Show', 'Total Package', 'Whole Lotta Gains', 'Full Send', 'All In', 'Top to Bottom',
    'Full Tilt', 'Move, Shake, Lift', 'Whole Body Hustle', 'Gym and Juice', 'Fit Happens', 'The Whole Enchilada', 'Head Over Heels',
  ]),
  cardio: Object.freeze([
    'Burpee Junkies', 'Heart Rate Party', 'Pulse Check', 'Power Pulse', 'Cardio Carnival', 'Sweat Equity', 'Lung Buster', 'Beat the Clock',
    'Engine Room', 'Pace Setter', 'Heart Pounder', 'Breathless', 'Run It Back', 'Sweat Fest',
  ]),
  strength: Object.freeze([
    'Iron Edge', 'Heavy Metal', 'Barbell Bash', 'Strong Suit', 'Iron Will', 'Lift Off', 'Weight for It', 'Plate Expectations',
    'Deadlift & Chill', 'No Pain, No Champagne', 'Heavy Lifting', 'Stronger Than Yesterday', 'Rack Attack',
  ]),
  recovery: Object.freeze([
    'Reset & Restore', 'Stretch Goals', 'Easy Does It', 'Recharge Day', 'Flex & Flow', 'Loosen Up', 'Unwind Time', 'Gentle Giants',
    'Cool Down Crown', 'Slow and Steady', 'Breathe Easy', 'Restoration Station', 'Limber Up',
  ]),
});

/** The names of whole 7-day plans, by what the person is working toward. */
export const PLAN_POOLS = Object.freeze({
  strength: Object.freeze(['Iron Season', 'Heavy Rotation', 'Strong Week', 'Lift Off Week', 'Power Up', 'The Strength Sprint', 'Built Different', 'Barbell Chronicles']),
  muscle: Object.freeze(['Gains Season', 'Growth Spurt', 'Pump Week', 'Mass Appeal', 'Muscle Memory Lane', 'Big Week Energy', 'Growth Mode', 'Size Up Week']),
  lose: Object.freeze(['Lean Machine', 'Light It Up', 'Torch Mode', 'Heat Wave', 'Spark Week', 'Fire Starter', 'Sweat Season', 'Burn Bright']),
  endurance: Object.freeze(['Go the Distance', 'Stamina Quest', 'The Long Game', 'Pace Yourself', 'Endurance Express', 'Second Wind', 'Mile Makers', 'Heart & Soul Week']),
  mobility: Object.freeze(['Flow State', 'Limber Life', 'Bend, Don\'t Break', 'Move Well Week', 'Smooth Operator', 'Stretch Season', 'Fluid Motion', 'Loose Ends']),
  general: Object.freeze(['Seven Day Spark', 'Better Every Day', 'Week of Wins', 'Momentum Builder', 'Stronger by Sunday', 'Level Up Week', 'The Comeback Week', 'Fit Happens Week']),
});

export const FOCUS_KEYS = Object.freeze(Object.keys(NAME_POOLS));

// ---------------------------------------------------------------------------------------------------------------------------------
// Picking

// FNV-1a over the text's UTF-16 units: the same number on every device.
function hash(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const at = (pool, n) => pool[((n % pool.length) + pool.length) % pool.length];

// ---------------------------------------------------------------------------------------------------------------------------------
// What a workout trains

// The library's muscles (data/exerciseLibrary.js) and the group each belongs to.
const GROUP_OF = Object.freeze({
  quadriceps: 'legs', hamstrings: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  glutes: 'glutes',
  chest: 'push', shoulders: 'push', triceps: 'push',
  upper_back: 'pull', lats: 'pull', traps: 'pull', lower_back: 'pull', biceps: 'pull', forearms: 'pull',
  core: 'core',
});
const ARM_MUSCLES = new Set(['biceps', 'triceps', 'forearms']);

// A set of groups ('legs', 'glutes', 'push', 'pull', 'arms', 'core') as the one list of names that fits it.
function combine(groups) {
  const g = new Set(groups);
  // The trunk is along for most lifts, so it only names a workout that is about nothing else.
  if (g.size > 1) g.delete('core');
  // Arms alone are arms; next to anything bigger they are part of it.
  if (g.size > 1) g.delete('arms');
  if (g.size === 0) return 'fullBody';
  const lower = g.has('legs') || g.has('glutes');
  const upper = g.has('push') || g.has('pull') || g.has('arms');
  if (lower && upper) return 'fullBody';
  if (lower) return g.has('legs') && g.has('glutes') ? 'lower' : g.has('glutes') ? 'glutes' : 'legs';
  if (g.has('arms')) return 'arms';
  if (upper) return g.has('push') && g.has('pull') ? 'upper' : g.has('push') ? 'push' : 'pull';
  return 'core';
}

/**
 * Which list of names fits the muscles a workout mainly works (the library's muscle words: "chest", "upper_back", ...). More than three muscles,
 * or nothing known, is a full-body workout.
 */
export function focusFromMuscles(muscles) {
  const list = [...new Set((Array.isArray(muscles) ? muscles : []).filter((m) => typeof m === 'string' && m !== ''))];
  if (list.length === 0 || list.length > 3) return 'fullBody';
  if (list.every((m) => ARM_MUSCLES.has(m))) return 'arms';
  const groups = list.map((m) => GROUP_OF[m]).filter(Boolean);
  return groups.length === 0 ? 'fullBody' : combine(groups);
}

// A few exercise names that would be read wrongly word by word ("leg press" is not a push, "back squat" is not a pull), said as the muscles they work.
const PHRASES = [
  [/\bleg (?:press|curl|extension|raise)s?\b/g, ' legs '],
  [/\b(?:back|front|goblet|split|box|overhead) squats?\b/g, ' squat '],
  [/\bhip thrusts?\b/g, ' glutes '],
  [/\b(?:bench|chest|incline|decline) press(?:es)?\b/g, ' chest '],
  [/\b(?:hammer|bicep|biceps|preacher|concentration) curls?\b/g, ' biceps '],
  [/\b(?:back|lower back) extensions?\b/g, ' glutes '],
  [/\btrap bar\b/g, ' '], // the bar, not the trapezius
];

const FLAGS = [
  // Words that make a day about recovery whatever else is named; "rest" and "walk" only do when nothing else is.
  ['calm', /\b(?:mobility|stretch\w*|yoga|deload|flexib\w*|foam|restor\w*|recover\w*)\b/],
  ['rest', /\b(?:rest|off|walk)\b/],
  ['cardio', /\b(?:cardio|hiit|conditioning|intervals?|endurance|aerobic|metcon|circuit|runs?|running|cycling|bike|swim\w*|sprints?)\b/],
  ['fullBody', /\b(?:full|total|whole)[ -]?body\b/],
  ['lower', /\blower\b/],
  ['legs', /\b(?:legs?|quads?|quadriceps|hamstrings?|calf|calves|squats?|lunges?)\b/],
  ['glutes', /\b(?:glutes?|hips?|booty)\b/],
  ['hinge', /\b(?:deadlifts?|hinge|rdl|romanian|posterior)\b/],
  ['upper', /\bupper\b/],
  ['push', /\b(?:push|chest|pecs?|shoulders?|delts?|triceps?|bench|press|presses)\b/],
  ['pull', /\b(?:pull|back|lats?|rows?|biceps?|traps?)\b/],
  ['arms', /\b(?:arms?|curls?)\b/],
  ['core', /\b(?:core|abs?|abdominals?|planks?|midsection|trunk)\b/],
  ['strength', /\b(?:strength|power|heavy|barbell|lift|lifting|iron)\b/],
];

function flagsOf(text) {
  let t = String(text == null ? '' : text).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  PHRASES.forEach(([pattern, said]) => { t = t.replace(pattern, said); });
  const found = new Set();
  FLAGS.forEach(([key, pattern]) => { if (pattern.test(` ${t} `)) found.add(key); });
  return found;
}

// The main muscles of a list of exercise names: the muscles the library gives for the ones it knows, the most common first.
function musclesOfExercises(names) {
  const counts = {};
  (Array.isArray(names) ? names : []).forEach((n) => {
    const e = typeof n === 'string' ? findExercise(n) : null;
    if (e) e.primary.forEach((m) => { counts[m] = (counts[m] || 0) + 1; });
  });
  const top = Math.max(0, ...Object.values(counts));
  return Object.entries(counts).filter(([, c]) => c >= top / 2).map(([m]) => m).sort();
}

/**
 * Which list of names fits a written focus ("Upper Body Push", "Legs & Glutes", "Rest day") and, when the words do not say, the exercises under it.
 * Only the muscles and kinds of training are read from the text: an exercise's name in it ("Trap Bar Deadlift Day") is read for the muscles it
 * works, never used as a name.
 */
export function focusFromText(text, exerciseNames = []) {
  const f = flagsOf(text);
  const muscleFlags = ['upper', 'lower', 'legs', 'glutes', 'hinge', 'push', 'pull', 'arms', 'core'].filter((k) => f.has(k));
  if (f.has('calm') && !f.has('cardio')) return 'recovery';
  if (f.has('fullBody')) return 'fullBody';
  if (muscleFlags.length > 0) {
    const groups = [];
    if (f.has('lower') || f.has('hinge')) groups.push('legs', 'glutes');
    if (f.has('legs')) groups.push('legs');
    if (f.has('glutes')) groups.push('glutes');
    // "Upper Body" is a push and a pull; "Upper Body Push" is only the push.
    if (f.has('upper') && !f.has('push') && !f.has('pull')) groups.push('push', 'pull');
    if (f.has('push')) groups.push('push');
    if (f.has('pull')) groups.push('pull');
    if (f.has('arms')) groups.push('arms');
    if (f.has('core')) groups.push('core');
    return combine(groups);
  }
  if (f.has('cardio')) return 'cardio';
  if (f.has('rest')) return 'recovery';
  const fromExercises = musclesOfExercises(exerciseNames);
  if (fromExercises.length > 0) return focusFromMuscles(fromExercises);
  if (f.has('strength')) return 'strength';
  return 'fullBody';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The names

/**
 * The name for a session the training engine built (lib/sessionPicker.js). `muscles` are the ones it mainly works, so the same muscles get the same
 * name. `variant` (0 to 11) tells apart the ways of training the same muscles (a different time or equipment), which never share a name.
 */
export function titleForSession(options) {
  const { muscles, variant = 0 } = options && typeof options === 'object' ? options : {};
  const list = [...new Set((Array.isArray(muscles) ? muscles : []).filter((m) => typeof m === 'string' && m !== ''))].sort();
  const key = focusFromMuscles(list);
  const v = Number.isFinite(variant) ? Math.max(0, Math.floor(variant)) : 0;
  return at(NAME_POOLS[key], hash(`${key}|${list.join('+')}`) + v);
}

/**
 * One name for each day of a generated plan (`days`: [{ day, focus, exercises: [{ name }] }]), in order. Two days of a plan never share a name. `seed`
 * (the saved plan's id) makes the same plan always read the same, and a new plan read differently.
 */
export function titlesForPlan(days, options) {
  const seed = options && typeof options === 'object' && options.seed != null ? options.seed : '';
  const used = new Set();
  return (Array.isArray(days) ? days : []).map((day, i) => {
    const d = day && typeof day === 'object' ? day : {};
    const names = Array.isArray(d.exercises) ? d.exercises.map((x) => (x && typeof x === 'object' ? x.name : x)) : [];
    const key = focusFromText(typeof d.focus === 'string' ? d.focus : d.name, names);
    const pool = NAME_POOLS[key];
    const start = hash(`${seed}|${i}|${key}`);
    for (let step = 0; step < pool.length; step += 1) {
      const name = at(pool, start + step);
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    return at(pool, start); // every name on the list is already used in this plan
  });
}

/** Which list of plan names fits what the person is working toward (their goals as words or ids: "Build Muscle", "lose_weight"). */
export function planGoalKey(goals) {
  const list = Array.isArray(goals) ? goals : [goals];
  for (const g of list) {
    const t = ` ${String(g == null ? '' : g).toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
    if (/\b(?:muscle|hypertrophy|bulk\w*|size|mass)\b/.test(t)) return 'muscle';
    if (/\b(?:strength|strong|stronger|power)\b/.test(t)) return 'strength';
    if (/\b(?:lose|loss|weight|fat|cut|lean|tone|burn)\b/.test(t)) return 'lose';
    if (/\b(?:endurance|cardio|run|running|stamina|distance|marathon|aerobic)\b/.test(t)) return 'endurance';
    if (/\b(?:mobility|flexib\w*|stretch\w*|yoga|balance)\b/.test(t)) return 'mobility';
  }
  return 'general';
}

/** The name of a whole generated plan. */
export function titleForPlan(options) {
  const { seed = '', goals } = options && typeof options === 'object' ? options : {};
  const key = planGoalKey(goals);
  return at(PLAN_POOLS[key], hash(`${seed}|${key}`));
}

/**
 * The goals a saved plan was asked for, read back from the request it was made from (functions/src/index.js writes the request into the plan's record
 * as `prompt`: "... user with goals: Build Muscle, Strength. About the user: ..."), so the plan keeps its name when the person's goals change later.
 * An empty list when the request does not say.
 */
export function goalsFromPrompt(prompt) {
  const m = typeof prompt === 'string' ? prompt.match(/with goals: (.*?)\.(?: |$)/) : null;
  return m && m[1] ? m[1].split(',').map((g) => g.trim()).filter(Boolean) : [];
}

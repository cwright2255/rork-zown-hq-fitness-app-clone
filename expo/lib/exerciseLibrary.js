// lib/exerciseLibrary.js
//
// Reads the exercise library (data/exerciseLibrary.js): adds the two flags that follow from its fields, lists the allowed values, and
// finds an exercise from the name a program, the AI or a person typed.
//
// Name matching favors being right over finding something. A name that matches nothing is simply not in the library, and the caller
// carries on with what it had; a wrong match would put another exercise's muscles on the workout. So:
//   1. The name, with case, punctuation, hyphens and plurals ignored, is compared with every exercise name and alias. "Push-ups" is
//      "push up" is "Push Up".
//   2. If that finds nothing, equipment words are allowed to be dropped from the name ("Bodyweight Pull-Up" is "Pull-Up"), but only when
//      the exercise really is done with that equipment. "Machine Squat" is not "Barbell Back Squat" and "Barbell Push-Up" is not
//      "Push-Up", because a back squat is not done on a machine and a push-up is not done with a barbell. Words that change the exercise (weighted, assisted,
//      resistance band, single arm, and so on) are never dropped.
//   3. Otherwise the answer is null.
// Nothing here guesses from a part of a name: "Leg Curl" is not "Leg Press", and "Curl" alone is not any curl.
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

export const EQUIPMENT = [
  'bodyweight', 'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bands',
  'ez_bar', 'trap_bar', 'bench', 'pullup_bar', 'dip_station', 'rack', 'ab_wheel',
];
export const PATTERNS = [
  'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge', 'lunge',
  'isolation', 'core', 'carry', 'conditioning',
];
export const LEVELS = ['beginner', 'intermediate', 'advanced'];
/** Patterns that train one joint, the trunk or conditioning rather than a whole lift; every other pattern counts as a compound lift. */
const NOT_COMPOUND = ['isolation', 'core', 'conditioning'];

/**
 * Every exercise, as written in data/exerciseLibrary.js plus:
 *   bodyweight  true when it can be done with no equipment at all
 *   compound    true when it is a whole-body-part lift (a press, row, squat, hinge, lunge, carry) rather than an isolation, core or conditioning move
 * Frozen, so no caller can change what the next one reads.
 */
export const LIBRARY = Object.freeze(EXERCISE_LIBRARY.map((e) => Object.freeze({
  ...e,
  aliases: Object.freeze([...e.aliases]),
  primary: Object.freeze([...e.primary]),
  secondary: Object.freeze([...e.secondary]),
  equipment: Object.freeze([...e.equipment]),
  ladder: e.ladder ? Object.freeze({ ...e.ladder }) : null,
  bodyweight: e.equipment.includes('bodyweight'),
  compound: !NOT_COMPOUND.includes(e.pattern),
})));

/** The names of the bodyweight ladders, in the order they first come in the library. */
export const LADDERS = Object.freeze([...new Set(LIBRARY.filter((e) => e.ladder).map((e) => e.ladder.name))]);

/**
 * A name for comparing: lowercase, apostrophes dropped, every other mark and hyphen a space, one space between words, and a trailing "s"
 * taken off words longer than two letters ("curls" is "curl", "ups" is "up", "triceps" and "tricep" are both "tricep"; "press" stays).
 * Used on the library's names and on whatever is looked up, so the two always meet in the middle.
 */
export function normalizeName(text) {
  if (typeof text !== 'string') return '';
  return text.toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length > 2 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

// Equipment words a name can carry without changing what the exercise is, and the equipment each one stands for.
const QUALIFIERS = {
  bodyweight: 'bodyweight', dumbbell: 'dumbbell', barbell: 'barbell', cable: 'cable',
  machine: 'machine', kettlebell: 'kettlebell', banded: 'bands',
};

const BY_ID = new Map(LIBRARY.map((e) => [e.id, e]));
const BY_NAME = new Map();
LIBRARY.forEach((e) => [e.name, ...e.aliases].forEach((n) => {
  const key = normalizeName(n);
  // The tests fail on a name or alias used twice; this keeps the first one rather than let a mistake change which exercise a name finds.
  if (!BY_NAME.has(key)) BY_NAME.set(key, e);
}));

/** The exercise with this id, or null. */
export function getExercise(id) {
  return typeof id === 'string' ? (BY_ID.get(id) || null) : null;
}

/** The exercise a name stands for (see the top of this file for what counts), or null. */
export function findExercise(name) {
  const key = normalizeName(name);
  if (!key) return null;
  const exact = BY_NAME.get(key);
  if (exact) return exact;

  const words = key.split(' ');
  const wanted = [];
  const rest = words.filter((w) => {
    if (!Object.prototype.hasOwnProperty.call(QUALIFIERS, w)) return true;
    wanted.push(QUALIFIERS[w]);
    return false;
  });
  if (!wanted.length || !rest.length) return null;
  const found = BY_NAME.get(rest.join(' '));
  return found && wanted.every((eq) => found.equipment.includes(eq)) ? found : null;
}

/** The exercises on one bodyweight ladder, easiest first; [] for a name that is not a ladder. */
export function getLadder(name) {
  return LIBRARY.filter((e) => e.ladder && e.ladder.name === name).sort((a, b) => a.ladder.rung - b.ladder.rung);
}

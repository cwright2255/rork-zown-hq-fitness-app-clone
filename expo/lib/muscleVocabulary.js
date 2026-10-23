// lib/muscleVocabulary.js
//
// The one list of muscles the training engine speaks in, and a way to turn any muscle word into it.
//
// Until now the app had four vocabularies that did not agree: the AI plan writes free text ("quads", "Pecs", "lower back"), the fatigue
// map (lib/muscleFatigue.js) keys on quadriceps / hamstrings / glutes / calves / core, the body-scan anchors (lib/muscleAnchors.js) add
// chest / back / shoulders / biceps / triceps, and the muscle pictures ask for lowercase names. This file is the list the exercise library
// (data/exerciseLibrary.js) is written in, and resolveMuscle() is how a word from anywhere else is read into it.
//
// Nothing here changes how the rest of the app behaves. canonicalizeMuscle and the fatigue keys are left as they are; a later step moves
// them onto this list, and the tests in __tests__/muscleVocabulary.test.js hold the two together until then.
//
// "Back" is a word people use for three of these muscles, so it reads as all three; so do "legs" and "arms". A muscle word nobody
// could mean specifically ("full body", "thighs", "hips") reads as nothing rather than as a guess.

/** The 17 muscles, upper body first. Keys are what is stored and compared; show them with muscleLabel (lib/homeWidgetData.js). */
export const MUSCLES = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms',
  'lats', 'upper_back', 'traps', 'lower_back', 'core',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors',
  'neck',
];

/** Words that stand for several muscles at once. */
export const MUSCLE_GROUPS = {
  back: ['lats', 'upper_back', 'traps'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  arms: ['biceps', 'triceps', 'forearms'],
};

// Other words for one muscle. Keys are written the way normalize() leaves a word: lowercase, single spaces, no punctuation.
const SYNONYMS = {
  chest: ['pecs', 'pec', 'pectorals', 'pectoral', 'pectoralis', 'pectoralis major'],
  shoulders: ['shoulder', 'delts', 'delt', 'deltoids', 'deltoid', 'front delts', 'side delts', 'rear delts', 'front delt', 'side delt', 'rear delt'],
  biceps: ['bicep', 'biceps brachii'],
  triceps: ['tricep', 'triceps brachii'],
  forearms: ['forearm'],
  lats: ['lat', 'latissimus', 'latissimus dorsi'],
  upper_back: ['middle back', 'mid back', 'rhomboids', 'rhomboid'],
  traps: ['trap', 'trapezius'],
  lower_back: ['lumbar', 'erector spinae', 'erectors', 'spinal erectors'],
  core: ['abs', 'ab', 'abdominals', 'abdominal', 'abdomen', 'obliques', 'oblique'],
  quadriceps: ['quads', 'quad', 'quadricep'],
  hamstrings: ['hamstring', 'hams', 'ham'],
  glutes: ['glute', 'gluteus', 'gluteus maximus'],
  calves: ['calf', 'gastrocnemius', 'soleus'],
  adductors: ['adductor', 'inner thigh', 'inner thighs', 'groin'],
  abductors: ['abductor', 'outer thigh', 'outer thighs', 'outer hip', 'hip abductors', 'gluteus medius', 'glute medius', 'glute med'],
  neck: [],
};

const normalize = (text) => String(text).toLowerCase().replace(/[^a-z]+/g, ' ').trim();

const LOOKUP = (() => {
  const map = new Map();
  const add = (word, muscles) => {
    const key = normalize(word);
    if (map.has(key)) throw new Error(`muscleVocabulary: "${key}" is listed twice`);
    map.set(key, muscles);
  };
  MUSCLES.forEach((m) => { add(m, [m]); SYNONYMS[m].forEach((w) => add(w, [m])); });
  Object.entries(MUSCLE_GROUPS).forEach(([word, muscles]) => add(word, muscles));
  return map;
})();

/** True for one of the 17 keys exactly as stored. */
export function isMuscle(key) {
  return typeof key === 'string' && MUSCLES.includes(key);
}

/**
 * Reads one muscle word, in any case, with spaces, hyphens or underscores, into the muscles it means: "Quads" is ['quadriceps'],
 * "upper-back" is ['upper_back'], "back" is ['lats', 'upper_back', 'traps']. A word that is not a muscle, or is not a text, is [].
 * The answer is a new array each time, so a caller can change it.
 */
export function resolveMuscle(word) {
  if (typeof word !== 'string') return [];
  const found = LOOKUP.get(normalize(word));
  return found ? [...found] : [];
}

/** resolveMuscle for a list: every muscle the words mean, each once, in the order they first come. Anything that is not a list is []. */
export function resolveMuscles(words) {
  if (!Array.isArray(words)) return [];
  const out = [];
  words.forEach((w) => resolveMuscle(w).forEach((m) => { if (!out.includes(m)) out.push(m); }));
  return out;
}

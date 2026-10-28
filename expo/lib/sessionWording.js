// lib/sessionWording.js
//
// The words around today's session. The training engine (lib/sessionPicker.js) chooses the exercises, the sets, the reps, the rests and the
// weights; none of that is ever handed to the AI to decide. What the AI may do is put words on it: a plain-language reason for each pick, and a
// line about an injury area that was left out or a muscle that is still tired. The session's name is not the AI's: the engine gives it one from a fixed
// list (lib/workoutNames.js), so a name can never be an exercise, however the AI words the rest.
//
// Everything the AI says is checked here before anyone sees it, against the engine's own session:
//   - the answer must be JSON for this session: every exercise it mentions has to be one in the session (once each), and if it repeats a
//     set, rep, rest or weight figure for a pick, that figure has to be the engine's. Anything else and the whole answer is dropped;
//   - each piece of text (each reason, the note) is then checked on its own, and a piece that fails is dropped alone, so the
//     engine's own reason stays in its place: no number the engine did not give for that pick (a digit or a number word beside a unit), the
//     other weight unit's name, a claim the engine cannot make (guaranteed, proven, clinically, safe, optimal, diagnose, treat, rehab...),
//     a link or markup, another exercise from the library, or text that is too long or too short.
// A piece that is accepted replaces the engine's wording only; the exercises, sets, reps, rests and weights are the engine's, always.
//
// Only the training state is sent: the goal, level, time, equipment, unit, the injury areas that were left out, a few tired muscles, and for each
// exercise its sets, reps, rest, weight and the figures behind its reason. No name, no email, no history, no one-rep maxes.
//
// Pure functions: services/sessionWordingService.js asks the AI and keeps the answers.
import { LIBRARY } from './exerciseLibrary';
import { muscleLabel } from './homeWidgetData';

/** Every number this module uses. */
export const WORDING_RULES = Object.freeze({
  /** Changes whenever the instructions below change, so an answer kept for the old ones is not used. */
  version: 2,
  whyMin: 8,
  whyMax: 180,
  noteMax: 260,
  /** The most tired muscles told to the AI. */
  tiredListed: 3,
  /** How long the screen waits after the session settles before asking, so tapping through the times does not ask for each one. */
  delayMs: 1200,
});

/** Shown under the session when the AI's words are on it, so the engine is never presented as the AI or the AI as the engine. */
export const WORDING_CAPTION = 'The reasons are worded by AI from the numbers the training engine used. The exercises, sets, reps and weights are the engine\'s.';

const GOAL_LABELS = Object.freeze({ strength: 'Strength', muscle: 'Build Muscle', general: 'General Fitness' });
const EQUIPMENT_WORDS = Object.freeze({ gym: 'a full gym', dumbbells: 'dumbbells and a bench', bodyweight: 'no equipment' });

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const unitOf = (unit) => (unit === 'kg' ? 'kg' : 'lb');
const tidy = (text) => text.replace(/\s+/g, ' ').trim();
const muscleName = (id) => (typeof id === 'string' ? muscleLabel(id) : '');
const injuryName = (id) => String(id).replace(/_/g, ' ');

// ---------------------------------------------------------------------------------------------------------------------------------
// What the AI is told

/**
 * The session as the AI is told it: plain data, with the engine's figures only. `equipment` is the preset the session was built for ('gym',
 * 'dumbbells' or 'bodyweight'); `unit` is the unit the weights in the session are in.
 */
export function wordingBrief(session, { unit, equipment } = {}) {
  const s = isObject(session) ? session : {};
  const exercises = Array.isArray(s.exercises) ? s.exercises : [];
  return {
    goal: GOAL_LABELS[s.goal] || GOAL_LABELS.general,
    level: typeof s.level === 'string' ? s.level : 'beginner',
    minutes: finite(s.minutes) ? s.minutes : null,
    equipment: EQUIPMENT_WORDS[equipment] || null,
    weightUnit: unitOf(unit),
    injuryAreasLeftOut: (Array.isArray(s.leftOutFor) ? s.leftOutFor : []).filter((id) => typeof id === 'string').map(injuryName),
    tiredMuscles: (Array.isArray(s.tired) ? s.tired : [])
      .filter((t) => isObject(t) && typeof t.muscle === 'string' && finite(t.recovered))
      .slice(0, WORDING_RULES.tiredListed)
      .map((t) => ({ muscle: muscleName(t.muscle), recoveredPercent: t.recovered })),
    exercises: exercises.map((x) => {
      const f = isObject(x.facts) ? x.facts : null;
      return {
        id: x.id,
        name: x.name,
        sets: x.sets,
        reps: x.timed ? null : x.reps || null,
        holdSeconds: x.timed && finite(x.holdSeconds) ? x.holdSeconds : null,
        restSeconds: finite(x.restSeconds) ? x.restSeconds : null,
        weight: finite(x.weight) ? x.weight : null,
        target: typeof x.target === 'string' && x.target ? x.target : null,
        pickedFor: f ? {
          muscle: muscleName(f.muscle),
          recoveredPercent: f.recovered,
          setsDoneThisWeek: f.done,
          setsShortOfWeeklyAim: Math.max(0, f.short),
          weeklySetAim: f.aim,
        } : null,
      };
    }),
  };
}

/** The instructions the AI is given with the brief. */
export const WORDING_SYSTEM =
  'You put words on a workout that a training engine has already chosen. You do not choose, change, add, remove or reorder anything: not the ' +
  'exercises, sets, reps, rests or weights. You are given the session as JSON.\n' +
  'Reply with JSON only, in exactly this shape: {"note": string, "picks": [{"id": string, "why": string}]}. Do not name the session.\n' +
  '- picks: one entry for every exercise, in the same order, with its id exactly as given. why: one or two plain sentences, at most 180 ' +
  'characters, saying why this exercise is in today\'s session, using only the figures given for it in pickedFor, sets, reps and weight. ' +
  'Quote a number exactly as it is given, in the unit given, and use no other number. Never convert units. Name no other exercise.\n' +
  '- note: one sentence, at most 260 characters, that mentions an injury area that was left out (injuryAreasLeftOut) or a tired muscle ' +
  '(tiredMuscles), only as given. If both lists are empty, the note is an empty string.\n' +
  'Do not say or suggest that the session is guaranteed, proven, safe, optimal, accurate, clinically or scientifically validated, or medical ' +
  'advice. Do not diagnose, treat or give rehab advice, and do not promise results. No links, no markdown, no emoji.';

/** The two messages that are sent. */
export function wordingMessages(session, options = {}) {
  return [
    { role: 'system', content: WORDING_SYSTEM },
    { role: 'user', content: JSON.stringify(wordingBrief(session, options)) },
  ];
}

/**
 * A key for a session, so an answer kept for the same session is used again: the same exercises, sets, reps, rests and weights, the same
 * reasons, goal, level, unit and tired muscles, and the same instructions. Changing any of them asks again.
 */
export function wordingKey(session, options = {}) {
  const brief = wordingBrief(session, options);
  return `${WORDING_RULES.version}|${JSON.stringify(brief)}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// What comes back

/** The JSON object in the AI's reply (it may add a few words or a code fence around it), or null when there is none. Never throws. */
export function parseWordingReply(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  if (start < 0) return null;
  try {
    // From the first { to the last }, so what is parsed is an object or nothing at all.
    return JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  } catch {
    return null;
  }
}

const CLAIMS = new RegExp(
  '\\b(?:guarantee[sd]?|proven|proves?|clinical(?:ly)?|scientific(?:ally)?|accurate(?:ly)?|diagnos\\w*|cures?|cured|treat(?:s|ed|ing|ments?)?|' +
  'rehab\\w*|therap\\w*|medical(?:ly)?|prevent\\w*|heal(?:s|ed|ing)?|safe(?:r|st|ly|ty)?|risk[- ]free|optimal(?:ly)?|optimi[sz]\\w*|perfect(?:ly)?)\\b',
  'i',
);
const MARKUP = /[<>{}`[\]\\|]|\*\*|__|^#|https?:|www\.|@|\.(?:com|net|org|io|app|co)\b/i;
const KG_NAMES = /\b(?:kgs?|kilograms?|kilos?)\b/i;
const LB_NAMES = /\b(?:lbs?|pounds?)\b/i;

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
});
// A number word counts as a figure only beside a unit ("three sets", "ninety seconds"): "one" and "two" are also ordinary words.
const NUMBER_WORD_FIGURE = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b(?=\\s+(?:more\\s+|extra\\s+)?(?:sets?|reps?|rounds?|minutes?|mins?|seconds?|secs?|percent|kilograms?|kilos?|kgs?|pounds?|lbs?|times|days?))`,
  'gi',
);

const numbersIn = (text) => {
  const found = [];
  (text.match(/\d+(?:\.\d+)?/g) || []).forEach((t) => found.push(Number(t)));
  for (const m of text.matchAll(NUMBER_WORD_FIGURE)) found.push(NUMBER_WORDS[m[1].toLowerCase()]);
  return found;
};
const has = (list, n) => list.some((a) => Math.abs(a - n) < 1e-9);

// The numbers the engine gave for one exercise, which its reason may quote.
function figuresFor(x) {
  const out = [];
  const add = (v) => { if (finite(v)) out.push(v); };
  add(x.sets);
  add(x.restSeconds);
  if (x.timed) add(x.holdSeconds);
  if (!x.timed && isObject(x.repRange)) { add(x.repRange.min); add(x.repRange.max); }
  if (!x.timed && typeof x.reps === 'string') numbersIn(x.reps).forEach(add);
  add(x.weight);
  if (typeof x.target === 'string') numbersIn(x.target).forEach(add);
  if (isObject(x.facts)) {
    add(x.facts.recovered);
    add(x.facts.done);
    add(x.facts.aim);
    if (finite(x.facts.short)) add(Math.max(0, x.facts.short));
  }
  return out;
}

// ... and for the whole session, which the note may quote.
function figuresForSession(session) {
  const out = [];
  if (finite(session.minutes)) out.push(session.minutes);
  if (finite(session.totalSets)) out.push(session.totalSets);
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  out.push(exercises.length);
  exercises.forEach((x) => out.push(...figuresFor(x)));
  (Array.isArray(session.tired) ? session.tired : []).slice(0, WORDING_RULES.tiredListed).forEach((t) => { if (isObject(t) && finite(t.recovered)) out.push(t.recovered); });
  return out;
}

/**
 * One piece of the AI's text, cleaned and checked, or null when it must not be shown. `allowed` is the numbers it may quote (none to allow
 * no digits at all) and `unit` is the unit the weights are in.
 */
function cleanText(value, { min, max, allowed, unit }) {
  if (typeof value !== 'string') return null;
  const text = tidy(value);
  if (text.length < min || text.length > max) return null;
  if (MARKUP.test(text) || CLAIMS.test(text)) return null;
  if ((unitOf(unit) === 'kg' ? LB_NAMES : KG_NAMES).test(text)) return null;
  const numbers = numbersIn(text);
  if (numbers.some((n) => !has(allowed, n))) return null;
  return text;
}

/**
 * Checks an AI reply (the object from parseWordingReply) against the session the engine built.
 *
 * Returns null when the reply cannot be used at all: it is not an object, it mentions an exercise that is not in the session or the same one
 * twice, it gives a set, rep, rest or weight figure that is not the engine's for that exercise, or nothing in it passes. Otherwise
 * `{ note, why }`: `note` is the checked text or null, and `why` is { exerciseId: checked reason } for the picks whose
 * reason passed. A name in the reply is ignored: the session's name is the engine's. A piece that did not pass is simply not there, so the engine's own words stay in its place.
 */
export function checkWording(reply, session, { unit } = {}) {
  if (!isObject(reply) || !isObject(session) || !Array.isArray(session.exercises) || session.exercises.length === 0) return null;
  const byId = new Map(session.exercises.map((x) => [x.id, x]));

  const picks = reply.picks === undefined || reply.picks === null ? [] : reply.picks;
  if (!Array.isArray(picks)) return null;
  const seen = new Set();
  for (const pick of picks) {
    if (!isObject(pick) || !byId.has(pick.id) || seen.has(pick.id)) return null;
    seen.add(pick.id);
    const x = byId.get(pick.id);
    // A figure the AI repeats for a pick has to be the engine's: the AI does not change the limits, and saying it did is not a wording.
    if ('sets' in pick && pick.sets !== x.sets) return null;
    if ('reps' in pick && String(pick.reps) !== String(x.reps)) return null;
    if ('restSeconds' in pick && pick.restSeconds !== x.restSeconds) return null;
    if ('weight' in pick && pick.weight !== (finite(x.weight) ? x.weight : null)) return null;
  }

  // The names of the exercises in the session are taken out of a text first, so "Romanian Deadlift" is not read as "Deadlift".
  const inSession = session.exercises.map((x) => String(x.name || '').toLowerCase()).filter(Boolean);
  // Names of three letters or fewer are left out of the library list: they are too likely to sit inside an ordinary word.
  const others = LIBRARY.map((e) => e.name.toLowerCase()).filter((n) => n.length >= 4);
  const withoutOwn = (text) => inSession.reduce((t, n) => t.split(n.toLowerCase()).join(' '), text.toLowerCase());
  const clean = (value, opts) => {
    const text = cleanText(value, { ...opts, unit });
    if (text === null) return null;
    return others.some((n) => withoutOwn(text).includes(n)) ? null : text;
  };

  const out = { note: null, why: {} };

  const hasWhat = (Array.isArray(session.leftOutFor) && session.leftOutFor.length > 0) || (Array.isArray(session.tired) && session.tired.length > 0);
  if (hasWhat) out.note = clean(reply.note, { min: WORDING_RULES.whyMin, max: WORDING_RULES.noteMax, allowed: figuresForSession(session) });

  picks.forEach((pick) => {
    const text = clean(pick.why, { min: WORDING_RULES.whyMin, max: WORDING_RULES.whyMax, allowed: figuresFor(byId.get(pick.id)) });
    if (text !== null) out.why[pick.id] = text;
  });

  return out.note === null && Object.keys(out.why).length === 0 ? null : out;
}

/**
 * The session with the checked words on it. The exercises, sets, reps, rests and weights are the engine's, untouched; a reason that was
 * replaced keeps the engine's in `engineReason`. `worded` is true when anything was replaced, `note` is the line about a left-out injury area
 * or a tired muscle. A new session is returned; the one passed in is not changed, and with no wording it is returned as it is.
 */
export function applyWording(session, wording) {
  if (!isObject(session) || !Array.isArray(session.exercises) || !isObject(wording)) return session;
  const why = isObject(wording.why) ? wording.why : {};
  const exercises = session.exercises.map((x) => (
    typeof why[x.id] === 'string' ? { ...x, engineReason: x.reason, reason: why[x.id] } : x
  ));
  const note = typeof wording.note === 'string' && wording.note ? wording.note : null;
  const worded = note !== null || exercises.some((x, i) => x !== session.exercises[i]);
  if (!worded) return session;
  return { ...session, exercises, note, worded: true };
}

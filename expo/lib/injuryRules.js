// lib/injuryRules.js
//
// Which exercises are left out when a person reports an injury. The exercise library (data/exerciseLibrary.js) says what each exercise works,
// the profile (Edit Profile, Injuries) says which joints the person protects, and this file is the one list that joins them. It is kept apart
// from the picker (lib/sessionPicker.js) so that it can be read, argued with and changed on its own.
//
// What it is, honestly: a conservative list written for this app from which muscles and movements load which joint. It is not medical advice and
// nobody has checked it against a clinician's view; the point of it is that when in doubt an exercise is left out, so the session may be
// narrower than it needs to be but should not load an area the person said to protect. A professional should read it before it is relied on.
// The picker also tells the person it left exercises out, and the AI is told (trainingState) that reported injuries come before everything else.
//
// The rule, for each injury the person reported: an exercise is left out when
//   - one of its PRIMARY muscles is in `primary`, or
//   - one of its primary or secondary muscles is in `involved`, or
//   - its movement pattern is in `patterns`, or
//   - it needs a piece of equipment in `equipment`, or
//   - it is on a bodyweight ladder named in `ladders` (the whole ladder: every push-up is hard on a wrist), or
//   - it is one of the exercises named in `ids`: movements the muscle tags do not show (a pullover works the chest and lats but swings the
//     arms overhead, so it is hard on a shoulder).
// An injury id this file does not know leaves nothing out (the profile only offers the eight below).

/** The eight injuries the profile offers (lib/userProfileData.js INJURY_LABELS), and what each one leaves out. */
export const INJURY_RULES = Object.freeze({
  knee: Object.freeze({
    primary: ['quadriceps'], involved: [], patterns: ['squat', 'lunge', 'conditioning'], equipment: [], ladders: [],
    ids: ['nordic-hamstring-curl', 'glute-ham-raise'],
  }),
  hip: Object.freeze({
    primary: ['glutes', 'adductors', 'abductors'], involved: [], patterns: ['squat', 'hinge', 'lunge'], equipment: [], ladders: [], ids: [],
  }),
  lower_back: Object.freeze({
    primary: [], involved: ['lower_back'], patterns: ['hinge', 'carry'], equipment: [], ladders: [], ids: ['sit-up', 'v-up', 'russian-twist'],
  }),
  shoulder: Object.freeze({
    primary: [], involved: ['shoulders'], patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'], equipment: ['pullup_bar'], ladders: [],
    ids: ['dumbbell-pullover', 'straight-arm-pulldown'],
  }),
  elbow: Object.freeze({
    primary: [], involved: ['biceps', 'triceps'], patterns: ['vertical_push'], equipment: [], ladders: [], ids: [],
  }),
  wrist: Object.freeze({
    primary: [], involved: ['forearms'], patterns: [], equipment: ['ab_wheel', 'dip_station'], ladders: ['push', 'pike', 'dip'], ids: [],
  }),
  ankle: Object.freeze({
    primary: [], involved: ['calves'], patterns: ['lunge', 'conditioning'], equipment: [], ladders: [], ids: [],
  }),
  neck: Object.freeze({
    primary: [], involved: ['neck', 'traps'], patterns: ['vertical_push'], equipment: [], ladders: [], ids: [],
  }),
});

/** The injury ids this file knows. */
export const INJURY_IDS = Object.freeze(Object.keys(INJURY_RULES));

const list = (v) => (Array.isArray(v) ? v : []);

/**
 * The reported injuries that rule this exercise out: an array of ids from `injuries`, each once, in the order reported; [] when none does.
 * `exercise` is a library entry (lib/exerciseLibrary.js LIBRARY). Injury ids that are not text, or not known, are ignored.
 */
export function blockedBy(exercise, injuries) {
  if (!exercise) return [];
  const primary = list(exercise.primary);
  const everyMuscle = [...primary, ...list(exercise.secondary)];
  const equipment = list(exercise.equipment);
  const ladder = exercise.ladder ? exercise.ladder.name : null;
  const found = [];
  list(injuries).forEach((id) => {
    if (typeof id !== 'string' || found.includes(id) || !Object.prototype.hasOwnProperty.call(INJURY_RULES, id)) return;
    const rule = INJURY_RULES[id];
    const hit = primary.some((m) => rule.primary.includes(m))
      || everyMuscle.some((m) => rule.involved.includes(m))
      || rule.patterns.includes(exercise.pattern)
      || equipment.some((q) => rule.equipment.includes(q))
      || (ladder !== null && rule.ladders.includes(ladder))
      || rule.ids.includes(exercise.id);
    if (hit) found.push(id);
  });
  return found;
}

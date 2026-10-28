// lib/homeRecommendations.js
//
// The cards in the Recommended Workouts row on Home. They used to be four invented workouts (HIIT Blast, Morning Yoga and so on) that opened
// pages that do not exist. Now each card is a real session from the same engine as Today's Session (lib/sessionPicker.js), picked from how rested
// each muscle is, what has been done this week, the goal, the level and the injuries on the profile, and tapping a card opens that exact session.
//
// The row offers the same person a few ways to train today: their usual length with a full gym, a quick one, and the same length with only
// dumbbells or with no equipment. A way that gives the same exercises as one already shown is left out, and a way the engine cannot build a
// session for (everything is still recovering, nothing fits the equipment) is not offered; when none can be built the row says why, in the
// engine's own words, instead of showing cards.
//
// Pure functions, no React and no stores: app/hq.jsx reads the inputs (services/sessionService.js readSessionInputs) and passes them in.
import { pickSession, SESSION_RULES, EQUIPMENT_PRESETS, EQUIPMENT_LABELS } from './sessionPicker';

/** The shortest time on offer, for the quick card. */
const QUICK_MINUTES = SESSION_RULES.minutesOptions[0];

const ICONS = Object.freeze({ gym: 'barbell-outline', dumbbells: 'fitness-outline', bodyweight: 'body-outline' });

const exerciseCount = (n) => `${n} ${n === 1 ? 'exercise' : 'exercises'}`;

/** The ways to train, in the order they are offered. `minutes` is the time the engine is asked to fit. */
export function homeVariants(preferredMinutes) {
  const usual = SESSION_RULES.minutesOptions.includes(preferredMinutes) ? preferredMinutes : SESSION_RULES.defaultMinutes;
  // Someone whose usual time is already the shortest gets a longer one instead of a repeat.
  const other = usual > QUICK_MINUTES ? QUICK_MINUTES : SESSION_RULES.defaultMinutes;
  return [
    { key: 'today', minutes: usual, equipment: 'gym' },
    { key: 'quick', minutes: other, equipment: 'gym' },
    { key: 'dumbbells', minutes: usual, equipment: 'dumbbells' },
    { key: 'bodyweight', minutes: usual, equipment: 'bodyweight' },
  ];
}

/**
 * What the row shows.
 * @param {object} args
 *   inputs            services/sessionService.js readSessionInputs' answer (recovery, volume, ladderRungs, goal, level, injuries, weights, excluded)
 *   preferredMinutes  the length of session the person prefers (lib/sessionPicker.js minutesFromPreference)
 * @returns {{ cards: object[], notice: string|null }}
 *   cards   { key, title, focus, minutes, exercises, equipment, equipmentLabel, icon, preview, today } for each session that can be built; `title` is
 *           the session's made-up name (lib/workoutNames.js) and `focus` the muscles it trains in words; `minutes` and
 *           `equipment` are what to open the session screen with, `minutes` there being the time asked for (the session itself says how long it takes)
 *   notice  the engine's reason when no card could be built (null when there are cards)
 */
export function buildHomeCards({ inputs, preferredMinutes } = {}) {
  const base = inputs && typeof inputs === 'object' ? inputs : {};
  const cards = [];
  const seen = new Set();
  let notice = null;
  homeVariants(preferredMinutes).forEach((variant) => {
    let session;
    try {
      session = pickSession({ ...base, minutes: variant.minutes, equipment: variant.equipment });
    } catch {
      return; // a card that cannot be worked out is left out, it never takes the row down
    }
    if (!session || session.status !== 'ok' || !Array.isArray(session.exercises) || session.exercises.length === 0) {
      if (!notice && session && typeof session.message === 'string' && session.message) notice = session.message;
      return;
    }
    const signature = session.exercises.map((x) => x.id).join('|');
    if (seen.has(signature)) return;
    seen.add(signature);
    cards.push({
      key: variant.key,
      title: session.title || session.name,
      focus: session.name,
      minutes: variant.minutes,
      sessionMinutes: session.minutes,
      exercises: session.exercises.length,
      equipment: variant.equipment,
      equipmentLabel: EQUIPMENT_LABELS[variant.equipment],
      icon: ICONS[variant.equipment],
      preview: session.exercises.slice(0, 2).map((x) => x.name).join(', '),
      today: variant.key === 'today',
      detail: `${session.minutes} min · ${exerciseCount(session.exercises.length)}`,
    });
  });
  return { cards, notice: cards.length > 0 ? null : notice };
}

/**
 * The time and the equipment a card opens the session screen with, read back from the route's parameters: only the times and the equipment the
 * screen offers are taken, anything else is the screen's own default (`fallbackMinutes`, and a full gym).
 */
export function startFromParams(params, fallbackMinutes) {
  const p = params && typeof params === 'object' ? params : {};
  const minutes = Number(Array.isArray(p.minutes) ? p.minutes[0] : p.minutes);
  const equipment = Array.isArray(p.equipment) ? p.equipment[0] : p.equipment;
  return {
    minutes: SESSION_RULES.minutesOptions.includes(minutes) ? minutes : fallbackMinutes,
    equipment: typeof equipment === 'string' && Object.prototype.hasOwnProperty.call(EQUIPMENT_PRESETS, equipment) ? equipment : 'gym',
  };
}

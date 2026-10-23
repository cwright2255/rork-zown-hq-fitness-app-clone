// The training state the app sends with a workout-plan request (the app builds it in lib/trainingState.js): how many workouts in the last
// 14 days, which muscles those worked, how recovered each muscle still recovering is right now (an estimate on a 0 to 100 scale, 100 being
// fully recovered), the main lifts' best sets, readiness and the training load.
//
// It arrives from a phone, so it is not trusted to be well formed. Every piece is checked and cut to a known shape and size before any of
// it reaches the AI: numbers must be numbers inside a sensible range, names must be short plain words, the load zone must be one the app
// knows, the readiness word is worked out here from the score. A piece that does not pass is dropped and the rest is kept; a state in a
// shape this version does not know is ignored whole. What is left is written into the prompt as sentences, never as a block of the
// phone's own text. This keeps bad data out; it is not a defence against a person editing their own request, since the goals and
// injuries they send already reach the prompt as free text.
//
// Weights are in whatever unit the person logs. The server does not know which, never converts, and tells the AI not to either.
//
// Injuries do not come in the state. The plan request already carries them in the profile (index.js writes them into the prompt as
// "Injuries / areas to protect"), so whether there are any is read from there and the text below says they come before everything else.

export const TRAINING_STATE_VERSION = 3;
const MAX_MUSCLES = 8;
const MAX_LIFTS = 6;
const RECENT_DAYS = 14;

// What each training-load zone the app reports means, in words (the app's own words are not sent).
const ZONE_WORDS = {
  detraining: 'below their usual training',
  sweet_spot: 'in their typical training range',
  elevated: 'higher than usual',
  high: 'well above their recent average',
};

const number = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const within = (v, low, high) => { const n = number(v); return n !== null && n >= low && n <= high ? n : null; };
const oneDecimal = (n) => Math.round(n * 10) / 10;
const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

const MUSCLE_NAME = /^[a-z][a-z _-]{0,29}$/;
const LIFT_NAME = /^[A-Za-z][A-Za-z0-9 '()+./-]{0,39}$/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const dayKeyOrNull = (v) => {
  const s = clean(v);
  return DAY_KEY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s ? s : null;
};

const readinessWord = (score) => (score >= 75 ? 'High' : score >= 50 ? 'Moderate' : 'Low');

/**
 * The part of `input` worth telling the AI, in a fixed shape, or null when there is none (nothing sent, a shape this version does not
 * know, or nothing in it that passed the checks).
 */
export function sanitizeTrainingState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.v !== TRAINING_STATE_VERSION) return null;

  const recentWorkouts = Number.isInteger(input.recentWorkouts) ? within(input.recentWorkouts, 0, 100) : null;

  // [{ muscle, <key> }] with each muscle once, at most MAX_MUSCLES. An empty list the phone sent stays empty (nothing was worked); null
  // when it is not a list, or when it had entries and none passed (that is bad data, not "nothing was worked").
  const muscleList = (list, key, low, high) => {
    if (!Array.isArray(list)) return null;
    const seen = new Set();
    const out = [];
    for (const m of list) {
      if (out.length >= MAX_MUSCLES) break;
      const name = clean(m && m.muscle).toLowerCase();
      const value = within(m && m[key], low, high);
      if (!MUSCLE_NAME.test(name) || value === null || seen.has(name)) continue;
      seen.add(name);
      out.push({ muscle: name, [key]: Math.round(value) });
    }
    return out.length === 0 && list.length > 0 ? null : out;
  };
  const musclesWorked = muscleList(input.musclesWorked, 'sessions', 1, 100);
  // Recovery is 0 to 99: a muscle that is fully recovered is not listed, and one that cannot move yet is 0.
  const muscleRecovery = muscleList(input.muscleRecovery, 'recovery', 0, 99);

  const lifts = [];
  if (Array.isArray(input.lifts)) {
    for (const l of input.lifts) {
      if (lifts.length >= MAX_LIFTS) break;
      const name = clean(l && l.name);
      const e1rm = within(l && l.e1rm, 1, 2000);
      const bestWeight = within(l && l.bestWeight, 0.1, 2000);
      const bestReps = within(l && l.bestReps, 1, 100);
      if (!LIFT_NAME.test(name) || e1rm === null || bestWeight === null || bestReps === null) continue;
      const sessions = within(l.sessions, 1, 100000);
      lifts.push({
        name,
        e1rm: Math.round(e1rm),
        bestWeight: oneDecimal(bestWeight),
        bestReps: Math.round(bestReps),
        lastSessionDate: dayKeyOrNull(l.lastSessionDate),
        sessions: sessions === null ? null : Math.round(sessions),
      });
    }
  }

  const score = input.readiness ? within(input.readiness.score, 0, 100) : null;
  const readiness = score === null ? null : { score: Math.round(score), label: readinessWord(score) };

  const zone = input.trainingLoad && typeof input.trainingLoad.zone === 'string' ? input.trainingLoad.zone : '';
  const ratio = input.trainingLoad ? within(input.trainingLoad.ratio, 0, 10) : null;
  const trainingLoad = Object.prototype.hasOwnProperty.call(ZONE_WORDS, zone) && ratio !== null
    ? { zone, ratio: Math.round(ratio * 100) / 100 }
    : null;

  const state = { v: TRAINING_STATE_VERSION, recentWorkouts, musclesWorked, muscleRecovery, lifts, readiness, trainingLoad };
  const empty = recentWorkouts === null && musclesWorked === null && muscleRecovery === null && lifts.length === 0 && !readiness && !trainingLoad;
  return empty ? null : state;
}

const muscleWord = (key) => {
  const text = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * The sentences that go into the workout-plan prompt for a sanitized state, led by a space so they follow the profile text, or ''
 * for no state at all: a request without one gets the same prompt it always did. `hasInjuries` is whether the profile in the same
 * request lists any injuries or areas to protect; when it does, the text says they come before everything in it.
 */
export function trainingStateText(state, { hasInjuries = false } = {}) {
  if (!state) return '';
  const parts = [];

  if (state.recentWorkouts !== null) parts.push(`Workouts logged in the last ${RECENT_DAYS} days: ${state.recentWorkouts}.`);

  if (state.musclesWorked !== null) {
    parts.push(state.musclesWorked.length > 0
      ? `Muscles worked in the last ${RECENT_DAYS} days, with how many workouts, runs or hikes worked each (how often, not how hard): ` +
        `${state.musclesWorked.map((m) => `${muscleWord(m.muscle)} ${m.sessions}`).join(', ')}.`
      : `No muscles worked by logged workouts, runs or hikes in the last ${RECENT_DAYS} days.`);
  }

  if (state.muscleRecovery !== null) {
    parts.push(state.muscleRecovery.length > 0
      ? 'Estimated muscle recovery right now (100 is fully recovered; worked out from logged sets with a simple model, not a measurement), ' +
        `lowest first, muscles not listed have no logged work still being recovered from: ${state.muscleRecovery.map((m) => `${muscleWord(m.muscle)} ${m.recovery}`).join(', ')}.`
      : 'No muscle is still recovering from logged workouts, runs or hikes, by a simple estimate made from the logged sets.');
  }

  if (state.lifts.length > 0) {
    const lifts = state.lifts.map((l) => (
      `${l.name} best set ${l.bestWeight} x ${l.bestReps}, estimated one-rep max about ${l.e1rm}` +
      `${l.lastSessionDate ? `, last trained ${l.lastSessionDate}` : ''}${l.sessions ? `, ${l.sessions} sessions logged` : ''}`
    ));
    parts.push(`Main lifts (weights are in the unit the user logs; do not convert them): ${lifts.join('; ')}.`);
  }

  if (state.readiness) {
    parts.push(`Readiness today: ${state.readiness.score} of 100 (${state.readiness.label}), a guide made from their own sleep, heart-rate and training-load readings.`);
  }

  if (state.trainingLoad) {
    parts.push(`Training load: this week is ${state.trainingLoad.ratio} times their usual week (${ZONE_WORDS[state.trainingLoad.zone]}).`);
  }

  if (parts.length === 0) return '';
  return ' Their training right now, from their own logs and worked out on their phone - the only facts you have about it, so quote no ' +
    `number that is not listed here: ${parts.join(' ')} Use it to decide emphasis: give muscles with low recovery a rest day or lighter work, ` +
    'favour muscles that are fully recovered or were not worked much recently, and keep the total volume level or lower when readiness is Low or the training load is ' +
    'higher than usual.' +
    (hasInjuries
      ? ' The injuries and areas to protect listed above come before all of this: never programme an exercise that loads an injured area, ' +
        'even when its muscles show as recovered, and do not advise on an injury beyond suggesting they see a professional.'
      : '') +
    ' Do not diagnose anything.';
}

// lib/trainingFeedback.js
//
// What the person tells the training engine about its picks, and what they do that tells it too: More, Less and Exclude on an exercise, a swap
// away from it, and a skip of it. Pure functions on a small plain state; store/trainingFeedbackStore.js keeps the state on the phone and in the
// cloud, services/sessionService.js turns it into the two things lib/sessionPicker.js reads (weights and excluded), and lib/trainingMeasures.js
// counts what happened.
//
// How each signal changes the picks. Like every other number in the training engine these are starting values from judgement, not
// measurements: nobody has checked that they are the right size, and they live in one place (FEEDBACK_RULES) so they can be tuned on real use.
//   - More multiplies the exercise's score by 1.3, Less by 0.7. Either stays until the person changes it (tapping the same one again clears it).
//   - Each swap away from an exercise, and each time a session's exercise was skipped (marked done with no sets logged), multiplies its score by
//     0.9. They count for 28 days, and together they never take the score below half.
//   - Exclude takes the exercise out for good, until the person restores it.
// A score only decides the order among exercises that are already allowed. The signals never let an exercise through that the equipment, the level,
// the injuries or the recovery rules left out, never lift a weekly set limit, and never choose a weight or a rep (lib/sessionPicker.js).
//
// What an exercise is. A bodyweight ladder (push-ups from wall push-ups to single-arm push-ups) is one exercise as far as feedback goes: Exclude
// on the rung you are on excludes the whole ladder, so that the engine does not hand you the next rung down, and More or Less on it still holds
// when you move up a rung. Its key is "ladder:<name>"; every other exercise's key is its library id.
import { getExercise } from './exerciseLibrary';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every number the feedback uses. Change them here; nothing else holds a copy. */
export const FEEDBACK_RULES = Object.freeze({
  version: 1,
  /** What a More and a Less vote multiply the exercise's score by. */
  more: 1.3,
  less: 0.7,
  /** What each swap away from an exercise, and each skip of it, multiplies its score by while it still counts. */
  swap: 0.9,
  skip: 0.9,
  /** Swaps and skips together never take the score below this share of what it would be. */
  floor: 0.5,
  /** How many days a swap or a skip counts for. */
  memoryDays: 28,
  /** The most swaps, and the most skips, kept for one exercise (the newest). */
  eventsKept: 12,
  /** The most exercises kept in each of the four lists, so a damaged copy cannot grow without limit. */
  maxKeys: 300,
  /** The longest exercise name kept in the excluded list. */
  nameMax: 80,
});

const VOTES = Object.freeze(['more', 'less']);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const toMs = (now) => {
  if (now instanceof Date) return Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
  return typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
};
const stampOf = (ms) => new Date(ms).toISOString();

/** The key feedback is kept under for an exercise (a library id or an object with one): "ladder:<name>" for a bodyweight ladder, else its id; '' when it has none. */
export function feedbackKey(exercise) {
  const id = typeof exercise === 'string' ? exercise : exercise && typeof exercise.id === 'string' ? exercise.id : '';
  const found = getExercise(id);
  return found && found.ladder ? `ladder:${found.ladder.name}` : id;
}

/** No feedback at all. */
export function emptyFeedback() {
  return { v: FEEDBACK_RULES.version, votes: {}, excluded: {}, swaps: {}, skips: {} };
}

// Anything kept in a list is only trusted if it has the right shape; whatever else is there (an older copy, a damaged one, another app's) is left out.
const keyOk = (key) => typeof key === 'string' && key !== '' && key.length <= 120;

function takeEvents(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((t) => typeof t === 'number' && Number.isFinite(t)).sort((a, b) => a - b).slice(-FEEDBACK_RULES.eventsKept);
}

/** A state that can be trusted from whatever was read (the phone's copy, the cloud's): each entry checked, anything wrong dropped, the lists capped. Never throws. */
export function sanitizeFeedback(raw) {
  const out = emptyFeedback();
  if (!isPlain(raw)) return out;
  const { maxKeys, nameMax } = FEEDBACK_RULES;
  if (isPlain(raw.votes)) {
    Object.entries(raw.votes).slice(0, maxKeys).forEach(([key, entry]) => {
      if (keyOk(key) && isPlain(entry) && VOTES.includes(entry.vote)) {
        out.votes[key] = { vote: entry.vote, at: typeof entry.at === 'string' ? entry.at : '' };
      }
    });
  }
  if (isPlain(raw.excluded)) {
    Object.entries(raw.excluded).slice(0, maxKeys).forEach(([key, entry]) => {
      if (!keyOk(key) || !isPlain(entry)) return;
      const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, nameMax) : '';
      out.excluded[key] = { name: name || key, ladder: entry.ladder === true, at: typeof entry.at === 'string' ? entry.at : '' };
    });
  }
  ['swaps', 'skips'].forEach((table) => {
    if (!isPlain(raw[table])) return;
    Object.entries(raw[table]).slice(0, maxKeys).forEach(([key, list]) => {
      const events = takeEvents(list);
      if (keyOk(key) && events.length > 0) out[table][key] = events;
    });
  });
  return out;
}

const capped = (table, key) => (key in table || Object.keys(table).length < FEEDBACK_RULES.maxKeys);

/** The vote on an exercise: 'more', 'less' or null. */
export function voteOf(feedback, key) {
  const entry = feedback && feedback.votes ? feedback.votes[key] : null;
  return entry && VOTES.includes(entry.vote) ? entry.vote : null;
}

/** What tapping `tapped` ('more' or 'less') does to the vote `current`: the same one again clears it, the other one changes it. */
export function nextVote(current, tapped) {
  if (!VOTES.includes(tapped)) return current === 'more' || current === 'less' ? current : null;
  return current === tapped ? null : tapped;
}

/** A new state with the vote set ('more' or 'less'), or cleared (null). An empty key or a vote that is neither changes nothing. */
export function setVote(feedback, key, vote, now) {
  const state = sanitizeFeedback(feedback);
  if (!keyOk(key)) return state;
  if (vote === null) {
    delete state.votes[key];
    return state;
  }
  if (!VOTES.includes(vote) || !capped(state.votes, key)) return state;
  state.votes[key] = { vote, at: stampOf(toMs(now)) };
  return state;
}

/** A new state with the exercise excluded. `info` is { name, ladder }: what the excluded list will call it, and whether the key is a whole ladder. */
export function excludeExercise(feedback, key, info, now) {
  const state = sanitizeFeedback(feedback);
  if (!keyOk(key) || !capped(state.excluded, key)) return state;
  const given = info && typeof info.name === 'string' ? info.name.trim().slice(0, FEEDBACK_RULES.nameMax) : '';
  state.excluded[key] = { name: given || key, ladder: !!(info && info.ladder === true), at: stampOf(toMs(now)) };
  return state;
}

/** A new state with the exercise no longer excluded. */
export function restoreExercise(feedback, key) {
  const state = sanitizeFeedback(feedback);
  delete state.excluded[key];
  return state;
}

/** The keys the picker is told never to pick. */
export function excludedKeys(feedback) {
  return feedback && isPlain(feedback.excluded) ? Object.keys(feedback.excluded).filter(keyOk) : [];
}

/** The excluded exercises for the list the person restores from, newest first: [{ key, name, ladder }]. */
export function excludedList(feedback) {
  const state = sanitizeFeedback(feedback);
  return Object.entries(state.excluded)
    .map(([key, e]) => ({ key, name: e.name, ladder: e.ladder, at: e.at }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key < b.key ? -1 : 1))
    .map(({ key, name, ladder }) => ({ key, name, ladder }));
}

function addEvent(feedback, table, key, now) {
  const state = sanitizeFeedback(feedback);
  if (!keyOk(key) || !capped(state[table], key)) return state;
  state[table][key] = takeEvents([...(state[table][key] || []), toMs(now)]);
  return state;
}

/** A new state that notes a swap away from the exercise. */
export const recordSwap = (feedback, key, now) => addEvent(feedback, 'swaps', key, now);
/** A new state that notes the exercise was skipped (marked done with no sets logged). */
export const recordSkip = (feedback, key, now) => addEvent(feedback, 'skips', key, now);

const recent = (list, nowMs) => (Array.isArray(list) ? list : []).filter((t) => nowMs - t < FEEDBACK_RULES.memoryDays * DAY_MS).length;

/**
 * What the exercise's score is multiplied by: its vote (1.3, 0.7 or 1) times the swaps and skips of the last 28 days (0.9 each, never together
 * below 0.5). 1 when there is nothing to say. Rounded to four places, so 0.9 x 0.9 is 0.81 and not 0.8100000000000001.
 */
export function multiplierFor(feedback, key, now) {
  if (!feedback || !isPlain(feedback)) return 1;
  const nowMs = toMs(now);
  const { more, less, swap, skip, floor } = FEEDBACK_RULES;
  const vote = voteOf(feedback, key);
  const voteFactor = vote === 'more' ? more : vote === 'less' ? less : 1;
  const events = swap ** recent(feedback.swaps && feedback.swaps[key], nowMs) * skip ** recent(feedback.skips && feedback.skips[key], nowMs);
  return Math.round(voteFactor * Math.max(floor, events) * 10000) / 10000;
}

/** The weights lib/sessionPicker.js reads: { key: multiplier } for every exercise whose multiplier is not 1. */
export function weightsFor(feedback, now) {
  const state = sanitizeFeedback(feedback);
  const keys = new Set([...Object.keys(state.votes), ...Object.keys(state.swaps), ...Object.keys(state.skips)]);
  const out = {};
  keys.forEach((key) => {
    const m = multiplierFor(state, key, now);
    if (m !== 1) out[key] = m;
  });
  return out;
}

/** The state without swaps and skips older than the memory, and without keys left with nothing: what is worth keeping. */
export function pruneFeedback(feedback, now) {
  const state = sanitizeFeedback(feedback);
  const nowMs = toMs(now);
  ['swaps', 'skips'].forEach((table) => {
    Object.keys(state[table]).forEach((key) => {
      const kept = state[table][key].filter((t) => nowMs - t < FEEDBACK_RULES.memoryDays * DAY_MS);
      if (kept.length > 0) state[table][key] = kept;
      else delete state[table][key];
    });
  });
  return state;
}

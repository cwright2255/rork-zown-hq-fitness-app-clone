// services/sessionWordingService.js
//
// Asks the AI for the words around Today's Session (lib/sessionWording.js) and keeps what comes back, so choosing the same time and equipment
// again does not ask again. Only the checked wording is returned: an answer that fails the checks is the same as no answer, and the screen then
// keeps the engine's own words. Nothing here throws, and nothing here waits for anyone: the session is shown first and the words swap in.
//
// An answer is kept for the same session (the same exercises, figures, reasons, unit and instructions) for as long as the app is open. A try
// that gave nothing is kept for two minutes, so a used-up allowance or a bad answer is not asked for again every time a chip is tapped.
// Two screens asking for the same session at the same moment share one request.
import { generateSessionWording } from '@/services/aiService';
import { wordingMessages, wordingKey, checkWording } from '@/lib/sessionWording';

/** How many sessions' wording is kept; the oldest goes first. */
export const WORDING_KEPT = 20;
/** How long a try that gave nothing is remembered. */
export const WORDING_MISS_MS = 2 * 60 * 1000;

const kept = new Map(); // key -> { wording: object | null, at: ms }
const inFlight = new Map(); // key -> Promise<object | null>

const askable = (session) => !!session && typeof session === 'object' && session.status === 'ok' && Array.isArray(session.exercises) && session.exercises.length > 0;

const remember = (key, wording, at) => {
  kept.delete(key);
  kept.set(key, { wording, at });
  while (kept.size > WORDING_KEPT) kept.delete(kept.keys().next().value);
};

/**
 * What is already known for this session without asking: its checked wording, null for a recent try that gave nothing, or undefined when it
 * is not known (never asked, or a miss old enough to try again). Never asks and never throws.
 */
export function peekWording(session, { unit, equipment, now = Date.now() } = {}) {
  try {
    if (!askable(session)) return null;
    const entry = kept.get(wordingKey(session, { unit, equipment }));
    if (!entry) return undefined;
    return entry.wording !== null || now - entry.at < WORDING_MISS_MS ? entry.wording : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The checked wording for a session built by lib/sessionPicker.js ({ name, note, why }; see checkWording), or null when there is none: the
 * session cannot be worded, the AI gave nothing, the plan's allowance is used up, or the answer failed the checks. `ask` is only there so a
 * test can stand in for the AI. Never throws.
 */
export async function wordSession(session, { unit, equipment, ask = generateSessionWording, now = Date.now() } = {}) {
  try {
    if (!askable(session)) return null;
    const key = wordingKey(session, { unit, equipment });
    const known = peekWording(session, { unit, equipment, now });
    if (known !== undefined) return known;
    if (inFlight.has(key)) return await inFlight.get(key);

    const work = (async () => {
      let wording = null;
      try {
        const reply = await ask({ messages: wordingMessages(session, { unit, equipment }) });
        wording = checkWording(reply, session, { unit });
      } catch {
        wording = null;
      }
      remember(key, wording, now);
      return wording;
    })();
    inFlight.set(key, work);
    try {
      return await work;
    } finally {
      inFlight.delete(key);
    }
  } catch {
    return null;
  }
}

/** Forgets everything kept. Only for tests. */
export function clearWordingCache() {
  kept.clear();
  inFlight.clear();
}

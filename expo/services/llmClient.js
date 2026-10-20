// One place to call the app's AI backend.
//
// The backend is the `postLLM` Cloud Function (functions/src/index.js), a
// callable that passes `messages` to OpenAI and returns { completion }.
// Two screens used to POST to `${apiBase}/text/llm/` instead, a plain URL
// that no Cloud Function answers, so the photo food scanner and the AI
// fallback in recipe import always failed. Everything that needs a one-off
// completion goes through askLLM so there is a single, real route.
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/config/firebase';

/**
 * Sends chat `messages` (OpenAI format, so an image goes in as
 * { type: 'image_url', image_url: { url } }) and resolves to the reply text.
 * Rejects when the call fails or the reply is not text. `kind` is which daily
 * AI allowance it uses (lib/entitlements.js): the one-off helpers that come
 * through here (the meal photo scanner, recipe import) are 'assist'. When the
 * allowance is used up the error carries the reason (lib/upgradePrompt.js).
 */
export async function askLLM(messages, { timeoutMs = 60000, kind = 'assist' } = {}) {
  const call = httpsCallable(functions, 'postLLM', { timeout: timeoutMs });
  const result = await call({ messages, kind });
  const completion = result?.data?.completion;
  if (typeof completion !== 'string') {
    throw new Error('The AI did not send back a reply');
  }
  return completion;
}

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

/**
 * Reads a JSON object out of a model reply. Models often wrap JSON in a
 * ```json fence or add a sentence around it, so this accepts the bare text,
 * a fenced block, or the first {...} found. Returns null when there is no
 * object (including the reply "null").
 */
export function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return asObject(JSON.parse(unfenced));
  } catch {
    // fall through to looking for an object inside the text
  }
  const match = unfenced.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return asObject(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

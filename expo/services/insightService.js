// services/insightService.js
//
// The training-load comment for the Health screen, asked for at most once per day for each set of numbers (lib/insightCache.js) and
// kept on the phone. Never throws: a comment that cannot be had is simply null, and the screen shows the card without one.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateTrainingLoadInsight } from '@/services/aiService';
import { localDateKey } from '@/lib/localDate';
import { trainingLoadKey, readInsight, rememberInsight } from '@/lib/insightCache';

export const INSIGHT_STORAGE_KEY = 'zown-insight-cache';

// Requests under way, by key: two callers asking for the same comment at the same moment share one request.
const inFlight = new Map();

const load = async (storage) => {
  try {
    const raw = await storage.getItem(INSIGHT_STORAGE_KEY);
    // Nothing kept is null, which lib/insightCache.js reads as no entries; kept text that cannot be read throws and is started over.
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const save = async (storage, entries) => {
  try {
    await storage.setItem(INSIGHT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Not being able to keep it only means it is asked for again next time.
  }
};

/**
 * The comment on `trainingLoad` (from lib/trainingLoad.js) for this person today: the kept one if there is one, otherwise a new one
 * from the AI, which is then kept. Resolves to the text, or null.
 * `ask` and `storage` are only there so a test can stand in for the AI and the phone's storage.
 */
export async function getTrainingLoadInsight({
  uid, trainingLoad, now = new Date(), ask = generateTrainingLoadInsight, storage = AsyncStorage,
}) {
  const key = trainingLoadKey(uid, localDateKey(now), trainingLoad);
  if (!key) return null;

  const kept = readInsight(await load(storage), key, now.getTime());
  if (kept.found) return kept.text;

  if (inFlight.has(key)) return inFlight.get(key);
  const request = (async () => {
    let text = null;
    try {
      text = await ask({ trainingLoad });
    } catch {
      text = null;
    }
    // Filed on top of what is kept at this moment, not what was read before the wait, which another comment may have been added to.
    await save(storage, rememberInsight(await load(storage), key, text, now.getTime()));
    return typeof text === 'string' && text.trim() ? text : null;
  })().finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
}

// lib/todayBrief.js
//
// The daily "Today" brief: a short note from the Coach, written once a day from the same things the Coach knows (profile, injuries,
// diet, weight trend, food, calendar, recovery, lifts, runs, training load) plus today's readiness and the last week's sleep, HRV,
// resting heart rate and weight. This file is the pure part: the instructions the AI is given, how the facts are worded, how its answer
// is checked, and the key it is kept under on the phone. Reading the stores and asking the AI are in services/briefService.js.
import { localDateKey } from './localDate';
import { readingByDay, weightByDay, trendSeries, formatValue, formatChange } from './dailyReadings';

export const BRIEF_STORAGE_KEY = 'zown-brief-cache';
export const BRIEF_MAX_POINTS = 4;
export const BRIEF_HEADLINE_MAX = 120;
export const BRIEF_POINT_MAX = 240;

/** The key a person's brief for one day is kept under, or null when there is nothing to key it by. */
export function briefKey(uid, day) {
  if (typeof uid !== 'string' || !uid || typeof day !== 'string' || !day) return null;
  return `brief|${uid}|${day}`;
}

/**
 * The brief out of the AI's answer: { headline, points } or null when it is not one. The answer is asked for as JSON only; if the model
 * adds a few words or a code fence around it, the JSON is still found. A headline is needed, and at least one point; extra points and
 * very long text are cut, never kept whole.
 */
export function parseBrief(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const headline = typeof parsed?.headline === 'string' ? parsed.headline.trim().slice(0, BRIEF_HEADLINE_MAX).trim() : '';
  const points = (Array.isArray(parsed?.points) ? parsed.points : [])
    .filter((point) => typeof point === 'string' && point.trim())
    .slice(0, BRIEF_MAX_POINTS)
    .map((point) => point.trim().slice(0, BRIEF_POINT_MAX).trim());
  if (!headline || !points.length) return null;
  return { headline, points };
}

/** What is kept on the phone for a brief: the same JSON the AI was asked for, so parseBrief reads it back. */
export const serializeBrief = (brief) => JSON.stringify({ headline: brief.headline, points: brief.points });

/**
 * What the person is taken to ask for. It says what the note is about, in fitness words: the server's topic check reads the whole request
 * and a bare "Write my Today brief" is the kind of thing it could take for a writing task, which it turns away (and still counts).
 */
export const BRIEF_REQUEST = 'Write my Today brief: a short note about my training, recovery and nutrition for today.';

export const BRIEF_SYSTEM_PROMPT = [
  'You are ZOWN\'s AI fitness coach writing the person\'s Today brief: a short note they read once each morning.',
  'Their real app data follows in the next messages. Use only the numbers, names and facts listed there. Never invent a reading, a workout, a cause or a diagnosis, and if something is not listed, leave it out.',
  'Respect any injuries and food allergies listed: never suggest loading an injured area or a food they must avoid.',
  'Let readiness and training load set the tone: if they point to being run down or to a spike in training, say plainly and calmly to ease off; if they are fresh and training is steady, say a harder day is fine. If neither is listed, do not guess.',
  'Mention a calendar item only if one is listed, and only the most relevant.',
  'This is training and nutrition guidance, not medical advice: for pain, illness or anything medical, point them to a doctor.',
  'Be warm and direct, write to them as "you", no emojis, no scolding, and never shame food, weight or a missed day.',
  'Respond with strict JSON only: {"headline": string, "points": string[]}. The headline is at most 12 words. Give 2 to 4 points, each one short sentence of at most 25 words, the most useful first.',
].join(' ');

/** "Readiness today: ..." with the parts it is made from (lib/readiness.js), or null when there is no score. */
export function readinessFact(readiness) {
  if (!readiness || typeof readiness.score !== 'number') return null; // a score only exists when there is enough to make one
  const used = readiness.parts.filter((part) => part.state === 'used').map((part) => `${part.title}: ${part.detail}`);
  return `Readiness today, worked out in the app from their own readings: ${readiness.score} out of 100 (${readiness.label}). ${used.join('; ')}.`;
}

/** The last 7 days of sleep, HRV, resting heart rate and weight against the 7 days before, as one sentence (in an array), or []. */
export function trendFacts({ history, weightLogs, pounds = true, today = localDateKey(new Date()), hrvLabel = 'HRV' } = {}) {
  const kinds = [
    { label: 'sleep', values: readingByDay(history, 'sleepHours'), format: { decimals: 1, unit: 'h' } },
    { label: hrvLabel, values: readingByDay(history, 'hrv'), format: { decimals: 0, unit: 'ms' } },
    { label: 'resting heart rate', values: readingByDay(history, 'restingHeartRate'), format: { decimals: 0, unit: 'bpm' } },
    { label: 'weight', values: weightByDay(weightLogs, { pounds }), format: { decimals: 1, unit: pounds ? 'lb' : 'kg' } },
  ];
  const parts = [];
  for (const { label, values, format } of kinds) {
    const series = trendSeries(values, today, 7);
    if (!series.count) continue;
    const change = formatChange(series.change, format);
    parts.push(`${label} ${formatValue(series.average, format)} on average over ${series.count} of 7 days${change ? ` (${change} against the 7 days before)` : ''}`);
  }
  return parts.length ? [`Last 7 days: ${parts.join('; ')}.`] : [];
}

/** "Today is Tuesday, October 20, 2026." in the person's own time. */
export const dateFact = (now = new Date()) => `Today is ${now.toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})}.`;

/**
 * The messages sent to the AI: the instructions, the facts only this file words (the date, who they are, readiness, the week's trends),
 * the Coach's own snapshot and data messages when there are any, and the request.
 * @param {{ now?: Date, profileLines?: string[], readiness?: object|null, trends?: string[], snapshot?: object|null, dataMessage?: object|null }} input
 */
export function buildBriefMessages({ now = new Date(), name = '', profileLines = [], readiness = null, trends = [], snapshot = null, dataMessage = null } = {}) {
  const facts = [
    dateFact(now),
    name ? `The person\'s name is ${name}.` : null,
    ...profileLines,
    readinessFact(readiness),
    ...trends,
  ].filter(Boolean);
  const messages = [
    { role: 'system', content: BRIEF_SYSTEM_PROMPT },
    { role: 'system', content: `About this person and today: ${facts.join(' ')}` },
  ];
  if (snapshot && snapshot.content) messages.push({ role: 'system', content: snapshot.content });
  if (dataMessage && dataMessage.content) messages.push({ role: 'system', content: dataMessage.content });
  messages.push({ role: 'user', content: BRIEF_REQUEST });
  return messages;
}

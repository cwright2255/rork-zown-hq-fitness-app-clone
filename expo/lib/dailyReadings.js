// lib/dailyReadings.js
//
// A daily record of the body readings the app can see (sleep, HRV, resting heart rate), and the 7-day and 28-day trends drawn from it
// and from the weight log. Pure functions: no React, no stores, no Firebase, so every rule is unit tested.
//
//   history   { "YYYY-MM-DD": { restingHeartRate?, hrv?, sleepHours? } }, one entry per calendar day as the person lives it
//             (lib/localDate.js). A day's sleep is filed under the day the person woke up. Like the step history, the newest
//             READINGS_KEEP_DAYS days are kept, and a value that is missing or not believable is simply left out, never filled in.
//   trends    for a window of 7 or 28 days ending today: the readings that exist, their average, and how that average compares with
//             the same number of days before. Days with no reading are gaps, not zeros, and nothing is joined across them.
import { dayKeyOf, parseDateKey, shiftDateKey } from './localDate';
import { KG_TO_LB } from './macroWeightData';

export const READINGS_KEEP_DAYS = 400;

/** The values that can be believed for each reading. Anything outside is dropped, not clamped. */
export const READING_RANGES = {
  restingHeartRate: { min: 25, max: 220 },
  hrv: { min: 1, max: 400 },
  sleepHours: { min: 0.1, max: 20 },
};

const tenth = (n) => Math.round(n * 10) / 10;

/** One reading as it should be kept (to a tenth), or null when it is missing or not believable. */
export function cleanReading(field, value) {
  const range = READING_RANGES[field];
  // Number() makes null and empty text 0, which is below every range; true would be 1, so it is turned away by name.
  if (!range || typeof value === 'boolean') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < range.min || n > range.max) return null;
  return tenth(n);
}

function cleanDay(values) {
  const out = {};
  if (!values || typeof values !== 'object') return out;
  for (const field of Object.keys(READING_RANGES)) {
    const kept = cleanReading(field, values[field]);
    if (kept !== null) out[field] = kept;
  }
  return out;
}

/** A history as it should be held: real calendar days with at least one believable reading, the newest READINGS_KEEP_DAYS of them. */
export function normalizeReadings(history) {
  // Anything that is not a set of days (null, text, a number, a list) has no day keys that pass the check below.
  const days = Object.keys(history || {})
    .filter((day) => parseDateKey(day) && Object.keys(cleanDay(history[day])).length > 0)
    .sort()
    .slice(-READINGS_KEEP_DAYS);
  const out = {};
  for (const day of days) out[day] = cleanDay(history[day]);
  return out;
}

/** `base` with `over` put on top: for a day and reading in both, `over` wins (it is the newer read of the device). */
export function mergeReadings(base, over) {
  const left = normalizeReadings(base);
  const right = normalizeReadings(over);
  const out = { ...left };
  for (const day of Object.keys(right)) out[day] = { ...out[day], ...right[day] };
  return normalizeReadings(out);
}

/** The history with one day's readings put in. Readings that are not believable leave what was there as it was. */
export function withReadingsOn(history, day, values) {
  return mergeReadings(history, { [day]: values });
}

// -- From Apple Health ----------

// HKCategoryValueSleepAnalysis: 0 in bed, 1 asleep (unspecified), 2 awake, 3 core, 4 deep, 5 REM. Only the asleep stages are sleep.
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);
const ASLEEP_NAMES = new Set(['asleep', 'asleepUnspecified', 'asleepCore', 'asleepDeep', 'asleepREM']);
const HOUR_MS = 3600000;
// A sleep stage that ends in the evening belongs to the night that ends the next morning: moving every end forward 6 hours puts both
// halves of a night (before and after midnight) on the day the person woke up.
const NIGHT_SHIFT_MS = 6 * HOUR_MS;
/** Under this many hours in a day is a nap, or a watch that was not worn, not a night: it is left out, not counted as a short night. */
export const MIN_NIGHT_HOURS = 2;

const msOf = (value) => {
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Daily readings from the samples HealthKit gives back, for the `days` days ending `today`.
 *   restingHr   quantity samples ({ startDate, quantity }): the latest sample of each day
 *   hrv         quantity samples: the average of each day's samples
 *   sleep       category samples ({ startDate, endDate, value }): the time asleep, each night, with overlapping samples (two devices
 *               recording the same night) counted once
 * @returns {Record<string, { restingHeartRate?: number, hrv?: number, sleepHours?: number }>}
 */
export function readingsFromHealthKit({ restingHr = [], hrv = [], sleep = [] } = {}, today, days) {
  const window = new Set(lastDays(today, days));
  const out = {};
  const put = (day, field, value) => {
    const kept = cleanReading(field, value);
    if (kept === null || !window.has(day)) return;
    out[day] = { ...out[day], [field]: kept };
  };

  const latestByDay = {};
  for (const sample of restingHr || []) {
    const day = dayKeyOf(sample?.startDate);
    const at = msOf(sample?.startDate);
    if (day && at !== null && (!latestByDay[day] || at > latestByDay[day].at)) latestByDay[day] = { at, value: sample.quantity };
  }
  for (const day of Object.keys(latestByDay)) put(day, 'restingHeartRate', latestByDay[day].value);

  const hrvByDay = {};
  for (const sample of hrv || []) {
    const day = dayKeyOf(sample?.startDate);
    const n = Number(sample?.quantity);
    if (day && Number.isFinite(n)) (hrvByDay[day] = hrvByDay[day] || []).push(n);
  }
  for (const day of Object.keys(hrvByDay)) put(day, 'hrv', hrvByDay[day].reduce((a, b) => a + b, 0) / hrvByDay[day].length);

  const asleepByDay = {};
  for (const sample of sleep || []) {
    if (!ASLEEP_VALUES.has(sample?.value) && !ASLEEP_NAMES.has(sample?.value)) continue;
    const start = msOf(sample.startDate);
    const end = msOf(sample.endDate);
    if (start === null || end === null || end <= start) continue;
    const day = dayKeyOf(new Date(end + NIGHT_SHIFT_MS));
    (asleepByDay[day] = asleepByDay[day] || []).push([start, end]);
  }
  for (const day of Object.keys(asleepByDay)) {
    const hours = unionMs(asleepByDay[day]) / HOUR_MS;
    if (hours >= MIN_NIGHT_HOURS) put(day, 'sleepHours', hours);
  }
  return out;
}

/** The total length of a list of [start, end] spans in milliseconds, with the parts where spans overlap counted once. */
function unionMs(spans) {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [from, to] = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    if (start > to) {
      total += to - from;
      from = start;
      to = end;
    } else if (end > to) {
      to = end;
    }
  }
  return total + (to - from);
}

// -- Trends ----------

/** The `days` day keys ending `today`, oldest first. Empty for a bad day, or a count that is not a whole number above 0. */
export function lastDays(today, days) {
  if (!parseDateKey(today) || !Number.isInteger(days)) return [];
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(shiftDateKey(today, -i));
  return out;
}

/** { day: value } for one reading, from a history. */
export function readingByDay(history, field) {
  const clean = normalizeReadings(history);
  const out = {};
  for (const day of Object.keys(clean)) if (clean[day][field] !== undefined) out[day] = clean[day][field];
  return out;
}

/** { day: weight } from the weight log: the last weight logged each day, in pounds or kilograms. */
export function weightByDay(logs, { pounds = false } = {}) {
  const latest = {};
  for (const log of Array.isArray(logs) ? logs : []) {
    const kg = Number(log?.weightKg);
    const stamp = log?.createdAtLocal ?? log?.createdAt;
    const day = dayKeyOf(stamp);
    const at = msOf(typeof stamp?.toDate === 'function' ? stamp.toDate() : stamp);
    if (!day || at === null || typeof log?.weightKg === 'boolean') continue;
    if (!Number.isFinite(kg) || kg <= 0) continue;
    if (!latest[day] || at >= latest[day].at) latest[day] = { at, kg };
  }
  const out = {};
  for (const day of Object.keys(latest)) out[day] = tenth(pounds ? latest[day].kg * KG_TO_LB : latest[day].kg);
  return out;
}

/** How many readings each of two periods needs before they are compared. */
export const MIN_READINGS_TO_COMPARE = 3;

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * The trend of one reading over the `days` days ending `today`.
 * points        one per day, oldest first: { day, value } with value null where there is no reading
 * count         how many days have a reading
 * latest        { day, value } of the newest reading in the window, or null
 * average       the average of the readings in the window, or null with none
 * min, max       the lowest and highest reading in the window, or null with none
 * change        the average minus the average of the `days` days before the window, or null unless both periods have at least
 *               MIN_READINGS_TO_COMPARE readings
 */
export function trendSeries(valuesByDay, today, days) {
  const map = valuesByDay && typeof valuesByDay === 'object' ? valuesByDay : {};
  const valueOn = (day) => (Number.isFinite(map[day]) ? map[day] : null);
  const keys = lastDays(today, days);
  const points = keys.map((day) => ({ day, value: valueOn(day) }));
  const have = points.filter((p) => p.value !== null);
  const earlier = lastDays(shiftDateKey(today, -days), days).map(valueOn).filter((v) => v !== null);
  const average = have.length ? mean(have.map((p) => p.value)) : null;
  const comparable = have.length >= MIN_READINGS_TO_COMPARE && earlier.length >= MIN_READINGS_TO_COMPARE;
  return {
    days,
    points,
    count: have.length,
    latest: have.length ? have[have.length - 1] : null,
    average,
    min: have.length ? Math.min(...have.map((p) => p.value)) : null,
    max: have.length ? Math.max(...have.map((p) => p.value)) : null,
    change: comparable ? average - mean(earlier) : null,
  };
}

// -- Drawing ----------

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Where to draw a trend in a box of `width` x `height`: a dot for each reading and a line through each run of consecutive days that
 * all have one. A gap in the days is a gap in the line. The up-and-down scale is fitted to the readings shown (it does not start at
 * zero, since a trend is about change) with room above and below.
 * @returns {{ dots: { index: number, day: string, value: number, x: number, y: number }[], paths: string[] } | null} null with no readings
 */
export function trendGeometry(points, width, height, pad = { top: 12, bottom: 8, left: 10, right: 10 }) {
  const list = Array.isArray(points) ? points : [];
  const values = list.map((p) => p.value).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!values.length) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const room = (hi - lo) * 0.15 || 1;
  const low = lo - room;
  const high = hi + room;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xAt = (i) => (list.length > 1 ? pad.left + (i / (list.length - 1)) * innerW : pad.left + innerW / 2);
  const yAt = (v) => pad.top + (1 - (v - low) / (high - low)) * innerH;

  const dots = [];
  const paths = [];
  let run = [];
  const closeRun = () => {
    if (run.length > 1) paths.push(run.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x} ${d.y}`).join(' '));
    run = [];
  };
  list.forEach((p, i) => {
    if (typeof p.value !== 'number' || !Number.isFinite(p.value)) {
      closeRun();
      return;
    }
    const dot = { index: i, day: p.day, value: p.value, x: round1(xAt(i)), y: round1(yAt(p.value)) };
    dots.push(dot);
    run.push(dot);
  });
  closeRun();
  return { dots, paths };
}

/** The dot nearest to a touch at `x` (a tap anywhere on the chart picks a reading), or null with no dots. The earlier one wins a tie. */
export function nearestDot(dots, x) {
  let best = null;
  for (const dot of Array.isArray(dots) ? dots : []) {
    if (best === null || Math.abs(dot.x - x) < Math.abs(best.x - x)) best = dot;
  }
  return best;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 14" for a day key; the key itself for anything that is not one. */
export function shortDay(day) {
  const date = parseDateKey(day);
  return date ? `${MONTHS[date.getMonth()]} ${date.getDate()}` : String(day);
}

/** The reading as it is written beside a chart: "58 bpm", "7.4 h", "176.4 lb". */
export function formatValue(value, { decimals = 0, unit = '' } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const text = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return unit ? `${text} ${unit}` : text;
}

/** A change written with its sign: "+2 bpm", "-0.4 h", and "no change" when it rounds to nothing. */
export function formatChange(change, { decimals = 0, unit = '' } = {}) {
  if (typeof change !== 'number' || !Number.isFinite(change)) return '';
  const rounded = Number(change.toFixed(decimals));
  if (rounded === 0) return 'no change';
  const text = formatValue(Math.abs(rounded), { decimals, unit });
  return `${rounded > 0 ? '+' : '-'}${text}`;
}

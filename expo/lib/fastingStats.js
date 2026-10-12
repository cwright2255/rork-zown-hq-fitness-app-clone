// lib/fastingStats.js
//
// Everything the Fasting widget works out from its saved fasts: the streak, the
// bars for the week, month and year charts, and the two "does fasting go with
// this?" charts (weight and calories). Pure functions, so they are easy to test.
//
// A saved fast is { id, startedAt, endedAt, targetHours, plan }. It "met its
// goal" when it ran at least targetHours, and it belongs to the calendar day
// (in the phone's time zone) it ENDED on, the way a fast that runs from 8 PM
// to noon is the morning's fast.

import { buildHistory } from './nutritionHistory';
import { localDateKey, parseDateKey, shiftDateKey } from './localDate';
import { MAX_FAST_HOURS } from './fastingPlans';

const HOUR = 3600000;
const DAY = 24 * HOUR;

/** A fast shorter than this is a start tapped by mistake; it is not saved. */
export const MIN_SAVED_FAST_MS = 10 * 60 * 1000;
/** How far back the start of a running fast can be moved. */
export const MAX_BACKDATE_MS = MAX_FAST_HOURS * HOUR;
/** Fewest dots before a correlation chart says anything about the pattern. */
export const MIN_CORRELATION_POINTS = 5;
/** Two weigh-in weeks further apart than this are not compared. */
export const MAX_WEIGHT_GAP_WEEKS = 4;

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

function toDate(v) {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) d = v;
  else if (typeof v.toDate === 'function') d = v.toDate(); // a Firestore Timestamp
  else d = new Date(v);
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

/** A saved fast with real Dates, or null when it can not be a fast (no times, or it ends before it starts). */
export function normalizeFast(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const startedAt = toDate(raw.startedAt);
  const endedAt = toDate(raw.endedAt);
  if (!startedAt || !endedAt || endedAt.getTime() <= startedAt.getTime()) return null;
  const target = Number(raw.targetHours);
  return {
    id: raw.id != null ? String(raw.id) : String(startedAt.getTime()),
    startedAt,
    endedAt,
    targetHours: Number.isFinite(target) && target > 0 ? target : 16,
    plan: typeof raw.plan === 'string' ? raw.plan : null,
  };
}

const cleanList = (history) => (Array.isArray(history) ? history : []).map(normalizeFast).filter(Boolean);

export const fastHours = (f) => (f.endedAt.getTime() - f.startedAt.getTime()) / HOUR;
export const metGoal = (f) => f.endedAt.getTime() - f.startedAt.getTime() >= f.targetHours * HOUR;
export const fastDay = (f) => localDateKey(f.endedAt);

/**
 * The fast to save when a running one ends: its times, target and plan, how long
 * it ran, and whether it made its goal. The end is never before the start.
 */
export function finishFast(active, endedAt = new Date()) {
  const startedAt = toDate(active && active.startedAt);
  if (!startedAt) return null;
  const end = new Date(Math.max(toDate(endedAt)?.getTime() ?? Date.now(), startedAt.getTime()));
  const target = Number(active.targetHours);
  const targetHours = Number.isFinite(target) && target > 0 ? target : 16;
  const ms = end.getTime() - startedAt.getTime();
  return {
    id: String(startedAt.getTime()),
    startedAt,
    endedAt: end,
    targetHours,
    plan: typeof active.plan === 'string' ? active.plan : null,
    hours: round2(ms / HOUR),
    completed: ms >= targetHours * HOUR,
    saveable: ms >= MIN_SAVED_FAST_MS,
  };
}

// ---------------------------------------------------------------- streak

/**
 * The streak: days in a row with at least one fast that made its goal.
 * `current` stays alive through today (a day that is not over yet), so a streak
 * that ran through yesterday still counts until midnight tonight.
 */
export function streaks(history, now = new Date()) {
  const days = new Set();
  cleanList(history).forEach((f) => { if (metGoal(f)) days.add(fastDay(f)); });
  const today = localDateKey(now);
  const todayDone = days.has(today);

  let cursor = todayDone ? today : shiftDateKey(today, -1);
  let current = 0;
  while (cursor && days.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let prev = null;
  [...days].sort().forEach((key) => {
    run = prev && shiftDateKey(prev, 1) === key ? run + 1 : 1;
    if (run > best) best = run;
    prev = key;
  });
  return { current, best, todayDone, goalDays: days.size };
}

// ---------------------------------------------------------------- bar charts

export const CHART_RANGES = ['week', 'month', 'year'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The top of a bar chart: a multiple of 4 hours, never under 8. */
export function niceMax(value) {
  return Math.max(8, Math.ceil((Number.isFinite(value) ? value : 0) / 4) * 4);
}

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function summarize(fasts) {
  const hours = fasts.map(fastHours);
  return {
    fasts: fasts.length,
    avgHours: fasts.length ? round1(hours.reduce((a, b) => a + b, 0) / fasts.length) : 0,
    goalsMet: fasts.filter(metGoal).length,
    longestHours: fasts.length ? round1(Math.max(...hours)) : 0,
  };
}

/**
 * Bars for a range, oldest first, ending today:
 *   week  - the last 7 days, hours fasted on each (fasts counted on the day they end)
 *   month - the last 30 days, the same
 *   year  - the last 12 months, the AVERAGE length of that month's fasts
 * Each bar: { key, label, showLabel, value (hours), met, fasts }. `met` is whether the
 * day had a fast that made its goal (a month: whether its average did).
 */
export function chartSeries(history, range, now = new Date()) {
  const list = cleanList(history);

  if (range === 'year') {
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    const months = [];
    for (let i = 11; i >= 0; i -= 1) months.push(new Date(base.getFullYear(), base.getMonth() - i, 1));
    const byMonth = new Map(months.map((m) => [monthKey(m), []]));
    list.forEach((f) => {
      const bucket = byMonth.get(monthKey(f.endedAt));
      if (bucket) bucket.push(f);
    });
    const bars = months.map((m) => {
      const fasts = byMonth.get(monthKey(m));
      const avg = fasts.length ? fasts.reduce((s, f) => s + fastHours(f), 0) / fasts.length : 0;
      const avgTarget = fasts.length ? fasts.reduce((s, f) => s + f.targetHours, 0) / fasts.length : 0;
      return {
        key: monthKey(m),
        label: MONTHS[m.getMonth()].slice(0, 1),
        fullLabel: MONTHS[m.getMonth()],
        showLabel: true,
        value: round1(avg),
        met: fasts.length > 0 && avg >= avgTarget,
        fasts: fasts.length,
      };
    });
    const inRange = [].concat(...months.map((m) => byMonth.get(monthKey(m))));
    const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
    return { range, bars, max, ticks: [0, max / 2, max], summary: summarize(inRange), empty: inRange.length === 0 };
  }

  const days = range === 'month' ? 30 : 7;
  const endKey = localDateKey(now);
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) keys.push(shiftDateKey(endKey, -i));
  const byDay = new Map(keys.map((k) => [k, []]));
  list.forEach((f) => {
    const bucket = byDay.get(fastDay(f));
    if (bucket) bucket.push(f);
  });
  const bars = keys.map((key, i) => {
    const fasts = byDay.get(key);
    const date = parseDateKey(key);
    return {
      key,
      label: range === 'month' ? String(date.getDate()) : WEEKDAYS[date.getDay()],
      fullLabel: `${WEEKDAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`,
      showLabel: range === 'month' ? (days - 1 - i) % 5 === 0 : true,
      value: round1(fasts.reduce((s, f) => s + fastHours(f), 0)),
      met: fasts.some(metGoal),
      fasts: fasts.length,
    };
  });
  const inRange = [].concat(...keys.map((k) => byDay.get(k)));
  const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  return { range, bars, max, ticks: [0, max / 2, max], summary: summarize(inRange), empty: inRange.length === 0 };
}

// ---------------------------------------------------------------- correlation

/**
 * A straight line through dots [{x, y}]: { n, slope, intercept, r }. `r` (how closely
 * the dots follow the line, -1 to 1) is null with fewer than 3 dots or when all the x
 * or all the y values are the same. The slope and intercept are null with fewer than 2
 * dots or when all x are the same.
 */
export function linearFit(points) {
  const pts = (Array.isArray(points) ? points : []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  if (n < 2) return { n, slope: null, intercept: null, r: null };
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  pts.forEach((p) => {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  });
  if (sxx === 0) return { n, slope: null, intercept: null, r: null };
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = n >= 3 && syy > 0 ? Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))) : null;
  return { n, slope, intercept, r };
}

const average = (nums) => nums.reduce((a, b) => a + b, 0) / nums.length;

function weekStartKey(key) {
  const d = parseDateKey(key);
  return shiftDateKey(key, -((d.getDay() + 6) % 7)); // the Monday on or before the day
}
const daysBetweenKeys = (a, b) => Math.round((parseDateKey(b) - parseDateKey(a)) / DAY);

/**
 * Fasting against weight. Weigh-ins are averaged by week (Monday to Sunday). For each
 * pair of neighbouring weeks that both have a weigh-in (no more than MAX_WEIGHT_GAP_WEEKS
 * apart) and that had fasts in between, one dot:
 *   x = the average length of the fasts since the first week, in hours
 *   y = how much the weekly average weight changed, per week, in kg
 * Returns { points, fit } (see linearFit).
 */
export function weightCorrelation(history, weightLogs) {
  const fasts = cleanList(history);
  const weeks = new Map();
  (Array.isArray(weightLogs) ? weightLogs : []).forEach((log) => {
    const kg = Number(log && log.weightKg);
    const when = toDate(log && (log.createdAtLocal || log.createdAt));
    if (!(kg > 0) || !when) return;
    const wk = weekStartKey(localDateKey(when));
    const cur = weeks.get(wk) || { sum: 0, n: 0 };
    cur.sum += kg;
    cur.n += 1;
    weeks.set(wk, cur);
  });
  const keys = [...weeks.keys()].sort();
  const points = [];
  for (let i = 1; i < keys.length; i += 1) {
    const from = keys[i - 1];
    const to = keys[i];
    const gapWeeks = Math.round(daysBetweenKeys(from, to) / 7);
    if (gapWeeks < 1 || gapWeeks > MAX_WEIGHT_GAP_WEEKS) continue;
    const firstDay = shiftDateKey(from, 7);
    const lastDay = shiftDateKey(to, 6);
    const between = fasts.filter((f) => {
      const day = fastDay(f);
      return day >= firstDay && day <= lastDay;
    });
    if (!between.length) continue;
    const change = weeks.get(to).sum / weeks.get(to).n - weeks.get(from).sum / weeks.get(from).n;
    points.push({
      x: round2(average(between.map(fastHours))),
      y: round2(change / gapWeeks),
      label: to,
      weeks: gapWeeks,
    });
  }
  return { points, fit: linearFit(points) };
}

/**
 * Fasting against food. For each day that has food in the diary and a fast that ended
 * that day, one dot:
 *   x = the longest fast that ended that day, in hours
 *   y = the calories logged that day
 * `meals` is the diary's meal list; `days` how far back to look.
 */
export function calorieCorrelation(history, meals, { now = new Date(), days = 30 } = {}) {
  const fasts = cleanList(history);
  const byDay = new Map();
  fasts.forEach((f) => {
    const day = fastDay(f);
    byDay.set(day, Math.max(byDay.get(day) || 0, fastHours(f)));
  });
  const points = [];
  buildHistory(meals, { endKey: localDateKey(now), days }).forEach((d) => {
    if (!d.logged || !(d.calories > 0) || !byDay.has(d.date)) return;
    points.push({ x: round2(byDay.get(d.date)), y: Math.round(d.calories), label: d.date });
  });
  return { points, fit: linearFit(points) };
}

/** 'none' | 'weak' | 'moderate' | 'strong' for a correlation (null counts as none). */
export function correlationStrength(r) {
  const a = Math.abs(Number(r));
  if (!Number.isFinite(a) || a < 0.2) return 'none';
  if (a < 0.4) return 'weak';
  if (a < 0.7) return 'moderate';
  return 'strong';
}

const ADVERB = { weak: 'slightly', moderate: 'moderately', strong: 'clearly' };
const PHRASES = {
  weight: { unit: 'weeks', less: 'lower weight', more: 'higher weight' },
  calories: { unit: 'days', less: 'fewer calories logged', more: 'more calories logged' },
};

/** One plain sentence about a fit, for kind 'weight' or 'calories'. Null until there are enough dots. */
export function correlationSentence(kind, fit) {
  const p = PHRASES[kind];
  if (!p || !fit || fit.n < MIN_CORRELATION_POINTS) return null;
  const strength = correlationStrength(fit.r);
  if (strength === 'none') return `No clear link between how long you fast and ${kind === 'weight' ? 'your weight' : 'what you eat'} across ${fit.n} ${p.unit}.`;
  return `Across ${fit.n} ${p.unit}, longer fasts went with ${ADVERB[strength]} ${fit.r < 0 ? p.less : p.more}.`;
}

/** "r = −0.45" (a real minus sign), or null when there is no r. */
export function formatR(r) {
  if (!Number.isFinite(r)) return null;
  const v = Math.abs(r) < 0.005 ? 0 : r; // never "−0.00"
  return `r = ${v.toFixed(2).replace('-', '−')}`;
}

// ---------------------------------------------------------------- the running fast

/** Moves a fast's start by `deltaMs`, but never into the future or more than MAX_FAST_HOURS back. */
export function shiftFastStart(current, deltaMs, now = new Date()) {
  const base = toDate(current) || now;
  const latest = now.getTime();
  const earliest = latest - MAX_BACKDATE_MS;
  return new Date(Math.min(latest, Math.max(earliest, base.getTime() + deltaMs)));
}

/** When a fast reaches its goal. */
export const goalTime = (startedAt, targetHours) => new Date(toDate(startedAt).getTime() + targetHours * HOUR);

// ---------------------------------------------------------------- words and clocks

/** "8:12 PM". Written out by hand so it reads the same on every phone and in the tests. */
export function formatClock(date) {
  const d = toDate(date);
  if (!d) return '';
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Today", "Yesterday", or "Sat, Oct 10". */
export function formatDayLabel(date, now = new Date()) {
  const d = toDate(date);
  if (!d) return '';
  const key = localDateKey(d);
  const today = localDateKey(now);
  if (key === today) return 'Today';
  if (key === shiftDateKey(today, -1)) return 'Yesterday';
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Today, 8:12 PM". */
export function formatStartLabel(date, now = new Date()) {
  return `${formatDayLabel(date, now)}, ${formatClock(date)}`;
}

/** "16h 24m", "16h", "45m". */
export function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 16 -> "16h", 15.5 -> "15.5h", 0 -> "0h". */
export function formatHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return '0h';
  return `${Math.round(n * 10) / 10}h`;
}

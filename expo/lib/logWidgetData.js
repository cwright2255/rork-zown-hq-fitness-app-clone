// lib/logWidgetData.js
//
// What the Workout History and Running Log cards on Home say, as plain functions: no React, no Firebase, no phone features, so each rule
// is unit tested. The cards (components/WorkoutHistoryWidget.jsx, RunningLogWidget.jsx, drawn by components/LogPagerCard.jsx) only draw
// what these return.
//
// The three pages follow the filters on the full screens they open (app/profile/workout-history.jsx and running-log.jsx): "Last 7 days"
// is the Week filter (the 7 days up to now), "This month" is the Month filter (the calendar month) and "All logged" is All (every record
// the app holds, which is the most recent 240 at most). A page counts the records the full log lists after the same filter, and the
// "All logged" page is the same set of totals as the stats at the top of the full log.
import { dateLabel } from './calendarEvents';
import { dayKeyOf, localDateKey, shiftDateKey } from './localDate';
import { formatDistance } from './distanceUnits';
import { activityOf, paceLabel, runTime, summarizeRuns } from './runStats';
import { runTitle } from './runDetail';

const DAY_MS = 24 * 60 * 60 * 1000;

export const LOG_PERIODS = [
  { key: 'week', title: 'Last 7 days' },
  { key: 'month', title: 'This month' },
  { key: 'all', title: 'All logged' },
];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** When a saved workout finished, in ms, or NaN. The full log reads completedAt then timestamp; a record from the server may carry only `date`. */
function workoutMs(w) {
  const raw = w.completedAt || w.date || w.timestamp;
  if (!raw || typeof raw === 'boolean') return NaN;
  return new Date(typeof raw.toDate === 'function' ? raw.toDate() : raw).getTime();
}

/** Whether a moment (ms, or NaN for a record with no usable time) is in a page's period. "All logged" takes every record, dated or not. */
function inPeriod(ms, key, now) {
  if (key === 'all') return true;
  if (!Number.isFinite(ms)) return false;
  if (key === 'week') return ms >= now.getTime() - 7 * DAY_MS;
  const d = new Date(ms);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/** "2h 5m" from an hour up, "45m" under one (the way both full logs write a total time). */
export function hoursMinutes(seconds) {
  const total = Math.max(0, Math.floor(num(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "Today", "Yesterday", or the day ("Wed, Oct 14") of a moment in ms. */
function whenLabel(ms, now) {
  const key = dayKeyOf(ms);
  const today = localDateKey(now);
  if (key === today) return 'Today';
  if (key === shiftDateKey(today, -1)) return 'Yesterday';
  return dateLabel(key);
}

/** The newest of { item, ms } entries that have a time, or null. The first one wins a tie. */
function newest(entries) {
  let best = null;
  for (const e of entries) {
    if (Number.isFinite(e.ms) && (!best || e.ms > best.ms)) best = e;
  }
  return best;
}

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * The Workout History card: { empty, total, pages, latest, sentence }.
 *  pages    one per LOG_PERIODS entry, { key, title, right, stats: [{ value, label }] } with Workouts, Calories and Time
 *  latest   the newest workout, { title, when, line } ("Full Body", "Today", "Full Body, a middle dot, Today"), or null
 *  sentence the whole card in words, for a screen reader
 * `workouts` is the workout store's completedWorkouts in any order (the server list is newest first, the local one oldest first).
 */
export function workoutHistorySummary({ workouts, now = new Date() } = {}) {
  const list = (Array.isArray(workouts) ? workouts : []).filter((w) => w && typeof w === 'object');
  const dated = list.map((w) => ({ item: w, ms: workoutMs(w) }));

  const pages = LOG_PERIODS.map(({ key, title }) => {
    const inside = dated.filter((e) => inPeriod(e.ms, key, now)).map((e) => e.item);
    const calories = Math.round(inside.reduce((sum, w) => sum + num(w.caloriesBurned), 0)).toLocaleString();
    const time = hoursMinutes(inside.reduce((sum, w) => sum + num(w.duration), 0));
    return {
      key,
      title,
      right: '',
      stats: [
        { value: String(inside.length), label: 'Workouts' },
        { value: calories, label: 'Calories' },
        { value: time, label: 'Time' },
      ],
    };
  });

  const last = newest(dated);
  let latest = null;
  if (last) {
    const title = typeof last.item.name === 'string' && last.item.name.trim() ? last.item.name.trim() : 'Workout';
    const when = whenLabel(last.ms, now);
    latest = { title, when, line: `${title} \u00B7 ${when}` };
  }

  const words = pages
    .map((p) => `${p.title}: ${p.stats[0].value} ${plural(Number(p.stats[0].value), 'workout', 'workouts')}, ${p.stats[1].value} calories, ${p.stats[2].value}`)
    .join('. ');
  const sentence = list.length === 0
    ? 'Workout history: no workouts yet'
    : `Workout history. ${words}${latest ? `. Latest: ${latest.line}` : ''}`;

  return { empty: list.length === 0, total: list.length, pages, latest, sentence };
}

/**
 * The Running Log card, same shape as workoutHistorySummary: { empty, total, pages, latest, sentence }.
 *  pages    { key, title, right ("3 runs", or "3 activities" once a walk is saved), stats: Distance, Time and Avg pace }
 *  latest   the newest run or walk, { title, when, line } ("Evening Run, 5.2 mi", "Today", "Evening Run, 5.2 mi, a middle dot, Today"), or null
 * `runs` is the running store's runs in any order. `units` is Settings > Distance Units ('imperial' is miles, anything else km).
 * The average pace is the one the full log works out (runs only when there are any, otherwise walks).
 */
export function runningLogSummary({ runs, units, now = new Date() } = {}) {
  const list = (Array.isArray(runs) ? runs : []).filter((r) => r && typeof r === 'object');
  const dated = list.map((r) => {
    const t = runTime(r);
    return { item: r, ms: t > 0 ? t : NaN };
  });
  const noun = list.some((r) => activityOf(r) === 'walk') ? ['activity', 'activities'] : ['run', 'runs'];

  const pages = LOG_PERIODS.map(({ key, title }) => {
    const inside = dated.filter((e) => inPeriod(e.ms, key, now)).map((e) => e.item);
    const s = summarizeRuns(inside);
    return {
      key,
      title,
      right: `${s.totalRuns} ${plural(s.totalRuns, noun[0], noun[1])}`,
      stats: [
        { value: formatDistance(s.totalDistance, units, 1), label: 'Distance' },
        { value: hoursMinutes(s.totalDuration), label: 'Time' },
        { value: paceLabel(s.avgPace, units), label: 'Avg pace' },
      ],
    };
  });

  const last = newest(dated);
  let latest = null;
  if (last) {
    const title = `${last.item.route || runTitle(last.item)}, ${formatDistance(last.item.distance, units, 1)}`;
    const when = whenLabel(last.ms, now);
    latest = { title, when, line: `${title} \u00B7 ${when}` };
  }

  const words = pages
    .map((p) => `${p.title}: ${p.right}, ${p.stats[0].value}, ${p.stats[1].value}${p.stats[2].value === '--' ? '' : `, average pace ${p.stats[2].value}`}`)
    .join('. ');
  const sentence = list.length === 0
    ? 'Running log: no runs yet'
    : `Running log. ${words}${latest ? `. Latest: ${latest.line}` : ''}`;

  return { empty: list.length === 0, total: list.length, pages, latest, sentence };
}

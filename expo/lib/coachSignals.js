// lib/coachSignals.js
//
// The day-to-day readings the AI Coach is told about, as plain sentences: the latest recovery reading, water, steps,
// fasting, the last week of eating, and calories burned against the burn goal. Each function returns a sentence, or
// null when that reading is missing, stale or not a real number, so the Coach is never handed a placeholder, a
// zero that only means "not recorded", or a number from another day. Pure functions: the stores are read by
// services/coachSnapshotService.js, which passes the values in.
import { localDateKey, shiftDateKey } from './localDate';
import { buildHistory, summarizeHistory } from './nutritionHistory';
import { fastHours, metGoal, formatDuration, formatHours } from './fastingStats';

const HOUR = 3600000;
const DAY = 24 * HOUR;

const positive = (v) => {
  const n = Number(v);
  return v !== null && v !== '' && typeof v !== 'boolean' && Number.isFinite(n) && n > 0 ? n : null;
};
const oneDecimal = (n) => Math.round(n * 10) / 10;
const thousands = (n) => Math.round(n).toLocaleString('en-US');

/**
 * The latest resting heart rate, HRV and sleep from the connected source (healthStore.rookRecovery). Apple Health
 * reports HRV as SDNN and ROOK devices as RMSSD, which are different measures, so the name is given and the Coach is
 * told there is no personal baseline here to call a reading high or low against.
 */
export function recoveryLine(recovery) {
  if (!recovery || typeof recovery !== 'object') return null;
  const hr = positive(recovery.restingHeartRate);
  const hrv = positive(recovery.hrv);
  const sleep = positive(recovery.sleepHours);
  const efficiency = positive(recovery.sleepEfficiency);
  const source = typeof recovery.source === 'string' && recovery.source.trim() ? recovery.source.trim() : 'a connected device';
  const parts = [];
  if (hr) parts.push(`resting heart rate ${Math.round(hr)} bpm`);
  if (hrv) parts.push(`HRV ${Math.round(hrv)} ms (${/apple/i.test(source) ? 'SDNN' : 'RMSSD'}), with no personal baseline recorded so do not call it high or low`);
  if (sleep) parts.push(`sleep ${oneDecimal(sleep)} h${efficiency ? ` (efficiency ${Math.round(efficiency)}%)` : ''}`);
  if (!parts.length) return null;
  return `Latest recovery reading from ${source}: ${parts.join(', ')}.`;
}

/**
 * Glasses of water logged today (healthStore.hydration), only if that count belongs to today. Nothing logged yet
 * says nothing, since an untouched counter is also what someone who never uses it has.
 */
export function waterLine(hydration, todayKey) {
  if (!hydration || typeof hydration !== 'object' || hydration.date !== todayKey) return null;
  const glasses = Number(hydration.glasses);
  const target = positive(hydration.target);
  if (!Number.isFinite(glasses) || glasses <= 0 || !target) return null;
  return `Water logged today: ${Math.round(glasses)} of ${Math.round(target)} glasses.`;
}

/** Steps so far today, from healthStore.getTodaySteps() (null when the saved count is not from today). */
export function stepsLine(todaySteps) {
  if (todaySteps === null || todaySteps === undefined || typeof todaySteps === 'boolean') return null;
  const n = Number(todaySteps);
  if (!Number.isFinite(n) || n < 0) return null;
  return `Steps so far today: ${thousands(n)}.`;
}

/**
 * Fasting: the fast running now, and the fasts finished in the last 7 days.
 * `active` is { startedAt, targetHours } or null; `history` is the finished fasts (lib/fastingStats normalizeFast
 * shape), or null/undefined when they could not be read, in which case nothing is said about them.
 * Returns a list of 0-2 sentences.
 */
export function fastingLines(active, history, now = new Date()) {
  const lines = [];
  const nowMs = now.getTime();

  const startedMs = active && active.startedAt ? new Date(active.startedAt).getTime() : NaN;
  if (Number.isFinite(startedMs) && startedMs <= nowMs) {
    const target = positive(active.targetHours) || 16;
    const elapsed = nowMs - startedMs;
    lines.push(`Fasting right now: ${formatDuration(elapsed)} into a ${formatHours(target)} fast${elapsed >= target * HOUR ? ' (goal reached)' : ''}.`);
  }

  if (Array.isArray(history)) {
    const recent = history
      .map((f) => (f ? { startedAt: new Date(f.startedAt), endedAt: new Date(f.endedAt), targetHours: positive(f.targetHours) || 16 } : null))
      .filter((f) => {
        if (!f) return false;
        const ended = f.endedAt.getTime();
        const started = f.startedAt.getTime();
        return Number.isFinite(ended) && Number.isFinite(started) && ended > started && ended <= nowMs && ended >= nowMs - 7 * DAY;
      });
    if (recent.length) {
      const avg = recent.reduce((sum, f) => sum + fastHours(f), 0) / recent.length;
      const made = recent.filter(metGoal).length;
      lines.push(`Fasts finished in the last 7 days: ${recent.length} (average ${formatHours(avg)}, ${made} reached their goal).`);
    }
  }
  return lines;
}

/**
 * The 7 days before today in the food diary (nutritionStore.meals), worked out the way the History screen does.
 * A day with nothing logged is not counted as a day of eating nothing, and a day with only some meals logged pulls
 * the average down, which the sentence says. null when none of those days has any food in it.
 */
export function eatingLine(meals, { todayKey = localDateKey(), eatTarget = null } = {}) {
  const endKey = shiftDateKey(todayKey, -1);
  if (!endKey) return null;
  const history = buildHistory(meals, { endKey, days: 7 });
  const goal = positive(eatTarget);
  const s = summarizeHistory(history, { calories: goal || 0 });
  if (!s.loggedDays) return null;
  let line = `Food diary, the 7 days before today: food logged on ${s.loggedDays} of ${s.totalDays} days. On those days they averaged ` +
    `${thousands(s.avgCalories)} kcal, ${s.avgProtein} g protein, ${s.avgCarbs} g carbs and ${s.avgFat} g fat ` +
    '(a day with only some meals logged pulls these down).';
  if (goal && s.calorieDiff !== null) {
    line += s.calorieDiff === 0
      ? ` That matches their ${thousands(goal)} kcal eating target.`
      : ` Their eating target is ${thousands(goal)} kcal, so that is ${thousands(Math.abs(s.calorieDiff))} kcal ${s.calorieDiff < 0 ? 'under' : 'over'} it on average.`;
  }
  return line;
}

/**
 * Calories burned today against the burn goal. These are two different things from the eating target
 * (lib/calorieGoals.js), and the sentence says so, so the Coach does not mix them up.
 * Says nothing when there is neither a burn goal nor anything burned.
 */
export function burnLine({ burnedToday = null, burnTarget = null } = {}) {
  const burned = Number(burnedToday);
  const hasBurned = burnedToday !== null && burnedToday !== undefined && Number.isFinite(burned) && burned >= 0;
  const goal = positive(burnTarget);
  if (!goal && !(hasBurned && burned > 0)) return null;
  const parts = [];
  if (hasBurned) parts.push(`Calories burned today: ${thousands(burned)} kcal (workouts, runs, hikes and an estimate from steps)`);
  if (goal) parts.push(`${hasBurned ? 'their' : 'Their'} burn goal is ${thousands(goal)} kcal a day`);
  return `${parts.join('; ')}.${goal ? ' The burn goal is separate from the eating target.' : ''}`;
}

/** All of the above as a list of sentences, in a fixed order, with the missing ones left out. */
export function buildSignalLines({
  now = new Date(), recovery = null, hydration = null, todaySteps = null,
  fastActive = null, fastHistory = null, meals = [], eatTarget = null, burnedToday = null, burnTarget = null,
} = {}) {
  const todayKey = localDateKey(now);
  return [
    recoveryLine(recovery),
    waterLine(hydration, todayKey),
    stepsLine(todaySteps),
    ...fastingLines(fastActive, fastHistory, now),
    eatingLine(meals, { todayKey, eatTarget }),
    burnLine({ burnedToday, burnTarget }),
  ].filter(Boolean);
}

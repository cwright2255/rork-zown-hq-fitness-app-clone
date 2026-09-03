// lib/stepsMetrics.js
//
// Pure computation layer for the Steps widget, mirroring
// lib/calorieMetrics.js's real, honest-empty-state approach exactly.
// Real numbers derived from store/healthStore.js's stepsHistory
// ({date: count}), which only began recording real per-day step counts
// once that feature shipped - there is no way to backfill genuine
// history from before that point, so Trends/Lifetime here will show
// real, honest data that simply starts small and grows for real over
// time, the same way calorieMetrics.js's own history-dependent fields
// do, rather than any fabricated backfill.
//
// "Breakdown" here means real activity pattern by day of week (e.g.
// Saturdays busier than Mondays) rather than by category the way
// calories' breakdown works - steps have no natural category, and this
// app has no intraday timestamp data to break a single day's total
// down any further than that (the same constraint calorieMetrics.js
// already documents for its own domain).

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

export function computeStepsMetrics(stepsHistory, stepsGoal) {
  const history = stepsHistory || {};
  const dayKeys = Object.keys(history).sort();

  const today = new Date();
  const todayKey = dayKey(today);
  const todaySteps = history[todayKey] || 0;

  // Streak: consecutive real days (walking backward from today) that
  // met or exceeded the goal. Requires a real goal - 0 with none set,
  // never a fabricated number.
  let streak = 0;
  if (stepsGoal && stepsGoal > 0) {
    let cursor = new Date(today);
    for (;;) {
      const key = dayKey(cursor);
      const dayTotal = history[key] || 0;
      if (dayTotal >= stepsGoal) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // 7-day moving average and cumulative weekly total - real days only;
  // a day with no recorded entry (either not tracked yet, or genuinely
  // 0 steps) counts as 0 rather than being skipped, an honest average
  // of actual activity, not just active days.
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last7.push(history[dayKey(d)] || 0);
  }
  const weeklyTotal = last7.reduce((sum, v) => sum + v, 0);
  const sevenDayAverage = weeklyTotal / 7;

  // Previous 7-day window, for week-over-week velocity.
  const prev7 = [];
  for (let i = 7; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    prev7.push(history[dayKey(d)] || 0);
  }
  const prevWeeklyTotal = prev7.reduce((sum, v) => sum + v, 0);
  const velocity = weeklyTotal - prevWeeklyTotal;

  // Historical average for today's specific weekday (e.g. every past
  // Tuesday), from real history only - null if this weekday has no
  // history yet rather than a misleading 0.
  const todayWeekday = today.getDay();
  const sameWeekdayTotals = dayKeys
    .filter((k) => new Date(k).getDay() === todayWeekday)
    .map((k) => history[k]);
  const historicalDailyAverage = sameWeekdayTotals.length
    ? sameWeekdayTotals.reduce((sum, v) => sum + v, 0) / sameWeekdayTotals.length
    : null;

  // Real day-of-week breakdown - average steps for each weekday across
  // all real tracked history so far. null (not 0) for a weekday with no
  // history yet.
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const k of dayKeys) {
    const wd = new Date(k).getDay();
    weekdayTotals[wd] += history[k];
    weekdayCounts[wd] += 1;
  }
  const weekdayBreakdown = DAY_NAMES.map((name, i) => ({
    day: name,
    averageSteps: weekdayCounts[i] ? Math.round(weekdayTotals[i] / weekdayCounts[i]) : null,
  }));

  // Lifetime totals - real, since real per-day tracking began.
  const lifetimeSteps = dayKeys.reduce((sum, k) => sum + history[k], 0);
  const bestDay = dayKeys.length ? Math.max(...dayKeys.map((k) => history[k])) : 0;
  const averagePerTrackedDay = dayKeys.length ? lifetimeSteps / dayKeys.length : null;

  return {
    todaySteps,
    stepsGoal: stepsGoal ?? null,
    streak,
    weeklyTotal,
    sevenDayAverage,
    velocity,
    historicalDailyAverage,
    weekdayBreakdown,
    lifetimeSteps,
    bestDay,
    averagePerTrackedDay,
    totalDaysTracked: dayKeys.length,
  };
}

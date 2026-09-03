// lib/calorieMetrics.js
//
// Pure computation layer for the Calories widget/log - real numbers
// derived from completedWorkouts (store/workoutStore.js, caloriesBurned +
// duration + category + completedAt) and runs (store/runningStore.js,
// calories + duration + startTime). No fabricated fields: this app has
// no continuous/background activity feed, so anything requiring
// intraday timestamps (hourly distribution, passive-movement calories)
// is intentionally not computed here - a single completedAt/startTime
// per session is all that's real.

// Rough, widely-cited estimate for walking-pace calorie burn: about
// 0.04 kcal per step for a ~70kg reference adult (the conservative end
// of published estimates, deliberately not overstated), scaled
// proportionally by real body weight rather than treated as a flat
// per-kg multiplier - the latter would wildly overstate the estimate
// (confirmed directly: an unscaled version of this produced ~28,800
// "calories" for 8,000 steps at 90kg, an order of magnitude too high).
// Requires a real weight in kg; returns 0 (not a fabricated guess) when
// weight isn't on file, so a missing profile field never silently
// inflates the total.
export function estimateCaloriesFromSteps(steps, weightKg) {
  if (!steps || !weightKg) return 0;
  const caloriesPerStep = 0.04 * (weightKg / 70);
  return Math.round(steps * caloriesPerStep);
}

// Normalizes a workout + run into one common shape for merging:
// { calories, durationSecs, dateStr (ISO), category, source }
function toEntries(completedWorkouts, runs) {
  const workoutEntries = (completedWorkouts || [])
    .filter((w) => w.completedAt)
    .map((w) => ({
      calories: w.caloriesBurned || 0,
      durationSecs: w.duration || 0,
      dateStr: w.completedAt,
      category: w.category || 'Workout',
      source: 'workout',
    }));
  const runEntries = (runs || [])
    .filter((r) => r.startTime)
    .map((r) => ({
      calories: r.calories || 0,
      durationSecs: r.duration || 0,
      dateStr: r.startTime,
      category: 'Running',
      source: 'run',
    }));
  return [...workoutEntries, ...runEntries].sort(
    (a, b) => new Date(a.dateStr) - new Date(b.dateStr)
  );
}

function dayKey(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10); // YYYY-MM-DD, local-agnostic bucket
}

// Sums calories per real calendar day - the building block nearly every
// other metric below is derived from.
function caloriesByDay(entries) {
  const map = {};
  for (const e of entries) {
    const key = dayKey(e.dateStr);
    map[key] = (map[key] || 0) + e.calories;
  }
  return map;
}

// stepsCalorieEstimate (see estimateCaloriesFromSteps above) is added
// only to today's total, not retroactively into weeklyTotal/
// lifetimeCalories/etc. below - those remain built purely from real
// logged workout/run entries, which have real per-day granularity going
// back as far as the user has been logging. Step history (see
// store/healthStore.js's stepsHistory) only starts being recorded going
// forward from when that feature shipped, so there is no equivalent
// real per-day step data for past days to fold into those historical
// figures - doing so would mean estimating calories for days that were
// never actually tracked, which is exactly the kind of fabrication this
// file avoids everywhere else.
export function computeCalorieMetrics(completedWorkouts, runs, dailyCalorieGoal, stepsCalorieEstimate = 0) {
  const entries = toEntries(completedWorkouts, runs);
  const byDay = caloriesByDay(entries);
  const dayKeys = Object.keys(byDay).sort();

  const today = new Date();
  const todayKey = dayKey(today.toISOString());
  const todayCalories = (byDay[todayKey] || 0) + stepsCalorieEstimate;

  // Streak: consecutive real days (walking backward from today) where
  // that day's total met or exceeded the goal. Requires a real goal -
  // returns 0 with no goal set, never a fabricated number.
  let streak = 0;
  if (dailyCalorieGoal && dailyCalorieGoal > 0) {
    let cursor = new Date(today);
    for (;;) {
      const key = dayKey(cursor.toISOString());
      const dayTotal = byDay[key] || 0;
      if (dayTotal >= dailyCalorieGoal) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // 7-day moving average and cumulative weekly burn - real days only,
  // days with zero entries genuinely count as 0, not skipped (an
  // honest average of actual activity, not just active days).
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last7.push(byDay[dayKey(d.toISOString())] || 0);
  }
  const weeklyTotal = last7.reduce((sum, v) => sum + v, 0);
  const sevenDayAverage = weeklyTotal / 7;

  // Previous 7-day window, for week-over-week velocity.
  const prev7 = [];
  for (let i = 7; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    prev7.push(byDay[dayKey(d.toISOString())] || 0);
  }
  const prevWeeklyTotal = prev7.reduce((sum, v) => sum + v, 0);
  const velocity = weeklyTotal - prevWeeklyTotal;

  // Historical daily average for today's specific weekday (e.g. every
  // past Tuesday), from real history only - null if this weekday has no
  // history yet rather than showing a misleading 0.
  const todayWeekday = today.getDay();
  const sameWeekdayTotals = dayKeys
    .filter((k) => new Date(k).getDay() === todayWeekday)
    .map((k) => byDay[k]);
  const historicalDailyAverage = sameWeekdayTotals.length
    ? sameWeekdayTotals.reduce((sum, v) => sum + v, 0) / sameWeekdayTotals.length
    : null;

  // Category breakdown - real totals grouped by each session's real
  // category field (workouts' own category, or 'Running').
  const categoryTotals = {};
  for (const e of entries) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.calories;
  }
  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, calories]) => ({ category, calories }))
    .sort((a, b) => b.calories - a.calories);

  // Burn rate per session (cal/min) - only for sessions with a real,
  // non-zero duration, so we're never dividing by zero into a fake
  // infinite rate.
  const ratedEntries = entries.filter((e) => e.durationSecs > 0);
  const burnRates = ratedEntries.map((e) => e.calories / (e.durationSecs / 60));
  const peakBurnRate = burnRates.length ? Math.max(...burnRates) : null;
  const averageBurnRate = burnRates.length
    ? burnRates.reduce((sum, v) => sum + v, 0) / burnRates.length
    : null;

  // Lifetime totals.
  const lifetimeCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const burnCeiling = dayKeys.length ? Math.max(...dayKeys.map((k) => byDay[k])) : 0;
  const caloriesPerSession = entries.length ? lifetimeCalories / entries.length : null;

  return {
    todayCalories,
    stepsCalorieEstimate,
    dailyCalorieGoal: dailyCalorieGoal ?? null,
    streak,
    weeklyTotal,
    sevenDayAverage,
    velocity,
    historicalDailyAverage,
    categoryBreakdown,
    peakBurnRate,
    averageBurnRate,
    lifetimeCalories,
    burnCeiling,
    caloriesPerSession,
    totalSessions: entries.length,
    entries, // exposed for the log screen to render directly
  };
}

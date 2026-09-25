// lib/xpMetrics.js
//
// Pure computation layer for the Total XP widget's expanded "XP
// Overview" panel - previously hardcoded, fake data (a fixed "Level 12"
// / "840 XP remaining" and an identical Mon-Sun bar chart every single
// time, regardless of the user's real level or actual activity).
// Mirrors lib/stepsMetrics.js's real, honest-empty-state approach:
// derives the last 7 real calendar days, and a week-over-week same-day
// comparison, from store/expStore.js's xpHistory ({date: amount}),
// which only starts recording real per-day totals going forward from
// when this shipped - a day before that, or any day with no activity,
// correctly shows 0, never a fabricated number.

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

export function computeXpMetrics(xpHistory) {
  const history = xpHistory || {};

  const today = new Date();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    last7.push({ day: DAY_LABELS[d.getDay()], xp: history[key] || 0 });
  }

  // Real, new: today vs the same weekday exactly one week ago (e.g.
  // "this Tuesday" vs "last Tuesday"), a direct week-over-week
  // comparison rather than a multi-week average. hasComparison
  // distinguishes "haven't tracked that far back yet" (the key is
  // genuinely missing from history - true for everyone during the
  // first week after this shipped) from a real, tracked day that
  // simply earned 0 XP - only the former should suppress the
  // percentage instead of dividing against a phantom baseline.
  const todayKey = dayKey(today);
  const todayXp = history[todayKey] || 0;
  const lastWeekDate = new Date(today);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekKey = dayKey(lastWeekDate);
  const hasLastWeekData = Object.prototype.hasOwnProperty.call(history, lastWeekKey);
  const lastWeekXp = hasLastWeekData ? history[lastWeekKey] : 0;

  let changePct = null;
  if (hasLastWeekData && lastWeekXp > 0) {
    changePct = Math.round(((todayXp - lastWeekXp) / lastWeekXp) * 100);
  }

  return {
    last7,
    weekOverWeek: {
      dayLabel: FULL_DAY_NAMES[today.getDay()],
      todayXp,
      lastWeekXp,
      hasComparison: hasLastWeekData && lastWeekXp > 0,
      changePct,
    },
  };
}

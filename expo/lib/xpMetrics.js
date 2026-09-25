// lib/xpMetrics.js
//
// Pure computation layer for the Total XP widget's expanded "XP
// Overview" panel - previously hardcoded, fake data (a fixed "Level 12"
// / "840 XP remaining" and an identical Mon-Sun bar chart every single
// time, regardless of the user's real level or actual activity).
// Mirrors lib/stepsMetrics.js's real, honest-empty-state approach:
// derives the last 7 real calendar days from store/expStore.js's
// xpHistory ({date: amount}), which only starts recording real per-day
// totals going forward from when this shipped - a day before that, or
// any day with no activity, correctly shows 0, never a fabricated
// number.

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

  return { last7 };
}

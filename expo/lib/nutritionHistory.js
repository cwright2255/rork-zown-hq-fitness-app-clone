// lib/nutritionHistory.js
//
// Totals for a day of food and for a stretch of days, worked out from the
// diary's `meals` list ({ id, date, foods: [...] } per slot per day).

import { localDateKey, shiftDateKey } from './localDate';

export const EXTRA_NUTRIENTS = ['fiber', 'sugar', 'sodium'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const listed = (v) => v != null && v !== '' && Number.isFinite(Number(v));
const tenth = (n) => Math.round(n * 10) / 10;

/**
 * Totals for a list of logged foods. `listed` counts how many foods actually
 * carry fiber, sugar or sodium, so the screen can say when a total is only
 * part of the day (a quick add has none of them).
 */
export function foodTotals(foods) {
  const out = {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    fiber: 0, sugar: 0, sodium: 0,
    foodCount: 0,
    listed: { fiber: 0, sugar: 0, sodium: 0 },
  };
  (Array.isArray(foods) ? foods : []).forEach((f) => {
    if (!f) return;
    out.foodCount += 1;
    out.calories += num(f.calories);
    out.protein += num(f.protein);
    out.carbs += num(f.carbs);
    out.fat += num(f.fat);
    EXTRA_NUTRIENTS.forEach((k) => {
      if (listed(f[k])) {
        out[k] += Number(f[k]);
        out.listed[k] += 1;
      }
    });
  });
  EXTRA_NUTRIENTS.forEach((k) => { out[k] = tenth(out[k]); });
  return out;
}

/**
 * One entry per day for the `days` days ending on `endKey`, oldest first:
 * { date, logged, ...foodTotals }. Days with no food are still there
 * (logged: false) so a chart has a gap rather than skipping the day.
 */
export function buildHistory(meals, { endKey = localDateKey(), days = 7 } = {}) {
  const byDate = new Map();
  (Array.isArray(meals) ? meals : []).forEach((m) => {
    if (!m || typeof m.date !== 'string') return;
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(...(m.foods || []));
  });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDateKey(endKey, -i);
    if (!date) continue;
    const totals = foodTotals(byDate.get(date));
    out.push({ date, logged: totals.foodCount > 0, ...totals });
  }
  return out;
}

/**
 * Averages over the days that have food in them (a day with nothing logged is
 * not a day of eating nothing). Fiber, sugar and sodium average only the days
 * where some food listed them; null when none did.
 */
export function summarizeHistory(history, goals = {}) {
  const days = Array.isArray(history) ? history : [];
  const logged = days.filter((d) => d.logged);
  const avg = (key, from = logged) => (from.length ? from.reduce((s, d) => s + d[key], 0) / from.length : null);
  const avgListed = (key) => {
    const from = logged.filter((d) => d.listed[key] > 0);
    const v = avg(key, from);
    return v === null ? null : Math.round(v);
  };
  const avgCalories = avg('calories');
  const goalCalories = goals && goals.calories > 0 ? goals.calories : null;
  return {
    totalDays: days.length,
    loggedDays: logged.length,
    avgCalories: avgCalories === null ? null : Math.round(avgCalories),
    avgProtein: logged.length ? Math.round(avg('protein')) : null,
    avgCarbs: logged.length ? Math.round(avg('carbs')) : null,
    avgFat: logged.length ? Math.round(avg('fat')) : null,
    avgFiber: avgListed('fiber'),
    avgSugar: avgListed('sugar'),
    avgSodium: avgListed('sodium'),
    goalCalories,
    calorieDiff: avgCalories === null || goalCalories === null ? null : Math.round(avgCalories) - goalCalories,
    maxCalories: Math.max(goalCalories || 0, ...days.map((d) => d.calories)),
  };
}

/**
 * The meals worth keeping on the phone: those from the last `days` days (and
 * at most `max`, newest kept). The full list stays in the cloud copy.
 */
export function keepRecentMeals(meals, { today = new Date(), days = 30, max = 250 } = {}) {
  const list = Array.isArray(meals) ? meals : [];
  const cutoff = shiftDateKey(localDateKey(today), -days);
  const recent = list.filter((m) => m && (typeof m.date !== 'string' || m.date >= cutoff));
  return recent.length > max ? recent.slice(-max) : recent;
}

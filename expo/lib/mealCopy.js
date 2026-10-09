// lib/mealCopy.js
//
// Copying a meal: which earlier meals can be copied into a slot, what to call
// them, and the new entries a copy makes.

import { MEAL_SLOTS, SLOT_IDS, foodBase, newLogId } from './foodLog';
import { localDateKey, parseDateKey, shiftDateKey } from './localDate';

/** How many days back (and the day itself) a meal can be copied from. */
export const COPY_WINDOW_DAYS = 14;

// "Rice, Chicken +1": the first few food names, so a meal can be told apart at a glance.
function previewNames(foods) {
  const names = foods.map((f) => f && f.name).filter(Boolean);
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} +${names.length - 3}` : shown;
}

const sumCalories = (foods) => (foods || []).reduce((s, f) => s + (Number(f && f.calories) || 0), 0);

/**
 * The meals that can be copied into slot `targetMealId` on `targetDate`: any
 * of the four slots, on that day or the 14 days before it, that has food in
 * it (the target slot itself is left out). The same slot comes first, then
 * newest day first, then breakfast to snack.
 */
export function listCopySources(meals, { targetDate, targetMealId, days = COPY_WINDOW_DAYS } = {}) {
  const oldest = shiftDateKey(targetDate, -days);
  if (!oldest) return [];
  const slotOrder = (id) => SLOT_IDS.indexOf(id);
  const seen = new Set();
  const out = [];
  (Array.isArray(meals) ? meals : []).forEach((m) => {
    if (!m || !SLOT_IDS.includes(m.id) || typeof m.date !== 'string') return;
    if (m.date < oldest || m.date > targetDate) return;
    if (m.date === targetDate && m.id === targetMealId) return;
    if (!Array.isArray(m.foods) || !m.foods.length) return;
    const key = `${m.date}|${m.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const slot = MEAL_SLOTS.find((s) => s.id === m.id);
    out.push({
      key,
      date: m.date,
      mealId: m.id,
      mealName: slot ? slot.name : m.id,
      foodCount: m.foods.length,
      preview: previewNames(m.foods),
      calories: Math.round(sumCalories(m.foods)),
      sameSlot: m.id === targetMealId,
    });
  });
  return out.sort((a, b) => {
    if (a.sameSlot !== b.sameSlot) return a.sameSlot ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return slotOrder(a.mealId) - slotOrder(b.mealId);
  });
}

/** "Today", "Yesterday" or a short date like "Mon, Oct 5". */
export function dayLabel(dateKey, todayKey = localDateKey()) {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === shiftDateKey(todayKey, -1)) return 'Yesterday';
  const d = parseDateKey(dateKey);
  if (!d) return String(dateKey);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * New diary entries for a copy of `foods`: each keeps its numbers, serving
 * count and one-serving values but gets its own log id, so the copy can be
 * changed or removed without touching the original.
 */
export function copyFoodEntries(foods, { now = Date.now(), random = Math.random } = {}) {
  return (Array.isArray(foods) ? foods : []).filter(Boolean).map((f, i) => ({
    ...f,
    logId: newLogId(f, now + i, random),
    base: foodBase(f),
    quantity: f.quantity > 0 ? f.quantity : 1,
  }));
}

// services/mealPlanLog.js
//
// Eating a planned meal: puts the item in the food diary (the day and meal slot
// it was planned for) and marks it as logged on the plan, so it is not logged
// twice. Only today's and earlier days' items can be logged.

import { useMealPlanStore } from '@/store/mealPlanStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { canLogEntry, entriesFor, foodForEntry } from '@/lib/mealPlan';
import { localDateKey } from '@/lib/localDate';

/** Logs one planned item. Returns { ok: true } or { ok: false, error }. */
export function logPlannedEntry(id, { todayKey = localDateKey() } = {}) {
  const plan = useMealPlanStore.getState();
  const entry = plan.entries.find((e) => e.id === id);
  if (!entry) return { ok: false, error: 'This item is no longer in your plan.' };
  if (entry.loggedAt) return { ok: false, error: 'This one is already logged.' };
  if (!canLogEntry(entry, todayKey)) return { ok: false, error: 'You can log this on its day.' };
  useNutritionStore.getState().addFoodToMeal(entry.date, entry.slot, foodForEntry(entry));
  plan.markLogged(id);
  return { ok: true };
}

/** Logs every item of a day that can be logged. Returns how many were logged. */
export function logPlannedDay(date, { todayKey = localDateKey() } = {}) {
  // Items that cannot be logged (a later day, or already logged) are turned down one by one, and not counted.
  const ids = entriesFor(useMealPlanStore.getState().entries, date).map((e) => e.id);
  return ids.filter((id) => logPlannedEntry(id, { todayKey }).ok).length;
}

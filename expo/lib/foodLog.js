// lib/foodLog.js
//
// Small pure helpers for the food diary: the four meal slots, which slot fits
// the time of day, how a food scales with the serving count, and how a logged
// entry is told apart from another entry of the same food.
//
// Every logged entry keeps `base` (the values for ONE serving) and `quantity`
// (how many servings), so a logged food can be changed later without
// guessing what one serving was.

export const MEAL_SLOTS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'snack', name: 'Snack' },
];
export const SLOT_IDS = MEAL_SLOTS.map((s) => s.id);

/** The slot that fits an hour of the day (0-23): breakfast to 10, lunch to 3 PM, dinner to 9 PM, otherwise a snack. */
export function slotForHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'snack';
  if (h < 4) return 'snack';
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

const isNum = (v) => v != null && v !== '' && Number.isFinite(Number(v));

/** The one-serving values of a food: its saved `base`, or else the food's own numbers. */
export function foodBase(food) {
  if (food && food.base && typeof food.base === 'object') return food.base;
  const f = food || {};
  return {
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    fiber: f.fiber,
    sugar: f.sugar,
    sodium: f.sodium,
    servingSize: f.servingSize || '100g',
  };
}

/**
 * The food at `quantity` servings: calories and macros as whole numbers, fiber,
 * sugar and sodium to one decimal (left out when the food has none), the
 * serving label, and the `base` and `quantity` to store with it.
 */
export function scaleFood(food, quantity = 1) {
  const q = Number(quantity) > 0 ? Number(quantity) : 1;
  const base = foodBase(food);
  const whole = (v) => Math.round((Number(v) || 0) * q);
  const tenth = (v) => Math.round(Number(v) * q * 10) / 10;
  const out = {
    calories: whole(base.calories),
    protein: whole(base.protein),
    carbs: whole(base.carbs),
    fat: whole(base.fat),
    servingSize: `${q}x ${base.servingSize || '100g'}`,
    quantity: q,
    base,
  };
  ['fiber', 'sugar', 'sodium'].forEach((k) => {
    if (isNum(base[k])) out[k] = tenth(base[k]);
  });
  return out;
}

/** What identifies a logged entry: its own log id, or for older entries the food id. */
export const foodKey = (food) => (food && (food.logId || food.id)) || null;

/** A new id for one logged entry, so two logs of the same food can be told apart. */
export function newLogId(food, now = Date.now(), random = Math.random) {
  const stamp = now.toString(36) + Math.floor(random() * 36 ** 3).toString(36);
  return `${(food && food.id) || 'food'}-${stamp}`;
}

/**
 * `meals` with `entries` added to the slot `mealId` on `date`. The slot is
 * created when that day has none yet. Returns the same list when there is
 * nothing to add.
 */
export function appendToMeals(meals, date, mealId, entries, time) {
  const list = Array.isArray(meals) ? meals : [];
  if (!Array.isArray(entries) || !entries.length) return list;
  if (!list.some((m) => m.id === mealId && m.date === date)) {
    const slot = MEAL_SLOTS.find((s) => s.id === mealId);
    const name = slot ? slot.name : String(mealId).charAt(0).toUpperCase() + String(mealId).slice(1);
    return [...list, { id: mealId, name, foods: [...entries], time, date }];
  }
  let done = false;
  return list.map((m) => {
    if (done || m.id !== mealId || m.date !== date) return m;
    done = true;
    return { ...m, foods: [...(m.foods || []), ...entries] };
  });
}

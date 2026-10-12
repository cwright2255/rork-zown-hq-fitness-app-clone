// lib/mealPlan.js
//
// The meal planner's logic: weeks and days, the entries on a plan, what a day
// adds up to, the ingredients a week needs, and the diary entry a planned meal
// becomes when it is eaten.
//
// One plan entry is one recipe or food planned for a day and a meal slot:
//   { id, date, slot, kind: 'recipe' | 'food', refId, name, servings,
//     per: { calories, protein, carbs, fat }   // for ONE serving
//     hasNutrition,                            // false: the numbers above are not real
//     imageUrl?, food?,                        // food: the food as it is logged
//     loggedAt?, updatedAt }
// It keeps its own copy of the name and numbers, so it still shows after the
// recipe is deleted or the food changes.

import { SLOT_IDS, scaleFood, foodBase } from './foodLog';
import { localDateKey, parseDateKey, shiftDateKey } from './localDate';
import { parseServings } from './recipeScale';

export const MIN_PLAN_SERVINGS = 0.5;
export const MAX_PLAN_SERVINGS = 20;
/** How much the + and - buttons change a planned item's servings by. */
export const SERVINGS_STEP = 0.5;
export const MAX_PER_SLOT = 10;
export const MAX_ENTRIES = 300;
/** Entries for days further back than this are dropped when the plan is saved. */
export const KEEP_PAST_DAYS = 30;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ---- servings -------------------------------------------------------------

/** A number of servings rounded to the nearest half and kept between 1/2 and 20; 1 for anything that is not a number. */
export function clampPlanServings(n) {
  const v = parseFloat(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(MAX_PLAN_SERVINGS, Math.max(MIN_PLAN_SERVINGS, Math.round(v * 2) / 2));
}

/** "1 serving", "1.5 servings", "2 servings". */
export function servingsLabel(n) {
  const v = clampPlanServings(n);
  return `${v} serving${v === 1 ? '' : 's'}`;
}

// ---- weeks and days -------------------------------------------------------

/** The Monday of the week a day is in ("YYYY-MM-DD"), or null for a bad key. */
export function weekStart(key) {
  const d = parseDateKey(key);
  if (!d) return null;
  return shiftDateKey(key, -((d.getDay() + 6) % 7));
}

/** The seven days of the week a day is in, Monday first; [] for a bad key. */
export function weekDays(key) {
  const start = weekStart(key);
  return start ? Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i)) : [];
}

/** The same weekday `weeks` weeks away (negative for earlier), or null for a bad key. */
export function shiftWeek(key, weeks) {
  return shiftDateKey(key, 7 * weeks);
}

/** { weekday: 'Mon', day: 12 } for a day, or null for a bad key. */
export function dayParts(key) {
  const d = parseDateKey(key);
  return d ? { weekday: WEEKDAYS[d.getDay()], day: d.getDate() } : null;
}

/** "Oct 5 – 11" or, across a month, "Sep 28 – Oct 4" for the week a day is in. */
export function weekLabel(key) {
  const days = weekDays(key);
  if (!days.length) return '';
  const first = parseDateKey(days[0]);
  const last = parseDateKey(days[6]);
  const start = `${MONTHS[first.getMonth()]} ${first.getDate()}`;
  const end = first.getMonth() === last.getMonth() ? `${last.getDate()}` : `${MONTHS[last.getMonth()]} ${last.getDate()}`;
  return `${start} – ${end}`;
}

// ---- entries --------------------------------------------------------------

let idSeq = 0;
/** A new entry id, unique even for entries made in the same millisecond. */
export function newEntryId(now = Date.now(), random = Math.random) {
  idSeq += 1;
  return `plan-${now.toString(36)}-${Math.floor(random() * 36 ** 3).toString(36)}-${idSeq}`;
}

/** Whether a day ("YYYY-MM-DD") and a meal slot id are both real. */
export const isValidPlace = (date, slot) => !!parseDateKey(date) && SLOT_IDS.includes(slot);

/** A plan entry for a saved recipe, or null when the recipe, day or meal slot is not valid. */
export function recipeEntry(recipe, { date, slot, servings = 1, now = Date.now(), id } = {}) {
  if (!recipe || recipe.id == null || !isValidPlace(date, slot)) return null;
  const name = String(recipe.title || recipe.name || '').trim();
  if (!name) return null;
  const entry = {
    id: id || newEntryId(now),
    date,
    slot,
    kind: 'recipe',
    refId: String(recipe.id),
    name,
    servings: clampPlanServings(servings),
    per: { calories: num(recipe.calories), protein: num(recipe.protein), carbs: num(recipe.carbs), fat: num(recipe.fat) },
    // The same rule the recipe screen uses for "no nutrition estimate".
    hasNutrition: recipe.hasNutritionEstimate !== false && recipe.calories != null,
    updatedAt: new Date(now).toISOString(),
  };
  const image = recipe.image || recipe.imageUrl;
  if (image) entry.imageUrl = image;
  return entry;
}

const FOOD_NUMBERS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

/**
 * A plan entry for a food (from search, recent or My Foods), or null when the
 * food, day or meal slot is not valid. The food is kept as ONE serving, even if
 * it came from the diary at some other serving count.
 */
export function foodEntry(food, { date, slot, servings = 1, now = Date.now(), id } = {}) {
  if (!food || food.id == null || !isValidPlace(date, slot)) return null;
  const name = String(food.name || '').trim();
  if (!name) return null;
  const base = foodBase(food);
  const one = { id: food.id, name, servingSize: base.servingSize };
  FOOD_NUMBERS.forEach((k) => {
    if (base[k] != null && base[k] !== '' && Number.isFinite(Number(base[k]))) one[k] = Number(base[k]);
  });
  if (food.brand) one.brand = food.brand;
  if (food.imageUrl) one.imageUrl = food.imageUrl;
  if (food.nutritionalScore) one.nutritionalScore = food.nutritionalScore;
  const entry = {
    id: id || newEntryId(now),
    date,
    slot,
    kind: 'food',
    refId: String(food.id),
    name,
    servings: clampPlanServings(servings),
    per: { calories: num(one.calories), protein: num(one.protein), carbs: num(one.carbs), fat: num(one.fat) },
    hasNutrition: one.calories !== undefined,
    food: one,
    updatedAt: new Date(now).toISOString(),
  };
  if (one.imageUrl) entry.imageUrl = one.imageUrl;
  return entry;
}

/** The entries of a day (in the order they were added), or of one meal slot on it. */
export function entriesFor(entries, date, slot) {
  return (Array.isArray(entries) ? entries : []).filter((e) => e && e.date === date && (slot === undefined || e.slot === slot));
}

/** Whether a meal slot already holds as many items as it can. `exceptId` leaves one entry out (a move within the slot). */
export function slotIsFull(entries, date, slot, exceptId) {
  return entriesFor(entries, date, slot).filter((e) => e.id !== exceptId).length >= MAX_PER_SLOT;
}

/** The calories and macros of one entry at its servings, as whole numbers. */
export function entryTotals(entry) {
  const q = clampPlanServings(entry && entry.servings);
  const per = (entry && entry.per) || {};
  const whole = (v) => Math.round(num(v) * q);
  return { calories: whole(per.calories), protein: whole(per.protein), carbs: whole(per.carbs), fat: whole(per.fat) };
}

/** What a day adds up to: calories and macros, how many items, and how many of them have no real nutrition numbers. */
export function dayTotals(entries, date) {
  const out = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0, missing: 0 };
  entriesFor(entries, date).forEach((e) => {
    const t = entryTotals(e);
    out.calories += t.calories;
    out.protein += t.protein;
    out.carbs += t.carbs;
    out.fat += t.fat;
    out.count += 1;
    if (!e.hasNutrition) out.missing += 1;
  });
  return out;
}

// ---- eating a planned meal -----------------------------------------------

/** A planned item can be logged on its day or later, once; not before the day it is planned for. */
export function canLogEntry(entry, todayKey = localDateKey()) {
  return !!entry && !entry.loggedAt && entry.date <= todayKey;
}

/** The food to put in the diary for an entry: its numbers at its servings, with the one-serving values kept so it can be changed later. */
export function foodForEntry(entry) {
  const q = clampPlanServings(entry.servings);
  if (entry.kind === 'food') {
    return { ...entry.food, ...scaleFood(entry.food, q) };
  }
  const one = {
    calories: entry.per.calories,
    protein: entry.per.protein,
    carbs: entry.per.carbs,
    fat: entry.per.fat,
    servingSize: '1 serving',
  };
  const food = { id: `recipe-${entry.refId}`, name: entry.name, ...scaleFood(one, q) };
  if (entry.imageUrl) food.imageUrl = entry.imageUrl;
  return food;
}

// ---- shopping -------------------------------------------------------------

/**
 * What to buy for the recipes planned from `fromKey` to `toKey` (never days
 * already past, and never meals already eaten), for the grocery list:
 * { recipeIds, factors, meals, missing }. `factors` is how many times to make
 * each recipe (servings planned over the servings it makes, added up over every
 * day it appears on); `missing` names planned recipes that are no longer saved.
 */
export function planGroceryFactors(entries, recipes, { fromKey, toKey, todayKey = localDateKey() } = {}) {
  const start = fromKey > todayKey ? fromKey : todayKey;
  const saved = new Map((Array.isArray(recipes) ? recipes : []).map((r) => [String(r.id), r]));
  const servings = new Map();
  const missing = [];
  let meals = 0;
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e || e.kind !== 'recipe' || e.loggedAt || e.date < start || e.date > toKey) return;
    if (!saved.has(e.refId)) {
      if (!missing.includes(e.name)) missing.push(e.name);
      return;
    }
    servings.set(e.refId, (servings.get(e.refId) || 0) + clampPlanServings(e.servings));
    meals += 1;
  });
  const recipeIds = [];
  const factors = {};
  servings.forEach((total, refId) => {
    const recipe = saved.get(refId);
    const base = parseServings(recipe.servings);
    recipeIds.push(recipe.id);
    // A recipe with no number of servings to scale from counts once.
    factors[recipe.id] = base ? total / base : 1;
  });
  return { recipeIds, factors, meals, missing };
}

// ---- keeping the plan -----------------------------------------------------

/** The entries without the ones for days further back than 30 days before today. */
export function pruneEntries(entries, todayKey = localDateKey()) {
  const oldest = shiftDateKey(todayKey, -KEEP_PAST_DAYS);
  return (Array.isArray(entries) ? entries : []).filter((e) => e && typeof e.date === 'string' && (!oldest || e.date >= oldest));
}

function cleanEntry(e) {
  if (!e || typeof e.id !== 'string' || !e.id) return null;
  if (!isValidPlace(e.date, e.slot) || (e.kind !== 'recipe' && e.kind !== 'food')) return null;
  const name = typeof e.name === 'string' ? e.name.trim() : '';
  if (!name || e.refId == null) return null;
  if (e.kind === 'food' && !(e.food && typeof e.food === 'object')) return null;
  const per = e.per && typeof e.per === 'object' ? e.per : {};
  const clean = {
    id: e.id,
    date: e.date,
    slot: e.slot,
    kind: e.kind,
    refId: String(e.refId),
    name,
    servings: clampPlanServings(e.servings),
    per: { calories: num(per.calories), protein: num(per.protein), carbs: num(per.carbs), fat: num(per.fat) },
    hasNutrition: e.hasNutrition === true,
    updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : '',
  };
  if (typeof e.imageUrl === 'string' && e.imageUrl) clean.imageUrl = e.imageUrl;
  if (e.kind === 'food') clean.food = e.food;
  if (typeof e.loggedAt === 'string' && e.loggedAt) clean.loggedAt = e.loggedAt;
  return clean;
}

/** Entries read back from the phone or the cloud: anything that is not a real entry is left out, ids are unique, and there are at most 300 (the newest days). */
export function sanitizeEntries(raw) {
  const seen = new Set();
  const clean = [];
  (Array.isArray(raw) ? raw : []).forEach((e) => {
    const c = cleanEntry(e);
    if (!c || seen.has(c.id)) return;
    seen.add(c.id);
    clean.push(c);
  });
  if (clean.length <= MAX_ENTRIES) return clean;
  return clean
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : a.i - b.i))
    .slice(0, MAX_ENTRIES)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.e);
}

/** Two copies of a plan as one: every entry of either, and for an entry in both the one changed last (this phone's, if equal). */
export function mergeEntries(local, remote) {
  const mine = sanitizeEntries(local);
  const theirs = sanitizeEntries(remote);
  const remoteById = new Map(theirs.map((e) => [e.id, e]));
  const localIds = new Set(mine.map((e) => e.id));
  const merged = mine.map((e) => {
    const other = remoteById.get(e.id);
    return other && other.updatedAt > e.updatedAt ? other : e;
  });
  theirs.forEach((t) => {
    if (!localIds.has(t.id)) merged.push(t);
  });
  return sanitizeEntries(merged);
}

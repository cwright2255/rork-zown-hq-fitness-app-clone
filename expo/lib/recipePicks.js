// lib/recipePicks.js
//
// Which recipes to suggest, and why. Pure functions: no React, no stores, no network, so every rule is unit tested.
//
// Spoonacular is only asked for a pool of candidate recipes (lib/recipeBrowse.js). This file decides which of them suit THIS
// person RIGHT NOW, from what the app already knows:
//   - the meal that fits the time of day (breakfast, lunch, dinner or a snack),
//   - what is left of today's calorie and protein goals, once the food diary is counted,
//   - whether they trained today (a session in the last day is a reason to favour protein and carbs),
//   - their goals (build muscle, lose weight, endurance) and the cuisines of the recipes they saved,
//   - what Spoonacular says about each recipe: its calories and macros per serving, health score, likes and time.
// Nothing is invented: a reason is only written when the number behind it exists, and a recipe with a missing figure is
// scored low on that figure instead of being given a made-up one.
import { slotForHour } from './foodLog';
import { MACRO_COLORS } from './recipeColors';

export { MACRO_COLORS };

// The Spoonacular meal type (complexSearch `type`) to ask for at each meal.
export const SLOT_TYPE = { breakfast: 'breakfast', lunch: 'main course', dinner: 'main course', snack: 'snack' };
export const SLOT_NAME = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'a snack' };
// How much of the day's calories one meal is, and how many meals are left to eat protein at (this one included).
export const SLOT_SHARE = { breakfast: 0.25, lunch: 0.3, dinner: 0.35, snack: 0.1 };
export const MEALS_LEFT = { breakfast: 3, lunch: 2, dinner: 1, snack: 1 };
// What to size a meal for when there is no real eating goal to size it from (calories, grams of protein).
export const SLOT_DEFAULT_CAL = { breakfast: 400, lunch: 550, dinner: 650, snack: 200 };
export const SLOT_DEFAULT_PROTEIN = { breakfast: 20, lunch: 30, dinner: 35, snack: 15 };
export const MIN_CAL_TARGET = 150;
export const MIN_PROTEIN_TARGET = 15;
export const MAX_PROTEIN_TARGET = 50;
/** A recipe that was a top pick on any of this many days before today is pushed down, so the same ones do not come back. */
export const REPEAT_DAYS = 3;
export const REPEAT_PENALTY = 0.25;
/** At most this many of one main ingredient (chicken, beef, ...) among the picks that are shown. */
export const MAX_PER_INGREDIENT = 2;

const num = (v) => {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lower = (list) => (Array.isArray(list) ? list.map((s) => String(s).toLowerCase().trim()).filter(Boolean) : []);

// ---- one search result as a card ------------------------------------------------------------------------------------------

const nutrientOf = (r, name) => {
  const list = r && r.nutrition && Array.isArray(r.nutrition.nutrients) ? r.nutrition.nutrients : [];
  const found = list.find((n) => n && n.name === name);
  return found ? num(found.amount) : null;
};

const ingredientNames = (list) => (Array.isArray(list) ? list.map((i) => (i && (i.name || i.original)) || '').map((s) => String(s).trim()).filter(Boolean) : []);

/**
 * One Spoonacular complexSearch result (with addRecipeInformation and addRecipeNutrition) as the card the Recipes screen draws:
 *   { id, name, imageUrl, cal, time, calories, protein, carbs, fat, minutes, healthScore, likes, servings, dishTypes, cuisines,
 *     usedNames, missedNames }
 * `cal` and `time` are the short labels ("540 cal", "25 min") the cards have always shown, or '' when unknown. The numbers are
 * per serving and null when Spoonacular did not give them. usedNames and missedNames are only there for an ingredient search
 * (fillIngredients): the ingredients the person typed that the recipe uses, and the ones it needs that they did not type.
 * Returns null for something that is not a recipe.
 */
export function mapBrowseResult(r) {
  if (!r || r.id == null) return null;
  const calories = nutrientOf(r, 'Calories');
  const minutes = num(r.readyInMinutes);
  return {
    id: String(r.id),
    name: r.title || '',
    imageUrl: r.image || '',
    cal: calories ? `${Math.round(calories)} cal` : '',
    time: minutes ? `${minutes} min` : '',
    calories,
    protein: nutrientOf(r, 'Protein'),
    carbs: nutrientOf(r, 'Carbohydrates'),
    fat: nutrientOf(r, 'Fat'),
    minutes: minutes || null,
    healthScore: num(r.healthScore),
    likes: num(r.aggregateLikes),
    servings: num(r.servings),
    dishTypes: lower(r.dishTypes),
    cuisines: lower(r.cuisines),
    usedNames: ingredientNames(r.usedIngredients),
    missedNames: ingredientNames(r.missedIngredients),
  };
}

/**
 * The protein, carb and fat figures of a card as chips: [{ key, letter, grams, color, label, spoken }]. A macro with no figure is
 * left out (never shown as 0 g), so a card with no nutrition has no chips.
 */
export function macroChips(item) {
  const names = { protein: 'protein', carbs: 'carbs', fat: 'fat' };
  return [['protein', 'P', item && item.protein], ['carbs', 'C', item && item.carbs], ['fat', 'F', item && item.fat]]
    .filter(([, , grams]) => typeof grams === 'number' && Number.isFinite(grams))
    .map(([key, letter, grams]) => {
      const rounded = Math.round(grams);
      return { key, letter, grams: rounded, color: MACRO_COLORS[key], label: `${letter} ${rounded}g`, spoken: `${rounded} grams of ${names[key]}` };
    });
}

// ---- the person's day -----------------------------------------------------------------------------------------------------

/**
 * Everything the ranking needs to know about the person right now.
 *   now         a Date (the hour picks the meal)
 *   slot        force a meal ('breakfast' | 'lunch' | 'dinner' | 'snack'), for the meal chips
 *   goals       { calories, protein } the daily eating goals in calories and grams
 *   goalsReal   true only when the person set (or the app worked out) these goals: the store starts everyone at a placeholder
 *   eaten       { calories, protein } already in today's food diary
 *   trained     true when they finished a workout, run or hike today
 *   goalList    ids such as 'build_muscle', 'lose_weight', 'improve_endurance'
 *   saved       the saved recipes (their `tags` are cuisines)
 * Returns { slot, hasGoals, calTarget, proteinTarget, remainingCal, remainingProtein, trained, flags, likedCuisines }.
 * `remainingCal` and `remainingProtein` are null without real goals: the app does not claim to know what is left.
 */
export function dayContext({ now = new Date(), slot, goals, goalsReal = false, eaten, trained = false, goalList = [], saved = [] } = {}) {
  const meal = slot && SLOT_TYPE[slot] ? slot : slotForHour(now.getHours());
  const calGoal = goalsReal ? num(goals && goals.calories) : null;
  const proteinGoal = goalsReal ? num(goals && goals.protein) : null;
  const eatenCal = num(eaten && eaten.calories) || 0;
  const eatenProtein = num(eaten && eaten.protein) || 0;

  const remainingCal = calGoal && calGoal > 0 ? Math.max(0, Math.round(calGoal - eatenCal)) : null;
  const remainingProtein = proteinGoal && proteinGoal > 0 ? Math.max(0, Math.round(proteinGoal - eatenProtein)) : null;

  let calTarget = SLOT_DEFAULT_CAL[meal];
  if (calGoal && calGoal > 0) {
    const share = Math.round(calGoal * SLOT_SHARE[meal]);
    calTarget = Math.max(MIN_CAL_TARGET, Math.min(share, remainingCal));
  }

  const flags = {
    buildMuscle: Array.isArray(goalList) && goalList.includes('build_muscle'),
    loseWeight: Array.isArray(goalList) && goalList.includes('lose_weight'),
    endurance: Array.isArray(goalList) && goalList.includes('improve_endurance'),
  };

  let proteinTarget = SLOT_DEFAULT_PROTEIN[meal];
  if (remainingProtein !== null) proteinTarget = remainingProtein / MEALS_LEFT[meal];
  if (flags.buildMuscle) proteinTarget += 5;
  if (trained) proteinTarget = Math.max(proteinTarget, 30);
  proteinTarget = Math.round(clamp(proteinTarget, MIN_PROTEIN_TARGET, MAX_PROTEIN_TARGET));

  // The cuisines of the saved recipes, most saved first; a recipe from one of the top three is "like what you saved".
  const counts = {};
  (Array.isArray(saved) ? saved : []).forEach((r) => lower(r && r.tags).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  const likedCuisines = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([t]) => t);

  return {
    slot: meal,
    hasGoals: calGoal !== null && calGoal > 0,
    calTarget: Math.round(calTarget),
    proteinTarget,
    remainingCal,
    remainingProtein,
    trained: !!trained,
    flags,
    likedCuisines,
  };
}

// ---- scoring --------------------------------------------------------------------------------------------------------------

// How much each thing counts toward a recipe's score (they add up to 1). A goal moves some of the weight to what it cares about.
function weightsFor(flags) {
  const w = { cal: 0.3, protein: 0.27, quality: 0.18, time: 0.08, popularity: 0.09, taste: 0.08 };
  if (flags.buildMuscle) { w.protein += 0.08; w.cal -= 0.05; w.popularity -= 0.03; }
  if (flags.loseWeight) { w.cal += 0.06; w.popularity -= 0.04; w.taste -= 0.02; }
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  Object.keys(w).forEach((k) => { w[k] /= total; });
  return w;
}

function calorieFit(calories, target, loseWeight) {
  if (calories === null) return 0.3; // unknown: neither a fit nor a miss
  const gap = (calories - target) / target;
  return clamp(1 - (gap > 0 ? gap * (loseWeight ? 1.4 : 1) : -gap), 0, 1);
}

function proteinFit(protein, target) {
  if (protein === null) return 0.3;
  return Math.min(1, protein / target);
}

function timeFit(minutes, slot) {
  if (minutes === null) return 0.5;
  const easy = slot === 'dinner' ? 45 : 30;
  if (minutes <= easy) return 1;
  if (minutes <= easy + 30) return 0.7;
  return 0.45;
}

const likesFit = (likes) => (likes === null ? 0.3 : Math.min(1, Math.log10(1 + likes) / 3.5));

/** The day number of a "YYYY-MM-DD" key (so two keys can be subtracted), or null. */
function dayNumber(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}

/**
 * True when `id` was shown as a top pick on any of the REPEAT_DAYS days before `todayKey`. recent is { [id]: "YYYY-MM-DD" } or
 * { [id]: ["YYYY-MM-DD", ...] } (every day it was shown, lib/recipeHistory.js).
 * Today does not count: a pick must not push itself down the moment it has been shown, or the page would reshuffle on a refresh.
 */
export function wasPickedRecently(recent, id, todayKey) {
  const now = dayNumber(todayKey);
  if (now === null || !recent) return false;
  const shown = Array.isArray(recent[id]) ? recent[id] : [recent[id]];
  return shown.some((key) => {
    const then = dayNumber(key);
    return then !== null && now - then >= 1 && now - then <= REPEAT_DAYS;
  });
}

const roundG = (n) => Math.round(n);

/**
 * The reasons a recipe was picked, best first: [{ kind, text }]. Each is only there when the figure behind it is.
 */
export function reasonsFor(item, ctx) {
  const out = [];
  const protein = item.protein;
  if (ctx.trained && protein !== null && protein >= 25) {
    out.push({ kind: 'workout', text: item.carbs !== null && item.carbs >= 30 ? 'Good after today\'s workout: protein and carbs' : 'Good after today\'s workout: protein' });
  }
  if (protein !== null) {
    if (ctx.remainingProtein !== null && ctx.remainingProtein > 0 && protein >= ctx.remainingProtein * 0.25) {
      const pct = Math.min(100, Math.round((protein / ctx.remainingProtein) * 100));
      out.push({ kind: 'protein', text: pct >= 100 ? 'Covers the protein you have left' : `${roundG(protein)} g protein: ${pct}% of what you have left` });
    } else if (protein >= 20) {
      out.push({ kind: 'protein', text: `${roundG(protein)} g protein` });
    }
  }
  if (item.calories !== null) {
    if (ctx.remainingCal !== null && item.calories <= ctx.remainingCal) {
      out.push({ kind: 'calories', text: `Fits the ${ctx.remainingCal} cal you have left` });
    } else if (ctx.remainingCal === null && Math.abs(item.calories - ctx.calTarget) <= ctx.calTarget * 0.2) {
      out.push({ kind: 'calories', text: `A good size for ${SLOT_NAME[ctx.slot]}` });
    }
  }
  if (item.minutes !== null && item.minutes <= 20) out.push({ kind: 'quick', text: `Ready in ${item.minutes} min` });
  if (item.healthScore !== null && item.healthScore >= 80) out.push({ kind: 'health', text: `Health score ${roundG(item.healthScore)}` });
  const cuisine = item.cuisines.find((c) => ctx.likedCuisines.includes(c));
  if (cuisine) out.push({ kind: 'taste', text: `Like the ${cuisine} recipes you saved` });
  return out;
}

/** A recipe's score out of 100 for this person right now, and the reasons: { score, parts, reasons }. */
export function scoreRecipe(item, ctx, { recent = {}, todayKey = null } = {}) {
  const w = weightsFor(ctx.flags);
  const parts = {
    cal: calorieFit(item.calories, ctx.calTarget, ctx.flags.loseWeight),
    protein: proteinFit(item.protein, ctx.proteinTarget),
    quality: item.healthScore === null ? 0.4 : clamp(item.healthScore / 100, 0, 1),
    time: timeFit(item.minutes, ctx.slot),
    popularity: likesFit(item.likes),
    taste: item.cuisines.some((c) => ctx.likedCuisines.includes(c)) ? 1 : 0,
  };
  let total = 0;
  Object.keys(w).forEach((k) => { total += w[k] * parts[k]; });
  // After training, protein with enough carbs to refuel is worth a little more.
  if (ctx.trained && item.protein !== null && item.protein >= 25 && item.carbs !== null && item.carbs >= 30) total += 0.08;
  if (todayKey && wasPickedRecently(recent, item.id, todayKey)) total -= REPEAT_PENALTY;
  return { score: Math.round(clamp(total, 0, 1) * 100), parts, reasons: reasonsFor(item, ctx) };
}

// The first main ingredient in a recipe's name, so a row of picks is not five chicken dishes.
const MAIN_INGREDIENTS = ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'shrimp', 'tuna', 'egg', 'tofu', 'lentil', 'chickpea', 'bean', 'pasta', 'rice', 'steak', 'lamb', 'cod', 'oat', 'yogurt', 'burger'];
export function mainIngredientOf(name) {
  const text = String(name || '').toLowerCase();
  let best = null;
  MAIN_INGREDIENTS.forEach((word) => {
    const at = text.indexOf(word);
    if (at !== -1 && (best === null || at < best.at)) best = { word, at };
  });
  return best ? best.word : null;
}

/**
 * Score the candidates and order them best first: [{ ...item, score, reason, reasons }]. `reason` is the best one or two
 * reasons in one line ('' when there is none). Ties go to the more liked recipe, then by id, so the order is the same every time.
 * Candidates are looked at once (a repeated id is dropped) and nothing is thrown away: a poor fit is just low in the list.
 */
export function rankRecipes(items, ctx, options = {}) {
  const seen = new Set();
  const scored = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id || seen.has(item.id)) return;
    seen.add(item.id);
    const { score, reasons } = scoreRecipe(item, ctx, options);
    scored.push({ ...item, score, reasons, reason: reasons.slice(0, 2).map((r) => r.text).join(' · ') });
  });
  return scored.sort((a, b) => b.score - a.score || (b.likes || 0) - (a.likes || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The first `limit` of an already ranked list with no more than MAX_PER_INGREDIENT of one main ingredient. If that leaves fewer
 * than `limit`, the best of the rest fill the places, so a short list never comes back shorter than it has to be.
 */
export function diversify(ranked, limit, maxPer = MAX_PER_INGREDIENT) {
  const list = Array.isArray(ranked) ? ranked : [];
  const counts = {};
  const chosen = [];
  const skipped = [];
  for (const item of list) {
    if (chosen.length >= limit) break;
    const key = mainIngredientOf(item.name);
    if (key && (counts[key] || 0) >= maxPer) { skipped.push(item); continue; }
    if (key) counts[key] = (counts[key] || 0) + 1;
    chosen.push(item);
  }
  for (const item of skipped) {
    if (chosen.length >= limit) break;
    chosen.push(item);
  }
  return chosen;
}

/**
 * The page's layout from a ranked pool: { hero, picks, more }. `hero` is the single best pick, `picks` the next few (varied),
 * `more` what "View All" adds. Nothing appears twice.
 */
export function layoutPicks(ranked, { picks = 6, more = 8 } = {}) {
  const varied = diversify(ranked, 1 + picks + more);
  return { hero: varied[0] || null, picks: varied.slice(1, 1 + picks), more: varied.slice(1 + picks) };
}

/** One line saying how the picks were sized, or '' when there is nothing honest to say. */
export function sizingLine(ctx) {
  const meal = ctx.slot === 'snack' ? 'a snack' : ctx.slot;
  if (!ctx.hasGoals) return `Sized for ${meal}: about ${ctx.calTarget} cal and ${ctx.proteinTarget} g protein.`;
  const left = ctx.remainingProtein !== null ? ` You have ${ctx.remainingCal.toLocaleString('en-US')} cal and ${ctx.remainingProtein} g protein left today.` : ` You have ${ctx.remainingCal.toLocaleString('en-US')} cal left today.`;
  return `Sized for ${meal}: about ${ctx.calTarget} cal and ${ctx.proteinTarget} g protein.${left}`;
}

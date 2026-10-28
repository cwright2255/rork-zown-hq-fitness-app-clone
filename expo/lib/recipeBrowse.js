// lib/recipeBrowse.js
//
// The questions the Recipes tab asks Spoonacular (complexSearch, through the browseSpoonacularRecipes functions), as plain
// functions so each one is unit tested. Which of the recipes that come back suit the person is lib/recipePicks.js; this file
// only decides what to ask for.
//
// What the tab asks for when it opens, all in ONE call so at most one cold start of the function is paid:
//   pool         a wide set of recipes for the meal that fits the time of day (36), which the picks engine ranks
//   postWorkout  protein and carbs for after training
//   mealPrep     recipes that make four or more servings
//   quickEasy    ready in 20 minutes
// Everyone's diet, food allergies and foods to avoid (lib/dietProfile.js) apply to every question. Allergies are a safety
// limit, so they apply to the chips and the ingredient search too.
import { getDietProfile, buildDietFilters } from './dietProfile';
import { SLOT_TYPE } from './recipePicks';

export const POOL_SIZE = 36;
export const ROW_SIZE = 6;
/** A pool smaller than this is asked again with the narrow limits taken off. */
export const MIN_POOL = 8;
export const MAX_KITCHEN_INGREDIENTS = 5;

// Spoonacular's complexSearch sorted by popularity always gives the same list, so the window it reads from steps forward one
// page each calendar day (and cycles back after 15 days). It stays the same all day, so the cache still works.
export const DAILY_ROTATION_SLOTS = 15;
export function dailyOffset(pageSize, now = new Date()) {
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return String((dayNumber % DAILY_ROTATION_SLOTS) * pageSize);
}

/**
 * The person's food preferences in the form the queries use. The calorie figure that sizes a meal is the EAT goal (what they
 * are meant to take in per day, from the nutrition store), passed in as eatTarget; null until a real target exists
 * (lib/calorieGoals.js). Diets, allergies and foods to avoid are defined in lib/dietProfile.js.
 */
export function resolveDietaryPreferences(user, eatTarget) {
  const profile = getDietProfile(user);
  const filters = buildDietFilters(profile);
  return {
    dietId: profile.dietId,
    diet: filters.diet,
    allergies: filters.intolerances,
    excludeIngredients: filters.excludeIngredients,
    dietExtras: filters.extras,
    dailyCalorieGoal: eatTarget || null,
    goals: (user && user.fitnessMetrics && user.fitnessMetrics.targetGoals) || (user && user.goals) || [],
    signature: [profile.dietId, filters.intolerances.join(','), filters.excludeIngredients || ''].join('|'),
  };
}

// The diet, the macro limits some diets stand for, the foods to avoid and the allergies, as query parameters.
function dietParams(prefs) {
  const { diet, allergies, excludeIngredients, dietExtras } = prefs || {};
  return {
    ...(diet ? { diet } : {}),
    ...(dietExtras || {}),
    ...(excludeIngredients ? { excludeIngredients } : {}),
    ...(allergies && allergies.length ? { intolerances: allergies.join(',') } : {}),
  };
}

const isLowCarb = (prefs) => (prefs && prefs.diet) === 'ketogenic' || (prefs && prefs.dietExtras && prefs.dietExtras.maxCarbs != null);

/** The wide set of recipes for one meal, sized around the meal's target calories (ctx is lib/recipePicks.js dayContext). */
export function buildPoolParams(prefs, ctx, now = new Date()) {
  return {
    offset: dailyOffset(POOL_SIZE, now),
    type: SLOT_TYPE[ctx.slot],
    minCalories: String(Math.max(50, Math.round(ctx.calTarget * 0.5))),
    maxCalories: String(Math.round(ctx.calTarget * 1.5)),
    ...(ctx.slot === 'snack' ? {} : { minProtein: '10' }),
    instructionsRequired: 'true',
    sort: 'popularity',
    number: POOL_SIZE,
    ...dietParams(prefs),
  };
}

/**
 * The same pool with the narrow limits (meal type, calories, protein, the day's window) taken off, for a pool that came back
 * short. The diet, allergies and foods to avoid stay: they are the person's, not a preference of the meal.
 */
export function buildRelaxedPoolParams(prefs) {
  return { instructionsRequired: 'true', sort: 'popularity', number: POOL_SIZE, ...dietParams(prefs) };
}

/** The rows under the picks. Meals are sized to 25-35% of the eat goal, or 300-700 calories when there is no real goal. */
export function buildRowParams(prefs) {
  const { dailyCalorieGoal } = prefs || {};
  const diet = dietParams(prefs);
  const lowCarbDiet = isLowCarb(prefs);
  const quickCeiling = dailyCalorieGoal ? { maxCalories: String(Math.round(dailyCalorieGoal * 0.35)) } : { maxCalories: '700' };
  return {
    postWorkout: { offset: dailyOffset(ROW_SIZE), minProtein: '20', ...(lowCarbDiet ? {} : { minCarbs: '30' }), maxSugar: '20', instructionsRequired: 'true', sort: 'popularity', number: ROW_SIZE, ...diet },
    mealPrep: { offset: dailyOffset(ROW_SIZE), minServings: '4', minProtein: '15', maxSugar: '20', type: 'main course', instructionsRequired: 'true', sort: 'popularity', number: ROW_SIZE, ...diet },
    quickEasy: { offset: dailyOffset(ROW_SIZE), maxReadyTime: '20', ...quickCeiling, maxSugar: '20', instructionsRequired: 'true', sort: 'time', number: ROW_SIZE, ...diet },
  };
}

/** Everything the tab asks for when it opens, as the batch call takes it: [{ key, params, number }]. */
export function buildHomeSections(prefs, ctx, now = new Date()) {
  const pool = buildPoolParams(prefs, ctx, now);
  const rows = buildRowParams(prefs);
  return [
    { key: 'pool', params: pool, number: pool.number },
    ...['postWorkout', 'mealPrep', 'quickEasy'].map((key) => ({ key, params: rows[key], number: rows[key].number })),
  ];
}

// ---- the chips ------------------------------------------------------------------------------------------------------------

/** The meal chips and what meal each one is. */
export const MEAL_CHIPS = { Breakfast: 'breakfast', Lunch: 'lunch', Dinner: 'dinner', Snack: 'snack' };
export const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'High Protein', 'Low Carb', 'Vegan', 'Quick Meals', 'Post-Workout'];

/**
 * What a chip other than All asks for, or null for All. A meal chip (Breakfast, Lunch, Dinner, Snack) asks for that meal sized
 * for the person: pass the picks context for THAT meal (dayContext with the chip's slot). The rest are diet-style chips.
 * Allergies always apply. Vegan is the one chip that overrides the person's own diet, on purpose (it would be an empty
 * intersection with keto, say).
 */
export function buildCategoryParams(category, prefs, ctxForMeal = null) {
  const { diet, allergies, excludeIngredients } = prefs || {};
  const intoleranceParam = allergies && allergies.length ? { intolerances: allergies.join(',') } : {};
  const excludeParam = excludeIngredients ? { excludeIngredients } : {};
  const lowCarbDiet = isLowCarb(prefs);
  const base = { instructionsRequired: 'true', sort: 'popularity', number: 20, ...(diet ? { diet } : {}), ...intoleranceParam, ...excludeParam };

  if (MEAL_CHIPS[category] && ctxForMeal) {
    return {
      ...base,
      ...((prefs && prefs.dietExtras) || {}),
      type: SLOT_TYPE[MEAL_CHIPS[category]],
      minCalories: String(Math.max(50, Math.round(ctxForMeal.calTarget * 0.5))),
      maxCalories: String(Math.round(ctxForMeal.calTarget * 1.5)),
    };
  }
  switch (category) {
    case 'High Protein': return { ...base, minProtein: '25' };
    case 'Low Carb': return { ...base, maxCarbs: '20' };
    case 'Vegan': return { ...base, diet: 'vegan' };
    case 'Quick Meals': return { ...base, maxReadyTime: '20', sort: 'time' };
    case 'Post-Workout': return { ...base, minProtein: '20', ...(lowCarbDiet ? {} : { minCarbs: '30' }) };
    default: return null;
  }
}

/** A typed search. */
export function buildSearchParams(query, prefs) {
  return { query, instructionsRequired: 'true', number: 20, ...dietParams(prefs) };
}

// ---- cook with what I have ------------------------------------------------------------------------------------------------

/**
 * A list of ingredients from text ("chicken, rice, spinach", or one per line) or an array: trimmed, lower case, no empties, no
 * repeats, at most MAX_KITCHEN_INGREDIENTS.
 */
export function normalizeIngredients(input) {
  const parts = Array.isArray(input) ? input : String(input == null ? '' : input).split(/[,\n;]+/);
  const out = [];
  parts.forEach((p) => {
    const name = String(p == null ? '' : p).replace(/\s+/g, ' ').trim().toLowerCase();
    if (name && !out.includes(name)) out.push(name);
  });
  return out.slice(0, MAX_KITCHEN_INGREDIENTS);
}

/** Recipes that use the ingredients the person has, best match first, with which of theirs each uses and what else it needs. */
export function buildKitchenParams(ingredients, prefs) {
  return {
    includeIngredients: normalizeIngredients(ingredients).join(','),
    fillIngredients: 'true',
    sort: 'max-used-ingredients',
    instructionsRequired: 'true',
    number: 20,
    ...dietParams(prefs),
  };
}

/**
 * The two lines under a recipe from an ingredient search: { uses, needs }, each null when there is nothing honest to say.
 * `typed` is how many ingredients the person asked for. The wording is deliberately plain: it says how many of theirs the recipe
 * uses and the first few other things it needs, and makes no claim about what the person has in the house.
 */
export function kitchenLine(item, typed) {
  const used = item && Array.isArray(item.usedNames) ? item.usedNames : [];
  const missed = item && Array.isArray(item.missedNames) ? item.missedNames : [];
  const asked = Math.max(1, Number(typed) || 0);
  const count = Math.min(used.length, asked);
  const shown = missed.slice(0, 3);
  const rest = missed.length - shown.length;
  return {
    uses: count > 0 ? `Uses ${count} of your ${asked}` : null,
    needs: shown.length ? `Needs: ${shown.join(', ')}${rest > 0 ? ` +${rest} more` : ''}` : null,
  };
}

// ---- the cache key --------------------------------------------------------------------------------------------------------

/**
 * A name for a question that stays the same from day to day. The day's window (offset) is left out so yesterday's answer can be
 * shown while today's is being fetched; the entry remembers which day it is from.
 */
export function cacheKeyFor(sectionKey, params) {
  const rest = { ...(params || {}) };
  delete rest.offset;
  const sorted = Object.keys(rest).sort().reduce((o, k) => ({ ...o, [k]: rest[k] }), {});
  return `${sectionKey}:${JSON.stringify(sorted)}`;
}

// Calorie API (calorieapi.com) integration — real food search and
// lookup, proxied through functions/src/index.js's searchCalorieApiFoods
// / getCalorieApiFoodById rather than calling Calorie API directly from
// the app. Calorie API's own React Native integration guide explicitly
// recommends this: a compiled mobile binary can be decompiled, exposing
// any key embedded in it, so the real key lives only in the Cloud
// Function's secret, never in the client bundle. This also matches the
// same real pattern already used elsewhere in this app for barcode
// scanning and photo food recognition.
//
// Same two exported functions (searchFoods, getFoodById) as before, so
// app/nutrition/search.jsx and app/nutrition/food/[id].jsx need no
// further changes.

import { rateFood, ratingFor } from '../lib/foodRating';
import { completeFigures } from '../lib/completeFigures';

// Cache for API responses
let searchCache = new Map();
let foodCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
let lastCacheTime = 0;

// Pulls a nutrient's amount out of a record's nutrients[] list. Sodium and saturated fat are not among the top-level
// *_100g figures (the API sends only calories, protein, carbs, fat, fibre and sugar there), so this list is the only place a
// food's rating can get them from.
//
// The list as the API really sends it (a food's own record, 100 g): [{ name: 'Saturated Fat', unit: 'g', amount: 19.2,
// nutrient_id: 106916 }, { name: 'Sodium', unit: 'mg', amount: 654, ... }, ...]. A search row's list and a record's
// portion_nutrients call the name `nutrient_name` instead (and a row's has only energy, protein, carbs, fat and sugar). The
// names are matched whole, not as a piece of the name: "Saturated Fat" is also inside "Monounsaturated Fat" and
// "Polyunsaturated Fat", and those come first in the list, so a piece match gave cheddar 7 g of saturated fat instead of 19.
//
// Returns undefined for "not listed", never 0: a food that does not list a figure is not a food that has none (the rating
// holds a grade back for a figure it does not have). An amount is read in the unit the rating uses (g or mg) whatever unit
// the list gives it in, and a unit that is not a weight is not read at all.
const NUTRIENTS = {
  sodium: { names: ['sodium', 'sodium, na'], unit: 'mg' },
  saturatedFat: { names: ['saturated fat', 'fatty acids, total saturated'], unit: 'g' },
  alcohol: { names: ['alcohol, ethyl'], unit: 'g' },
};
const GRAMS_PER_UNIT = { g: 1, mg: 0.001, mcg: 0.000001, µg: 0.000001, ug: 0.000001 };

function findNutrientAmount(nutrients, { names, unit }) {
  if (!Array.isArray(nutrients)) return undefined;
  const match = nutrients.find((n) => n && names.includes(String(n.name ?? n.nutrient_name ?? '').trim().toLowerCase()));
  if (!match || match.amount == null || match.amount === '' || typeof match.amount === 'boolean') return undefined;
  const amount = Number(match.amount);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  const listedUnit = match.unit == null || match.unit === '' ? unit : String(match.unit).trim().toLowerCase();
  const factor = GRAMS_PER_UNIT[listedUnit];
  return factor === undefined ? undefined : (amount * factor) / GRAMS_PER_UNIT[unit];
}

const tenthOrUndefined = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Math.round(Number(v) * 10) / 10);

// Real response shape confirmed directly from
// https://calorieapi.com/docs/food-search: macros use a _100g suffix
// (calories_100g, protein_100g, etc.).
const convertCalorieApiToFoodItem = (item) => {
  // What the record lists, then what its own numbers settle for a figure it does not list (see lib/completeFigures.js).
  const { sugar, saturatedFat, sodium } = completeFigures({
    carbs: item.carbs_100g,
    fat: item.fat_100g,
    sugar: item.sugar_100g,
    saturatedFat: item.saturated_fat_100g ?? findNutrientAmount(item.nutrients, NUTRIENTS.saturatedFat),
    sodium: item.sodium_100g ?? findNutrientAmount(item.nutrients, NUTRIENTS.sodium),
  });
  // Ethanol, when the food lists it ("Alcohol, ethyl" in the nutrients list). Without it the rating works
  // alcohol out from the energy the macros leave over.
  const alcohol = item.alcohol_100g ?? findNutrientAmount(item.nutrients, NUTRIENTS.alcohol);
  const servingSize = item.serving_size && item.serving_unit
    ? `${item.serving_size}${item.serving_unit}`
    : (item.serving_size || '100g');
  // A food with no energy figure has nothing to be rated from, so it carries no rating (no stars). A food missing
  // sodium or saturated fat (a search row never lists them) is rated from what there is, and marked partial.
  const rating = ratingFor({
    calories: item.calories_100g,
    protein: item.protein_100g,
    carbs: item.carbs_100g,
    fat: item.fat_100g,
    fiber: item.fiber_100g,
    saturatedFat,
    sugar,
    sodium,
    alcohol
  });

  return {
    id: (item.id ?? Math.random()).toString(),
    name: item.name || 'Unknown Food',
    brand: item.brand_name || undefined,
    servingSize,
    calories: Math.round(item.calories_100g || 0),
    protein: Math.round((item.protein_100g || 0) * 10) / 10,
    carbs: Math.round((item.carbs_100g || 0) * 10) / 10,
    fat: Math.round((item.fat_100g || 0) * 10) / 10,
    // Left off (undefined) when the API has no figure, so "not listed" is not
    // shown as a real 0 in the diary's fiber / sugar / sodium totals.
    fiber: tenthOrUndefined(item.fiber_100g),
    sugar: tenthOrUndefined(sugar),
    sodium: tenthOrUndefined(sodium),
    imageUrl: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    ...(rating ? { nutritionalScore: rating } : {}),
    nutritionalDetails: {
      saturatedFat: Math.round((saturatedFat || 0) * 10) / 10,
      sugar: Math.round((sugar || 0) * 10) / 10,
      fiber: Math.round((item.fiber_100g || 0) * 10) / 10,
      sodium: Math.round((sodium || 0) * 10) / 10
    }
  };
};

// A food's grade, 'A' (best) to 'E', from its nutrition per 100 g, or null when it has no energy figure. See
// lib/foodRating.js for how it is worked out.
export const calculateNutritionalScore = (n) => rateFood(n);

// Search foods via the real Cloud Function proxy. Returns { results, failed }:
// `failed` is true when the search itself could not be reached. The list is
// then empty: the app has no foods of its own to stand in, and a made-up list
// would show invented calories as if they were real. The screen says the
// search could not be reached instead. A failure is not cached, so trying
// again goes back to the real search.
export const searchFoodsDetailed = async (query) => {
  if (!query || !query.trim()) return { results: [], failed: false };

  if (Date.now() - lastCacheTime > CACHE_EXPIRY) {
    searchCache.clear();
    lastCacheTime = Date.now();
  }

  const cacheKey = query.toLowerCase().trim();
  if (searchCache.has(cacheKey)) {
    return { results: searchCache.get(cacheKey), failed: false };
  }

  try {
    // require, not import(): the same lazy load, and it can be run under Jest.
    const { httpsCallable } = require('firebase/functions');
    const { functions } = require('../src/config/firebase');
    const fn = httpsCallable(functions, 'searchCalorieApiFoods');
    const result = await fn({ query });
    const payload = result.data || {};
    const results = (payload.data || []).map(convertCalorieApiToFoodItem);

    searchCache.set(cacheKey, results);
    return { results, failed: false };
  } catch (error) {
    console.error('Food search failed:', error);
    return { results: [], failed: true };
  }
};

// The results alone, for callers that do not need to know whether the search failed.
export const searchFoods = async (query) => (await searchFoodsDetailed(query)).results;

// The ids of the ten foods this file used to make up when a search failed. Nothing real has them, so one that turns up
// (an old "recent" food saved from then) is not looked up: a real lookup could come back as an unrelated food.
const RETIRED_BUILT_IN_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

// Get food by ID via the real Cloud Function proxy. Returns null when the food cannot be loaded.
export const getFoodById = async (id) => {
  if (foodCache.has(id)) {
    return foodCache.get(id);
  }

  if (RETIRED_BUILT_IN_IDS.has(String(id))) return null;

  try {
    // require, not import(): the same lazy load, and it can be run under Jest.
    const { httpsCallable } = require('firebase/functions');
    const { functions } = require('../src/config/firebase');
    const fn = httpsCallable(functions, 'getCalorieApiFoodById');
    const result = await fn({ id });
    const payload = result.data || {};
    // Defensive: handles a food object either wrapped in { data: ... }
    // (matching search's convention) or returned directly.
    const raw = payload.data || payload;
    const food = convertCalorieApiToFoodItem(raw);
    foodCache.set(id, food);
    return food;
  } catch (error) {
    console.error('Get food by ID failed:', error);
    return null;
  }
};

// How long a tap on a search row waits for the food's own record before the row is logged as it is.
const FULL_RECORD_WAIT_MS = 4000;

// A search row lists no sodium or saturated fat, so its rating is held to 3 stars at best, which is why nearly every chicken
// food came up at 3. The food's own record lists them. This gives back the row with that record's rating and nutrition figures,
// which is what the food's page shows. When the record cannot be loaded in time, or comes with no rating, the row comes back as it was.
export const withFullRating = async (food) => {
  let timer;
  try {
    const full = await Promise.race([
      getFoodById(food.id),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), FULL_RECORD_WAIT_MS); }),
    ]);
    if (!full || !full.nutritionalScore) return food;
    return {
      ...food,
      nutritionalScore: full.nutritionalScore,
      nutritionalDetails: full.nutritionalDetails,
      fiber: full.fiber ?? food.fiber,
      sugar: full.sugar ?? food.sugar,
      sodium: full.sodium ?? food.sodium,
    };
  } finally {
    clearTimeout(timer);
  }
};

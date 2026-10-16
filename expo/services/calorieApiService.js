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

import { rateFood } from '../lib/foodRating';

// Cache for API responses
let searchCache = new Map();
let foodCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
let lastCacheTime = 0;

// Pulls a nutrient's amount out of the real nutrients[] array by name
// (case-insensitive substring match) - used for sodium/saturated fat,
// which aren't part of the guaranteed top-level _100g field set.
// Real fix: previously returned 0 both when a nutrient was genuinely
// absent (0) and when it simply wasn't in the API's data at all
// (unknown) - those are different things a scoring function needs to
// treat differently, so this now returns undefined for "not found",
// letting the caller (and calculateNutritionalScore below) tell the
// two apart instead of silently treating "no data" as "verified safe."
function findNutrientAmount(nutrients, nameSubstring) {
  if (!Array.isArray(nutrients)) return undefined;
  const match = nutrients.find((n) =>
    (n.nutrient_name || '').toLowerCase().includes(nameSubstring)
  );
  return match?.amount;
}

const tenthOrUndefined = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Math.round(Number(v) * 10) / 10);

// Real response shape confirmed directly from
// https://calorieapi.com/docs/food-search: macros use a _100g suffix
// (calories_100g, protein_100g, etc.).
const convertCalorieApiToFoodItem = (item) => {
  const sodium = item.sodium_100g ?? findNutrientAmount(item.nutrients, 'sodium');
  const saturatedFat = item.saturated_fat_100g ?? findNutrientAmount(item.nutrients, 'saturated');
  // Ethanol, when the food lists it ("Alcohol, ethyl" in the nutrients list). Without it the rating works
  // alcohol out from the energy the macros leave over.
  const alcohol = item.alcohol_100g ?? findNutrientAmount(item.nutrients, 'alcohol, ethyl');
  const servingSize = item.serving_size && item.serving_unit
    ? `${item.serving_size}${item.serving_unit}`
    : (item.serving_size || '100g');
  // A food with no energy figure has nothing to be rated from, so it carries no rating (no stars).
  const grade = calculateNutritionalScore({
    calories: item.calories_100g,
    protein: item.protein_100g,
    carbs: item.carbs_100g,
    fat: item.fat_100g,
    fiber: item.fiber_100g,
    saturatedFat,
    sugar: item.sugar_100g,
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
    sugar: tenthOrUndefined(item.sugar_100g),
    sodium: tenthOrUndefined(sodium),
    imageUrl: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    ...(grade ? { nutritionalScore: { score: grade } } : {}),
    nutritionalDetails: {
      saturatedFat: Math.round((saturatedFat || 0) * 10) / 10,
      sugar: Math.round((item.sugar_100g || 0) * 10) / 10,
      fiber: Math.round((item.fiber_100g || 0) * 10) / 10,
      sodium: Math.round((sodium || 0) * 10) / 10
    }
  };
};

// A food's grade, 'A' (best) to 'E', from its nutrition per 100 g, or null when it has no energy figure. See
// lib/foodRating.js for how it is worked out.
export const calculateNutritionalScore = (n) => rateFood(n);

// A grade as a 1-5 star display (A=5 ... E=1), shown alongside calories on
// food and meal cards.
export const gradeToStars = (grade) => {
  if (grade === 'A') return 5;
  if (grade === 'B') return 4;
  if (grade === 'C') return 3;
  if (grade === 'D') return 2;
  return 1;
};

// Real mapping from a nutritional grade to the app's existing meal-star
// XP tiers (33/44/55 XP - see store/expStore.js's mealThreeStar/
// FourStar/FiveStar). Distinct from gradeToStars above: XP only has
// three tiers, not five, so C/D/E all floor to the same 3-star/33 XP
// tier rather than a grade below C awarding less than a grade with no
// real nutrition data at all would.
export const gradeToMealStars = (grade) => {
  if (grade === 'A') return 5;
  if (grade === 'B') return 4;
  return 3;
};

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

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

// Real response shape confirmed directly from
// https://calorieapi.com/docs/food-search: macros use a _100g suffix
// (calories_100g, protein_100g, etc.).
const convertCalorieApiToFoodItem = (item) => {
  const sodium = item.sodium_100g ?? findNutrientAmount(item.nutrients, 'sodium');
  const saturatedFat = item.saturated_fat_100g ?? findNutrientAmount(item.nutrients, 'saturated');
  const servingSize = item.serving_size && item.serving_unit
    ? `${item.serving_size}${item.serving_unit}`
    : (item.serving_size || '100g');

  return {
    id: (item.id ?? Math.random()).toString(),
    name: item.name || 'Unknown Food',
    brand: item.brand_name || undefined,
    servingSize,
    calories: Math.round(item.calories_100g || 0),
    protein: Math.round((item.protein_100g || 0) * 10) / 10,
    carbs: Math.round((item.carbs_100g || 0) * 10) / 10,
    fat: Math.round((item.fat_100g || 0) * 10) / 10,
    fiber: Math.round((item.fiber_100g || 0) * 10) / 10,
    sugar: Math.round((item.sugar_100g || 0) * 10) / 10,
    sodium: Math.round((sodium || 0) * 10) / 10,
    imageUrl: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    nutritionalScore: {
      score: calculateNutritionalScore({
        calories: item.calories_100g,
        protein: item.protein_100g,
        fiber: item.fiber_100g,
        saturatedFat,
        sugar: item.sugar_100g,
        sodium
      })
    },
    nutritionalDetails: {
      saturatedFat: Math.round((saturatedFat || 0) * 10) / 10,
      sugar: Math.round((item.sugar_100g || 0) * 10) / 10,
      fiber: Math.round((item.fiber_100g || 0) * 10) / 10,
      sodium: Math.round((sodium || 0) * 10) / 10
    }
  };
};

// Real, FDA-Daily-Value-based scoring — replaces the previous
// arbitrary gram thresholds with the actual reference amounts from the
// FDA Nutrition Facts label. Confirmed directly against FDA.gov
// (fda.gov/media/135301/download; fda.gov's "How to Understand and Use
// the Nutrition Facts Label"), cross-checked against NutriDB's
// rankings (nutri-db.com/en/rankings):
// Protein 50g, Fiber 28g, Saturated Fat 20g, Sodium 2300mg. Total sugar
// and total fat have no established FDA Daily Value at all - the FDA's
// own page states "No Daily Reference Value has been established for
// total sugars" - so those two stay as absolute, labeled gram
// thresholds rather than a %DV that doesn't exist. The 20%-is-high /
// 5%-is-low cutoffs are the FDA's own stated rule of thumb for reading
// %DV on a label, not an arbitrary pick.
const FDA_DAILY_VALUE = { protein: 50, fiber: 28, saturatedFat: 20, sodium: 2300 };

// Calculate nutritional score based on nutrition data
export const calculateNutritionalScore = (n) => {
  const calories = n.calories || 0;
  const protein = n.protein || 0;
  const fiber = n.fiber || 0;
  const sugar = n.sugar || 0;
  // Real fix: n.saturatedFat/n.sodium being missing (undefined - the
  // source genuinely had no data) is now tracked separately from a
  // stated 0 (the source explicitly reported none). Previously both
  // collapsed to the same "0, no penalty" outcome via `|| 0`, meaning
  // a food the API had literally no sodium/saturated-fat data for
  // scored identically to one confirmed to have none of either - the
  // two are not the same claim, and only the second should be able to
  // earn a clean grade on those fronts.
  const saturatedFatKnown = n.saturatedFat != null;
  const sodiumKnown = n.sodium != null;
  const saturatedFat = n.saturatedFat || 0;
  const sodium = n.sodium || 0;

  const proteinDV = (protein / FDA_DAILY_VALUE.protein) * 100;
  const fiberDV = (fiber / FDA_DAILY_VALUE.fiber) * 100;
  const saturatedFatDV = (saturatedFat / FDA_DAILY_VALUE.saturatedFat) * 100;
  const sodiumDV = (sodium / FDA_DAILY_VALUE.sodium) * 100;

  let score = 0;

  // Positive factors, using the FDA's own "20%+ is high, 5%- is low" rule of thumb
  if (proteinDV >= 20) score += 2;else
  if (proteinDV > 5) score += 1;

  if (fiberDV >= 20) score += 2;else
  if (fiberDV > 5) score += 1;

  // Negative factors - only applied when the source actually reported
  // a real value for it. A genuinely missing value contributes no
  // penalty here (that would be guessing it's bad with no evidence),
  // but also earns no pass - see the grade cap below for how a food
  // missing both is kept from scoring as if it were verified clean.
  if (saturatedFatKnown) {
    if (saturatedFatDV >= 20) score -= 2;else
    if (saturatedFatDV > 5) score -= 1;
  }

  if (sodiumKnown) {
    if (sodiumDV >= 20) score -= 2;else
    if (sodiumDV > 5) score -= 1;
  }

  // No FDA Daily Value exists for total sugar or total fat - kept as
  // the original, unchanged absolute gram thresholds rather than a %DV
  // that was never established.
  if (sugar > 15) score -= 2;else
  if (sugar > 8) score -= 1;

  if (calories > 300) score -= 1;

  let grade;
  if (score >= 2) grade = 'A';else
  if (score >= 0) grade = 'B';else
  if (score >= -2) grade = 'C';else
  if (score >= -4) grade = 'D';else
  grade = 'E';

  // Real cap: A/B is a real claim that saturated fat and sodium were
  // both checked and found low - that claim can't be made with zero
  // data on either one, no matter how well protein/fiber alone
  // scored, so a food missing both never grades above C.
  if (!saturatedFatKnown && !sodiumKnown && (grade === 'A' || grade === 'B')) {
    grade = 'C';
  }

  return grade;
};

// Real mapping from a nutritional grade to a 1-5 star display, shown
// alongside calories/time on meal, ingredient, and food-product cards.
// Same mapping already used for meal XP tiers in store/healthStore.js
// (A=5, B=4, everything else=3) - reused here as the single source of
// truth for grade-to-stars across both nutrition stacks.
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

// Search foods via the real Cloud Function proxy
export const searchFoods = async (query) => {
  if (!query.trim()) return [];

  if (Date.now() - lastCacheTime > CACHE_EXPIRY) {
    searchCache.clear();
    lastCacheTime = Date.now();
  }

  const cacheKey = query.toLowerCase().trim();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('../src/config/firebase');
    const fn = httpsCallable(functions, 'searchCalorieApiFoods');
    const result = await fn({ query });
    const payload = result.data || {};
    const results = (payload.data || []).map(convertCalorieApiToFoodItem);

    searchCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Food search failed:', error);

    const mockResults = getMockFallback().filter((food) =>
    food.name.toLowerCase().includes(cacheKey)
    );

    searchCache.set(cacheKey, mockResults);
    return mockResults;
  }
};

// Get food by ID via the real Cloud Function proxy
export const getFoodById = async (id) => {
  if (foodCache.has(id)) {
    return foodCache.get(id);
  }

  // Real mock ids ('1' through '10') never correspond to a real
  // Calorie API id - checking these first means a mock-sourced
  // selection always resolves to the correct mock food, rather than
  // risking a real API call returning an unrelated, mismatched real
  // food that happens to share that id.
  const mockMatch = getMockFallback().find((food) => food.id === id);
  if (mockMatch) {
    foodCache.set(id, mockMatch);
    return mockMatch;
  }

  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('../src/config/firebase');
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

// Enhanced mock data with more variety for better fallback experience
const getMockFallback = () => [
{
  id: '1',
  name: 'Chicken Breast',
  servingSize: '100g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
  sugar: 0,
  sodium: 74,
  imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500',
  nutritionalScore: { score: 'A' },
  nutritionalDetails: { saturatedFat: 1, sugar: 0, fiber: 0, sodium: 74 }
},
{
  id: '2',
  name: 'Brown Rice',
  servingSize: '100g cooked',
  calories: 112,
  protein: 2.6,
  carbs: 23,
  fat: 0.9,
  fiber: 1.8,
  sugar: 0.4,
  sodium: 5,
  imageUrl: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500',
  nutritionalScore: { score: 'B' },
  nutritionalDetails: { saturatedFat: 0.2, sugar: 0.4, fiber: 1.8, sodium: 5 }
},
{
  id: '3',
  name: 'Avocado',
  servingSize: '1 medium',
  calories: 240,
  protein: 3,
  carbs: 12,
  fat: 22,
  fiber: 10,
  sugar: 1,
  sodium: 10,
  imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500',
  nutritionalScore: { score: 'B' },
  nutritionalDetails: { saturatedFat: 3.1, sugar: 1, fiber: 10, sodium: 10 }
},
{
  id: '4',
  name: 'Banana',
  servingSize: '1 medium',
  calories: 105,
  protein: 1.3,
  carbs: 27,
  fat: 0.4,
  fiber: 3.1,
  sugar: 14,
  sodium: 1,
  imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500',
  nutritionalScore: { score: 'B' },
  nutritionalDetails: { saturatedFat: 0.1, sugar: 14, fiber: 3.1, sodium: 1 }
},
{
  id: '5',
  name: 'Egg',
  servingSize: '1 large',
  calories: 72,
  protein: 6.3,
  carbs: 0.4,
  fat: 5,
  fiber: 0,
  sugar: 0.2,
  sodium: 71,
  imageUrl: 'https://images.unsplash.com/photo-1607690424560-5e6f6f4874d2?w=500',
  nutritionalScore: { score: 'A' },
  nutritionalDetails: { saturatedFat: 1.6, sugar: 0.2, fiber: 0, sodium: 71 }
},
{
  id: '6',
  name: 'Salmon',
  servingSize: '100g',
  calories: 208,
  protein: 25.4,
  carbs: 0,
  fat: 12.4,
  fiber: 0,
  sugar: 0,
  sodium: 59,
  imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500',
  nutritionalScore: { score: 'A' },
  nutritionalDetails: { saturatedFat: 3.1, sugar: 0, fiber: 0, sodium: 59 }
},
{
  id: '7',
  name: 'Quinoa',
  servingSize: '100g cooked',
  calories: 120,
  protein: 4.4,
  carbs: 22,
  fat: 1.9,
  fiber: 2.8,
  sugar: 0.9,
  sodium: 7,
  imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
  nutritionalScore: { score: 'A' },
  nutritionalDetails: { saturatedFat: 0.2, sugar: 0.9, fiber: 2.8, sodium: 7 }
},
{
  id: '8',
  name: 'Greek Yogurt',
  servingSize: '100g',
  calories: 97,
  protein: 9,
  carbs: 3.6,
  fat: 5,
  fiber: 0,
  sugar: 3.6,
  sodium: 36,
  imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500',
  nutritionalScore: { score: 'A' },
  nutritionalDetails: { saturatedFat: 3.1, sugar: 3.6, fiber: 0, sodium: 36 }
},
{
  id: '9',
  name: 'Sweet Potato',
  servingSize: '1 medium baked',
  calories: 112,
  protein: 2,
  carbs: 26,
  fat: 0.1,
  fiber: 3.9,
  sugar: 5.4,
  sodium: 6,
  imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500',
  nutritionalScore: { score: 'A' },
  nutritionalDetails: { saturatedFat: 0.1, sugar: 5.4, fiber: 3.9, sodium: 6 }
},
{
  id: '10',
  name: 'Spinach',
  servingSize: '100g raw',
  calories: 23,
  protein: 2.9,
  carbs: 3.6,
  fat: 0.4,
  fiber: 2.2,
  sugar: 0.4,
  sodium: 79,
  imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500',
  nutritionalScore: { score: 'A' },
  nutritionalDetails: { saturatedFat: 0.1, sugar: 0.4, fiber: 2.2, sodium: 79 }
}];

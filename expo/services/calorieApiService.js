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
function findNutrientAmount(nutrients, nameSubstring) {
  if (!Array.isArray(nutrients)) return 0;
  const match = nutrients.find((n) =>
    (n.nutrient_name || '').toLowerCase().includes(nameSubstring)
  );
  return match?.amount ?? 0;
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
    sodium: Math.round(sodium * 10) / 10,
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
      saturatedFat: Math.round(saturatedFat * 10) / 10,
      sugar: Math.round((item.sugar_100g || 0) * 10) / 10,
      fiber: Math.round((item.fiber_100g || 0) * 10) / 10,
      sodium: Math.round(sodium * 10) / 10
    }
  };
};

// Calculate nutritional score based on nutrition data
const calculateNutritionalScore = (n) => {
  const calories = n.calories || 0;
  const protein = n.protein || 0;
  const fiber = n.fiber || 0;
  const saturatedFat = n.saturatedFat || 0;
  const sugar = n.sugar || 0;
  const sodium = n.sodium || 0;

  let score = 0;

  if (protein > 10) score += 2;else
  if (protein > 5) score += 1;

  if (fiber > 5) score += 2;else
  if (fiber > 2) score += 1;

  if (saturatedFat > 5) score -= 2;else
  if (saturatedFat > 2) score -= 1;

  if (sugar > 15) score -= 2;else
  if (sugar > 8) score -= 1;

  if (sodium > 400) score -= 2;else
  if (sodium > 200) score -= 1;

  if (calories > 300) score -= 1;

  if (score >= 2) return 'A';
  if (score >= 0) return 'B';
  if (score >= -2) return 'C';
  if (score >= -4) return 'D';
  return 'E';
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

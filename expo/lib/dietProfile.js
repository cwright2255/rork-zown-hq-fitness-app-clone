// lib/dietProfile.js
//
// One source of truth for a user's food preferences, shared by onboarding,
// Edit Profile, the Recipes tab (Spoonacular filters) and the AI coach, so
// they can't drift apart. Everything is stored on user.fitnessMetrics:
//   nutritionPreference  one diet id from DIET_OPTIONS (existing field)
//   foodAllergies        [ids from ALLERGY_OPTIONS]      (new)
//   avoidFoods           [ids from AVOID_OPTIONS]        (new)
//
// Spoonacular facts this relies on (complexSearch): `diet` accepts
// "gluten free", ketogenic, vegetarian, vegan, pescetarian, paleo,
// whole30, "low FODMAP"; `intolerances` accepts dairy, egg, gluten, grain,
// peanut, seafood, sesame, shellfish, soy, sulfite, "tree nut", wheat;
// `excludeIngredients` is a comma-separated list; `cuisine` accepts
// Mediterranean. Spoonacular has no carnivore, low-carb or high-protein
// diet, so those are approximated with per-meal macro limits (`macros`).
//
// Allergy filtering is best-effort, not a medical guarantee - the UI says
// so, and the AI prompt tells the model to treat allergies as strict.

export const DIET_OPTIONS = [
  { id: 'no_preference', label: 'No Preference' },
  { id: 'vegetarian', label: 'Vegetarian', spoonacularDiet: 'vegetarian' },
  { id: 'vegan', label: 'Vegan', spoonacularDiet: 'vegan' },
  { id: 'pescatarian', label: 'Pescatarian', spoonacularDiet: 'pescetarian' },
  { id: 'mediterranean', label: 'Mediterranean', cuisine: 'mediterranean' },
  { id: 'paleo', label: 'Paleo', spoonacularDiet: 'paleo' },
  { id: 'keto', label: 'Keto', spoonacularDiet: 'ketogenic' },
  { id: 'low_carb', label: 'Low Carb', macros: { maxCarbs: '30' } },
  { id: 'high_protein', label: 'High Protein', macros: { minProtein: '30' } },
  { id: 'carnivore', label: 'Carnivore', macros: { maxCarbs: '5' }, aiNote: 'animal-based foods only (meat, fish, eggs, optionally dairy); no plant foods' },
  { id: 'whole30', label: 'Whole30', spoonacularDiet: 'whole30' },
  { id: 'low_fodmap', label: 'Low FODMAP', spoonacularDiet: 'low FODMAP' },
  { id: 'gluten_free', label: 'Gluten-Free', spoonacularDiet: 'gluten free' },
  { id: 'intermittent_fasting', label: 'Intermittent Fasting', aiNote: 'eats within a restricted daily window, so it is about meal timing, not which foods are allowed' },
];

export const ALLERGY_OPTIONS = [
  { id: 'dairy', label: 'Dairy', spoonacular: 'dairy' },
  { id: 'egg', label: 'Eggs', spoonacular: 'egg' },
  { id: 'gluten', label: 'Gluten', spoonacular: 'gluten' },
  { id: 'wheat', label: 'Wheat', spoonacular: 'wheat' },
  { id: 'peanut', label: 'Peanuts', spoonacular: 'peanut' },
  { id: 'tree_nut', label: 'Tree Nuts', spoonacular: 'tree nut' },
  { id: 'soy', label: 'Soy', spoonacular: 'soy' },
  { id: 'fish', label: 'Fish', spoonacular: 'seafood' },
  { id: 'shellfish', label: 'Shellfish', spoonacular: 'shellfish' },
  { id: 'sesame', label: 'Sesame', spoonacular: 'sesame' },
  { id: 'sulfite', label: 'Sulfites', spoonacular: 'sulfite' },
  { id: 'grain', label: 'Grains', spoonacular: 'grain' },
];

export const AVOID_OPTIONS = [
  { id: 'pork', label: 'Pork', exclude: ['pork', 'bacon', 'ham'] },
  { id: 'beef', label: 'Beef', exclude: ['beef'] },
  { id: 'chicken', label: 'Chicken', exclude: ['chicken'] },
  { id: 'lamb', label: 'Lamb', exclude: ['lamb'] },
  { id: 'fish', label: 'Fish', exclude: ['fish', 'salmon', 'tuna'] },
  { id: 'mushrooms', label: 'Mushrooms', exclude: ['mushroom'] },
  { id: 'onions', label: 'Onions', exclude: ['onion'] },
  { id: 'cilantro', label: 'Cilantro', exclude: ['cilantro'] },
  { id: 'alcohol', label: 'Alcohol', exclude: ['wine', 'beer', 'rum', 'vodka'] },
];

const byId = (list) => Object.fromEntries(list.map((o) => [o.id, o]));
const DIET_BY_ID = byId(DIET_OPTIONS);
const ALLERGY_BY_ID = byId(ALLERGY_OPTIONS);
const AVOID_BY_ID = byId(AVOID_OPTIONS);

const asIdList = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);

// Reads the three stored fields off a user object, tolerating missing or
// malformed data (new accounts, older profiles saved before the allergy
// and avoid-foods fields existed).
export function getDietProfile(user) {
  const metrics = user?.fitnessMetrics || {};
  const dietId = DIET_BY_ID[metrics.nutritionPreference] ? metrics.nutritionPreference : 'no_preference';
  return {
    dietId,
    allergies: asIdList(metrics.foodAllergies).filter((id) => ALLERGY_BY_ID[id]),
    avoid: asIdList(metrics.avoidFoods).filter((id) => AVOID_BY_ID[id]),
  };
}

// Spoonacular complexSearch parameters for a profile.
//   diet / intolerances / excludeIngredients  hard filters (safety first)
//   extras                                    cuisine or per-meal macro
//                                             limits that approximate diets
//                                             Spoonacular has no label for
export function buildDietFilters(profile) {
  const p = profile || { dietId: 'no_preference', allergies: [], avoid: [] };
  const diet = DIET_BY_ID[p.dietId] || DIET_BY_ID.no_preference;
  const intolerances = (p.allergies || []).map((id) => ALLERGY_BY_ID[id]?.spoonacular).filter(Boolean);
  const exclude = [...new Set((p.avoid || []).flatMap((id) => AVOID_BY_ID[id]?.exclude || []))];
  const extras = { ...(diet.cuisine ? { cuisine: diet.cuisine } : {}), ...(diet.macros || {}) };
  return {
    diet: diet.spoonacularDiet || null,
    intolerances,
    excludeIngredients: exclude.length ? exclude.join(',') : null,
    extras,
  };
}

// Plain-English lines for AI system prompts. Allergies are worded as strict
// because getting one wrong matters; the rest are preferences.
export function describeDietForAI(profile) {
  const p = profile || { dietId: 'no_preference', allergies: [], avoid: [] };
  const diet = DIET_BY_ID[p.dietId];
  const lines = [];
  if (diet && diet.id !== 'no_preference') {
    lines.push(`Diet: ${diet.label}${diet.aiNote ? ` (${diet.aiNote})` : ''}. Keep meal and food suggestions consistent with it.`);
  }
  const allergyLabels = (p.allergies || []).map((id) => ALLERGY_BY_ID[id]?.label).filter(Boolean);
  if (allergyLabels.length) {
    lines.push(`FOOD ALLERGIES/INTOLERANCES: ${allergyLabels.join(', ')}. Never suggest foods, recipes or ingredients containing these, and mention hidden sources when relevant.`);
  }
  const avoidLabels = (p.avoid || []).map((id) => AVOID_BY_ID[id]?.label).filter(Boolean);
  if (avoidLabels.length) {
    lines.push(`Foods they avoid: ${avoidLabels.join(', ')}. Do not suggest these.`);
  }
  return lines;
}

// Short strings for places that take a flat restrictions list (aiService).
export function listDietRestrictions(user) {
  const p = getDietProfile(user);
  const out = [];
  const diet = DIET_BY_ID[p.dietId];
  if (diet && diet.id !== 'no_preference') out.push(diet.label);
  p.allergies.forEach((id) => out.push(`allergy: ${ALLERGY_BY_ID[id].label}`));
  p.avoid.forEach((id) => out.push(`avoids: ${AVOID_BY_ID[id].label}`));
  return out;
}

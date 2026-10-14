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
//
// `aiNote` is what the AI is told about each diet: what it is, what to watch for, and who needs a doctor's
// guidance. The evidence behind each note, with sources, is in functions/EXERCISE_SCIENCE_KNOWLEDGE.md
// (section 8). Notes say plainly when the evidence is limited, so the AI does not oversell a diet.

export const DIET_OPTIONS = [
  { id: 'no_preference', label: 'No Preference' },
  { id: 'vegetarian', label: 'Vegetarian', spoonacularDiet: 'vegetarian', aiNote: 'no meat or fish; plan for vitamin B12 (eggs and dairy help, otherwise fortified foods or a supplement), iron eaten with vitamin C, calcium, zinc and omega-3; protein from eggs, dairy, legumes and soy. A well-planned vegetarian diet suits every life stage and athletes' },
  { id: 'vegan', label: 'Vegan', spoonacularDiet: 'vegan', aiNote: 'no animal products; needs a dependable vitamin B12 source (fortified foods or a supplement), plus iron eaten with vitamin C, calcium, iodine, zinc, omega-3 and vitamin D; mix protein sources (soy, legumes, grains, nuts, seeds) across the day. A well-planned vegan diet suits every life stage and athletes' },
  { id: 'pescatarian', label: 'Pescatarian', spoonacularDiet: 'pescetarian', aiNote: 'no meat; fish and seafood allowed, and fatty fish about twice a week is a good source of omega-3' },
  { id: 'mediterranean', label: 'Mediterranean', cuisine: 'mediterranean', aiNote: 'mostly vegetables, fruit, legumes, whole grains and nuts, extra-virgin olive oil as the main fat, fish at least twice a week, modest poultry, eggs and dairy, little red or processed meat. A large randomized trial (PREDIMED) found fewer heart attacks and strokes on it; olive oil and nuts are calorie-dense, so portion them' },
  { id: 'whole_foods', label: 'Whole Foods', aiNote: 'mostly whole, minimally processed foods; cut back on ultra-processed foods, sugary drinks and refined carbohydrates (in an NIH trial people ate about 500 more calories a day on an ultra-processed diet); keep it practical and affordable, since frozen produce, canned beans and plain yogurt count' },
  { id: 'paleo', label: 'Paleo', spoonacularDiet: 'paleo', aiNote: 'whole foods with no grains, dairy, legumes or refined sugar; watch calcium, vitamin D and fiber, and be honest that the research is short-term' },
  // Pegan: Spoonacular has no label for it. Paleo is the nearest, and a safe subset (pegan allows a little
  // more: small portions of grains and legumes).
  { id: 'pegan', label: 'Pegan', spoonacularDiet: 'paleo', aiNote: 'a paleo-vegan blend: about three quarters of the plate low-glycemic vegetables and fruit, the rest pasture-raised meat, fish or eggs; limits dairy, gluten, most grains (about half a cup cooked per meal), legumes (about a cup cooked a day) and added sugar. A sensible whole-food pattern, but some restrictions are not evidence-based, so watch calcium and fiber' },
  { id: 'keto', label: 'Keto', spoonacularDiet: 'ketogenic', aiNote: 'very low carbohydrate (usually under 50 g a day, about 70-80% of calories from fat); LDL cholesterol often rises; hard to sustain for high-intensity training; after a year its weight-loss results are not clearly different from other diets; people on diabetes medication, with kidney or liver disease, or who are pregnant need a doctor\'s guidance; keep fiber up with non-starchy vegetables, nuts and seeds' },
  { id: 'low_carb', label: 'Low Carb', macros: { maxCarbs: '30' }, aiNote: 'lower carbohydrate than usual but not ketogenic; keep vegetables, legumes, berries and modest whole-grain portions rather than cutting fiber' },
  { id: 'high_protein', label: 'High Protein', macros: { minProtein: '30' }, aiNote: 'about 1.6-2.0 g of protein per kg of body weight a day, spread over meals of roughly 0.25-0.4 g/kg (20-40 g); people with kidney disease need a doctor\'s guidance' },
  { id: 'carnivore', label: 'Carnivore', macros: { maxCarbs: '5' }, aiNote: 'animal-based foods only (meat, fish, eggs, optionally dairy); no plant foods. Research is very limited (case reports and surveys), fiber is near zero, saturated fat in modeled meal plans passes the 10% of calories limit, LDL cholesterol often rises, and vitamin C, calcium, magnesium and potassium can run low. Say plainly that long-term safety is unproven, and suggest regular blood work with a doctor' },
  { id: 'whole30', label: 'Whole30', spoonacularDiet: 'whole30', aiNote: 'a 30-day elimination plan (no added sugar, alcohol, grains, legumes or dairy) followed by reintroducing one group at a time to see what affects them; meant to be temporary, with little formal research behind it' },
  { id: 'low_fodmap', label: 'Low FODMAP', spoonacularDiet: 'low FODMAP', aiNote: 'a short-term plan for IBS-type symptoms: swap high-FODMAP foods for low-FODMAP ones for about 2-6 weeks, then reintroduce groups one at a time and settle on the least restrictive diet that controls symptoms; best done with a dietitian and not meant to be followed long term' },
  { id: 'gluten_free', label: 'Gluten-Free', spoonacularDiet: 'gluten free', aiNote: 'needed for celiac disease (strictly, including cross-contact); otherwise there is no proven health or weight-loss benefit; processed gluten-free products can be low in fiber, iron, calcium and B vitamins, so favor naturally gluten-free whole foods (rice, quinoa, potatoes, legumes, meat, fish, vegetables, fruit)' },
  { id: 'intermittent_fasting', label: 'Intermittent Fasting', aiNote: 'eats within a restricted daily window, so it is about meal timing, not which foods are allowed; trials show no clear weight-loss edge over eating the same calories across the day; keep protein and training-day carbohydrate inside the window; not suitable with diabetes medication, a history of eating disorders, pregnancy, or for teenagers' },
  { id: 'intuitive_eating', label: 'Intuitive Eating', aiNote: 'no calorie counting or food rules; eats by hunger and fullness cues. It is not designed for weight loss, so do not push calorie deficits, tracking or good-food/bad-food labels; offer protein, fiber, variety and hydration as gentle habits instead' },
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

// What the AI is told about one diet id ('' for no preference or an unknown id).
export function dietAiNote(dietId) {
  return DIET_BY_ID[dietId]?.aiNote || '';
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

// functions/src/usdaFoods.js
//
// What the searchUsdaFoods proxy (index.js) sends back to the app: USDA FoodData Central's answer cut down to the
// few figures the app compares. FoodData Central sends every nutrient of every food (about 60 each, 25 foods a search),
// which the phone has no use for.
//
// FoodData Central's search gives each food's nutrients as [{ nutrientNumber: '307', nutrientName: 'Sodium, Na',
// unitName: 'MG', value: 4 }, ...], per 100 g. A food's energy is nutrient 208 (kcal); Foundation foods that carry no 208
// carry 957 or 958 (the Atwater energy) instead.

const KEYS = {
  208: ['kcal', 'KCAL'],
  957: ['kcalAtwaterGeneral', 'KCAL'],
  958: ['kcalAtwaterSpecific', 'KCAL'],
  203: ['protein', 'G'],
  204: ['fat', 'G'],
  205: ['carbs', 'G'],
  291: ['fibre', 'G'],
  307: ['sodium', 'MG'],
  606: ['satFat', 'G'],
};

const MOST_FOODS = 25;

// One food's figures: a number for each one it lists in the unit the app expects, null for each it does not.
function figuresOf(nutrients) {
  const found = {};
  for (const n of Array.isArray(nutrients) ? nutrients : []) {
    const entry = KEYS[String(n?.nutrientNumber ?? n?.number ?? '')];
    if (!entry) continue;
    const [key, unit] = entry;
    const value = n.value ?? n.amount;
    if (found[key] !== undefined || typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
    // A unit that is not the expected one is not guessed at.
    if (n.unitName != null && String(n.unitName).toUpperCase() !== unit) continue;
    found[key] = value;
  }
  const pick = (key) => (found[key] === undefined ? null : found[key]);
  return {
    kcal: found.kcal ?? found.kcalAtwaterGeneral ?? found.kcalAtwaterSpecific ?? null,
    protein: pick('protein'),
    fat: pick('fat'),
    carbs: pick('carbs'),
    fibre: pick('fibre'),
    sodium: pick('sodium'),
    satFat: pick('satFat'),
  };
}

/** USDA's search answer as [{ fdcId, description, dataType, kcal, protein, fat, carbs, fibre, sodium, satFat }], up to 25 foods. */
export function trimUsdaFoods(answer) {
  const foods = Array.isArray(answer?.foods) ? answer.foods : [];
  return foods.slice(0, MOST_FOODS).map((food) => ({
    fdcId: food?.fdcId ?? null,
    description: typeof food?.description === 'string' ? food.description : '',
    dataType: typeof food?.dataType === 'string' ? food.dataType : '',
    ...figuresOf(food?.foodNutrients),
  }));
}

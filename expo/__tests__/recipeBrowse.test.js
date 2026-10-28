// What the Recipes tab asks Spoonacular for (lib/recipeBrowse.js). The person's diet, allergies and foods to avoid must be on every
// question, and a meal must be asked for at the size that suits that meal.
const {
  dailyOffset, resolveDietaryPreferences, buildPoolParams, buildRelaxedPoolParams, buildRowParams, buildHomeSections,
  buildCategoryParams, buildSearchParams, buildKitchenParams, normalizeIngredients, cacheKeyFor,
  CATEGORIES, MEAL_CHIPS, POOL_SIZE, ROW_SIZE, MIN_POOL, MAX_KITCHEN_INGREDIENTS,
} = require('../lib/recipeBrowse');
const { dayContext } = require('../lib/recipePicks');

const user = (fitnessMetrics = {}) => ({ fitnessMetrics });
const prefs = (fitnessMetrics, eat = null) => resolveDietaryPreferences(user(fitnessMetrics), eat);
const dinner = (over = {}) => dayContext({ now: new Date(2026, 9, 28, 18, 0), goals: { calories: 2400, protein: 160 }, goalsReal: true, eaten: { calories: 1000, protein: 70 }, ...over });
const NOON = new Date(2026, 9, 28, 12, 0);

describe('the diet, allergies and foods to avoid', () => {
  const p = prefs({ nutritionPreference: 'keto', foodAllergies: ['peanut', 'tree_nut'], avoidFoods: ['pork', 'onions'] });

  it('reads them off the profile in the words Spoonacular uses', () => {
    expect(p.diet).toBe('ketogenic');
    expect(p.allergies).toEqual(['peanut', 'tree nut']);
    expect(p.excludeIngredients).toBe('pork,bacon,ham,onion');
  });

  it('puts all three on the pool, every row, the chips, a search and the ingredient search', () => {
    const must = { diet: 'ketogenic', intolerances: 'peanut,tree nut', excludeIngredients: 'pork,bacon,ham,onion' };
    const rows = buildRowParams(p);
    const all = [
      buildPoolParams(p, dinner(), NOON), rows.postWorkout, rows.mealPrep, rows.quickEasy, buildRelaxedPoolParams(p),
      buildCategoryParams('High Protein', p), buildCategoryParams('Low Carb', p), buildCategoryParams('Quick Meals', p), buildCategoryParams('Post-Workout', p),
      buildCategoryParams('Dinner', p, dinner()), buildSearchParams('soup', p), buildKitchenParams(['egg'], p),
    ];
    all.forEach((params) => expect(params).toMatchObject(must));
  });

  it('keeps the allergies and avoided foods but swaps the diet for the Vegan chip', () => {
    const v = buildCategoryParams('Vegan', p);
    expect(v.diet).toBe('vegan');
    expect(v.intolerances).toBe('peanut,tree nut');
    expect(v.excludeIngredients).toBe('pork,bacon,ham,onion');
  });

  it('asks for nothing special with no diet, allergies or foods to avoid', () => {
    const none = prefs({});
    expect(buildPoolParams(none, dinner(), NOON)).not.toHaveProperty('diet');
    expect(buildPoolParams(none, dinner(), NOON)).not.toHaveProperty('intolerances');
    expect(buildPoolParams(none, dinner(), NOON)).not.toHaveProperty('excludeIngredients');
  });

  it('carries the macro limits a diet stands for, and a high-protein diet raises the protein floor', () => {
    const hp = prefs({ nutritionPreference: 'high_protein' });
    expect(buildPoolParams(hp, dinner(), NOON).minProtein).toBe('30');
    expect(buildPoolParams(prefs({ nutritionPreference: 'low_carb' }), dinner(), NOON).maxCarbs).toBe('30');
  });

  it('has a signature that changes when any of the three changes', () => {
    const a = prefs({ nutritionPreference: 'keto' }).signature;
    expect(prefs({ nutritionPreference: 'keto', foodAllergies: ['soy'] }).signature).not.toBe(a);
    expect(prefs({ nutritionPreference: 'keto', avoidFoods: ['beef'] }).signature).not.toBe(a);
    expect(prefs({ nutritionPreference: 'vegan' }).signature).not.toBe(a);
  });

  it('reads the goals the person picked, from either place they were ever saved', () => {
    expect(resolveDietaryPreferences({ fitnessMetrics: { targetGoals: ['lose_weight'] } }, null).goals).toEqual(['lose_weight']);
    expect(resolveDietaryPreferences({ goals: ['build_muscle'] }, null).goals).toEqual(['build_muscle']);
    expect(resolveDietaryPreferences({}, null).goals).toEqual([]);
    expect(resolveDietaryPreferences(null, null).goals).toEqual([]);
  });
});

describe('buildPoolParams: a wide set of recipes for one meal', () => {
  it('asks for that meal type and sizes it around the meal target', () => {
    const params = buildPoolParams(prefs({}), dinner(), NOON);
    expect(params).toMatchObject({ type: 'main course', minCalories: '420', maxCalories: '1260', minProtein: '10', sort: 'popularity', instructionsRequired: 'true', number: POOL_SIZE });
    expect(POOL_SIZE).toBe(36);
  });

  it('asks for breakfast at breakfast and a snack as a snack, with no protein floor on a snack', () => {
    expect(buildPoolParams(prefs({}), dayContext({ now: new Date(2026, 9, 28, 8, 0) }), NOON).type).toBe('breakfast');
    const snack = buildPoolParams(prefs({}), dayContext({ now: new Date(2026, 9, 28, 22, 0) }), NOON);
    expect(snack.type).toBe('snack');
    expect(snack).not.toHaveProperty('minProtein');
  });

  it('never asks for fewer than 50 calories at the low end', () => {
    const full = dinner({ eaten: { calories: 2600, protein: 200 } });
    expect(Number(buildPoolParams(prefs({}), full, NOON).minCalories)).toBeGreaterThanOrEqual(75);
  });

  it('is not given a made-up eating goal: with none it uses a typical dinner', () => {
    const noGoal = dayContext({ now: new Date(2026, 9, 28, 18, 0) });
    expect(buildPoolParams(prefs({}), noGoal, NOON)).toMatchObject({ minCalories: '325', maxCalories: '975' });
  });

  it('steps through the popular list one page a day, the same all day, and cycles', () => {
    const at = (d) => new Date(2026, 9, d, 9, 0);
    expect(dailyOffset(POOL_SIZE, at(28))).toBe(dailyOffset(POOL_SIZE, new Date(2026, 9, 28, 23, 0)));
    expect(dailyOffset(POOL_SIZE, at(29))).not.toBe(dailyOffset(POOL_SIZE, at(28)));
    const offsets = Array.from({ length: 30 }, (_, i) => Number(dailyOffset(POOL_SIZE, new Date(2026, 9, 1 + i))));
    expect(Math.max(...offsets)).toBeLessThanOrEqual(900);
    expect(new Set(offsets).size).toBe(15);
  });

  it('can be relaxed to a short, safe question when the pool comes back small', () => {
    expect(MIN_POOL).toBe(8);
    const relaxed = buildRelaxedPoolParams(prefs({ nutritionPreference: 'vegan', foodAllergies: ['soy'] }));
    expect(relaxed).toEqual({ instructionsRequired: 'true', sort: 'popularity', number: POOL_SIZE, diet: 'vegan', intolerances: 'soy' });
  });
});

describe('buildRowParams: the rows under the picks', () => {
  it('sizes the quick row to 35% of the eat goal, or 700 calories with none', () => {
    expect(buildRowParams({ ...prefs({}), dailyCalorieGoal: 2400 }).quickEasy.maxCalories).toBe('840');
    expect(buildRowParams(prefs({})).quickEasy.maxCalories).toBe('700');
  });

  it('asks for what each row is about', () => {
    const rows = buildRowParams(prefs({}));
    expect(rows.postWorkout).toMatchObject({ minProtein: '20', minCarbs: '30', number: ROW_SIZE });
    expect(rows.mealPrep).toMatchObject({ minServings: '4', type: 'main course', number: ROW_SIZE });
    expect(rows.quickEasy).toMatchObject({ maxReadyTime: '20', sort: 'time', number: ROW_SIZE });
  });

  it('takes the carb floor off the post-workout row for a low-carb diet', () => {
    expect(buildRowParams(prefs({ nutritionPreference: 'keto' })).postWorkout).not.toHaveProperty('minCarbs');
    expect(buildRowParams(prefs({ nutritionPreference: 'low_carb' })).postWorkout).not.toHaveProperty('minCarbs');
  });
});

describe('buildHomeSections: one call for everything', () => {
  it('is the pool and the three rows, in the form the batch call takes', () => {
    const sections = buildHomeSections(prefs({}), dinner(), NOON);
    expect(sections.map((s) => s.key)).toEqual(['pool', 'postWorkout', 'mealPrep', 'quickEasy']);
    sections.forEach((s) => expect(s.number).toBe(s.params.number));
    expect(sections[0].params.number).toBe(POOL_SIZE);
  });
});

describe('the chips', () => {
  it('are All, the four meals, then the diet-style chips', () => {
    expect(CATEGORIES).toEqual(['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'High Protein', 'Low Carb', 'Vegan', 'Quick Meals', 'Post-Workout']);
    expect(MEAL_CHIPS).toEqual({ Breakfast: 'breakfast', Lunch: 'lunch', Dinner: 'dinner', Snack: 'snack' });
  });

  it('ask for nothing for All', () => {
    expect(buildCategoryParams('All', prefs({}))).toBeNull();
  });

  it('ask for a meal sized for that meal, with the meal type', () => {
    const lunch = dayContext({ now: new Date(2026, 9, 28, 18, 0), slot: 'lunch', goals: { calories: 2400, protein: 160 }, goalsReal: true, eaten: { calories: 0, protein: 0 } });
    expect(buildCategoryParams('Lunch', prefs({}), lunch)).toMatchObject({ type: 'main course', minCalories: '360', maxCalories: '1080', number: 20 });
    const snack = dayContext({ now: new Date(2026, 9, 28, 18, 0), slot: 'snack' });
    expect(buildCategoryParams('Snack', prefs({}), snack).type).toBe('snack');
    expect(buildCategoryParams('Breakfast', prefs({}), dayContext({ now: NOON, slot: 'breakfast' })).type).toBe('breakfast');
  });

  it('ask for the diet-style chips the way they always did', () => {
    expect(buildCategoryParams('High Protein', prefs({}))).toMatchObject({ minProtein: '25', sort: 'popularity', number: 20 });
    expect(buildCategoryParams('Low Carb', prefs({}))).toMatchObject({ maxCarbs: '20' });
    expect(buildCategoryParams('Quick Meals', prefs({}))).toMatchObject({ maxReadyTime: '20', sort: 'time' });
    expect(buildCategoryParams('Post-Workout', prefs({}))).toMatchObject({ minProtein: '20', minCarbs: '30' });
    expect(buildCategoryParams('Post-Workout', prefs({ nutritionPreference: 'keto' }))).not.toHaveProperty('minCarbs');
  });
});

describe('cook with what I have', () => {
  it('cleans up what was typed: lower case, no blanks, no repeats, five at most', () => {
    expect(normalizeIngredients(' Chicken,  RICE ,, chicken ;Spinach\nBroccoli, Garlic, Onion')).toEqual(['chicken', 'rice', 'spinach', 'broccoli', 'garlic']);
    expect(normalizeIngredients(['Eggs', ' eggs ', null, 'Milk'])).toEqual(['eggs', 'milk']);
    expect(normalizeIngredients('')).toEqual([]);
    expect(normalizeIngredients(undefined)).toEqual([]);
    expect(MAX_KITCHEN_INGREDIENTS).toBe(5);
  });

  it('asks for recipes that use them, with which are used and which are missing', () => {
    expect(buildKitchenParams(['Chicken', 'rice'], prefs({}))).toEqual({
      includeIngredients: 'chicken,rice', fillIngredients: 'true', sort: 'max-used-ingredients', instructionsRequired: 'true', number: 20,
    });
  });
});

describe('buildSearchParams', () => {
  it('asks for twenty recipes matching the words', () => {
    expect(buildSearchParams('pasta', prefs({}))).toEqual({ query: 'pasta', instructionsRequired: 'true', number: 20 });
  });
});

describe('cacheKeyFor: the name of a question', () => {
  it('stays the same from day to day, because the day\'s window is left out', () => {
    const a = buildPoolParams(prefs({}), dinner(), new Date(2026, 9, 28));
    const b = buildPoolParams(prefs({}), dinner(), new Date(2026, 9, 29));
    expect(a.offset).not.toBe(b.offset);
    expect(cacheKeyFor('pool', a)).toBe(cacheKeyFor('pool', b));
  });

  it('is the same whatever order the parameters were written in', () => {
    expect(cacheKeyFor('x', { b: 1, a: 2 })).toBe(cacheKeyFor('x', { a: 2, b: 1 }));
  });

  it('is different for a different meal, a different diet, or a different section', () => {
    const lunch = dayContext({ now: new Date(2026, 9, 28, 12, 0) });
    expect(cacheKeyFor('pool', buildPoolParams(prefs({}), dinner(), NOON))).not.toBe(cacheKeyFor('pool', buildPoolParams(prefs({}), lunch, NOON)));
    expect(cacheKeyFor('pool', buildPoolParams(prefs({}), dinner(), NOON))).not.toBe(cacheKeyFor('pool', buildPoolParams(prefs({ nutritionPreference: 'vegan' }), dinner(), NOON)));
    expect(cacheKeyFor('a', {})).not.toBe(cacheKeyFor('b', {}));
  });

  it('does not change the params it is given', () => {
    const params = { offset: '36', a: 1 };
    cacheKeyFor('x', params);
    expect(params).toEqual({ offset: '36', a: 1 });
  });
});

describe('kitchenLine: the lines under a recipe from an ingredient search', () => {
  const { kitchenLine } = require('../lib/recipeBrowse');

  it('says how many of the typed ingredients it uses and what else it needs', () => {
    expect(kitchenLine({ usedNames: ['chicken', 'rice', 'spinach'], missedNames: ['soy sauce', 'ginger'] }, 4)).toEqual({ uses: 'Uses 3 of your 4', needs: 'Needs: soy sauce, ginger' });
  });

  it('lists three things it needs and counts the rest', () => {
    expect(kitchenLine({ usedNames: ['egg'], missedNames: ['a', 'b', 'c', 'd', 'e'] }, 1).needs).toBe('Needs: a, b, c +2 more');
    expect(kitchenLine({ usedNames: ['egg'], missedNames: ['a', 'b', 'c'] }, 1).needs).toBe('Needs: a, b, c');
  });

  it('never claims more used than were typed, and says nothing it does not know', () => {
    expect(kitchenLine({ usedNames: ['a', 'b', 'c'], missedNames: [] }, 2)).toEqual({ uses: 'Uses 2 of your 2', needs: null });
    expect(kitchenLine({ usedNames: [], missedNames: [] }, 3)).toEqual({ uses: null, needs: null });
    expect(kitchenLine(null, 3)).toEqual({ uses: null, needs: null });
    expect(kitchenLine({}, 0)).toEqual({ uses: null, needs: null });
  });
});

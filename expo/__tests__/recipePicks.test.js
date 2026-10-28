// Which recipes to suggest, and why (lib/recipePicks.js). Each rule here is something the Recipes tab promises the person:
// a pick fits the meal and what is left of the day, nothing is claimed without a number behind it, and the same few recipes
// do not come back every day.
const {
  mapBrowseResult, dayContext, scoreRecipe, rankRecipes, reasonsFor, diversify, layoutPicks, sizingLine, mainIngredientOf,
  wasPickedRecently, MACRO_COLORS, SLOT_TYPE, REPEAT_DAYS, MAX_PER_INGREDIENT,
} = require('../lib/recipePicks');
const { macrosSummary } = require('../lib/macroWeightData');

const nutrients = (c, p, cb, f) => ({ nutrients: [
  { name: 'Calories', amount: c }, { name: 'Protein', amount: p }, { name: 'Carbohydrates', amount: cb }, { name: 'Fat', amount: f },
] });

const item = (over = {}) => ({
  id: 'r1', name: 'Plain Recipe', imageUrl: '', cal: '', time: '',
  calories: 600, protein: 35, carbs: 50, fat: 20, minutes: 25, healthScore: 70, likes: 500, servings: 2,
  dishTypes: [], cuisines: [], usedNames: [], missedNames: [], ...over,
});

const dinnerCtx = (over = {}) => dayContext({
  now: new Date(2026, 9, 28, 18, 0), goals: { calories: 2400, protein: 160 }, goalsReal: true,
  eaten: { calories: 1000, protein: 70 }, ...over,
});

describe('mapBrowseResult: one search result as a card', () => {
  const raw = {
    id: 716429, title: 'Pasta with Garlic', image: 'https://img/1.jpg', readyInMinutes: 45, servings: 2,
    healthScore: 19, aggregateLikes: 209, dishTypes: ['Lunch', 'Main Course'], cuisines: ['Italian'],
    nutrition: nutrients(584.3, 19.8, 76.3, 20.2),
  };

  it('keeps the numbers per serving, and the short labels the cards have always shown', () => {
    expect(mapBrowseResult(raw)).toEqual({
      id: '716429', name: 'Pasta with Garlic', imageUrl: 'https://img/1.jpg', cal: '584 cal', time: '45 min',
      calories: 584.3, protein: 19.8, carbs: 76.3, fat: 20.2, minutes: 45, healthScore: 19, likes: 209, servings: 2,
      dishTypes: ['lunch', 'main course'], cuisines: ['italian'], usedNames: [], missedNames: [],
    });
  });

  it('leaves a figure null, and its label empty, when Spoonacular did not give it (never a made-up zero)', () => {
    const m = mapBrowseResult({ id: 1, title: 'Bare' });
    expect([m.calories, m.protein, m.carbs, m.fat, m.minutes, m.healthScore, m.likes, m.servings]).toEqual([null, null, null, null, null, null, null, null]);
    expect([m.cal, m.time, m.imageUrl]).toEqual(['', '', '']);
    expect(m.dishTypes).toEqual([]);
  });

  it('takes the ingredients a search used and the ones still needed', () => {
    const m = mapBrowseResult({ ...raw, usedIngredients: [{ name: 'chicken' }, { original: '2 eggs' }], missedIngredients: [{ name: 'soy sauce' }, {}] });
    expect(m.usedNames).toEqual(['chicken', '2 eggs']);
    expect(m.missedNames).toEqual(['soy sauce']);
  });

  it('is null for something that is not a recipe', () => {
    expect(mapBrowseResult(null)).toBeNull();
    expect(mapBrowseResult({ title: 'No id' })).toBeNull();
  });

  it('always gives the id as text', () => {
    expect(mapBrowseResult({ id: 5 }).id).toBe('5');
  });
});

describe('colours', () => {
  it('draw protein, carbs and fat in the colours Home and Nutrition already use', () => {
    const rows = macrosSummary({ meals: [], goals: {}, dateKey: '2026-10-28' }).rows;
    expect(MACRO_COLORS).toEqual(Object.fromEntries(rows.map((r) => [r.key, r.color])));
  });
});

describe('dayContext: the meal and the targets', () => {
  it('picks the meal from the hour, like the food diary does', () => {
    const at = (h) => dayContext({ now: new Date(2026, 9, 28, h, 0) }).slot;
    expect([at(8), at(12), at(18), at(22), at(2)]).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'snack']);
  });

  it('can be told which meal (the Breakfast, Lunch, Dinner and Snack chips)', () => {
    expect(dayContext({ now: new Date(2026, 9, 28, 8, 0), slot: 'dinner' }).slot).toBe('dinner');
    expect(dayContext({ slot: 'nonsense', now: new Date(2026, 9, 28, 8, 0) }).slot).toBe('breakfast');
  });

  it('asks Spoonacular for the right type of recipe at each meal', () => {
    expect(SLOT_TYPE).toEqual({ breakfast: 'breakfast', lunch: 'main course', dinner: 'main course', snack: 'snack' });
  });

  it('sizes a meal for a typical one, and claims to know nothing about what is left, when there is no real goal', () => {
    const c = dayContext({ now: new Date(2026, 9, 28, 18, 0), goals: { calories: 2000, protein: 150 }, goalsReal: false, eaten: { calories: 500, protein: 50 } });
    expect(c).toMatchObject({ hasGoals: false, calTarget: 650, proteinTarget: 35, remainingCal: null, remainingProtein: null });
  });

  it('sizes a meal as its share of the goal, and says what is left of the day', () => {
    const c = dinnerCtx();
    expect(c.hasGoals).toBe(true);
    expect(c.remainingCal).toBe(1400);
    expect(c.remainingProtein).toBe(90);
    expect(c.calTarget).toBe(840); // 35% of 2400
    expect(c.proteinTarget).toBe(50); // 90 g left, dinner is the last big meal: held at the 50 g ceiling
  });

  it('never sizes a meal past what is left of the day', () => {
    expect(dinnerCtx({ eaten: { calories: 2000, protein: 70 } }).calTarget).toBe(400);
  });

  it('keeps a floor under the size when the day is already full', () => {
    const c = dinnerCtx({ eaten: { calories: 2600, protein: 200 } });
    expect(c.remainingCal).toBe(0);
    expect(c.remainingProtein).toBe(0);
    expect(c.calTarget).toBe(150);
    expect(c.proteinTarget).toBe(15);
  });

  it('spreads the protein left over the meals still to come', () => {
    const lunch = dayContext({ now: new Date(2026, 9, 28, 12, 0), goals: { calories: 2400, protein: 160 }, goalsReal: true, eaten: { calories: 0, protein: 40 } });
    expect(lunch.proteinTarget).toBe(50); // 120 left over 2 meals = 60, held at the 50 g ceiling
    const breakfast = dayContext({ now: new Date(2026, 9, 28, 8, 0), goals: { calories: 2400, protein: 120 }, goalsReal: true, eaten: { calories: 0, protein: 0 } });
    expect(breakfast.proteinTarget).toBe(40); // 120 over 3 meals
  });

  it('wants at least 30 g of protein after training, and 5 g more when building muscle', () => {
    const base = dayContext({ now: new Date(2026, 9, 28, 8, 0), goals: { calories: 2000, protein: 60 }, goalsReal: true, eaten: { calories: 0, protein: 0 } });
    expect(base.proteinTarget).toBe(20);
    expect(dayContext({ now: new Date(2026, 9, 28, 8, 0), goals: { calories: 2000, protein: 60 }, goalsReal: true, eaten: {}, trained: true }).proteinTarget).toBe(30);
    expect(dayContext({ now: new Date(2026, 9, 28, 8, 0), goals: { calories: 2000, protein: 60 }, goalsReal: true, eaten: {}, goalList: ['build_muscle'] }).proteinTarget).toBe(25);
  });

  it('survives a diary or goals with nothing usable in them', () => {
    const c = dayContext({ now: new Date(2026, 9, 28, 18, 0), goals: { calories: 'x', protein: null }, goalsReal: true, eaten: { calories: 'a' } });
    expect(c.hasGoals).toBe(false);
    expect(c.calTarget).toBe(650);
    expect(() => dayContext()).not.toThrow();
  });

  it('lists the three cuisines the person saved most, most first', () => {
    const saved = [
      { tags: ['Italian'] }, { tags: ['Mexican', 'Italian'] }, { tags: ['Thai'] }, { tags: ['Thai'] }, { tags: ['Greek'] }, { tags: null }, null,
    ];
    expect(dinnerCtx({ saved }).likedCuisines).toEqual(['italian', 'thai', 'greek']);
  });
});

describe('scoreRecipe: what makes a recipe fit', () => {
  const ctx = dinnerCtx();

  it('prefers the recipe whose calories are nearer the size of the meal', () => {
    const near = scoreRecipe(item({ calories: 840 }), ctx).score;
    expect(near).toBeGreaterThan(scoreRecipe(item({ calories: 400 }), ctx).score);
    expect(near).toBeGreaterThan(scoreRecipe(item({ calories: 1500 }), ctx).score);
  });

  it('prefers more protein, up to what the meal needs', () => {
    expect(scoreRecipe(item({ protein: 45 }), ctx).score).toBeGreaterThan(scoreRecipe(item({ protein: 10 }), ctx).score);
    expect(scoreRecipe(item({ protein: 50 }), ctx).score).toBe(scoreRecipe(item({ protein: 80 }), ctx).score);
  });

  it('prefers a higher health score, more likes, a shorter time and a cuisine they saved', () => {
    const s = (over) => scoreRecipe(item(over), dinnerCtx({ saved: [{ tags: ['Thai'] }] })).score;
    expect(s({ healthScore: 90 })).toBeGreaterThan(s({ healthScore: 30 }));
    expect(s({ likes: 5000 })).toBeGreaterThan(s({ likes: 5 }));
    expect(s({ minutes: 20 })).toBeGreaterThan(s({ minutes: 120 }));
    expect(s({ cuisines: ['thai'] })).toBeGreaterThan(s({ cuisines: ['french'] }));
  });

  it('scores a recipe with missing figures low on those figures, not as a perfect fit', () => {
    const missing = scoreRecipe(item({ calories: null, protein: null, healthScore: null, likes: null, minutes: null }), ctx).score;
    expect(missing).toBeLessThan(scoreRecipe(item(), ctx).score);
    expect(missing).toBeGreaterThan(0);
  });

  it('punishes going over the size of the meal harder when the goal is to lose weight', () => {
    const over = item({ calories: 1300 });
    const plain = scoreRecipe(over, dinnerCtx()).score;
    const losing = scoreRecipe(over, dinnerCtx({ goalList: ['lose_weight'] })).score;
    expect(losing).toBeLessThan(plain);
  });

  it('values protein more when the goal is to build muscle', () => {
    const lowProtein = item({ protein: 12 });
    const base = scoreRecipe(lowProtein, dinnerCtx()).score;
    const muscle = scoreRecipe(lowProtein, dinnerCtx({ goalList: ['build_muscle'] })).score;
    expect(muscle).toBeLessThan(base);
  });

  it('gives a recipe with protein and carbs a lift after training, and no lift without training', () => {
    const refuel = item({ protein: 35, carbs: 60 });
    expect(scoreRecipe(refuel, dinnerCtx({ trained: true })).score).toBeGreaterThan(scoreRecipe(refuel, dinnerCtx({ trained: false })).score);
    const lowCarb = item({ protein: 35, carbs: 10 });
    const plain = scoreRecipe(lowCarb, dinnerCtx({ trained: false })).score;
    expect(scoreRecipe(lowCarb, dinnerCtx({ trained: true })).score).toBeGreaterThanOrEqual(plain);
  });

  it('pushes down a recipe that was a top pick in the last few days, and not one from long ago', () => {
    const today = '2026-10-28';
    const fresh = scoreRecipe(item(), ctx, { recent: {}, todayKey: today }).score;
    expect(scoreRecipe(item(), ctx, { recent: { r1: '2026-10-26' }, todayKey: today }).score).toBeLessThan(fresh);
    expect(scoreRecipe(item(), ctx, { recent: { r1: '2026-10-20' }, todayKey: today }).score).toBe(fresh);
  });

  it('is the same every time and always between 0 and 100', () => {
    const a = scoreRecipe(item({ calories: 99999, protein: 0, healthScore: 0, likes: 0 }), ctx);
    expect(scoreRecipe(item({ calories: 99999, protein: 0, healthScore: 0, likes: 0 }), ctx)).toEqual(a);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(scoreRecipe(item({ healthScore: 100, likes: 1e9, calories: 840, protein: 50, minutes: 5 }), ctx).score).toBeLessThanOrEqual(100);
  });
});

describe('wasPickedRecently', () => {
  it('is true up to the last few days and false after, and for anything unreadable', () => {
    expect(REPEAT_DAYS).toBe(3);
    expect(wasPickedRecently({ a: '2026-10-27' }, 'a', '2026-10-28')).toBe(true); // yesterday
    expect(wasPickedRecently({ a: '2026-10-25' }, 'a', '2026-10-28')).toBe(true); // 3 days
    expect(wasPickedRecently({ a: '2026-10-24' }, 'a', '2026-10-28')).toBe(false); // 4 days
    expect(wasPickedRecently({ a: '2026-10-28' }, 'a', '2026-10-28')).toBe(false); // today: a pick does not push itself down
    expect(wasPickedRecently({ a: '2026-10-29' }, 'a', '2026-10-28')).toBe(false); // in the future
    expect(wasPickedRecently({}, 'a', '2026-10-28')).toBe(false);
    expect(wasPickedRecently({ a: 'soon' }, 'a', '2026-10-28')).toBe(false);
    // every day it was shown: yesterday counts even though it was shown again today
    expect(wasPickedRecently({ a: ['2026-10-27', '2026-10-28'] }, 'a', '2026-10-28')).toBe(true);
    expect(wasPickedRecently({ a: ['2026-10-20', '2026-10-28'] }, 'a', '2026-10-28')).toBe(false);
    expect(wasPickedRecently({ a: [] }, 'a', '2026-10-28')).toBe(false);
    expect(wasPickedRecently(null, 'a', '2026-10-28')).toBe(false);
  });
});

describe('reasonsFor: only what is true', () => {
  const ctx = dinnerCtx(); // 1400 cal and 90 g protein left
  const texts = (it, c = ctx) => reasonsFor(it, c).map((r) => r.text);

  it('says how much of the protein left a recipe covers', () => {
    expect(texts(item({ protein: 45 }))).toContain('45 g protein: 50% of what you have left');
  });

  it('says it covers all of it when it covers all of it', () => {
    expect(texts(item({ protein: 95 }))).toContain('Covers the protein you have left');
  });

  it('says it fits the calories left only when it does', () => {
    expect(texts(item({ calories: 600 }))).toContain('Fits the 1400 cal you have left');
    expect(texts(item({ calories: 1800 })).some((t) => t.startsWith('Fits'))).toBe(false);
  });

  it('says it is good after a workout only if they trained and the recipe has the protein', () => {
    const trained = dinnerCtx({ trained: true });
    expect(texts(item({ protein: 40, carbs: 60 }), trained)[0]).toBe('Good after today\'s workout: protein and carbs');
    expect(texts(item({ protein: 40, carbs: 5 }), trained)[0]).toBe('Good after today\'s workout: protein');
    expect(texts(item({ protein: 10 }), trained).some((t) => t.startsWith('Good after'))).toBe(false);
    expect(texts(item({ protein: 40 })).some((t) => t.startsWith('Good after'))).toBe(false);
  });

  it('mentions the time only for a quick recipe, the health score only when it is high, and a saved cuisine only when it matches', () => {
    const c = dinnerCtx({ saved: [{ tags: ['Thai'] }] });
    const all = texts(item({ minutes: 15, healthScore: 88, cuisines: ['thai'] }), c);
    expect(all).toEqual(expect.arrayContaining(['Ready in 15 min', 'Health score 88', 'Like the thai recipes you saved']));
    const none = texts(item({ minutes: 40, healthScore: 50, cuisines: ['french'] }), c);
    expect(none.some((t) => /Ready in|Health score|Like the/.test(t))).toBe(false);
  });

  it('makes no claim from a figure the recipe does not have', () => {
    expect(texts(item({ protein: null, calories: null, minutes: null, healthScore: null }))).toEqual([]);
  });

  it('says nothing about what is left when there is no real goal, and only how well the size fits', () => {
    const noGoal = dayContext({ now: new Date(2026, 9, 28, 18, 0) });
    const t = texts(item({ calories: 640, protein: 12 }), noGoal);
    expect(t).toEqual(['A good size for dinner']);
    expect(t.join(' ')).not.toMatch(/left/);
    expect(texts(item({ calories: 1200, protein: 12 }), noGoal)).toEqual([]);
  });

  it('puts the best two in one line, joined with a dot', () => {
    const ranked = rankRecipes([item({ protein: 45, calories: 600, minutes: 15 })], ctx);
    expect(ranked[0].reasons.length).toBeGreaterThan(2);
    expect(ranked[0].reason).toBe('45 g protein: 50% of what you have left · Fits the 1400 cal you have left');
  });
});

describe('rankRecipes', () => {
  const ctx = dinnerCtx();

  it('puts the best fit first and the worst last', () => {
    const ranked = rankRecipes([
      item({ id: 'low', calories: 150, protein: 5 }),
      item({ id: 'best', calories: 840, protein: 50, healthScore: 90 }),
      item({ id: 'mid', calories: 600, protein: 25 }),
    ], ctx);
    expect(ranked.map((r) => r.id)).toEqual(['best', 'mid', 'low']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('drops a repeated recipe and anything that is not one, and keeps the rest', () => {
    const ranked = rankRecipes([item({ id: 'a' }), null, item({ id: 'a' }), { name: 'no id' }, item({ id: 'b' })], ctx);
    expect(ranked.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(rankRecipes(undefined, ctx)).toEqual([]);
  });

  it('breaks a tie by likes, then by id, so the order never changes between renders', () => {
    const tie = [item({ id: 'b', likes: 100 }), item({ id: 'a', likes: 100 }), item({ id: 'c', likes: 900 })];
    const first = rankRecipes(tie, ctx).map((r) => r.id);
    expect(first[0]).toBe('c');
    expect(rankRecipes([...tie].reverse(), ctx).map((r) => r.id)).toEqual(first);
  });

  it('leaves out recently picked recipes from the top when asked to', () => {
    const list = [item({ id: 'seen', calories: 840, protein: 50 }), item({ id: 'new', calories: 800, protein: 45 })];
    expect(rankRecipes(list, ctx)[0].id).toBe('seen');
    expect(rankRecipes(list, ctx, { recent: { seen: '2026-10-27' }, todayKey: '2026-10-28' })[0].id).toBe('new');
  });
});

describe('diversify and layoutPicks: not five of the same dish', () => {
  const dish = (id, name, score) => ({ id, name, score });

  it('finds the main ingredient in a name, the first one named', () => {
    expect(mainIngredientOf('Slow Cooker Chicken and Rice')).toBe('chicken');
    expect(mainIngredientOf('Rice and Chicken Bowl')).toBe('rice');
    expect(mainIngredientOf('Garden Salad')).toBeNull();
    expect(mainIngredientOf(undefined)).toBeNull();
  });

  it('allows two of one main ingredient, then moves on', () => {
    expect(MAX_PER_INGREDIENT).toBe(2);
    const ranked = [dish('1', 'Chicken A', 90), dish('2', 'Chicken B', 89), dish('3', 'Chicken C', 88), dish('4', 'Beef Stew', 80), dish('5', 'Salad', 70)];
    expect(diversify(ranked, 4).map((r) => r.id)).toEqual(['1', '2', '4', '5']);
  });

  it('fills the list from the ones skipped when there is nothing else, so it is never shorter than it has to be', () => {
    const ranked = [dish('1', 'Chicken A', 90), dish('2', 'Chicken B', 89), dish('3', 'Chicken C', 88), dish('4', 'Chicken D', 87)];
    expect(diversify(ranked, 4).map((r) => r.id)).toEqual(['1', '2', '3', '4']);
    expect(diversify(ranked, 3).map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(diversify(null, 3)).toEqual([]);
  });

  it('lays out one hero, the next picks and the rest, with no recipe twice', () => {
    const ranked = Array.from({ length: 20 }, (_, i) => dish(`r${i}`, `Dish ${i}`, 100 - i));
    const { hero, picks, more } = layoutPicks(ranked);
    expect(hero.id).toBe('r0');
    expect(picks.map((p) => p.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
    expect(more).toHaveLength(8);
    const all = [hero, ...picks, ...more].map((r) => r.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('has no hero and nothing else when there are no recipes', () => {
    expect(layoutPicks([])).toEqual({ hero: null, picks: [], more: [] });
  });
});

describe('sizingLine: tells the person how the picks were sized', () => {
  it('says so plainly without a real goal, and does not mention what is left', () => {
    const line = sizingLine(dayContext({ now: new Date(2026, 9, 28, 18, 0) }));
    expect(line).toBe('Sized for dinner: about 650 cal and 35 g protein.');
  });

  it('says what is left of the day with a real goal', () => {
    expect(sizingLine(dinnerCtx())).toBe('Sized for dinner: about 840 cal and 50 g protein. You have 1,400 cal and 90 g protein left today.');
  });

  it('calls the late meal a snack', () => {
    expect(sizingLine(dayContext({ now: new Date(2026, 9, 28, 22, 0) }))).toBe('Sized for a snack: about 200 cal and 15 g protein.');
  });
});

describe('macroChips', () => {
  const { macroChips, MACRO_COLORS } = require('../lib/recipePicks');

  it('is protein, carbs and fat in grams, each in its colour', () => {
    expect(macroChips({ protein: 32.4, carbs: 40.6, fat: 12 })).toEqual([
      { key: 'protein', letter: 'P', grams: 32, color: MACRO_COLORS.protein, label: 'P 32g', spoken: '32 grams of protein' },
      { key: 'carbs', letter: 'C', grams: 41, color: MACRO_COLORS.carbs, label: 'C 41g', spoken: '41 grams of carbs' },
      { key: 'fat', letter: 'F', grams: 12, color: MACRO_COLORS.fat, label: 'F 12g', spoken: '12 grams of fat' },
    ]);
  });

  it('leaves out a figure it does not have, but keeps a real zero', () => {
    expect(macroChips({ protein: 20, carbs: null, fat: 0 }).map((c) => c.label)).toEqual(['P 20g', 'F 0g']);
    expect(macroChips({ protein: null, carbs: null, fat: null })).toEqual([]);
    expect(macroChips({})).toEqual([]);
    expect(macroChips(null)).toEqual([]);
  });
});

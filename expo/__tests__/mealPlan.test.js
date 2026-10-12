import {
  MAX_ENTRIES, MAX_PER_SLOT, KEEP_PAST_DAYS,
  clampPlanServings, servingsLabel, weekStart, weekDays, shiftWeek, dayParts, weekLabel, newEntryId,
  recipeEntry, foodEntry, entriesFor, slotIsFull, entryTotals, dayTotals, canLogEntry, foodForEntry,
  planGroceryFactors, pruneEntries, sanitizeEntries, mergeEntries,
} from '../lib/mealPlan';

// 2026-10-09 is a Friday; the week is Monday 5 to Sunday 11 October.
const TODAY = '2026-10-09';
const NOW = Date.UTC(2026, 9, 9, 12, 0, 0);

const chili = { id: 'r1', title: 'Chili', servings: 4, calories: 400, protein: 30, carbs: 40, fat: 12, image: 'http://x/chili.jpg' };
const entry = (over = {}) => ({
  id: 'e1', date: TODAY, slot: 'dinner', kind: 'recipe', refId: 'r1', name: 'Chili', servings: 1,
  per: { calories: 400, protein: 30, carbs: 40, fat: 12 }, hasNutrition: true, updatedAt: '2026-10-09T12:00:00.000Z', ...over,
});

describe('clampPlanServings', () => {
  it.each([
    [1, 1], [0.5, 0.5], [0.4, 0.5], [0.74, 0.5], [0.75, 1], [1.2, 1], [1.3, 1.5], [2.5, 2.5], [19.9, 20], [20, 20], [25, 20],
    [0, 0.5], [-3, 0.5], ['2', 2], ['1.5', 1.5], ['x', 1], [null, 1], [undefined, 1], [NaN, 1], [Infinity, 1],
  ])('%p becomes %p', (input, expected) => {
    expect(clampPlanServings(input)).toBe(expected);
  });
});

describe('servingsLabel', () => {
  it('says serving for one and servings otherwise', () => {
    expect(servingsLabel(1)).toBe('1 serving');
    expect(servingsLabel(1.5)).toBe('1.5 servings');
    expect(servingsLabel(2)).toBe('2 servings');
    expect(servingsLabel(0.5)).toBe('0.5 servings');
    expect(servingsLabel('nope')).toBe('1 serving');
  });
});

describe('weeks', () => {
  it.each([
    ['2026-10-09', '2026-10-05'],
    ['2026-10-05', '2026-10-05'],
    ['2026-10-11', '2026-10-05'],
    ['2026-10-12', '2026-10-12'],
    ['2026-11-01', '2026-10-26'],
    ['2026-01-01', '2025-12-29'],
  ])('the week of %s starts on Monday %s', (day, monday) => {
    expect(weekStart(day)).toBe(monday);
  });

  it('has no start for a day that is not real', () => {
    expect(weekStart('2026-02-30')).toBeNull();
    expect(weekStart('nope')).toBeNull();
    expect(weekStart(undefined)).toBeNull();
    expect(weekDays('nope')).toEqual([]);
  });

  it('lists seven days, Monday first', () => {
    expect(weekDays(TODAY)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });

  it('crosses a month, a year and the end of daylight saving without skipping a day', () => {
    expect(weekDays('2026-09-30')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weekDays('2026-12-31')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    expect(weekDays('2026-11-01')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('moves a week at a time', () => {
    expect(shiftWeek(TODAY, 1)).toBe('2026-10-16');
    expect(shiftWeek(TODAY, -1)).toBe('2026-10-02');
    expect(shiftWeek(TODAY, 0)).toBe(TODAY);
    expect(shiftWeek(TODAY)).toBe(TODAY);
    expect(shiftWeek('nope', 1)).toBeNull();
  });

  it('names the weekday and the day of the month', () => {
    expect(dayParts('2026-10-09')).toEqual({ weekday: 'Fri', day: 9 });
    expect(dayParts('2026-10-11')).toEqual({ weekday: 'Sun', day: 11 });
    expect(dayParts('2026-10-05')).toEqual({ weekday: 'Mon', day: 5 });
    expect(dayParts('nope')).toBeNull();
  });

  it('labels a week', () => {
    expect(weekLabel(TODAY)).toBe('Oct 5 – 11');
    expect(weekLabel('2026-09-30')).toBe('Sep 28 – Oct 4');
    expect(weekLabel('2026-12-31')).toBe('Dec 28 – Jan 3');
    expect(weekLabel('nope')).toBe('');
  });
});

describe('newEntryId', () => {
  it('is different every time, even in the same millisecond', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newEntryId(NOW, () => 0.5)));
    expect(ids.size).toBe(500);
  });

  it('starts with plan- and carries the time', () => {
    expect(newEntryId(NOW, () => 0)).toMatch(new RegExp(`^plan-${NOW.toString(36)}-0-\\d+$`));
  });
});

describe('recipeEntry', () => {
  const make = (over) => recipeEntry(chili, { date: TODAY, slot: 'dinner', now: NOW, id: 'e1', ...over });

  it('keeps the recipe\'s name, one-serving numbers and picture', () => {
    expect(make()).toEqual({
      id: 'e1', date: TODAY, slot: 'dinner', kind: 'recipe', refId: 'r1', name: 'Chili', servings: 1,
      per: { calories: 400, protein: 30, carbs: 40, fat: 12 }, hasNutrition: true,
      imageUrl: 'http://x/chili.jpg', updatedAt: new Date(NOW).toISOString(),
    });
  });

  it('makes its own id when none is given, and a numeric recipe id becomes text', () => {
    const e = recipeEntry({ ...chili, id: 7 }, { date: TODAY, slot: 'lunch', now: NOW });
    expect(e.id).toMatch(/^plan-/);
    expect(e.refId).toBe('7');
  });

  it('takes the name from name when there is no title, and the picture from imageUrl', () => {
    const e = recipeEntry({ id: 'r2', name: 'Soup', imageUrl: 'http://x/soup.jpg' }, { date: TODAY, slot: 'lunch', now: NOW });
    expect(e.name).toBe('Soup');
    expect(e.imageUrl).toBe('http://x/soup.jpg');
  });

  it('has no picture key when the recipe has none', () => {
    const e = recipeEntry({ id: 'r2', name: 'Soup' }, { date: TODAY, slot: 'lunch', now: NOW });
    expect('imageUrl' in e).toBe(false);
  });

  it('keeps servings to halves between 1/2 and 20', () => {
    expect(make({ servings: 2.5 }).servings).toBe(2.5);
    expect(make({ servings: 99 }).servings).toBe(20);
    expect(make({ servings: 0 }).servings).toBe(0.5);
    expect(make({ servings: 'x' }).servings).toBe(1);
  });

  it('says when the numbers are not a real estimate', () => {
    expect(recipeEntry({ ...chili, calories: null }, { date: TODAY, slot: 'dinner', now: NOW }).hasNutrition).toBe(false);
    expect(recipeEntry({ ...chili, calories: undefined }, { date: TODAY, slot: 'dinner', now: NOW }).hasNutrition).toBe(false);
    expect(recipeEntry({ ...chili, hasNutritionEstimate: false }, { date: TODAY, slot: 'dinner', now: NOW }).hasNutrition).toBe(false);
    expect(recipeEntry({ ...chili, hasNutritionEstimate: true }, { date: TODAY, slot: 'dinner', now: NOW }).hasNutrition).toBe(true);
    expect(recipeEntry({ ...chili, calories: 0 }, { date: TODAY, slot: 'dinner', now: NOW }).hasNutrition).toBe(true);
  });

  it('counts missing numbers as zero', () => {
    const e = recipeEntry({ id: 'r3', title: 'Salad', calories: null, protein: undefined, carbs: 'x', fat: '' }, { date: TODAY, slot: 'lunch', now: NOW });
    expect(e.per).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it.each([
    ['no recipe', null, TODAY, 'dinner'],
    ['no recipe id', { title: 'X' }, TODAY, 'dinner'],
    ['no name', { id: 'r9' }, TODAY, 'dinner'],
    ['a blank name', { id: 'r9', title: '   ' }, TODAY, 'dinner'],
    ['a day that is not real', chili, '2026-02-30', 'dinner'],
    ['no day', chili, undefined, 'dinner'],
    ['a slot that does not exist', chili, TODAY, 'brunch'],
    ['no slot', chili, TODAY, undefined],
  ])('is nothing for %s', (_label, recipe, date, slot) => {
    expect(recipeEntry(recipe, { date, slot, now: NOW })).toBeNull();
  });

  it('is nothing with no options at all', () => {
    expect(recipeEntry(chili)).toBeNull();
  });
});

describe('foodEntry', () => {
  const oats = { id: 'f1', name: 'Oats', servingSize: '40g', calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sugar: 1, sodium: 0 };
  const make = (food = oats, over) => foodEntry(food, { date: TODAY, slot: 'breakfast', now: NOW, id: 'e2', ...over });

  it('keeps the food as one serving', () => {
    expect(make()).toEqual({
      id: 'e2', date: TODAY, slot: 'breakfast', kind: 'food', refId: 'f1', name: 'Oats', servings: 1,
      per: { calories: 150, protein: 5, carbs: 27, fat: 3 }, hasNutrition: true,
      food: { id: 'f1', name: 'Oats', servingSize: '40g', calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sugar: 1, sodium: 0 },
      updatedAt: new Date(NOW).toISOString(),
    });
  });

  it('goes back to the one-serving values of a food that was logged at another serving count', () => {
    const logged = { ...oats, calories: 300, protein: 10, carbs: 54, fat: 6, servingSize: '2x 40g', quantity: 2, base: { calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, servingSize: '40g' } };
    const e = make(logged);
    expect(e.per).toEqual({ calories: 150, protein: 5, carbs: 27, fat: 3 });
    expect(e.food.servingSize).toBe('40g');
    expect(e.food.calories).toBe(150);
    expect(e.food.fiber).toBe(4);
    expect('quantity' in e.food).toBe(false);
    expect('base' in e.food).toBe(false);
  });

  it('keeps the brand, picture and nutrition grade, and leaves out what the food does not have', () => {
    const e = make({ ...oats, brand: 'Quaker', imageUrl: 'http://x/oats.jpg', nutritionalScore: { score: 'A' }, junk: 1 });
    expect(e.food).toMatchObject({ brand: 'Quaker', imageUrl: 'http://x/oats.jpg', nutritionalScore: { score: 'A' } });
    expect('junk' in e.food).toBe(false);
    expect(e.imageUrl).toBe('http://x/oats.jpg');
    const plain = make({ id: 'f2', name: 'Egg', calories: 70 });
    expect(Object.keys(plain.food).sort()).toEqual(['calories', 'id', 'name', 'servingSize']);
    expect('imageUrl' in plain).toBe(false);
  });

  it('drops numbers that are not numbers', () => {
    const e = make({ ...oats, fiber: 'lots', sugar: '', sodium: null });
    expect('fiber' in e.food).toBe(false);
    expect('sugar' in e.food).toBe(false);
    expect('sodium' in e.food).toBe(false);
  });

  it('says when a food has no calories', () => {
    const e = make({ id: 'f3', name: 'Mystery' });
    expect(e.hasNutrition).toBe(false);
    expect(e.per).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('keeps servings to halves', () => {
    expect(make(oats, { servings: 1.5 }).servings).toBe(1.5);
    expect(make(oats, { servings: 40 }).servings).toBe(20);
  });

  it('makes its own id, and a numeric food id becomes text', () => {
    const e = foodEntry({ ...oats, id: 12 }, { date: TODAY, slot: 'snack', now: NOW });
    expect(e.id).toMatch(/^plan-/);
    expect(e.refId).toBe('12');
    expect(e.food.id).toBe(12);
  });

  it.each([
    ['no food', null, TODAY, 'snack'],
    ['no food id', { name: 'X' }, TODAY, 'snack'],
    ['no name', { id: 'f9' }, TODAY, 'snack'],
    ['a day that is not real', oats, 'nope', 'snack'],
    ['a slot that does not exist', oats, TODAY, 'elevenses'],
  ])('is nothing for %s', (_label, food, date, slot) => {
    expect(foodEntry(food, { date, slot, now: NOW })).toBeNull();
  });

  it('is nothing with no options at all', () => {
    expect(foodEntry(oats)).toBeNull();
  });
});

describe('looking at a plan', () => {
  const list = [
    entry({ id: 'a', slot: 'breakfast' }),
    entry({ id: 'b', slot: 'dinner' }),
    entry({ id: 'c', date: '2026-10-10', slot: 'dinner' }),
    entry({ id: 'd', slot: 'dinner' }),
  ];

  it('lists a day in the order it was planned, or one meal slot of it', () => {
    expect(entriesFor(list, TODAY).map((e) => e.id)).toEqual(['a', 'b', 'd']);
    expect(entriesFor(list, TODAY, 'dinner').map((e) => e.id)).toEqual(['b', 'd']);
    expect(entriesFor(list, '2026-10-10', 'dinner').map((e) => e.id)).toEqual(['c']);
    expect(entriesFor(list, '2026-10-11')).toEqual([]);
    expect(entriesFor(list, TODAY, 'snack')).toEqual([]);
  });

  it('copes with no list and empty places in it', () => {
    expect(entriesFor(undefined, TODAY)).toEqual([]);
    expect(entriesFor(null, TODAY, 'dinner')).toEqual([]);
    expect(entriesFor([null, undefined, entry()], TODAY).length).toBe(1);
  });

  it('knows when a meal slot is full', () => {
    const full = Array.from({ length: MAX_PER_SLOT }, (_, i) => entry({ id: `f${i}` }));
    expect(slotIsFull(full, TODAY, 'dinner')).toBe(true);
    expect(slotIsFull(full.slice(1), TODAY, 'dinner')).toBe(false);
    expect(slotIsFull(full, TODAY, 'lunch')).toBe(false);
    expect(slotIsFull(full, '2026-10-10', 'dinner')).toBe(false);
    expect(slotIsFull(full, TODAY, 'dinner', 'f3')).toBe(false);
    expect(slotIsFull([], TODAY, 'dinner')).toBe(false);
  });
});

describe('entryTotals', () => {
  it('is the one-serving numbers times the servings, as whole numbers', () => {
    expect(entryTotals(entry())).toEqual({ calories: 400, protein: 30, carbs: 40, fat: 12 });
    expect(entryTotals(entry({ servings: 2 }))).toEqual({ calories: 800, protein: 60, carbs: 80, fat: 24 });
    expect(entryTotals(entry({ servings: 1.5, per: { calories: 333, protein: 7, carbs: 11, fat: 5 } }))).toEqual({ calories: 500, protein: 11, carbs: 17, fat: 8 });
    expect(entryTotals(entry({ servings: 0.5, per: { calories: 101, protein: 1, carbs: 3, fat: 0 } }))).toEqual({ calories: 51, protein: 1, carbs: 2, fat: 0 });
  });

  it('is zero for a missing entry or missing numbers', () => {
    expect(entryTotals(undefined)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(entryTotals({ servings: 2 })).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(entryTotals(entry({ per: { calories: 'x', protein: null } }))).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('treats servings that are not a number as one', () => {
    expect(entryTotals(entry({ servings: 'x' })).calories).toBe(400);
    expect(entryTotals(entry({ servings: undefined })).calories).toBe(400);
  });
});

describe('dayTotals', () => {
  it('adds up every meal slot of the day, and only that day', () => {
    const list = [
      entry({ id: 'a', slot: 'breakfast', per: { calories: 200, protein: 10, carbs: 30, fat: 5 }, servings: 2 }),
      entry({ id: 'b' }),
      entry({ id: 'c', date: '2026-10-10' }),
    ];
    expect(dayTotals(list, TODAY)).toEqual({ calories: 800, protein: 50, carbs: 100, fat: 22, count: 2, missing: 0 });
  });

  it('counts the items that have no real nutrition numbers', () => {
    const list = [entry({ id: 'a', hasNutrition: false, per: { calories: 0, protein: 0, carbs: 0, fat: 0 } }), entry({ id: 'b' }), entry({ id: 'c', hasNutrition: false })];
    const t = dayTotals(list, TODAY);
    expect(t.missing).toBe(2);
    expect(t.count).toBe(3);
  });

  it('is zero for an empty day or no list', () => {
    const zero = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0, missing: 0 };
    expect(dayTotals([], TODAY)).toEqual(zero);
    expect(dayTotals(undefined, TODAY)).toEqual(zero);
    expect(dayTotals([entry()], '2026-10-12')).toEqual(zero);
  });
});

describe('canLogEntry', () => {
  it('is for today and earlier days that are not logged yet', () => {
    expect(canLogEntry(entry(), TODAY)).toBe(true);
    expect(canLogEntry(entry({ date: '2026-10-08' }), TODAY)).toBe(true);
    expect(canLogEntry(entry({ date: '2025-01-01' }), TODAY)).toBe(true);
  });

  it('is not for a day that has not come, or an entry already logged', () => {
    expect(canLogEntry(entry({ date: '2026-10-10' }), TODAY)).toBe(false);
    expect(canLogEntry(entry({ loggedAt: '2026-10-09T13:00:00.000Z' }), TODAY)).toBe(false);
  });

  it('is not for something that is not an entry', () => {
    expect(canLogEntry(null, TODAY)).toBe(false);
    expect(canLogEntry(undefined, TODAY)).toBe(false);
    expect(canLogEntry(entry({ date: undefined }), TODAY)).toBe(false);
    expect(canLogEntry(entry({ date: 20261009 }), TODAY)).toBe(false);
  });

  it('uses today by default', () => {
    expect(canLogEntry(entry({ date: '2000-01-01' }))).toBe(true);
    expect(canLogEntry(entry({ date: '2999-01-01' }))).toBe(false);
  });
});

describe('foodForEntry', () => {
  it('makes a recipe into a diary food at the servings planned', () => {
    expect(foodForEntry(entry({ servings: 2, imageUrl: 'http://x/c.jpg' }))).toEqual({
      id: 'recipe-r1', name: 'Chili', calories: 800, protein: 60, carbs: 80, fat: 24, servingSize: '2x 1 serving',
      quantity: 2, base: { calories: 400, protein: 30, carbs: 40, fat: 12, servingSize: '1 serving' }, imageUrl: 'http://x/c.jpg',
    });
  });

  it('has no picture key when the entry has none', () => {
    const food = foodForEntry(entry());
    expect('imageUrl' in food).toBe(false);
    expect(food.servingSize).toBe('1x 1 serving');
    expect(food.quantity).toBe(1);
  });

  it('keeps the food\'s own details and scales its numbers', () => {
    const e = foodEntry(
      { id: 'f1', name: 'Oats', servingSize: '40g', calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, nutritionalScore: { score: 'A' } },
      { date: TODAY, slot: 'breakfast', servings: 1.5, now: NOW },
    );
    expect(foodForEntry(e)).toEqual({
      id: 'f1', name: 'Oats', nutritionalScore: { score: 'A' },
      calories: 225, protein: 8, carbs: 41, fat: 5, fiber: 6, servingSize: '1.5x 40g', quantity: 1.5,
      base: { calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sugar: undefined, sodium: undefined, servingSize: '40g' },
    });
  });

  it('keeps servings to halves between 1/2 and 20', () => {
    expect(foodForEntry(entry({ servings: 100 })).quantity).toBe(20);
    expect(foodForEntry(entry({ servings: 'x' })).quantity).toBe(1);
  });
});

describe('planGroceryFactors', () => {
  const recipes = [
    { id: 'r1', title: 'Chili', servings: 4 },
    { id: 'r2', title: 'Soup', servings: '2 servings' },
    { id: 7, title: 'Salad', servings: 'a few' },
  ];
  const range = { fromKey: '2026-10-05', toKey: '2026-10-11', todayKey: TODAY };

  it('adds up the servings of a recipe over the days and divides by what it makes', () => {
    const list = [entry({ id: 'a', servings: 1 }), entry({ id: 'b', date: '2026-10-10', servings: 2 }), entry({ id: 'c', date: '2026-10-11', servings: 1 })];
    expect(planGroceryFactors(list, recipes, range)).toEqual({ recipeIds: ['r1'], factors: { r1: 1 }, meals: 3, missing: [] });
  });

  it('works out each recipe on its own', () => {
    const list = [entry({ id: 'a', servings: 1 }), entry({ id: 'b', refId: 'r2', name: 'Soup', servings: 3, date: '2026-10-10' })];
    const out = planGroceryFactors(list, recipes, range);
    expect(out.recipeIds).toEqual(['r1', 'r2']);
    expect(out.factors).toEqual({ r1: 0.25, r2: 1.5 });
    expect(out.meals).toBe(2);
  });

  it('counts a recipe that makes no stated number of servings as one batch', () => {
    const list = [entry({ refId: '7', name: 'Salad', servings: 3 })];
    expect(planGroceryFactors(list, recipes, range)).toEqual({ recipeIds: [7], factors: { 7: 1 }, meals: 1, missing: [] });
  });

  it('leaves out days already past, however the week starts', () => {
    const list = [entry({ id: 'a', date: '2026-10-08' }), entry({ id: 'b', date: TODAY }), entry({ id: 'c', date: '2026-10-10' })];
    expect(planGroceryFactors(list, recipes, range).meals).toBe(2);
    expect(planGroceryFactors(list, recipes, { ...range, fromKey: '2026-10-10' }).meals).toBe(1);
  });

  it('includes the last day of the range and not the day after', () => {
    const list = [entry({ id: 'a', date: '2026-10-11' }), entry({ id: 'b', date: '2026-10-12' })];
    expect(planGroceryFactors(list, recipes, range).meals).toBe(1);
  });

  it('leaves out meals already eaten and foods', () => {
    const list = [
      entry({ id: 'a', loggedAt: '2026-10-09T09:00:00.000Z' }),
      foodEntry({ id: 'f1', name: 'Oats', calories: 150 }, { date: TODAY, slot: 'breakfast', now: NOW }),
      entry({ id: 'b' }),
    ];
    expect(planGroceryFactors(list, recipes, range).meals).toBe(1);
  });

  it('names the planned recipes that are not saved any more, once each', () => {
    const list = [entry({ id: 'a', refId: 'gone', name: 'Old Stew' }), entry({ id: 'b', refId: 'gone', name: 'Old Stew', date: '2026-10-10' }), entry({ id: 'c' })];
    const out = planGroceryFactors(list, recipes, range);
    expect(out.missing).toEqual(['Old Stew']);
    expect(out.meals).toBe(1);
    expect(out.recipeIds).toEqual(['r1']);
  });

  it('is empty when nothing is planned, and copes with missing lists', () => {
    const none = { recipeIds: [], factors: {}, meals: 0, missing: [] };
    expect(planGroceryFactors([], recipes, range)).toEqual(none);
    expect(planGroceryFactors(undefined, recipes, range)).toEqual(none);
    expect(planGroceryFactors([entry()], undefined, range)).toEqual({ ...none, missing: ['Chili'] });
    expect(planGroceryFactors([null, entry()], recipes, range).meals).toBe(1);
  });

  it('uses today as the first day when none is given', () => {
    const list = [entry({ id: 'a', date: '2000-01-01' }), entry({ id: 'b', date: '2999-01-01' })];
    expect(planGroceryFactors(list, recipes, { fromKey: '1999-01-01', toKey: '2999-12-31' }).meals).toBe(1);
  });

  it('copes with servings saved wrongly', () => {
    expect(planGroceryFactors([entry({ servings: 'x' })], recipes, range).factors).toEqual({ r1: 0.25 });
  });
});

describe('pruneEntries', () => {
  it('drops entries from more than 30 days ago and keeps the rest', () => {
    const list = [
      entry({ id: 'old', date: '2026-09-08' }),
      entry({ id: 'edge', date: '2026-09-09' }),
      entry({ id: 'now', date: TODAY }),
      entry({ id: 'later', date: '2027-03-01' }),
    ];
    expect(KEEP_PAST_DAYS).toBe(30);
    expect(pruneEntries(list, TODAY).map((e) => e.id)).toEqual(['edge', 'now', 'later']);
  });

  it('leaves out anything without a day, and copes with no list', () => {
    expect(pruneEntries([null, entry({ date: undefined }), entry({ id: 'ok' })], TODAY).map((e) => e.id)).toEqual(['ok']);
    expect(pruneEntries(undefined, TODAY)).toEqual([]);
  });

  it('keeps everything dated when today is not a real day', () => {
    expect(pruneEntries([entry({ date: '1999-01-01' })], 'nope').length).toBe(1);
  });

  it('uses today by default', () => {
    expect(pruneEntries([entry({ date: '2000-01-01' }), entry({ id: 'f', date: '2999-01-01' })]).map((e) => e.id)).toEqual(['f']);
  });
});

describe('sanitizeEntries', () => {
  it('lets real entries through unchanged', () => {
    const food = foodEntry({ id: 'f1', name: 'Oats', calories: 150 }, { date: TODAY, slot: 'breakfast', now: NOW, id: 'e2' });
    const recipe = { ...recipeEntry(chili, { date: TODAY, slot: 'dinner', now: NOW, id: 'e1' }), loggedAt: '2026-10-09T18:00:00.000Z' };
    expect(sanitizeEntries([recipe, food])).toEqual([recipe, food]);
  });

  it.each([
    ['not an object', 'text'],
    ['null', null],
    ['no id', { ...entry(), id: undefined }],
    ['a blank id', { ...entry(), id: '' }],
    ['a numeric id', { ...entry(), id: 5 }],
    ['a day that is not real', entry({ date: '2026-13-01' })],
    ['a slot that does not exist', entry({ slot: 'brunch' })],
    ['a kind that is not known', entry({ kind: 'drink' })],
    ['no name', entry({ name: '' })],
    ['a name that is not text', entry({ name: 5 })],
    ['no reference', entry({ refId: undefined })],
    ['a food with no food', entry({ kind: 'food', food: undefined })],
    ['a food that is text', entry({ kind: 'food', food: 'oats' })],
  ])('leaves out an entry with %s', (_label, bad) => {
    expect(sanitizeEntries([bad, entry({ id: 'ok' })]).map((e) => e && e.id)).toEqual(['ok']);
  });

  it('repairs what can be repaired', () => {
    const [e] = sanitizeEntries([{
      ...entry(), servings: 99, refId: 12, name: '  Chili  ', per: { calories: '400', protein: 'x', carbs: null, fat: '12abc' }, hasNutrition: 'yes',
      imageUrl: 5, loggedAt: 7, updatedAt: undefined, extra: 'dropped',
    }]);
    expect(e).toEqual({
      id: 'e1', date: TODAY, slot: 'dinner', kind: 'recipe', refId: '12', name: 'Chili', servings: 20,
      per: { calories: 400, protein: 0, carbs: 0, fat: 0 }, hasNutrition: false, updatedAt: '',
    });
  });

  it('copes with a missing per object', () => {
    expect(sanitizeEntries([entry({ per: undefined })])[0].per).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(sanitizeEntries([entry({ per: 'x' })])[0].per).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('keeps the first of two entries with the same id', () => {
    const out = sanitizeEntries([entry({ id: 'x', name: 'First' }), entry({ id: 'x', name: 'Second' })]);
    expect(out.map((e) => e.name)).toEqual(['First']);
  });

  it('is empty for anything that is not a list', () => {
    expect(sanitizeEntries(undefined)).toEqual([]);
    expect(sanitizeEntries({})).toEqual([]);
    expect(sanitizeEntries('x')).toEqual([]);
  });

  it('keeps at most 300 entries, the newest days, in the order they came', () => {
    const many = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => entry({ id: `e${i}`, date: i < 5 ? '2026-01-01' : '2026-10-09' }));
    const out = sanitizeEntries(many);
    expect(out.length).toBe(MAX_ENTRIES);
    expect(out[0].id).toBe('e5');
    expect(out[out.length - 1].id).toBe(`e${MAX_ENTRIES + 4}`);
  });

  it('drops the oldest days first when over the limit, and the later of two on the same day', () => {
    const many = [
      entry({ id: 'oldest', date: '2026-01-01' }),
      ...Array.from({ length: MAX_ENTRIES - 1 }, (_, i) => entry({ id: `m${i}`, date: '2026-10-09' })),
      entry({ id: 'newest', date: '2026-10-09' }),
    ];
    const ids = sanitizeEntries(many).map((e) => e.id);
    expect(ids).not.toContain('oldest');
    expect(ids).toContain('newest');
    const same = Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => entry({ id: `s${i}` }));
    const sameIds = sanitizeEntries(same).map((e) => e.id);
    expect(sameIds).toContain('s0');
    expect(sameIds).not.toContain(`s${MAX_ENTRIES}`);
  });
});

describe('mergeEntries', () => {
  const at = (id, updatedAt, over = {}) => entry({ id, updatedAt, ...over });

  it('has every entry of either copy', () => {
    const out = mergeEntries([at('a', '2026-10-09T10:00:00.000Z')], [at('b', '2026-10-09T10:00:00.000Z')]);
    expect(out.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('takes the copy changed last for an entry in both', () => {
    const local = [at('a', '2026-10-09T10:00:00.000Z', { servings: 1 })];
    const newer = [at('a', '2026-10-09T11:00:00.000Z', { servings: 2 })];
    const older = [at('a', '2026-10-09T09:00:00.000Z', { servings: 3 })];
    expect(mergeEntries(local, newer)[0].servings).toBe(2);
    expect(mergeEntries(local, older)[0].servings).toBe(1);
  });

  it('keeps this phone\'s copy when they were changed at the same time', () => {
    const t = '2026-10-09T10:00:00.000Z';
    expect(mergeEntries([at('a', t, { servings: 1 })], [at('a', t, { servings: 2 })])[0].servings).toBe(1);
  });

  it('keeps this phone\'s order and adds the other\'s after it', () => {
    const t = '2026-10-09T10:00:00.000Z';
    const out = mergeEntries([at('c', t), at('a', t)], [at('b', t), at('a', t), at('d', t)]);
    expect(out.map((e) => e.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores entries that are not real, and copes with no lists', () => {
    expect(mergeEntries([null, entry({ id: 'a' })], ['junk', entry({ id: 'b' })]).map((e) => e.id)).toEqual(['a', 'b']);
    expect(mergeEntries(undefined, undefined)).toEqual([]);
    expect(mergeEntries([entry({ id: 'a' })], undefined).map((e) => e.id)).toEqual(['a']);
    expect(mergeEntries(undefined, [entry({ id: 'a' })]).map((e) => e.id)).toEqual(['a']);
  });
});

describe('details of the entries a plan keeps', () => {
  it('stays on the same day when asked to move no weeks', () => {
    expect(shiftWeek(TODAY)).toBe(TODAY);
    expect(shiftWeek(TODAY, null)).toBe(TODAY);
    expect(shiftWeek(TODAY, 0)).toBe(TODAY);
  });

  it('plans a recipe or food with an id of 0, as text', () => {
    expect(recipeEntry({ ...chili, id: 0 }, { date: TODAY, slot: 'dinner', now: NOW }).refId).toBe('0');
    expect(foodEntry({ id: 0, name: 'Oats', calories: 150 }, { date: TODAY, slot: 'dinner', now: NOW }).refId).toBe('0');
  });

  it('prefers a recipe\'s title to its name, and its image to its imageUrl', () => {
    const e = recipeEntry({ id: 'r2', title: 'Title', name: 'Name', image: 'http://x/a.jpg', imageUrl: 'http://x/b.jpg' }, { date: TODAY, slot: 'lunch', now: NOW });
    expect(e.name).toBe('Title');
    expect(e.imageUrl).toBe('http://x/a.jpg');
  });

  it('trims the name of a food', () => {
    expect(foodEntry({ id: 'f1', name: '  Oats  ', calories: 150 }, { date: TODAY, slot: 'dinner', now: NOW }).name).toBe('Oats');
  });

  it('reads numbers that came as text, for a food', () => {
    const e = foodEntry({ id: 'f1', name: 'Oats', calories: '150', protein: '5', fiber: '4' }, { date: TODAY, slot: 'dinner', now: NOW });
    expect(e.per.calories).toBe(150);
    expect(e.per.protein).toBe(5);
    expect(e.food.calories).toBe(150);
    expect(e.food.fiber).toBe(4);
  });

  it('counts a food with 0 calories as having a calorie number', () => {
    const e = foodEntry({ id: 'f2', name: 'Water', calories: 0 }, { date: TODAY, slot: 'snack', now: NOW });
    expect(e.hasNutrition).toBe(true);
    expect(e.per.calories).toBe(0);
  });

  it('rounds each total to the nearest whole number, not up', () => {
    const t = entryTotals(entry({ servings: 1, per: { calories: 100.4, protein: 10.4, carbs: 20.4, fat: 5.4 } }));
    expect(t).toEqual({ calories: 100, protein: 10, carbs: 20, fat: 5 });
    expect(entryTotals(entry({ servings: 1, per: { calories: 100.6 } })).calories).toBe(101);
  });

  it('prunes only entries with a day when it does not know today', () => {
    const noDay = { id: 'x', slot: 'dinner' };
    expect(pruneEntries([entry({ id: 'a' }), noDay, null], 'garbage').map((e) => e.id)).toEqual(['a']);
  });
});

describe('details of reading a plan back', () => {
  it('keeps an entry whose recipe or food id is 0', () => {
    expect(sanitizeEntries([entry({ refId: 0 })])[0].refId).toBe('0');
  });

  it('leaves out a blank picture, a blank logged time, and a food on a recipe', () => {
    const [clean] = sanitizeEntries([entry({ imageUrl: '', loggedAt: '', food: { id: 'x', name: 'stray' } })]);
    expect('imageUrl' in clean).toBe(false);
    expect('loggedAt' in clean).toBe(false);
    expect('food' in clean).toBe(false);
  });

  it('keeps the order the entries came in when it has to drop some', () => {
    const mixed = Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => entry({ id: `e${i}`, date: i % 2 ? '2026-10-08' : '2026-10-09' }));
    const ids = sanitizeEntries(mixed).map((e) => e.id);
    // The 301 entries are 151 from the 9th and 150 from the 8th; the last one of the 8th goes.
    expect(ids).toHaveLength(MAX_ENTRIES);
    expect(ids).not.toContain('e299');
    expect(ids).toEqual(mixed.filter((e) => e.id !== 'e299').map((e) => e.id));
  });

  it('keeps all 300 when there are exactly 300', () => {
    const exact = Array.from({ length: MAX_ENTRIES }, (_, i) => entry({ id: `e${i}`, date: i % 2 ? '2026-10-08' : '2026-10-09' }));
    expect(sanitizeEntries(exact).map((e) => e.id)).toEqual(exact.map((e) => e.id));
  });

  it('ignores a copy of an entry that is not real, even if it is newer', () => {
    const local = entry({ id: 'a', updatedAt: '2026-10-09T10:00:00.000Z', name: 'Chili' });
    const broken = entry({ id: 'a', updatedAt: '2026-10-09T11:00:00.000Z', name: '' });
    expect(mergeEntries([local], [broken]).map((e) => e.name)).toEqual(['Chili']);
  });

  it('keeps at most 300 after putting two copies together', () => {
    const mine = Array.from({ length: 200 }, (_, i) => entry({ id: `m${i}`, date: '2026-10-01' }));
    const theirs = Array.from({ length: 200 }, (_, i) => entry({ id: `t${i}`, date: '2026-10-09' }));
    const out = mergeEntries(mine, theirs);
    expect(out).toHaveLength(MAX_ENTRIES);
    // All of the newer day, and the first 100 of the older.
    expect(out.filter((e) => e.date === '2026-10-09')).toHaveLength(200);
    expect(out.filter((e) => e.date === '2026-10-01')).toHaveLength(100);
  });
});

import { MEAL_SLOTS, SLOT_IDS, slotForHour, foodBase, scaleFood, foodKey, newLogId, appendToMeals } from '../lib/foodLog';

describe('meal slots', () => {
  it('has the four slots the diary shows, in order', () => {
    expect(SLOT_IDS).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(MEAL_SLOTS.map((s) => s.name)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
  });

  it('picks the slot that fits the hour', () => {
    expect(slotForHour(7)).toBe('breakfast');
    expect(slotForHour(9)).toBe('breakfast');
    expect(slotForHour(10)).toBe('lunch');
    expect(slotForHour(12)).toBe('lunch');
    expect(slotForHour(14)).toBe('lunch');
    expect(slotForHour(15)).toBe('dinner');
    expect(slotForHour(19)).toBe('dinner');
    expect(slotForHour(21)).toBe('snack');
    expect(slotForHour(23)).toBe('snack');
    expect(slotForHour(2)).toBe('snack');
  });

  it('calls a junk hour a snack', () => {
    expect(slotForHour(undefined)).toBe('snack');
    expect(slotForHour('x')).toBe('snack');
  });
});

describe('scaleFood', () => {
  const apple = { id: 'a1', name: 'Apple', servingSize: '100g', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10.4, sodium: 1 };

  it('scales calories and macros to whole numbers', () => {
    const s = scaleFood(apple, 2);
    expect(s.calories).toBe(104);
    expect(s.carbs).toBe(28);
    expect(s.protein).toBe(1);
    expect(s.fat).toBe(0);
  });

  it('scales fiber, sugar and sodium too, to one decimal', () => {
    const s = scaleFood(apple, 1.5);
    expect(s.fiber).toBe(3.6);
    expect(s.sugar).toBe(15.6);
    expect(s.sodium).toBe(1.5);
  });

  it('leaves out nutrients the food does not have', () => {
    const s = scaleFood({ id: 's', name: 'Scanned', calories: 400, protein: 10, carbs: 60, fat: 12 }, 1);
    expect('fiber' in s).toBe(false);
    expect('sugar' in s).toBe(false);
    expect('sodium' in s).toBe(false);
  });

  it('labels the serving and keeps the one-serving values', () => {
    const s = scaleFood(apple, 2);
    expect(s.servingSize).toBe('2x 100g');
    expect(s.quantity).toBe(2);
    expect(s.base).toEqual(foodBase(apple));
    expect(s.base.calories).toBe(52);
    expect(s.base.servingSize).toBe('100g');
  });

  it('scales from the saved one-serving values, not from the already-scaled numbers', () => {
    const logged = { ...apple, ...scaleFood(apple, 2) }; // calories now 104, base still 52
    const again = scaleFood(logged, 3);
    expect(again.calories).toBe(156);
    expect(again.servingSize).toBe('3x 100g');
  });

  it('treats a missing or bad quantity as one serving', () => {
    expect(scaleFood(apple).calories).toBe(52);
    expect(scaleFood(apple, 0).calories).toBe(52);
    expect(scaleFood(apple, 'x').quantity).toBe(1);
  });

  it('calls a food with no serving label 100g', () => {
    expect(scaleFood({ id: 'x', calories: 10 }, 1).servingSize).toBe('1x 100g');
  });
});

describe('foodKey and newLogId', () => {
  it('identifies an entry by its log id, or for older entries its food id', () => {
    expect(foodKey({ id: 'a', logId: 'a-1' })).toBe('a-1');
    expect(foodKey({ id: 'a' })).toBe('a');
    expect(foodKey(null)).toBe(null);
  });

  it('makes a different id for each log of the same food', () => {
    const a = newLogId({ id: 'apple' }, 1000, () => 0.1);
    const b = newLogId({ id: 'apple' }, 1000, () => 0.9);
    expect(a.startsWith('apple-')).toBe(true);
    expect(a).not.toBe(b);
    expect(newLogId({ id: 'apple' }, 1000, () => 0.1)).toBe(a);
  });
});

describe('appendToMeals', () => {
  const oats = { id: 'oats', logId: 'oats-1', name: 'Oats' };
  const egg = { id: 'egg', logId: 'egg-1', name: 'Egg' };

  it('adds to the slot that is already on that day', () => {
    const meals = [{ id: 'lunch', name: 'Lunch', date: '2026-10-08', foods: [oats] }];
    const out = appendToMeals(meals, '2026-10-08', 'lunch', [egg], '12:00:00');
    expect(out).toHaveLength(1);
    expect(out[0].foods.map((f) => f.name)).toEqual(['Oats', 'Egg']);
    expect(meals[0].foods).toHaveLength(1);
  });

  it('starts the slot when that day has none, named like the slot', () => {
    const out = appendToMeals([], '2026-10-08', 'dinner', [egg], '18:30:00');
    expect(out).toEqual([{ id: 'dinner', name: 'Dinner', foods: [egg], time: '18:30:00', date: '2026-10-08' }]);
  });

  it('keeps the same slot on another day apart', () => {
    const meals = [{ id: 'lunch', name: 'Lunch', date: '2026-10-07', foods: [oats] }];
    const out = appendToMeals(meals, '2026-10-08', 'lunch', [egg], 't');
    expect(out).toHaveLength(2);
    expect(out[0].foods).toEqual([oats]);
    expect(out[1].foods).toEqual([egg]);
  });

  it('only adds to the first of two matching records', () => {
    const meals = [
      { id: 'lunch', date: '2026-10-08', foods: [oats] },
      { id: 'lunch', date: '2026-10-08', foods: [] },
    ];
    const out = appendToMeals(meals, '2026-10-08', 'lunch', [egg], 't');
    expect(out[0].foods).toHaveLength(2);
    expect(out[1].foods).toHaveLength(0);
  });

  it('returns the list untouched when there is nothing to add', () => {
    const meals = [{ id: 'lunch', date: '2026-10-08', foods: [oats] }];
    expect(appendToMeals(meals, '2026-10-08', 'lunch', [], 't')).toBe(meals);
    expect(appendToMeals(undefined, '2026-10-08', 'lunch', [], 't')).toEqual([]);
  });
});

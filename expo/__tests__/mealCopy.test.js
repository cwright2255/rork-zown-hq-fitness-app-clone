import { listCopySources, dayLabel, copyFoodEntries, COPY_WINDOW_DAYS } from '../lib/mealCopy';

const food = (name, calories, extra = {}) => ({ id: name.toLowerCase(), logId: `${name.toLowerCase()}-1`, name, calories, ...extra });
const meal = (id, date, foods) => ({ id, name: id, date, foods });

describe('listCopySources', () => {
  const meals = [
    meal('lunch', '2026-10-07', [food('Rice', 200), food('Chicken', 300)]),
    meal('lunch', '2026-10-05', [food('Soup', 150)]),
    meal('dinner', '2026-10-07', [food('Pasta', 500)]),
    meal('breakfast', '2026-10-08', [food('Oats', 300)]),
    meal('lunch', '2026-10-08', [food('Wrap', 400)]),
    meal('snack', '2026-10-06', []),
  ];

  it('lists meals with food, same slot first, then newest day first', () => {
    const out = listCopySources(meals, { targetDate: '2026-10-08', targetMealId: 'lunch' });
    expect(out.map((s) => s.key)).toEqual([
      '2026-10-07|lunch', '2026-10-05|lunch',
      '2026-10-08|breakfast', '2026-10-07|dinner',
    ]);
  });

  it('puts breakfast, lunch, dinner, snack in that order within one day', () => {
    const day = [
      meal('snack', '2026-10-07', [food('Nuts', 100)]),
      meal('dinner', '2026-10-07', [food('Pasta', 500)]),
      meal('breakfast', '2026-10-07', [food('Oats', 300)]),
      meal('lunch', '2026-10-07', [food('Wrap', 400)]),
    ];
    // the target's own slot comes first; the rest follow the usual order
    const out = listCopySources(day, { targetDate: '2026-10-08', targetMealId: 'dinner' });
    expect(out.map((s) => s.mealId)).toEqual(['dinner', 'breakfast', 'lunch', 'snack']);
    const other = listCopySources(day, { targetDate: '2026-10-08', targetMealId: 'breakfast' });
    expect(other.map((s) => s.mealId)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    // on the target day itself, the target slot is left out and the rest keep the order
    const same = listCopySources(day, { targetDate: '2026-10-07', targetMealId: 'lunch' });
    expect(same.map((s) => s.mealId)).toEqual(['breakfast', 'dinner', 'snack']);
  });

  it('names the first three foods and counts the rest', () => {
    const big = [meal('lunch', '2026-10-07', [food('Rice', 1), food('Chicken', 1), food('Beans', 1), food('Salsa', 1), food('Cheese', 1)])];
    const small = [meal('lunch', '2026-10-07', [food('Rice', 1), food('Chicken', 1), food('Beans', 1)])];
    expect(listCopySources(big, { targetDate: '2026-10-08', targetMealId: 'dinner' })[0].preview).toBe('Rice, Chicken, Beans +2');
    expect(listCopySources(small, { targetDate: '2026-10-08', targetMealId: 'dinner' })[0].preview).toBe('Rice, Chicken, Beans');
  });

  it('never offers the slot being copied into', () => {
    const out = listCopySources(meals, { targetDate: '2026-10-08', targetMealId: 'lunch' });
    expect(out.find((s) => s.key === '2026-10-08|lunch')).toBeUndefined();
  });

  it('offers the same slot on the target day only when it is another slot', () => {
    const out = listCopySources(meals, { targetDate: '2026-10-08', targetMealId: 'dinner' });
    expect(out.map((s) => s.key)).toContain('2026-10-08|lunch');
    expect(out.map((s) => s.key)).toContain('2026-10-08|breakfast');
  });

  it('counts the foods and adds up the calories', () => {
    const [first] = listCopySources(meals, { targetDate: '2026-10-08', targetMealId: 'lunch' });
    expect(first).toMatchObject({ date: '2026-10-07', mealId: 'lunch', mealName: 'Lunch', foodCount: 2, calories: 500, sameSlot: true });
  });

  it('skips empty slots and days after the target day', () => {
    const out = listCopySources(meals, { targetDate: '2026-10-06', targetMealId: 'dinner' });
    expect(out.map((s) => s.key)).toEqual(['2026-10-05|lunch']);
  });

  it('looks back 14 days from the target day and no further', () => {
    const old = [meal('lunch', '2026-09-24', [food('A', 1)]), meal('lunch', '2026-09-23', [food('B', 1)])];
    expect(COPY_WINDOW_DAYS).toBe(14);
    const out = listCopySources(old, { targetDate: '2026-10-08', targetMealId: 'dinner' });
    expect(out.map((s) => s.key)).toEqual(['2026-09-24|lunch']);
  });

  it('leaves out records that are not one of the four slots', () => {
    const odd = [meal('recipe', '2026-10-07', [food('X', 10)]), meal('lunch', '2026-10-07', [food('Y', 10)])];
    expect(listCopySources(odd, { targetDate: '2026-10-08', targetMealId: 'dinner' }).map((s) => s.key)).toEqual(['2026-10-07|lunch']);
  });

  it('lists a day and slot once even if it has two records', () => {
    const dup = [meal('lunch', '2026-10-07', [food('A', 1)]), meal('lunch', '2026-10-07', [food('B', 1)])];
    expect(listCopySources(dup, { targetDate: '2026-10-08', targetMealId: 'dinner' })).toHaveLength(1);
  });

  it('copes with junk', () => {
    expect(listCopySources(undefined, { targetDate: '2026-10-08', targetMealId: 'lunch' })).toEqual([]);
    expect(listCopySources([null, { id: 'lunch' }], { targetDate: '2026-10-08', targetMealId: 'lunch' })).toEqual([]);
    expect(listCopySources(meals, { targetDate: 'bad', targetMealId: 'lunch' })).toEqual([]);
  });

  it('counts a food with no calories as 0', () => {
    const m = [meal('lunch', '2026-10-07', [{ id: 'x', name: 'X' }, food('Y', 50)])];
    expect(listCopySources(m, { targetDate: '2026-10-08', targetMealId: 'dinner' })[0].calories).toBe(50);
  });
});

describe('dayLabel', () => {
  const original = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'America/New_York'; });
  afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });

  it('says Today and Yesterday', () => {
    expect(dayLabel('2026-10-08', '2026-10-08')).toBe('Today');
    expect(dayLabel('2026-10-07', '2026-10-08')).toBe('Yesterday');
  });

  it('gives a short date for anything older', () => {
    expect(dayLabel('2026-10-05', '2026-10-08')).toBe('Mon, Oct 5');
  });

  it('echoes a bad key rather than crashing', () => {
    expect(dayLabel('nope', '2026-10-08')).toBe('nope');
  });
});

describe('copyFoodEntries', () => {
  it('gives each copy its own log id and keeps the numbers, serving count and one-serving values', () => {
    const base = { calories: 100, protein: 5, carbs: 10, fat: 2, servingSize: '1 cup' };
    const original = food('Rice', 200, { quantity: 2, base, servingSize: '2x 1 cup' });
    const [a, b] = copyFoodEntries([original, original], { now: 5000, random: () => 0.5 });
    expect(a.logId).not.toBe(original.logId);
    expect(a.logId).not.toBe(b.logId);
    expect(a).toMatchObject({ id: 'rice', name: 'Rice', calories: 200, quantity: 2, base, servingSize: '2x 1 cup' });
    expect(original.logId).toBe('rice-1');
  });

  it('works out the one-serving values and serving count for older entries', () => {
    const [c] = copyFoodEntries([{ id: 'egg', name: 'Egg', calories: 70, protein: 6, carbs: 0, fat: 5 }]);
    expect(c.quantity).toBe(1);
    expect(c.base).toMatchObject({ calories: 70, protein: 6, servingSize: '100g' });
  });

  it('drops empty entries and copes with junk', () => {
    expect(copyFoodEntries([null, undefined])).toEqual([]);
    expect(copyFoodEntries(undefined)).toEqual([]);
  });
});

import { foodTotals, buildHistory, summarizeHistory, keepRecentMeals } from '../lib/nutritionHistory';

const f = (calories, protein = 0, carbs = 0, fat = 0, extra = {}) => ({ calories, protein, carbs, fat, ...extra });
const meal = (id, date, foods) => ({ id, date, foods });

describe('foodTotals', () => {
  it('adds up calories and macros', () => {
    const t = foodTotals([f(300, 10, 40, 5), f(200, 20, 10, 8)]);
    expect([t.calories, t.protein, t.carbs, t.fat, t.foodCount]).toEqual([500, 30, 50, 13, 2]);
  });

  it('adds fiber, sugar and sodium and counts the foods that list them', () => {
    const t = foodTotals([
      f(100, 0, 0, 0, { fiber: 2.5, sugar: 10, sodium: 120 }),
      f(100, 0, 0, 0, { fiber: 1.25, sodium: 30.5 }),
      f(100),
    ]);
    expect([t.fiber, t.sugar, t.sodium]).toEqual([3.8, 10, 150.5]);
    expect(t.listed).toEqual({ fiber: 2, sugar: 1, sodium: 2 });
    expect(t.foodCount).toBe(3);
  });

  it('counts a typed 0 as listed', () => {
    expect(foodTotals([f(10, 0, 0, 0, { fiber: 0 })]).listed.fiber).toBe(1);
  });

  it('treats missing or junk numbers as 0 instead of NaN', () => {
    const t = foodTotals([{ name: 'X' }, { calories: 'abc', protein: null }, { calories: '50' }]);
    expect(t.calories).toBe(50);
    expect(t.protein).toBe(0);
    expect(t.fiber).toBe(0);
  });

  it('is all zeros for nothing', () => {
    expect(foodTotals(undefined)).toMatchObject({ calories: 0, foodCount: 0, listed: { fiber: 0, sugar: 0, sodium: 0 } });
    expect(foodTotals([null]).foodCount).toBe(0);
  });
});

describe('buildHistory', () => {
  const meals = [
    meal('breakfast', '2026-10-06', [f(300, 10, 40, 5)]),
    meal('lunch', '2026-10-06', [f(500, 30, 50, 10, { fiber: 4 })]),
    meal('dinner', '2026-10-08', [f(700, 40, 60, 20)]),
    meal('lunch', '2026-09-01', [f(999)]),
  ];

  it('has one entry per day, oldest first, ending on the end day', () => {
    const h = buildHistory(meals, { endKey: '2026-10-08', days: 4 });
    expect(h.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
  });

  it('totals every slot on a day, and keeps empty days as gaps', () => {
    const h = buildHistory(meals, { endKey: '2026-10-08', days: 4 });
    expect(h[1]).toMatchObject({ date: '2026-10-06', logged: true, calories: 800, protein: 40, fiber: 4, foodCount: 2 });
    expect(h[0]).toMatchObject({ logged: false, calories: 0, foodCount: 0 });
    expect(h[2].logged).toBe(false);
    expect(h[3]).toMatchObject({ logged: true, calories: 700 });
  });

  it('leaves out days outside the window', () => {
    const h = buildHistory(meals, { endKey: '2026-10-08', days: 7 });
    expect(h.reduce((s, d) => s + d.calories, 0)).toBe(1500);
  });

  it('copes with junk meals', () => {
    expect(buildHistory([null, { id: 'x' }, { date: 5 }], { endKey: '2026-10-08', days: 2 }).every((d) => !d.logged)).toBe(true);
    expect(buildHistory(undefined, { endKey: '2026-10-08', days: 3 })).toHaveLength(3);
  });
});

describe('summarizeHistory', () => {
  const meals = [
    meal('lunch', '2026-10-06', [f(1800, 100, 200, 60, { fiber: 20, sodium: 2000 })]),
    meal('lunch', '2026-10-07', [f(2200, 140, 260, 80, { fiber: 30, sodium: 3000 })]),
  ];
  const h = buildHistory(meals, { endKey: '2026-10-08', days: 7 });

  it('averages over the days that have food, not all seven', () => {
    const s = summarizeHistory(h, { calories: 2000 });
    expect(s.totalDays).toBe(7);
    expect(s.loggedDays).toBe(2);
    expect(s.avgCalories).toBe(2000);
    expect([s.avgProtein, s.avgCarbs, s.avgFat]).toEqual([120, 230, 70]);
  });

  it('compares the average with the calorie goal', () => {
    expect(summarizeHistory(h, { calories: 1800 }).calorieDiff).toBe(200);
    expect(summarizeHistory(h, { calories: 2500 }).calorieDiff).toBe(-500);
    expect(summarizeHistory(h, {}).calorieDiff).toBeNull();
  });

  it('averages fiber, sugar and sodium only over days that list them', () => {
    const s = summarizeHistory(h, { calories: 2000 });
    expect(s.avgFiber).toBe(25);
    expect(s.avgSodium).toBe(2500);
    expect(s.avgSugar).toBeNull();
  });

  it('does not let a day that lists none drag the fiber average down', () => {
    const more = buildHistory([...meals, meal('dinner', '2026-10-05', [f(1000)])], { endKey: '2026-10-08', days: 7 });
    expect(summarizeHistory(more, { calories: 2000 }).avgFiber).toBe(25);
    expect(summarizeHistory(more, { calories: 2000 }).loggedDays).toBe(3);
  });

  it('gives nulls, not zeros, when nothing is logged', () => {
    const s = summarizeHistory(buildHistory([], { endKey: '2026-10-08', days: 7 }), { calories: 2000 });
    expect(s).toMatchObject({ loggedDays: 0, avgCalories: null, avgProtein: null, avgFiber: null, calorieDiff: null });
  });

  it('works out the tallest bar for a chart, never below the goal', () => {
    expect(summarizeHistory(h, { calories: 2000 }).maxCalories).toBe(2200);
    expect(summarizeHistory(h, { calories: 3000 }).maxCalories).toBe(3000);
    expect(summarizeHistory([], { calories: 0 }).maxCalories).toBe(0);
  });
});

describe('keepRecentMeals', () => {
  const today = new Date(2026, 9, 8, 12);
  const m = (date) => ({ id: 'lunch', date, foods: [] });

  it('keeps the last 30 days and drops the rest', () => {
    const out = keepRecentMeals([m('2026-09-07'), m('2026-09-08'), m('2026-10-08')], { today });
    expect(out.map((x) => x.date)).toEqual(['2026-09-08', '2026-10-08']);
  });

  it('keeps meals with no date rather than losing them', () => {
    const out = keepRecentMeals([{ id: 'x', foods: [] }, m('2026-01-01')], { today });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('x');
  });

  it('caps the count, keeping the newest', () => {
    const list = Array.from({ length: 10 }, (_, i) => m(`2026-10-0${(i % 8) + 1}`));
    list[9] = m('2026-10-08');
    const out = keepRecentMeals(list, { today, max: 3 });
    expect(out).toHaveLength(3);
    expect(out[2].date).toBe('2026-10-08');
  });

  it('drops null entries and copes with junk', () => {
    expect(keepRecentMeals([null, m('2026-10-08')], { today })).toHaveLength(1);
    expect(keepRecentMeals(undefined, { today })).toEqual([]);
  });
});

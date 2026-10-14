import { eatGoal, burnGoal, eatenOn } from '../lib/calorieGoals';

describe('eatGoal: the calories to eat in a day', () => {
  const real = (calories) => ({ dailyGoals: { calories, protein: 150, carbs: 200, fat: 65 }, dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z' });

  it('is the nutrition store\'s calorie target once one has been worked out for the person', () => {
    expect(eatGoal(real(2350))).toBe(2350);
    expect(eatGoal(real('2350'))).toBe(2350);
    expect(eatGoal(real(2349.6))).toBe(2350);
  });

  it('is null while the store only holds its starting placeholder of 2000', () => {
    expect(eatGoal({ dailyGoals: { calories: 2000 }, dailyGoalsUpdatedAt: null })).toBeNull();
    expect(eatGoal({ dailyGoals: { calories: 2000 } })).toBeNull();
  });

  it('is null for a missing, empty, zero or non-numeric target', () => {
    for (const bad of [undefined, null, 0, -5, NaN, 'lots', {}]) {
      expect({ bad: String(bad), goal: eatGoal(real(bad)) }).toEqual({ bad: String(bad), goal: null });
    }
    expect(eatGoal(undefined)).toBeNull();
    expect(eatGoal(null)).toBeNull();
    expect(eatGoal({ dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z' })).toBeNull();
  });
});

describe('burnGoal: the calories to burn in a day', () => {
  it('is the user\'s dailyCalorieGoal', () => {
    expect(burnGoal({ dailyCalorieGoal: 500 })).toBe(500);
    expect(burnGoal({ dailyCalorieGoal: '650' })).toBe(650);
  });

  it('is null when the person has not set one', () => {
    for (const user of [undefined, null, {}, { dailyCalorieGoal: null }, { dailyCalorieGoal: 0 }, { dailyCalorieGoal: 'x' }]) {
      expect(burnGoal(user)).toBeNull();
    }
  });

  it('is not the eat goal, whichever record carries both', () => {
    const user = { dailyCalorieGoal: 500 };
    const nutrition = { dailyGoals: { calories: 2400 }, dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z' };
    expect(burnGoal(user)).toBe(500);
    expect(eatGoal(nutrition)).toBe(2400);
  });
});

describe('eatenOn: the calories eaten on a day', () => {
  const meals = [
    { id: 'breakfast', date: '2026-10-14', foods: [{ calories: 300 }, { calories: 120.4 }] },
    { id: 'dinner', date: '2026-10-14', foods: [{ calories: 650 }] },
    { id: 'dinner', date: '2026-10-13', foods: [{ calories: 900 }] },
    { id: 'snack', date: '2026-10-15', foods: [{ calories: 200 }] },
  ];

  it('adds up every food on that day and no other', () => {
    expect(eatenOn(meals, '2026-10-14')).toBe(1070);
    expect(eatenOn(meals, '2026-10-13')).toBe(900);
    expect(eatenOn(meals, '2026-10-12')).toBe(0);
  });

  it('counts a food with no usable calories as 0 instead of making the day NaN', () => {
    const odd = [{ date: '2026-10-14', foods: [{ calories: 100 }, { calories: undefined }, { calories: 'x' }, { calories: -50 }, null, {}] }];
    expect(eatenOn(odd, '2026-10-14')).toBe(100);
  });

  it('copes with a diary that is empty, missing or malformed', () => {
    expect(eatenOn([], '2026-10-14')).toBe(0);
    expect(eatenOn(undefined, '2026-10-14')).toBe(0);
    expect(eatenOn(null, '2026-10-14')).toBe(0);
    expect(eatenOn(meals, undefined)).toBe(0);
    expect(eatenOn([null, { date: '2026-10-14' }, { date: '2026-10-14', foods: 'none' }], '2026-10-14')).toBe(0);
  });
});

const mockAwardMealXp = jest.fn();
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('../store/expStore', () => ({
  useExpStore: { getState: () => ({ awardMealXp: mockAwardMealXp }) },
}));
jest.mock('../store/userStore', () => ({
  useUserStore: { getState: () => ({ user: { uid: 'u1' } }) },
}));

import { useNutritionStore } from '../store/nutritionStore';
import { setDoc, getDoc } from 'firebase/firestore';

const apple = (extra = {}) => ({ id: 'a1', name: 'Apple', servingSize: '100g', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, ...extra });
const rice = () => ({ id: 'r1', name: 'Rice', servingSize: '100g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 });

const store = () => useNutritionStore.getState();
const foodsOn = (date, mealId) => {
  const meal = store().meals.find((m) => m.date === date && m.id === mealId);
  return meal ? meal.foods : [];
};

beforeEach(() => {
  mockAwardMealXp.mockClear();
  useNutritionStore.setState({ meals: [], recentFoods: [], favoriteFood: [], customFoods: [], syncUid: null });
});

describe('addFoodToMeal', () => {
  it('puts the food in the slot on that day', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    expect(foodsOn('2026-10-08', 'lunch').map((f) => f.name)).toEqual(['Apple']);
    expect(store().getMealsByDate('2026-10-09')).toEqual([]);
  });

  it('gives every log its own id, even for the same food logged twice', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    const [a, b] = foodsOn('2026-10-08', 'lunch');
    expect(a.logId).toBeTruthy();
    expect(b.logId).toBeTruthy();
    expect(a.logId).not.toBe(b.logId);
    expect(a.id).toBe(b.id);
  });

  it('keeps the one-serving values and the serving count with the entry', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    const [f] = foodsOn('2026-10-08', 'lunch');
    expect(f.quantity).toBe(1);
    expect(f.base.calories).toBe(52);
    expect(f.base.servingSize).toBe('100g');
  });

  it('keeps the base of a food that was already scaled to several servings', () => {
    const scaled = apple({ calories: 104, quantity: 2, servingSize: '2x 100g', base: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, servingSize: '100g' } });
    store().addFoodToMeal('2026-10-08', 'lunch', scaled);
    const [f] = foodsOn('2026-10-08', 'lunch');
    expect(f.quantity).toBe(2);
    expect(f.base.calories).toBe(52);
  });

  it('does not carry a log id into the recent foods list', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    expect(store().recentFoods[0].logId).toBeUndefined();
  });

  it('still counts the day\'s totals', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    store().addFoodToMeal('2026-10-08', 'dinner', rice());
    expect(store().getDailyNutrition('2026-10-08').calories).toBe(182);
  });
});

describe('removeFoodFromMeal', () => {
  it('removes only the one entry', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    const [first, second] = foodsOn('2026-10-08', 'lunch');
    store().removeFoodFromMeal('lunch', first.logId, '2026-10-08');
    expect(foodsOn('2026-10-08', 'lunch').map((f) => f.logId)).toEqual([second.logId]);
  });

  it('leaves the same food on other days alone', () => {
    store().addFoodToMeal('2026-10-07', 'lunch', apple());
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    const mine = foodsOn('2026-10-08', 'lunch')[0];
    store().removeFoodFromMeal('lunch', mine.logId, '2026-10-08');
    expect(foodsOn('2026-10-08', 'lunch')).toEqual([]);
    expect(foodsOn('2026-10-07', 'lunch')).toHaveLength(1);
  });

  it('removes an older entry that has no log id, by its food id and day, without touching other days', () => {
    useNutritionStore.setState({
      meals: [
        { id: 'lunch', date: '2026-10-07', foods: [{ id: 'old-1', name: 'Soup', calories: 100 }] },
        { id: 'lunch', date: '2026-10-08', foods: [{ id: 'old-1', name: 'Soup', calories: 100 }] },
      ],
    });
    store().removeFoodFromMeal('lunch', 'old-1', '2026-10-08');
    expect(foodsOn('2026-10-08', 'lunch')).toEqual([]);
    expect(foodsOn('2026-10-07', 'lunch')).toHaveLength(1);
  });

  it('does nothing for an entry that is not there', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    store().removeFoodFromMeal('lunch', 'nope', '2026-10-08');
    expect(foodsOn('2026-10-08', 'lunch')).toHaveLength(1);
  });

  it('can remove food saved under a made-up meal id (what recipe logging used to do)', () => {
    useNutritionStore.setState({
      meals: [{ id: 'meal-1700000000000', date: '2026-10-08', foods: [{ id: 'recipe-5-1', name: 'Chili', calories: 500 }] }],
    });
    store().removeFoodFromMeal('meal-1700000000000', 'recipe-5-1', '2026-10-08');
    expect(store().getDailyNutrition('2026-10-08').calories).toBe(0);
  });
});

describe('updateFoodInMeal', () => {
  it('changes only the one entry', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    const [first, second] = foodsOn('2026-10-08', 'lunch');
    store().updateFoodInMeal('lunch', second.logId, { calories: 104, quantity: 2 }, '2026-10-08');
    const [a, b] = foodsOn('2026-10-08', 'lunch');
    expect(a.calories).toBe(52);
    expect(a.logId).toBe(first.logId);
    expect(b.calories).toBe(104);
    expect(b.quantity).toBe(2);
    expect(b.base.calories).toBe(52);
  });
});

describe('findLoggedFood', () => {
  it('finds an entry and the meal it is in', () => {
    store().addFoodToMeal('2026-10-08', 'dinner', rice());
    const logId = foodsOn('2026-10-08', 'dinner')[0].logId;
    const hit = store().findLoggedFood(logId);
    expect(hit.food.name).toBe('Rice');
    expect(hit.meal.id).toBe('dinner');
    expect(hit.meal.date).toBe('2026-10-08');
  });

  it('finds an older entry by its food id', () => {
    useNutritionStore.setState({ meals: [{ id: 'lunch', date: '2026-10-08', foods: [{ id: 'old-1', name: 'Soup' }] }] });
    expect(store().findLoggedFood('old-1').food.name).toBe('Soup');
  });

  it('returns null when there is nothing', () => {
    expect(store().findLoggedFood('nope')).toBe(null);
    expect(store().findLoggedFood(undefined)).toBe(null);
  });
});

describe('quick add', () => {
  const quick = (extra = {}) => ({ id: 'quick-add', name: 'Quick add', servingSize: '1 serving', calories: 350, protein: 0, carbs: 0, fat: 0, quickAdd: true, ...extra });

  it('is logged like any food and counts in the day\'s calories', () => {
    store().addFoodToMeal('2026-10-08', 'dinner', quick());
    const [f] = foodsOn('2026-10-08', 'dinner');
    expect(f).toMatchObject({ name: 'Quick add', calories: 350, quantity: 1, quickAdd: true });
    expect(f.base.calories).toBe(350);
    expect(store().getDailyNutrition('2026-10-08').calories).toBe(350);
  });

  it('is not put on the recent foods list', () => {
    store().addFoodToMeal('2026-10-08', 'lunch', apple());
    store().addFoodToMeal('2026-10-08', 'dinner', quick());
    expect(store().recentFoods.map((f) => f.name)).toEqual(['Apple']);
  });

  it('earns no XP, while a real food still does', () => {
    store().addFoodToMeal('2026-10-08', 'dinner', quick());
    expect(mockAwardMealXp).not.toHaveBeenCalled();
    store().addFoodToMeal('2026-10-08', 'dinner', apple());
    expect(mockAwardMealXp).toHaveBeenCalledTimes(1);
    expect(mockAwardMealXp.mock.calls[0][0]).toBe('apple');
  });
});

describe('custom foods', () => {
  const shake = { name: 'Protein shake', servingSize: '1 scoop', calories: '120', protein: '24', carbs: '3', fat: '1' };

  it('adds a food to the front of My Foods and returns it', () => {
    const a = store().addCustomFood(shake);
    const b = store().addCustomFood({ name: 'Bar', calories: '200' });
    expect(a.ok).toBe(true);
    expect(store().customFoods.map((f) => f.name)).toEqual(['Bar', 'Protein shake']);
    expect(store().customFoods[1]).toMatchObject({ id: a.food.id, calories: 120, protein: 24, custom: true });
    expect(a.food.id).not.toBe(b.food.id);
  });

  it('adds nothing and says why when the form is not valid', () => {
    const r = store().addCustomFood({ name: '', calories: 'x' });
    expect(r.ok).toBe(false);
    expect(r.errors.name).toBeTruthy();
    expect(store().customFoods).toEqual([]);
  });

  it('stops at 200 custom foods', () => {
    useNutritionStore.setState({ customFoods: Array.from({ length: 200 }, (_, i) => ({ id: `custom-${i}`, name: `F${i}`, calories: 1 })) });
    const r = store().addCustomFood({ name: 'One too many', calories: '1' });
    expect(r.ok).toBe(false);
    expect(store().customFoods).toHaveLength(200);
  });

  it('changes a food but keeps its id, and leaves the diary alone', () => {
    const { food } = store().addCustomFood(shake);
    store().addFoodToMeal('2026-10-08', 'lunch', food);
    const r = store().updateCustomFood(food.id, { ...shake, calories: '150' });
    expect(r.ok).toBe(true);
    expect(store().customFoods[0]).toMatchObject({ id: food.id, calories: 150 });
    expect(foodsOn('2026-10-08', 'lunch')[0].calories).toBe(120);
  });

  it('does not change a food that is not there, or save a bad edit', () => {
    expect(store().updateCustomFood('custom-nope', shake).ok).toBe(false);
    const { food } = store().addCustomFood(shake);
    expect(store().updateCustomFood(food.id, { ...shake, calories: '' }).ok).toBe(false);
    expect(store().customFoods[0].calories).toBe(120);
  });

  it('deletes a food without removing it from days it was already logged on', () => {
    const { food } = store().addCustomFood(shake);
    store().addFoodToMeal('2026-10-08', 'lunch', food);
    store().removeCustomFood(food.id);
    expect(store().customFoods).toEqual([]);
    expect(foodsOn('2026-10-08', 'lunch')).toHaveLength(1);
  });

  it('logs like any food: kept on the recent list, earns XP', () => {
    const { food } = store().addCustomFood(shake);
    store().addFoodToMeal('2026-10-08', 'lunch', food);
    expect(store().recentFoods[0].id).toBe(food.id);
    expect(mockAwardMealXp).toHaveBeenCalledTimes(1);
  });
});

describe('what is sent to the cloud', () => {
  beforeEach(() => { setDoc.mockClear(); });

  const undefinedAt = (value, path = '') => {
    if (value === undefined) return path;
    if (value && typeof value === 'object') {
      for (const k of Object.keys(value)) {
        const hit = undefinedAt(value[k], `${path}.${k}`);
        if (hit) return hit;
      }
    }
    return null;
  };

  it('has no undefined anywhere (a food with no brand or fiber would make Firestore refuse the whole document)', () => {
    useNutritionStore.setState({ syncUid: 'u1' });
    store().addFoodToMeal('2026-10-08', 'lunch', apple({ brand: undefined }));
    store().addFoodToMeal('2026-10-08', 'lunch', { id: 'recipe-1', name: 'Chili', calories: 400 });
    const sent = setDoc.mock.calls[setDoc.mock.calls.length - 1][1];
    expect(sent.meals[0].foods).toHaveLength(2);
    expect(undefinedAt(sent)).toBeNull();
  });

  it('still carries the foods, their one-serving values and the merge option', () => {
    useNutritionStore.setState({ syncUid: 'u1' });
    store().addFoodToMeal('2026-10-08', 'lunch', apple({ brand: undefined }));
    const [, sent, options] = setDoc.mock.calls[setDoc.mock.calls.length - 1];
    expect(sent.meals[0].foods[0]).toMatchObject({ name: 'Apple', calories: 52, quantity: 1, base: { calories: 52 } });
    expect(sent.updatedAt).toEqual(expect.any(String));
    expect(options).toEqual({ merge: true });
  });
});

describe('custom foods and the cloud copy', () => {
  beforeEach(() => { setDoc.mockClear(); getDoc.mockReset(); });

  it('are saved with the rest of the nutrition data', () => {
    useNutritionStore.setState({ syncUid: 'u1' });
    const { food } = store().addCustomFood({ name: 'Bar', calories: '200' });
    const saved = setDoc.mock.calls[setDoc.mock.calls.length - 1][1];
    expect(saved.customFoods).toEqual([food]);
  });

  it('come back from the cloud', async () => {
    const cloud = [{ id: 'custom-1', name: 'Cloud bar', calories: 100, custom: true }];
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ meals: [], customFoods: cloud }) });
    await store().loadNutritionData('u1');
    expect(store().customFoods).toEqual(cloud);
  });

  it('are kept on the phone when the cloud copy was saved before they existed', async () => {
    const { food } = store().addCustomFood({ name: 'Bar', calories: '200' });
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ meals: [] }) });
    await store().loadNutritionData('u1');
    expect(store().customFoods).toEqual([food]);
  });

  it('are emptied when the cloud copy says there are none (deleted on another device)', async () => {
    store().addCustomFood({ name: 'Bar', calories: '200' });
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ meals: [], customFoods: [] }) });
    await store().loadNutritionData('u1');
    expect(store().customFoods).toEqual([]);
  });
});

describe('copyMealFoods', () => {
  beforeEach(() => { jest.useFakeTimers({ now: new Date(2026, 9, 8, 12, 0, 0) }); });
  afterEach(() => { jest.useRealTimers(); });

  const seed = () => {
    store().addFoodToMeal('2026-10-07', 'lunch', apple());
    store().addFoodToMeal('2026-10-07', 'lunch', apple({ id: 'a2', name: 'Banana', calories: 90 }));
    mockAwardMealXp.mockClear();
  };
  const copy = (extra = {}) => store().copyMealFoods({ fromDate: '2026-10-07', fromMealId: 'lunch', toDate: '2026-10-08', toMealId: 'dinner', ...extra });

  it('puts every food of that meal into the other slot and says how many', () => {
    seed();
    expect(copy()).toBe(2);
    expect(foodsOn('2026-10-08', 'dinner').map((f) => f.name)).toEqual(['Apple', 'Banana']);
    expect(foodsOn('2026-10-07', 'lunch')).toHaveLength(2);
  });

  it('gives the copies their own log ids and keeps their serving numbers', () => {
    seed();
    const orig = foodsOn('2026-10-07', 'lunch');
    copy();
    const copies = foodsOn('2026-10-08', 'dinner');
    expect(copies.map((f) => f.logId).filter((id) => orig.some((o) => o.logId === id))).toEqual([]);
    expect(new Set(copies.map((f) => f.logId)).size).toBe(2);
    expect(copies[0]).toMatchObject({ calories: 52, quantity: 1 });
    expect(copies[0].base.calories).toBe(52);
  });

  it('can change or remove a copy without touching the original', () => {
    seed();
    copy();
    const [c] = foodsOn('2026-10-08', 'dinner');
    store().removeFoodFromMeal('dinner', c.logId, '2026-10-08');
    expect(foodsOn('2026-10-08', 'dinner')).toHaveLength(1);
    expect(foodsOn('2026-10-07', 'lunch')).toHaveLength(2);
  });

  it('adds to what the slot already has', () => {
    seed();
    store().addFoodToMeal('2026-10-08', 'dinner', rice());
    copy();
    expect(foodsOn('2026-10-08', 'dinner').map((f) => f.name)).toEqual(['Rice', 'Apple', 'Banana']);
  });

  it('counts in the target day\'s totals in one update', () => {
    seed();
    const seen = [];
    const unsub = useNutritionStore.subscribe((st) => seen.push(st.meals.length));
    copy();
    unsub();
    expect(seen).toHaveLength(1);
    expect(store().getDailyNutrition('2026-10-08').calories).toBe(142);
  });

  it('gives XP for copying into today, once per food per day as usual', () => {
    seed();
    copy();
    expect(mockAwardMealXp.mock.calls.map((c) => c[0])).toEqual(['apple', 'banana']);
  });

  it('gives no XP for copying into another day', () => {
    seed();
    copy({ toDate: '2026-10-06' });
    expect(mockAwardMealXp).not.toHaveBeenCalled();
    expect(foodsOn('2026-10-06', 'dinner')).toHaveLength(2);
  });

  it('gives no XP for a quick add that is copied', () => {
    store().addFoodToMeal('2026-10-07', 'lunch', { id: 'quick-add', name: 'Quick add', calories: 300, quickAdd: true });
    mockAwardMealXp.mockClear();
    copy();
    expect(mockAwardMealXp).not.toHaveBeenCalled();
    expect(foodsOn('2026-10-08', 'dinner')[0].quickAdd).toBe(true);
  });

  it('leaves the recent foods list as it was', () => {
    seed();
    const before = store().recentFoods;
    copy();
    expect(store().recentFoods).toBe(before);
  });

  it('copies nothing from a meal that is empty or not there', () => {
    seed();
    expect(copy({ fromMealId: 'snack' })).toBe(0);
    expect(copy({ fromDate: '2026-01-01' })).toBe(0);
    expect(foodsOn('2026-10-08', 'dinner')).toEqual([]);
  });

  it('can copy into another slot of the same day', () => {
    seed();
    copy({ toDate: '2026-10-07', toMealId: 'snack' });
    expect(foodsOn('2026-10-07', 'snack')).toHaveLength(2);
    expect(foodsOn('2026-10-07', 'lunch')).toHaveLength(2);
  });
});

describe('what stays on the phone', () => {
  beforeEach(() => { jest.useFakeTimers({ now: new Date(2026, 9, 8, 12, 0, 0) }); });
  afterEach(() => { jest.useRealTimers(); });
  const saved = () => useNutritionStore.persist.getOptions().partialize(useNutritionStore.getState());

  it('keeps the last 30 days of meals, not just the last 30 slots', () => {
    const meals = [];
    for (let d = 1; d <= 8; d++) {
      ['breakfast', 'lunch', 'dinner', 'snack'].forEach((id) => meals.push({ id, date: `2026-10-0${d}`, foods: [] }));
    }
    meals.unshift({ id: 'lunch', date: '2026-08-01', foods: [] });
    useNutritionStore.setState({ meals });
    const kept = saved().meals;
    expect(kept).toHaveLength(32);
    expect(kept.some((m) => m.date === '2026-08-01')).toBe(false);
  });

  it('keeps custom foods', () => {
    store().addCustomFood({ name: 'Bar', calories: '200' });
    expect(saved().customFoods).toHaveLength(1);
  });
});

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params,
  router: {
    back: (...a) => global.__router.back(...a),
    replace: (...a) => global.__router.replace(...a),
    push: (...a) => global.__router.push(...a),
    canGoBack: () => global.__router.canGoBack(),
  },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ rightAction }) => mockReact.createElement(mockRn.View, null, rightAction || null),
  };
});
jest.mock('@/store/nutritionStore', () => ({ useNutritionStore: () => global.__nutrition }));
jest.mock('@/services/calorieApiService', () => ({
  getFoodById: (...a) => global.__getFoodById(...a),
  gradeToStars: (g) => ({ A: 5, B: 4, C: 3, D: 2 }[g] || 1),
}));

import FoodDetailScreen from '../app/nutrition/food/[id]';

const apple = (extra = {}) => ({
  id: 'a1', name: 'Apple', servingSize: '100g', calories: 52, protein: 0.3, carbs: 14, fat: 0.2,
  nutritionalScore: { score: 'B' }, ...extra,
});

const open = ({ params, nutrition, food } = {}) => {
  global.__params = params || { id: 'a1' };
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__getFoodById = jest.fn(async () => (food === undefined ? apple() : food));
  global.__nutrition = {
    favoriteFood: [],
    addToFavorites: jest.fn(),
    removeFromFavorites: jest.fn(),
    addFoodToMeal: jest.fn(),
    removeFoodFromMeal: jest.fn(),
    updateFoodInMeal: jest.fn(),
    findLoggedFood: jest.fn(() => null),
    customFoods: [],
    dailyGoals: { protein: 150, carbs: 200, fat: 65 },
    ...nutrition,
  };
  return render(<FoodDetailScreen />);
};

// 9:30 PM on Thu 8 Oct 2026 in New Jersey: the UTC date has already turned over to Oct 9.
const EVENING = new Date('2026-10-09T01:30:00Z');
const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('logging a food from the database', () => {
  it('loads the food and logs it to the chosen meal on the local day', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(EVENING);
    const utils = open({ params: { id: 'a1', mealId: 'dinner' } });
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(1);
    const [date, mealId, logged] = global.__nutrition.addFoodToMeal.mock.calls[0];
    expect(date).toBe('2026-10-08'); // not 2026-10-09
    expect(mealId).toBe('dinner');
    expect(logged.calories).toBe(52);
    expect(logged.quantity).toBe(1);
    expect(logged.servingSize).toBe('1x 100g');
    expect(logged.base.calories).toBe(52);
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('scales the numbers with the serving count and keeps the one-serving values', async () => {
    const utils = open({ params: { id: 'a1', mealId: 'lunch' } });
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    fireEvent.press(utils.getByTestId('food-plus'));
    fireEvent.press(utils.getByTestId('food-plus'));
    expect(utils.getByTestId('food-calories').props.children).toBe(104);
    expect(utils.getByTestId('food-quantity').props.children).toEqual([2, 'x']);
    fireEvent.press(utils.getByText('Add to Log'));
    const logged = global.__nutrition.addFoodToMeal.mock.calls[0][2];
    expect(logged.calories).toBe(104);
    expect(logged.quantity).toBe(2);
    expect(logged.servingSize).toBe('2x 100g');
    expect(logged.base.calories).toBe(52);
  });

  it('starts on the meal that fits the time of day when none was picked', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(new Date('2026-10-08T16:00:00Z')); // noon in New Jersey
    const utils = open({ params: { id: 'a1' } });
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][1]).toBe('lunch');
  });

  it('says so, instead of spinning forever, when the food cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = open({ params: { id: 'gone' }, food: null });
    await waitFor(() => expect(utils.getByTestId('food-load-failed')).toBeTruthy());
    expect(utils.queryByText('Add to Log')).toBeNull();
  });
});

describe('logging a scanned food', () => {
  const scanned = { name: 'Oat Bar', brand: 'Acme', calories: 400, protein: 10, carbs: 60, fat: 12, servingSize: '100g', barcode: '0123' };

  it('uses the scan from the route, with no database lookup', async () => {
    const utils = open({ params: { id: 'scanned', scannedFood: JSON.stringify(scanned), mealId: 'snack' } });
    await waitFor(() => expect(utils.getByText('Oat Bar')).toBeTruthy());
    expect(global.__getFoodById).not.toHaveBeenCalled();
    expect(utils.getByText('Acme')).toBeTruthy();
    expect(utils.getByTestId('food-calories').props.children).toBe(400);
  });

  it('logs it to the meal it was started from', async () => {
    const utils = open({ params: { id: 'scanned', scannedFood: JSON.stringify(scanned), mealId: 'snack' } });
    await waitFor(() => expect(utils.getByText('Oat Bar')).toBeTruthy());
    fireEvent.press(utils.getByText('Add to Log'));
    const [, mealId, logged] = global.__nutrition.addFoodToMeal.mock.calls[0];
    expect(mealId).toBe('snack');
    expect(logged.name).toBe('Oat Bar');
    expect(logged.calories).toBe(400);
    expect(logged.servingSize).toBe('1x 100g');
    expect(logged.id.startsWith('scanned-0123')).toBe(true);
  });

  it('shows the failure message for a scan it cannot read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = open({ params: { id: 'scanned', scannedFood: 'not json' } });
    await waitFor(() => expect(utils.getByTestId('food-load-failed')).toBeTruthy());
  });
});

describe('a food that is already in the diary', () => {
  const entry = (extra = {}) => ({
    id: 'a1-1700', logId: 'a1-abc', name: 'Apple', servingSize: '2x 100g', calories: 104, protein: 1, carbs: 28, fat: 0,
    quantity: 2, base: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, servingSize: '100g' }, ...extra,
  });
  const hit = (food) => ({ meal: { id: 'lunch', date: '2026-10-08', foods: [food] }, food });
  const openLogged = (food, extra = {}) => open({
    params: { id: 'a1-abc' },
    nutrition: { findLoggedFood: jest.fn(() => hit(food)) },
    ...extra,
  });

  it('shows what was logged, with update and remove instead of add', async () => {
    const utils = openLogged(entry());
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    expect(utils.getByTestId('food-calories').props.children).toBe(104);
    expect(utils.getByText('Update Serving')).toBeTruthy();
    expect(utils.getByTestId('food-remove')).toBeTruthy();
    expect(utils.queryByText('Add to Log')).toBeNull();
    expect(global.__getFoodById).not.toHaveBeenCalled();
  });

  it('changes the serving count of that one entry', async () => {
    const utils = openLogged(entry());
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    fireEvent.press(utils.getByTestId('food-plus'));
    expect(utils.getByTestId('food-calories').props.children).toBe(130);
    fireEvent.press(utils.getByText('Update Serving'));
    expect(global.__nutrition.updateFoodInMeal).toHaveBeenCalledTimes(1);
    const [mealId, key, changes, date] = global.__nutrition.updateFoodInMeal.mock.calls[0];
    expect(mealId).toBe('lunch');
    expect(key).toBe('a1-abc');
    expect(date).toBe('2026-10-08');
    expect(changes.calories).toBe(130);
    expect(changes.quantity).toBe(2.5);
    expect(changes.servingSize).toBe('2.5x 100g');
    expect('base' in changes).toBe(false);
    expect(global.__router.back).toHaveBeenCalled();
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
  });

  it('does not update when the serving count is unchanged', async () => {
    const utils = openLogged(entry());
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    fireEvent.press(utils.getByText('Update Serving'));
    expect(global.__nutrition.updateFoodInMeal).not.toHaveBeenCalled();
  });

  it('removes that one entry after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = openLogged(entry());
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    fireEvent.press(utils.getByTestId('food-remove'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(global.__nutrition.removeFoodFromMeal).not.toHaveBeenCalled();
    const remove = alert.mock.calls[0][2].find((b) => b.text === 'Remove');
    act(() => remove.onPress());
    expect(global.__nutrition.removeFoodFromMeal).toHaveBeenCalledWith('lunch', 'a1-abc', '2026-10-08');
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('does not remove anything when the question is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = openLogged(entry());
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    fireEvent.press(utils.getByTestId('food-remove'));
    const cancel = alert.mock.calls[0][2].find((b) => b.text === 'Cancel');
    expect(cancel.onPress).toBeUndefined();
    expect(global.__nutrition.removeFoodFromMeal).not.toHaveBeenCalled();
  });

  it('lets an older entry (saved before one-serving values were kept) be removed but not re-scaled', async () => {
    const legacy = { id: 'old-1', name: 'Soup', servingSize: '1x 100g', calories: 100, protein: 5, carbs: 10, fat: 3 };
    const utils = openLogged(legacy);
    await waitFor(() => expect(utils.getByText('Soup')).toBeTruthy());
    expect(utils.queryByTestId('food-plus')).toBeNull();
    expect(utils.queryByText('Update Serving')).toBeNull();
    expect(utils.getByTestId('food-calories').props.children).toBe(100);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fireEvent.press(utils.getByTestId('food-remove'));
    act(() => alert.mock.calls[0][2].find((b) => b.text === 'Remove').onPress());
    expect(global.__nutrition.removeFoodFromMeal).toHaveBeenCalledWith('lunch', 'old-1', '2026-10-08');
  });
});

describe('fiber, sugar and sodium', () => {
  it('are listed for the serving shown, and follow the serving count', async () => {
    const utils = open({ food: apple({ fiber: 2.4, sugar: 10, sodium: 1 }) });
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    expect(utils.getByText('More nutrients')).toBeTruthy();
    expect(utils.getByText('2.4 g')).toBeTruthy();
    expect(utils.getByText('10 g')).toBeTruthy();
    expect(utils.getByText('1 mg')).toBeTruthy();
    fireEvent.press(utils.getByTestId('food-plus')); // 1.5x
    expect(utils.getByText('3.6 g')).toBeTruthy();
    expect(utils.getByText('15 g')).toBeTruthy();
    expect(utils.getByText('1.5 mg')).toBeTruthy();
  });

  it('only list the ones the food has', async () => {
    const utils = open({ food: apple({ fiber: 2.4 }) });
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    expect(utils.getByTestId('food-fiber')).toBeTruthy();
    expect(utils.queryByTestId('food-sugar')).toBeNull();
    expect(utils.queryByTestId('food-sodium')).toBeNull();
  });

  it('show a real 0 but nothing at all when the food lists none', async () => {
    const withZero = open({ food: apple({ sugar: 0 }) });
    await waitFor(() => expect(withZero.getByText('Apple')).toBeTruthy());
    expect(withZero.getByTestId('food-sugar')).toBeTruthy();
    withZero.unmount();
    const none = open({ food: apple() });
    await waitFor(() => expect(none.getByText('Apple')).toBeTruthy());
    expect(none.queryByText('More nutrients')).toBeNull();
  });

  it('are listed for a food already in the diary, as eaten', async () => {
    const entry = apple({
      logId: 'a1-xyz', quantity: 2, calories: 104, fiber: 4.8,
      base: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, servingSize: '100g' },
    });
    const utils = open({
      params: { id: 'a1-xyz' },
      nutrition: { findLoggedFood: jest.fn(() => ({ meal: { id: 'lunch', date: '2026-10-08' }, food: entry })) },
    });
    await waitFor(() => expect(utils.getByText('Apple')).toBeTruthy());
    expect(utils.getByTestId('food-fiber')).toBeTruthy();
    expect(utils.getByText('4.8 g')).toBeTruthy();
  });
});

describe('a custom food', () => {
  const shake = { id: 'custom-1', name: 'Protein shake', servingSize: '1 scoop', calories: 120, protein: 24, carbs: 3, fat: 1, custom: true };

  it('opens from My Foods without asking the food database', async () => {
    const utils = open({ params: { id: 'custom-1' }, nutrition: { customFoods: [shake] } });
    await waitFor(() => expect(utils.getByText('Protein shake')).toBeTruthy());
    expect(global.__getFoodById).not.toHaveBeenCalled();
    expect(utils.getByTestId('food-calories').props.children).toBe(120);
  });

  it('can be logged with a serving count', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(EVENING);
    const utils = open({ params: { id: 'custom-1', mealId: 'snack' }, nutrition: { customFoods: [shake] } });
    await waitFor(() => expect(utils.getByText('Protein shake')).toBeTruthy());
    fireEvent.press(utils.getByTestId('food-plus')); // 1.5x
    fireEvent.press(utils.getByText('Add to Log'));
    const [date, mealId, logged] = global.__nutrition.addFoodToMeal.mock.calls[0];
    expect([date, mealId]).toEqual(['2026-10-08', 'snack']);
    expect(logged).toMatchObject({ name: 'Protein shake', calories: 180, quantity: 1.5, custom: true });
    expect(logged.base.calories).toBe(120);
  });

  it('says so when it was deleted and is not in the food database either', async () => {
    const utils = open({ params: { id: 'custom-1' }, food: null });
    await waitFor(() => expect(utils.getByTestId('food-load-failed')).toBeTruthy());
  });
});

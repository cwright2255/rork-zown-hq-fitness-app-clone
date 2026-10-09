import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params,
  router: {
    back: (...a) => global.__router.back(...a),
    push: (...a) => global.__router.push(...a),
  },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View) };
});
jest.mock('@/store/nutritionStore', () => ({ useNutritionStore: () => global.__nutrition }));
jest.mock('@/store/recipeStore', () => ({ useRecipeStore: () => global.__recipes }));
jest.mock('@/components/GroceryListButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View, { testID: 'grocery-button' }) };
});
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));

import RecipeDetailScreen from '../app/recipe/[id]';

const recipe = (extra = {}) => ({
  id: 'r5', name: 'Turkey Chili', prepTime: 30, servings: 4,
  ingredients: [{ name: 'turkey', amount: 1, unit: 'lb' }], instructions: ['Cook it.'],
  calories: 420, protein: 38, carbs: 30, fat: 12, hasNutritionEstimate: true, ...extra,
});

const open = (r = recipe(), groceryList = []) => {
  global.__params = { id: r.id };
  global.__router = { back: jest.fn(), push: jest.fn() };
  global.__nutrition = { addFoodToMeal: jest.fn() };
  global.__recipes = { savedRecipes: [r], loadRecipes: jest.fn(), groceryList, addToGroceryList: jest.fn() };
  return render(<RecipeDetailScreen />);
};

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });
beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('recipe header', () => {
  it('separates the time and servings with a middle dot, not junk characters', () => {
    const utils = open();
    expect(utils.getByText('30 min · Serves 4')).toBeTruthy();
    expect(utils.queryByText(/Ã/)).toBeNull();
  });
});

describe('Log This Meal', () => {
  it('logs to one of the four meal slots, so the diary can show it', () => {
    jest.setSystemTime(new Date('2026-10-08T23:30:00Z')); // 7:30 PM in New Jersey
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByText('Log This Meal'));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(1);
    const [date, slot, food] = global.__nutrition.addFoodToMeal.mock.calls[0];
    expect(slot).toBe('dinner');
    expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(slot);
    expect(date).toBe('2026-10-08');
    expect(food.name).toBe('Turkey Chili');
    expect(food.calories).toBe(420);
    expect(food.servingSize).toBe('1 serving');
  });

  it('logs to the day it is where the person is, even after the UTC date has turned over', () => {
    jest.setSystemTime(new Date('2026-10-09T01:30:00Z')); // 9:30 PM on Oct 8 in New Jersey
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByText('Log This Meal'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][0]).toBe('2026-10-08');
  });

  it('starts on the meal that fits the time of day', () => {
    jest.setSystemTime(new Date('2026-10-08T11:00:00Z')); // 7 AM in New Jersey
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByText('Log This Meal'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][1]).toBe('breakfast');
  });

  it('logs to the meal the person picks', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-slot-snack'));
    fireEvent.press(utils.getByText('Log This Meal'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][1]).toBe('snack');
  });

  it('confirms with the view-diary choice', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByText('Log This Meal'));
    expect(alert.mock.calls[0][0]).toBe('Logged');
    act(() => alert.mock.calls[0][2].find((b) => b.text === 'View').onPress());
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition');
  });

  describe('a recipe with no nutrition estimate', () => {
    const bare = () => recipe({ calories: null, protein: null, carbs: null, fat: null, hasNutritionEstimate: false });

    it('asks first instead of saying "Logged" for 0 kcal', () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const utils = open(bare());
      fireEvent.press(utils.getByText('Log This Meal'));
      expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert.mock.calls[0][0]).toBe('No nutrition estimate');
    });

    it('logs it when the person says to log it anyway', () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const utils = open(bare());
      fireEvent.press(utils.getByText('Log This Meal'));
      act(() => alert.mock.calls[0][2].find((b) => b.text === 'Log anyway').onPress());
      expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(1);
      expect(global.__nutrition.addFoodToMeal.mock.calls[0][2].calories).toBe(0);
    });

    it('logs nothing when cancelled', () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const utils = open(bare());
      fireEvent.press(utils.getByText('Log This Meal'));
      expect(alert.mock.calls[0][2].find((b) => b.text === 'Cancel').onPress).toBeUndefined();
      expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    });
  });
});

describe('grocery list', () => {
  it('adds the recipe\'s ingredients to the grocery list', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-add-grocery'));
    expect(global.__recipes.addToGroceryList).toHaveBeenCalledWith('r5');
  });

  it('says so, and offers nothing to add, once the recipe is on the list', () => {
    const utils = open(recipe(), [{ id: 'g1', ingredient: 'turkey', recipeIds: ['r5'], checked: false }]);
    expect(utils.getByText('On your grocery list')).toBeTruthy();
    expect(utils.queryByTestId('recipe-add-grocery')).toBeNull();
  });

  it('is still offered when only a different recipe is on the list', () => {
    const utils = open(recipe(), [{ id: 'g1', ingredient: 'turkey', recipeIds: ['r9'], checked: false }]);
    expect(utils.getByTestId('recipe-add-grocery')).toBeTruthy();
  });
});

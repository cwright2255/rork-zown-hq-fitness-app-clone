import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

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
jest.mock('@/store/mealPlanStore', () => ({ useMealPlanStore: { getState: () => global.__plan } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 5, left: 0, right: 0 }),
}), { virtual: true });
jest.mock('@/components/GroceryListButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View, { testID: 'grocery-button' }) };
});
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/components/CookingMode', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__cooking = props;
      return mockReact.createElement(mockRn.View, { testID: 'cooking-mode' });
    },
  };
});

import RecipeDetailScreen from '../app/recipe/[id]';

const recipe = (extra = {}) => ({
  id: 'r5', name: 'Turkey Chili', prepTime: 30, servings: 4,
  ingredients: [{ name: 'turkey', amount: 1, unit: 'lb' }], instructions: ['Cook it.'],
  calories: 420, protein: 38, carbs: 30, fat: 12, hasNutritionEstimate: true, ...extra,
});

const open = (r = recipe(), groceryList = [], user = { uid: 'u1' }) => {
  global.__params = { id: r.id };
  global.__router = { back: jest.fn(), push: jest.fn() };
  global.__nutrition = { addFoodToMeal: jest.fn() };
  global.__user = user;
  global.__plan = { addRecipe: jest.fn(() => ({ ok: true })), startSync: jest.fn() };
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
    expect(global.__recipes.addToGroceryList).toHaveBeenCalledWith('r5', 1);
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

describe('servings', () => {
  const press = (utils, id) => fireEvent.press(utils.getByTestId(id));
  const value = (utils) => utils.getByTestId('recipe-servings-value').props.children;
  const callOnPress = (utils, id) => act(() => {
    utils.UNSAFE_getAllByProps({ testID: id }).find((n) => typeof n.props.onPress === 'function').props.onPress();
  });

  it('starts at the recipe\'s own servings and amounts', () => {
    const utils = open();
    expect(value(utils)).toBe(4);
    expect(utils.getByText('1 lb turkey')).toBeTruthy();
    expect(utils.getByText('30 min \u00B7 Serves 4')).toBeTruthy();
    expect(utils.queryByTestId('recipe-servings-reset')).toBeNull();
  });

  it('works out the ingredients for more servings', () => {
    const utils = open();
    press(utils, 'recipe-servings-plus');
    expect(value(utils)).toBe(5);
    expect(utils.getByText('1 1/4 lb turkey')).toBeTruthy();
    expect(utils.getByText('30 min \u00B7 Serves 5')).toBeTruthy();
    expect(utils.queryByText('1 lb turkey')).toBeNull();
  });

  it('works them out for fewer', () => {
    const utils = open();
    press(utils, 'recipe-servings-minus');
    press(utils, 'recipe-servings-minus');
    expect(value(utils)).toBe(2);
    expect(utils.getByText('1/2 lb turkey')).toBeTruthy();
  });

  it('offers to go back to the recipe\'s servings, and only when it has changed', () => {
    const utils = open();
    press(utils, 'recipe-servings-plus');
    expect(utils.getByText('Reset to 4')).toBeTruthy();
    press(utils, 'recipe-servings-reset');
    expect(value(utils)).toBe(4);
    expect(utils.getByText('1 lb turkey')).toBeTruthy();
    expect(utils.queryByTestId('recipe-servings-reset')).toBeNull();
    press(utils, 'recipe-servings-minus');
    expect(utils.getByTestId('recipe-servings-reset')).toBeTruthy();
    press(utils, 'recipe-servings-plus');
    expect(utils.queryByTestId('recipe-servings-reset')).toBeNull();
  });

  it('stops at 1 serving', () => {
    const utils = open(recipe({ servings: 1 }));
    expect(utils.getByTestId('recipe-servings-minus').props.accessibilityState).toEqual({ disabled: true });
    expect(utils.getByTestId('recipe-servings-plus').props.accessibilityState).toEqual({ disabled: false });
    callOnPress(utils, 'recipe-servings-minus');
    expect(value(utils)).toBe(1);
  });

  it('stops at 99 servings', () => {
    const utils = open(recipe({ servings: 99 }));
    expect(utils.getByTestId('recipe-servings-plus').props.accessibilityState).toEqual({ disabled: true });
    expect(utils.getByTestId('recipe-servings-minus').props.accessibilityState).toEqual({ disabled: false });
    callOnPress(utils, 'recipe-servings-plus');
    expect(value(utils)).toBe(99);
    press(utils, 'recipe-servings-minus');
    expect(value(utils)).toBe(98);
  });

  it('can still go down from 2 servings and up from 98', () => {
    const two = open(recipe({ servings: 2 }));
    expect(two.getByTestId('recipe-servings-minus').props.accessibilityState).toEqual({ disabled: false });
    press(two, 'recipe-servings-minus');
    expect(value(two)).toBe(1);
    const almost = open(recipe({ servings: 98 }));
    expect(almost.getByTestId('recipe-servings-plus').props.accessibilityState).toEqual({ disabled: false });
    press(almost, 'recipe-servings-plus');
    expect(value(almost)).toBe(99);
  });

  it('reads servings saved as text', () => {
    const utils = open(recipe({ servings: '4 servings' }));
    expect(value(utils)).toBe(4);
    press(utils, 'recipe-servings-plus');
    expect(utils.getByText('1 1/4 lb turkey')).toBeTruthy();
  });

  it('scales ingredients saved as plain text, and leaves the ones with no amount', () => {
    const utils = open(recipe({ servings: 4, ingredients: ['2 cups flour', 'salt, to taste'] }));
    press(utils, 'recipe-servings-plus');
    expect(utils.getByText('2 1/2 cups flour')).toBeTruthy();
    expect(utils.getByText('salt, to taste')).toBeTruthy();
  });

  it('has no stepper for a recipe that does not say how many it serves', () => {
    const utils = open(recipe({ servings: undefined }));
    expect(utils.queryByTestId('recipe-servings-value')).toBeNull();
    expect(utils.queryByTestId('recipe-servings-plus')).toBeNull();
    expect(utils.getByText('1 lb turkey')).toBeTruthy();
    fireEvent.press(utils.getByTestId('recipe-add-grocery'));
    expect(global.__recipes.addToGroceryList).toHaveBeenCalledWith('r5', 1);
  });

  it('shows the servings as the recipe says them when it has no number to scale from', () => {
    const utils = open(recipe({ servings: 'a few' }));
    expect(utils.getByText('30 min \u00B7 Serves a few')).toBeTruthy();
    expect(utils.queryByTestId('recipe-servings-value')).toBeNull();
  });

  it('opens a recipe with no ingredient list', () => {
    const utils = open(recipe({ ingredients: undefined }));
    expect(utils.getByText('Ingredients')).toBeTruthy();
    expect(utils.queryByTestId('recipe-units-metric')).toBeNull();
  });

  it('adds the scaled amounts to the grocery list', () => {
    const utils = open();
    for (let i = 0; i < 4; i += 1) press(utils, 'recipe-servings-plus');
    expect(value(utils)).toBe(8);
    fireEvent.press(utils.getByTestId('recipe-add-grocery'));
    expect(global.__recipes.addToGroceryList).toHaveBeenCalledWith('r5', 2);
  });

  it('adds fewer amounts for fewer servings', () => {
    const utils = open();
    press(utils, 'recipe-servings-minus');
    press(utils, 'recipe-servings-minus');
    fireEvent.press(utils.getByTestId('recipe-add-grocery'));
    expect(global.__recipes.addToGroceryList).toHaveBeenCalledWith('r5', 0.5);
  });

  it('still logs one serving, with the nutrition for one serving', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    for (let i = 0; i < 4; i += 1) press(utils, 'recipe-servings-plus');
    expect(utils.getByText('420 kcal')).toBeTruthy();
    fireEvent.press(utils.getByText('Log This Meal'));
    const food = global.__nutrition.addFoodToMeal.mock.calls[0][2];
    expect(food.calories).toBe(420);
    expect(food.protein).toBe(38);
    expect(food.servingSize).toBe('1 serving');
  });

  it('says the nutrition is per serving, when there is nutrition', () => {
    const utils = open();
    expect(utils.getByText('Nutrition is per serving')).toBeTruthy();
    const bare = open(recipe({ calories: null, hasNutritionEstimate: false }));
    expect(bare.queryByTestId('recipe-per-serving')).toBeNull();
  });
});

describe('units', () => {
  const milk = (extra = {}) => recipe({ ingredients: [{ name: 'milk', amount: 1, unit: 'cup' }, { name: 'eggs', amount: 2 }], ...extra });
  const press = (utils, id) => fireEvent.press(utils.getByTestId(id));

  it('is not offered when no ingredient has a unit that can change', () => {
    const utils = open(recipe({ ingredients: ['2 eggs', 'salt, to taste', { name: 'garlic', amount: 2, unit: 'cloves' }] }));
    expect(utils.queryByTestId('recipe-units-original')).toBeNull();
    expect(utils.queryByTestId('recipe-units-metric')).toBeNull();
  });

  it('is offered as As written, US and Metric, starting on As written', () => {
    const utils = open(milk());
    ['original', 'us', 'metric'].forEach((id) => expect(utils.getByTestId(`recipe-units-${id}`)).toBeTruthy());
    expect(utils.getByText('As written')).toBeTruthy();
    expect(utils.getByText('US')).toBeTruthy();
    expect(utils.getByText('Metric')).toBeTruthy();
    expect(utils.getByTestId('recipe-units-original').props.accessibilityState).toEqual({ selected: true });
    expect(utils.getByTestId('recipe-units-metric').props.accessibilityState).toEqual({ selected: false });
    expect(utils.getByText('1 cup milk')).toBeTruthy();
  });

  it('shows the recipe in metric, and back as written', () => {
    const utils = open(milk());
    press(utils, 'recipe-units-metric');
    expect(utils.getByText('240 ml milk')).toBeTruthy();
    expect(utils.getByText('2 eggs')).toBeTruthy();
    expect(utils.getByTestId('recipe-units-metric').props.accessibilityState).toEqual({ selected: true });
    expect(utils.getByTestId('recipe-units-original').props.accessibilityState).toEqual({ selected: false });
    press(utils, 'recipe-units-original');
    expect(utils.getByText('1 cup milk')).toBeTruthy();
    press(utils, 'recipe-units-us');
    expect(utils.getByText('1 cup milk')).toBeTruthy();
    expect(utils.getByTestId('recipe-units-us').props.accessibilityState).toEqual({ selected: true });
  });

  it('shows a metric recipe in US units', () => {
    const utils = open(milk({ ingredients: [{ name: 'milk', amount: 500, unit: 'ml' }] }));
    press(utils, 'recipe-units-us');
    expect(utils.getByText('2 cups milk')).toBeTruthy();
  });

  it('works together with the servings', () => {
    const utils = open(milk());
    for (let i = 0; i < 4; i += 1) press(utils, 'recipe-servings-plus');
    press(utils, 'recipe-units-metric');
    expect(utils.getByText('480 ml milk')).toBeTruthy();
    expect(utils.getByText('4 eggs')).toBeTruthy();
  });

  it('does not change what goes on the grocery list', () => {
    const utils = open(milk());
    press(utils, 'recipe-units-metric');
    fireEvent.press(utils.getByTestId('recipe-add-grocery'));
    expect(global.__recipes.addToGroceryList).toHaveBeenCalledWith('r5', 1);
  });
});

describe('cooking mode', () => {
  const press = (utils, id) => fireEvent.press(utils.getByTestId(id));

  beforeEach(() => { global.__cooking = null; });

  it('is offered when the recipe has steps, and is not open until asked for', () => {
    const utils = open();
    expect(utils.getByText('Start Cooking')).toBeTruthy();
    expect(utils.queryByTestId('cooking-mode')).toBeNull();
  });

  it('opens with the recipe\'s title, steps and ingredients, and closes again', () => {
    const utils = open(recipe({ instructions: ['Brown the turkey.', 'Simmer for 10 minutes.'] }));
    press(utils, 'recipe-start-cooking');
    expect(utils.getByTestId('cooking-mode')).toBeTruthy();
    expect(global.__cooking.title).toBe('Turkey Chili');
    expect(global.__cooking.steps).toEqual(['Brown the turkey.', 'Simmer for 10 minutes.']);
    expect(global.__cooking.ingredients).toEqual(['1 lb turkey']);
    act(() => global.__cooking.onClose());
    expect(utils.queryByTestId('cooking-mode')).toBeNull();
    press(utils, 'recipe-start-cooking');
    expect(utils.getByTestId('cooking-mode')).toBeTruthy();
  });

  it('takes the step numbers off the steps', () => {
    const utils = open(recipe({ instructions: ['1. Brown the turkey.', 'Step 2: Simmer.'] }));
    press(utils, 'recipe-start-cooking');
    expect(global.__cooking.steps).toEqual(['Brown the turkey.', 'Simmer.']);
  });

  it('shows the ingredients for the servings and units chosen', () => {
    const utils = open(recipe({ ingredients: [{ name: 'milk', amount: 1, unit: 'cup' }, 'salt'] }));
    for (let i = 0; i < 4; i += 1) press(utils, 'recipe-servings-plus');
    press(utils, 'recipe-units-metric');
    press(utils, 'recipe-start-cooking');
    expect(global.__cooking.ingredients).toEqual(['480 ml milk', 'salt']);
  });

  it('is not offered when there are no steps', () => {
    const utils = open(recipe({ instructions: [] }));
    expect(utils.queryByTestId('recipe-start-cooking')).toBeNull();
    const blank = open(recipe({ instructions: ['', '  '] }));
    expect(blank.queryByTestId('recipe-start-cooking')).toBeNull();
  });
});

describe('a recipe with no instructions', () => {
  it.each([
    ['missing', undefined],
    ['empty', null],
    ['an empty list', []],
    ['only blank lines', ['', '  ']],
    ['text that is not a list or a string', 42],
  ])('opens, and says so, when they are %s', (_name, instructions) => {
    const utils = open(recipe({ instructions }));
    expect(utils.getByText('Turkey Chili')).toBeTruthy();
    expect(utils.getByText('Instructions')).toBeTruthy();
    expect(utils.getByTestId('recipe-no-steps')).toBeTruthy();
    expect(utils.getByText('No instructions saved for this recipe.')).toBeTruthy();
    expect(utils.queryByTestId('recipe-start-cooking')).toBeNull();
  });

  it('does not say so when there are steps', () => {
    const utils = open();
    expect(utils.queryByTestId('recipe-no-steps')).toBeNull();
    expect(utils.getByText('Cook it.')).toBeTruthy();
  });

  it('shows the steps of a recipe saved as one block of text, one per line', () => {
    const utils = open(recipe({ instructions: 'Brown the turkey.\nSimmer for 10 minutes.' }));
    expect(utils.getByText('Brown the turkey.')).toBeTruthy();
    expect(utils.getByText('Simmer for 10 minutes.')).toBeTruthy();
    expect(utils.queryByTestId('recipe-no-steps')).toBeNull();
  });

  it('numbers each step by its place, without the number the import left in the text', () => {
    const utils = open(recipe({ instructions: ['1. Brown the turkey.', 'Step 2: Simmer.'] }));
    expect(utils.getByText('Brown the turkey.')).toBeTruthy();
    expect(utils.getByText('Simmer.')).toBeTruthy();
    expect(utils.queryByText('1. Brown the turkey.')).toBeNull();
    expect(utils.getByText('1')).toBeTruthy();
    expect(utils.getByText('2')).toBeTruthy();
  });
});

describe('Add to Meal Plan', () => {
  const NOON = new Date('2026-10-09T16:00:00Z'); // noon on Fri Oct 9 in New Jersey
  const selected = (utils, id) => utils.getByTestId(id).props.accessibilityState.selected;

  it('opens the day and meal picker, starting on the meal for the time of day', () => {
    jest.setSystemTime(NOON);
    const utils = open();
    expect(utils.queryByTestId('plan-target-sheet')).toBeNull();
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    expect(utils.getByText('Add Turkey Chili to your plan')).toBeTruthy();
    expect(selected(utils, 'plan-target-day-2026-10-09')).toBe(true);
    expect(selected(utils, 'plan-target-slot-lunch')).toBe(true);
  });

  it('starts on the meal picked at the bottom of the screen', () => {
    jest.setSystemTime(NOON);
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-slot-snack'));
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    expect(selected(utils, 'plan-target-slot-snack')).toBe(true);
    expect(selected(utils, 'plan-target-slot-lunch')).toBe(false);
  });

  it('puts the recipe on the plan for the day and meal picked, and does not log it', () => {
    jest.setSystemTime(NOON);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-10'));
    fireEvent.press(utils.getByTestId('plan-target-slot-dinner'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(global.__plan.addRecipe).toHaveBeenCalledTimes(1);
    const [added, where] = global.__plan.addRecipe.mock.calls[0];
    expect(added).toMatchObject({ id: 'r5', title: 'Turkey Chili', calories: 420, protein: 38 });
    expect(where).toEqual({ date: '2026-10-10', slot: 'dinner' });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(utils.queryByTestId('plan-target-sheet')).toBeNull();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Added to your plan');
    expect(alert.mock.calls[0][1]).toBe('Turkey Chili is on your plan for Dinner \u00B7 Sat, Oct 10.');
  });

  it('starts saving the plan to the cloud, as the signed-in user, once something is added', () => {
    jest.setSystemTime(NOON);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    expect(global.__plan.startSync).not.toHaveBeenCalled();
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(global.__plan.startSync).toHaveBeenCalledTimes(1);
    expect(global.__plan.startSync).toHaveBeenCalledWith('u1');
  });

  it('still adds the recipe, and starts no cloud saving, when nobody is signed in', () => {
    jest.setSystemTime(NOON);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open(recipe(), [], null);
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(global.__plan.addRecipe).toHaveBeenCalledTimes(1);
    expect(global.__plan.startSync).not.toHaveBeenCalled();
  });

  it('labels the picker\'s button Add', () => {
    jest.setSystemTime(NOON);
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    expect(within(utils.getByTestId('plan-target-confirm')).getByText('Add')).toBeTruthy();
  });

  it('says Today for today', () => {
    jest.setSystemTime(NOON);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(alert.mock.calls[0][1]).toBe('Turkey Chili is on your plan for Lunch \u00B7 Today.');
  });

  it('offers to show the plan on that day', () => {
    jest.setSystemTime(NOON);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-12'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(alert.mock.calls[0][2].map((b) => b.text)).toEqual(['View plan', 'OK']);
    act(() => alert.mock.calls[0][2].find((b) => b.text === 'View plan').onPress());
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/plan', params: { date: '2026-10-12' } });
  });

  it('plans a recipe that has a name but no title', () => {
    jest.setSystemTime(NOON);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open(recipe({ title: undefined, image: undefined, imageUrl: 'https://img/chili.jpg' }));
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    expect(utils.getByText('Add Turkey Chili to your plan')).toBeTruthy();
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(global.__plan.addRecipe.mock.calls[0][0]).toMatchObject({ title: 'Turkey Chili', image: 'https://img/chili.jpg' });
  });

  it('says why, and keeps the picker open, when it cannot be added', () => {
    jest.setSystemTime(NOON);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    global.__plan.addRecipe.mockReturnValue({ ok: false, error: 'Lunch already has 10 items on that day.' });
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Could not add', 'Lunch already has 10 items on that day.');
    expect(utils.getByTestId('plan-target-sheet')).toBeTruthy();
    expect(global.__plan.startSync).not.toHaveBeenCalled();
  });

  it('adds nothing when cancelled', () => {
    jest.setSystemTime(NOON);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open();
    fireEvent.press(utils.getByTestId('recipe-add-plan'));
    fireEvent.press(utils.getByTestId('plan-target-cancel'));
    expect(utils.queryByTestId('plan-target-sheet')).toBeNull();
    expect(global.__plan.addRecipe).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });
});

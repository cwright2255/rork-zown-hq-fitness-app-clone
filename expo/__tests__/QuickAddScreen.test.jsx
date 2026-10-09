import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params,
  router: {
    back: (...a) => global.__router.back(...a),
    replace: (...a) => global.__router.replace(...a),
    dismiss: (...a) => global.__router.dismiss(...a),
  },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress }) =>
      mockReact.createElement(mockRn.TouchableOpacity, { onPress },
        mockReact.createElement(mockRn.Text, null, title)),
  };
});
jest.mock('@/store/nutritionStore', () => ({ useNutritionStore: () => global.__nutrition }));

import QuickAddScreen from '../app/nutrition/quick-add';

const open = (params = {}) => {
  global.__params = params;
  global.__router = { back: jest.fn(), replace: jest.fn(), dismiss: jest.fn() };
  global.__nutrition = { addFoodToMeal: jest.fn() };
  return render(<QuickAddScreen />);
};
const type = (utils, id, text) => fireEvent.changeText(utils.getByTestId(id), text);

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });
beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); });

describe('quick add', () => {
  it('logs the calories to the chosen meal on the local day and returns to the diary', () => {
    jest.setSystemTime(new Date('2026-10-09T01:30:00Z')); // 9:30 PM on Oct 8 in New Jersey
    const utils = open({ mealId: 'lunch' });
    type(utils, 'qa-calories', '650');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(1);
    const [date, slot, food] = global.__nutrition.addFoodToMeal.mock.calls[0];
    expect(date).toBe('2026-10-08');
    expect(slot).toBe('lunch');
    expect(food).toMatchObject({ id: 'quick-add', name: 'Quick add', calories: 650, protein: 0, carbs: 0, fat: 0, quickAdd: true });
    expect(global.__router.dismiss).toHaveBeenCalledWith(2);
  });

  it('takes optional macros and a name', () => {
    const utils = open({ mealId: 'dinner' });
    type(utils, 'qa-calories', '800');
    type(utils, 'qa-label', 'Burger and fries');
    type(utils, 'qa-protein', '35');
    type(utils, 'qa-carbs', '90');
    type(utils, 'qa-fat', '40');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][2]).toMatchObject({ name: 'Burger and fries', calories: 800, protein: 35, carbs: 90, fat: 40 });
  });

  it('lets the meal be changed', () => {
    const utils = open({ mealId: 'lunch' });
    fireEvent.press(utils.getByTestId('qa-slot-snack'));
    type(utils, 'qa-calories', '100');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][1]).toBe('snack');
  });

  it('starts on the meal that fits the time of day when none was chosen', () => {
    jest.setSystemTime(new Date(2026, 9, 8, 8, 0)); // 8 AM local
    const utils = open();
    type(utils, 'qa-calories', '100');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][1]).toBe('breakfast');
  });

  it('ignores a meal id that is not one of the four slots', () => {
    jest.setSystemTime(new Date(2026, 9, 8, 19, 0)); // 7 PM local
    const utils = open({ mealId: 'brunch' });
    type(utils, 'qa-calories', '100');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][1]).toBe('dinner');
  });

  it('shows what is wrong and logs nothing', () => {
    const utils = open({ mealId: 'lunch' });
    fireEvent.press(utils.getByText('Add to Log'));
    expect(utils.getByTestId('qa-calories-error').props.children).toBe('Required');
    type(utils, 'qa-calories', '0');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(utils.getByTestId('qa-calories-error').props.children).toBe('Enter at least 1 calorie');
    type(utils, 'qa-calories', '200');
    expect(utils.queryByTestId('qa-calories-error')).toBeNull();
    type(utils, 'qa-fat', 'x');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(utils.getByTestId('qa-fat-error').props.children).toBe('Enter a number');
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.dismiss).not.toHaveBeenCalled();
  });
});

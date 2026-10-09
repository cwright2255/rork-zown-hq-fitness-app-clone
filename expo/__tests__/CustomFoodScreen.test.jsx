import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { buildCustomFood } from '../lib/customFood';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params,
  router: {
    back: (...a) => global.__router.back(...a),
    replace: (...a) => global.__router.replace(...a),
    push: (...a) => global.__router.push(...a),
    dismiss: (...a) => global.__router.dismiss(...a),
    canGoBack: () => global.__router.canGoBack(),
  },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title }) => mockReact.createElement(mockRn.Text, null, title),
  };
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

import CustomFoodScreen from '../app/nutrition/custom-food';

const shake = { id: 'custom-1', name: 'Protein shake', servingSize: '1 scoop', calories: 120, protein: 24, carbs: 3, fat: 1, fiber: 2, custom: true };

const open = ({ params = {}, customFoods = [] } = {}) => {
  global.__params = params;
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismiss: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__nutrition = {
    customFoods,
    addCustomFood: jest.fn((fields) => buildCustomFood(fields, { id: 'custom-new' })),
    updateCustomFood: jest.fn((id, fields) => buildCustomFood(fields, { id })),
    removeCustomFood: jest.fn(),
    addFoodToMeal: jest.fn(),
  };
  return render(<CustomFoodScreen />);
};

const type = (utils, id, text) => fireEvent.changeText(utils.getByTestId(id), text);
const fill = (utils, values) => Object.entries(values).forEach(([k, v]) => type(utils, `cf-${k}`, v));

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });
beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('creating a food', () => {
  it('starts empty, with a plain Save button when no meal was chosen', () => {
    const utils = open();
    expect(utils.getByText('Create Food')).toBeTruthy();
    expect(utils.getByTestId('cf-name').props.value).toBe('');
    expect(utils.getByText('Save Food')).toBeTruthy();
    expect(utils.queryByTestId('cf-save-only')).toBeNull();
  });

  it('starts with the name that was typed in the search box', () => {
    const utils = open({ params: { name: 'homemade chili' } });
    expect(utils.getByTestId('cf-name').props.value).toBe('homemade chili');
  });

  it('saves the food and goes back', () => {
    const utils = open();
    fill(utils, { name: 'Protein shake', serving: '1 scoop', calories: '120', protein: '24', carbs: '3', fat: '1', sodium: '150' });
    fireEvent.press(utils.getByText('Save Food'));
    expect(global.__nutrition.addCustomFood).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Protein shake', servingSize: '1 scoop', calories: '120', protein: '24', carbs: '3', fat: '1', sodium: '150',
    }));
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('shows what is wrong and saves nothing', () => {
    const utils = open();
    type(utils, 'cf-protein', 'lots');
    fireEvent.press(utils.getByText('Save Food'));
    expect(utils.getByTestId('cf-name-error').props.children).toBe('Enter a name');
    expect(utils.getByTestId('cf-calories-error').props.children).toBe('Required');
    expect(utils.getByTestId('cf-protein-error').props.children).toBe('Enter a number');
    expect(global.__router.back).not.toHaveBeenCalled();
  });

  it('clears a field\'s error as soon as it is edited', () => {
    const utils = open();
    fireEvent.press(utils.getByText('Save Food'));
    expect(utils.queryByTestId('cf-name-error')).toBeTruthy();
    type(utils, 'cf-name', 'Bar');
    expect(utils.queryByTestId('cf-name-error')).toBeNull();
    expect(utils.queryByTestId('cf-calories-error')).toBeTruthy();
  });

  it('does not go back when the store refuses (too many foods)', () => {
    const utils = open();
    global.__nutrition.addCustomFood = jest.fn(() => ({ ok: false, errors: { name: 'You have 200 custom foods. Delete one to add another.' } }));
    fill(utils, { name: 'Bar', calories: '100' });
    fireEvent.press(utils.getByText('Save Food'));
    expect(utils.getByTestId('cf-name-error').props.children).toMatch(/200 custom foods/);
    expect(global.__router.back).not.toHaveBeenCalled();
  });
});

describe('creating a food while adding to a meal', () => {
  it('saves it and logs one serving to that meal on the local day, then returns to the diary', () => {
    jest.setSystemTime(new Date('2026-10-09T01:30:00Z')); // 9:30 PM on Oct 8 in New Jersey
    const utils = open({ params: { mealId: 'dinner' } });
    fill(utils, { name: 'Protein shake', calories: '120' });
    fireEvent.press(utils.getByText('Save & Add to Dinner'));
    expect(global.__nutrition.addCustomFood).toHaveBeenCalledTimes(1);
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledWith('2026-10-08', 'dinner', expect.objectContaining({ id: 'custom-new', name: 'Protein shake', calories: 120 }));
    expect(global.__router.dismiss).toHaveBeenCalledWith(2);
    expect(global.__router.back).not.toHaveBeenCalled();
  });

  it('logs nothing when the form is not valid', () => {
    const utils = open({ params: { mealId: 'dinner' } });
    fireEvent.press(utils.getByText('Save & Add to Dinner'));
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.dismiss).not.toHaveBeenCalled();
  });

  it('can save without logging', () => {
    const utils = open({ params: { mealId: 'dinner' } });
    fill(utils, { name: 'Protein shake', calories: '120' });
    fireEvent.press(utils.getByTestId('cf-save-only'));
    expect(global.__nutrition.addCustomFood).toHaveBeenCalledTimes(1);
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('ignores a meal id that is not one of the four slots', () => {
    const utils = open({ params: { mealId: 'brunch' } });
    expect(utils.getByText('Save Food')).toBeTruthy();
  });
});

describe('editing a food', () => {
  it('fills the form from the saved food', () => {
    const utils = open({ params: { editId: 'custom-1' }, customFoods: [shake] });
    expect(utils.getByText('Edit Food')).toBeTruthy();
    expect(utils.getByTestId('cf-name').props.value).toBe('Protein shake');
    expect(utils.getByTestId('cf-serving').props.value).toBe('1 scoop');
    expect(utils.getByTestId('cf-calories').props.value).toBe('120');
    expect(utils.getByTestId('cf-fiber').props.value).toBe('2');
    expect(utils.getByTestId('cf-sugar').props.value).toBe('');
  });

  it('saves the changes under the same id and goes back', () => {
    const utils = open({ params: { editId: 'custom-1' }, customFoods: [shake] });
    type(utils, 'cf-calories', '150');
    fireEvent.press(utils.getByText('Save Changes'));
    expect(global.__nutrition.updateCustomFood).toHaveBeenCalledWith('custom-1', expect.objectContaining({ calories: '150', name: 'Protein shake' }));
    expect(global.__nutrition.addCustomFood).not.toHaveBeenCalled();
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('asks before deleting, then deletes and goes back', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ params: { editId: 'custom-1' }, customFoods: [shake] });
    fireEvent.press(utils.getByTestId('cf-delete'));
    expect(global.__nutrition.removeCustomFood).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2];
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    buttons[1].onPress();
    expect(global.__nutrition.removeCustomFood).toHaveBeenCalledWith('custom-1');
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('says so when the food is gone', () => {
    const utils = open({ params: { editId: 'custom-9' }, customFoods: [shake] });
    expect(utils.getByTestId('cf-missing')).toBeTruthy();
    expect(utils.queryByText('Save Changes')).toBeNull();
  });
});

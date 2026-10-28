import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }), { virtual: true });
jest.mock('@/services/recipeExtractionService', () => ({
  __esModule: true,
  default: { getSpoonacularById: (...a) => global.__fetch(...a) },
}));

jest.mock('@/store/mealPlanStore', () => ({ useMealPlanStore: { getState: () => global.__plan } }));
jest.mock('@/components/PlanTargetSheet', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onConfirm, onClose }) => mockReact.createElement(
      mockRn.View, { testID: 'plan-sheet' },
      mockReact.createElement(mockRn.Text, null, title),
      mockReact.createElement(mockRn.Pressable, { testID: 'plan-sheet-confirm', onPress: () => onConfirm({ date: '2026-10-30', slot: 'dinner' }) }),
      mockReact.createElement(mockRn.Pressable, { testID: 'plan-sheet-close', onPress: onClose }),
    ),
  };
});

import RecipePreviewModal from '../components/RecipePreviewModal';

const recipe = (extra = {}) => ({
  name: 'Turkey Chili', cookTime: 30, servings: 4,
  ingredients: [{ id: 'i1', name: 'turkey', amount: 1, unit: 'lb' }, { id: 'i2', name: 'beans', amount: 0.5, unit: 'cup' }],
  instructions: ['Brown the turkey.', 'Simmer for 10 minutes.'],
  ...extra,
});

async function show(r, extra = {}) {
  global.__fetch = jest.fn(async () => r);
  const props = { visible: true, recipeId: 'r1', onClose: jest.fn(), onSaved: jest.fn(), addRecipe: jest.fn(async () => undefined), uid: 'u1', ...extra };
  const utils = render(<RecipePreviewModal {...props} />);
  await act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
  return { utils, props };
}

beforeEach(() => {
  global.__plan = { addRecipe: jest.fn(() => ({ ok: true })), startSync: jest.fn() };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('RecipePreviewModal', () => {
  it('lists the ingredients and the steps in order', async () => {
    const { utils } = await show(recipe());
    expect(utils.getByText('• 1 lb turkey')).toBeTruthy();
    expect(utils.getByText('• 1/2 cup beans')).toBeTruthy();
    expect(utils.getByText('Brown the turkey.')).toBeTruthy();
    expect(utils.getByText('Simmer for 10 minutes.')).toBeTruthy();
    expect(utils.queryByTestId('preview-no-steps')).toBeNull();
  });

  it('numbers the steps from 1', async () => {
    const { utils } = await show(recipe());
    expect(utils.getByText('1')).toBeTruthy();
    expect(utils.getByText('2')).toBeTruthy();
    expect(utils.queryByText('0')).toBeNull();
    expect(utils.queryByText('3')).toBeNull();
  });

  it('takes the step numbers an import left in the text off the steps', async () => {
    const { utils } = await show(recipe({ instructions: ['1. Brown the turkey.', 'Step 2: Simmer.'] }));
    expect(utils.getByText('Brown the turkey.')).toBeTruthy();
    expect(utils.getByText('Simmer.')).toBeTruthy();
    expect(utils.queryByText('1. Brown the turkey.')).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['empty', null],
    ['an empty list', []],
    ['not a list', 42],
  ])('opens, and says so, when the steps are %s', async (_n, instructions) => {
    const { utils } = await show(recipe({ instructions }));
    expect(utils.getByText('Turkey Chili')).toBeTruthy();
    expect(utils.getByTestId('preview-no-steps')).toBeTruthy();
    expect(utils.getByText('Save Recipe')).toBeTruthy();
  });

  it.each([
    ['missing', undefined],
    ['empty', null],
    ['one block of text', '1 lb turkey, 1/2 cup beans'],
  ])('opens when the ingredients are %s', async (_n, ingredients) => {
    const { utils } = await show(recipe({ ingredients }));
    expect(utils.getByText('Ingredients')).toBeTruthy();
    expect(utils.getByText('Brown the turkey.')).toBeTruthy();
  });

  it('still lists an ingredient that has no id, without a warning about missing keys', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { utils } = await show(recipe({ ingredients: [{ name: 'salt' }, { name: 'pepper' }] }));
    expect(utils.getByText('• salt')).toBeTruthy();
    expect(utils.getByText('• pepper')).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('says the recipe could not be loaded when nothing comes back', async () => {
    const { utils } = await show(null);
    expect(utils.getByText('Could not load this recipe.')).toBeTruthy();
  });

  it('saves the recipe it was given, even one without steps', async () => {
    const r = recipe({ instructions: undefined });
    const { utils, props } = await show(r);
    await act(async () => { fireEvent.press(utils.getByText('Save Recipe')); });
    expect(props.addRecipe).toHaveBeenCalledWith(r, 'u1');
    expect(props.onSaved).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not say it saved when the store could not', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { utils, props } = await show(recipe(), { addRecipe: jest.fn(async () => null) });
    await act(async () => { fireEvent.press(utils.getByTestId('preview-save')); });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not save this recipe. Please try again.');
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  describe('nutrition', () => {
    it('shows calories, protein, carbs and fat per serving', async () => {
      const { utils } = await show(recipe({ nutrition: { calories: 584.4, protein: 32.4, carbs: 40.6, fat: 12 } }));
      expect(utils.getByTestId('preview-nutrition')).toBeTruthy();
      expect(utils.getByText('584')).toBeTruthy();
      expect(utils.getByText('32g')).toBeTruthy();
      expect(utils.getByText('41g')).toBeTruthy();
      expect(utils.getByText('12g')).toBeTruthy();
      expect(utils.getByText('Per serving')).toBeTruthy();
    });

    it('leaves out a figure the recipe does not have, and the whole block when there is none', async () => {
      const { utils } = await show(recipe({ nutrition: { calories: 500, protein: null, carbs: null, fat: null } }));
      expect(utils.getByText('500')).toBeTruthy();
      expect(utils.queryByText('Protein')).toBeNull();
      const none = await show(recipe({ nutrition: null }));
      expect(none.utils.queryByTestId('preview-nutrition')).toBeNull();
      expect(none.utils.queryByText('Per serving')).toBeNull();
    });
  });

  describe('adding to the meal plan', () => {
    const saved = { id: 'saved1', name: 'Turkey Chili', calories: 500 };

    it('saves the recipe first, then puts the saved copy on the chosen day and meal', async () => {
      const r = recipe();
      const addRecipe = jest.fn(async () => saved);
      const { utils, props } = await show(r, { addRecipe });
      await act(async () => { fireEvent.press(utils.getByTestId('preview-plan')); });
      expect(utils.getByText('Add Turkey Chili to your plan')).toBeTruthy();
      await act(async () => { fireEvent.press(utils.getByTestId('plan-sheet-confirm')); });
      expect(addRecipe).toHaveBeenCalledWith(r, 'u1');
      expect(global.__plan.addRecipe).toHaveBeenCalledWith(saved, { date: '2026-10-30', slot: 'dinner' });
      expect(global.__plan.startSync).toHaveBeenCalledWith('u1');
      expect(props.onSaved).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(Alert.alert.mock.calls[0][0]).toBe('Added to your plan');
      expect(Alert.alert.mock.calls[0][1]).toContain('Turkey Chili is on your plan for Dinner');
    });

    it('does not save a recipe that is already saved, and plans the saved copy', async () => {
      const findSaved = jest.fn(() => saved);
      const { utils, props } = await show(recipe(), { findSaved });
      expect(utils.getByText('Saved')).toBeTruthy();
      expect(utils.queryByText('Save Recipe')).toBeNull();
      await act(async () => { fireEvent.press(utils.getByTestId('preview-plan')); });
      await act(async () => { fireEvent.press(utils.getByTestId('plan-sheet-confirm')); });
      expect(props.addRecipe).not.toHaveBeenCalled();
      expect(global.__plan.addRecipe).toHaveBeenCalledWith(saved, { date: '2026-10-30', slot: 'dinner' });
      expect(props.onSaved).not.toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not save again when "Saved" is pressed', async () => {
      const { utils, props } = await show(recipe(), { findSaved: () => saved });
      await act(async () => { fireEvent.press(utils.getByTestId('preview-save')); });
      expect(props.addRecipe).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('says so and keeps the sheet open when the day or meal is full', async () => {
      global.__plan.addRecipe.mockReturnValue({ ok: false, error: 'Dinner already has 10 items on that day.' });
      const { utils, props } = await show(recipe(), { findSaved: () => saved });
      await act(async () => { fireEvent.press(utils.getByTestId('preview-plan')); });
      await act(async () => { fireEvent.press(utils.getByTestId('plan-sheet-confirm')); });
      expect(Alert.alert).toHaveBeenCalledWith('Could not add', 'Dinner already has 10 items on that day.');
      expect(props.onClose).not.toHaveBeenCalled();
      expect(utils.getByTestId('plan-sheet')).toBeTruthy();
    });

    it('does not plan a recipe that could not be saved', async () => {
      const { utils, props } = await show(recipe(), { addRecipe: jest.fn(async () => null) });
      await act(async () => { fireEvent.press(utils.getByTestId('preview-plan')); });
      await act(async () => { fireEvent.press(utils.getByTestId('plan-sheet-confirm')); });
      expect(global.__plan.addRecipe).not.toHaveBeenCalled();
      expect(Alert.alert.mock.calls[0][0]).toBe('Could not add');
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('offers "View plan" only when the screen can show it', async () => {
      const onViewPlan = jest.fn();
      const { utils } = await show(recipe(), { findSaved: () => saved, onViewPlan });
      await act(async () => { fireEvent.press(utils.getByTestId('preview-plan')); });
      await act(async () => { fireEvent.press(utils.getByTestId('plan-sheet-confirm')); });
      const buttons = Alert.alert.mock.calls[0][2];
      expect(buttons.map((b) => b.text)).toEqual(['View plan', 'OK']);
      buttons[0].onPress();
      expect(onViewPlan).toHaveBeenCalledWith('2026-10-30');
      const plain = await show(recipe(), { findSaved: () => saved });
      Alert.alert.mockClear();
      await act(async () => { fireEvent.press(plain.utils.getByTestId('preview-plan')); });
      await act(async () => { fireEvent.press(plain.utils.getByTestId('plan-sheet-confirm')); });
      expect(Alert.alert.mock.calls[0][2].map((b) => b.text)).toEqual(['OK']);
    });

    it('closes the sheet without adding anything when it is dismissed', async () => {
      const { utils } = await show(recipe());
      await act(async () => { fireEvent.press(utils.getByTestId('preview-plan')); });
      await act(async () => { fireEvent.press(utils.getByTestId('plan-sheet-close')); });
      expect(utils.queryByTestId('plan-sheet')).toBeNull();
      expect(global.__plan.addRecipe).not.toHaveBeenCalled();
    });

    it('opens the day and meal sheet by itself when it was opened from "Add to plan"', async () => {
      const { utils } = await show(recipe(), { planOnOpen: true });
      expect(utils.getByTestId('plan-sheet')).toBeTruthy();
      await act(async () => { fireEvent.press(utils.getByTestId('plan-sheet-close')); });
      expect(utils.queryByTestId('plan-sheet')).toBeNull(); // it does not come back by itself
    });

    it('does not ask for a day and meal when there is no recipe to plan', async () => {
      const { utils } = await show(null, { planOnOpen: true });
      expect(utils.queryByTestId('plan-sheet')).toBeNull();
    });
  });
});

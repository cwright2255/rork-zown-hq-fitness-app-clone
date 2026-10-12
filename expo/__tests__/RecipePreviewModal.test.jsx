import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }), { virtual: true });
jest.mock('@/services/recipeExtractionService', () => ({
  __esModule: true,
  default: { getSpoonacularById: (...a) => global.__fetch(...a) },
}));

import RecipePreviewModal from '../components/RecipePreviewModal';

const recipe = (extra = {}) => ({
  name: 'Turkey Chili', cookTime: 30, servings: 4,
  ingredients: [{ id: 'i1', name: 'turkey', amount: 1, unit: 'lb' }, { id: 'i2', name: 'beans', amount: 0.5, unit: 'cup' }],
  instructions: ['Brown the turkey.', 'Simmer for 10 minutes.'],
  ...extra,
});

async function show(r) {
  global.__fetch = jest.fn(async () => r);
  const props = { visible: true, recipeId: 'r1', onClose: jest.fn(), onSaved: jest.fn(), addRecipe: jest.fn(async () => undefined), uid: 'u1' };
  const utils = render(<RecipePreviewModal {...props} />);
  await act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
  return { utils, props };
}

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
});

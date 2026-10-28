// Whether a recipe on the Recipes tab is already saved (lib/recipeSaved.js), and that saving one from the tab remembers where it
// came from (store/recipeStore.js addRecipe).
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(async () => ({ id: 'cloud1' })), getDocs: jest.fn(), query: jest.fn(),
  orderBy: jest.fn(), limit: jest.fn(), doc: jest.fn(), deleteDoc: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { addDoc } from 'firebase/firestore';
import { useRecipeStore } from '../store/recipeStore';
import { findSavedMatch, isSavedRecipe } from '../lib/recipeSaved';

describe('findSavedMatch', () => {
  const saved = [
    { id: 'a', name: 'Garlic Pasta', sourceId: '716429' },
    { id: 'b', name: 'Old Chili' }, // saved before sourceId existed
    { id: 'c', title: 'Tacos' },
    { id: 'd', name: 'My Own Soup', sourceId: null },
  ];

  it('matches by the Spoonacular id', () => {
    expect(findSavedMatch(saved, { id: '716429', name: 'Something Else' }).id).toBe('a');
    expect(findSavedMatch(saved, { id: 716429, name: 'x' }).id).toBe('a');
  });

  it('does not match a recipe with an id by its name alone', () => {
    expect(findSavedMatch(saved, { id: '999', name: 'Garlic Pasta' })).toBeNull();
  });

  it('matches one saved before the id was kept by its name, ignoring case and spacing', () => {
    expect(findSavedMatch(saved, { id: '5', name: '  old   CHILI ' }).id).toBe('b');
    expect(findSavedMatch(saved, { id: '6', name: 'tacos' }).id).toBe('c');
    expect(findSavedMatch(saved, { id: '7', name: 'my own soup' }).id).toBe('d');
  });

  it('is not saved when nothing matches, and never throws on odd input', () => {
    expect(isSavedRecipe(saved, { id: '1', name: 'Nope' })).toBe(false);
    expect(isSavedRecipe([], { id: '1', name: 'Nope' })).toBe(false);
    expect(isSavedRecipe(null, { id: '1', name: 'Nope' })).toBe(false);
    expect(isSavedRecipe(saved, null)).toBe(false);
    expect(isSavedRecipe([null, undefined], { id: '', name: '' })).toBe(false);
    expect(isSavedRecipe(saved, { id: '', name: '' })).toBe(false);
  });
});

describe('addRecipe', () => {
  beforeEach(() => { useRecipeStore.setState({ savedRecipes: [], error: null }); addDoc.mockClear(); });

  it('keeps the Spoonacular id and gives back the saved recipe', async () => {
    const saved = await useRecipeStore.getState().addRecipe({ name: 'Pasta', ingredients: [], instructions: [], sourceId: '716429' }, 'u1');
    expect(saved).toMatchObject({ id: 'cloud1', name: 'Pasta', sourceId: '716429' });
    expect(useRecipeStore.getState().savedRecipes).toHaveLength(1);
    expect(addDoc.mock.calls[0][1]).toMatchObject({ sourceId: '716429' });
  });

  it('has no source id for a recipe that did not come from the tab', async () => {
    const saved = await useRecipeStore.getState().addRecipe({ name: 'Mine', ingredients: [], instructions: [] }, null);
    expect(saved.sourceId).toBeNull();
    expect(saved.id).toBeTruthy();
  });

  it('gives back null, and says so, when it could not save', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const out = await useRecipeStore.getState().addRecipe(null, 'u1');
    expect(out).toBeNull();
    expect(useRecipeStore.getState().error).toBe('Failed to add recipe');
    expect(useRecipeStore.getState().savedRecipes).toEqual([]);
    console.error.mockRestore();
  });
});

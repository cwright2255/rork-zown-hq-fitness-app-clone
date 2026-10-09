jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), getDocs: jest.fn(), query: jest.fn(),
  orderBy: jest.fn(), limit: jest.fn(), doc: jest.fn(), deleteDoc: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecipeStore } from '../store/recipeStore';

const store = () => useRecipeStore.getState();
const ing = (name, amount, unit) => ({ id: name, name, amount, unit });
const pancakes = { id: 'r1', name: 'Pancakes', ingredients: [ing('flour', 1, 'cups'), ing('milk', 1, 'cup'), ing('eggs', 2)] };
const bread = { id: 'r2', name: 'Bread', ingredients: [ing('flour', 3, 'cups'), ing('salt', null, undefined), ing('milk', 2, 'tbsp')] };

const names = () => store().groceryList.map((i) => [i.ingredient, i.amount, i.unit]);

beforeEach(() => {
  AsyncStorage.getItem.mockReset().mockResolvedValue(null);
  AsyncStorage.setItem.mockClear();
  useRecipeStore.setState({ savedRecipes: [pancakes, bread], groceryList: [], groceryLoaded: false });
});

describe('generateGroceryList', () => {
  it('puts a recipe\'s ingredients on the list with the aisle and the recipe they are for', () => {
    store().generateGroceryList(['r1']);
    expect(names()).toEqual([['flour', 1, 'cup'], ['milk', 1, 'cup'], ['eggs', 2, '']]);
    expect(store().groceryList[0]).toMatchObject({ category: 'Grains & Bread', recipes: ['Pancakes'], recipeIds: ['r1'], checked: false });
  });

  it('keeps what was already on the list when another recipe is added (it used to replace the list)', () => {
    store().generateGroceryList(['r1']);
    store().generateGroceryList(['r2']);
    expect(names()).toEqual([['flour', 4, 'cup'], ['milk', 1, 'cup'], ['eggs', 2, ''], ['salt', null, ''], ['milk', 2, 'tbsp']]);
    expect(store().groceryList[0].recipes).toEqual(['Pancakes', 'Bread']);
  });

  it('does not count a recipe twice', () => {
    store().generateGroceryList(['r1']);
    const before = store().groceryList;
    store().generateGroceryList(['r1']);
    expect(store().groceryList).toEqual(before);
  });

  it('gives every line its own id', () => {
    store().generateGroceryList(['r1']);
    store().generateGroceryList(['r2']);
    const ids = store().groceryList.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('adds several recipes at once and ignores ids that are not saved recipes', () => {
    store().generateGroceryList(['r1', 'r2', 'nope']);
    expect(store().groceryList.find((i) => i.ingredient === 'flour')).toMatchObject({ amount: 4, recipes: ['Pancakes', 'Bread'] });
  });

  it('unticks a line when another recipe needs more of it', () => {
    store().generateGroceryList(['r1']);
    store().toggleGroceryItem(store().groceryList[0].id);
    expect(store().groceryList[0].checked).toBe(true);
    store().generateGroceryList(['r2']);
    expect(store().groceryList[0]).toMatchObject({ ingredient: 'flour', checked: false });
  });

  it('saves the list on the phone', () => {
    store().generateGroceryList(['r1']);
    const call = AsyncStorage.setItem.mock.calls.find(([key]) => key === '@grocery_list');
    expect(JSON.parse(call[1])).toHaveLength(3);
  });
});

describe('addToGroceryList and the rest of the list', () => {
  it('adds a recipe and marks it as on the list', () => {
    store().addToGroceryList('r1');
    expect(names()).toHaveLength(3);
    expect(store().savedRecipes.find((r) => r.id === 'r1').addedToGroceryList).toBe(true);
    expect(store().savedRecipes.find((r) => r.id === 'r2').addedToGroceryList).toBeFalsy();
  });

  it('ticks, removes and clears lines', () => {
    store().generateGroceryList(['r1']);
    const [first, second] = store().groceryList;
    store().toggleGroceryItem(first.id);
    expect(store().groceryList[0].checked).toBe(true);
    store().toggleGroceryItem(first.id);
    expect(store().groceryList[0].checked).toBe(false);
    store().removeGroceryItem(second.id);
    expect(store().groceryList.map((i) => i.id)).not.toContain(second.id);
    store().clearGroceryList();
    expect(store().groceryList).toEqual([]);
  });
});

describe('loadGroceryList', () => {
  const saved = [{ id: 'g1', ingredient: 'rice', amount: 2, unit: 'cup', recipes: ['Bowl'], checked: true, category: 'Grains & Bread' }];

  it('brings the saved list back from the phone', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(saved));
    await store().loadGroceryList();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@grocery_list');
    expect(store().groceryList).toEqual(saved);
    expect(store().groceryLoaded).toBe(true);
  });

  it('only reads once', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(saved));
    await store().loadGroceryList();
    await store().loadGroceryList();
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  });

  it('keeps a recipe added while it was still reading', async () => {
    let finish;
    AsyncStorage.getItem.mockReturnValueOnce(new Promise((r) => { finish = r; }));
    const pending = store().loadGroceryList();
    store().generateGroceryList(['r1']);
    finish(JSON.stringify(saved));
    await pending;
    expect(store().groceryList.map((i) => i.ingredient)).toEqual(['rice', 'flour', 'milk', 'eggs']);
  });

  it('works out an empty or broken saved list as empty', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ not: 'a list' }));
    await store().loadGroceryList();
    expect(store().groceryList).toEqual([]);
    expect(store().groceryLoaded).toBe(true);
  });

  it('can try again after a failed read', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('disk'));
    await store().loadGroceryList();
    expect(store().groceryLoaded).toBe(false);
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(saved));
    await store().loadGroceryList();
    expect(store().groceryList).toEqual(saved);
    errorSpy.mockRestore();
  });

  it('adds to a list that came from an older version of the app (no recipe ids)', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([
      { id: 'g1', ingredient: 'flour', amount: 1, unit: 'cup', recipes: ['Pancakes'], checked: false, category: 'Grains & Bread' },
    ]));
    await store().loadGroceryList();
    store().generateGroceryList(['r1']); // Pancakes, already counted by name
    expect(store().groceryList.find((i) => i.ingredient === 'flour').amount).toBe(1);
    store().generateGroceryList(['r2']);
    expect(store().groceryList.find((i) => i.ingredient === 'flour')).toMatchObject({ amount: 4, recipes: ['Pancakes', 'Bread'] });
  });
});

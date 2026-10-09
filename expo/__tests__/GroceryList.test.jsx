import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: ({ children, style }) => mockReact.createElement(mockRn.View, { style }, children) };
}, { virtual: true });
jest.mock('@/store/recipeStore', () => ({ useRecipeStore: () => global.__recipes }));

import GroceryListButton from '../components/GroceryListButton';

const line = (extra) => ({
  id: 'g1', ingredient: 'flour', amount: 2, unit: 'cup', recipes: ['Pancakes'], recipeIds: ['r1'],
  checked: false, category: 'Grains & Bread', ...extra,
});

const open = (extra = {}) => {
  global.__recipes = {
    groceryList: [],
    savedRecipes: [],
    toggleGroceryItem: jest.fn(),
    removeGroceryItem: jest.fn(),
    clearGroceryList: jest.fn(),
    generateGroceryList: jest.fn(),
    loadGroceryList: jest.fn(),
    ...extra,
  };
  return render(<GroceryListButton />);
};
const show = (utils) => fireEvent.press(utils.getByTestId('grocery-open'));

afterEach(() => { jest.restoreAllMocks(); });

describe('the cart button', () => {
  it('loads the saved list when it appears', () => {
    open();
    expect(global.__recipes.loadGroceryList).toHaveBeenCalledTimes(1);
  });

  it('shows how many lines are left to buy', () => {
    const utils = open({ groceryList: [line(), line({ id: 'g2', checked: true }), line({ id: 'g3', ingredient: 'milk' })] });
    expect(within(utils.getByTestId('grocery-badge')).getByText('2')).toBeTruthy();
  });

  it('has no badge when the list is empty or all ticked', () => {
    expect(open().queryByTestId('grocery-badge')).toBeNull();
    expect(open({ groceryList: [line({ checked: true })] }).queryByTestId('grocery-badge')).toBeNull();
  });

  it('stops at 99+', () => {
    const many = Array.from({ length: 120 }, (_, i) => line({ id: `g${i}` }));
    expect(within(open({ groceryList: many }).getByTestId('grocery-badge')).getByText('99+')).toBeTruthy();
  });

  it('keeps the list closed until it is pressed, then opens and closes it', () => {
    const utils = open({ groceryList: [line()] });
    expect(utils.queryByText('Grocery List')).toBeNull();
    show(utils);
    expect(utils.getByText('Grocery List')).toBeTruthy();
    fireEvent.press(utils.UNSAFE_getByType('X').parent);
    expect(utils.queryByText('Grocery List')).toBeNull();
  });
});

describe('the list', () => {
  it('shows each line the way a shopper reads it, grouped by aisle, with the recipes it is for', () => {
    const utils = open({
      groceryList: [
        line(),
        line({ id: 'g2', ingredient: 'milk', amount: 1.5, unit: 'cup', category: 'Dairy', recipes: ['Pancakes', 'Bread'] }),
        line({ id: 'g3', ingredient: 'salt', amount: null, unit: '', category: 'Other', recipes: [] }),
      ],
    });
    show(utils);
    expect(utils.getByText('2 cups flour')).toBeTruthy();
    expect(utils.getByText('1 1/2 cups milk')).toBeTruthy();
    expect(utils.getByText('salt')).toBeTruthy();
    expect(utils.getByText('Grains & Bread')).toBeTruthy();
    expect(utils.getByText('Dairy')).toBeTruthy();
    expect(utils.getByText('For: Pancakes, Bread')).toBeTruthy();
    expect(utils.getByText('0 of 3 items completed')).toBeTruthy();
  });

  it('copes with an older line that has no recipes list', () => {
    const utils = open({ groceryList: [line({ recipes: undefined })] });
    show(utils);
    expect(utils.getByText('2 cups flour')).toBeTruthy();
  });

  it('ticks a line', () => {
    const utils = open({ groceryList: [line()] });
    show(utils);
    fireEvent.press(utils.getByText('2 cups flour'));
    expect(global.__recipes.toggleGroceryItem).toHaveBeenCalledWith('g1');
  });

  it('removes a line', () => {
    const utils = open({ groceryList: [line()] });
    show(utils);
    fireEvent.press(utils.getByTestId('grocery-delete-g1'));
    expect(global.__recipes.removeGroceryItem).toHaveBeenCalledWith('g1');
  });

  it('says how to start when it is empty', () => {
    const utils = open();
    show(utils);
    expect(utils.getByText('No items in your grocery list')).toBeTruthy();
    expect(utils.getByText("Add a recipe's ingredients to start your list")).toBeTruthy();
  });

  it('asks before clearing everything', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ groceryList: [line()] });
    show(utils);
    fireEvent.press(utils.getByText('Clear All'));
    expect(global.__recipes.clearGroceryList).not.toHaveBeenCalled();
    alert.mock.calls[0][2][1].onPress();
    expect(global.__recipes.clearGroceryList).toHaveBeenCalledTimes(1);
  });
});

describe('adding recipes', () => {
  const recipes = [
    { id: 'r1', name: 'Pancakes', servings: 4 },
    { id: 'r2', name: 'Bread', servings: 8 },
  ];

  it('picks recipes and adds their ingredients', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ savedRecipes: recipes });
    show(utils);
    fireEvent.press(utils.getByText('Add from Recipes'));
    fireEvent.press(utils.getByText('Pancakes'));
    fireEvent.press(utils.getByText('Bread'));
    fireEvent.press(utils.getByText('Add to List (2)'));
    expect(global.__recipes.generateGroceryList).toHaveBeenCalledWith(['r1', 'r2']);
    expect(alert).toHaveBeenCalledWith('Added', 'The ingredients are on your grocery list.');
    expect(utils.queryByText('Select Recipes')).toBeNull();
  });

  it('will not add with no recipe picked', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ savedRecipes: recipes });
    show(utils);
    fireEvent.press(utils.getByText('Add from Recipes'));
    fireEvent.press(utils.getByText('Add to List (0)'));
    expect(global.__recipes.generateGroceryList).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('marks the recipes that are already on the list', () => {
    const utils = open({ savedRecipes: recipes, groceryList: [line()] });
    show(utils);
    fireEvent.press(utils.getByText('Add from Recipes'));
    expect(utils.getByText('4 servings · already on your list')).toBeTruthy();
    expect(utils.getByText('8 servings')).toBeTruthy();
  });

  it('says so when there are no saved recipes', () => {
    const utils = open();
    show(utils);
    fireEvent.press(utils.getByText('Add from Recipes'));
    expect(utils.getByTestId('grocery-no-recipes')).toBeTruthy();
  });

  it('can be cancelled', () => {
    const utils = open({ savedRecipes: recipes });
    show(utils);
    fireEvent.press(utils.getByText('Add from Recipes'));
    fireEvent.press(utils.getByText('Pancakes'));
    fireEvent.press(utils.getByText('Cancel'));
    expect(utils.queryByText('Select Recipes')).toBeNull();
    fireEvent.press(utils.getByText('Add from Recipes'));
    expect(utils.getByText('Add to List (0)')).toBeTruthy();
  });
});

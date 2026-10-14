// The Recipes screen sizes each suggested meal from the person's calorie goal. It must be the goal for EATING
// (the nutrition store's target), not the goal for BURNING that the home Calories card sets (user.dailyCalorieGoal):
// someone aiming to burn 500 a day was being shown meals of 125-175 calories.
import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => '') }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => () => null);
jest.mock('@/src/components/EmptyState', () => () => null);
jest.mock('@/components/GroceryListButton', () => () => null);
jest.mock('@/components/RecipeImportModal', () => () => null);
jest.mock('@/components/RecipePreviewModal', () => () => null);
jest.mock('@/store/recipeStore', () => ({
  useRecipeStore: () => ({ savedRecipes: [], loadRecipes: async () => {}, removeRecipe: () => {}, addRecipe: () => {} }),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/services/recipeExtractionService', () => ({
  __esModule: true,
  default: {
    getSpoonacularBrowse: jest.fn(async () => []),
    getSpoonacularBrowseBatch: jest.fn(async () => ({})),
  },
}));

import RecipesScreen from '../app/recipes';
import recipeExtractionService from '@/services/recipeExtractionService';
import { useNutritionStore } from '../store/nutritionStore';

const flush = () => act(async () => {});
const mount = async (user, nutrition) => {
  global.__user = { uid: 'u1', fitnessLevel: 'intermediate', ...user };
  useNutritionStore.setState({
    dailyGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 },
    dailyGoalsUpdatedAt: null,
    ...nutrition,
  });
  recipeExtractionService.getSpoonacularBrowse.mockClear();
  recipeExtractionService.getSpoonacularBrowseBatch.mockClear();
  const utils = render(<RecipesScreen />);
  await flush();
  return utils;
};
const section = (key) => {
  const call = recipeExtractionService.getSpoonacularBrowseBatch.mock.calls[0];
  return call ? call[0].find((s) => s.key === key).params : null;
};
const aiParams = () => recipeExtractionService.getSpoonacularBrowse.mock.calls[0][0];

describe('Recipes: which calorie goal sizes the meals', () => {
  it('does not mistake a burn goal for an eating target (no eat goal yet: the 300-700 default)', async () => {
    await mount({ dailyCalorieGoal: 500 }, {});
    expect(section('featured')).toMatchObject({ minCalories: '300', maxCalories: '700' });
    expect(section('quickEasy').maxCalories).toBe('700');
    expect(aiParams()).toMatchObject({ minCalories: '300', maxCalories: '700' });
  });

  it('sizes a meal at 25-35% of the eat goal once there is one, whatever the burn goal is', async () => {
    await mount({ dailyCalorieGoal: 500 }, { dailyGoals: { calories: 2400 }, dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z' });
    expect(section('featured')).toMatchObject({ minCalories: '600', maxCalories: '840' });
    expect(section('quickEasy').maxCalories).toBe('840');
    expect(aiParams()).toMatchObject({ minCalories: '600', maxCalories: '840' });
  });

  it('uses the eat goal for the weight-loss ceiling too (30% of it)', async () => {
    await mount(
      { dailyCalorieGoal: 300, fitnessMetrics: { targetGoals: ['lose_weight'] } },
      { dailyGoals: { calories: 3000 }, dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z' },
    );
    expect(aiParams()).toMatchObject({ minCalories: '750', maxCalories: '900' });
  });
});

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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => () => null);
jest.mock('@/components/GroceryListButton', () => () => null);
jest.mock('@/components/RecipeImportModal', () => () => null);
jest.mock('@/components/RecipePreviewModal', () => () => null);
jest.mock('@/store/recipeStore', () => ({
  useRecipeStore: () => ({ savedRecipes: [], loadRecipes: async () => {}, removeRecipe: () => {}, addRecipe: () => {} }),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: (select) => select({ completedWorkouts: [] }) }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: (select) => select({ runs: [] }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: (select) => select({ completedHikes: [] }) }));
jest.mock('@/services/recipeExtractionService', () => ({
  __esModule: true,
  default: {
    getSpoonacularBrowse: jest.fn(async () => []),
    getSpoonacularBrowseBatch: jest.fn(async () => ({})),
    getSpoonacularById: jest.fn(async () => null),
  },
}));

import RecipesScreen from '../app/recipes';
import recipeExtractionService from '@/services/recipeExtractionService';
import { useNutritionStore } from '../store/nutritionStore';
import { resetBrowseCacheForTests } from '../lib/recipeCache';

// 6 PM: dinner, whatever day the tests run on.
const SIX_PM = new Date(2026, 9, 28, 18, 0);

const flush = () => act(async () => {});
const mount = async (user, nutrition) => {
  global.__user = { uid: 'u1', fitnessLevel: 'intermediate', ...user };
  useNutritionStore.setState({
    dailyGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 },
    dailyGoalsUpdatedAt: null,
    meals: [],
    ...nutrition,
  });
  resetBrowseCacheForTests();
  recipeExtractionService.getSpoonacularBrowse.mockClear();
  recipeExtractionService.getSpoonacularBrowseBatch.mockClear();
  const utils = render(<RecipesScreen />);
  await flush();
  await flush();
  return utils;
};
const section = (key) => {
  const call = recipeExtractionService.getSpoonacularBrowseBatch.mock.calls[0];
  return call ? call[0].find((s) => s.key === key).params : null;
};

beforeAll(() => {
  jest.useFakeTimers({
    now: SIX_PM,
    doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
      'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
  });
});
afterAll(() => { jest.useRealTimers(); });

describe('Recipes: which calorie goal sizes the meals', () => {
  it('does not mistake a burn goal for an eating target (no eat goal yet: a typical dinner of about 650)', async () => {
    await mount({ dailyCalorieGoal: 500 }, {});
    expect(section('pool')).toMatchObject({ type: 'main course', minCalories: '325', maxCalories: '975' });
    expect(section('quickEasy').maxCalories).toBe('700');
  });

  it('sizes dinner at 35% of the eat goal once there is one, whatever the burn goal is', async () => {
    await mount({ dailyCalorieGoal: 500 }, { dailyGoals: { calories: 2400 }, dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z' });
    // 35% of 2400 is 840; the question allows half to one and a half times that
    expect(section('pool')).toMatchObject({ minCalories: '420', maxCalories: '1260' });
    expect(section('quickEasy').maxCalories).toBe('840');
  });

  it('does not size the question by what was eaten today, so logging a meal does not fetch again', async () => {
    await mount({}, {
      dailyGoals: { calories: 2400, protein: 160 },
      dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z',
      meals: [{ id: 'm1', date: '2026-10-28', foods: [{ calories: 1800, protein: 100, carbs: 150, fat: 50 }] }],
    });
    expect(section('pool')).toMatchObject({ minCalories: '420', maxCalories: '1260' });
  });
});

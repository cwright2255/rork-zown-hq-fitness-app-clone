// The Recipes tab (app/recipes.jsx): what it picks for the person, that it opens with recipes on screen, how the chips, the search and
// "cook with what I have" behave, and saving from a card.
import React from 'react';
import { Alert, RefreshControl } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k) => (k in mockStorage ? mockStorage[k] : null)),
    setItem: jest.fn(async (k, v) => { mockStorage[k] = v; }),
    removeItem: jest.fn(async (k) => { delete mockStorage[k]; }),
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => '') }), { virtual: true });
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (...a) => global.__push(...a) }) }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View, { testID: 'skeleton' }) };
});
jest.mock('@/components/GroceryListButton', () => () => null);
jest.mock('@/components/RecipeImportModal', () => () => null);
jest.mock('@/components/RecipePreviewModal', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__preview = props;
      return props.visible ? mockReact.createElement(mockRn.View, { testID: 'preview-modal' }) : null;
    },
  };
});
jest.mock('@/store/recipeStore', () => {
  const { create } = require('zustand');
  return {
    useRecipeStore: create((set) => ({
      savedRecipes: [],
      loadRecipes: jest.fn(async () => {}),
      removeRecipe: jest.fn((id) => set((st) => ({ savedRecipes: st.savedRecipes.filter((r) => r.id !== id) }))),
      addRecipe: jest.fn(async (recipe) => {
        const saved = { ...recipe, id: `saved-${recipe.sourceId}`, title: recipe.name };
        set((st) => ({ savedRecipes: [...st.savedRecipes, saved] }));
        return saved;
      }),
    })),
  };
});
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: (select) => select({ completedWorkouts: global.__training.completedWorkouts }) }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: (select) => select({ runs: global.__training.runs }) }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: (select) => select({ completedHikes: global.__training.completedHikes }) }));
jest.mock('@/services/recipeExtractionService', () => ({
  __esModule: true,
  default: {
    lastDiagnostic: null,
    getSpoonacularBrowse: jest.fn(),
    getSpoonacularBrowseBatch: jest.fn(),
    getSpoonacularById: jest.fn(),
  },
}));

import RecipesScreen from '../app/recipes';
import recipeExtractionService from '@/services/recipeExtractionService';
import { useNutritionStore } from '../store/nutritionStore';
import { useRecipeStore } from '../store/recipeStore';
import { resetBrowseCacheForTests } from '../lib/recipeCache';
import { mapBrowseResult } from '../lib/recipePicks';

const SIX_PM = new Date(2026, 9, 28, 18, 0).getTime();
const TODAY = '2026-10-28';
const HISTORY_KEY = '@recipes_recent_picks_v1:u1';
const MINUTE = 60 * 1000;

const rec = (id, name, o = {}) => {
  const { cal = 500, p = 30, c = 40, f = 15, min = 25, health = 60, likes = 100, cuisines = ['italian'], used, missed } = o;
  return mapBrowseResult({
    id, title: name, image: `https://img/${id}.jpg`, readyInMinutes: min, servings: 2, healthScore: health, aggregateLikes: likes,
    dishTypes: ['main course'], cuisines,
    nutrition: { nutrients: [{ name: 'Calories', amount: cal }, { name: 'Protein', amount: p }, { name: 'Carbohydrates', amount: c }, { name: 'Fat', amount: f }] },
    usedIngredients: used && used.map((n) => ({ name: n })),
    missedIngredients: missed && missed.map((n) => ({ name: n })),
  });
};
// Nine poor fits for dinner, so a recipe made to fit stands out from them.
const fillers = (n = 9) => Array.from({ length: n }, (_, i) => rec(`f${i}`, `Heavy Dish ${i}`, { cal: 1300, p: 8, c: 120, f: 70, health: 20, min: 90, likes: 1, cuisines: [] }));
const best = (over = {}) => rec('best', 'Garlic Chicken Bowl', { cal: 640, p: 38, c: 45, f: 18, health: 70, min: 30, ...over });

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => setImmediate(r)); }); };
const setNow = (ms) => jest.setSystemTime(new Date(ms));
const text = (utils, value) => utils.queryByText(value);

function setup({ user, nutrition, training, saved, batch, browse } = {}) {
  global.__user = { uid: 'u1', fitnessLevel: 'intermediate', ...user };
  global.__training = { completedWorkouts: [], runs: [], completedHikes: [], ...training };
  global.__push = jest.fn();
  global.__batch = batch || { pool: [best(), ...fillers()], postWorkout: [rec('pw0', 'Row Wrap')], mealPrep: [rec('mp0', 'Row Chili')], quickEasy: [rec('qe0', 'Row Eggs')] };
  global.__browse = browse || (() => []);
  useNutritionStore.setState({
    dailyGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 },
    dailyGoalsUpdatedAt: null,
    meals: [],
    ...nutrition,
  });
  useRecipeStore.setState({ savedRecipes: saved || [] });
  ['addRecipe', 'removeRecipe', 'loadRecipes'].forEach((fn) => useRecipeStore.getState()[fn].mockClear());
  recipeExtractionService.getSpoonacularBrowseBatch.mockReset().mockImplementation(async () => (typeof global.__batch === 'function' ? global.__batch() : global.__batch));
  recipeExtractionService.getSpoonacularBrowse.mockReset().mockImplementation(async (params) => global.__browse(params));
  recipeExtractionService.getSpoonacularById.mockReset().mockImplementation(async (id) => ({ name: `Detail ${id}`, sourceId: String(id), ingredients: [], instructions: [] }));
  recipeExtractionService.lastDiagnostic = null;
}
async function open(options) {
  setup(options);
  resetBrowseCacheForTests();
  const utils = render(<RecipesScreen />);
  await flush();
  return utils;
}

beforeAll(() => {
  jest.useFakeTimers({
    now: SIX_PM,
    doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
      'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
  });
});
afterAll(() => { jest.useRealTimers(); });
beforeEach(() => {
  setNow(SIX_PM);
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('the top pick and the picks', () => {
  it('puts the recipe that fits the person at the top, with the meal it is for', async () => {
    const utils = await open();
    const hero = within(utils.getByTestId('hero-pick'));
    expect(hero.getByText('Garlic Chicken Bowl')).toBeTruthy();
    expect(hero.getByText('Top pick for dinner')).toBeTruthy();
    expect(utils.getByText('Picked for you')).toBeTruthy();
    expect(utils.getByTestId('recipe-card-f0')).toBeTruthy();
  });

  it('asks once for everything: the pool and the three rows', async () => {
    await open();
    expect(recipeExtractionService.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(1);
    const asked = recipeExtractionService.getSpoonacularBrowseBatch.mock.calls[0][0];
    expect(asked.map((s) => s.key)).toEqual(['pool', 'postWorkout', 'mealPrep', 'quickEasy']);
    expect(asked[0].number).toBe(36);
  });

  it('puts the diet, allergies and foods to avoid on every question', async () => {
    await open({ user: { fitnessMetrics: { nutritionPreference: 'keto', foodAllergies: ['peanut'], avoidFoods: ['pork'] } } });
    const asked = recipeExtractionService.getSpoonacularBrowseBatch.mock.calls[0][0];
    expect(asked).toHaveLength(4);
    asked.forEach((s) => expect(s.params).toMatchObject({ diet: 'ketogenic', intolerances: 'peanut', excludeIngredients: 'pork,bacon,ham' }));
  });

  it('prefers what fits the calories and protein the person has left today', async () => {
    const light = rec('light', 'Light Salmon Bowl', { cal: 580, p: 45, c: 40, f: 18, health: 70, min: 25 });
    const big = rec('big', 'Big Burrito', { cal: 1100, p: 30, c: 120, f: 50, health: 70, min: 25, likes: 5000 });
    const utils = await open({
      batch: { pool: [big, light, ...fillers(7)], postWorkout: [], mealPrep: [], quickEasy: [] },
      nutrition: {
        dailyGoals: { calories: 2400, protein: 160 },
        dailyGoalsUpdatedAt: '2026-10-14T12:00:00.000Z',
        meals: [{ id: 'm1', date: TODAY, foods: [{ calories: 1800, protein: 100, carbs: 150, fat: 50 }] }],
      },
    });
    const hero = within(utils.getByTestId('hero-pick'));
    expect(hero.getByText('Light Salmon Bowl')).toBeTruthy();
    expect(hero.getByText('Fits the 600 cal you have left')).toBeTruthy();
    expect(utils.getByTestId('sizing-line').props.children).toBe('Sized for dinner: about 600 cal and 50 g protein. You have 600 cal and 60 g protein left today.');
  });

  it('says it is sized for a typical meal when the person has no eating goal, and claims nothing about what is left', async () => {
    const utils = await open();
    expect(utils.getByTestId('sizing-line').props.children).toBe('Sized for dinner: about 650 cal and 35 g protein.');
    expect(utils.queryByText(/you have left/i)).toBeNull();
  });

  it('prefers protein and carbs after training today, and says why', async () => {
    const refuel = rec('refuel', 'Teriyaki Rice Bowl', { cal: 650, p: 40, c: 70, f: 12, health: 55, min: 30 });
    const utils = await open({
      batch: { pool: [refuel, ...fillers(9)], postWorkout: [], mealPrep: [], quickEasy: [] },
      training: { completedWorkouts: [{ completedAt: new Date(2026, 9, 28, 9, 0).toISOString() }] },
    });
    expect(within(utils.getByTestId('hero-pick')).getByText('Good after today\'s workout: protein and carbs')).toBeTruthy();
  });

  it('does not count a workout from another day', async () => {
    const refuel = rec('refuel', 'Teriyaki Rice Bowl', { cal: 650, p: 40, c: 70, f: 12 });
    const utils = await open({
      batch: { pool: [refuel, ...fillers(9)], postWorkout: [], mealPrep: [], quickEasy: [] },
      training: { completedWorkouts: [{ completedAt: new Date(2026, 9, 27, 9, 0).toISOString() }] },
    });
    expect(utils.queryByText(/after today's workout/)).toBeNull();
  });

  it('does not put the same recipe at the top day after day', async () => {
    const twin = rec('twin', 'Lemon Chicken Bowl', { cal: 720, p: 37, c: 45, f: 18, health: 70, min: 30 });
    mockStorage[HISTORY_KEY] = JSON.stringify({ best: ['2026-10-27'] });
    const utils = await open({ batch: { pool: [best(), twin, ...fillers(8)], postWorkout: [], mealPrep: [], quickEasy: [] } });
    expect(within(utils.getByTestId('hero-pick')).getByText('Lemon Chicken Bowl')).toBeTruthy();
  });

  it('remembers what it put at the top today, and does not reshuffle when opened again the same day', async () => {
    const twin = rec('twin', 'Lemon Chicken Bowl', { cal: 720, p: 37, c: 45, f: 18, health: 70, min: 30 });
    const pool = { pool: [best(), twin, ...fillers(8)], postWorkout: [], mealPrep: [], quickEasy: [] };
    const first = await open({ batch: pool });
    expect(within(first.getByTestId('hero-pick')).getByText('Garlic Chicken Bowl')).toBeTruthy();
    const remembered = JSON.parse(mockStorage[HISTORY_KEY]);
    expect(remembered.best).toEqual([TODAY]);
    expect(remembered.twin).toEqual([TODAY]);
    first.unmount();
    resetBrowseCacheForTests();
    const second = render(<RecipesScreen />);
    await flush();
    expect(within(second.getByTestId('hero-pick')).getByText('Garlic Chicken Bowl')).toBeTruthy();
  });

  it('shows a recipe once on the page: a top pick is not repeated in a row', async () => {
    const utils = await open({
      batch: { pool: [best(), ...fillers()], postWorkout: [best(), rec('pw1', 'Post Workout Wrap')], mealPrep: [rec('mp1', 'Meal Prep Chili')], quickEasy: [rec('qe1', 'Quick Eggs')] },
    });
    expect(utils.getAllByText('Garlic Chicken Bowl')).toHaveLength(1);
    expect(utils.getAllByText('Post-Workout')).toHaveLength(2); // the chip and the row
    expect(utils.getByText('Meal Prep')).toBeTruthy();
    expect(utils.getByText('Quick & Easy')).toBeTruthy();
    expect(utils.getByTestId('recipe-card-pw1')).toBeTruthy();
    expect(utils.getByTestId('recipe-card-mp1')).toBeTruthy();
    expect(utils.getByTestId('recipe-card-qe1')).toBeTruthy();
  });

  it('leaves out a row that has nothing in it', async () => {
    const utils = await open({ batch: { pool: [best(), ...fillers()], postWorkout: [], mealPrep: [], quickEasy: [rec('qe1', 'Quick Eggs')] } });
    expect(utils.getAllByText('Post-Workout')).toHaveLength(1); // the chip only
    expect(utils.queryByText('Meal Prep')).toBeNull();
    expect(utils.getByText('Quick & Easy')).toBeTruthy();
  });

  it('shows more picks under View All', async () => {
    const utils = await open();
    expect(utils.queryByTestId('recipe-card-f8')).toBeNull();
    fireEvent.press(utils.getByTestId('picks-view-all'));
    expect(utils.getByTestId('recipe-card-f8')).toBeTruthy();
    expect(utils.getByText('Show Less')).toBeTruthy();
  });
});

describe('opening with recipes on screen', () => {
  it('shows what it kept last time at once, without asking again when it is under half an hour old', async () => {
    const first = await open();
    first.unmount();
    resetBrowseCacheForTests(); // the app was closed and opened again
    setNow(SIX_PM + 10 * MINUTE);
    recipeExtractionService.getSpoonacularBrowseBatch.mockClear();
    const second = render(<RecipesScreen />);
    await flush();
    expect(within(second.getByTestId('hero-pick')).getByText('Garlic Chicken Bowl')).toBeTruthy();
    expect(recipeExtractionService.getSpoonacularBrowseBatch).not.toHaveBeenCalled();
    expect(second.queryByTestId('skeleton')).toBeNull();
  });

  it('shows what it kept while it asks again once it is old, then swaps the new recipes in', async () => {
    const first = await open();
    first.unmount();
    resetBrowseCacheForTests();
    setNow(SIX_PM + 31 * MINUTE);
    const pending = deferred();
    recipeExtractionService.getSpoonacularBrowseBatch.mockClear().mockImplementation(() => pending.promise);
    const second = render(<RecipesScreen />);
    await flush();
    expect(within(second.getByTestId('hero-pick')).getByText('Garlic Chicken Bowl')).toBeTruthy(); // not a blank page
    expect(recipeExtractionService.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(1);
    const newer = rec('newer', 'Seared Tuna Bowl', { cal: 640, p: 42, c: 45, f: 18, health: 85, min: 20 });
    await act(async () => { pending.resolve({ pool: [newer, ...fillers()], postWorkout: [], mealPrep: [], quickEasy: [] }); });
    await flush();
    expect(within(second.getByTestId('hero-pick')).getByText('Seared Tuna Bowl')).toBeTruthy();
  });

  it('asks again the next day even if the last answer is only a few hours old', async () => {
    const first = await open();
    first.unmount();
    resetBrowseCacheForTests();
    setNow(new Date(2026, 9, 29, 18, 0).getTime());
    recipeExtractionService.getSpoonacularBrowseBatch.mockClear();
    const second = render(<RecipesScreen />);
    await flush();
    expect(recipeExtractionService.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(1);
    expect(second.getByTestId('hero-pick')).toBeTruthy();
  });

  it('keeps showing what it kept when asking again fails, and does not remember the failure', async () => {
    const first = await open();
    first.unmount();
    resetBrowseCacheForTests();
    setNow(SIX_PM + 40 * MINUTE);
    const before = mockStorage['@recipes_browse_cache_v1:u1'];
    global.__batch = {}; // the call failed: the service gives back nothing
    const second = render(<RecipesScreen />);
    await flush();
    expect(within(second.getByTestId('hero-pick')).getByText('Garlic Chicken Bowl')).toBeTruthy();
    expect(second.queryByTestId('home-empty')).toBeNull();
    expect(mockStorage['@recipes_browse_cache_v1:u1']).toBe(before);
  });

  it('says so, and can try again, when there is nothing kept and the call fails', async () => {
    const utils = await open({ batch: {} });
    expect(utils.getByTestId('home-empty')).toBeTruthy();
    expect(utils.getByText('Nothing to show right now')).toBeTruthy();
    expect(utils.queryByTestId('hero-pick')).toBeNull();
    global.__batch = { pool: [best(), ...fillers()], postWorkout: [], mealPrep: [], quickEasy: [] };
    await act(async () => { fireEvent.press(utils.getByTestId('home-retry')); });
    await flush();
    expect(utils.queryByTestId('home-empty')).toBeNull();
    expect(within(utils.getByTestId('hero-pick')).getByText('Garlic Chicken Bowl')).toBeTruthy();
  });

  it('shows a placeholder, not a blank page, while the first ever answer is on its way', async () => {
    const pending = deferred();
    setup({});
    resetBrowseCacheForTests();
    recipeExtractionService.getSpoonacularBrowseBatch.mockImplementation(() => pending.promise);
    const utils = render(<RecipesScreen />);
    await flush();
    expect(utils.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(utils.queryByTestId('home-empty')).toBeNull();
  });

  it('never shows recipes kept for a different diet', async () => {
    const vegan = await open({ user: { fitnessMetrics: { nutritionPreference: 'vegan' } } });
    expect(vegan.getByTestId('hero-pick')).toBeTruthy();
    vegan.unmount();
    resetBrowseCacheForTests();
    const pending = deferred();
    global.__user = { uid: 'u1', fitnessLevel: 'intermediate', fitnessMetrics: { nutritionPreference: 'keto' } };
    recipeExtractionService.getSpoonacularBrowseBatch.mockClear().mockImplementation(() => pending.promise);
    const keto = render(<RecipesScreen />);
    await flush();
    expect(keto.queryByTestId('hero-pick')).toBeNull();
    expect(keto.queryByText('Garlic Chicken Bowl')).toBeNull();
    expect(recipeExtractionService.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(1);
  });

  it('drops the recipes of the old diet the moment the diet changes while the tab is open', async () => {
    const utils = await open({ user: { fitnessMetrics: { nutritionPreference: 'vegan' } } });
    expect(within(utils.getByTestId('hero-pick')).getByText('Garlic Chicken Bowl')).toBeTruthy();
    const pending = deferred();
    recipeExtractionService.getSpoonacularBrowseBatch.mockClear().mockImplementation(() => pending.promise);
    global.__user = { uid: 'u1', fitnessLevel: 'intermediate', fitnessMetrics: { nutritionPreference: 'keto' } };
    utils.rerender(<RecipesScreen />);
    await flush();
    expect(utils.queryByText('Garlic Chicken Bowl')).toBeNull();
    expect(utils.queryByTestId('hero-pick')).toBeNull();
    expect(recipeExtractionService.getSpoonacularBrowseBatch.mock.calls[0][0][0].params.diet).toBe('ketogenic');
    const keto = rec('keto1', 'Butter Steak Plate', { cal: 640, p: 40, c: 5, f: 50, health: 60, min: 25 });
    await act(async () => { pending.resolve({ pool: [keto, ...fillers()], postWorkout: [], mealPrep: [], quickEasy: [] }); });
    await flush();
    expect(within(utils.getByTestId('hero-pick')).getByText('Butter Steak Plate')).toBeTruthy();
  });

  it('does not show one person\'s kept recipes to another', async () => {
    const first = await open();
    first.unmount();
    resetBrowseCacheForTests();
    global.__user = { uid: 'u2', fitnessLevel: 'intermediate' };
    const pending = deferred();
    recipeExtractionService.getSpoonacularBrowseBatch.mockClear().mockImplementation(() => pending.promise);
    const other = render(<RecipesScreen />);
    await flush();
    expect(other.queryByTestId('hero-pick')).toBeNull();
  });

  it('asks again when pulled down, even if what it has is fresh', async () => {
    const utils = await open();
    recipeExtractionService.getSpoonacularBrowseBatch.mockClear();
    const refresh = utils.UNSAFE_getByType(RefreshControl);
    await act(async () => { await refresh.props.onRefresh(); });
    await flush();
    expect(recipeExtractionService.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(1);
  });
});

describe('the chips', () => {
  it('has a chip for each meal as well as the old ones', async () => {
    const utils = await open();
    ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'High Protein', 'Low Carb', 'Vegan', 'Quick Meals', 'Post-Workout'].forEach((c) => expect(utils.getByTestId(`chip-${c}`)).toBeTruthy());
  });

  it('asks for recipes sized for that meal and shows the best fit first', async () => {
    const utils = await open({
      browse: () => [rec('hv', 'Huge Lunch', { cal: 1500, p: 10, health: 20, likes: 1 }), rec('fit', 'Perfect Lunch', { cal: 560, p: 34, health: 75, min: 20 })],
    });
    await act(async () => { fireEvent.press(utils.getByTestId('chip-Lunch')); });
    await flush();
    const [params, number] = recipeExtractionService.getSpoonacularBrowse.mock.calls[0];
    expect(params).toMatchObject({ type: 'main course', minCalories: '275', maxCalories: '825', number: 20 });
    expect(number).toBe(20);
    expect(utils.queryByTestId('hero-pick')).toBeNull();
    const cards = utils.getAllByTestId(/^recipe-card-/);
    expect(cards.map((c) => c.props.testID)).toEqual(['recipe-card-fit', 'recipe-card-hv']);
    expect(utils.getByTestId('chip-sizing-line').props.children).toBe('Sized for lunch: about 550 cal and 30 g protein.');
  });

  it('keeps the allergies on the Vegan chip, which replaces the diet', async () => {
    const utils = await open({ user: { fitnessMetrics: { nutritionPreference: 'keto', foodAllergies: ['peanut'] } }, browse: () => [rec('v1', 'Veg Curry')] });
    await act(async () => { fireEvent.press(utils.getByTestId('chip-Vegan')); });
    await flush();
    expect(recipeExtractionService.getSpoonacularBrowse.mock.calls[0][0]).toMatchObject({ diet: 'vegan', intolerances: 'peanut' });
  });

  it('shows what it kept for a chip at once the next time', async () => {
    const first = await open({ browse: () => [rec('hp1', 'Protein Pancakes')] });
    await act(async () => { fireEvent.press(first.getByTestId('chip-High Protein')); });
    await flush();
    first.unmount();
    resetBrowseCacheForTests();
    recipeExtractionService.getSpoonacularBrowse.mockClear();
    const second = render(<RecipesScreen />);
    await flush();
    await act(async () => { fireEvent.press(second.getByTestId('chip-High Protein')); });
    await flush();
    expect(second.getByTestId('recipe-card-hp1')).toBeTruthy();
    expect(recipeExtractionService.getSpoonacularBrowse).not.toHaveBeenCalled(); // fresh
  });

  it('says so when a chip has nothing, and goes back to the picks with All', async () => {
    const utils = await open({ browse: () => [] });
    await act(async () => { fireEvent.press(utils.getByTestId('chip-Snack')); });
    await flush();
    expect(utils.getByText('Nothing to show right now.')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByTestId('chip-All')); });
    await flush();
    expect(utils.getByTestId('hero-pick')).toBeTruthy();
  });
});

describe('search', () => {
  it('searches with the diet applied and ends a chip', async () => {
    const utils = await open({ user: { fitnessMetrics: { nutritionPreference: 'vegan' } }, browse: (p) => (p.query ? [rec('s1', 'Tomato Soup')] : [rec('c1', 'Chip Result')]) });
    await act(async () => { fireEvent.press(utils.getByTestId('chip-Snack')); });
    await flush();
    const input = utils.getByPlaceholderText('Search recipes...');
    fireEvent.changeText(input, 'soup');
    await act(async () => { fireEvent(input, 'submitEditing'); });
    await flush();
    expect(recipeExtractionService.getSpoonacularBrowse.mock.calls.pop()[0]).toMatchObject({ query: 'soup', diet: 'vegan', number: 20 });
    expect(utils.getByText('Results for "soup"')).toBeTruthy();
    expect(utils.getByTestId('recipe-card-s1')).toBeTruthy();
    expect(utils.queryByTestId('recipe-card-c1')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    const utils = await open({ browse: () => [] });
    const input = utils.getByPlaceholderText('Search recipes...');
    fireEvent.changeText(input, 'zzz');
    await act(async () => { fireEvent(input, 'submitEditing'); });
    await flush();
    expect(utils.getByText('No recipes found for that search.')).toBeTruthy();
  });
});

describe('cook with what I have', () => {
  const find = async (utils, typed) => {
    await act(async () => { fireEvent.press(utils.getByTestId('kitchen-open')); });
    fireEvent.changeText(utils.getByTestId('kitchen-input'), typed);
    await act(async () => { fireEvent.press(utils.getByTestId('kitchen-find')); });
    await flush();
  };

  it('asks for recipes that use the ingredients, with the diet applied', async () => {
    const utils = await open({
      user: { fitnessMetrics: { foodAllergies: ['soy'] } },
      browse: () => [rec('k1', 'Chicken Fried Rice', { used: ['chicken', 'rice'], missed: ['eggs', 'peas'] })],
    });
    await find(utils, 'Chicken, rice');
    expect(recipeExtractionService.getSpoonacularBrowse.mock.calls[0][0]).toMatchObject({
      includeIngredients: 'chicken,rice', fillIngredients: 'true', sort: 'max-used-ingredients', intolerances: 'soy', number: 20,
    });
    expect(utils.getByText('Made with chicken, rice')).toBeTruthy();
    expect(utils.getByText('Uses 2 of your 2')).toBeTruthy();
    expect(utils.getByText('Needs: eggs, peas')).toBeTruthy();
    expect(utils.queryByTestId('hero-pick')).toBeNull();
  });

  it('closes the sheet and ends a search', async () => {
    const utils = await open({ browse: () => [rec('k1', 'Chicken Fried Rice', { used: ['chicken'], missed: [] })] });
    const input = utils.getByPlaceholderText('Search recipes...');
    fireEvent.changeText(input, 'soup');
    await act(async () => { fireEvent(input, 'submitEditing'); });
    await flush();
    await find(utils, 'chicken');
    expect(utils.queryByTestId('kitchen-sheet')).toBeNull();
    expect(utils.queryByText('Results for "soup"')).toBeNull();
    expect(utils.getByTestId('recipe-card-k1')).toBeTruthy();
  });

  it('suggests taking one out when several ingredients found nothing, and does not when there is one', async () => {
    const utils = await open({ browse: () => [] });
    await find(utils, 'chicken, rice, saffron');
    expect(utils.getByText('Nothing used all of those. Try taking one out.')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByTestId('kitchen-clear')); });
    await find(utils, 'saffron');
    expect(utils.getByText('No recipes found for that.')).toBeTruthy();
  });

  it('can be edited and cleared to go back to the picks', async () => {
    const utils = await open({ browse: () => [rec('k1', 'Chicken Fried Rice', { used: ['chicken'], missed: [] })] });
    await find(utils, 'chicken');
    await act(async () => { fireEvent.press(utils.getByTestId('kitchen-edit')); });
    expect(utils.getByTestId('kitchen-chip-chicken')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByTestId('kitchen-cancel')); });
    await act(async () => { fireEvent.press(utils.getByTestId('kitchen-clear')); });
    await flush();
    expect(utils.queryByTestId('kitchen-banner')).toBeNull();
    expect(utils.getByTestId('hero-pick')).toBeTruthy();
  });

  it('does not come back after a search that ended it', async () => {
    const utils = await open({ browse: (p) => (p.query ? [rec('s1', 'Tomato Soup')] : [rec('k1', 'Chicken Fried Rice', { used: ['chicken'], missed: [] })]) });
    await find(utils, 'chicken');
    const input = utils.getByPlaceholderText('Search recipes...');
    fireEvent.changeText(input, 'soup');
    await act(async () => { fireEvent(input, 'submitEditing'); });
    await flush();
    expect(utils.getByTestId('recipe-card-s1')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByTestId('search-clear')); });
    await flush();
    expect(utils.queryByTestId('kitchen-banner')).toBeNull();
    expect(utils.getByTestId('hero-pick')).toBeTruthy();
  });

  it('ends when a chip is chosen', async () => {
    const utils = await open({ browse: (p) => (p.includeIngredients ? [rec('k1', 'Chicken Fried Rice', { used: ['chicken'], missed: [] })] : [rec('c1', 'Snack Plate')]) });
    await find(utils, 'chicken');
    await act(async () => { fireEvent.press(utils.getByTestId('chip-Snack')); });
    await flush();
    expect(utils.queryByTestId('kitchen-banner')).toBeNull();
    expect(utils.getByTestId('recipe-card-c1')).toBeTruthy();
  });
});

describe('opening and saving a recipe', () => {
  it('opens the preview when a card is pressed', async () => {
    const utils = await open();
    await act(async () => { fireEvent.press(utils.getByTestId('recipe-card-f0')); });
    expect(utils.getByTestId('preview-modal')).toBeTruthy();
    expect(global.__preview).toMatchObject({ recipeId: 'f0', planOnOpen: false, visible: true });
  });

  it('opens the preview ready to choose a day and meal from the top pick\'s "Add to plan"', async () => {
    const utils = await open();
    await act(async () => { fireEvent.press(utils.getByTestId('hero-plan')); });
    expect(global.__preview).toMatchObject({ recipeId: 'best', planOnOpen: true, visible: true });
  });

  it('saves from the bookmark without opening the recipe, then shows it as saved', async () => {
    const utils = await open();
    await act(async () => { fireEvent.press(utils.getByTestId('save-f0')); });
    await flush();
    expect(recipeExtractionService.getSpoonacularById).toHaveBeenCalledWith('f0');
    expect(useRecipeStore.getState().addRecipe).toHaveBeenCalledWith(expect.objectContaining({ name: 'Detail f0', sourceId: 'f0' }), 'u1');
    expect(utils.queryByTestId('preview-modal')).toBeNull();
    expect(utils.getByTestId('save-f0').props.accessibilityState.selected).toBe(true);
  });

  it('shows the bookmark busy while it saves, and ignores a second press', async () => {
    const utils = await open();
    const pending = deferred();
    recipeExtractionService.getSpoonacularById.mockImplementationOnce(() => pending.promise);
    await act(async () => { fireEvent.press(utils.getByTestId('save-f0')); });
    expect(utils.getByTestId('save-f0').props.accessibilityState.busy).toBe(true);
    await act(async () => { fireEvent.press(utils.getByTestId('save-f0')); });
    expect(recipeExtractionService.getSpoonacularById).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ name: 'Detail f0', sourceId: 'f0' }); });
    await flush();
    expect(utils.getByTestId('save-f0').props.accessibilityState.busy).toBe(false);
  });

  it('says so when the recipe could not be loaded or saved, and leaves the bookmark as it was', async () => {
    const utils = await open();
    recipeExtractionService.getSpoonacularById.mockResolvedValueOnce(null);
    await act(async () => { fireEvent.press(utils.getByTestId('save-f0')); });
    await flush();
    expect(Alert.alert).toHaveBeenCalledWith('Could not save', 'This recipe could not be loaded. Please try again.');
    expect(useRecipeStore.getState().addRecipe).not.toHaveBeenCalled();
    useRecipeStore.getState().addRecipe.mockResolvedValueOnce(null);
    await act(async () => { fireEvent.press(utils.getByTestId('save-f1')); });
    await flush();
    expect(Alert.alert).toHaveBeenCalledWith('Could not save', 'This recipe could not be saved. Please try again.');
    expect(utils.getByTestId('save-f1').props.accessibilityState.selected).toBe(false);
    recipeExtractionService.getSpoonacularById.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { fireEvent.press(utils.getByTestId('save-f2')); });
    await flush();
    expect(Alert.alert).toHaveBeenLastCalledWith('Could not save', 'This recipe could not be saved. Please try again.');
  });

  it('offers to remove an already saved recipe from its bookmark', async () => {
    const utils = await open({ saved: [{ id: 'saved-f0', name: 'Heavy Dish 0', title: 'Heavy Dish 0', sourceId: 'f0' }] });
    expect(utils.getByTestId('save-f0').props.accessibilityState.selected).toBe(true);
    await act(async () => { fireEvent.press(utils.getByTestId('save-f0')); });
    expect(recipeExtractionService.getSpoonacularById).not.toHaveBeenCalled();
    const [title, , buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Remove Recipe');
    await act(async () => { buttons.find((b) => b.text === 'Remove').onPress(); });
    expect(useRecipeStore.getState().removeRecipe).toHaveBeenCalledWith('saved-f0', 'u1');
    expect(utils.getByTestId('save-f0').props.accessibilityState.selected).toBe(false);
  });

  it('knows a recipe saved before the id was kept, by its name', async () => {
    const utils = await open({ saved: [{ id: 'old1', name: 'heavy dish 1', title: 'heavy dish 1' }] });
    expect(utils.getByTestId('save-f1').props.accessibilityState.selected).toBe(true);
  });

  it('tells the preview which saved copy a recipe is', async () => {
    await open({ saved: [{ id: 'saved-f0', name: 'Heavy Dish 0', sourceId: 'f0' }] });
    expect(global.__preview.findSaved({ sourceId: 'f0', name: 'Whatever' }).id).toBe('saved-f0');
    expect(global.__preview.findSaved({ sourceId: 'zzz', name: 'Nope' })).toBeNull();
  });

  it('takes the person to the plan from the preview', async () => {
    await open();
    global.__preview.onViewPlan('2026-10-30');
    expect(global.__push).toHaveBeenCalledWith({ pathname: '/nutrition/plan', params: { date: '2026-10-30' } });
  });
});

describe('saved recipes', () => {
  it('has no Saved row when nothing is saved', async () => {
    const utils = await open();
    expect(utils.queryByText('Saved Recipes')).toBeNull();
  });

  it('shows what is saved with the figures it has, and nothing made up for one without', async () => {
    const utils = await open({
      saved: [
        { id: 's1', title: 'Mum\'s Lasagne', calories: 640.4, protein: 33, carbs: 50, fat: 25 },
        { id: 's2', title: 'Imported Stew', calories: null, protein: null, carbs: null, fat: null },
      ],
    });
    expect(utils.getByText('Saved Recipes')).toBeTruthy();
    expect(utils.getByText('2 saved')).toBeTruthy();
    const lasagne = within(utils.getByTestId('saved-s1'));
    expect(lasagne.getByText('640 cal')).toBeTruthy();
    expect(lasagne.getByText('P 33g')).toBeTruthy();
    const stew = within(utils.getByTestId('saved-s2'));
    expect(stew.queryByText(/cal$/)).toBeNull();
    expect(stew.queryByText(/^P /)).toBeNull();
  });

  it('opens a saved recipe, which pressing it did not do before, and offers to remove it on a long press', async () => {
    const utils = await open({ saved: [{ id: 's1', title: 'Mum\'s Lasagne', calories: 640 }] });
    fireEvent.press(utils.getByTestId('saved-s1'));
    expect(global.__push).toHaveBeenCalledWith('/recipe/s1');
    fireEvent(utils.getByTestId('saved-s1'), 'longPress');
    const buttons = Alert.alert.mock.calls[0][2];
    await act(async () => { buttons.find((b) => b.text === 'Remove').onPress(); });
    expect(useRecipeStore.getState().removeRecipe).toHaveBeenCalledWith('s1', 'u1');
  });

  it('leans toward the cuisines the person saved', async () => {
    const thai = rec('thai', 'Green Thai Curry', { cal: 650, p: 36, c: 45, f: 18, health: 70, min: 30, cuisines: ['thai'] });
    const utils = await open({
      batch: { pool: [best(), thai, ...fillers(8)], postWorkout: [], mealPrep: [], quickEasy: [] },
      saved: [{ id: 's1', title: 'Pad Thai', tags: ['Thai'] }, { id: 's2', title: 'Tom Yum', tags: ['Thai'] }],
    });
    const hero = within(utils.getByTestId('hero-pick'));
    expect(hero.getByText('Green Thai Curry')).toBeTruthy();
    expect(hero.getByText('Like the thai recipes you saved')).toBeTruthy();
  });
});

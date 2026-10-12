import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 5, left: 0, right: 0 }),
}), { virtual: true });
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params || {},
  router: {
    back: (...a) => global.__router.back(...a),
    replace: (...a) => global.__router.replace(...a),
    push: (...a) => global.__router.push(...a),
  },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, rightAction, showBack }) =>
      mockReact.createElement(mockRn.View, null,
        mockReact.createElement(mockRn.Text, { testID: 'header-title' }, title),
        mockReact.createElement(mockRn.Text, { testID: 'header-back' }, String(!!showBack)),
        rightAction),
  };
});
jest.mock('@/components/GroceryListButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View, { testID: 'grocery-button' }) };
});
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(async () => undefined) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/store/nutritionStore', () => {
  const hook = () => global.__nutrition;
  hook.getState = () => global.__nutrition;
  return { useNutritionStore: hook };
});
jest.mock('@/store/recipeStore', () => ({ useRecipeStore: () => global.__recipes }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => global.__user }));

import MealPlanScreen from '../app/nutrition/plan';
import { useMealPlanStore } from '../store/mealPlanStore';

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });

// Friday Oct 9, 2026, 12:00 in New Jersey. The week is Mon Oct 5 to Sun Oct 11.
const TODAY = '2026-10-09';
const NOON = new Date('2026-10-09T16:00:00Z');

const chili = { id: 'r1', title: 'Chili', servings: 4, calories: 400, protein: 30, carbs: 40, fat: 12 };
const soup = { id: 'r2', title: 'Tomato Soup', servings: 2, calories: 200, protein: 6, carbs: 30, fat: 5 };
const plain = { id: 'r3', title: 'Mystery Stew', servings: 2, hasNutritionEstimate: false };
const oats = { id: 'f1', name: 'Oats', servingSize: '40g', calories: 150, protein: 5, carbs: 27, fat: 3 };
const water = { id: 'f2', name: 'Spring Water', servingSize: '1 glass' };

const realStart = useMealPlanStore.getState().startSync;
const plan = () => useMealPlanStore.getState();

let alert;
let startSync;

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  startSync = jest.fn();
  useMealPlanStore.setState({ entries: [], syncUid: null, startSync });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  useMealPlanStore.setState({ startSync: realStart });
});

const put = (kind, food, options) => {
  const result = kind === 'recipe' ? plan().addRecipe(food, options) : plan().addFood(food, options);
  expect(result.ok).toBe(true);
  return result.entry;
};

const open = ({ recipes = [chili, soup], user = null, params = {}, goal = 2000, list = [] } = {}) => {
  global.__params = params;
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
  global.__nutrition = { dailyGoals: goal === null ? {} : goal === 'none' ? undefined : { calories: goal }, addFoodToMeal: jest.fn() };
  global.__recipes = { savedRecipes: recipes, loadRecipes: jest.fn(), groceryList: list, generateGroceryList: jest.fn() };
  global.__user = { user };
  return render(<MealPlanScreen />);
};

const selected = (utils, id) => utils.getByTestId(id).props.accessibilityState.selected;
const buttons = (call) => alert.mock.calls[call][2];
const pressAlert = (call, text) => {
  const button = buttons(call).find((b) => b.text === text);
  expect(button).toBeTruthy();
  act(() => { button.onPress(); });
};
const entry = (id) => plan().entries.find((e) => e.id === id);
// The press handler a button had when it was drawn (what a tap in the moment before a change would run).
const handlerOf = (utils, testID) => utils.UNSAFE_getAllByProps({ testID }).find((n) => typeof n.props.onPress === 'function').props.onPress;

describe('the week', () => {
  it('opens on today, in the week that has it', () => {
    const utils = open();
    expect(utils.getByTestId('header-title').props.children).toBe('Meal Plan');
    expect(utils.getByTestId('header-back').props.children).toBe('true');
    expect(utils.getByTestId('plan-week-label').props.children).toBe('Oct 5 – 11');
    expect(utils.getByTestId('plan-day-title').props.children).toBe('Today');
    expect(selected(utils, 'plan-day-2026-10-09')).toBe(true);
    expect(selected(utils, 'plan-day-2026-10-08')).toBe(false);
    expect(utils.queryByTestId('plan-today')).toBeNull();
  });

  it('shows the seven days, Monday first', () => {
    const utils = open();
    const day = (key) => within(utils.getByTestId(`plan-day-${key}`));
    expect(day('2026-10-05').getByText('Mon')).toBeTruthy();
    expect(day('2026-10-05').getByText('5')).toBeTruthy();
    expect(day('2026-10-11').getByText('Sun')).toBeTruthy();
    expect(day('2026-10-11').getByText('11')).toBeTruthy();
    expect(utils.queryByTestId('plan-day-2026-10-04')).toBeNull();
    expect(utils.queryByTestId('plan-day-2026-10-12')).toBeNull();
  });

  it('opens on the day it is asked for', () => {
    const utils = open({ params: { date: '2026-10-07' } });
    expect(selected(utils, 'plan-day-2026-10-07')).toBe(true);
    expect(utils.getByTestId('plan-day-title').props.children).toBe('Wed, Oct 7');
  });

  it('opens on a day in another week when asked to', () => {
    const utils = open({ params: { date: '2026-10-20' } });
    expect(utils.getByTestId('plan-week-label').props.children).toBe('Oct 19 – 25');
    expect(selected(utils, 'plan-day-2026-10-20')).toBe(true);
  });

  it('takes the first one when the day is given more than once', () => {
    const utils = open({ params: { date: ['2026-10-06', '2026-10-07'] } });
    expect(selected(utils, 'plan-day-2026-10-06')).toBe(true);
  });

  it.each([['nonsense'], ['2026-02-30'], [''], [undefined]])('opens on today for the day %p', (date) => {
    const utils = open({ params: { date } });
    expect(selected(utils, 'plan-day-2026-10-09')).toBe(true);
  });

  it('picks a day', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-day-2026-10-07'));
    expect(selected(utils, 'plan-day-2026-10-07')).toBe(true);
    expect(selected(utils, 'plan-day-2026-10-09')).toBe(false);
    expect(utils.getByTestId('plan-day-title').props.children).toBe('Wed, Oct 7');
  });

  it('says Yesterday for yesterday', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-day-2026-10-08'));
    expect(utils.getByTestId('plan-day-title').props.children).toBe('Yesterday');
  });

  it('steps to the next and the previous week on the same weekday', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-next-week'));
    expect(utils.getByTestId('plan-week-label').props.children).toBe('Oct 12 – 18');
    expect(selected(utils, 'plan-day-2026-10-16')).toBe(true);
    fireEvent.press(utils.getByTestId('plan-prev-week'));
    fireEvent.press(utils.getByTestId('plan-prev-week'));
    expect(utils.getByTestId('plan-week-label').props.children).toBe('Sep 28 – Oct 4');
    expect(selected(utils, 'plan-day-2026-10-02')).toBe(true);
  });

  it('offers a way back to today from any other day, and it works', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-next-week'));
    fireEvent.press(utils.getByTestId('plan-today'));
    expect(utils.getByTestId('plan-week-label').props.children).toBe('Oct 5 – 11');
    expect(selected(utils, 'plan-day-2026-10-09')).toBe(true);
    expect(utils.queryByTestId('plan-today')).toBeNull();
  });

  it('marks the days that have something planned', () => {
    put('recipe', chili, { date: '2026-10-07', slot: 'dinner' });
    put('food', oats, { date: '2026-10-09', slot: 'breakfast' });
    const utils = open();
    expect(utils.getByTestId('plan-dot-2026-10-07')).toBeTruthy();
    expect(utils.getByTestId('plan-dot-2026-10-09')).toBeTruthy();
    expect(utils.queryByTestId('plan-dot-2026-10-08')).toBeNull();
    expect(utils.queryByTestId('plan-dot-2026-10-10')).toBeNull();
  });

  it('shows the grocery list button in the header', () => {
    expect(open().getByTestId('grocery-button')).toBeTruthy();
  });
});

describe('starting up', () => {
  it('starts the cloud sync and loads recipes for a signed-in user with none loaded', () => {
    open({ user: { uid: 'u1' }, recipes: [] });
    expect(startSync).toHaveBeenCalledWith('u1');
    expect(global.__recipes.loadRecipes).toHaveBeenCalledWith('u1');
  });

  it('does not reload recipes that are already loaded', () => {
    open({ user: { uid: 'u1' } });
    expect(startSync).toHaveBeenCalledWith('u1');
    expect(global.__recipes.loadRecipes).not.toHaveBeenCalled();
  });

  it('does nothing in the cloud with nobody signed in', () => {
    open({ user: null, recipes: [] });
    expect(startSync).not.toHaveBeenCalled();
    expect(global.__recipes.loadRecipes).not.toHaveBeenCalled();
  });
});

describe('the day at a glance', () => {
  it('says nothing is planned on an empty day', () => {
    const utils = open();
    expect(utils.getByTestId('plan-day-empty')).toBeTruthy();
    expect(utils.getByText('Nothing planned for this day yet.')).toBeTruthy();
    expect(utils.queryByTestId('plan-day-totals')).toBeNull();
    expect(utils.queryByTestId('plan-log-day')).toBeNull();
  });

  it('adds up the calories and macros for the servings planned, against the goal', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 1.5 });
    put('food', oats, { date: TODAY, slot: 'breakfast', servings: 2 });
    const utils = open();
    // 600 + 300 kcal; protein 45 + 10; carbs 60 + 54; fat 18 + 6
    expect(utils.getByTestId('plan-day-totals').props.children.join('')).toBe('900 kcal planned');
    expect(utils.getByTestId('plan-day-goal').props.children.join('')).toBe('of your 2,000 kcal goal');
    expect(utils.getByTestId('plan-day-macros').props.children.join('')).toBe('P 55g · C 114g · F 24g');
    expect(utils.queryByTestId('plan-day-empty')).toBeNull();
    expect(utils.queryByTestId('plan-day-missing')).toBeNull();
  });

  it.each([[null], [0], [-100], ['none']])('leaves the goal out when there is none (%p)', (goal) => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open({ goal });
    expect(utils.getByTestId('plan-day-totals')).toBeTruthy();
    expect(utils.queryByTestId('plan-day-goal')).toBeNull();
  });

  it('only counts the day on show', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', soup, { date: '2026-10-10', slot: 'dinner' });
    const utils = open();
    expect(utils.getByTestId('plan-day-totals').props.children.join('')).toBe('400 kcal planned');
    fireEvent.press(utils.getByTestId('plan-day-2026-10-10'));
    expect(utils.getByTestId('plan-day-totals').props.children.join('')).toBe('200 kcal planned');
  });

  it('warns that totals are low when an item has no calorie estimate', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', plain, { date: TODAY, slot: 'lunch' });
    const utils = open();
    expect(utils.getByTestId('plan-day-totals').props.children.join('')).toBe('400 kcal planned');
    expect(utils.getByTestId('plan-day-missing').props.children.join('')).toBe('1 item has no calorie estimate, so these totals are low.');
  });

  it('says "have" when more than one item has no estimate', () => {
    put('recipe', plain, { date: TODAY, slot: 'lunch' });
    put('food', water, { date: TODAY, slot: 'snack' });
    const utils = open();
    expect(utils.getByTestId('plan-day-missing').props.children.join('')).toBe('2 items have no calorie estimate, so these totals are low.');
  });
});

describe('the four meals', () => {
  it('lists the meals in order, each with an Add button', () => {
    const utils = open();
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach((id) => {
      expect(utils.getByTestId(`plan-slot-${id}`)).toBeTruthy();
      expect(utils.getByTestId(`plan-add-${id}`)).toBeTruthy();
    });
    expect(utils.getByLabelText('Add to Breakfast')).toBeTruthy();
    expect(utils.getByLabelText('Add to Snack')).toBeTruthy();
    ['Breakfast', 'Lunch', 'Dinner', 'Snack'].forEach((name) => expect(utils.getByText(name)).toBeTruthy());
  });

  it('shows each item in its own meal, with servings and calories', () => {
    const a = put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 1.5 });
    const b = put('food', oats, { date: TODAY, slot: 'breakfast' });
    put('recipe', soup, { date: '2026-10-10', slot: 'lunch' });
    const utils = open();
    const dinner = within(utils.getByTestId('plan-slot-dinner'));
    expect(dinner.getByText('Chili')).toBeTruthy();
    expect(dinner.getByText('1.5 servings · 600 kcal')).toBeTruthy();
    expect(within(utils.getByTestId('plan-slot-breakfast')).getByText('Oats')).toBeTruthy();
    expect(within(utils.getByTestId('plan-slot-breakfast')).getByText('1 serving · 150 kcal')).toBeTruthy();
    expect(utils.queryByText('Tomato Soup')).toBeNull();
    expect(within(utils.getByTestId(`plan-entry-${a.id}`)).getByText('Chili')).toBeTruthy();
    expect(within(utils.getByTestId(`plan-entry-${b.id}`)).getByText('Oats')).toBeTruthy();
  });

  it('shows what each meal adds up to, only when it has something in it', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', soup, { date: TODAY, slot: 'dinner', servings: 2 });
    const utils = open();
    expect(within(utils.getByTestId('plan-slot-dinner')).getByText('800 kcal')).toBeTruthy();
    expect(within(utils.getByTestId('plan-slot-lunch')).queryByText(/kcal/)).toBeNull();
  });

  it('says there is no calorie estimate on the item and leaves a made-up 0 kcal off its meal', () => {
    put('recipe', plain, { date: TODAY, slot: 'lunch' });
    const utils = open();
    const lunch = within(utils.getByTestId('plan-slot-lunch'));
    expect(lunch.getByText('1 serving · no calorie estimate')).toBeTruthy();
    expect(lunch.queryByText(/kcal/)).toBeNull();
  });

  it('adds up the meal from the items that have an estimate', () => {
    put('recipe', plain, { date: TODAY, slot: 'lunch' });
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    const utils = open();
    expect(within(utils.getByTestId('plan-slot-lunch')).getByText('200 kcal')).toBeTruthy();
  });

  it('opens a planned recipe, but not a planned food', () => {
    const r = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const f = put('food', oats, { date: TODAY, slot: 'breakfast' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-open-${r.id}`));
    expect(global.__router.push).toHaveBeenCalledWith('/recipe/r1');
    expect(utils.queryByTestId(`plan-entry-open-${f.id}`)).toBeNull();
  });
});

describe('servings', () => {
  it('raises and lowers the servings by half, and the calories follow', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-plus-${e.id}`));
    expect(entry(e.id).servings).toBe(1.5);
    expect(utils.getByText('1.5 servings · 600 kcal')).toBeTruthy();
    fireEvent.press(utils.getByTestId(`plan-entry-plus-${e.id}`));
    expect(entry(e.id).servings).toBe(2);
    fireEvent.press(utils.getByTestId(`plan-entry-minus-${e.id}`));
    fireEvent.press(utils.getByTestId(`plan-entry-minus-${e.id}`));
    expect(entry(e.id).servings).toBe(1);
    expect(utils.getByText('1 serving · 400 kcal')).toBeTruthy();
    expect(utils.getByTestId('plan-day-totals').props.children.join('')).toBe('400 kcal planned');
  });

  it('cannot go below half a serving', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 0.5 });
    const utils = open();
    expect(utils.getByTestId(`plan-entry-minus-${e.id}`).props.accessibilityState.disabled).toBe(true);
    expect(utils.getByTestId(`plan-entry-plus-${e.id}`).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(utils.getByTestId(`plan-entry-minus-${e.id}`));
    expect(entry(e.id).servings).toBe(0.5);
  });

  it('cannot go above 20 servings', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 20 });
    const utils = open();
    expect(utils.getByTestId(`plan-entry-plus-${e.id}`).props.accessibilityState.disabled).toBe(true);
    expect(utils.getByTestId(`plan-entry-minus-${e.id}`).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(utils.getByTestId(`plan-entry-plus-${e.id}`));
    expect(entry(e.id).servings).toBe(20);
  });

  it('can still be changed just inside either limit', () => {
    const low = put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 1 });
    const high = put('recipe', soup, { date: TODAY, slot: 'lunch', servings: 19.5 });
    const utils = open();
    expect(utils.getByTestId(`plan-entry-minus-${low.id}`).props.accessibilityState.disabled).toBe(false);
    expect(utils.getByTestId(`plan-entry-plus-${high.id}`).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(utils.getByTestId(`plan-entry-plus-${high.id}`));
    expect(entry(high.id).servings).toBe(20);
  });

  it('labels the buttons for a screen reader', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    expect(utils.getByTestId(`plan-entry-minus-${e.id}`).props.accessibilityLabel).toBe('Fewer servings');
    expect(utils.getByTestId(`plan-entry-plus-${e.id}`).props.accessibilityLabel).toBe('More servings');
  });
});

describe('logging', () => {
  it('logs one item into the diary on its day and meal, and shows it as logged', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 2 });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-log-${e.id}`));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(1);
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledWith(TODAY, 'dinner', expect.objectContaining({ name: 'Chili', calories: 800, quantity: 2 }));
    expect(entry(e.id).loggedAt).toBeTruthy();
    expect(utils.getByTestId(`plan-entry-logged-${e.id}`).props.children).toBe('Logged');
    expect(utils.queryByTestId(`plan-entry-log-${e.id}`)).toBeNull();
    expect(utils.queryByTestId(`plan-entry-plus-${e.id}`)).toBeNull();
    expect(utils.queryByTestId(`plan-entry-minus-${e.id}`)).toBeNull();
    expect(alert).not.toHaveBeenCalled();
  });

  it('offers Log for today and earlier days, not for later ones', () => {
    const past = put('recipe', chili, { date: '2026-10-08', slot: 'dinner' });
    const now = put('recipe', soup, { date: TODAY, slot: 'dinner' });
    const later = put('food', oats, { date: '2026-10-10', slot: 'breakfast' });
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-day-2026-10-08'));
    expect(utils.getByTestId(`plan-entry-log-${past.id}`)).toBeTruthy();
    fireEvent.press(utils.getByTestId('plan-day-2026-10-09'));
    expect(utils.getByTestId(`plan-entry-log-${now.id}`)).toBeTruthy();
    fireEvent.press(utils.getByTestId('plan-day-2026-10-10'));
    expect(utils.queryByTestId(`plan-entry-log-${later.id}`)).toBeNull();
    // A later day's item can still have its servings changed.
    expect(utils.getByTestId(`plan-entry-plus-${later.id}`)).toBeTruthy();
  });

  it('logs a missed day on that day, not today', () => {
    const e = put('recipe', chili, { date: '2026-10-07', slot: 'lunch' });
    const utils = open({ params: { date: '2026-10-07' } });
    fireEvent.press(utils.getByTestId(`plan-entry-log-${e.id}`));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledWith('2026-10-07', 'lunch', expect.any(Object));
  });

  it('says so, and logs nothing more, when the item was already logged', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    const press = handlerOf(utils, `plan-entry-log-${e.id}`);
    act(() => { plan().markLogged(e.id); });
    act(() => { press(); });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Could not log', 'This one is already logged.');
  });

  it('says so when the item is gone', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    const press = handlerOf(utils, `plan-entry-log-${e.id}`);
    act(() => { plan().removeEntry(e.id); });
    act(() => { press(); });
    expect(alert).toHaveBeenCalledWith('Could not log', 'This item is no longer in your plan.');
  });

  it('logs everything loggable on the day in one go, then offers to show the diary', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('food', oats, { date: TODAY, slot: 'breakfast' });
    const done = put('recipe', soup, { date: TODAY, slot: 'lunch' });
    put('food', water, { date: '2026-10-10', slot: 'snack' });
    const utils = open();
    act(() => { plan().markLogged(done.id); });
    expect(within(utils.getByTestId('plan-log-day')).getByText('Log everything planned (2)')).toBeTruthy();
    fireEvent.press(utils.getByTestId('plan-log-day'));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(2);
    expect(plan().entries.filter((e) => e.date === TODAY).every((e) => e.loggedAt)).toBe(true);
    expect(plan().entries.find((e) => e.date === '2026-10-10').loggedAt).toBeUndefined();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Logged');
    expect(alert.mock.calls[0][1]).toBe('2 items added to your diary.');
    pressAlert(0, 'View');
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition', params: { date: TODAY } });
    expect(utils.queryByTestId('plan-log-day')).toBeNull();
  });

  it('says "1 item" for one', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-log-day'));
    expect(alert.mock.calls[0][1]).toBe('1 item added to your diary.');
  });

  it('has nothing to log everything for on a later day or when it is all logged', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('food', oats, { date: '2026-10-10', slot: 'breakfast' });
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-day-2026-10-10'));
    expect(utils.queryByTestId('plan-log-day')).toBeNull();
    fireEvent.press(utils.getByTestId('plan-day-2026-10-09'));
    act(() => { plan().markLogged(e.id); });
    expect(utils.queryByTestId('plan-log-day')).toBeNull();
  });
});

describe('the item menu', () => {
  it('offers move, copy and remove for an item not yet logged', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    expect(utils.getByLabelText('Options for Chili')).toBeTruthy();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    expect(alert.mock.calls[0][0]).toBe('Chili');
    expect(buttons(0).map((b) => b.text)).toEqual(['Move to another day', 'Copy to another day', 'Remove', 'Cancel']);
    expect(buttons(0).find((b) => b.text === 'Remove').style).toBe('destructive');
    expect(buttons(0).find((b) => b.text === 'Cancel').style).toBe('cancel');
  });

  it('offers only remove for a logged item, which stays where it was eaten', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    act(() => { plan().markLogged(e.id); });
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    expect(buttons(0).map((b) => b.text)).toEqual(['Remove', 'Cancel']);
  });

  it('removes the item', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const keep = put('food', oats, { date: TODAY, slot: 'breakfast' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Remove');
    expect(plan().entries.map((x) => x.id)).toEqual([keep.id]);
    expect(utils.queryByText('Chili')).toBeNull();
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
  });

  it('moves the item to the day and meal picked, and follows it there', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Move to another day');
    expect(utils.getByText('Move Chili')).toBeTruthy();
    // The sheet starts on where the item is now.
    expect(selected(utils, 'plan-target-day-2026-10-09')).toBe(true);
    expect(selected(utils, 'plan-target-slot-dinner')).toBe(true);
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-14'));
    fireEvent.press(utils.getByTestId('plan-target-slot-lunch'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(entry(e.id)).toMatchObject({ date: '2026-10-14', slot: 'lunch' });
    expect(plan().entries).toHaveLength(1);
    expect(utils.queryByTestId('plan-target-sheet')).toBeNull();
    expect(utils.getByTestId('plan-week-label').props.children).toBe('Oct 12 – 18');
    expect(selected(utils, 'plan-day-2026-10-14')).toBe(true);
    expect(within(utils.getByTestId('plan-slot-lunch')).getByText('Chili')).toBeTruthy();
  });

  it('copies the item to the day and meal picked, leaving the original', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 2 });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Copy to another day');
    expect(utils.getByText('Copy Chili')).toBeTruthy();
    expect(within(utils.getByTestId('plan-target-confirm')).getByText('Copy')).toBeTruthy();
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-10'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(plan().entries).toHaveLength(2);
    expect(entry(e.id)).toMatchObject({ date: TODAY, slot: 'dinner' });
    const copy = plan().entries.find((x) => x.id !== e.id);
    expect(copy).toMatchObject({ date: '2026-10-10', slot: 'dinner', servings: 2, name: 'Chili' });
    expect(selected(utils, 'plan-day-2026-10-10')).toBe(true);
  });

  it('labels the move button Move', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Move to another day');
    expect(within(utils.getByTestId('plan-target-confirm')).getByText('Move')).toBeTruthy();
  });

  it('closes the sheet without changing anything on Cancel', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Move to another day');
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-14'));
    fireEvent.press(utils.getByTestId('plan-target-cancel'));
    expect(utils.queryByTestId('plan-target-sheet')).toBeNull();
    expect(entry(e.id)).toMatchObject({ date: TODAY, slot: 'dinner' });
    expect(selected(utils, 'plan-day-2026-10-09')).toBe(true);
  });

  it('says why when the meal picked is full, and leaves the sheet open', () => {
    for (let i = 0; i < 10; i += 1) put('food', oats, { date: '2026-10-10', slot: 'lunch' });
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Move to another day');
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-10'));
    fireEvent.press(utils.getByTestId('plan-target-slot-lunch'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert.mock.calls[1]).toEqual(['Could not do that', 'Lunch already has 10 items on that day.']);
    expect(utils.getByTestId('plan-target-sheet')).toBeTruthy();
    expect(entry(e.id)).toMatchObject({ date: TODAY, slot: 'dinner' });
    expect(selected(utils, 'plan-day-2026-10-09')).toBe(true);
  });

  it('says why when the copy cannot be made, and leaves the sheet open', () => {
    for (let i = 0; i < 10; i += 1) put('food', oats, { date: '2026-10-10', slot: 'lunch' });
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Copy to another day');
    fireEvent.press(utils.getByTestId('plan-target-day-2026-10-10'));
    fireEvent.press(utils.getByTestId('plan-target-slot-lunch'));
    fireEvent.press(utils.getByTestId('plan-target-confirm'));
    expect(alert.mock.calls[1]).toEqual(['Could not do that', 'Lunch already has 10 items on that day.']);
    expect(utils.getByTestId('plan-target-sheet')).toBeTruthy();
    expect(plan().entries).toHaveLength(11);
  });
});

describe('adding a recipe', () => {
  const openAdd = (slot = 'dinner', options) => {
    const utils = open(options);
    fireEvent.press(utils.getByTestId(`plan-add-${slot}`));
    return utils;
  };

  it('opens the sheet for that meal and day, on the recipes', () => {
    const utils = openAdd('dinner');
    expect(utils.getByText('Add to Dinner · Today')).toBeTruthy();
    expect(selected(utils, 'plan-add-tab-recipes')).toBe(true);
    expect(selected(utils, 'plan-add-tab-foods')).toBe(false);
    expect(utils.getByTestId('plan-add-recipe-r1')).toBeTruthy();
    expect(utils.getByTestId('plan-add-recipe-r2')).toBeTruthy();
  });

  it('names the day it is adding to', () => {
    const utils = open({ params: { date: '2026-10-07' } });
    fireEvent.press(utils.getByTestId('plan-add-snack'));
    expect(utils.getByText('Add to Snack · Wed, Oct 7')).toBeTruthy();
  });

  it('shows the calories per serving, or that there is no estimate', () => {
    const utils = openAdd('dinner', { recipes: [chili, plain] });
    expect(within(utils.getByTestId('plan-add-recipe-r1')).getByText('400 kcal per serving')).toBeTruthy();
    expect(within(utils.getByTestId('plan-add-recipe-r3')).getByText('no calorie estimate')).toBeTruthy();
  });

  it('shows a recipe with no calories listed as having no estimate', () => {
    const utils = openAdd('dinner', { recipes: [{ id: 'r9', title: 'Bare Bones', servings: 2 }] });
    expect(within(utils.getByTestId('plan-add-recipe-r9')).getByText('no calorie estimate')).toBeTruthy();
  });

  it('adds the recipe to the day and meal, one serving, and closes the sheet', () => {
    const utils = openAdd('dinner');
    fireEvent.press(utils.getByTestId('plan-add-recipe-r2'));
    expect(plan().entries).toHaveLength(1);
    expect(plan().entries[0]).toMatchObject({ kind: 'recipe', refId: 'r2', name: 'Tomato Soup', date: TODAY, slot: 'dinner', servings: 1 });
    expect(utils.queryByTestId('plan-add-sheet')).toBeNull();
    expect(within(utils.getByTestId('plan-slot-dinner')).getByText('Tomato Soup')).toBeTruthy();
  });

  it('adds to the day on show, not today', () => {
    const utils = open({ params: { date: '2026-10-11' } });
    fireEvent.press(utils.getByTestId('plan-add-lunch'));
    fireEvent.press(utils.getByTestId('plan-add-recipe-r1'));
    expect(plan().entries[0]).toMatchObject({ date: '2026-10-11', slot: 'lunch' });
  });

  it('can add the same recipe again', () => {
    const utils = openAdd('dinner');
    fireEvent.press(utils.getByTestId('plan-add-recipe-r1'));
    fireEvent.press(utils.getByTestId('plan-add-dinner'));
    fireEvent.press(utils.getByTestId('plan-add-recipe-r1'));
    expect(plan().entries).toHaveLength(2);
  });

  it('filters the recipes by what is typed, ignoring case and spaces around it', () => {
    const utils = openAdd('dinner');
    fireEvent.changeText(utils.getByTestId('plan-add-search'), '  TOMATO ');
    expect(utils.queryByTestId('plan-add-recipe-r1')).toBeNull();
    expect(utils.getByTestId('plan-add-recipe-r2')).toBeTruthy();
    fireEvent.changeText(utils.getByTestId('plan-add-search'), '');
    expect(utils.getByTestId('plan-add-recipe-r1')).toBeTruthy();
  });

  it('says when no recipe matches', () => {
    const utils = openAdd('dinner');
    fireEvent.changeText(utils.getByTestId('plan-add-search'), 'pizza');
    expect(utils.getByTestId('plan-add-empty').props.children).toBe('No saved recipe matches that.');
  });

  it('says when there are no saved recipes at all', () => {
    const utils = openAdd('dinner', { recipes: [] });
    expect(utils.getByTestId('plan-add-empty').props.children).toBe('You have no saved recipes yet. Save one from Recipes, or add a food instead.');
  });

  it('copes with a recipe list that is not a list', () => {
    const utils = openAdd('dinner', { recipes: null });
    expect(utils.getByTestId('plan-add-empty').props.children).toMatch(/no saved recipes yet/);
  });

  it('finds recipes that carry a name instead of a title', () => {
    const utils = openAdd('dinner', { recipes: [{ id: 'r7', name: 'Pad Thai', servings: 2, calories: 500 }] });
    expect(within(utils.getByTestId('plan-add-recipe-r7')).getByText('Pad Thai')).toBeTruthy();
    fireEvent.changeText(utils.getByTestId('plan-add-search'), 'thai');
    expect(utils.getByTestId('plan-add-recipe-r7')).toBeTruthy();
  });

  it('says why when the meal is full, and keeps the sheet open', () => {
    for (let i = 0; i < 10; i += 1) put('food', oats, { date: TODAY, slot: 'dinner' });
    const utils = openAdd('dinner');
    fireEvent.press(utils.getByTestId('plan-add-recipe-r1'));
    expect(alert).toHaveBeenCalledWith('Could not do that', 'Dinner already has 10 items on that day.');
    expect(plan().entries).toHaveLength(10);
    expect(utils.getByTestId('plan-add-sheet')).toBeTruthy();
  });

  it('closes on Close and adds nothing', () => {
    const utils = openAdd('dinner');
    fireEvent.press(utils.getByTestId('plan-add-close'));
    expect(utils.queryByTestId('plan-add-sheet')).toBeNull();
    expect(plan().entries).toHaveLength(0);
  });
});

describe('adding a food', () => {
  it('sends you to the food search for that day and meal, and closes the sheet', () => {
    const utils = open({ params: { date: '2026-10-10' } });
    fireEvent.press(utils.getByTestId('plan-add-breakfast'));
    fireEvent.press(utils.getByTestId('plan-add-tab-foods'));
    expect(selected(utils, 'plan-add-tab-foods')).toBe(true);
    expect(utils.queryByTestId('plan-add-search')).toBeNull();
    fireEvent.press(utils.getByTestId('plan-add-find-food'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/search', params: { mealId: 'breakfast', planDate: '2026-10-10' } });
    expect(utils.queryByTestId('plan-add-sheet')).toBeNull();
  });

  it('goes back to the recipes', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('plan-add-dinner'));
    fireEvent.press(utils.getByTestId('plan-add-tab-foods'));
    fireEvent.press(utils.getByTestId('plan-add-tab-recipes'));
    expect(utils.getByTestId('plan-add-recipe-r1')).toBeTruthy();
    expect(utils.queryByTestId('plan-add-find-food')).toBeNull();
  });
});

describe('the grocery list', () => {
  const press = (utils) => fireEvent.press(utils.getByTestId('plan-groceries'));

  it('explains what the button does', () => {
    const utils = open();
    expect(utils.getByText("Add this week's ingredients to the grocery list")).toBeTruthy();
    expect(utils.getByText('Counts the recipes planned from today to the end of this week, for the servings planned.')).toBeTruthy();
  });

  it('says there is nothing to shop for when no recipes are planned', () => {
    put('food', oats, { date: TODAY, slot: 'breakfast' });
    const utils = open();
    press(utils);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Nothing to shop for', 'No saved recipes are planned for the rest of this week.');
    expect(global.__recipes.generateGroceryList).not.toHaveBeenCalled();
  });

  it('asks first, then adds the ingredients scaled to the servings planned', () => {
    // 4 + 2 servings of a 4-serving recipe is 1.5x; 3 servings of a 2-serving recipe is 1.5x
    put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 4 });
    put('recipe', chili, { date: '2026-10-11', slot: 'dinner', servings: 2 });
    put('recipe', soup, { date: '2026-10-10', slot: 'lunch', servings: 3 });
    const utils = open();
    press(utils);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Add to grocery list');
    expect(alert.mock.calls[0][1]).toBe('Add the ingredients for 3 planned meals (2 recipes) to your grocery list, for the servings planned?');
    expect(global.__recipes.generateGroceryList).not.toHaveBeenCalled();
    pressAlert(0, 'Add');
    expect(global.__recipes.generateGroceryList).toHaveBeenCalledTimes(1);
    expect(global.__recipes.generateGroceryList).toHaveBeenCalledWith(['r1', 'r2'], { r1: 1.5, r2: 1.5 });
  });

  it('adds nothing on Cancel', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    press(utils);
    expect(buttons(0).map((b) => b.text)).toEqual(['Cancel', 'Add']);
    expect(buttons(0)[0].onPress).toBeUndefined();
    expect(global.__recipes.generateGroceryList).not.toHaveBeenCalled();
  });

  it('says "1 planned meal (1 recipe)" for one', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    press(utils);
    expect(alert.mock.calls[0][1]).toBe('Add the ingredients for 1 planned meal (1 recipe) to your grocery list, for the servings planned?');
  });

  it('shops for the week on show, from today on, and leaves out earlier days and meals eaten', () => {
    put('recipe', chili, { date: '2026-10-07', slot: 'dinner' });
    const eaten = put('recipe', soup, { date: TODAY, slot: 'lunch' });
    put('recipe', chili, { date: '2026-10-12', slot: 'dinner' });
    const utils = open();
    act(() => { plan().markLogged(eaten.id); });
    press(utils);
    expect(alert.mock.calls[0][0]).toBe('Nothing to shop for');
    fireEvent.press(utils.getByTestId('plan-next-week'));
    alert.mockClear();
    press(utils);
    expect(alert.mock.calls[0][0]).toBe('Add to grocery list');
    pressAlert(0, 'Add');
    expect(global.__recipes.generateGroceryList).toHaveBeenCalledWith(['r1'], { r1: 0.25 });
  });

  it('says so when the recipes are all on the list already', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open({ list: [{ id: 'g1', name: 'beans', recipeIds: ['r1'] }] });
    press(utils);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Already on your list', 'The recipes planned for the rest of this week are already on your grocery list.');
    expect(global.__recipes.generateGroceryList).not.toHaveBeenCalled();
  });

  it('tells you which recipes will be skipped because they are on the list already', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    const utils = open({ list: [{ id: 'g1', name: 'beans', recipeIds: ['r1'] }] });
    press(utils);
    expect(alert.mock.calls[0][1]).toBe('Add the ingredients for 2 planned meals (1 recipe) to your grocery list, for the servings planned? 1 recipe already on your list will be skipped.');
    pressAlert(0, 'Add');
    expect(global.__recipes.generateGroceryList).toHaveBeenCalledWith(['r1', 'r2'], expect.any(Object));
  });

  it('says how many recipes are skipped', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    put('recipe', { ...chili, id: 'r4', title: 'Curry' }, { date: TODAY, slot: 'snack' });
    const utils = open({
      recipes: [chili, soup, { ...chili, id: 'r4', title: 'Curry' }],
      list: [{ id: 'g1', recipeIds: ['r1', 'r2'] }],
    });
    press(utils);
    expect(alert.mock.calls[0][1]).toContain('(1 recipe)');
    expect(alert.mock.calls[0][1]).toContain('2 recipes already on your list will be skipped.');
  });

  it('names planned recipes that are no longer saved and leaves them out', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    const utils = open({ recipes: [chili] });
    press(utils);
    expect(alert.mock.calls[0][1]).toBe('Add the ingredients for 1 planned meal (1 recipe) to your grocery list, for the servings planned? 1 planned recipe no longer saved was left out: Tomato Soup.');
    pressAlert(0, 'Add');
    expect(global.__recipes.generateGroceryList).toHaveBeenCalledWith(['r1'], { r1: 0.25 });
  });

  it('names them when nothing else is left to shop for', () => {
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    const utils = open({ recipes: [] });
    press(utils);
    expect(alert).toHaveBeenCalledWith('Nothing to shop for', 'No saved recipes are planned for the rest of this week. 1 planned recipe no longer saved was left out: Tomato Soup.');
  });

  it('names them when what is left is on the list already', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    const utils = open({ recipes: [chili], list: [{ id: 'g1', recipeIds: ['r1'] }] });
    press(utils);
    expect(alert).toHaveBeenCalledWith(
      'Already on your list',
      'The recipes planned for the rest of this week are already on your grocery list. 1 planned recipe no longer saved was left out: Tomato Soup.'
    );
  });

  it('says "2 planned recipes ... were left out" when two are gone', () => {
    put('recipe', chili, { date: TODAY, slot: 'dinner' });
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    const utils = open({ recipes: [] });
    press(utils);
    expect(alert.mock.calls[0][1]).toContain('2 planned recipes no longer saved were left out: Chili, Tomato Soup.');
  });
});

describe('details of logging and the item menu', () => {
  it('logs everything on a day that has passed, on that day, and shows that day\'s diary', () => {
    put('recipe', chili, { date: '2026-10-08', slot: 'dinner' });
    put('food', oats, { date: '2026-10-08', slot: 'breakfast' });
    put('recipe', soup, { date: TODAY, slot: 'lunch' });
    const utils = open({ params: { date: '2026-10-08' } });
    expect(within(utils.getByTestId('plan-log-day')).getByText('Log everything planned (2)')).toBeTruthy();
    fireEvent.press(utils.getByTestId('plan-log-day'));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(2);
    expect(global.__nutrition.addFoodToMeal.mock.calls.map(([date]) => date)).toEqual(['2026-10-08', '2026-10-08']);
    expect(plan().entries.find((e) => e.date === TODAY).loggedAt).toBeUndefined();
    expect(buttons(0).map((b) => b.text)).toEqual(['View', 'OK']);
    expect(buttons(0).find((b) => b.text === 'OK').style).toBe('cancel');
    pressAlert(0, 'View');
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition', params: { date: '2026-10-08' } });
  });

  it('says "0 items" when everything was logged in the meantime', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    const press = handlerOf(utils, 'plan-log-day');
    act(() => { plan().markLogged(e.id); });
    act(() => { press(); });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][1]).toBe('0 items added to your diary.');
  });

  it('greys out the name of an item once it is logged', () => {
    const e = put('recipe', chili, { date: TODAY, slot: 'dinner' });
    const utils = open();
    const color = () => StyleSheet.flatten(utils.getByText('Chili').props.style).color;
    expect(color()).toBe('#000000');
    act(() => { plan().markLogged(e.id); });
    expect(color()).toBe('#999999');
  });

  it('fades the servings button that cannot be used', () => {
    // Read on the first render: a button animates its opacity when it is disabled later.
    const low = put('recipe', chili, { date: TODAY, slot: 'dinner', servings: 0.5 });
    const high = put('recipe', chili, { date: TODAY, slot: 'lunch', servings: 20 });
    const utils = open();
    const opacity = (id) => StyleSheet.flatten(utils.getByTestId(id).props.style).opacity;
    expect(opacity(`plan-entry-minus-${low.id}`)).toBe(0.3);
    expect(opacity(`plan-entry-plus-${low.id}`)).toBe(1);
    expect(opacity(`plan-entry-minus-${high.id}`)).toBe(1);
    expect(opacity(`plan-entry-plus-${high.id}`)).toBe(0.3);
  });

  it('starts the move sheet on the item\'s own day and meal', () => {
    const e = put('recipe', chili, { date: '2026-10-10', slot: 'lunch' });
    const utils = open({ params: { date: '2026-10-10' } });
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Move to another day');
    expect(selected(utils, 'plan-target-day-2026-10-10')).toBe(true);
    expect(selected(utils, 'plan-target-slot-lunch')).toBe(true);
    expect(selected(utils, 'plan-target-slot-dinner')).toBe(false);
  });

  it('starts the copy sheet on the item\'s own day and meal', () => {
    const e = put('food', oats, { date: '2026-10-11', slot: 'snack' });
    const utils = open({ params: { date: '2026-10-11' } });
    fireEvent.press(utils.getByTestId(`plan-entry-menu-${e.id}`));
    pressAlert(0, 'Copy to another day');
    expect(selected(utils, 'plan-target-day-2026-10-11')).toBe(true);
    expect(selected(utils, 'plan-target-slot-snack')).toBe(true);
  });
});

describe('details of the recipe list when adding', () => {
  it('rounds the calories and treats a recipe marked as having no estimate as having none', () => {
    const flagged = { id: 'r5', title: 'Flagged', servings: 2, calories: 300, hasNutritionEstimate: false };
    const fractional = { id: 'r6', title: 'Fractional', servings: 2, calories: 412.6 };
    const utils = open({ recipes: [flagged, fractional] });
    fireEvent.press(utils.getByTestId('plan-add-dinner'));
    expect(within(utils.getByTestId('plan-add-recipe-r5')).getByText('no calorie estimate')).toBeTruthy();
    expect(within(utils.getByTestId('plan-add-recipe-r6')).getByText('413 kcal per serving')).toBeTruthy();
  });
});

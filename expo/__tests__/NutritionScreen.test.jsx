import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const Plain = ({ children }) => mockReact.createElement(mockRn.View, null, children);
  return { __esModule: true, default: Plain, Svg: Plain, Circle: Plain };
}, { virtual: true });
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params || {},
  router: {
    back: (...a) => global.__router.back(...a),
    replace: (...a) => global.__router.replace(...a),
    push: (...a) => global.__router.push(...a),
    canGoBack: () => global.__router.canGoBack(),
  },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ rightAction }) => mockReact.createElement(mockRn.View, null, rightAction),
  };
});
jest.mock('@/components/BottomNavigation', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View) };
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
jest.mock('@/store/nutritionStore', () => {
  const hook = () => global.__nutrition;
  hook.getState = () => global.__nutrition;
  return { useNutritionStore: hook };
});
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user ?? null }) }));
jest.mock('@/store/healthStore', () => ({
  useHealthStore: () => ({
    hydration: { glasses: global.__glasses ?? 2, target: 8 },
    addGlass: (...a) => global.__addGlass(...a),
    removeGlass: (...a) => global.__removeGlass(...a),
  }),
}));
jest.mock('@/store/workoutStore', () => {
  const hook = () => ({});
  hook.getState = () => ({ completedWorkouts: [] });
  return { useWorkoutStore: hook };
});
jest.mock('@/lib/userProfileData', () => ({ getGoalLabels: () => [], profileForNutrition: (p) => p }));
jest.mock('@/services/coachSnapshotService', () => ({
  getProfileFromStores: () => ({}),
  loadSnapshotSources: async () => {},
}));

import NutritionScreen from '../app/nutrition';

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });

// 9:30 PM on Oct 8 in New Jersey is already Oct 9 in UTC.
const EVENING = new Date('2026-10-09T01:30:00Z');
beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  global.__glasses = 2;
  global.__addGlass = jest.fn();
  global.__removeGlass = jest.fn();
});
afterEach(() => { jest.useRealTimers(); delete global.__glasses; delete global.__addGlass; delete global.__removeGlass; delete global.__user; });

const open = (meals = [], extra = {}, params = {}) => {
  global.__params = params;
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__nutrition = {
    meals,
    dailyGoals: { calories: 2000 },
    loadNutritionData: jest.fn(),
    setSyncUid: jest.fn(),
    shouldRefreshDailyGoals: () => false,
    getMealsByDate: jest.fn((d) => meals.filter((m) => m.date === d)),
    copyMealFoods: jest.fn(() => 2),
    ...extra,
  };
  return render(<NutritionScreen />);
};

const oats = { id: 'oats', logId: 'oats-aaa', name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5 };
const oats2 = { id: 'oats', logId: 'oats-bbb', name: 'Oats', calories: 150, protein: 5, carbs: 25, fat: 2 };

describe('which day the diary shows', () => {
  it('uses the local calendar day in the evening, not the UTC one', () => {
    open([]);
    expect(global.__nutrition.getMealsByDate).toHaveBeenCalledWith('2026-10-08');
    expect(global.__nutrition.getMealsByDate).not.toHaveBeenCalledWith('2026-10-09');
  });

  it('shows food logged this evening under Today, with hydration', () => {
    const utils = open([{ id: 'dinner', date: '2026-10-08', name: 'Dinner', foods: [oats] }]);
    expect(utils.getByText('Today')).toBeTruthy();
    expect(utils.getByText('Oats')).toBeTruthy();
    expect(utils.getByText('Hydration')).toBeTruthy();
    // 2000 goal - 300 eaten
    expect(utils.getByText('1700')).toBeTruthy();
  });

  it('steps back to the previous local day', () => {
    const utils = open([]);
    fireEvent.press(utils.UNSAFE_getByType('ChevronLeft'));
    expect(utils.getByText('Yesterday')).toBeTruthy();
    expect(global.__nutrition.getMealsByDate).toHaveBeenLastCalledWith('2026-10-07');
    expect(utils.queryByText('Hydration')).toBeNull();
  });
});

describe('the water card', () => {
  it('adds a glass from the Add Glass button, and takes nothing off', () => {
    const utils = open([]);
    fireEvent.press(utils.getByTestId('hydration-add'));
    expect(global.__addGlass).toHaveBeenCalledTimes(1);
    expect(global.__removeGlass).not.toHaveBeenCalled();
  });

  it('takes a glass off, for one added by mistake, from the Remove Glass button', () => {
    const utils = open([]);
    expect(utils.getByText('Remove Glass')).toBeTruthy();
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(global.__removeGlass).toHaveBeenCalledTimes(1);
    expect(global.__addGlass).not.toHaveBeenCalled();
  });

  it('switches Remove Glass off when there is nothing to take off', () => {
    global.__glasses = 0;
    const utils = open([]);
    expect(utils.getByTestId('hydration-remove').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(global.__removeGlass).not.toHaveBeenCalled();
  });

  it('leaves Remove Glass on while there is at least one glass', () => {
    global.__glasses = 1;
    const utils = open([]);
    expect(utils.getByTestId('hydration-remove').props.accessibilityState.disabled).toBe(false);
  });

  it('labels the Remove Glass button for screen readers', () => {
    expect(open([]).getByLabelText('Remove a glass of water')).toBeTruthy();
  });

  it('greys the Remove Glass button out at 0 and not otherwise', () => {
    const opacityOf = (utils) => StyleSheet.flatten(utils.UNSAFE_getAllByProps({ testID: 'hydration-remove' })[0].props.style).opacity;
    global.__glasses = 0;
    expect(opacityOf(open([]))).toBe(0.35);
    global.__glasses = 2;
    expect(opacityOf(open([]))).toBeUndefined();
  });

  it('saves for the signed-in person, whichever way the count goes', () => {
    global.__user = { uid: 'u1' };
    const utils = open([]);
    fireEvent.press(utils.getByTestId('hydration-add'));
    fireEvent.press(utils.getByTestId('hydration-remove'));
    expect(global.__addGlass).toHaveBeenCalledWith('u1');
    expect(global.__removeGlass).toHaveBeenCalledWith('u1');
  });
});

describe('food rows', () => {
  it('opens a logged entry by its own log id', () => {
    const utils = open([{ id: 'dinner', date: '2026-10-08', name: 'Dinner', foods: [oats] }]);
    fireEvent.press(utils.getByText('Oats'));
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/food/oats-aaa');
  });

  it('lists two logs of the same food separately, each opening its own entry', () => {
    const utils = open([{ id: 'dinner', date: '2026-10-08', name: 'Dinner', foods: [oats, oats2] }]);
    const rows = utils.getAllByText('Oats');
    expect(rows).toHaveLength(2);
    fireEvent.press(rows[1]);
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/food/oats-bbb');
  });

  it('opens an older entry (no log id) by its food id', () => {
    const legacy = { id: 'apple-1', name: 'Apple', calories: 52 };
    const utils = open([{ id: 'snack', date: '2026-10-08', name: 'Snack', foods: [legacy] }]);
    fireEvent.press(utils.getByText('Apple'));
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/food/apple-1');
  });

  it('Add Food on a meal opens search for that meal', () => {
    const utils = open([]);
    fireEvent.press(utils.getAllByText('Add Food')[2]);
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/search', params: { mealId: 'dinner' } });
  });
});

describe('the Other card', () => {
  const soup = { id: 'recipe-9', name: 'Tomato Soup', calories: 300, protein: 8, carbs: 40, fat: 10 };

  it('lists food saved under an old meal id, counts it, and opens it', () => {
    const utils = open([{ id: 'meal-1700000000000', date: '2026-10-08', name: 'Recipe', foods: [soup] }]);
    expect(utils.getByTestId('nutrition-other')).toBeTruthy();
    expect(utils.getByText('Tomato Soup')).toBeTruthy();
    expect(utils.getAllByText('300 kcal').length).toBeGreaterThan(0);
    expect(utils.getByText('1700')).toBeTruthy();
    fireEvent.press(utils.getByText('Tomato Soup'));
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/food/recipe-9');
  });

  it('is not shown when everything is in the four meals', () => {
    const utils = open([{ id: 'lunch', date: '2026-10-08', name: 'Lunch', foods: [oats] }]);
    expect(utils.queryByTestId('nutrition-other')).toBeNull();
  });

  it('only shows the selected day\'s old entries', () => {
    const utils = open([{ id: 'meal-1', date: '2026-10-07', name: 'Recipe', foods: [soup] }]);
    expect(utils.queryByTestId('nutrition-other')).toBeNull();
    fireEvent.press(utils.UNSAFE_getByType('ChevronLeft'));
    expect(utils.getByTestId('nutrition-other')).toBeTruthy();
  });
});

describe('fiber, sugar and sodium', () => {
  const food = (name, extra = {}) => ({ id: name, logId: `${name}-1`, name, calories: 100, protein: 1, carbs: 1, fat: 1, ...extra });
  const day = (foods) => [{ id: 'lunch', date: '2026-10-08', name: 'Lunch', foods }];

  it('shows the day\'s totals with the daily value for fiber and sodium', () => {
    const utils = open(day([
      food('Beans', { fiber: 12.5, sugar: 2, sodium: 800 }),
      food('Bread', { fiber: 3, sugar: 4.5, sodium: 1500 }),
    ]));
    expect(utils.getByText('15.5g')).toBeTruthy();
    expect(utils.getByText('6.5g')).toBeTruthy();
    expect(utils.getByText('2,300mg')).toBeTruthy();
    expect(utils.getByText('of 28 g')).toBeTruthy();
    expect(utils.getByText('of 2,300 mg')).toBeTruthy();
    expect(utils.getByText('Fiber')).toBeTruthy();
    expect(utils.getByText('Sugar')).toBeTruthy();
    expect(utils.getByText('Sodium')).toBeTruthy();
    expect(utils.queryByTestId('nutrition-extras-note')).toBeNull();
  });

  it('shows a dash, not 0, when no food lists them', () => {
    const utils = open(day([food('Quick add')]));
    expect(within(utils.getByTestId('extra-fiber')).getByText('\u2014')).toBeTruthy();
    expect(within(utils.getByTestId('extra-sodium')).getByText('\u2014')).toBeTruthy();
    expect(utils.queryByTestId('nutrition-extras-note')).toBeNull();
  });

  it('says which totals only count some of the foods', () => {
    const utils = open(day([food('Beans', { fiber: 12, sodium: 300 }), food('Quick add'), food('Rice', { sodium: 5 })]));
    expect(utils.getByTestId('nutrition-extras-note').props.children.join('')).toBe(
      'Counted from the foods that list them: fiber 1 of 3, sodium 2 of 3.'
    );
  });

  it('counts a real 0 as listed', () => {
    const utils = open(day([food('Water', { fiber: 0, sugar: 0, sodium: 0 })]));
    expect(within(utils.getByTestId('extra-sugar')).getByText('0g')).toBeTruthy();
  });

  it('follows the day being viewed', () => {
    const utils = open([
      { id: 'lunch', date: '2026-10-07', name: 'Lunch', foods: [food('Beans', { fiber: 9 })] },
    ]);
    expect(within(utils.getByTestId('extra-fiber')).getByText('\u2014')).toBeTruthy();
    fireEvent.press(utils.UNSAFE_getByType('ChevronLeft'));
    expect(within(utils.getByTestId('extra-fiber')).getByText('9g')).toBeTruthy();
  });
});

describe('intake history and opening a day', () => {
  it('has a history button in the header', () => {
    const utils = open([]);
    fireEvent.press(utils.getByTestId('nutrition-history'));
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/history');
  });

  it('has a meal plan button in the header that opens the plan on the day being viewed', () => {
    const utils = open([]);
    expect(utils.getByLabelText('Meal plan')).toBeTruthy();
    fireEvent.press(utils.getByTestId('nutrition-plan'));
    // The evening of Oct 8 in New Jersey (already Oct 9 in UTC).
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/plan', params: { date: '2026-10-08' } });
    expect(global.__router.push).not.toHaveBeenCalledWith('/nutrition/history');
  });

  it('has a calendar button in the header that opens the calendar on the day being viewed', () => {
    const utils = open([]);
    expect(utils.getByLabelText('Calendar')).toBeTruthy();
    fireEvent.press(utils.getByTestId('nutrition-calendar'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: '2026-10-08' } });
    expect(global.__router.push).not.toHaveBeenCalledWith({ pathname: '/nutrition/plan', params: { date: '2026-10-08' } });
  });

  it('opens the calendar on another day when that day is on show', () => {
    const utils = open([], {}, { date: '2026-10-05' });
    fireEvent.press(utils.getByTestId('nutrition-calendar'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: '2026-10-05' } });
  });

  it('opens the plan on another day when that day is on show', () => {
    const utils = open([], {}, { date: '2026-10-05' });
    fireEvent.press(utils.getByTestId('nutrition-plan'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/plan', params: { date: '2026-10-05' } });
  });

  it('opens on the day it is asked for', () => {
    const utils = open([], {}, { date: '2026-10-05' });
    expect(global.__nutrition.getMealsByDate).toHaveBeenCalledWith('2026-10-05');
    expect(utils.getByText('Oct 5')).toBeTruthy();
    expect(utils.queryByText('Hydration')).toBeNull();
  });

  it('takes the first of several date values', () => {
    open([], {}, { date: ['2026-10-03', '2026-10-04'] });
    expect(global.__nutrition.getMealsByDate).toHaveBeenCalledWith('2026-10-03');
  });

  it('ignores a date that is not a day and shows today', () => {
    const utils = open([], {}, { date: 'garbage' });
    expect(utils.getByText('Today')).toBeTruthy();
    expect(global.__nutrition.getMealsByDate).toHaveBeenCalledWith('2026-10-08');
  });
});

describe('Copy Meal', () => {
  const food = (name, calories) => ({ id: name, logId: `${name}-1`, name, calories });
  const history = [
    { id: 'lunch', date: '2026-10-07', name: 'Lunch', foods: [food('Rice', 200), food('Chicken', 300)] },
    { id: 'dinner', date: '2026-10-07', name: 'Dinner', foods: [food('Pasta', 500)] },
    { id: 'lunch', date: '2026-10-05', name: 'Lunch', foods: [food('Soup', 150)] },
    { id: 'lunch', date: '2026-10-08', name: 'Lunch', foods: [food('Wrap', 400)] },
  ];

  it('every slot has a Copy Meal button, and the sheet starts closed', () => {
    const utils = open(history);
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach((id) => expect(utils.getByTestId(`copy-meal-${id}`)).toBeTruthy());
    expect(utils.queryByTestId('copy-sheet')).toBeNull();
  });

  it('lists earlier meals for the slot, the same slot first', () => {
    const utils = open(history);
    fireEvent.press(utils.getByTestId('copy-meal-lunch'));
    const sheet = within(utils.getByTestId('copy-sheet'));
    expect(sheet.getByText('Copy into Lunch')).toBeTruthy();
    expect(sheet.getByText('Yesterday \u00B7 Lunch')).toBeTruthy();
    expect(sheet.getByText('Rice, Chicken')).toBeTruthy();
    expect(within(utils.getByTestId('copy-source-2026-10-07|lunch')).getByText('500 kcal')).toBeTruthy();
    expect(within(utils.getByTestId('copy-source-2026-10-05|lunch')).getByText('150 kcal')).toBeTruthy();
    expect(sheet.getByText('Mon, Oct 5 \u00B7 Lunch')).toBeTruthy();
    expect(sheet.getByText('Yesterday \u00B7 Dinner')).toBeTruthy();
    expect(utils.queryByTestId('copy-source-2026-10-08|lunch')).toBeNull();
    const keys = utils.getAllByTestId(/^copy-source-/).map((n) => n.props.testID);
    expect(keys).toEqual(['copy-source-2026-10-07|lunch', 'copy-source-2026-10-05|lunch', 'copy-source-2026-10-07|dinner']);
  });

  it('copies the tapped meal into the slot on the day being viewed, then closes', () => {
    const utils = open(history);
    fireEvent.press(utils.getByTestId('copy-meal-lunch'));
    fireEvent.press(utils.getByTestId('copy-source-2026-10-07|dinner'));
    expect(global.__nutrition.copyMealFoods).toHaveBeenCalledTimes(1);
    expect(global.__nutrition.copyMealFoods).toHaveBeenCalledWith({
      fromDate: '2026-10-07', fromMealId: 'dinner', toDate: '2026-10-08', toMealId: 'lunch',
    });
    expect(utils.queryByTestId('copy-sheet')).toBeNull();
  });

  it('copies into the day being viewed, not always today', () => {
    const utils = open(history);
    fireEvent.press(utils.UNSAFE_getByType('ChevronLeft'));
    fireEvent.press(utils.getByTestId('copy-meal-dinner'));
    expect(within(utils.getByTestId('copy-sheet')).getByText('Yesterday')).toBeTruthy();
    fireEvent.press(utils.getByTestId('copy-source-2026-10-05|lunch'));
    expect(global.__nutrition.copyMealFoods).toHaveBeenCalledWith({
      fromDate: '2026-10-05', fromMealId: 'lunch', toDate: '2026-10-07', toMealId: 'dinner',
    });
  });

  it('closes without copying', () => {
    const utils = open(history);
    fireEvent.press(utils.getByTestId('copy-meal-lunch'));
    fireEvent.press(utils.getByTestId('copy-close'));
    expect(utils.queryByTestId('copy-sheet')).toBeNull();
    expect(global.__nutrition.copyMealFoods).not.toHaveBeenCalled();
  });

  it('says when there is nothing to copy', () => {
    const utils = open([]);
    fireEvent.press(utils.getByTestId('copy-meal-snack'));
    expect(utils.getByTestId('copy-empty')).toBeTruthy();
  });
});

describe('the stars in the diary', () => {
  const rated = (name, nutritionalScore) => ({ id: name, logId: `${name}-1`, name, calories: 200, protein: 10, carbs: 20, fat: 5, ...(nutritionalScore ? { nutritionalScore } : {}) });
  const dinner = (foods) => [{ id: 'dinner', date: '2026-10-08', name: 'Dinner', foods }];

  it('shows each food\'s own stars in half steps, and the meal\'s average to the nearest half star', () => {
    const utils = open(dinner([rated('Salmon', { score: 'A', stars: 4.5 }), rated('Rice', { score: 'C', stars: 2.5 })]));
    expect(utils.getAllByLabelText('4.5 out of 5 stars')).toHaveLength(1);
    expect(utils.getAllByLabelText('2.5 out of 5 stars')).toHaveLength(1);
    // (4.5 + 2.5) / 2 = 3.5
    expect(utils.getAllByLabelText('3.5 out of 5 stars')).toHaveLength(1);
    // Each of the three has a half star.
    expect(utils.getAllByTestId('star-half')).toHaveLength(3);
  });

  it('rounds a meal that falls between two half steps to the nearest one', () => {
    const utils = open(dinner([rated('Salmon', { score: 'A', stars: 4.5 }), rated('Rice', { score: 'B', stars: 4 }), rated('Cookie', { score: 'E', stars: 1 })]));
    // 9.5 / 3 = 3.17, which is nearer 3 than 3.5
    expect(utils.getAllByLabelText('3 out of 5 stars')).toHaveLength(1);
    expect(utils.queryAllByLabelText('3.5 out of 5 stars')).toHaveLength(0);
  });

  it('rounds a meal that falls half way between two half steps up, not down', () => {
    const utils = open(dinner([rated('Salmon', { score: 'A', stars: 4.5 }), rated('Bread', { score: 'C', stars: 3 })]));
    // (4.5 + 3) / 2 = 3.75, which is nearer 4 than 3.5
    expect(utils.getAllByLabelText('4 out of 5 stars')).toHaveLength(1);
    expect(utils.queryAllByLabelText('3.5 out of 5 stars')).toHaveLength(0);
  });

  it('shows a food logged before half stars (it has only its grade) with the whole stars of that grade', () => {
    const utils = open(dinner([rated('Old chicken', { score: 'B' })]));
    // The food and the meal around it.
    expect(utils.getAllByLabelText('4 out of 5 stars')).toHaveLength(2);
    expect(utils.queryAllByTestId('star-half')).toHaveLength(0);
  });

  it('counts only the foods that have a rating towards the meal, and shows no stars for one without', () => {
    const utils = open(dinner([rated('Salmon', { score: 'A', stars: 4.5 }), rated('Homemade stew')]));
    // The salmon, and the meal (which is just the salmon).
    expect(utils.getAllByLabelText('4.5 out of 5 stars')).toHaveLength(2);
    expect(utils.getAllByTestId('star-rating')).toHaveLength(2);
  });

  it('shows no stars at all when nothing in the meal has a rating', () => {
    const utils = open(dinner([rated('Homemade stew')]));
    expect(utils.queryAllByTestId('star-rating')).toHaveLength(0);
  });
});

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params,
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
    default: ({ title }) => mockReact.createElement(mockRn.View, null, mockReact.createElement(mockRn.Text, { testID: 'header-title' }, title)),
  };
});
jest.mock('@/store/nutritionStore', () => ({ useNutritionStore: () => global.__nutrition }));
jest.mock('@/store/mealPlanStore', () => ({ useMealPlanStore: { getState: () => global.__plan } }));
jest.mock('@/services/calorieApiService', () => ({
  searchFoodsDetailed: (...a) => global.__search(...a),
  withFullRating: (...a) => global.__withFull(...a),
  gradeToStars: () => 4,
}));

import SearchFoodScreen from '../app/nutrition/search';

const chicken = { id: 'c1', name: 'Chicken Breast', servingSize: '100g', calories: 165, protein: 31, carbs: 0, fat: 3.6 };

const open = ({ params = {}, search, recentFoods = [], customFoods = [] } = {}) => {
  global.__params = params;
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__search = jest.fn(search || (async () => ({ results: [chicken], failed: false })));
  // The food's own record: by default the row comes back as it was.
  global.__withFull = jest.fn(async (food) => food);
  global.__nutrition = { addFoodToMeal: jest.fn(), recentFoods, customFoods, removeCustomFood: jest.fn() };
  global.__plan = { addFood: jest.fn(() => ({ ok: true })) };
  return render(<SearchFoodScreen />);
};

const typeQuery = async (utils, text) => {
  fireEvent.changeText(utils.getByPlaceholderText('Search foods...'), text);
  await act(async () => { jest.advanceTimersByTime(400); });
};

const original = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });
beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); });

describe('scanner buttons', () => {
  it('opens the barcode scanner', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('search-barcode'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/barcode-scan', params: {} });
  });

  it('opens the camera scanner', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('search-photo'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/scan', params: {} });
  });

  it('carries the meal the food is being added to through to the scanner', () => {
    const utils = open({ params: { mealId: 'dinner' } });
    fireEvent.press(utils.getByTestId('search-barcode'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/barcode-scan', params: { mealId: 'dinner' } });
    fireEvent.press(utils.getByTestId('search-photo'));
    expect(global.__router.push).toHaveBeenLastCalledWith({ pathname: '/nutrition/scan', params: { mealId: 'dinner' } });
  });

  it('labels both buttons for screen readers', () => {
    const utils = open();
    expect(utils.getByLabelText('Scan a barcode')).toBeTruthy();
    expect(utils.getByLabelText('Scan food with the camera')).toBeTruthy();
  });
});

describe('search results', () => {
  it('lists what the search finds, without a warning', async () => {
    const utils = open();
    await typeQuery(utils, 'chicken');
    expect(global.__search).toHaveBeenCalledWith('chicken');
    expect(utils.getByText('Chicken Breast')).toBeTruthy();
    expect(utils.queryByTestId('search-fallback-banner')).toBeNull();
  });

  it('says so when the search could not be reached, and lists no foods', async () => {
    const utils = open({ search: async () => ({ results: [], failed: true }) });
    await typeQuery(utils, 'chicken');
    expect(utils.getByTestId('search-fallback-banner')).toBeTruthy();
    expect(utils.getByText(/Couldn't reach food search\. Check your connection and search again\./)).toBeTruthy();
    expect(utils.queryByText(/only a few common foods/)).toBeNull();
    expect(utils.queryByText('Chicken Breast')).toBeNull();
  });

  it('does not also say "No results found", because the search never ran', async () => {
    const utils = open({ search: async () => ({ results: [], failed: true }) });
    await typeQuery(utils, 'dragonfruit');
    expect(utils.getByTestId('search-fallback-banner')).toBeTruthy();
    expect(utils.queryByText('No results found')).toBeNull();
  });

  it('says so when the search call itself blows up', async () => {
    const utils = open({ search: async () => { throw new Error('boom'); } });
    await typeQuery(utils, 'chicken');
    expect(utils.getByTestId('search-fallback-banner')).toBeTruthy();
    expect(utils.queryByText('No results found')).toBeNull();
  });

  it('says "No results found" when the search worked and found nothing', async () => {
    const utils = open({ search: async () => ({ results: [], failed: false }) });
    await typeQuery(utils, 'dragonfruit');
    expect(utils.getByText('No results found')).toBeTruthy();
    expect(utils.queryByTestId('search-fallback-banner')).toBeNull();
  });

  it('still shows the person\'s own foods while the search is down', async () => {
    const mine = { id: 'mine-1', name: 'Chicken Salad (mine)', servingSize: '1 bowl', calories: 320, protein: 30, carbs: 10, fat: 15 };
    const utils = open({ customFoods: [mine], search: async () => ({ results: [], failed: true }) });
    await typeQuery(utils, 'chicken');
    expect(utils.getByTestId('search-fallback-banner')).toBeTruthy();
    expect(utils.getByText('Chicken Salad (mine)')).toBeTruthy();
  });

  it('takes the warning away once a search works again', async () => {
    const utils = open({ search: jest.fn().mockResolvedValueOnce({ results: [], failed: true }).mockResolvedValue({ results: [chicken], failed: false }) });
    await typeQuery(utils, 'chicken');
    expect(utils.getByTestId('search-fallback-banner')).toBeTruthy();
    await typeQuery(utils, 'chicken b');
    expect(utils.queryByTestId('search-fallback-banner')).toBeNull();
    expect(utils.getByText('Chicken Breast')).toBeTruthy();
  });

  it('adds a tapped result to the meal on the local day when a meal was chosen', async () => {
    jest.setSystemTime(new Date('2026-10-09T01:30:00Z')); // 9:30 PM on Oct 8 in New Jersey
    const utils = open({ params: { mealId: 'snack' } });
    await typeQuery(utils, 'chicken');
    await act(async () => { fireEvent.press(utils.getByText('Chicken Breast')); });
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledWith('2026-10-08', 'snack', chicken);
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('opens the log screen for a tapped result when no meal was chosen', async () => {
    const utils = open();
    await typeQuery(utils, 'chicken');
    fireEvent.press(utils.getByText('Chicken Breast'));
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/food/c1');
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
  });

  it('does not search for a single letter', async () => {
    const utils = open();
    await typeQuery(utils, 'c');
    expect(global.__search).not.toHaveBeenCalled();
  });
});

describe('create food and quick add buttons', () => {
  it('open the forms', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('search-create-food'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/custom-food', params: {} });
    fireEvent.press(utils.getByTestId('search-quick-add'));
    expect(global.__router.push).toHaveBeenLastCalledWith({ pathname: '/nutrition/quick-add', params: {} });
  });

  it('carry the meal the food is for', () => {
    const utils = open({ params: { mealId: 'lunch' } });
    fireEvent.press(utils.getByTestId('search-create-food'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/custom-food', params: { mealId: 'lunch' } });
    fireEvent.press(utils.getByTestId('search-quick-add'));
    expect(global.__router.push).toHaveBeenLastCalledWith({ pathname: '/nutrition/quick-add', params: { mealId: 'lunch' } });
  });

  it('carry what was typed, so a food that was not found can be made with that name', async () => {
    const utils = open({ params: { mealId: 'lunch' }, search: async () => ({ results: [], failed: false }) });
    await typeQuery(utils, '  homemade chili ');
    fireEvent.press(utils.getByTestId('search-create-food'));
    expect(global.__router.push).toHaveBeenCalledWith({
      pathname: '/nutrition/custom-food', params: { mealId: 'lunch', name: 'homemade chili' },
    });
  });
});

describe('My Foods', () => {
  const shake = { id: 'custom-1', name: 'Protein shake', servingSize: '1 scoop', calories: 120, protein: 24, carbs: 3, fat: 1, custom: true };
  const chili = { id: 'custom-2', name: 'Homemade chili', servingSize: '1 bowl', calories: 350, protein: 30, carbs: 30, fat: 10, custom: true };

  afterEach(() => { jest.restoreAllMocks(); });

  it('are listed before the search is used, above recent foods', () => {
    const utils = open({ customFoods: [shake, chili], recentFoods: [chicken] });
    expect(utils.getByText('My Foods')).toBeTruthy();
    expect(utils.getByText('Protein shake')).toBeTruthy();
    expect(utils.getByText('120 kcal')).toBeTruthy();
    expect(utils.getByText('Recent Foods')).toBeTruthy();
    expect(utils.getByText(/Hold a food to edit or delete it/)).toBeTruthy();
  });

  it('are not shown at all when there are none', () => {
    const utils = open({ recentFoods: [chicken] });
    expect(utils.queryByText('My Foods')).toBeNull();
    expect(utils.getByText('Recent Foods')).toBeTruthy();
  });

  it('show only the newest 10 up front and say where the rest are', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...shake, id: `custom-${i}`, name: `Food ${i}` }));
    const utils = open({ customFoods: many });
    expect(utils.getByText('Food 9')).toBeTruthy();
    expect(utils.queryByText('Food 10')).toBeNull();
    expect(utils.getByText(/Type a name to find the rest/)).toBeTruthy();
  });

  it('are found by typing part of the name, above the search results', async () => {
    const utils = open({ customFoods: [shake, chili] });
    await typeQuery(utils, 'chili');
    expect(utils.getByText('Homemade chili')).toBeTruthy();
    expect(utils.queryByText('Protein shake')).toBeNull();
    expect(utils.getByText('Chicken Breast')).toBeTruthy();
    expect(utils.getByText('Search Results')).toBeTruthy();
  });

  it('are still shown when the search finds nothing, instead of "No results found"', async () => {
    const utils = open({ customFoods: [chili], search: async () => ({ results: [], failed: false }) });
    await typeQuery(utils, 'chili');
    expect(utils.getByText('Homemade chili')).toBeTruthy();
    expect(utils.queryByText('No results found')).toBeNull();
    expect(utils.queryByText('Search Results')).toBeNull();
  });

  it('are shown while the search is still running', async () => {
    let finish;
    const utils = open({ customFoods: [chili], search: () => new Promise((r) => { finish = r; }) });
    fireEvent.changeText(utils.getByPlaceholderText('Search foods...'), 'chili');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(utils.getByText('Homemade chili')).toBeTruthy();
    await act(async () => { finish({ results: [chicken], failed: false }); });
    expect(utils.getByText('Chicken Breast')).toBeTruthy();
  });

  it('log to the chosen meal on the local day when tapped', () => {
    jest.setSystemTime(new Date('2026-10-09T01:30:00Z'));
    const utils = open({ params: { mealId: 'snack' }, customFoods: [shake] });
    fireEvent.press(utils.getByText('Protein shake'));
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledWith('2026-10-08', 'snack', shake);
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('open the log screen when tapped with no meal chosen', () => {
    const utils = open({ customFoods: [shake] });
    fireEvent.press(utils.getByText('Protein shake'));
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/food/custom-1');
  });

  it('offer edit and delete on a long press', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ customFoods: [shake] });
    fireEvent(utils.getByTestId('my-food-custom-1'), 'longPress');
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toBe('Protein shake');
    expect(buttons.map((b) => b.text)).toEqual(['Edit', 'Delete', 'Cancel']);
    buttons[0].onPress();
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/custom-food', params: { editId: 'custom-1' } });
  });

  it('ask before deleting, and delete only when confirmed', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ customFoods: [shake] });
    fireEvent(utils.getByTestId('my-food-custom-1'), 'longPress');
    alert.mock.calls[0][2][1].onPress();
    expect(global.__nutrition.removeCustomFood).not.toHaveBeenCalled();
    const [title, message, buttons] = alert.mock.calls[1];
    expect(title).toBe('Delete this food?');
    expect(message).toMatch(/already logged/);
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    buttons[1].onPress();
    expect(global.__nutrition.removeCustomFood).toHaveBeenCalledWith('custom-1');
  });
});

describe('planning a food (opened from the meal plan)', () => {
  const PLAN = { mealId: 'dinner', planDate: '2026-10-07' };
  beforeEach(() => { jest.setSystemTime(new Date('2026-10-09T16:00:00Z')); });

  it('says it is for the meal plan, with the meal and the day', () => {
    const utils = open({ params: PLAN });
    expect(utils.getByTestId('header-title').props.children).toBe('Plan a Food');
    expect(utils.getByTestId('search-plan-banner')).toBeTruthy();
    expect(utils.getByText('Adding to your meal plan: Dinner \u00B7 Wed, Oct 7')).toBeTruthy();
  });

  it('names today and yesterday', () => {
    expect(open({ params: { ...PLAN, planDate: '2026-10-09' } }).getByText('Adding to your meal plan: Dinner \u00B7 Today')).toBeTruthy();
    expect(open({ params: { ...PLAN, planDate: '2026-10-08' } }).getByText('Adding to your meal plan: Dinner \u00B7 Yesterday')).toBeTruthy();
  });

  it('does not say it is for the meal plan otherwise', () => {
    const utils = open({ params: { mealId: 'dinner' } });
    expect(utils.getByTestId('header-title').props.children).toBe('Search Food');
    expect(utils.queryByTestId('search-plan-banner')).toBeNull();
  });

  it('puts a tapped search result on the plan for that day and meal, not in the diary', async () => {
    const utils = open({ params: PLAN });
    await typeQuery(utils, 'chicken');
    await act(async () => { fireEvent.press(utils.getByText('Chicken Breast')); });
    expect(global.__plan.addFood).toHaveBeenCalledTimes(1);
    expect(global.__plan.addFood).toHaveBeenCalledWith(chicken, { date: '2026-10-07', slot: 'dinner' });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.push).not.toHaveBeenCalled();
    expect(global.__router.back).toHaveBeenCalledTimes(1);
  });

  it('puts a tapped My Food on the plan', () => {
    const shake = { id: 'custom-1', name: 'Protein shake', servingSize: '1 bottle', calories: 200 };
    const utils = open({ params: PLAN, customFoods: [shake] });
    fireEvent.press(utils.getByTestId('my-food-custom-1'));
    expect(global.__plan.addFood).toHaveBeenCalledWith(shake, { date: '2026-10-07', slot: 'dinner' });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('puts a tapped recent food on the plan', () => {
    const utils = open({ params: PLAN, recentFoods: [chicken] });
    fireEvent.press(utils.getByText('Chicken Breast'));
    expect(global.__plan.addFood).toHaveBeenCalledWith(chicken, { date: '2026-10-07', slot: 'dinner' });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
  });

  it('uses the first day when it is given more than once', () => {
    const utils = open({ params: { mealId: 'lunch', planDate: ['2026-10-10', '2026-10-11'] }, recentFoods: [chicken] });
    fireEvent.press(utils.getByText('Chicken Breast'));
    expect(global.__plan.addFood).toHaveBeenCalledWith(chicken, { date: '2026-10-10', slot: 'lunch' });
  });

  it('goes to the plan on that day when there is no screen to go back to', () => {
    const utils = open({ params: PLAN, recentFoods: [chicken] });
    global.__router.canGoBack.mockReturnValue(false);
    fireEvent.press(utils.getByText('Chicken Breast'));
    expect(global.__router.back).not.toHaveBeenCalled();
    expect(global.__router.replace).toHaveBeenCalledWith({ pathname: '/nutrition/plan', params: { date: '2026-10-07' } });
  });

  it('says why and stays put when the food could not be added', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ params: PLAN, recentFoods: [chicken] });
    global.__plan.addFood.mockReturnValue({ ok: false, error: 'Dinner already has 10 items on that day.' });
    fireEvent.press(utils.getByText('Chicken Breast'));
    expect(alert).toHaveBeenCalledWith('Could not add', 'Dinner already has 10 items on that day.');
    expect(global.__router.back).not.toHaveBeenCalled();
    expect(global.__router.replace).not.toHaveBeenCalled();
  });

  it('never logs to the diary, even with no valid meal', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = open({ params: { planDate: '2026-10-07' }, recentFoods: [chicken] });
    global.__plan.addFood.mockReturnValue({ ok: false, error: 'Pick a real day and meal.' });
    expect(utils.getByText('Adding to your meal plan: a meal \u00B7 Wed, Oct 7')).toBeTruthy();
    fireEvent.press(utils.getByText('Chicken Breast'));
    expect(global.__plan.addFood).toHaveBeenCalledWith(chicken, { date: '2026-10-07', slot: undefined });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.push).not.toHaveBeenCalled();
  });

  it('hides the scanners and Quick Add, which would log straight to the diary', () => {
    const utils = open({ params: PLAN });
    expect(utils.queryByTestId('search-barcode')).toBeNull();
    expect(utils.queryByTestId('search-photo')).toBeNull();
    expect(utils.queryByTestId('search-quick-add')).toBeNull();
    expect(utils.getByTestId('search-create-food')).toBeTruthy();
    expect(utils.getByPlaceholderText('Search foods...')).toBeTruthy();
  });

  it('makes a food for My Foods without sending it to the diary', async () => {
    const utils = open({ params: PLAN });
    await typeQuery(utils, 'chili');
    fireEvent.press(utils.getByTestId('search-create-food'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/custom-food', params: { name: 'chili' } });
  });
});

// A search row lists no sodium or saturated fat, so the rating on it is held back (partial) and was the same 3 stars for nearly
// every chicken food. A food logged (or planned) from the search takes its rating from the food's own record instead.
describe('logging a search result with the food\'s own record', () => {
  const full = { ...chicken, nutritionalScore: { score: 'A' }, sodium: 74, fiber: 0, sugar: 0, nutritionalDetails: { saturatedFat: 1 } };
  const press = async (utils, text = 'Chicken Breast') => { await act(async () => { fireEvent.press(utils.getByText(text)); }); };

  it('logs the completed food to the chosen meal, and asks for the record of the row that was tapped', async () => {
    const utils = open({ params: { mealId: 'lunch' } });
    global.__withFull.mockImplementation(async () => full);
    await typeQuery(utils, 'chicken');
    await press(utils);
    expect(global.__withFull).toHaveBeenCalledTimes(1);
    expect(global.__withFull).toHaveBeenCalledWith(chicken);
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(1);
    expect(global.__nutrition.addFoodToMeal.mock.calls[0][2]).toBe(full);
    expect(global.__router.back).toHaveBeenCalledTimes(1);
  });

  it('plans the completed food too', async () => {
    const utils = open({ params: { mealId: 'dinner', planDate: '2026-10-07' } });
    global.__withFull.mockImplementation(async () => full);
    await typeQuery(utils, 'chicken');
    await press(utils);
    expect(global.__plan.addFood).toHaveBeenCalledWith(full, { date: '2026-10-07', slot: 'dinner' });
  });

  it('plans the completed food when no meal slot was chosen either', async () => {
    const utils = open({ params: { planDate: '2026-10-07' } });
    global.__withFull.mockImplementation(async () => full);
    await typeQuery(utils, 'chicken');
    await press(utils);
    expect(global.__plan.addFood).toHaveBeenCalledWith(full, { date: '2026-10-07', slot: undefined });
  });

  it('leaves the record to the food page when no meal was chosen', async () => {
    const utils = open();
    await typeQuery(utils, 'chicken');
    await press(utils);
    expect(global.__withFull).not.toHaveBeenCalled();
    expect(global.__router.push).toHaveBeenCalledWith('/nutrition/food/c1');
  });

  it('does not look anything up for a recent food or one of My Foods, which are logged as they are', () => {
    const shake = { id: 'custom-1', name: 'Protein shake', servingSize: '1 bottle', calories: 200 };
    const utils = open({ params: { mealId: 'snack' }, recentFoods: [chicken], customFoods: [shake] });
    fireEvent.press(utils.getByText('Protein shake'));
    fireEvent.press(utils.getByText('Chicken Breast'));
    expect(global.__withFull).not.toHaveBeenCalled();
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(2);
  });

  it('shows it is working while the record loads, and a second tap in that time does not log it twice', async () => {
    const utils = open({ params: { mealId: 'lunch' } });
    let finish;
    global.__withFull.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await typeQuery(utils, 'chicken');
    await press(utils);
    expect(utils.getByTestId('search-picking')).toBeTruthy();
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    await press(utils);
    expect(global.__withFull).toHaveBeenCalledTimes(1);
    await act(async () => { finish(full); });
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(1);
    expect(utils.queryByTestId('search-picking')).toBeNull();
  });

  it('can be tapped again once the first one has finished', async () => {
    const utils = open({ params: { mealId: 'lunch' } });
    await typeQuery(utils, 'chicken');
    await press(utils);
    await press(utils);
    expect(global.__nutrition.addFoodToMeal).toHaveBeenCalledTimes(2);
  });

  it('logs nothing, and goes nowhere, when the screen was left while the record loaded', async () => {
    const utils = open({ params: { mealId: 'lunch' } });
    let finish;
    global.__withFull.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await typeQuery(utils, 'chicken');
    await press(utils);
    utils.unmount();
    await act(async () => { finish(full); });
    expect(global.__nutrition.addFoodToMeal).not.toHaveBeenCalled();
    expect(global.__router.back).not.toHaveBeenCalled();
  });
});

describe('stars on the list', () => {
  const stars = (utils) => utils.UNSAFE_queryAllByType('Star').length;
  const row = (name, nutritionalScore) => ({ id: name, name, servingSize: '100g', calories: 165, ...(nutritionalScore ? { nutritionalScore } : {}) });

  it('are shown for a rating worked out from every figure', async () => {
    const utils = open({ search: async () => ({ results: [row('Breast', { score: 'A' })], failed: false }) });
    await typeQuery(utils, 'chicken');
    expect(stars(utils)).toBe(5);
  });

  it('are not shown for a rating held back by figures the search does not list', async () => {
    const utils = open({ search: async () => ({ results: [row('Breast', { score: 'C', partial: true })], failed: false }) });
    await typeQuery(utils, 'chicken');
    expect(utils.getByText('Breast')).toBeTruthy();
    expect(stars(utils)).toBe(0);
  });

  it('are not shown for a food with no rating', async () => {
    const utils = open({ search: async () => ({ results: [row('Breast')], failed: false }) });
    await typeQuery(utils, 'chicken');
    expect(stars(utils)).toBe(0);
  });

  it('are not shown on a recent food whose rating is held back either', () => {
    const utils = open({ recentFoods: [row('Breast', { score: 'C', partial: true }), row('Oats', { score: 'A' })] });
    expect(stars(utils)).toBe(5);
  });
});

describe('room under the list for the bottom bar', () => {
  const { FlatList, ScrollView, StyleSheet } = require('react-native');
  const bottomOf = (node) => StyleSheet.flatten(node.props.contentContainerStyle).paddingBottom;

  it('lets the last search result scroll clear of the bar', async () => {
    const utils = open();
    await typeQuery(utils, 'chicken');
    expect(bottomOf(utils.UNSAFE_getByType(FlatList))).toBe(140);
  });

  it('lets the last recent food scroll clear of the bar', () => {
    const utils = open({ recentFoods: [chicken] });
    expect(bottomOf(utils.UNSAFE_getByType(ScrollView))).toBe(140);
  });
});

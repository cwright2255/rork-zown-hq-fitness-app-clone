// Home > Macros: today's protein, carbs and fat against the daily goals, and a tap that opens Nutrition.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th, so the phone's own day
// is the 14th even though UTC says the 15th.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import MacrosWidget from '../components/MacrosWidget';
import { useNutritionStore } from '../store/nutritionStore';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const GOALS = { calories: 2000, protein: 150, carbs: 200, fat: 65, water: 2000 };
const food = (o = {}) => ({ name: 'Food', calories: 100, protein: 10, carbs: 20, fat: 5, ...o });
const meal = (date, foods, id = `m${date}`) => ({ id, date, foods });
const bar = (utils, key) => StyleSheet.flatten(utils.getByTestId(`home-macro-${key}-bar`).props.style);
const text = (utils, key) => utils.getByTestId(`home-macro-${key}-text`).props.children;
const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useNutritionStore.setState({ meals: [], dailyGoals: { ...GOALS } });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Macros', () => {
  it('shows each macro at zero against its goal, with empty bars, when nothing is logged', () => {
    const utils = render(<MacrosWidget />);
    expect(utils.getByText('Macros')).toBeTruthy();
    expect(utils.getByText('Protein')).toBeTruthy();
    expect(utils.getByText('Carbs')).toBeTruthy();
    expect(utils.getByText('Fat')).toBeTruthy();
    expect(['protein', 'carbs', 'fat'].map((k) => text(utils, k))).toEqual(['0/150g', '0/200g', '0/65g']);
    expect(['protein', 'carbs', 'fat'].map((k) => bar(utils, k).width)).toEqual(['0%', '0%', '0%']);
    expect(utils.getByText('Nothing logged yet')).toBeTruthy();
  });

  it('shows what was eaten today, and how far each goal is filled', () => {
    useNutritionStore.setState({
      meals: [
        meal('2026-10-14', [food({ protein: 40, carbs: 60, fat: 10 })], 'b'),
        meal('2026-10-14', [food({ protein: 35, carbs: 40, fat: 3 })], 'l'),
      ],
    });
    const utils = render(<MacrosWidget />);
    expect(['protein', 'carbs', 'fat'].map((k) => text(utils, k))).toEqual(['75/150g', '100/200g', '13/65g']);
    expect(['protein', 'carbs', 'fat'].map((k) => bar(utils, k).width)).toEqual(['50%', '50%', '20%']);
    expect(utils.getByText('Today')).toBeTruthy();
    expect(utils.queryByText('Nothing logged yet')).toBeNull();
  });

  it('draws each bar in the colour the Nutrition screen gives that macro', () => {
    useNutritionStore.setState({ meals: [meal('2026-10-14', [food()])] });
    const utils = render(<MacrosWidget />);
    expect(bar(utils, 'protein').backgroundColor).toBe('#3B82F6');
    expect(bar(utils, 'carbs').backgroundColor).toBe('#F97316');
    expect(bar(utils, 'fat').backgroundColor).toBe('#A855F7');
  });

  it('counts the phone\'s own day, not the UTC one: food logged on the 14th shows at 9:30 PM on the 14th', () => {
    useNutritionStore.setState({ meals: [meal('2026-10-14', [food({ protein: 30 })]), meal('2026-10-15', [food({ protein: 99 })])] });
    const utils = render(<MacrosWidget />);
    expect(text(utils, 'protein')).toBe('30/150g');
  });

  it('leaves out food from other days', () => {
    useNutritionStore.setState({ meals: [meal('2026-10-13', [food({ protein: 99 })]), meal('2026-10-15', [food({ protein: 77 })])] });
    const utils = render(<MacrosWidget />);
    expect(text(utils, 'protein')).toBe('0/150g');
    expect(utils.getByText('Nothing logged yet')).toBeTruthy();
  });

  it('shows the same grams as the diary\'s own day total', () => {
    useNutritionStore.setState({ meals: [meal('2026-10-14', [food({ protein: 12.6, carbs: 7.4, fat: 3.5 }), food({ protein: 1, carbs: 2, fat: 3 })])] });
    const total = useNutritionStore.getState().getDailyNutrition('2026-10-14');
    const utils = render(<MacrosWidget />);
    expect(['protein', 'carbs', 'fat'].map((k) => text(utils, k))).toEqual([
      `${Math.round(total.protein)}/150g`, `${Math.round(total.carbs)}/200g`, `${Math.round(total.fat)}/65g`,
    ]);
  });

  it('fills a bar and keeps counting once a goal is passed', () => {
    useNutritionStore.setState({ meals: [meal('2026-10-14', [food({ protein: 200, carbs: 100, fat: 65 })])] });
    const utils = render(<MacrosWidget />);
    expect(text(utils, 'protein')).toBe('200/150g');
    expect(bar(utils, 'protein').width).toBe('100%');
    expect(bar(utils, 'carbs').width).toBe('50%');
    expect(bar(utils, 'fat').width).toBe('100%');
  });

  it('uses the goals the person has set', () => {
    useNutritionStore.setState({ dailyGoals: { ...GOALS, protein: 100, carbs: 250, fat: 80 }, meals: [meal('2026-10-14', [food({ protein: 50, carbs: 125, fat: 20 })])] });
    const utils = render(<MacrosWidget />);
    expect(['protein', 'carbs', 'fat'].map((k) => text(utils, k))).toEqual(['50/100g', '125/250g', '20/80g']);
    expect(['protein', 'carbs', 'fat'].map((k) => bar(utils, k).width)).toEqual(['50%', '50%', '25%']);
  });

  it('shows just the grams, with no bar, for a macro that has no goal', () => {
    useNutritionStore.setState({ dailyGoals: { ...GOALS, fat: 0 }, meals: [meal('2026-10-14', [food({ fat: 22 })])] });
    const utils = render(<MacrosWidget />);
    expect(text(utils, 'fat')).toBe('22g');
    expect(utils.queryByTestId('home-macro-fat-bar')).toBeNull();
    expect(utils.getByTestId('home-macro-protein-bar')).toBeTruthy();
  });

  it('updates when food is logged and when the goals change', () => {
    const utils = render(<MacrosWidget />);
    expect(text(utils, 'protein')).toBe('0/150g');
    act(() => { useNutritionStore.setState({ meals: [meal('2026-10-14', [food({ protein: 60 })])] }); });
    expect(text(utils, 'protein')).toBe('60/150g');
    expect(bar(utils, 'protein').width).toBe('40%');
    act(() => { useNutritionStore.setState({ dailyGoals: { ...GOALS, protein: 120 } }); });
    expect(text(utils, 'protein')).toBe('60/120g');
    expect(bar(utils, 'protein').width).toBe('50%');
  });

  it('starts a new day at midnight', () => {
    useNutritionStore.setState({ meals: [meal('2026-10-14', [food({ protein: 60 })])] });
    const utils = render(<MacrosWidget />);
    expect(text(utils, 'protein')).toBe('60/150g');
    jest.setSystemTime(new Date('2026-10-15T05:00:00Z')); // 1 AM on the 15th in New Jersey
    utils.rerender(<MacrosWidget />);
    expect(text(utils, 'protein')).toBe('0/150g'); // yesterday's food is yesterday's
    act(() => { useNutritionStore.setState({ meals: [meal('2026-10-14', [food({ protein: 60 })]), meal('2026-10-15', [food({ protein: 5 })])] }); });
    expect(text(utils, 'protein')).toBe('5/150g');
  });

  it('opens Nutrition when tapped', () => {
    const utils = render(<MacrosWidget />);
    fireEvent.press(utils.getByTestId('home-widget-macros'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/nutrition');
  });

  it('reads out the day for a screen reader, and says where a tap goes', () => {
    useNutritionStore.setState({ meals: [meal('2026-10-14', [food({ protein: 82, carbs: 120, fat: 40 })])] });
    const utils = render(<MacrosWidget />);
    expect(utils.getByTestId('home-widget-macros').props.accessibilityLabel).toBe(
      'Macros today: protein 82 of 150 grams, carbs 120 of 200 grams, fat 40 of 65 grams. Opens Nutrition.'
    );
  });

  it('has the nutrition icon and a chevron', () => {
    expect(iconNames(render(<MacrosWidget />))).toEqual(['nutrition-outline', 'chevron-forward']);
  });

  it('does not change what was logged', () => {
    const meals = [meal('2026-10-14', [food()])];
    useNutritionStore.setState({ meals });
    render(<MacrosWidget />);
    expect(useNutritionStore.getState().meals).toBe(meals);
  });
});

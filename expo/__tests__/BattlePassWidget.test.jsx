// Home > Battle Pass: the level, the XP bar and how many of the day's missions are done, and a tap that opens the Battle Pass.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
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
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import BattlePassWidget from '../components/BattlePassWidget';
import { useExpStore } from '../store/expStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useHealthStore } from '../store/healthStore';
import { xpRequiredForLevel } from '../lib/xpRules';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const noon = (d) => new Date(2026, 9, d, 12, 0).toISOString();
const workout = (d) => ({ id: `w${d}`, completedAt: noon(d) });
const run = (d) => ({ id: `r${d}`, startTime: noon(d), endTime: noon(d), distance: 5 });
const meal = (date = '2026-10-14', foods = [{ name: 'Eggs' }]) => ({ id: `m${Math.random()}`, date, foods });
const INITIAL_EXP = useExpStore.getState().expSystem;
const withXp = (level, totalExp) => ({ ...INITIAL_EXP, level, totalExp });
const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);
const barWidth = (utils) => StyleSheet.flatten(utils.getByTestId('home-battlepass-bar').props.style).width;

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useExpStore.setState({ expSystem: INITIAL_EXP });
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
  useNutritionStore.setState({ meals: [] });
  useHealthStore.setState({ steps: 0, stepsDate: null });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Battle Pass', () => {
  it('shows level 1, an empty bar and no missions done for someone who has not started', () => {
    const utils = render(<BattlePassWidget />);
    expect(utils.getByText('Battle Pass')).toBeTruthy();
    expect(utils.getByText('Lv 1')).toBeTruthy();
    expect(utils.getByText('0/3 missions today')).toBeTruthy();
    expect(barWidth(utils)).toBe('0%');
  });

  it('shows the level and how far through it the XP is, as the server last said it', () => {
    const floor = xpRequiredForLevel(7);
    const span = xpRequiredForLevel(8) - floor;
    useExpStore.setState({ expSystem: withXp(7, floor + span / 2) });
    const utils = render(<BattlePassWidget />);
    expect(utils.getByText('Lv 7')).toBeTruthy();
    expect(barWidth(utils)).toBe('50%');
  });

  it('shows the level the XP store holds, as the Battle Pass screen does', () => {
    useExpStore.setState({ expSystem: withXp(3, 0) });
    expect(render(<BattlePassWidget />).getByText('Lv 3')).toBeTruthy();
  });

  it.each([
    ['a workout', () => useWorkoutStore.setState({ completedWorkouts: [workout(14)] })],
    ['a run', () => useRunningStore.setState({ runs: [run(14)] })],
    ['a hike', () => useHikingStore.setState({ completedHikes: [{ id: 'h', startTime: noon(14), completedAt: noon(14) }] })],
  ])('counts %s today as the workout mission', (_name, setUp) => {
    setUp();
    expect(render(<BattlePassWidget />).getByText('1/3 missions today')).toBeTruthy();
  });

  it('does not count yesterday\'s workout', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout(13)] });
    expect(render(<BattlePassWidget />).getByText('0/3 missions today')).toBeTruthy();
  });

  it('counts the meals mission once three meals with foods are logged today', () => {
    useNutritionStore.setState({ meals: [meal(), meal(), meal()] });
    expect(render(<BattlePassWidget />).getByText('1/3 missions today')).toBeTruthy();
  });

  it('skips an empty record in the food diary', () => {
    useNutritionStore.setState({ meals: [null, meal(), undefined, meal(), meal()] });
    expect(render(<BattlePassWidget />).getByText('1/3 missions today')).toBeTruthy();
  });

  it('does not count two meals, a meal with no foods, or meals from another day', () => {
    useNutritionStore.setState({ meals: [meal(), meal(), meal('2026-10-14', []), meal('2026-10-13'), meal('2026-10-15')] });
    expect(render(<BattlePassWidget />).getByText('0/3 missions today')).toBeTruthy();
  });

  it.each([
    [4999, '0/3 missions today'],
    [5000, '1/3 missions today'],
    [12000, '1/3 missions today'],
  ])('with %s steps counted today says %s', (steps, caption) => {
    useHealthStore.setState({ steps, stepsDate: '2026-10-14' });
    expect(render(<BattlePassWidget />).getByText(caption)).toBeTruthy();
  });

  it('does not count steps that were counted on another day', () => {
    useHealthStore.setState({ steps: 9000, stepsDate: '2026-10-13' });
    expect(render(<BattlePassWidget />).getByText('0/3 missions today')).toBeTruthy();
  });

  it('says all missions are done when all three are', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout(14)] });
    useNutritionStore.setState({ meals: [meal(), meal(), meal()] });
    useHealthStore.setState({ steps: 6000, stepsDate: '2026-10-14' });
    expect(render(<BattlePassWidget />).getByText('All missions done')).toBeTruthy();
  });

  it('has a ribbon for its icon', () => {
    expect(iconNames(render(<BattlePassWidget />))).toEqual(['ribbon-outline', 'chevron-forward']);
  });

  it('opens the Battle Pass when tapped', () => {
    const utils = render(<BattlePassWidget />);
    fireEvent.press(utils.getByTestId('home-widget-battlepass'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/battlepass');
  });

  it('is a button for a screen reader that says where the person is', () => {
    useExpStore.setState({ expSystem: withXp(1, 250) });
    useWorkoutStore.setState({ completedWorkouts: [workout(14)] });
    const utils = render(<BattlePassWidget />);
    const card = utils.getByTestId('home-widget-battlepass');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Battle Pass: level 1, 250 of 1000 XP toward level 2, 1 of 3 daily missions done. Opens the Battle Pass.');
  });

  it('moves when XP arrives, without leaving the screen', () => {
    const utils = render(<BattlePassWidget />);
    expect(utils.getByText('Lv 1')).toBeTruthy();
    act(() => { useExpStore.setState({ expSystem: withXp(2, xpRequiredForLevel(2) + 100) }); });
    expect(utils.getByText('Lv 2')).toBeTruthy();
  });

  it('moves when a workout is finished, a meal is logged or the steps come in', () => {
    const utils = render(<BattlePassWidget />);
    expect(utils.getByText('0/3 missions today')).toBeTruthy();
    act(() => { useWorkoutStore.setState({ completedWorkouts: [workout(14)] }); });
    expect(utils.getByText('1/3 missions today')).toBeTruthy();
    act(() => { useNutritionStore.setState({ meals: [meal(), meal(), meal()] }); });
    expect(utils.getByText('2/3 missions today')).toBeTruthy();
    act(() => { useHealthStore.setState({ steps: 5200, stepsDate: '2026-10-14' }); });
    expect(utils.getByText('All missions done')).toBeTruthy();
  });

  it('moves when only the steps change, or only the day they were counted on', () => {
    useHealthStore.setState({ steps: 100, stepsDate: '2026-10-14' });
    const utils = render(<BattlePassWidget />);
    expect(utils.getByText('0/3 missions today')).toBeTruthy();
    act(() => { useHealthStore.setState({ steps: 6000 }); });
    expect(utils.getByText('1/3 missions today')).toBeTruthy();
    act(() => { useHealthStore.setState({ stepsDate: '2026-10-13' }); }); // the same count, now known to be yesterday's
    expect(utils.getByText('0/3 missions today')).toBeTruthy();
    act(() => { useHealthStore.setState({ stepsDate: '2026-10-14' }); });
    expect(utils.getByText('1/3 missions today')).toBeTruthy();
  });

  it('moves when a run or a hike arrives', () => {
    const utils = render(<BattlePassWidget />);
    act(() => { useRunningStore.setState({ runs: [run(14)] }); });
    expect(utils.getByText('1/3 missions today')).toBeTruthy();
    utils.unmount();
    useRunningStore.setState({ runs: [] });
    const again = render(<BattlePassWidget />);
    act(() => { useHikingStore.setState({ completedHikes: [{ id: 'h', startTime: noon(14), completedAt: noon(14) }] }); });
    expect(again.getByText('1/3 missions today')).toBeTruthy();
  });

  it('starts the missions over on a new day', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout(14)] });
    const utils = render(<BattlePassWidget />);
    expect(utils.getByText('1/3 missions today')).toBeTruthy();
    jest.setSystemTime(new Date(2026, 9, 15, 9, 0)); // the next morning
    utils.rerender(<BattlePassWidget />);
    expect(utils.getByText('0/3 missions today')).toBeTruthy();
  });

  it('copes with an XP record that is missing', () => {
    useExpStore.setState({ expSystem: undefined });
    const utils = render(<BattlePassWidget />);
    expect(utils.getByText('Lv 1')).toBeTruthy();
    expect(barWidth(utils)).toBe('0%');
  });

  it('copes with a food diary that is not a list', () => {
    useNutritionStore.setState({ meals: undefined });
    expect(render(<BattlePassWidget />).getByText('0/3 missions today')).toBeTruthy();
  });
});

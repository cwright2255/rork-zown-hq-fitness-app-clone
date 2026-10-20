// Home > Muscles: the three muscles worked most in the last five days, coloured as the Health screen's heatmap colours them, and a tap
// that opens Health. jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
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
import MusclesWidget from '../components/MusclesWidget';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { useHealthStore } from '../store/healthStore';
import { fatigueToColor } from '../lib/muscleFatigue';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const dayNoon = (back) => new Date(2026, 9, 14 - back, 12, 0).toISOString(); // `back` days before the 14th, at noon
const lift = (back, kcal, exercises) => ({ id: `w${back}-${kcal}`, date: dayNoon(back), caloriesBurned: kcal, exercises: exercises.map((m) => ({ muscleGroups: m })) });
const run = (back, calories = 400) => ({ id: `r${back}`, startTime: dayNoon(back), endTime: dayNoon(back), calories });
const hike = (back, calories = 800) => ({ id: `h${back}`, startTime: dayNoon(back), completedAt: dayNoon(back), calories });
// The names shown, in the order shown.
const names = (utils) => utils.UNSAFE_root
  .findAll((n) => n.type === 'View' && n.props?.testID?.startsWith?.('home-muscle-'))
  .map((n) => n.props.testID.replace('home-muscle-', ''));
const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);
const dotColor = (utils, muscle) => {
  const row = utils.getByTestId(`home-muscle-${muscle}`);
  const dot = row.findAll((n) => n.type === 'View' && StyleSheet.flatten(n.props.style)?.borderRadius === 5)[0];
  return StyleSheet.flatten(dot.props.style).backgroundColor;
};

const HEALTH_NONE = { rookRecovery: null, sleep: { hours: 0, quality: null, date: '2026-10-14' } };

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
  useHealthStore.setState(HEALTH_NONE);
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Muscles', () => {
  it('says there is no recent load for someone who has not trained', () => {
    const utils = render(<MusclesWidget />);
    expect(utils.getByText('Muscles')).toBeTruthy();
    expect(utils.getByText('No recent load')).toBeTruthy();
    expect(utils.getByTestId('home-muscles-empty')).toBeTruthy();
    expect(utils.getByText('Last 5 days')).toBeTruthy();
    expect(names(utils)).toEqual([]);
  });

  it('lists the muscles a workout worked, the most worked first, each with its name written out', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, 300, [['chest'], ['chest', 'triceps']])] });
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual(['chest', 'triceps']);
    expect(utils.getByText('Chest')).toBeTruthy();
    expect(utils.getByText('Triceps')).toBeTruthy();
    expect(utils.queryByText('No recent load')).toBeNull();
    expect(utils.queryByTestId('home-muscles-empty')).toBeNull();
  });

  it('shows only the three most worked of the muscles there are', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, 400, [['chest'], ['chest'], ['back'], ['biceps'], ['shoulders']])] });
    expect(names(render(<MusclesWidget />))).toEqual(['chest', 'back', 'biceps']); // equal ones in alphabetical order
  });

  it('colours each one the way the Health heatmap does: the most worked is the hottest', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, 300, [['chest'], ['chest', 'triceps']])] });
    const utils = render(<MusclesWidget />);
    expect(dotColor(utils, 'chest')).toBe(fatigueToColor(100));
    expect(dotColor(utils, 'chest')).toBe('#DC2626');
    expect(dotColor(utils, 'triceps')).toBe('#22C55E'); // a third of the top one
  });

  it('counts the same muscle under its other names as one', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, 300, [['quads'], ['Quadriceps'], ['abs']])] });
    expect(names(render(<MusclesWidget />))).toEqual(['quadriceps', 'core']);
  });

  it('writes a muscle with an underscore as two words', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, 300, [['upper_back']])] });
    expect(render(<MusclesWidget />).getByText('Upper back')).toBeTruthy();
  });

  it('counts a run on its legs: the quads most, then the glutes and the hamstrings', () => {
    useRunningStore.setState({ runs: [run(0)] });
    expect(names(render(<MusclesWidget />))).toEqual(['quadriceps', 'glutes', 'hamstrings']);
  });

  it('counts a hike on its legs: the glutes and the quads, then the calves', () => {
    useHikingStore.setState({ completedHikes: [hike(0)] });
    expect(names(render(<MusclesWidget />))).toEqual(['glutes', 'quadriceps', 'calves']);
  });

  it('lets a lift two days ago count for less than one today', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, 100, [['biceps']]), lift(2, 300, [['calves']])] });
    // Today's 100 kcal is worth about 0.92 of itself; two days ago, 300 kcal is worth about 0.5 of itself: calves first.
    expect(names(render(<MusclesWidget />))).toEqual(['calves', 'biceps']);
  });

  it('forgets work that is more than five days old', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(6, 500, [['chest']]), lift(0, 100, [['biceps']])] });
    expect(names(render(<MusclesWidget />))).toEqual(['biceps']);
  });

  it('says no recent load when everything is more than five days old', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(6, 500, [['chest']])], completedHikes: [hike(8)] });
    const utils = render(<MusclesWidget />);
    expect(utils.getByText('No recent load')).toBeTruthy();
    expect(names(utils)).toEqual([]);
  });

  it('skips a workout with no exercises, no muscles or no date', () => {
    useWorkoutStore.setState({
      completedWorkouts: [{ id: 'a', date: dayNoon(0), caloriesBurned: 300 }, lift(0, 300, [[]]), { id: 'b', exercises: [{ muscleGroups: ['chest'] }] }, lift(0, 100, [['biceps']])],
    });
    expect(names(render(<MusclesWidget />))).toEqual(['biceps']);
  });

  describe('how rested the person is changes how long the work lingers, as on the Health screen', () => {
    // Chest, a heavy day four days ago, and triceps, a light one today. With no recovery reading the triceps lead.
    const setLifts = () => useWorkoutStore.setState({ completedWorkouts: [lift(4, 300, [['chest']]), lift(0, 100, [['triceps']])] });

    it('goes by neutral recovery with nothing known', () => {
      setLifts();
      expect(names(render(<MusclesWidget />))).toEqual(['triceps', 'chest']);
    });

    it('lets poor sleep keep the older work lingering, so the chest leads', () => {
      setLifts();
      useHealthStore.setState({ sleep: { hours: 4, quality: 'poor', date: '2026-10-14' } });
      expect(names(render(<MusclesWidget />))).toEqual(['chest', 'triceps']);
    });

    it('lets good sleep clear the older work, so the chest is gone', () => {
      setLifts();
      useHealthStore.setState({ sleep: { hours: 8, quality: 'good', date: '2026-10-14' } });
      expect(names(render(<MusclesWidget />))).toEqual(['triceps']);
    });

    it('goes by the wearable\'s reading over the sleep that was logged', () => {
      setLifts();
      useHealthStore.setState({ sleep: { hours: 4, quality: 'poor', date: '2026-10-14' }, rookRecovery: { sleepHours: 8, sleepEfficiency: 92, hrv: null, source: 'apple' } });
      expect(names(render(<MusclesWidget />))).toEqual(['triceps']); // the wearable says well rested, the logged sleep does not count
    });

    it('moves when the sleep changes while the screen is open', () => {
      setLifts();
      const utils = render(<MusclesWidget />);
      expect(names(utils)).toEqual(['triceps', 'chest']);
      act(() => { useHealthStore.setState({ sleep: { hours: 4, quality: 'poor', date: '2026-10-14' } }); });
      expect(names(utils)).toEqual(['chest', 'triceps']);
      act(() => { useHealthStore.setState({ rookRecovery: { sleepHours: 8, sleepEfficiency: 92, hrv: null, source: 'apple' } }); });
      expect(names(utils)).toEqual(['triceps']);
    });
  });

  it('has a body for its icon', () => {
    expect(iconNames(render(<MusclesWidget />))).toEqual(['body-outline', 'chevron-forward']);
  });

  it('opens Health when tapped', () => {
    const utils = render(<MusclesWidget />);
    fireEvent.press(utils.getByTestId('home-widget-muscles'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/health');
  });

  it('is a button for a screen reader that names the muscles', () => {
    useRunningStore.setState({ runs: [run(0)] });
    const card = render(<MusclesWidget />).getByTestId('home-widget-muscles');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Muscles, last 5 days: most worked are Quadriceps, Glutes, Hamstrings. Opens Health.');
  });

  it('says so to a screen reader when there is nothing', () => {
    expect(render(<MusclesWidget />).getByTestId('home-widget-muscles').props.accessibilityLabel)
      .toBe('Muscles: no recent load in the last 5 days. Opens Health.');
  });

  it('moves when a workout, a run or a hike is finished, without leaving the screen', () => {
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual([]);
    act(() => { useWorkoutStore.setState({ completedWorkouts: [lift(0, 300, [['chest']])] }); });
    expect(names(utils)).toEqual(['chest']);
    act(() => { useRunningStore.setState({ runs: [run(0, 5000)] }); });
    expect(names(utils)[0]).toBe('quadriceps');
    act(() => { useRunningStore.setState({ runs: [] }); });
    expect(names(utils)).toEqual(['chest']);
    act(() => { useHikingStore.setState({ completedHikes: [hike(0, 9000)] }); });
    expect(names(utils)[0]).toBe('glutes');
  });

  it('works the ranking out again on a new day, as the work ages', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(4, 300, [['chest']]), lift(0, 100, [['triceps']])] });
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual(['triceps', 'chest']);
    jest.setSystemTime(new Date(2026, 9, 16, 9, 0)); // two days on: the chest day, the 10th, is now almost six days old
    utils.rerender(<MusclesWidget />);
    expect(names(utils)).toEqual(['triceps']);
  });
});

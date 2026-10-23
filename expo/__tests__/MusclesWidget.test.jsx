// Home > Muscles: the three muscles that are least recovered (lib/muscleRecovery.js), coloured as the Health screen's heatmap colours them,
// and a tap that opens Health. The recovery model itself is tested in muscleRecovery.test.js; the expected orders and colours below were worked
// out by hand from its rules (9:30 PM on the 14th, noon that day is 9.5 hours before). jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
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
let counter = 0;
const sets = (k, rpe = 'hard') => Array.from({ length: k }, () => ({ weight: 50, reps: 8, rpe }));
// A finished exercise the library knows, with k hard sets logged.
const named = (name, k) => ({ name, sets: k, reps: 8, done: true, performed: sets(k) });
// A finished exercise the library does not know, so its muscles come from its tags (the first one is the main muscle), with k hard sets logged.
const tagged = (tags, k = 4) => ({ name: 'Custom move', sets: k, reps: 8, muscleGroups: tags, done: true, performed: sets(k) });
const lift = (back, ...exercises) => ({ id: `w${counter++}`, date: dayNoon(back), exercises });
const run = (back, minutes = 60) => ({ id: `r${back}-${minutes}`, startTime: dayNoon(back), endTime: dayNoon(back), duration: minutes * 60 });
const hike = (back, minutes = 60) => ({ id: `h${back}-${minutes}`, startTime: dayNoon(back), completedAt: dayNoon(back), durationSeconds: minutes * 60 });
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
    expect(utils.getByText('Still recovering')).toBeTruthy();
    expect(utils.queryByText('Last 5 days')).toBeNull();
    expect(names(utils)).toEqual([]);
  });

  it('lists the muscles a workout tired, the most tired first, each with its name written out', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, tagged(['chest', 'triceps']))] });
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual(['chest', 'triceps']); // chest 30% tired, triceps 13%
    expect(utils.getByText('Chest')).toBeTruthy();
    expect(utils.getByText('Triceps')).toBeTruthy();
    expect(utils.queryByText('No recent load')).toBeNull();
    expect(utils.queryByTestId('home-muscles-empty')).toBeNull();
  });

  it('shows only the three most tired of the muscles there are', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, tagged(['chest', 'lats', 'biceps', 'shoulders', 'traps']))] });
    // chest 30, lats 14, then biceps, shoulders and traps all 13: equal ones in alphabetical order
    expect(names(render(<MusclesWidget />))).toEqual(['chest', 'lats', 'biceps']);
  });

  it('colours each one the way the Health heatmap does: 94% tired is red, 44% is green', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, named('Barbell Bench Press', 12))] });
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual(['chest', 'shoulders', 'triceps']);
    expect(dotColor(utils, 'chest')).toBe(fatigueToColor(94));
    expect(dotColor(utils, 'chest')).toBe('#DC2626');
    expect(dotColor(utils, 'shoulders')).toBe('#22C55E');
    expect(dotColor(utils, 'triceps')).toBe('#22C55E');
  });

  it('colours hard work from six days ago as nearly fresh: the chest is 9% tired, blue', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(6, named('Barbell Bench Press', 12))] });
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual(['chest']);
    expect(dotColor(utils, 'chest')).toBe('#3B82F6');
  });

  it('counts the same muscle under its other names as one', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, tagged(['quads']), tagged(['Quadriceps']), tagged(['abs']))] });
    expect(names(render(<MusclesWidget />))).toEqual(['quadriceps', 'core']);
  });

  it('writes a muscle with an underscore as two words', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, tagged(['upper_back']))] });
    expect(render(<MusclesWidget />).getByText('Upper back')).toBeTruthy();
  });

  it('counts a program-day exercise that has no muscle tags, through the exercise library: the chest, and the helpers at half', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, { name: 'Bench Press', sets: 4, reps: '8-10' })] });
    // an older record with no sets logged counts its four planned sets as moderate: chest 2.4 effective sets, shoulders and triceps 1.2
    expect(names(render(<MusclesWidget />))).toEqual(['chest', 'shoulders', 'triceps']);
  });

  it('counts a run on its legs: the quads most, then the glutes and the hamstrings', () => {
    useRunningStore.setState({ runs: [run(0)] });
    expect(names(render(<MusclesWidget />))).toEqual(['quadriceps', 'glutes', 'hamstrings']);
  });

  it('counts a hike on its legs: the glutes and the quads, then the hamstrings', () => {
    useHikingStore.setState({ completedHikes: [hike(0)] });
    expect(names(render(<MusclesWidget />))).toEqual(['glutes', 'quadriceps', 'hamstrings']);
  });

  it('lets heavy work from two days ago outrank a light set today, and light work count for less than the same work today', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, tagged(['biceps'])), lift(2, tagged(['calves'], 12))] });
    expect(names(render(<MusclesWidget />))).toEqual(['calves', 'biceps']); // calves 54% tired, biceps 28%
    useWorkoutStore.setState({ completedWorkouts: [lift(0, tagged(['biceps'])), lift(2, tagged(['calves'], 4))] });
    expect(names(render(<MusclesWidget />))).toEqual(['biceps', 'calves']); // calves 2%
  });

  it('forgets work once it has cleared: eight days after the hardest session there is nothing left', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(8, named('Barbell Bench Press', 12)), lift(0, tagged(['biceps']))] });
    expect(names(render(<MusclesWidget />))).toEqual(['biceps']);
  });

  it('says no recent load when everything has cleared', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(8, named('Barbell Bench Press', 12))], completedHikes: [hike(10)] });
    const utils = render(<MusclesWidget />);
    expect(utils.getByText('No recent load')).toBeTruthy();
    expect(names(utils)).toEqual([]);
  });

  it('skips a workout with no exercises, no muscles or no date', () => {
    useWorkoutStore.setState({
      completedWorkouts: [
        { id: 'a', date: dayNoon(0) },
        lift(0, { name: 'Custom move', sets: 4, done: true }),
        { id: 'b', exercises: [named('Barbell Bench Press', 4)] },
        lift(0, tagged(['biceps'])),
      ],
    });
    expect(names(render(<MusclesWidget />))).toEqual(['biceps']);
  });

  describe('how rested the person is changes how long the work lingers, as on the Health screen', () => {
    // Chest, a big day four days ago (twelve sets planned, none logged), and triceps, two hard sets today.
    const bigChestDay = { name: 'Barbell Bench Press', sets: 12, reps: 8 };
    const setLifts = () => useWorkoutStore.setState({ completedWorkouts: [lift(4, bigChestDay), lift(0, tagged(['triceps'], 2))] });

    it('goes by neutral recovery with nothing known', () => {
      setLifts();
      expect(names(render(<MusclesWidget />))).toEqual(['triceps', 'chest']); // triceps 13% tired, chest 6%
    });

    it('lets poor sleep keep the older work lingering, so the chest leads', () => {
      setLifts();
      useHealthStore.setState({ sleep: { hours: 4, quality: 'poor', date: '2026-10-14' } });
      expect(names(render(<MusclesWidget />))).toEqual(['chest', 'triceps']); // chest 19%, triceps 14%
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
    expect(card.props.accessibilityLabel).toBe('Muscles still recovering, least recovered first: Quadriceps, Glutes, Hamstrings. Opens Health.');
  });

  it('says so to a screen reader when there is nothing', () => {
    expect(render(<MusclesWidget />).getByTestId('home-widget-muscles').props.accessibilityLabel)
      .toBe('Muscles: none still recovering. Opens Health.');
  });

  it('moves when a workout, a run or a hike is finished, without leaving the screen', () => {
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual([]);
    act(() => { useWorkoutStore.setState({ completedWorkouts: [lift(0, tagged(['chest']))] }); });
    expect(names(utils)).toEqual(['chest']);
    act(() => { useRunningStore.setState({ runs: [run(0, 300)] }); });
    expect(names(utils)[0]).toBe('quadriceps');
    act(() => { useRunningStore.setState({ runs: [] }); });
    expect(names(utils)).toEqual(['chest']);
    act(() => { useHikingStore.setState({ completedHikes: [hike(0, 300)] }); });
    expect(names(utils)[0]).toBe('glutes');
  });

  it('works the list out again on a new day, as the work ages', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(4, { name: 'Barbell Bench Press', sets: 12, reps: 8 }), lift(0, tagged(['triceps'], 12))] });
    const utils = render(<MusclesWidget />);
    expect(names(utils)).toEqual(['triceps', 'chest']);
    jest.setSystemTime(new Date(2026, 9, 16, 9, 0)); // two days on: the chest day, the 10th, is now almost six days old
    utils.rerender(<MusclesWidget />);
    expect(names(utils)).toEqual(['triceps']);
  });
});

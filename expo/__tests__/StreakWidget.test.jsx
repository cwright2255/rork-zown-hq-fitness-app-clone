// Home > Workout Streak: the streak (days in a row with a workout, a run or a hike), the last 7 days as dots, and a tap that
// opens the Streak Calendar. jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import StreakWidget from '../components/StreakWidget';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { tokens } from '../../theme/tokens';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const workout = (completedAt) => ({ id: `w-${completedAt}`, completedAt });
const run = (at) => ({ id: `r-${at}`, startTime: at, endTime: at });
const hike = (at) => ({ id: `h-${at}`, startTime: at, completedAt: at });
// Noon on a day, local time.
const noon = (d) => new Date(2026, 9, d, 12, 0).toISOString();

const dots = (utils) => utils.UNSAFE_root
  .findAll((n) => n.type === 'View' && [tokens.colors.brand.base, tokens.colors.sky.light].includes(StyleSheet.flatten(n.props.style)?.backgroundColor))
  .map((n) => StyleSheet.flatten(n.props.style).backgroundColor === tokens.colors.brand.base);

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Workout Streak', () => {
  it('is labelled the workout streak, and says so when there is none', () => {
    const utils = render(<StreakWidget />);
    expect(utils.getByText('Workout Streak')).toBeTruthy();
    expect(utils.getByText('0')).toBeTruthy();
    expect(utils.getByText('Train today to start one')).toBeTruthy();
    expect(utils.getByLabelText('Workout streak: no streak yet. Opens the streak calendar.')).toBeTruthy();
  });

  it('shows the same streak the Profile does: workouts, runs and hikes all count', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout(noon(14))] });
    useRunningStore.setState({ runs: [run(noon(13))] });
    useHikingStore.setState({ completedHikes: [hike(noon(12))] });
    const utils = render(<StreakWidget />);
    expect(utils.getByTestId('home-widget-streak')).toBeTruthy();
    expect(utils.getByText('3')).toBeTruthy();
    expect(utils.getByText('days in a row')).toBeTruthy();
    expect(utils.getByLabelText('Workout streak: 3 days in a row. Opens the streak calendar.')).toBeTruthy();
  });

  it('says "day" for a streak of one', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout(noon(14))] });
    const utils = render(<StreakWidget />);
    expect(utils.getByText('1')).toBeTruthy();
    expect(utils.getByText('day in a row')).toBeTruthy();
  });

  it('keeps the streak going when only yesterday had one, and ends it after a whole day without', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout(noon(13)), workout(noon(12))] });
    const kept = render(<StreakWidget />);
    expect(kept.getByText('2')).toBeTruthy(); // today (the 14th) not trained yet: yesterday keeps it
    kept.unmount();
    useWorkoutStore.setState({ completedWorkouts: [workout(noon(12)), workout(noon(11))] });
    expect(render(<StreakWidget />).getByText('0')).toBeTruthy(); // the 13th had none
  });

  it('draws the last 7 days as dots and colours in the days with something done, today last', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout(noon(14)), workout(noon(12))] });
    const d = dots(render(<StreakWidget />));
    expect(d).toHaveLength(7);
    expect(d).toEqual([false, false, false, false, true, false, true]); // the 8th to the 14th: the 12th and the 14th
  });

  it('colours in a day with a run only, or a hike only', () => {
    useRunningStore.setState({ runs: [run(noon(10))] });
    useHikingStore.setState({ completedHikes: [hike(noon(9))] });
    const d = dots(render(<StreakWidget />));
    expect(d).toEqual([false, true, true, false, false, false, false]);
  });

  it('opens the Streak Calendar when tapped', () => {
    const utils = render(<StreakWidget />);
    fireEvent.press(utils.getByTestId('home-widget-streak'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/profile/streak');
  });

  it('is a button for a screen reader', () => {
    const utils = render(<StreakWidget />);
    expect(utils.getByTestId('home-widget-streak').props.accessibilityRole).toBe('button');
  });

  it('updates when a workout is finished, without leaving the screen', () => {
    const utils = render(<StreakWidget />);
    expect(utils.getByText('0')).toBeTruthy();
    act(() => { useWorkoutStore.setState({ completedWorkouts: [workout(noon(14))] }); });
    expect(utils.getByText('1')).toBeTruthy();
    expect(dots(utils)[6]).toBe(true);
  });

  it('copes with records that have no usable date', () => {
    useWorkoutStore.setState({ completedWorkouts: [{ id: 'bad' }, { id: 'bad2', completedAt: 'soon' }, workout(noon(14))] });
    expect(render(<StreakWidget />).getByText('1')).toBeTruthy();
  });
});

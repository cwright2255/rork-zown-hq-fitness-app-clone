// Home > Training Load: the same reading as the Health screen's Training Load card, as one number, a few words and a marker, and
// a tap that opens Health. jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
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
import TrainingLoadWidget from '../components/TrainingLoadWidget';
import { ZONE_COLOR } from '../components/TrainingLoadCard';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { aggregateDailyLoad, calculateTrainingLoad } from '../lib/trainingLoad';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const dayNoon = (back) => new Date(2026, 9, 14 - back, 12, 0).toISOString(); // `back` days before the 14th, at noon
// A workout on each of the days from `from` to `to` days back (0 is the 14th), each burning `kcal`.
const workouts = (from, to, kcal) => {
  const out = [];
  for (let back = from; back <= to; back++) out.push({ id: `w${back}-${kcal}`, date: dayNoon(back), caloriesBurned: kcal });
  return out;
};
// The last 7 days at one level and the 21 before them at another: the acute load is 7 x `recent`, the chronic is the 28 days / 4.
const history = (recent, before) => [...workouts(0, 6, recent), ...workouts(7, 27, before)];
const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);
const marker = (utils) => utils.queryByTestId('home-trainingload-marker');

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Training Load', () => {
  it('says there is not enough history, with a dash and no marker, for someone who has not trained', () => {
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('Training Load')).toBeTruthy();
    expect(utils.getByText('\u2014')).toBeTruthy();
    expect(utils.getByText('Needs more history')).toBeTruthy();
    expect(marker(utils)).toBeNull();
  });

  it('says there is not enough history after only a few days of training too', () => {
    useWorkoutStore.setState({ completedWorkouts: workouts(0, 3, 500) });
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('Needs more history')).toBeTruthy();
    expect(marker(utils)).toBeNull();
  });

  it('shows a steady week as 1.00, in your range, with the marker in the middle', () => {
    useWorkoutStore.setState({ completedWorkouts: history(500, 500) });
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('1.00')).toBeTruthy();
    expect(utils.getByText('In your range')).toBeTruthy();
    const style = StyleSheet.flatten(marker(utils).props.style);
    expect(style.left).toBe('50%');
    expect(style.backgroundColor).toBe(ZONE_COLOR.sweet_spot);
  });

  it('shows a lighter week as below usual', () => {
    useWorkoutStore.setState({ completedWorkouts: history(200, 500) });
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('0.47')).toBeTruthy();
    expect(utils.getByText('Below usual')).toBeTruthy();
    expect(StyleSheet.flatten(marker(utils).props.style)).toMatchObject({ left: '23.5%', backgroundColor: ZONE_COLOR.detraining });
  });

  it('shows a heavier week as above usual', () => {
    useWorkoutStore.setState({ completedWorkouts: history(800, 500) });
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('1.39')).toBeTruthy();
    expect(utils.getByText('Above usual')).toBeTruthy();
    expect(StyleSheet.flatten(marker(utils).props.style).backgroundColor).toBe(ZONE_COLOR.elevated);
  });

  it('shows a spike as well above usual', () => {
    useWorkoutStore.setState({ completedWorkouts: history(1000, 500) });
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('1.60')).toBeTruthy();
    expect(utils.getByText('Well above usual')).toBeTruthy();
    expect(StyleSheet.flatten(marker(utils).props.style)).toMatchObject({ left: '80%', backgroundColor: ZONE_COLOR.high });
  });

  it('stops the marker at the end of the bar for a reading off the scale', () => {
    useWorkoutStore.setState({ completedWorkouts: workouts(0, 6, 3000) }); // all of the month in one week: 4.00
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('4.00')).toBeTruthy();
    expect(StyleSheet.flatten(marker(utils).props.style).left).toBe('100%');
  });

  it('shows the same number as the Health screen works out, with runs and hikes counted as well', () => {
    const w = workouts(0, 9, 400);
    const r = [10, 12, 14, 16, 18].map((back) => ({ id: `r${back}`, startTime: dayNoon(back), endTime: dayNoon(back), calories: 600 }));
    const h = [20, 22].map((back) => ({ id: `h${back}`, startTime: dayNoon(back), completedAt: dayNoon(back), calories: 900 }));
    useWorkoutStore.setState({ completedWorkouts: w });
    useRunningStore.setState({ runs: r });
    useHikingStore.setState({ completedHikes: h });
    const expected = calculateTrainingLoad(aggregateDailyLoad({ completedWorkouts: w, runs: r, completedHikes: h }));
    expect(expected.ratio).not.toBeNull();
    expect(render(<TrainingLoadWidget />).getByText(expected.ratio.toFixed(2))).toBeTruthy();
  });

  it('counts a run on its own as training', () => {
    const r = Array.from({ length: 28 }, (_, back) => ({ id: `r${back}`, startTime: dayNoon(back), endTime: dayNoon(back), calories: 500 }));
    useRunningStore.setState({ runs: r });
    expect(render(<TrainingLoadWidget />).getByText('1.00')).toBeTruthy();
  });

  it('counts a hike on its own as training', () => {
    const h = Array.from({ length: 28 }, (_, back) => ({ id: `h${back}`, startTime: dayNoon(back), completedAt: dayNoon(back), calories: 500 }));
    useHikingStore.setState({ completedHikes: h });
    expect(render(<TrainingLoadWidget />).getByText('1.00')).toBeTruthy();
  });

  it('has a speedometer for its icon', () => {
    expect(iconNames(render(<TrainingLoadWidget />))).toEqual(['speedometer-outline', 'chevron-forward']);
  });

  it('shades the usual range, 0.8 to 1.3, on a bar that runs from 0 to 2, as the Health card does', () => {
    const band = StyleSheet.flatten(render(<TrainingLoadWidget />).getByTestId('home-trainingload-band').props.style);
    expect(band.left).toBe(`${(0.8 / 2) * 100}%`);
    expect(band.width).toBe(`${((1.3 - 0.8) / 2) * 100}%`);
  });

  it('opens Health when tapped', () => {
    const utils = render(<TrainingLoadWidget />);
    fireEvent.press(utils.getByTestId('home-widget-trainingload'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/health');
  });

  it('is a button for a screen reader that says the reading', () => {
    useWorkoutStore.setState({ completedWorkouts: history(500, 500) });
    const card = render(<TrainingLoadWidget />).getByTestId('home-widget-trainingload');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Training load 1.00, in your range. Opens Health.');
  });

  it('says so to a screen reader when there is not enough history', () => {
    const card = render(<TrainingLoadWidget />).getByTestId('home-widget-trainingload');
    expect(card.props.accessibilityLabel).toBe('Training load: not enough history yet. Opens Health.');
  });

  it('moves when a workout is finished, without leaving the screen', () => {
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('Needs more history')).toBeTruthy();
    act(() => { useWorkoutStore.setState({ completedWorkouts: history(500, 500) }); });
    expect(utils.getByText('1.00')).toBeTruthy();
    act(() => { useWorkoutStore.setState({ completedWorkouts: history(1000, 500) }); });
    expect(utils.getByText('1.60')).toBeTruthy();
  });

  it('moves when a run or a hike arrives', () => {
    useWorkoutStore.setState({ completedWorkouts: history(500, 500) });
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('1.00')).toBeTruthy();
    act(() => { useRunningStore.setState({ runs: [{ id: 'big', startTime: dayNoon(0), endTime: dayNoon(0), calories: 2000 }] }); });
    expect(utils.queryByText('1.00')).toBeNull();
    act(() => { useRunningStore.setState({ runs: [] }); });
    expect(utils.getByText('1.00')).toBeTruthy();
    act(() => { useHikingStore.setState({ completedHikes: [{ id: 'big', startTime: dayNoon(0), completedAt: dayNoon(0), calories: 2000 }] }); });
    expect(utils.queryByText('1.00')).toBeNull();
  });

  it('works out the reading again on a new day', () => {
    useWorkoutStore.setState({ completedWorkouts: workouts(0, 27, 500) }); // a steady month up to the 14th
    const utils = render(<TrainingLoadWidget />);
    expect(utils.getByText('1.00')).toBeTruthy();
    jest.setSystemTime(new Date(2026, 9, 15, 9, 0)); // the next morning, nothing done on the 15th yet
    utils.rerender(<TrainingLoadWidget />);
    expect(utils.getByText('0.89')).toBeTruthy();
  });

  it('skips records with no usable date or calories', () => {
    useWorkoutStore.setState({ completedWorkouts: [...history(500, 500), { id: 'x' }, { id: 'y', date: 'soon', caloriesBurned: 900 }, { id: 'z', date: dayNoon(1) }] });
    expect(render(<TrainingLoadWidget />).getByText('1.00')).toBeTruthy();
  });
});

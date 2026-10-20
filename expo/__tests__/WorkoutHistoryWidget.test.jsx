// Home > Workout History: workouts, calories and time for the last 7 days, this month and everything logged, the latest workout, and a
// button that opens Workout History. jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import WorkoutHistoryWidget from '../components/WorkoutHistoryWidget';
import { useWorkoutStore } from '../store/workoutStore';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const dayNoon = (back) => new Date(2026, 9, 14 - back, 12, 0).toISOString(); // `back` days before the 14th, at noon
const lift = (back, o = {}) => ({ id: `w${back}`, name: 'Full Body', completedAt: dayNoon(back), duration: 1800, caloriesBurned: 300, ...o });
const pageValues = (utils, key) => utils.getByTestId(`home-widget-workouthistory-page-${key}`)
  .findAll((n) => n.type === 'Text')
  .map((n) => n.props.children);

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useWorkoutStore.setState({ completedWorkouts: [] });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Workout History', () => {
  it('says there are no workouts yet for someone who has not finished one, and still offers the full log', () => {
    const utils = render(<WorkoutHistoryWidget />);
    expect(utils.getByText('Workout History')).toBeTruthy();
    expect(utils.getByTestId('home-widget-workouthistory-empty').props.children).toBe('No workouts yet. Finish one and it shows up here.');
    expect(utils.queryByTestId('home-widget-workouthistory-pager')).toBeNull();
    expect(utils.getByText('View Full Log')).toBeTruthy();
  });

  it('shows workouts, calories and time on each page', () => {
    useWorkoutStore.setState({
      completedWorkouts: [lift(10), lift(3, { caloriesBurned: 450, duration: 3600, name: 'Legs' }), lift(0, { caloriesBurned: 250, duration: 2700, name: 'Arms' })],
    });
    const utils = render(<WorkoutHistoryWidget />);
    expect(pageValues(utils, 'week')).toEqual(['Last 7 days', '2', 'Workouts', '700', 'Calories', '1h 45m', 'Time']);
    expect(pageValues(utils, 'month')).toEqual(['This month', '3', 'Workouts', (1000).toLocaleString(), 'Calories', '2h 15m', 'Time']);
    expect(pageValues(utils, 'all')).toEqual(['All logged', '3', 'Workouts', (1000).toLocaleString(), 'Calories', '2h 15m', 'Time']);
    expect(utils.queryByTestId('home-widget-workouthistory-empty')).toBeNull();
  });

  it('shows the latest workout, whichever end of the list it is at', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0, { name: 'Arms' }), lift(3, { name: 'Legs' })] }); // newest first, as the server sends them
    const first = render(<WorkoutHistoryWidget />);
    expect(first.getByTestId('home-widget-workouthistory-latest').props.children).toBe('Latest: Arms \u00B7 Today');
    first.unmount();
    useWorkoutStore.setState({ completedWorkouts: [lift(3, { name: 'Legs' }), lift(1, { name: 'Core' })] }); // oldest first, as the phone keeps them
    const utils = render(<WorkoutHistoryWidget />);
    expect(utils.getByTestId('home-widget-workouthistory-latest').props.children).toBe('Latest: Core \u00B7 Yesterday');
  });

  it('is titled and iconed as its Home widget', () => {
    const utils = render(<WorkoutHistoryWidget />);
    expect(utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name)).toEqual(['barbell-outline']);
    expect(utils.getByTestId('home-widget-workouthistory')).toBeTruthy();
  });

  it('opens Workout History from the button', () => {
    const utils = render(<WorkoutHistoryWidget />);
    fireEvent.press(utils.getByTestId('home-widget-workouthistory-open'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/profile/workout-history');
  });

  it('reads the card to a screen reader as a sentence', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0)] });
    const utils = render(<WorkoutHistoryWidget />);
    expect(utils.getByLabelText(/^Workout history\. Last 7 days: 1 workout, 300 calories, 30m\./)).toBeTruthy();
  });

  it('updates when a workout is finished', () => {
    const utils = render(<WorkoutHistoryWidget />);
    expect(utils.getByTestId('home-widget-workouthistory-empty')).toBeTruthy();
    act(() => { useWorkoutStore.setState({ completedWorkouts: [lift(0)] }); });
    expect(utils.queryByTestId('home-widget-workouthistory-empty')).toBeNull();
    expect(pageValues(utils, 'week').slice(0, 3)).toEqual(['Last 7 days', '1', 'Workouts']);
    expect(utils.getByTestId('home-widget-workouthistory-latest').props.children).toBe('Latest: Full Body \u00B7 Today');
  });
});

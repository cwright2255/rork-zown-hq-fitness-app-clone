// Profile > Workout History lists the latest workout first, whatever order the stored list is in, and counts a workout that carries only
// the server's date. It used to reverse the list, which is right for a list that is oldest first and upside down for the list the server
// sends (newest first), so after a refresh the workout just finished sat at the bottom.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });

jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) })); // keeps the sign-in listener out of the test

import WorkoutHistoryScreen from '../app/profile/workout-history';
import { useWorkoutStore } from '../store/workoutStore';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const dayNoon = (back) => new Date(2026, 9, 14 - back, 12, 0).toISOString(); // `back` days before the 14th, at noon
const lift = (back, o = {}) => ({ id: `w${back}`, name: `Lift ${back} days ago`, completedAt: dayNoon(back), duration: 1800, caloriesBurned: 300, ...o });
const titles = (utils) => utils.getAllByText(/^Lift .* days ago$|^Server only$/).map((n) => n.props.children);

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useWorkoutStore.setState({ completedWorkouts: [] });
});
afterEach(() => { jest.useRealTimers(); });

describe('Workout History order', () => {
  it('shows the latest workout first when the list is newest first, as the server sends it', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0), lift(3), lift(9)] });
    expect(titles(render(<WorkoutHistoryScreen />))).toEqual(['Lift 0 days ago', 'Lift 3 days ago', 'Lift 9 days ago']);
  });

  it('shows the latest workout first when the list is oldest first, as the phone used to save it', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(9), lift(3), lift(0)] });
    expect(titles(render(<WorkoutHistoryScreen />))).toEqual(['Lift 0 days ago', 'Lift 3 days ago', 'Lift 9 days ago']);
  });

  it('shows the latest workout first when the list is in no order at all', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(3), lift(9), lift(0), lift(5)] });
    expect(titles(render(<WorkoutHistoryScreen />))).toEqual(['Lift 0 days ago', 'Lift 3 days ago', 'Lift 5 days ago', 'Lift 9 days ago']);
  });

  it('keeps the newest first under a filter too', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(2), lift(0), lift(40), lift(5)] });
    const utils = render(<WorkoutHistoryScreen />);
    fireEvent.press(utils.getByText('Week'));
    expect(titles(utils)).toEqual(['Lift 0 days ago', 'Lift 2 days ago', 'Lift 5 days ago']);
  });
});

describe('a workout that carries only the server date', () => {
  const serverOnly = (back) => ({ id: 'srv', name: 'Server only', duration: 600, caloriesBurned: 80, date: { toDate: () => new Date(dayNoon(back)) } });

  it('is listed with its day, not "Unknown Date"', () => {
    useWorkoutStore.setState({ completedWorkouts: [serverOnly(1)] });
    const utils = render(<WorkoutHistoryScreen />);
    expect(utils.getByText('Server only')).toBeTruthy();
    expect(utils.queryByText(/Unknown Date/)).toBeNull();
    expect(utils.getByText(/Oct 13, 2026/)).toBeTruthy();
  });

  it('is in the Week and Month filters when it falls there, and placed by its date', () => {
    useWorkoutStore.setState({ completedWorkouts: [lift(0), serverOnly(1), lift(3)] });
    const utils = render(<WorkoutHistoryScreen />);
    fireEvent.press(utils.getByText('Week'));
    expect(titles(utils)).toEqual(['Lift 0 days ago', 'Server only', 'Lift 3 days ago']);
    fireEvent.press(utils.getByText('Month'));
    expect(titles(utils)).toEqual(['Lift 0 days ago', 'Server only', 'Lift 3 days ago']);
  });

  it('is left out of Week when it is older than a week', () => {
    useWorkoutStore.setState({ completedWorkouts: [serverOnly(20), lift(1)] });
    const utils = render(<WorkoutHistoryScreen />);
    fireEvent.press(utils.getByText('Week'));
    expect(titles(utils)).toEqual(['Lift 1 days ago']);
  });
});

describe('a record with no time at all', () => {
  it('is still listed under All, last, as "Unknown Date", and is left out of a dated filter', () => {
    useWorkoutStore.setState({ completedWorkouts: [{ id: 'x', name: 'Lift 99 days ago', duration: 60 }, lift(0)] });
    const utils = render(<WorkoutHistoryScreen />);
    expect(titles(utils)).toEqual(['Lift 0 days ago', 'Lift 99 days ago']);
    expect(utils.getByText(/Unknown Date/)).toBeTruthy();
    expect(utils.queryByText(/Invalid Date/)).toBeNull();
    fireEvent.press(utils.getByText('Year'));
    expect(titles(utils)).toEqual(['Lift 0 days ago']);
  });
});

// The streak calendar colours in the days that had a workout, a run or a hike. It used to look them up in a
// "streakHistory" list on the user record that nothing ever filled in, so it was always empty.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });

import { router } from 'expo-router';
import StreakCalendarScreen from '../app/profile/streak';
import StreakCalendar from '../components/StreakCalendar';
import { useActivityDays } from '../services/streakService';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { tokens } from '../../theme/tokens';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey

beforeEach(() => { jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); });

// The dots, in order from the oldest day: the colour tells whether the day was coloured in.
const dots = (utils) => utils.UNSAFE_root
  .findAll((n) => n.type === 'View' && [tokens.colors.brand.base, tokens.colors.sky.light].includes(StyleSheet.flatten(n.props.style)?.backgroundColor))
  .map((n) => StyleSheet.flatten(n.props.style).backgroundColor === tokens.colors.brand.base);

describe('StreakCalendar', () => {
  it('shows the last 30 days, or the last 7 when compact', () => {
    expect(dots(render(<StreakCalendar />))).toHaveLength(30);
    expect(dots(render(<StreakCalendar compact />))).toHaveLength(7);
  });

  it('colours in the days it is given, today last', () => {
    const d = dots(render(<StreakCalendar days={['2026-10-14', '2026-10-12', '2026-10-01']} />));
    expect(d.filter(Boolean)).toHaveLength(3);
    expect(d[29]).toBe(true); // the 14th, today
    expect(d[27]).toBe(true); // the 12th
    expect(d[28]).toBe(false); // the 13th
    expect(d[16]).toBe(true); // the 1st
  });

  it('colours in a day at the other end of the 30, across the month change', () => {
    const d = dots(render(<StreakCalendar days={['2026-09-15', '2026-09-14']} />));
    expect(d[0]).toBe(true); // 15 Sep is 29 days back
    expect(d.filter(Boolean)).toHaveLength(1); // 14 Sep is outside
  });

  it('only shows the last 7 days when compact, and ignores the others', () => {
    const d = dots(render(<StreakCalendar compact days={['2026-10-14', '2026-10-08', '2026-10-07']} />));
    expect(d).toEqual([true, false, false, false, false, false, true].reverse());
  });

  it('rings today, and only today', () => {
    for (const compact of [false, true]) {
      const utils = render(<StreakCalendar compact={compact} days={['2026-10-14']} />);
      const rung = utils.UNSAFE_root.findAll((n) => n.type === 'View' && StyleSheet.flatten(n.props.style)?.borderWidth === 2);
      expect(rung).toHaveLength(1);
      expect(StyleSheet.flatten(rung[0].props.style).backgroundColor).toBe(tokens.colors.brand.base); // the 14th is coloured in
    }
    const empty = render(<StreakCalendar />);
    const ring = empty.UNSAFE_root.findAll((n) => n.type === 'View' && StyleSheet.flatten(n.props.style)?.borderWidth === 2);
    expect(StyleSheet.flatten(ring[0].props.style).backgroundColor).toBe(tokens.colors.sky.light);
  });

  it('colours nothing in with no days, and copes with something that is not a list', () => {
    for (const days of [undefined, null, [], 'none', { 0: '2026-10-14' }, 7]) {
      expect(dots(render(<StreakCalendar days={days} />)).some(Boolean)).toBe(false);
    }
  });

  it('numbers the days in the full view, and not in the compact one', () => {
    const full = render(<StreakCalendar />);
    expect(full.getByText('14')).toBeTruthy();
    expect(full.getByText('15')).toBeTruthy(); // 15 Sep, 29 days back
    expect(render(<StreakCalendar compact />).queryByText('14')).toBeNull();
  });

  // From a dot, up to the day's cell (the first parent that centres its children), and from there to the row.
  const up = (node, test) => { let n = node.parent; while (n && !test(StyleSheet.flatten(n.props.style) || {})) n = n.parent; return n; };
  const cellOf = (utils, day) => up(utils.getByTestId(`streak-day-${day}`), (s) => s.alignItems === 'center');
  const rowOf = (cell) => up(cell, (s) => s.flexDirection === 'row');

  it('lays the 30 days out in rows that fit a phone, not in one row of 720', () => {
    // React Native does not shrink a fixed-width child, so 30 days 24 wide ran off the right-hand edge of the screen and
    // today, the last one, was never visible.
    const utils = render(<StreakCalendar />);
    let perRow;
    for (const day of ['2026-09-15', '2026-10-14']) {
      const cell = cellOf(utils, day);
      const width = StyleSheet.flatten(cell.props.style).width;
      expect(width).toMatch(/^\d+%$/);
      perRow = Math.floor(100 / parseFloat(width));
      const row = StyleSheet.flatten(rowOf(cell).props.style);
      expect(row.flexWrap).toBe('wrap');
      expect(row.justifyContent).toBe('flex-start');
    }
    // Ten to a row at that width, so the 30 days are three rows and every one of them is on the screen.
    expect(perRow).toBe(10);
    expect(Math.ceil(30 / perRow)).toBe(3);
  });

  it('keeps the compact week as one narrow row', () => {
    const utils = render(<StreakCalendar compact />);
    const cell = cellOf(utils, '2026-10-14');
    expect(StyleSheet.flatten(cell.props.style).width).toBe(12);
    expect(StyleSheet.flatten(rowOf(cell).props.style).flexWrap).toBeUndefined();
  });
});

describe('useActivityDays', () => {
  const workout = (completedAt) => ({ id: `w-${completedAt}`, completedAt });
  const run = (at) => ({ id: `r-${at}`, startTime: at, endTime: at });
  const hike = (at) => ({ id: `h-${at}`, startTime: at, completedAt: at });

  beforeEach(() => {
    useWorkoutStore.setState({ completedWorkouts: [] });
    useRunningStore.setState({ runs: [] });
    useHikingStore.setState({ completedHikes: [] });
  });

  it('lists the days of workouts, runs and hikes, once each, oldest first', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z'), workout('2026-10-14T15:00:00Z')] });
    useRunningStore.setState({ runs: [run('2026-10-15T01:00:00Z')] }); // 9 PM on the 14th, the same day
    useHikingStore.setState({ completedHikes: [hike('2026-10-12T13:00:00Z')] });
    const { result } = renderHook(() => useActivityDays());
    expect(result.current).toEqual(['2026-10-12', '2026-10-14']);
  });

  it('is empty with nothing done, and follows a record that arrives', () => {
    const { result } = renderHook(() => useActivityDays());
    expect(result.current).toEqual([]);
    act(() => { useHikingStore.setState({ completedHikes: [hike('2026-10-13T13:00:00Z')] }); });
    expect(result.current).toEqual(['2026-10-13']);
    act(() => { useRunningStore.setState({ runs: [run('2026-10-11T13:00:00Z')] }); });
    expect(result.current).toEqual(['2026-10-11', '2026-10-13']);
    act(() => { useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-12T13:00:00Z')] }); });
    expect(result.current).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
  });
});

describe('the Streak Calendar screen (Profile > Streak Calendar)', () => {
  const workout = (completedAt) => ({ id: `w-${completedAt}`, completedAt });
  const run = (at) => ({ id: `r-${at}`, startTime: at, endTime: at });
  const dot = (utils, day) => StyleSheet.flatten(utils.getByTestId(`streak-day-${day}`).props.style);

  beforeEach(() => {
    router.back.mockClear();
    useWorkoutStore.setState({ completedWorkouts: [] });
    useRunningStore.setState({ runs: [] });
    useHikingStore.setState({ completedHikes: [] });
  });

  it('says so when nothing has been logged, and shows no streak', () => {
    const utils = render(<StreakCalendarScreen />);
    expect(utils.getByText('Streak Calendar')).toBeTruthy();
    expect(utils.getByTestId('streak-current').props.children).toBe(0);
    expect(utils.getByTestId('streak-longest').props.children).toBe(0);
    expect(utils.getByTestId('streak-calendar-caption').props.children).toMatch(/Nothing logged yet/);
    expect(dot(utils, '2026-10-14').backgroundColor).toBe(tokens.colors.sky.light);
  });

  it('colours in the real days and shows the streak worked out from the same records', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-12T13:00:00Z'), workout('2026-10-15T01:30:00Z')] }); // the 12th, and 9:30 PM on the 14th
    useRunningStore.setState({ runs: [run('2026-10-13T13:00:00Z')] });
    const utils = render(<StreakCalendarScreen />);
    for (const day of ['2026-10-12', '2026-10-13', '2026-10-14']) expect(dot(utils, day).backgroundColor).toBe(tokens.colors.brand.base);
    expect(dot(utils, '2026-10-11').backgroundColor).toBe(tokens.colors.sky.light);
    expect(utils.getByTestId('streak-current').props.children).toBe(3);
    expect(utils.getByTestId('streak-longest').props.children).toBe(3);
    expect(utils.getByTestId('streak-calendar-caption').props.children).toBe('3 of the last 30 days had a workout, a run or a hike.');
  });

  it('counts only the last 30 days in the sentence, but keeps an older best streak', () => {
    useWorkoutStore.setState({
      completedWorkouts: ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-10-01'].map((d) => workout(`${d}T13:00:00Z`)),
    });
    const utils = render(<StreakCalendarScreen />);
    expect(utils.getByTestId('streak-longest').props.children).toBe(5);
    expect(utils.getByTestId('streak-current').props.children).toBe(0); // nothing since 1 Oct
    expect(utils.getByTestId('streak-calendar-caption').props.children).toBe('1 of the last 30 days had a workout, a run or a hike.');
  });

  it('keeps the streak going through today when only yesterday has been done', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-12T13:00:00Z'), workout('2026-10-13T13:00:00Z')] });
    const utils = render(<StreakCalendarScreen />);
    expect(utils.getByTestId('streak-current').props.children).toBe(2);
    expect(dot(utils, '2026-10-14').backgroundColor).toBe(tokens.colors.sky.light); // today is not done yet
  });

  it('has a back button', () => {
    const utils = render(<StreakCalendarScreen />);
    fireEvent.press(utils.getByLabelText('Back'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('promises nothing it does not do: no XP, rewards or badges', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'profile', 'streak.jsx'), 'utf8');
    const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/\bXP\b|reward|badge|premium/i);
  });
});

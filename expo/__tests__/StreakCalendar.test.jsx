// The streak calendar colours in the days that had a workout, a run or a hike. It used to look them up in a
// "streakHistory" list on the user record that nothing ever filled in, so it was always empty.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render, renderHook } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here

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

describe('the progress screen', () => {
  // app/profile/progress.jsx is too big to render here, so this reads its source.
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'profile', 'progress.jsx'), 'utf8');

  it('gives the calendar the real days, and shows the streak worked out the same way', () => {
    expect(source).toContain('<StreakCalendar compact={false} days={activityDays} />');
    expect(source).toContain('const activityDays = useActivityDays();');
    expect(source).toContain('const workoutStreak = useActivityStreak();');
  });

  it('no longer reads the empty streak history or the workouts-only streak', () => {
    expect(source).not.toMatch(/streakData|streakHistory|getWorkoutStreak/);
  });
});

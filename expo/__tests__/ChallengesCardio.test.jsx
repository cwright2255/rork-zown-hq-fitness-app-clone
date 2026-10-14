// The Challenges screen counts runs, walks and hikes toward a joined challenge, shows that progress, and shares the
// same number on the challenge board. Before this only completed workouts moved the bar.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('../src/components/LoadingSkeleton', () => () => null);
jest.mock('@/components/AudienceFilter', () => () => null);
jest.mock('@/store/useAudience', () => ({
  useAudience: () => ({ audience: 'everyone', setAudience: () => {}, uids: [], uidKey: '' }),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', name: 'Cj' } }) }));
const mockWorkouts = { completedWorkouts: [], loadWorkouts: jest.fn() };
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => mockWorkouts }));
const mockRunning = { runs: [], loadRuns: jest.fn() };
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => mockRunning }));
const mockHiking = { completedHikes: [], loadCompletedHikes: jest.fn() };
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => mockHiking }));

import ChallengesScreen from '../app/challenges';
import { useChallengeStore } from '../store/challengeStore';

const NOW = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const WEEKLY = {
  id: 'week-2026-10-12', cadence: 'weekly', periodKey: 'week-2026-10-12', title: 'Move 4 times this week', description: 'Any workout, run or hike.',
  category: 'General', difficulty: 'beginner', goalType: 'workout_count', goalTarget: 4,
  startDate: '2026-10-12T00:00:00.000Z', endDate: '2026-10-18T23:59:59.999Z',
};
const publishMyProgress = jest.fn(async () => {});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockWorkouts.completedWorkouts = [];
  mockRunning.runs = [];
  mockHiking.completedHikes = [];
  [mockWorkouts.loadWorkouts, mockRunning.loadRuns, mockHiking.loadCompletedHikes, publishMyProgress].forEach((f) => f.mockClear());
  useChallengeStore.setState({
    challenges: [WEEKLY],
    joinedChallengeIds: new Set([WEEKLY.id]),
    isLoading: false,
    isGenerating: false,
    error: null,
    participants: {},
    participantsLoading: {},
    loadChallenges: async () => {},
    generateNewChallenges: async () => {},
    getCurrentByCadence: () => ({ daily: null, weekly: WEEKLY, monthly: null, seasonal: null }),
    loadParticipants: async () => {},
    publishMyProgress,
  });
});
afterEach(() => { jest.useRealTimers(); });

const open = async () => {
  const utils = render(<ChallengesScreen />);
  await act(async () => {});
  return utils;
};

describe('Challenges screen with runs and hikes', () => {
  it('shows a joined challenge at 0 of 4 with nothing done', async () => {
    const utils = await open();
    expect(utils.getByText(/^0\/4/)).toBeTruthy();
  });

  it('moves the bar for a run and for a hike, not only for a workout', async () => {
    mockWorkouts.completedWorkouts = [{ id: 'w1', completedAt: '2026-10-12T15:00:00.000Z' }];
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-13T14:00:00.000Z', endTime: '2026-10-13T14:30:00.000Z', distance: 5, duration: 1800 }];
    mockHiking.completedHikes = [{ id: 'h1', startTime: '2026-10-14T15:00:00.000Z', completedAt: '2026-10-14T17:00:00.000Z', distanceKm: 8 }];
    const utils = await open();
    expect(utils.getByText(/^3\/4/)).toBeTruthy();
  });

  it('completes the challenge for a person who only runs', async () => {
    mockRunning.runs = ['12', '13', '14', '14'].map((d, i) => ({ id: `r${i}`, startTime: `2026-10-${d}T1${i}:00:00.000Z`, endTime: `2026-10-${d}T1${i}:30:00.000Z`, distance: 3, duration: 1200 }));
    const utils = await open();
    expect(utils.getByText(/^4\/4 · Complete!/)).toBeTruthy();
  });

  it('does not count a run from before the challenge started', async () => {
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-05T14:00:00.000Z', endTime: '2026-10-05T14:30:00.000Z', distance: 5, duration: 1800 }];
    const utils = await open();
    expect(utils.getByText(/^0\/4/)).toBeTruthy();
  });

  it('shares the same progress on the challenge board', async () => {
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-13T14:00:00.000Z', endTime: '2026-10-13T14:30:00.000Z', distance: 5, duration: 1800 }];
    mockHiking.completedHikes = [{ id: 'h1', startTime: '2026-10-14T15:00:00.000Z', completedAt: '2026-10-14T17:00:00.000Z', distanceKm: 8 }];
    await open();
    expect(publishMyProgress).toHaveBeenCalledTimes(1);
    expect(publishMyProgress.mock.calls[0][0].progress).toEqual({ current: 2, target: 4, percent: 50, completed: false });
  });

  it('publishes the new progress when a run or a hike arrives after the screen opened', async () => {
    const utils = await open();
    expect(publishMyProgress).toHaveBeenCalledTimes(1);
    expect(publishMyProgress.mock.calls[0][0].progress.current).toBe(0);
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-13T14:00:00.000Z', endTime: '2026-10-13T14:30:00.000Z', distance: 5, duration: 1800 }];
    utils.rerender(<ChallengesScreen />);
    await act(async () => {});
    expect(publishMyProgress).toHaveBeenCalledTimes(2);
    expect(publishMyProgress.mock.calls[1][0].progress.current).toBe(1);
    mockHiking.completedHikes = [{ id: 'h1', startTime: '2026-10-14T15:00:00.000Z', completedAt: '2026-10-14T17:00:00.000Z', distanceKm: 8 }];
    utils.rerender(<ChallengesScreen />);
    await act(async () => {});
    expect(publishMyProgress).toHaveBeenCalledTimes(3);
    expect(publishMyProgress.mock.calls[2][0].progress.current).toBe(2);
  });

  it('loads the runs and hikes with the workouts when it opens', async () => {
    await open();
    expect(mockWorkouts.loadWorkouts).toHaveBeenCalledWith('u1');
    expect(mockRunning.loadRuns).toHaveBeenCalledWith('u1');
    expect(mockHiking.loadCompletedHikes).toHaveBeenCalledWith('u1');
  });

  it('shows no progress for a challenge that has not been joined', async () => {
    useChallengeStore.setState({ joinedChallengeIds: new Set() });
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-13T14:00:00.000Z', endTime: '2026-10-13T14:30:00.000Z', distance: 5, duration: 1800 }];
    const utils = await open();
    expect(utils.queryByText(/^\d\/4/)).toBeNull();
    expect(publishMyProgress).not.toHaveBeenCalled();
  });
});

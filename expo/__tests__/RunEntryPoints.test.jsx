import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

// The three places that lead to a run: the Running Log, the finished-run screen
// and the Running hub (Free run / Free walk).

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useRouter: () => global.__router,
  useLocalSearchParams: () => global.__params,
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/src/components/EmptyState', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', name: 'Cj' } }) }));
jest.mock('@/store/runningStore', () => ({
  useRunningStore: Object.assign(
    (select) => (typeof select === 'function' ? select(global.__runningStore) : global.__runningStore),
    { getState: () => global.__runningStore },
  ),
}));
jest.mock('@/store/virtualChallengeStore', () => ({ VIRTUAL_CHALLENGES: [] }));
jest.mock('@/store/workoutStore', () => ({
  useWorkoutStore: (select) => select({ completedWorkouts: [] }),
}));
jest.mock('@/store/badgeStore', () => ({
  useBadgeStore: () => ({ badges: [], loadBadges: jest.fn() }),
}));
jest.mock('@/store/communityStore', () => ({
  useCommunityStore: () => ({ createPost: global.__createPost }),
}));

import RunningLogScreen from '../app/profile/running-log';
import WorkoutCompleteScreen from '../app/workout/complete';
import RunningHubScreen from '../app/running/program/index';

const { router } = require('expo-router');

const at = (h) => new Date(2026, 9, 8, h, 0, 0).toISOString();
const run = (extra = {}) => ({
  id: 'run-1', startTime: at(7), endTime: at(8), distance: 5, duration: 1500, pace: 300, calories: 350,
  track: [40, -74, 40.01, -74.01], splits: [300, 300, 300, 300, 300], ...extra,
});

const setStore = (runs, extra = {}) => {
  global.__runningStore = {
    runs,
    loadRuns: jest.fn(async () => undefined),
    getStats: jest.fn(() => ({ totalRuns: runs.length, totalDistance: runs.reduce((a, r) => a + r.distance, 0), totalDuration: 3000, avgPace: 300 })),
    getPersonalRecords: jest.fn(() => ({ longestRun: null, fastestPace: null, best5k: null, totalDistance: 0 })),
    loadRunningPrograms: jest.fn(),
    programs: [],
    ...extra,
  };
};

beforeEach(() => {
  router.push.mockClear();
  global.__router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  global.__createPost = jest.fn(async () => undefined);
});

describe('Running Log', () => {
  it('opens the detail screen of the run that was tapped', () => {
    setStore([run(), run({ id: 'run-2' })]);
    const utils = render(<RunningLogScreen />);
    fireEvent.press(utils.getByTestId('run-card-run-2'));
    expect(router.push).toHaveBeenCalledWith('/running/run/run-2');
  });

  it('names each outing by when it happened and what it was', () => {
    setStore([run(), run({ id: 'w', activity: 'walk', startTime: at(18) })]);
    const utils = render(<RunningLogScreen />);
    expect(utils.getByText('Morning Run')).toBeTruthy();
    expect(utils.getByText('Evening Walk')).toBeTruthy();
  });

  it('keeps a name the run was saved with', () => {
    setStore([run({ route: 'Riverside loop' })]);
    const utils = render(<RunningLogScreen />);
    expect(utils.getByText('Riverside loop')).toBeTruthy();
  });

  it('says "View route & splits" when there is a route, "View details" when not', () => {
    setStore([run(), run({ id: 'no-route', track: undefined })]);
    const utils = render(<RunningLogScreen />);
    expect(utils.getAllByText('View route & splits')).toHaveLength(1);
    expect(utils.getAllByText('View details')).toHaveLength(1);
  });

  it('counts "Runs" until there is a walk, then "Activities"', () => {
    setStore([run()]);
    const first = render(<RunningLogScreen />);
    expect(first.getByText('Runs')).toBeTruthy();
    first.unmount();

    setStore([run(), run({ id: 'w', activity: 'walk' })]);
    const second = render(<RunningLogScreen />);
    expect(second.getByText('Activities')).toBeTruthy();
    expect(second.queryByText('Runs')).toBeNull();
  });

  it('has an import button that opens the Apple Health import screen', () => {
    setStore([run()]);
    const utils = render(<RunningLogScreen />);
    fireEvent.press(utils.getByTestId('import-runs-button'));
    expect(router.push).toHaveBeenCalledWith('/running/import');
  });

  it('tags runs that came from Apple Health, and only those', () => {
    setStore([run({ id: 'hk-1', source: 'apple-health' }), run({ id: 'own' })]);
    const utils = render(<RunningLogScreen />);
    expect(utils.getAllByText(/Apple Health/)).toHaveLength(1);
    expect(utils.getByText('Oct 8, 2026 \u2022 07:00 AM \u2022 Apple Health')).toBeTruthy();
    expect(utils.getByText('Oct 8, 2026 \u2022 07:00 AM')).toBeTruthy();
  });

  describe('on Android', () => {
    afterEach(() => jest.restoreAllMocks());

    it('has no import button, since importing is iPhone only for now', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      setStore([run()]);
      const utils = render(<RunningLogScreen />);
      expect(utils.queryByTestId('import-runs-button')).toBeNull();
      expect(utils.getByTestId('run-card-run-1')).toBeTruthy();
    });
  });
});

describe('Finished-run screen', () => {
  const open = (runs, params) => {
    global.__params = params;
    setStore(runs);
    return render(<WorkoutCompleteScreen />);
  };

  it('has a button that opens the run just saved', () => {
    const utils = open([run(), run({ id: 'older' })], { type: 'run', runId: 'run-1' });
    fireEvent.press(utils.getByTestId('view-run-details'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/run/run-1');
  });

  it('opens the right run even when it is not the newest', () => {
    const utils = open([run({ id: 'newest' }), run({ id: 'run-1' })], { type: 'run', runId: 'run-1' });
    fireEvent.press(utils.getByTestId('view-run-details'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/run/run-1');
  });

  it('has no button when the run was too short to be saved', () => {
    const utils = open([run({ id: 'older' })], { type: 'run', runId: 'none' });
    expect(utils.queryByTestId('view-run-details')).toBeNull();
  });

  it('has no button on a workout', () => {
    const utils = open([run()], { type: 'workout' });
    expect(utils.queryByTestId('view-run-details')).toBeNull();
  });

  it('gives walks walking XP', () => {
    const utils = open([run({ id: 'w', activity: 'walk', distance: 5 })], { type: 'run', runId: 'w' });
    expect(utils.getByText('+90 XP')).toBeTruthy(); // 18 per km
  });

  it('gives runs running XP', () => {
    const utils = open([run({ distance: 5 })], { type: 'run', runId: 'run-1' });
    expect(utils.getByText('+150 XP')).toBeTruthy(); // 30 per km
  });

  it('says "walk" in the post when a walk is shared to the feed', async () => {
    const utils = open([run({ id: 'w', activity: 'walk', distance: 3, duration: 2400 })], { type: 'run', runId: 'w' });
    await act(async () => { fireEvent.press(utils.getByText('Share to Community')); });
    expect(global.__createPost).toHaveBeenCalledTimes(1);
    expect(global.__createPost.mock.calls[0][0].text).toMatch(/^Just finished a 3\.00km walk in 40 min/);
    expect(global.__createPost.mock.calls[0][0].type).toBe('run');
  });

  it('says "run" in the post when a run is shared', async () => {
    const utils = open([run({ distance: 5 })], { type: 'run', runId: 'run-1' });
    await act(async () => { fireEvent.press(utils.getByText('Share to Community')); });
    expect(global.__createPost.mock.calls[0][0].text).toMatch(/^Just finished a 5\.00km run in 25 min/);
  });
});

describe('Running hub', () => {
  it('starts a free run', async () => {
    setStore([]);
    const utils = render(<RunningHubScreen />);
    await act(async () => {});
    fireEvent.press(utils.getByTestId('start-free-run'));
    expect(router.push).toHaveBeenCalledWith('/running/active');
  });

  it('starts a free walk', async () => {
    setStore([]);
    const utils = render(<RunningHubScreen />);
    await act(async () => {});
    fireEvent.press(utils.getByTestId('start-free-walk'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/running/active', params: { activity: 'walk' } });
  });
});

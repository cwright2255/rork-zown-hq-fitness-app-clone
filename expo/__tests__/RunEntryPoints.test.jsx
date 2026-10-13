import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

// The three places that lead to a run: the Running Log, the finished-run screen
// and the Running hub (Free run / Free walk).

// These read Settings > Distance Units from the real settings store; the next two keep it off the network and the phone's storage.
// The tests below were written in kilometres, so they start there (the miles tests set 'imperial' themselves).
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

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
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__hubUser || { uid: 'u1', name: 'Cj' } }) }));
jest.mock('@/store/runningStore', () => ({
  useRunningStore: Object.assign(
    (select) => (typeof select === 'function' ? select(global.__runningStore) : global.__runningStore),
    { getState: () => global.__runningStore },
  ),
}));
// The virtual journeys on the Running hub use the real store; these keep it off the network.
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), getDocs: jest.fn(), deleteDoc: jest.fn(), query: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('@/services/journeyRewards', () => ({ rewardJourney: jest.fn() }));
// The finished-activity screen also reads saved hikes; none are needed here.
jest.mock('@/store/hikingStore', () => ({
  useHikingStore: Object.assign(
    (select) => (typeof select === 'function' ? select({ completedHikes: [] }) : { completedHikes: [] }),
    { getState: () => ({ completedHikes: [] }) },
  ),
}));
jest.mock('@/store/workoutStore', () => ({
  useWorkoutStore: (select) => select({ completedWorkouts: [] }),
}));
jest.mock('@/store/badgeStore', () => ({
  useBadgeStore: () => ({ badges: [], loadBadges: jest.fn() }),
}));
jest.mock('@/store/communityStore', () => ({
  useCommunityStore: () => ({ createPost: global.__createPost }),
}));
jest.mock('@/services/distanceBoard', () => ({
  publishMyDistance: (...args) => global.__publishDistance(...args),
}));

import RunningLogScreen from '../app/profile/running-log';
import WorkoutCompleteScreen from '../app/workout/complete';
import RunningHubScreen from '../app/running/program/index';
import { useSettingsStore } from '../store/settingsStore';
import { useVirtualRaceStore } from '../store/virtualRaceStore';
import { useVirtualChallengeStore } from '../store/virtualChallengeStore';
import { currentRace, raceEntryId } from '../lib/virtualRaces';
import { JOURNEYS } from '../lib/virtualJourneys';
import { getDoc } from 'firebase/firestore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

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
    markRunShared: jest.fn(() => true),
    programs: [],
    ...extra,
  };
};

beforeEach(() => {
  router.push.mockClear();
  global.__router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  global.__createPost = jest.fn(async () => 'post-1');
  global.__publishDistance = jest.fn(async () => true);
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

  it('shows the totals, each run and the pace in kilometres when Settings are in km', () => {
    setStore([run()]);
    const utils = render(<RunningLogScreen />);
    expect(utils.getByText('5.0 km')).toBeTruthy(); // total
    expect(utils.getByText('5.00 km')).toBeTruthy(); // the run
    expect(utils.getAllByText('5:00 /km').length).toBeGreaterThanOrEqual(2); // average pace and the run's pace
  });

  it('shows them in miles and minutes per mile when Settings say so', () => {
    useSettingsStore.setState({ units: 'imperial' });
    setStore([run()]);
    const utils = render(<RunningLogScreen />);
    expect(utils.getByText('3.1 mi')).toBeTruthy(); // total, 5 km
    expect(utils.getByText('3.11 mi')).toBeTruthy(); // the run
    expect(utils.getAllByText('8:03 /mi').length).toBeGreaterThanOrEqual(2);
    expect(utils.queryByText(/ km$/)).toBeNull();
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

  it('shares a walk to the feed as a walk card', async () => {
    const utils = open([run({ id: 'w', activity: 'walk', distance: 3, duration: 2400 })], { type: 'run', runId: 'w' });
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    expect(global.__createPost).toHaveBeenCalledTimes(1);
    const post = global.__createPost.mock.calls[0][0];
    expect(post.type).toBe('run');
    expect(post.text).toBe('Morning Walk: 3.00 km in 40:00 \uD83D\uDCAA');
    expect(post.run).toMatchObject({ activity: 'walk', title: 'Morning Walk', distance: 3, duration: 2400 });
  });

  it('shares a run to the feed as a run card with its stats', async () => {
    const utils = open([run({ distance: 5 })], { type: 'run', runId: 'run-1' });
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    const post = global.__createPost.mock.calls[0][0];
    expect(post).toMatchObject({ uid: 'u1', authorName: 'Cj', type: 'run', text: 'Morning Run: 5.00 km in 25:00 \uD83D\uDCAA' });
    expect(post.run).toMatchObject({ activity: 'run', distance: 5, duration: 1500, pace: 300, calories: 350 });
  });

  it('words the caption of the shared run in miles when Settings say so, and stores kilometres', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = open([run({ distance: 5 })], { type: 'run', runId: 'run-1' });
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    const post = global.__createPost.mock.calls[0][0];
    expect(post.text).toBe('Morning Run: 3.11 mi in 25:00 \uD83D\uDCAA');
    expect(post.run.distance).toBe(5);
  });

  it('hides the ends of the route it shares', async () => {
    // 41 points about 111 m apart going north: 4.4 km.
    const track = Array.from({ length: 41 }, (_, i) => [40 + i * 0.001, -74]).flat();
    const utils = open([run({ track })], { type: 'run', runId: 'run-1' });
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    const { route } = global.__createPost.mock.calls[0][0].run;
    expect(route.length).toBeGreaterThan(0);
    expect(route.slice(0, 2)).not.toEqual([40, -74]);
    expect(route[0]).toBeGreaterThan(40.001);
    expect(route[route.length - 2]).toBeLessThan(40.039);
  });

  it('remembers the post on the run and then shows it as shared', async () => {
    const utils = open([run()], { type: 'run', runId: 'run-1' });
    expect(utils.getByText('Share to Community')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    expect(global.__runningStore.markRunShared).toHaveBeenCalledWith('u1', 'run-1', 'post-1');
    expect(utils.getByText('Shared to Community')).toBeTruthy();
    expect(utils.queryByTestId('share-error')).toBeNull();
  });

  it('does not post the same run twice', async () => {
    const utils = open([run()], { type: 'run', runId: 'run-1' });
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    expect(global.__createPost).toHaveBeenCalledTimes(1);
  });

  it('shows a run that was already shared (from its own screen, say) as shared', async () => {
    const utils = open([run({ sharedPostId: 'earlier' })], { type: 'run', runId: 'run-1' });
    expect(utils.getByText('Shared to Community')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    expect(global.__createPost).not.toHaveBeenCalled();
  });

  it('says so, and lets the person try again, when the post could not be made', async () => {
    global.__createPost = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('post-2');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const utils = open([run()], { type: 'run', runId: 'run-1' });
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    expect(utils.getByTestId('share-error').props.children).toBe('Could not share your run. Try again in a moment.');
    expect(utils.getByText('Share to Community')).toBeTruthy();
    expect(global.__runningStore.markRunShared).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(utils.getByTestId('share-to-community')); });
    expect(utils.queryByTestId('share-error')).toBeNull();
    expect(utils.getByText('Shared to Community')).toBeTruthy();
    warn.mockRestore();
  });

  it('puts this week\'s distance on the leaderboard once the runs are loaded', async () => {
    open([run()], { type: 'run', runId: 'run-1' });
    await act(async () => { await Promise.resolve(); });
    expect(global.__runningStore.loadRuns).toHaveBeenCalledWith('u1');
    expect(global.__publishDistance).toHaveBeenCalledWith({ user: expect.objectContaining({ uid: 'u1' }) });
  });

  it('does not touch the distance boards after a workout', async () => {
    open([run()], { type: 'workout' });
    await act(async () => { await Promise.resolve(); });
    expect(global.__publishDistance).not.toHaveBeenCalled();
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

  describe('personal records', () => {
    const records = { totalDistance: 50, longestRun: { distance: 21.1 }, fastestPace: { pace: 300 }, best5k: null };

    it('are in kilometres when Settings are in km', async () => {
      setStore([], { getPersonalRecords: jest.fn(() => records) });
      const utils = render(<RunningHubScreen />);
      await act(async () => {});
      expect(utils.getByText('50.0 km')).toBeTruthy();
      expect(utils.getByText('21.1 km')).toBeTruthy();
      expect(utils.getByText('5\'00"')).toBeTruthy();
      expect(utils.getByText('Best Pace /km')).toBeTruthy();
    });

    it('are in miles when Settings say so', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      setStore([], { getPersonalRecords: jest.fn(() => records) });
      const utils = render(<RunningHubScreen />);
      await act(async () => {});
      expect(utils.getByText('31.1 mi')).toBeTruthy(); // 50 km
      expect(utils.getByText('13.1 mi')).toBeTruthy(); // 21.1 km
      expect(utils.getByText('8\'03"')).toBeTruthy(); // 5:00 per km
      expect(utils.getByText('Best Pace /mi')).toBeTruthy();
    });

    it('show dashes when there is nothing yet', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      setStore([]);
      const utils = render(<RunningHubScreen />);
      await act(async () => {});
      expect(utils.getAllByText('--').length).toBeGreaterThanOrEqual(3);
    });
  });

  it('does not show anything marked as coming soon', async () => {
    setStore([]);
    const utils = render(<RunningHubScreen />);
    await act(async () => {});
    expect(utils.queryByText('Soon')).toBeNull();
    expect(utils.queryByText(/coming soon/i)).toBeNull();
  });

  it('still shows the stats, the programs and the hiking entry', async () => {
    setStore([], { programs: [{ id: 'c25k', title: 'Couch to 5K', subtitle: '9 weeks' }] });
    const utils = render(<RunningHubScreen />);
    await act(async () => {});
    expect(utils.getByText('Your Stats')).toBeTruthy();
    expect(utils.getByText('Running Programs')).toBeTruthy();
    expect(utils.getByText('Couch to 5K')).toBeTruthy();
    fireEvent.press(utils.getByText('Hiking Near You'));
    expect(router.push).toHaveBeenCalledWith('/running/hiking');
  });

  describe('virtual races', () => {
    // A Wednesday, so the local week has 4 days left.
    const NOW = new Date(2026, 9, 14, 10, 0, 0);
    beforeEach(() => {
      jest.useFakeTimers({ now: NOW.getTime() });
      useVirtualRaceStore.setState({ joined: {}, finished: {}, boards: {} });
      useVirtualChallengeStore.setState({ byUser: {}, loadedFor: null });
      getDoc.mockClear();
    });
    afterEach(() => { jest.useRealTimers(); delete global.__hubUser; });

    const open = async () => {
      setStore([]);
      const utils = render(<RunningHubScreen />);
      await act(async () => {});
      return utils;
    };
    const keep = (kind, timeSec) => useVirtualRaceStore.getState().recordFinish(
      currentRace(kind, NOW), 'u1', { timeSec, finishedAt: NOW.toISOString(), areaId: '1300x1059' },
    );

    it('has a Virtual Races section with a Local 5K and a Worldwide 10K', async () => {
      const utils = await open();
      expect(utils.getByText('Virtual Races')).toBeTruthy();
      expect(utils.getByText('Local 5K')).toBeTruthy();
      expect(utils.getByText('Worldwide 10K')).toBeTruthy();
      expect(utils.getByText('5K · Weekly · 4 days left')).toBeTruthy();
      expect(utils.getByText(/^10K · Monthly · \d+ days left$/)).toBeTruthy();
    });

    it('puts the two timed races and then every journey in a row of cards, like Running Programs', async () => {
      const utils = await open();
      const row = within(utils.getByTestId('virtual-races-carousel'));
      expect(row.getAllByTestId(/^(race|journey)-card-[a-z-]+$/).map((n) => n.props.testID)).toEqual([
        'race-card-local', 'race-card-world', ...JOURNEYS.map((j) => `journey-card-${j.id}`),
      ]);
      expect(utils.getByTestId('virtual-races-carousel').props.horizontal).toBe(true);
    });

    it('says what each journey is on its card', async () => {
      const utils = await open();
      expect(utils.getByText('Grand Canyon Rim Trail')).toBeTruthy();
      expect(utils.getByText('34 km · 4 milestones')).toBeTruthy();
      expect(utils.getByText('Camino de Santiago (Camino Francés)')).toBeTruthy();
    });

    it('shows journey distances in miles when Settings say so', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      const utils = await open();
      expect(utils.getByText('21.1 mi · 4 milestones')).toBeTruthy();
    });

    it('opens the journey that was tapped', async () => {
      const utils = await open();
      fireEvent.press(utils.getByTestId('journey-card-marathon-to-athens'));
      expect(router.push).toHaveBeenLastCalledWith('/running/journeys/marathon-to-athens');
    });

    it('opens the full Virtual Races page from View All', async () => {
      const utils = await open();
      fireEvent.press(utils.getByTestId('virtual-races-view-all'));
      expect(router.push).toHaveBeenLastCalledWith('/running/races');
    });

    it('has one View All, for the Virtual Races row only', async () => {
      const utils = await open();
      expect(utils.getAllByText('View All')).toHaveLength(1);
    });

    it('shows how far along a joined journey is, and nothing on the others', async () => {
      useVirtualChallengeStore.getState().joinChallenge('grand-canyon-rim', 'u1');
      useVirtualChallengeStore.getState().creditDistance(8.5, 'u1');
      const utils = await open();
      expect(utils.getByTestId('journey-card-grand-canyon-rim-label').props.children).toBe('25%');
      expect(utils.queryByTestId('journey-card-inca-trail-label')).toBeNull();
    });

    it('reads the person\'s journeys from their account', async () => {
      await open();
      expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/virtualChallenges' });
    });

    it('reads again for a different person who signs in while it is open', async () => {
      const utils = await open();
      getDoc.mockClear();
      global.__hubUser = { uid: 'u2', name: 'Sam' };
      await act(async () => { utils.rerender(<RunningHubScreen />); });
      expect(getDoc).toHaveBeenCalledWith({ path: 'users/u2/data/virtualChallenges' });
    });

    it('comes after Hiking Near You', async () => {
      const utils = await open();
      const text = JSON.stringify(utils.toJSON());
      expect(text.indexOf('Hiking Near You')).toBeGreaterThan(-1);
      expect(text.indexOf('Hiking Near You')).toBeLessThan(text.indexOf('Virtual Races'));
      expect(text.indexOf('Local 5K')).toBeLessThan(text.indexOf('Worldwide 10K'));
    });

    it('shows miles beside the distance when Settings say so', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      const utils = await open();
      expect(utils.getByText('5K · 3.1 mi · Weekly · 4 days left')).toBeTruthy();
      expect(utils.getByText(/^10K · 6\.2 mi · Monthly/)).toBeTruthy();
    });

    it('opens the race that was tapped', async () => {
      const utils = await open();
      fireEvent.press(utils.getByTestId('race-card-local'));
      expect(router.push).toHaveBeenLastCalledWith('/running/races/local');
      fireEvent.press(utils.getByTestId('race-card-world'));
      expect(router.push).toHaveBeenLastCalledWith('/running/races/world');
    });

    it('reads out the race, when it is on, and how you are doing in it', async () => {
      useVirtualRaceStore.getState().join(currentRace('local', NOW), 'u1');
      keep('world', 3100);
      const utils = await open();
      expect(utils.getByTestId('race-card-local').props.accessibilityLabel).toBe('Local 5K. Weekly · 4 days left. Joined');
      expect(utils.getByTestId('race-card-world').props.accessibilityLabel).toMatch(/^Worldwide 10K\. Monthly · \d+ days left\. Your time 51:40$/);
    });

    it('reads out the race without a trailing gap while you have not joined', async () => {
      const utils = await open();
      expect(utils.getByTestId('race-card-local').props.accessibilityLabel).toBe('Local 5K. Weekly · 4 days left.');
    });

    it('has a pin for the local race and a globe for the worldwide one', async () => {
      const utils = await open();
      const iconIn = (id) => utils.getByTestId(id).findAllByType('Ionicons').map((n) => n.props.name);
      expect(iconIn('race-card-local')).toContain('location');
      expect(iconIn('race-card-local')).not.toContain('globe-outline');
      expect(iconIn('race-card-world')).toContain('globe-outline');
      expect(iconIn('race-card-world')).not.toContain('location');
    });

    it('says nothing about you until you have joined or finished', async () => {
      const utils = await open();
      expect(utils.queryByTestId('race-card-status-local')).toBeNull();
      expect(utils.queryByTestId('race-card-status-world')).toBeNull();
    });

    it('says Joined once you have joined that race, and only that race', async () => {
      useVirtualRaceStore.getState().join(currentRace('local', NOW), 'u1');
      const utils = await open();
      expect(utils.getByTestId('race-card-status-local').props.children).toBe('Joined');
      expect(utils.queryByTestId('race-card-status-world')).toBeNull();
    });

    it('shows your time once you have finished, instead of Joined', async () => {
      useVirtualRaceStore.getState().join(currentRace('world', NOW), 'u1');
      keep('world', 3100);
      const utils = await open();
      expect(utils.getByTestId('race-card-status-world').props.children).toBe('Your time 51:40');
      expect(utils.queryByTestId('race-card-status-local')).toBeNull();
    });

    it('does not show somebody else\'s time', async () => {
      useVirtualRaceStore.getState().recordFinish(currentRace('local', NOW), 'u2', { timeSec: 1500, finishedAt: NOW.toISOString(), areaId: 'a' });
      expect(Object.keys(useVirtualRaceStore.getState().finished)).toEqual([raceEntryId(currentRace('local', NOW).id, 'u2')]);
      const utils = await open();
      expect(utils.queryByTestId('race-card-status-local')).toBeNull();
    });
  });
});

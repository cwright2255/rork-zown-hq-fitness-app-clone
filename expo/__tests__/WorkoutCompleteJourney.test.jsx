import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// The "journey complete" card on the summary of a run or walk that finished a virtual journey
// (app/workout/complete.jsx, components/JourneyFinishedCard.jsx).
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
  useLocalSearchParams: () => global.__params,
}), { virtual: true });

function mockStore(key) {
  const hook = (select) => (select ? select(global[key]) : global[key]);
  hook.getState = () => global[key];
  return hook;
}
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: mockStore('__workouts') }));
jest.mock('@/store/userStore', () => ({ useUserStore: mockStore('__userStore') }));
jest.mock('@/store/badgeStore', () => ({ useBadgeStore: mockStore('__badges') }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: mockStore('__running') }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: mockStore('__hiking') }));
jest.mock('@/store/communityStore', () => ({ useCommunityStore: mockStore('__community') }));
jest.mock('@/services/runShare', () => ({
  shareRunToFeed: jest.fn(),
  shareErrorText: jest.fn((r) => `run share problem: ${r}`),
}));
jest.mock('@/services/hikeShare', () => ({
  shareHikeToFeed: jest.fn(),
  hikeShareErrorText: jest.fn((r) => `hike share problem: ${r}`),
}));
jest.mock('@/services/distanceBoard', () => ({ publishMyDistance: jest.fn() }));

import WorkoutCompleteScreen from '../app/workout/complete';
import JourneyFinishedCard from '../components/JourneyFinishedCard';
import { useSettingsStore } from '../store/settingsStore';
import { journeyById } from '../lib/virtualJourneys';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const RUN = { id: 'run-1', distance: 5, duration: 1500, calories: 300 };

const open = (params) => {
  global.__router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  global.__params = params;
  global.__workouts = { completedWorkouts: [] };
  global.__userStore = { user: { uid: 'u1', displayName: 'Cj' } };
  global.__badges = { badges: [], loadBadges: jest.fn() };
  global.__running = { runs: [RUN], loadRuns: jest.fn(async () => undefined), markRunShared: jest.fn() };
  global.__hiking = { completedHikes: [], markHikeShared: jest.fn() };
  global.__community = { createPost: jest.fn(async () => 'post-1') };
  return render(<WorkoutCompleteScreen />);
};

const runParams = (extra = {}) => ({ type: 'run', runId: 'run-1', ...extra });

describe('Journey complete card on the workout summary', () => {
  it('shows a card for the journey a run finished, with its length and reward', () => {
    const utils = open(runParams({ journeys: 'marathon-to-athens' }));
    expect(utils.getByTestId('journey-finished-marathon-to-athens')).toBeTruthy();
    expect(utils.getByTestId('journey-finished-marathon-to-athens-title').props.children).toBe('Marathon to Athens');
    expect(utils.getByTestId('journey-finished-marathon-to-athens-text').props.children)
      .toBe('You covered all 42 km. +500 XP and the Trailblazer badge.');
  });

  it('shows one card for each journey when a run finished two', () => {
    const utils = open(runParams({ journeys: 'grand-canyon-rim,inca-trail' }));
    expect(utils.getByTestId('journey-finished-grand-canyon-rim-text').props.children)
      .toBe('You covered all 21 km. +500 XP and the Trailblazer badge.');
    expect(utils.getByTestId('journey-finished-inca-trail')).toBeTruthy();
    expect(utils.queryByTestId('journey-finished-hadrians-wall')).toBeNull();
  });

  it('pays the XP for the journey\'s length', () => {
    const utils = open(runParams({ journeys: 'hadrians-wall,camino-frances' }));
    expect(utils.getByTestId('journey-finished-hadrians-wall-text').props.children).toContain('+1000 XP');
    expect(utils.getByTestId('journey-finished-camino-frances-text').props.children).toContain('+2000 XP');
  });

  it('gives the length in miles when Settings say so', () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = open(runParams({ journeys: 'marathon-to-athens' }));
    expect(utils.getByTestId('journey-finished-marathon-to-athens-text').props.children)
      .toBe('You covered all 26.1 mi. +500 XP and the Trailblazer badge.');
  });

  it('ignores an id that is not a journey and shows the rest', () => {
    const utils = open(runParams({ journeys: 'nowhere,inca-trail' }));
    expect(utils.getByTestId('journey-finished-inca-trail')).toBeTruthy();
    expect(utils.queryByTestId('journey-finished-nowhere')).toBeNull();
  });

  it('shows nothing when the run finished no journey', () => {
    expect(open(runParams()).queryByText('Journey complete')).toBeNull();
    expect(open(runParams({ journeys: '' })).queryByText('Journey complete')).toBeNull();
  });

  it('does not break when the parameter is not a single string', () => {
    // expo-router hands back an array when a parameter is repeated in the link.
    const utils = open(runParams({ journeys: ['inca-trail', 'hadrians-wall'] }));
    expect(utils.queryByTestId('journey-finished-inca-trail')).toBeNull();
    expect(utils.getByText('Great Job!')).toBeTruthy();
  });

  it('gives each card its own key', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      open(runParams({ journeys: 'grand-canyon-rim,inca-trail' }));
      expect(errors.mock.calls.filter((c) => String(c[0]).includes('same key'))).toHaveLength(0);
    } finally {
      errors.mockRestore();
    }
  });

  it('shows nothing on a hike or a workout summary, even with the parameter', () => {
    expect(open({ type: 'hike', hikeId: 'h1', journeys: 'inca-trail' }).queryByTestId('journey-finished-inca-trail')).toBeNull();
    expect(open({ journeys: 'inca-trail' }).queryByTestId('journey-finished-inca-trail')).toBeNull();
  });

  it('opens the journey when the card is tapped', async () => {
    const utils = open(runParams({ journeys: 'west-highland-way' }));
    await act(async () => { fireEvent.press(utils.getByTestId('journey-finished-west-highland-way')); });
    expect(global.__router.push).toHaveBeenCalledTimes(1);
    expect(global.__router.push).toHaveBeenCalledWith('/running/journeys/west-highland-way');
  });

  it('keeps the card above the stats', () => {
    const utils = open(runParams({ journeys: 'inca-trail' }));
    const json = JSON.stringify(utils.toJSON());
    expect(json.indexOf('journey-finished-inca-trail')).toBeGreaterThan(json.indexOf('Great Job!'));
    expect(json.indexOf('journey-finished-inca-trail')).toBeLessThan(json.indexOf('Total calories'));
  });
});

describe('JourneyFinishedCard', () => {
  it('names the journey, says what it paid, and calls it out to screen readers', () => {
    const onPress = jest.fn();
    const utils = render(<JourneyFinishedCard journey={journeyById('tour-du-mont-blanc')} units="metric" onPress={onPress} />);
    expect(utils.getByText('Journey complete')).toBeTruthy();
    expect(utils.getByText('Tour du Mont Blanc')).toBeTruthy();
    expect(utils.getByText('You covered all 170 km. +1000 XP and the Trailblazer badge.')).toBeTruthy();
    const card = utils.getByTestId('journey-finished-tour-du-mont-blanc');
    expect(card.props.accessibilityLabel).toBe('Journey complete. Tour du Mont Blanc.');
    expect(card.props.accessibilityRole).toBe('button');
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

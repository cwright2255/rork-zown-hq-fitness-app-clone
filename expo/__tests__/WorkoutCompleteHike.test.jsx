import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

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

const Hikes = require('@/services/hikeShare');
const Runs = require('@/services/runShare');

const HIKE = {
  id: 'hike-1', trailName: 'Old Rag Loop', distanceKm: 8.4, durationSeconds: 7200,
  elevationGainM: 640, difficultyTier: 'Hard', calories: 910, xpEarned: 120,
  track: [40, -74, 40.01, -74, 40.02, -74],
};

const hikeParams = (extra = {}) => ({
  type: 'hike', hikeId: 'hike-1', distanceKm: '8.4', elevationGainM: '640', durationSeconds: '7200',
  difficultyTier: 'Hard', calories: '910', xpEarned: '120', ...extra,
});

const open = (params, { hikes = [HIKE], user = { uid: 'u1', displayName: 'Cj' }, runs = [] } = {}) => {
  global.__router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  global.__params = params;
  global.__workouts = { completedWorkouts: [{ caloriesBurned: 333, xpEarned: 50, duration: 1800, exercisesCompleted: 3, totalExercises: 4 }] };
  global.__userStore = { user };
  global.__badges = { badges: [], loadBadges: jest.fn() };
  global.__running = { runs, loadRuns: jest.fn(async () => undefined), markRunShared: jest.fn() };
  global.__hiking = { completedHikes: hikes, markHikeShared: jest.fn() };
  global.__community = { createPost: jest.fn(async () => 'post-1') };
  return render(<WorkoutCompleteScreen />);
};

const press = async (utils, id) => { await act(async () => { fireEvent.press(utils.getByTestId(id)); }); };

beforeEach(() => {
  Hikes.shareHikeToFeed.mockReset();
  Hikes.hikeShareErrorText.mockClear();
  Runs.shareRunToFeed.mockReset();
});

describe('Workout complete screen after a hike', () => {
  it('shows this hike’s calories and XP, not the last gym workout’s', () => {
    const utils = open(hikeParams());
    expect(utils.getByText('910')).toBeTruthy();
    expect(utils.queryByText('333')).toBeNull();
    expect(utils.getByText('+120')).toBeTruthy();
    expect(utils.getByText('910 kcal')).toBeTruthy();
  });

  it('shows no calories rather than a gym workout’s when the hike gave none', () => {
    const utils = open(hikeParams({ calories: undefined }));
    expect(utils.queryByText('333')).toBeNull();
    expect(utils.getByText('0 kcal')).toBeTruthy();
  });

  it('still shows the gym workout’s own calories after a gym workout', () => {
    const utils = open({});
    expect(utils.getByText('333')).toBeTruthy();
  });

  it('offers to view the route and details of the hike just saved', () => {
    const utils = open(hikeParams());
    fireEvent.press(utils.getByTestId('view-hike-details'));
    expect(global.__router.push).toHaveBeenCalledWith('/running/hiking/log/hike-1');
  });

  it('does not offer it when the hike is not in the list, or after a run or a workout', () => {
    expect(open(hikeParams(), { hikes: [] }).queryByTestId('view-hike-details')).toBeNull();
    expect(open(hikeParams({ hikeId: 'hike-999' })).queryByTestId('view-hike-details')).toBeNull();
    expect(open(hikeParams({ hikeId: undefined })).queryByTestId('view-hike-details')).toBeNull();
    expect(open({ type: 'run' }).queryByTestId('view-hike-details')).toBeNull();
    expect(open({}).queryByTestId('view-hike-details')).toBeNull();
  });

  it('shares the saved hike as a hike card, and remembers it was shared', async () => {
    Hikes.shareHikeToFeed.mockResolvedValue({ ok: true, postId: 'p9' });
    const utils = open(hikeParams());
    expect(utils.getByText('Share to Community')).toBeTruthy();
    await press(utils, 'share-to-community');
    expect(Hikes.shareHikeToFeed).toHaveBeenCalledTimes(1);
    const args = Hikes.shareHikeToFeed.mock.calls[0][0];
    expect(args.hike).toEqual(HIKE);
    expect(args.user).toMatchObject({ uid: 'u1', displayName: 'Cj' });
    expect(args.createPost).toBe(global.__community.createPost);
    expect(args.markShared).toBe(global.__hiking.markHikeShared);
    expect(utils.getByText('Shared to Community')).toBeTruthy();
    expect(global.__community.createPost).not.toHaveBeenCalled(); // no second, text-only post
  });

  it('can not be shared a second time', async () => {
    Hikes.shareHikeToFeed.mockResolvedValue({ ok: true, postId: 'p9' });
    const utils = open(hikeParams());
    await press(utils, 'share-to-community');
    await press(utils, 'share-to-community');
    expect(Hikes.shareHikeToFeed).toHaveBeenCalledTimes(1);
  });

  it('shows a hike that was already shared as shared, and does not post it again', async () => {
    const utils = open(hikeParams(), { hikes: [{ ...HIKE, sharedPostId: 'p5' }] });
    expect(utils.getByText('Shared to Community')).toBeTruthy();
    await press(utils, 'share-to-community');
    expect(Hikes.shareHikeToFeed).not.toHaveBeenCalled();
  });

  it('says what went wrong when the share fails, and lets the user try again', async () => {
    Hikes.shareHikeToFeed.mockResolvedValueOnce({ ok: false, reason: 'error' });
    const utils = open(hikeParams());
    await press(utils, 'share-to-community');
    expect(utils.getByTestId('share-error').props.children).toBe('hike share problem: error');
    expect(utils.getByText('Share to Community')).toBeTruthy();
    Hikes.shareHikeToFeed.mockResolvedValueOnce({ ok: true, postId: 'p1' });
    await press(utils, 'share-to-community');
    expect(Hikes.shareHikeToFeed).toHaveBeenCalledTimes(2);
    expect(utils.queryByTestId('share-error')).toBeNull();
    expect(utils.getByText('Shared to Community')).toBeTruthy();
  });

  it('shows it as shared when the hike turns out to be shared already', async () => {
    Hikes.shareHikeToFeed.mockResolvedValue({ ok: false, reason: 'already-shared' });
    const utils = open(hikeParams());
    await press(utils, 'share-to-community');
    expect(utils.getByText('Shared to Community')).toBeTruthy();
    expect(utils.queryByTestId('share-error')).toBeNull();
  });

  it('does nothing when signed out', async () => {
    const utils = open(hikeParams(), { user: null });
    await press(utils, 'share-to-community');
    expect(Hikes.shareHikeToFeed).not.toHaveBeenCalled();
    expect(global.__community.createPost).not.toHaveBeenCalled();
  });

  it('falls back to the plain text post when the hike record can not be found', async () => {
    const utils = open(hikeParams(), { hikes: [] });
    await press(utils, 'share-to-community');
    expect(Hikes.shareHikeToFeed).not.toHaveBeenCalled();
    expect(global.__community.createPost).toHaveBeenCalledTimes(1);
    const post = global.__community.createPost.mock.calls[0][0];
    expect(post).toMatchObject({ uid: 'u1', type: 'hike' });
    expect(post.text).toMatch(/hard hike/i);
    expect(post).not.toHaveProperty('run');
    expect(utils.getByText('Shared to Community')).toBeTruthy();
  });

  it('shares a run as a run, untouched by the hike code', async () => {
    Runs.shareRunToFeed.mockResolvedValue({ ok: true, postId: 'r1' });
    const run = { id: 'run-1', distance: 5, duration: 1500, calories: 300 };
    const utils = open({ type: 'run', runId: 'run-1' }, { runs: [run] });
    await press(utils, 'share-to-community');
    expect(Runs.shareRunToFeed).toHaveBeenCalledTimes(1);
    expect(Hikes.shareHikeToFeed).not.toHaveBeenCalled();
    expect(utils.getByText('Shared to Community')).toBeTruthy();
  });
});

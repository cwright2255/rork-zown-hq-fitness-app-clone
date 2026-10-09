import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
  useLocalSearchParams: () => global.__params,
}), { virtual: true });
jest.mock('@/components/RunRouteMap', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__routeProps = props;
      return mockReact.createElement(mockRn.View, { testID: 'route-map' });
    },
  };
});
jest.mock('@/store/hikingStore', () => ({
  useHikingStore: Object.assign((select) => select(global.__hiking), { getState: () => global.__hiking }),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/communityStore', () => ({
  useCommunityStore: (select) => select({ createPost: global.__createPost }),
}));

import HikeDetailScreen from '../app/running/hiking/log/[id]';

// 7:05 in the morning on Thu 8 Oct 2026 (local time, the screen reads local time too).
const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();

const hike = (extra = {}) => ({
  id: 'hike-1',
  uid: 'u1',
  completedAt: new Date(2026, 9, 8, 11, 20, 0).toISOString(),
  startTime: START,
  trailName: 'Old Rag',
  pathName: 'Ridge Trail',
  distanceKm: 14.24,
  durationSeconds: 15300,
  elevationGainM: 812,
  elevationLossM: 805,
  difficultyScore: 170.3,
  difficultyTier: 'Strenuous',
  calories: 2211,
  xpEarned: 1250,
  track: Array.from({ length: 60 }, (_, i) => [40 + i * 0.001, -74]).flat(),
  ...extra,
});

const open = (id, hikes, { user = { uid: 'u1' }, loadCompletedHikes } = {}) => {
  global.__params = { id };
  global.__user = user;
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__hiking = {
    completedHikes: hikes,
    loadCompletedHikes: loadCompletedHikes || jest.fn(async () => undefined),
    markHikeShared: jest.fn(() => true),
  };
  global.__createPost = jest.fn(async () => 'post-1');
  return render(<HikeDetailScreen />);
};

describe('HikeDetailScreen', () => {
  it('shows the trail, the path, the date and the distance over the map', () => {
    const utils = open('hike-1', [hike()]);
    expect(utils.getByTestId('hike-detail-heading').props.children).toBe('Hike Completed');
    expect(utils.getByTestId('hike-detail-title').props.children).toBe('Old Rag');
    expect(utils.getByTestId('hike-detail-path').props.children).toBe('Ridge Trail');
    expect(utils.getByText('Thu, Oct 8 • 7:05 AM')).toBeTruthy();
    expect(utils.getByTestId('hike-detail-distance').props.children).toBe('14.24');
  });

  it('shows the duration, pace and calories', () => {
    const utils = open('hike-1', [hike()]);
    expect(utils.getByTestId('hike-detail-time').props.children).toEqual(['4:15:00', null]);
    expect(utils.getByTestId('hike-detail-pace').props.children).toEqual(['17:54', expect.anything()]);
    expect(utils.getByTestId('hike-detail-calories').props.children).toEqual(['2211', expect.anything()]);
  });

  it('hands the route walked to the map, with its own wording for when there is none', () => {
    open('hike-1', [hike()]);
    expect(global.__routeProps.points).toHaveLength(60);
    expect(global.__routeProps.points[0]).toEqual({ latitude: 40, longitude: -74 });
    expect(global.__routeProps.emptyText).toBe('No route was recorded for this hike');
  });

  it('shows an older hike that has no route', () => {
    const utils = open('hike-1', [hike({ track: [], startTime: undefined, elevationLossM: undefined })]);
    expect(global.__routeProps.points).toEqual([]);
    expect(utils.getByTestId('hike-detail-title').props.children).toBe('Old Rag');
  });

  it('shows the climb and the descent', () => {
    const utils = open('hike-1', [hike()]);
    expect(utils.getByTestId('hike-detail-climb').props.children).toBe('812 m climb');
    expect(utils.getByText('805 m descent')).toBeTruthy();
  });

  it('leaves the elevation line out when there was none', () => {
    const utils = open('hike-1', [hike({ elevationGainM: 0, elevationLossM: 0 })]);
    expect(utils.queryByTestId('hike-detail-elevation')).toBeNull();
  });

  it('shows the difficulty, its score and the XP earned', () => {
    const utils = open('hike-1', [hike()]);
    expect(utils.getByTestId('hike-detail-tier').props.children).toBe('Strenuous');
    expect(utils.getByText('Difficulty score 170.3')).toBeTruthy();
    expect(utils.getByTestId('hike-detail-xp').props.children).toBe('+1250 XP');
  });

  it('is black and white, with no green anywhere', () => {
    const utils = open('hike-1', [hike()]);
    expect(JSON.stringify(utils.toJSON())).not.toMatch(/#22C55E|#4CAF50|rgb\(34, ?197/i);
  });

  describe('sharing', () => {
    it('shares the hike to the feed as a hike card and shows it as shared', async () => {
      const utils = open('hike-1', [hike()]);
      expect(utils.getByText('Share to feed')).toBeTruthy();
      expect(utils.getByText('The first and last 200 m of your route are hidden when you share.')).toBeTruthy();
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
      expect(global.__createPost).toHaveBeenCalledTimes(1);
      const args = global.__createPost.mock.calls[0][0];
      expect(args).toMatchObject({ uid: 'u1', type: 'hike' });
      expect(args.run).toMatchObject({ activity: 'hike', title: 'Old Rag', tier: 'Strenuous' });
      expect(global.__hiking.markHikeShared).toHaveBeenCalledWith('u1', 'hike-1', 'post-1');
      expect(utils.getByText('Shared to feed')).toBeTruthy();
      expect(utils.queryByText(/hidden when you share/)).toBeNull();
    });

    it('does not share a second time', async () => {
      const utils = open('hike-1', [hike()]);
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
      expect(global.__createPost).toHaveBeenCalledTimes(1);
    });

    it('shows a hike already shared as shared, and does not offer to post it again', async () => {
      const utils = open('hike-1', [hike({ sharedPostId: 'old' })]);
      expect(utils.getByText('Shared to feed')).toBeTruthy();
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
      expect(global.__createPost).not.toHaveBeenCalled();
    });

    it('says what went wrong, and lets the person try again', async () => {
      const utils = open('hike-1', [hike()]);
      global.__createPost.mockRejectedValueOnce(new Error('offline'));
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
      expect(utils.getByTestId('hike-detail-share-error').props.children).toMatch(/Try again/);
      expect(utils.getByText('Share to feed')).toBeTruthy();
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
      expect(utils.queryByTestId('hike-detail-share-error')).toBeNull();
      expect(utils.getByText('Shared to feed')).toBeTruthy();
      warn.mockRestore();
    });

    it('asks the person to sign in when nobody is', async () => {
      const utils = open('hike-1', [hike()], { user: null });
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
      expect(utils.getByTestId('hike-detail-share-error').props.children).toMatch(/Sign in/);
      expect(global.__createPost).not.toHaveBeenCalled();
    });
  });

  describe('when the hike is not there', () => {
    it('says so, after trying to load the saved hikes', async () => {
      const loadCompletedHikes = jest.fn(async () => undefined);
      const utils = open('hike-9', [hike()], { loadCompletedHikes });
      await act(async () => {});
      expect(loadCompletedHikes).toHaveBeenCalledWith('u1');
      expect(utils.getByTestId('hike-detail-notfound').props.children).toBe('Hike not found');
    });

    it('says it is loading while it looks', async () => {
      let release;
      const loadCompletedHikes = jest.fn(() => new Promise((resolve) => { release = resolve; }));
      const utils = open('hike-9', [], { loadCompletedHikes });
      expect(utils.getByTestId('hike-detail-notfound').props.children).toBe('Loading your hike...');
      await act(async () => { release(); });
      expect(utils.getByTestId('hike-detail-notfound').props.children).toBe('Hike not found');
    });

    it('goes back from there too', () => {
      const utils = open('hike-9', []);
      fireEvent.press(utils.getByTestId('hike-detail-back'));
      expect(global.__router.back).toHaveBeenCalledTimes(1);
    });
  });

  it('goes back, or to the hike history when there is nowhere to go back to', () => {
    const utils = open('hike-1', [hike()]);
    fireEvent.press(utils.getByTestId('hike-detail-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
    global.__router.canGoBack.mockReturnValue(false);
    fireEvent.press(utils.getByTestId('hike-detail-back'));
    expect(global.__router.replace).toHaveBeenCalledWith('/running/hiking/history');
  });
});

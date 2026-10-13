import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// These read Settings > Distance Units from the real settings store; the next two keep it off the network and the phone's storage.
// The tests below were written in kilometres, so they start there (the miles tests set 'imperial' themselves).
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
// The share sheet is the phone's; the text it would be given is what is tested here.
jest.mock('@/services/gpxShare', () => ({
  shareGpx: jest.fn((file) => global.__shareGpx(file)),
  gpxShareErrorText: jest.requireActual('@/services/gpxShare').gpxShareErrorText,
}));

import HikeDetailScreen from '../app/running/hiking/log/[id]';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

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
  global.__shareGpx = jest.fn(async (file) => ({ ok: true, uri: `file:///cache/${file.filename}` }));
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

  it('names the unit beside the distance and the pace: km and /km', () => {
    const utils = open('hike-1', [hike()]);
    expect(utils.getByText('km')).toBeTruthy();
    expect(utils.getByTestId('hike-detail-pace').props.children[1].props.children).toBe(' /km');
  });

  it('shows the same hike in miles and minutes per mile when Settings say so', () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = open('hike-1', [hike()]);
    expect(utils.getByTestId('hike-detail-distance').props.children).toBe('8.85'); // 14.24 km
    expect(utils.getByText('mi')).toBeTruthy();
    expect(utils.queryByText('km')).toBeNull();
    expect(utils.getByTestId('hike-detail-pace').props.children).toEqual(['28:49', expect.anything()]); // 17:54 per km
    expect(utils.getByTestId('hike-detail-pace').props.children[1].props.children).toBe(' /mi');
    expect(utils.getByTestId('hike-detail-climb').props.children).toBe('812 m climb'); // climb stays in metres
  });

  it('changes when the setting changes while the screen is open', () => {
    const utils = open('hike-1', [hike()]);
    expect(utils.getByTestId('hike-detail-distance').props.children).toBe('14.24');
    act(() => { useSettingsStore.setState({ units: 'imperial' }); });
    expect(utils.getByTestId('hike-detail-distance').props.children).toBe('8.85');
    expect(utils.getByTestId('hike-detail-pace').props.children).toEqual(['28:49', expect.anything()]);
  });

  it('writes the caption of the shared hike in the poster\'s unit and stores the distance in km', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = open('hike-1', [hike()]);
    await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-share')); });
    const args = global.__createPost.mock.calls[0][0];
    expect(args.text).toBe('Old Rag: 8.85 mi in 4:15:00 \uD83E\uDD7E');
    expect(args.run.distance).toBe(14.24);
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

  describe('exporting the route', () => {
    it('offers to export the route as a GPX file', () => {
      const utils = open('hike-1', [hike()]);
      expect(utils.getByText('Export GPX')).toBeTruthy();
      expect(utils.queryByTestId('hike-detail-export-error')).toBeNull();
    });

    it('hands the share sheet a GPX file of the route that was walked, named for the trail and the day', async () => {
      const utils = open('hike-1', [hike()]);
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(global.__shareGpx).toHaveBeenCalledTimes(1);
      const file = global.__shareGpx.mock.calls[0][0];
      expect(file.filename).toBe('Old-Rag-2026-10-08.gpx');
      expect(file.title).toBe('Old Rag (Ridge Trail)');
      expect(file.xml).toContain('<name>Old Rag (Ridge Trail)</name>');
      expect(file.xml).toContain('Recorded with Zown HQ. 14.24 km, 4:15:00, 812 m climb.');
      expect(file.xml.match(/<trkpt /g)).toHaveLength(60);
      expect(file.xml).toContain('<trkpt lat="40" lon="-74"></trkpt>');
    });

    it('writes the note inside the file in kilometres whatever the setting, since the file is for other apps', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      const utils = open('hike-1', [hike()]);
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(global.__shareGpx.mock.calls[0][0].xml).toContain('Recorded with Zown HQ. 14.24 km, 4:15:00, 812 m climb.');
    });

    it('does not post anything to the feed, and does not need anyone signed in', async () => {
      const utils = open('hike-1', [hike()], { user: null });
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(global.__shareGpx).toHaveBeenCalledTimes(1);
      expect(global.__createPost).not.toHaveBeenCalled();
      expect(global.__hiking.markHikeShared).not.toHaveBeenCalled();
      expect(utils.queryByTestId('hike-detail-export-error')).toBeNull();
    });

    it('says it is preparing the file, and ignores a second tap meanwhile', async () => {
      const utils = open('hike-1', [hike()]);
      let finish;
      global.__shareGpx.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(utils.getByText('Preparing...')).toBeTruthy();
      expect(utils.queryByText('Export GPX')).toBeNull();
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(global.__shareGpx).toHaveBeenCalledTimes(1);
      // Even a tap that reaches the handler anyway does nothing while it is busy.
      const button = utils.UNSAFE_getAllByProps({ testID: 'hike-detail-export' }).find((n) => typeof n.props.onPress === 'function');
      await act(async () => { await button.props.onPress(); });
      expect(global.__shareGpx).toHaveBeenCalledTimes(1);
      await act(async () => { finish({ ok: true, uri: 'file:///x.gpx' }); });
      expect(utils.getByText('Export GPX')).toBeTruthy();
      expect(utils.queryByText('Preparing...')).toBeNull();
    });

    it('says what went wrong, and clears it on the next try', async () => {
      const utils = open('hike-1', [hike()]);
      global.__shareGpx.mockResolvedValueOnce({ ok: false, reason: 'write-failed' });
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(utils.getByTestId('hike-detail-export-error').props.children)
        .toBe('Could not prepare the file. Check that the phone has free space and try again.');
      expect(utils.getByText('Export GPX')).toBeTruthy();
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(utils.queryByTestId('hike-detail-export-error')).toBeNull();
    });

    it('has a message for a phone that cannot share files', async () => {
      const utils = open('hike-1', [hike()]);
      global.__shareGpx.mockResolvedValueOnce({ ok: false, reason: 'unavailable' });
      await act(async () => { fireEvent.press(utils.getByTestId('hike-detail-export')); });
      expect(utils.getByTestId('hike-detail-export-error').props.children).toBe('Sharing files is not available on this phone.');
    });

    it('is not offered for a hike with no route to write', () => {
      const utils = open('hike-1', [hike({ track: [] })]);
      expect(utils.queryByTestId('hike-detail-export')).toBeNull();
      expect(utils.queryByText('Export GPX')).toBeNull();
    });

    it('is still offered once the hike has been shared to the feed', () => {
      const utils = open('hike-1', [hike({ sharedPostId: 'old' })]);
      expect(utils.getByTestId('hike-detail-export')).toBeTruthy();
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

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
  useLocalSearchParams: () => global.__params,
}), { virtual: true });
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 40.7, longitude: -74 } })),
  Accuracy: { Balanced: 3 },
}), { virtual: true });
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const MapView = (props) => {
    global.__mapProps = props;
    return mockReact.createElement(mockRn.View, { testID: 'map' }, props.children);
  };
  const Polyline = (props) => {
    global.__polylines.push(props);
    return mockReact.createElement(mockRn.View, { testID: `line-${props.strokeWidth}` });
  };
  const Marker = () => mockReact.createElement(mockRn.View, { testID: 'marker' });
  return { __esModule: true, default: MapView, Polyline, Marker, PROVIDER_DEFAULT: 'default' };
}, { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onBack, rightAction }) => mockReact.createElement(
      mockRn.View,
      null,
      mockReact.createElement(mockRn.Pressable, { onPress: onBack, testID: 'header-back' }, mockReact.createElement(mockRn.Text, null, title)),
      rightAction,
    ),
  };
});
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress, disabled }) => mockReact.createElement(
      mockRn.TouchableOpacity,
      { onPress, disabled, accessibilityRole: 'button' },
      mockReact.createElement(mockRn.Text, null, title),
    ),
  };
});
jest.mock('@/store/hikingStore', () => ({
  useHikingStore: Object.assign(() => global.__hiking, { getState: () => global.__hiking }),
}));
jest.mock('@/store/offlineTrailStore', () => ({ useOfflineTrailStore: () => global.__offline }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/expStore', () => ({ useExpStore: () => ({ addExpActivity: global.__addExp }) }));
jest.mock('@/store/badgeStore', () => ({ useBadgeStore: () => ({ unlockBadge: global.__unlockBadge }) }));
jest.mock('@/store/bodyCompositionStore', () => ({ useBodyCompositionStore: () => ({ scans: global.__scans }) }));
jest.mock('@/services/weatherService', () => ({ getWeatherSnapshot: jest.fn() }));
jest.mock('@/services/hikingService', () => ({ fetchRouteForMap: jest.fn() }));
jest.mock('@/services/runTracking', () => ({
  startTracking: jest.fn(async () => 'background'),
  stopTracking: jest.fn(async () => undefined),
}));

import { Circle as SvgCircle, Polyline as SvgPolyline } from 'react-native-svg';
import HikeMonitorScreen from '../app/running/hiking/monitor';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { trackedMs } from '../lib/runTracker';

const Location = require('expo-location');
const Speech = require('expo-speech');
const tracking = require('@/services/runTracking');
const { getWeatherSnapshot } = require('@/services/weatherService');
const { fetchRouteForMap } = require('@/services/hikingService');

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);
const store = () => useRunTrackerStore.getState();

const TRAIL = { id: 'trailapi-7', name: 'Old Rag' };
const snapshot = (alerts = []) => ({
  alerts,
  forecast: [{ name: 'Today', shortForecast: 'Sunny', windDirection: 'N', windSpeed: '5 mph', temperatureF: 70 }],
  checkedAt: new Date(T0).toISOString(),
});

// A reading at `sec` seconds after the start, `x` metres east of the start line.
const fix = (sec, x, extra = {}) => ({
  timestamp: T0 + sec * 1000,
  coords: {
    latitude: 40.7, longitude: -74 + x / 84300, accuracy: 4, speed: 3, altitude: null, altitudeAccuracy: -1, heading: 0, ...extra,
  },
});
// Two minutes of walking east: 360 m, so a real hike.
const walk = (seconds = 120, extra = () => ({})) => Array.from({ length: seconds }, (_, i) => fix(i + 1, (i + 1) * 3, extra(i)));

const tick = (seconds) => act(() => { jest.advanceTimersByTime(seconds * 1000); });
// Lets the chain of awaits on the screen's way in finish (permission, GPS, first position, weather).
const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => {}); };
const mount = async () => {
  const utils = render(<HikeMonitorScreen />);
  await settle();
  return utils;
};
const press = (utils, text) => fireEvent.press(utils.getByText(text));

describe('HikeMonitorScreen', () => {
  let warn;
  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.__router = { replace: jest.fn(), back: jest.fn() };
    global.__params = { id: 'trailapi-7', mapId: '55', pathName: 'Ridge Trail' };
    global.__polylines = [];
    global.__mapProps = null;
    global.__addExp = jest.fn();
    global.__unlockBadge = jest.fn();
    global.__scans = [];
    global.__offline = { trails: {}, keepTrail: jest.fn(), removeTrail: jest.fn() };
    global.__hiking = {
      getTrailById: jest.fn((id) => (id === TRAIL.id ? TRAIL : null)),
      addCompletedHike: jest.fn((hike) => ({
        ...hike, id: 'hike-1', distanceKm: Math.round(hike.distanceKm * 100) / 100, elevationGainM: Math.round(hike.elevationGainM),
      })),
      completedHikes: [{ id: 'hike-1', distanceKm: 0.36 }],
    };
    store().reset();
    Location.requestForegroundPermissionsAsync.mockClear();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockClear();
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 40.7, longitude: -74 } });
    tracking.startTracking.mockClear();
    tracking.stopTracking.mockClear();
    Speech.speak.mockClear();
    Speech.stop.mockClear();
    getWeatherSnapshot.mockReset();
    getWeatherSnapshot.mockResolvedValue(snapshot());
    fetchRouteForMap.mockReset();
    fetchRouteForMap.mockResolvedValue({ coordinates: [{ latitude: 40.7, longitude: -74 }, { latitude: 40.71, longitude: -74.01 }] });
  });
  afterEach(() => { warn.mockRestore(); });

  describe('recording', () => {
    it('starts recording the hike, with GPS that keeps going in the background, once location is allowed', async () => {
      await mount();
      expect(store().tracker.status).toBe('running');
      expect(store().tracker.kind).toBe('hike:trailapi-7');
      expect(tracking.startTracking).toHaveBeenCalledTimes(1);
      expect(tracking.startTracking).toHaveBeenCalledWith({ label: 'hike' });
    });

    it('does not auto-pause a hike, since a steep climb is slower than standing still to auto-pause', async () => {
      await mount();
      expect(store().tracker.autoPause).toBe(false);
    });

    it('records nothing and explains why when location is refused', async () => {
      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
      const utils = await mount();
      expect(utils.getByTestId('hike-no-location')).toBeTruthy();
      expect(store().tracker.status).toBe('idle');
      expect(tracking.startTracking).not.toHaveBeenCalled();
    });

    it('shows distance, climb and difficulty from the tracker as the hike goes on', async () => {
      const utils = await mount();
      expect(utils.getByTestId('hike-distance').props.children.join('')).toBe('0.00 km');
      act(() => { store().ingest(walk(250, (i) => ({ altitude: 50 + (i + 1) * 0.2, altitudeAccuracy: 4 }))); });
      await tick(250);
      expect(utils.getByTestId('hike-distance').props.children.join('')).toMatch(/^0\.7\d km$/);
      expect(Number(utils.getByTestId('hike-climb').props.children[0])).toBeGreaterThan(30);
      expect(utils.getByTestId('hike-difficulty').props.children).toBe('Easy');
      expect(utils.getByTestId('hike-elapsed').props.children).toBe('Hiking for 4m');
    });

    it('keeps counting the clock while no readings come in', async () => {
      const utils = await mount();
      await tick(75);
      expect(utils.getByTestId('hike-elapsed').props.children).toBe('Hiking for 1m');
    });

    it('shows a GPS banner until the first reading, and a lost-signal one after a while without', async () => {
      const utils = await mount();
      expect(utils.getByText('Searching for GPS...')).toBeTruthy();
      act(() => { store().ingest([fix(1, 0)]); });
      await tick(1);
      expect(utils.queryByTestId('hike-banner')).toBeNull();
      await tick(20);
      expect(utils.getByText('GPS signal lost')).toBeTruthy();
    });
  });

  describe('the map', () => {
    it('draws the path walked so far, and the path that was picked, dashed', async () => {
      await mount();
      act(() => { store().ingest(walk(60)); });
      await tick(60);
      const planned = global.__polylines.filter((p) => p.lineDashPattern);
      const walked = global.__polylines.filter((p) => !p.lineDashPattern);
      expect(planned.length).toBeGreaterThan(0);
      expect(planned[planned.length - 1].coordinates).toHaveLength(2);
      expect(walked.length).toBeGreaterThan(0);
      expect(walked[walked.length - 1].coordinates).toBe(store().tracker.route);
    });

    it('is centred on the first position before the tracker has a reading', async () => {
      await mount();
      expect(global.__mapProps.region).toMatchObject({ latitude: 40.7, longitude: -74 });
    });

    it('follows the hiker once they are well away from where it is centred, not on every reading', async () => {
      await mount();
      act(() => { store().ingest([fix(1, 0), fix(2, 3), fix(3, 6)]); });
      await tick(3);
      const first = global.__mapProps.region.longitude;
      act(() => { store().ingest(walk(60).slice(3)); });
      await tick(60);
      const later = global.__mapProps.region.longitude;
      expect(later).toBeGreaterThan(first); // moved on, after 150 m or so
      // ... but not each time the position changes by a few metres
      const regions = [];
      for (let i = 0; i < 3; i += 1) {
        act(() => { store().ingest([fix(70 + i, 190 + i)]); });
        await tick(1);
        regions.push(global.__mapProps.region.longitude);
      }
      expect(new Set(regions).size).toBe(1);
    });
  });

  describe('the weather', () => {
    it('checks the weather where the hike starts', async () => {
      const utils = await mount();
      expect(getWeatherSnapshot).toHaveBeenCalledTimes(1);
      expect(getWeatherSnapshot).toHaveBeenCalledWith(40.7, -74);
      expect(utils.getByText('No active weather alerts for your current location')).toBeTruthy();
      expect(utils.getByText('Sunny')).toBeTruthy();
    });

    it('speaks an alert that is already active before the start', async () => {
      getWeatherSnapshot.mockResolvedValue(snapshot([{ id: 'a1', event: 'Heat Advisory', headline: 'Hot', severity: 'Moderate' }]));
      const utils = await mount();
      expect(Speech.speak).toHaveBeenCalledWith('Before you start: Heat Advisory is active for this area.', { rate: 0.95 });
      expect(utils.getAllByText('Heat Advisory').length).toBeGreaterThan(0);
    });

    it('checks again every 15 minutes, where the hiker is by then, without being reset by the GPS', async () => {
      await mount();
      act(() => { store().ingest(walk(120)); });
      await tick(14 * 60);
      expect(getWeatherSnapshot).toHaveBeenCalledTimes(1);
      await tick(60);
      await settle();
      expect(getWeatherSnapshot).toHaveBeenCalledTimes(2);
      const [lat, lng] = getWeatherSnapshot.mock.calls[1];
      expect(lat).toBeCloseTo(40.7, 3);
      expect(lng).toBeGreaterThan(-74); // east of the start
    });

    it('only speaks an alert that is new since the last check', async () => {
      const alert = { id: 'a1', event: 'Heat Advisory', headline: 'Hot', severity: 'Moderate' };
      getWeatherSnapshot.mockResolvedValueOnce(snapshot([alert]));
      getWeatherSnapshot.mockResolvedValue(snapshot([alert]));
      await mount();
      Speech.speak.mockClear();
      await tick(15 * 60);
      await settle();
      expect(getWeatherSnapshot).toHaveBeenCalledTimes(2);
      expect(Speech.speak).not.toHaveBeenCalled();
    });
  });

  describe('pausing', () => {
    it('the pause button stops the clock and shows it, and the same button resumes', async () => {
      const utils = await mount();
      await tick(30);
      act(() => { store().ingest(walk(30)); });
      fireEvent.press(utils.getByTestId('hike-pause-button'));
      expect(store().tracker.status).toBe('paused');
      expect(utils.getByText('Paused')).toBeTruthy();
      expect(utils.getByTestId('hike-elapsed').props.children).toBe('Paused at 0m');
      const frozen = utils.getByTestId('hike-elapsed').props.children;
      await tick(120);
      expect(utils.getByTestId('hike-elapsed').props.children).toBe(frozen);

      tracking.startTracking.mockClear();
      fireEvent.press(utils.getByTestId('hike-pause-button'));
      expect(store().tracker.status).toBe('running');
      expect(utils.queryByText('Paused')).toBeNull();
      expect(tracking.startTracking).toHaveBeenCalledWith({ label: 'hike' });
    });

    it('does not count the time paused in the hike', async () => {
      const utils = await mount();
      await tick(30);
      fireEvent.press(utils.getByTestId('hike-pause-button'));
      await tick(600);
      fireEvent.press(utils.getByTestId('hike-pause-button'));
      await tick(30);
      expect(Math.round(trackedMs(store().tracker, Date.now()) / 1000)).toBe(60);
    });
  });

  describe('ending a short hike', () => {
    it('End Monitoring throws it away: nothing is saved and the GPS is switched off', async () => {
      const utils = await mount();
      act(() => { store().ingest(walk(20)); }); // 60 m
      await tick(20);
      expect(utils.queryByText(/^Complete Hike/)).toBeNull();
      press(utils, 'End Monitoring');
      expect(global.__hiking.addCompletedHike).not.toHaveBeenCalled();
      expect(tracking.stopTracking).toHaveBeenCalled();
      expect(store().tracker.status).toBe('idle');
      expect(global.__router.back).toHaveBeenCalledTimes(1);
      expect(global.__addExp).not.toHaveBeenCalled();
    });

    it('the back arrow leaves straight away when there is nothing worth keeping', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('header-back'));
      expect(utils.queryByTestId('hike-leave-panel')).toBeNull();
      expect(global.__router.back).toHaveBeenCalledTimes(1);
      expect(store().tracker.status).toBe('idle');
    });
  });

  describe('completing a hike', () => {
    const goFar = async (utils, extra) => {
      act(() => { store().ingest(walk(120, extra)); });
      await tick(120);
      return utils;
    };

    it('offers Complete Hike with the XP once the hike is long enough to count', async () => {
      const utils = await goFar(await mount());
      expect(utils.getByText(/^Complete Hike \(\+\d+ XP\)$/)).toBeTruthy();
      expect(utils.queryByText('End Monitoring')).toBeNull();
    });

    it('saves the hike with the trail, the path, the moving time, the climb and the route walked', async () => {
      const utils = await goFar(await mount(), (i) => ({ altitude: 100 + (i + 1) * 0.3, altitudeAccuracy: 4 }));
      fireEvent.press(utils.getByText(/^Complete Hike/));
      expect(global.__hiking.addCompletedHike).toHaveBeenCalledTimes(1);
      const [hike, uid] = global.__hiking.addCompletedHike.mock.calls[0];
      expect(uid).toBe('u1');
      expect(hike).toMatchObject({ trailId: 'trailapi-7', trailName: 'Old Rag', pathName: 'Ridge Trail', durationSeconds: 120 });
      expect(hike.distanceKm).toBeGreaterThan(0.3);
      expect(hike.distanceKm).toBeLessThan(0.4);
      expect(hike.startTime).toBe(new Date(T0).toISOString());
      expect(hike.coords.length).toBeGreaterThan(20);
      expect(hike.coords[0]).toEqual(expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }));
      expect(hike.difficultyTier).toBe('Easy');
      expect(hike.calories).toBeGreaterThan(0);
      expect(hike.xpEarned).toBeGreaterThan(0);
      expect(hike.elevationLossM).toBeGreaterThanOrEqual(0);
    });

    it('stops the GPS, clears the recording and opens the finished-hike screen for the saved hike', async () => {
      const utils = await goFar(await mount());
      fireEvent.press(utils.getByText(/^Complete Hike/));
      expect(tracking.stopTracking).toHaveBeenCalled();
      expect(store().tracker.status).toBe('idle');
      expect(global.__router.replace).toHaveBeenCalledTimes(1);
      const arg = global.__router.replace.mock.calls[0][0];
      expect(arg.pathname).toBe('/workout/complete');
      expect(arg.params).toMatchObject({
        type: 'hike', hikeId: 'hike-1', distanceKm: expect.any(String), durationSeconds: '120', difficultyTier: 'Easy',
      });
      expect(Number(arg.params.xpEarned)).toBeGreaterThan(0);
    });

    it('gives the XP, and the First Trail badge for the first hike', async () => {
      const utils = await goFar(await mount());
      fireEvent.press(utils.getByText(/^Complete Hike/));
      expect(global.__addExp).toHaveBeenCalledTimes(1);
      expect(global.__addExp.mock.calls[0][0]).toMatchObject({ type: 'hiking', completed: true });
      expect(global.__unlockBadge).toHaveBeenCalledWith('badge-11', 'u1');
      expect(global.__unlockBadge).not.toHaveBeenCalledWith('badge-12', 'u1');
    });

    it('saves only once when Complete is tapped twice', async () => {
      const utils = await goFar(await mount());
      const button = utils.getByText(/^Complete Hike/);
      fireEvent.press(button);
      fireEvent.press(button);
      expect(global.__hiking.addCompletedHike).toHaveBeenCalledTimes(1);
      expect(global.__router.replace).toHaveBeenCalledTimes(1);
    });

    it('saves only once even when both taps land before the screen has redrawn', async () => {
      const utils = await goFar(await mount());
      const button = utils.getByText(/^Complete Hike/);
      // Inside one act() the button has not yet been disabled when the second tap arrives.
      act(() => {
        fireEvent.press(button);
        fireEvent.press(button);
      });
      expect(global.__hiking.addCompletedHike).toHaveBeenCalledTimes(1);
      expect(global.__router.replace).toHaveBeenCalledTimes(1);
      expect(global.__addExp).toHaveBeenCalledTimes(1);
    });

    it('keeps the recording, and lets the person try again, when saving fails', async () => {
      global.__hiking.addCompletedHike.mockImplementationOnce(() => { throw new Error('storage full'); });
      const utils = await goFar(await mount());
      fireEvent.press(utils.getByText(/^Complete Hike/));
      expect(global.__router.replace).not.toHaveBeenCalled();
      expect(store().tracker.status).toBe('running');
      expect(store().tracker.distanceM).toBeGreaterThan(300);
      fireEvent.press(utils.getByText(/^Complete Hike/));
      expect(global.__hiking.addCompletedHike).toHaveBeenCalledTimes(2);
      expect(global.__router.replace).toHaveBeenCalledTimes(1);
    });
  });

  describe('leaving a hike in progress', () => {
    const goFar = async () => {
      const utils = await mount();
      act(() => { store().ingest(walk(120)); });
      await tick(120);
      return utils;
    };

    it('the back arrow pauses it and asks, instead of losing it', async () => {
      const utils = await goFar();
      fireEvent.press(utils.getByTestId('header-back'));
      expect(store().tracker.status).toBe('paused');
      expect(utils.getByTestId('hike-leave-panel')).toBeTruthy();
      expect(global.__router.back).not.toHaveBeenCalled();
      expect(global.__hiking.addCompletedHike).not.toHaveBeenCalled();
    });

    it('Resume carries on and turns the GPS back on', async () => {
      const utils = await goFar();
      fireEvent.press(utils.getByTestId('header-back'));
      tracking.startTracking.mockClear();
      press(utils, 'Resume');
      expect(store().tracker.status).toBe('running');
      expect(utils.queryByTestId('hike-leave-panel')).toBeNull();
      expect(tracking.startTracking).toHaveBeenCalledWith({ label: 'hike' });
    });

    it('Finish & save saves the hike', async () => {
      const utils = await goFar();
      fireEvent.press(utils.getByTestId('header-back'));
      press(utils, 'Finish & save');
      expect(global.__hiking.addCompletedHike).toHaveBeenCalledTimes(1);
      expect(global.__router.replace.mock.calls[0][0].pathname).toBe('/workout/complete');
    });

    it('Discard hike throws it away and leaves', async () => {
      const utils = await goFar();
      fireEvent.press(utils.getByTestId('header-back'));
      fireEvent.press(utils.getByTestId('hike-discard'));
      expect(global.__hiking.addCompletedHike).not.toHaveBeenCalled();
      expect(store().tracker.status).toBe('idle');
      expect(tracking.stopTracking).toHaveBeenCalled();
      expect(global.__router.back).toHaveBeenCalledTimes(1);
    });

    it('closing the screen without finishing pauses the hike, and the same trail picks it up again', async () => {
      const first = await goFar();
      first.unmount();
      expect(store().tracker.status).toBe('paused');
      const distance = store().tracker.distanceM;
      expect(distance).toBeGreaterThan(300);

      const again = await mount();
      expect(store().tracker.distanceM).toBe(distance); // the same hike, not a new one
      expect(again.getByTestId('hike-leave-panel')).toBeTruthy();
    });

    it('a hike on a different trail starts fresh instead of picking up the old one', async () => {
      const first = await goFar();
      first.unmount();
      global.__params = { id: 'trailapi-99' };
      await mount();
      expect(store().tracker.distanceM).toBe(0);
      expect(store().tracker.kind).toBe('hike:trailapi-99');
    });

    it('finishing the hike does not leave it paused behind the screen', async () => {
      const utils = await goFar();
      fireEvent.press(utils.getByText(/^Complete Hike/));
      utils.unmount();
      expect(store().tracker.status).toBe('idle');
    });
  });

  describe('with no signal', () => {
    const KEPT_ROUTE = {
      coordinates: [{ latitude: 40.7, longitude: -74 }, { latitude: 40.705, longitude: -74.005 }, { latitude: 40.71, longitude: -74.01 }],
      distanceKm: 1.4, elevationGainM: null, elevationProfile: null,
    };
    const keep = (extra = {}) => {
      global.__offline.trails = {
        'trailapi-7': { id: 'trailapi-7', trail: TRAIL, maps: [{ id: 55, name: 'Ridge Trail' }], routes: { 55: KEPT_ROUTE }, ...extra },
      };
    };

    it('draws the path kept on the phone, without asking the trail service for it', async () => {
      keep();
      await mount();
      expect(fetchRouteForMap).not.toHaveBeenCalled();
      const planned = global.__polylines.filter((p) => p.lineDashPattern);
      expect(planned[planned.length - 1].coordinates).toBe(KEPT_ROUTE.coordinates);
    });

    it('asks for the path when none is kept, and keeps it with the trail for next time', async () => {
      await mount();
      expect(fetchRouteForMap).toHaveBeenCalledWith('55');
      expect(global.__offline.keepTrail).toHaveBeenCalledTimes(1);
      expect(global.__offline.keepTrail).toHaveBeenCalledWith({
        trail: TRAIL,
        routes: { 55: { coordinates: [{ latitude: 40.7, longitude: -74 }, { latitude: 40.71, longitude: -74.01 }] } },
      });
    });

    it('asks for the path of the chosen map only, not another kept one', async () => {
      keep({ routes: { 56: KEPT_ROUTE } });
      await mount();
      expect(fetchRouteForMap).toHaveBeenCalledWith('55');
    });

    it('keeps nothing when the path cannot be fetched', async () => {
      fetchRouteForMap.mockResolvedValue(null);
      await mount();
      expect(global.__offline.keepTrail).not.toHaveBeenCalled();
    });

    it('records the hike under the trail kept on the phone when the last search no longer has it', async () => {
      global.__hiking.getTrailById = jest.fn(() => null);
      keep();
      const utils = await mount();
      expect(utils.getByText('Old Rag')).toBeTruthy();
      act(() => { store().ingest(walk(120)); });
      await tick(120);
      fireEvent.press(utils.getByText(/^Complete Hike/));
      expect(global.__hiking.addCompletedHike.mock.calls[0][0]).toMatchObject({ trailId: 'trailapi-7', trailName: 'Old Rag' });
    });

    it('still calls an unknown trail an untitled hike', async () => {
      global.__hiking.getTrailById = jest.fn(() => null);
      const utils = await mount();
      act(() => { store().ingest(walk(120)); });
      await tick(120);
      fireEvent.press(utils.getByText(/^Complete Hike/));
      expect(global.__hiking.addCompletedHike.mock.calls[0][0]).toMatchObject({ trailId: null, trailName: 'Untitled hike' });
    });
  });

  describe('the map, or the trail alone', () => {
    const selected = (utils, mode) => utils.getByTestId(`hike-view-${mode}`).props.accessibilityState.selected;

    it('shows the map to begin with, with a choice of the map or the trail alone', async () => {
      const utils = await mount();
      expect(utils.getByTestId('map')).toBeTruthy();
      expect(utils.queryByTestId('hike-trail-view')).toBeNull();
      expect(selected(utils, 'map')).toBe(true);
      expect(selected(utils, 'trail')).toBe(false);
      expect(utils.queryByTestId('hike-offline-note')).toBeNull();
    });

    it('switches to the trail alone, with the path and the hiker on it, and back to the map', async () => {
      const utils = await mount();
      act(() => { store().ingest(walk(60)); });
      await tick(60);
      fireEvent.press(utils.getByTestId('hike-view-trail'));
      expect(utils.getByTestId('hike-trail-view')).toBeTruthy();
      expect(utils.queryByTestId('map')).toBeNull();
      expect(selected(utils, 'trail')).toBe(true);
      expect(selected(utils, 'map')).toBe(false);
      // the path to follow, dashed, and the path walked (a glow and a line)
      const lines = utils.UNSAFE_getAllByType(SvgPolyline);
      expect(lines).toHaveLength(3);
      expect(lines.filter((l) => l.props.strokeDasharray)).toHaveLength(1);
      // a ring and a dot for where the path starts and ends, and a dot with a halo for the hiker
      expect(utils.UNSAFE_getAllByType(SvgCircle)).toHaveLength(6);
      fireEvent.press(utils.getByTestId('hike-view-map'));
      expect(utils.getByTestId('map')).toBeTruthy();
      expect(utils.queryByTestId('hike-trail-view')).toBeNull();
    });

    it('moves to the trail alone by itself when the weather check cannot reach the network, and says so', async () => {
      getWeatherSnapshot.mockRejectedValue(new Error('Network request failed'));
      const utils = await mount();
      expect(utils.getByTestId('hike-trail-view')).toBeTruthy();
      expect(utils.queryByTestId('map')).toBeNull();
      expect(selected(utils, 'trail')).toBe(true);
      expect(utils.getByTestId('hike-offline-note')).toBeTruthy();
    });

    it('does not blame the signal when the person chose the trail themselves', async () => {
      getWeatherSnapshot.mockRejectedValue(new Error('Network request failed'));
      const utils = await mount();
      fireEvent.press(utils.getByTestId('hike-view-map'));
      fireEvent.press(utils.getByTestId('hike-view-trail'));
      expect(utils.getByTestId('hike-trail-view')).toBeTruthy();
      expect(utils.queryByTestId('hike-offline-note')).toBeNull();
    });

    it('goes back to the map by itself when a later check gets through', async () => {
      getWeatherSnapshot.mockRejectedValueOnce(new Error('Network request failed'));
      const utils = await mount();
      expect(utils.getByTestId('hike-trail-view')).toBeTruthy();
      press(utils, 'Check now');
      await settle();
      expect(utils.getByTestId('map')).toBeTruthy();
      expect(utils.queryByTestId('hike-trail-view')).toBeNull();
      expect(utils.queryByTestId('hike-offline-note')).toBeNull();
    });

    it('leaves it to the person once they choose', async () => {
      getWeatherSnapshot.mockRejectedValue(new Error('Network request failed'));
      const utils = await mount();
      fireEvent.press(utils.getByTestId('hike-view-map'));
      expect(utils.getByTestId('map')).toBeTruthy();
      expect(utils.queryByTestId('hike-offline-note')).toBeNull();
      press(utils, 'Check now');
      await settle();
      expect(utils.getByTestId('map')).toBeTruthy();

      fireEvent.press(utils.getByTestId('hike-view-trail'));
      getWeatherSnapshot.mockResolvedValue(snapshot());
      press(utils, 'Check now');
      await settle();
      expect(utils.getByTestId('hike-trail-view')).toBeTruthy();
      expect(utils.queryByTestId('hike-offline-note')).toBeNull();
    });
  });
});

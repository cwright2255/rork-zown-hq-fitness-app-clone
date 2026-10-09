import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Polyline as SvgPolyline } from 'react-native-svg';

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
// A build without native maps: requiring the package fails.
jest.mock('react-native-maps', () => {
  throw new Error('react-native-maps is not available');
}, { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PrimaryButton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/hikingStore', () => ({
  useHikingStore: Object.assign(() => global.__hiking, { getState: () => global.__hiking }),
}));
jest.mock('@/store/offlineTrailStore', () => ({ useOfflineTrailStore: () => global.__offline }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/expStore', () => ({ useExpStore: () => ({ addExpActivity: jest.fn() }) }));
jest.mock('@/store/badgeStore', () => ({ useBadgeStore: () => ({ unlockBadge: jest.fn() }) }));
jest.mock('@/store/bodyCompositionStore', () => ({ useBodyCompositionStore: () => ({ scans: [] }) }));
jest.mock('@/services/weatherService', () => ({ getWeatherSnapshot: jest.fn() }));
jest.mock('@/services/hikingService', () => ({ fetchRouteForMap: jest.fn() }));
jest.mock('@/services/runTracking', () => ({
  startTracking: jest.fn(async () => 'background'),
  stopTracking: jest.fn(async () => undefined),
}));

import { useRunTrackerStore } from '../store/runTrackerStore';

// The screen says so when it cannot load the maps package; that is expected here.
const loadWarning = jest.spyOn(console, 'warn').mockImplementation(() => {});
const HikeMonitorScreen = require('../app/running/hiking/monitor').default;

const { getWeatherSnapshot } = require('@/services/weatherService');
const { fetchRouteForMap } = require('@/services/hikingService');

const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => {}); };
const mount = async () => {
  const utils = render(<HikeMonitorScreen />);
  await settle();
  return utils;
};

describe('HikeMonitorScreen on a phone build without native maps', () => {
  beforeEach(() => {
    global.__router = { replace: jest.fn(), back: jest.fn() };
    global.__params = { id: 'trailapi-7', mapId: '55' };
    global.__hiking = { getTrailById: () => ({ id: 'trailapi-7', name: 'Old Rag' }), addCompletedHike: jest.fn(), completedHikes: [] };
    global.__offline = { trails: {}, keepTrail: jest.fn(), removeTrail: jest.fn() };
    act(() => { useRunTrackerStore.getState().reset(); });
    getWeatherSnapshot.mockReset();
    getWeatherSnapshot.mockResolvedValue({ alerts: [], forecast: [], checkedAt: new Date().toISOString() });
    fetchRouteForMap.mockReset();
    fetchRouteForMap.mockResolvedValue({ coordinates: [{ latitude: 40.7, longitude: -74 }, { latitude: 40.71, longitude: -74.01 }] });
  });
  afterEach(() => {
    act(() => { useRunTrackerStore.getState().reset(); });
  });

  it('notes in the log that there is no map package, and carries on', () => {
    expect(loadWarning).toHaveBeenCalledWith('[hiking/monitor] react-native-maps failed to load:', expect.any(Error));
  });

  it('shows the trail alone, with the path to follow, and no choice of map', async () => {
    const utils = await mount();
    expect(utils.getByTestId('hike-trail-view')).toBeTruthy();
    expect(utils.queryByTestId('hike-view-map')).toBeNull();
    expect(utils.queryByTestId('hike-view-trail')).toBeNull();
    const lines = utils.UNSAFE_getAllByType(SvgPolyline);
    expect(lines).toHaveLength(1);
    expect(lines[0].props.strokeDasharray).toBeTruthy();
  });

  it('does not blame the signal for there being no map', async () => {
    getWeatherSnapshot.mockRejectedValue(new Error('Network request failed'));
    const utils = await mount();
    expect(utils.getByTestId('hike-trail-view')).toBeTruthy();
    expect(utils.queryByTestId('hike-offline-note')).toBeNull();
  });
});

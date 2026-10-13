import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

// This test uses the real ScreenHeader and a safe area that behaves like the real one
// (a SafeAreaView pads the top by the notch height unless its edges leave 'top' out),
// so it measures what a phone would show: how much space sits above the title.
const INSET_TOP = 59; // an iPhone with the Dynamic Island

// These read Settings > Distance Units from the real settings store; the next two keep it off the network and the phone's storage.
// The tests below were written in kilometres, so they start there (the miles tests set 'imperial' themselves).
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trailapi-7' }),
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
  return {
    useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
    SafeAreaView: ({ style, edges, children }) => {
      const padsTop = !edges || edges.includes('top');
      return mockReact.createElement(mockRn.View, { style: [style, padsTop ? { paddingTop: 59 } : null] }, children);
    },
  };
}, { virtual: true });
jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const MapView = (props) => mockReact.createElement(mockRn.View, { testID: 'map' }, props.children);
  return { __esModule: true, default: MapView, Polyline: () => null, Marker: () => null, PROVIDER_DEFAULT: 'default' };
}, { virtual: true });
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
jest.mock('@/store/hikingStore', () => ({
  useHikingStore: Object.assign(
    () => ({ getTrailById: () => ({ id: 'trailapi-7', name: 'Tarnsfield Park' }), addCompletedHike: jest.fn() }),
    { getState: () => ({ completedHikes: [] }) },
  ),
}));
jest.mock('@/store/offlineTrailStore', () => ({ useOfflineTrailStore: () => ({ trails: {}, keepTrail: jest.fn() }) }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/expStore', () => ({ useExpStore: () => ({ addExpActivity: jest.fn() }) }));
jest.mock('@/store/badgeStore', () => ({ useBadgeStore: () => ({ unlockBadge: jest.fn() }) }));
jest.mock('@/store/bodyCompositionStore', () => ({ useBodyCompositionStore: () => ({ scans: [] }) }));
jest.mock('@/services/weatherService', () => ({
  getWeatherSnapshot: jest.fn(async () => ({ alerts: [], forecast: [], checkedAt: new Date().toISOString() })),
}));
jest.mock('@/services/hikingService', () => ({ fetchRouteForMap: jest.fn(async () => null) }));
jest.mock('@/services/runTracking', () => ({
  startTracking: jest.fn(async () => 'background'),
  stopTracking: jest.fn(async () => undefined),
}));
jest.mock('@/services/offRouteWatch', () => ({ watchOffRoute: jest.fn(() => ({ stop: jest.fn(), mute: jest.fn() })) }));

import HikeMonitorScreen from '../app/running/hiking/monitor';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const Location = require('expo-location');

// The space above the title text: every top padding on the way up from it to the screen's edge.
const spaceAboveTitle = (utils, title) => {
  let total = 0;
  for (let node = utils.getByText(title).parent; node; node = node.parent) {
    if (typeof node.type !== 'string') continue; // only real views count; wrappers only pass a style on
    const style = StyleSheet.flatten(node.props.style) || {};
    total += style.paddingTop || 0;
  }
  return total;
};

const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => {}); };

describe('Hike Monitor: space above the header', () => {
  let warn;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useRunTrackerStore.getState().reset();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });
  afterEach(() => { warn.mockRestore(); });

  it('leaves room for the notch once, not twice, above the trail name', async () => {
    const utils = render(<HikeMonitorScreen />);
    await settle();
    // The header pads the notch plus a little breathing room (8). A second safe area
    // around it used to add the notch height again: 126 instead of 67.
    expect(spaceAboveTitle(utils, 'Tarnsfield Park')).toBe(INSET_TOP + 8);
    utils.unmount();
  });

  it('does the same on the screen that asks for location access', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const utils = render(<HikeMonitorScreen />);
    await settle();
    expect(utils.getByTestId('hike-no-location')).toBeTruthy();
    expect(spaceAboveTitle(utils, 'Hike')).toBe(INSET_TOP + 8);
    utils.unmount();
  });

  it('measures what it claims: a header inside a second top safe area is caught', async () => {
    // The old layout, built by hand: SafeAreaView (top) around the real header.
    const { SafeAreaView } = require('react-native-safe-area-context');
    const ScreenHeader = require('@/components/ScreenHeader').default;
    const utils = render(
      <SafeAreaView edges={['top']}>
        <ScreenHeader title="Old layout" showBack />
      </SafeAreaView>,
    );
    expect(spaceAboveTitle(utils, 'Old layout')).toBe(INSET_TOP * 2 + 8);
  });
});

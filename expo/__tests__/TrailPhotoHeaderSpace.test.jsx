import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

// The trail detail screen floats its back button over the trail photo. This test uses the
// real ScreenHeader and a safe area that behaves like the real one (a SafeAreaView pads the
// top by the notch height unless its edges leave 'top' out), so it measures what a phone
// would show: how far down the back button sits.
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
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trailapi-77' }),
}), { virtual: true });
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
  const MapView = (props) => mockReact.createElement(mockRn.View, { testID: 'trail-route-map' }, props.children);
  return { __esModule: true, default: MapView, MapView, Polyline: () => null, Marker: () => null, PROVIDER_DEFAULT: null };
});
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };
});
jest.mock('@/components/ElevationProfileChart', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/TrailWeather', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/MuscleHeatmapCard', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/muscleFatigue', () => ({ getTargetMuscles: () => [], getTargetMuscleIntensities: () => ({}) }));
jest.mock('@/lib/openDirections', () => ({ promptDirections: jest.fn() }));
jest.mock('@/store/hikingStore', () => ({
  useHikingStore: () => ({
    getTrailById: () => ({
      id: 'trailapi-77', source: 'trailapi', name: 'Old Rag Loop', address: 'Syria, VA',
      latitude: 38.55, longitude: -78.3, lengthMiles: 9.2, distanceKm: 12.5,
    }),
    savedTrailIds: [], toggleSaveTrail: jest.fn(), userLocation: null,
  }),
}));
jest.mock('@/store/offlineTrailStore', () => ({
  useOfflineTrailStore: () => ({ trails: {}, keepTrail: jest.fn(), removeTrail: jest.fn() }),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/bodyCompositionStore', () => ({
  useBodyCompositionStore: () => ({ scans: [], loadScans: jest.fn() }),
}));
jest.mock('@/services/hikingService', () => ({
  getPhotoUri: jest.fn(async () => 'https://example.com/trail.jpg'),
  peekPhotoUri: jest.fn(() => 'https://example.com/trail.jpg'),
  getTrailMaps: jest.fn(async () => []),
  fetchRouteForMap: jest.fn(async () => null),
  fetchOsmPaths: jest.fn(async () => ({ maps: [], routes: {} })),
}));
jest.mock('@/services/gpxShare', () => ({ shareGpx: jest.fn(), gpxShareErrorText: () => '' }));

import TrailPreviewScreen from '../app/running/hiking/[id]';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

// The space above the back button: every top padding on the way up from it to the screen's edge.
const spaceAbove = (node) => {
  let total = 0;
  for (let n = node.parent; n; n = n.parent) {
    if (typeof n.type !== 'string') continue; // only real views count; wrappers only pass a style on
    const style = StyleSheet.flatten(n.props.style) || {};
    total += style.paddingTop || 0;
  }
  return total;
};

describe('Trail detail: space above the back button', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it('leaves room for the notch once, not twice, above the back button', async () => {
    const utils = render(<TrailPreviewScreen />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    // The header pads the notch plus a little breathing room (8). A second top safe area
    // around the screen used to add the notch height again: 126 instead of 67.
    expect(spaceAbove(utils.UNSAFE_getByType('ChevronLeft'))).toBe(INSET_TOP + 8);
    utils.unmount();
  });

  it('keeps the save button on the photo beside the back button', async () => {
    const utils = render(<TrailPreviewScreen />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(utils.getByTestId('trail-save-button')).toBeTruthy();
    utils.unmount();
  });

  it('measures what it claims: a screen inside a second top safe area is caught', async () => {
    const { SafeAreaView } = require('react-native-safe-area-context');
    const ScreenHeader = require('@/components/ScreenHeader').default;
    const utils = render(
      <SafeAreaView edges={['top', 'bottom']}>
        <ScreenHeader showBack transparent />
      </SafeAreaView>,
    );
    expect(spaceAbove(utils.UNSAFE_getByType('ChevronLeft'))).toBe(INSET_TOP * 2 + 8);
  });
});

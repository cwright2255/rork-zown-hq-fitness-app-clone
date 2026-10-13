import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

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
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const MapView = (props) => {
    mockReact.useEffect(() => { global.__mapMounts = (global.__mapMounts || 0) + 1; }, []);
    return mockReact.createElement(mockRn.View, { testID: 'trail-route-map' }, props.children);
  };
  const Polyline = () => null;
  const Marker = () => null;
  return { __esModule: true, default: MapView, MapView, Polyline, Marker, PROVIDER_DEFAULT: null };
});
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress }) => mockReact.createElement(
      mockRn.TouchableOpacity,
      { onPress, accessibilityRole: 'button' },
      mockReact.createElement(mockRn.Text, null, title),
    ),
  };
});
jest.mock('@/components/ElevationProfileChart', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/TrailWeather', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/MuscleHeatmapCard', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/muscleFatigue', () => ({
  getTargetMuscles: () => [],
  getTargetMuscleIntensities: () => ({}),
}));
jest.mock('@/lib/openDirections', () => ({ promptDirections: jest.fn() }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => global.__hiking }));
jest.mock('@/store/offlineTrailStore', () => ({ useOfflineTrailStore: () => global.__offline }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/bodyCompositionStore', () => ({
  useBodyCompositionStore: () => ({ scans: [], loadScans: jest.fn() }),
}));
jest.mock('@/services/hikingService', () => ({
  getPhotoUrl: jest.fn(() => null),
  getTrailMaps: jest.fn(),
  fetchRouteForMap: jest.fn(),
  fetchOsmPaths: jest.fn(),
}));
// The share sheet is the phone's; the file it would be given is what is tested here.
jest.mock('@/services/gpxShare', () => ({
  shareGpx: jest.fn((file) => global.__shareGpx(file)),
  gpxShareErrorText: jest.requireActual('@/services/gpxShare').gpxShareErrorText,
}));

import TrailPreviewScreen from '../app/running/hiking/[id]';
import { useSettingsStore } from '../store/settingsStore';
import { routeRegion } from '../lib/runDetail';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const Maps = require('react-native-maps');
const Service = require('@/services/hikingService');

const trail = (extra = {}) => ({
  id: 'trailapi-77', source: 'trailapi', name: 'Old Rag Loop', address: 'Syria, VA',
  latitude: 38.55, longitude: -78.3, lengthMiles: 9.2, distanceKm: 12.5, ...extra,
});

const ROUTE = {
  coordinates: [
    { latitude: 38.55, longitude: -78.3 },
    { latitude: 38.56, longitude: -78.31 },
    { latitude: 38.57, longitude: -78.32 },
  ],
  distanceKm: 4.2, elevationGainM: 120, elevationProfile: [],
};

// A trail as it is kept on the phone for when there is no signal.
const kept = (extra = {}) => ({
  version: 1, id: 'trailapi-77', savedAt: 1, pinned: true, trail: trail(),
  maps: [{ id: 11, name: 'Main loop' }], routes: { 11: ROUTE }, ...extra,
});

const NO_OSM = { maps: [], routes: {} };

const open = async (t = trail(), {
  maps = [{ id: 11, name: 'Main loop' }], route = ROUTE, record = null, saved = false, inSearch = true, osm = NO_OSM,
} = {}) => {
  global.__mapMounts = 0;
  global.__router = { push: jest.fn(), back: jest.fn() };
  global.__params = { id: t ? t.id : 'nope' };
  global.__hiking = {
    getTrailById: (id) => (inSearch && t && id === t.id ? t : null),
    savedTrailIds: saved && t ? [t.id] : [], toggleSaveTrail: jest.fn(), userLocation: null,
  };
  global.__offline = { trails: record ? { [record.id]: record } : {}, keepTrail: jest.fn(), removeTrail: jest.fn() };
  Service.getTrailMaps.mockReset();
  Service.fetchRouteForMap.mockReset();
  Service.fetchOsmPaths.mockReset();
  global.__resolveOsm = null;
  if (osm instanceof Error) Service.fetchOsmPaths.mockRejectedValue(osm);
  else if (osm === 'pending') Service.fetchOsmPaths.mockImplementation(() => new Promise((resolve) => { global.__resolveOsm = resolve; }));
  else Service.fetchOsmPaths.mockResolvedValue(osm);
  global.__shareGpx = jest.fn(async (file) => ({ ok: true, uri: `file:///cache/${file.filename}` }));
  if (maps instanceof Error) Service.getTrailMaps.mockRejectedValue(maps);
  else Service.getTrailMaps.mockResolvedValue(maps);
  Service.fetchRouteForMap.mockResolvedValue(route);
  const utils = render(<TrailPreviewScreen />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return utils;
};

// The old yellow box printed these while looking for the trail's paths.
const DEBUG_TEXT = /Fetching maps|maps back|Skipped|trail is null|getTrailMaps threw|getTrailById found nothing|TrailAPI id/i;
const allText = (utils) => JSON.stringify(utils.toJSON());

describe('TrailPreviewScreen', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  it('shows the trail and no yellow debug box while it finds the trail paths', async () => {
    const utils = await open();
    expect(utils.getByText('Old Rag Loop')).toBeTruthy();
    expect(utils.getByText('Syria, VA')).toBeTruthy();
    expect(allText(utils)).not.toMatch(DEBUG_TEXT);
    expect(allText(utils)).not.toMatch(/FEF3C7|78350F/i);
    expect(Service.getTrailMaps).toHaveBeenCalledWith('77');
  });

  it('shows no debug box for a trail that has no path data', async () => {
    const utils = await open(trail({ id: 'osm-5', source: 'osm' }));
    expect(utils.getByText('Old Rag Loop')).toBeTruthy();
    expect(allText(utils)).not.toMatch(DEBUG_TEXT);
    expect(Service.getTrailMaps).not.toHaveBeenCalled();
  });

  it('shows no debug box when the paths cannot be fetched, and the page still works', async () => {
    const utils = await open(trail(), { maps: new Error('network down') });
    expect(utils.getByText('Old Rag Loop')).toBeTruthy();
    expect(utils.getByText('Start Hike')).toBeTruthy();
    expect(allText(utils)).not.toMatch(DEBUG_TEXT);
    expect(allText(utils)).not.toMatch(/network down/);
    expect(warn).toHaveBeenCalledWith('[TrailDetail] getTrailMaps failed:', 'network down');
  });

  it('says so, with no debug box, when the trail is not in the list', async () => {
    const utils = await open(null);
    expect(utils.getByText(/Trail not found/)).toBeTruthy();
    expect(allText(utils)).not.toMatch(DEBUG_TEXT);
  });

  it('still draws the real trail route and its numbers', async () => {
    const utils = await open();
    expect(Service.fetchRouteForMap).toHaveBeenCalledWith(11);
    await waitFor(() => expect(utils.getByText('Trail Route')).toBeTruthy());
    expect(utils.getByTestId('trail-route-map')).toBeTruthy();
    expect(utils.UNSAFE_queryAllByType(Maps.Polyline)).toHaveLength(1);
    expect(utils.getByText('4.2 km route')).toBeTruthy();
    expect(utils.getByText('120 m elevation gain')).toBeTruthy();
  });

  it('gives the trail length, how far it is and the route in kilometres when Settings are in km', async () => {
    const utils = await open();
    await waitFor(() => expect(utils.getByText('Trail Route')).toBeTruthy());
    expect(utils.getByText('14.8 km trail')).toBeTruthy(); // the trail service gives 9.2 miles
    expect(utils.getByText('12.5 km from you')).toBeTruthy();
    expect(utils.getByText('4.2 km route')).toBeTruthy();
  });

  it('gives them in miles when Settings say so, and the trail keeps the length it was listed with', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await open();
    await waitFor(() => expect(utils.getByText('Trail Route')).toBeTruthy());
    expect(utils.getByText('9.2 mi trail')).toBeTruthy();
    expect(utils.getByText('7.8 mi from you')).toBeTruthy(); // 12.5 km
    expect(utils.getByText('2.6 mi route')).toBeTruthy(); // 4.2 km
    expect(utils.queryByText(/ km /)).toBeNull();
  });

  it('offers a choice when the trail has more than one path, and starts the hike on the chosen one', async () => {
    const utils = await open(trail(), { maps: [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }] });
    expect(utils.getByText('Choose a Path')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    expect(Service.fetchRouteForMap).toHaveBeenLastCalledWith(12);
    fireEvent.press(utils.getByText('Start Hike'));
    expect(global.__router.push).toHaveBeenCalledWith({
      pathname: '/running/hiking/monitor',
      params: { id: 'trailapi-77', pathName: 'Short cut', mapId: '12' },
    });
  });

  it('starts the hike with just the trail when there is no path data', async () => {
    const utils = await open(trail({ id: 'osm-5', source: 'osm' }));
    fireEvent.press(utils.getByText('Start Hike'));
    expect(global.__router.push).toHaveBeenCalledWith({
      pathname: '/running/hiking/monitor',
      params: { id: 'osm-5' },
    });
  });
});

const settle = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); };
const keepCalls = () => global.__offline.keepTrail.mock.calls.map((c) => c[0]);

describe('keeping a trail for when there is no signal', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  const PATHS = [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }];
  const ROUTE_12 = { ...ROUTE, distanceKm: 6.6 };

  it('keeps the trail, and downloads its other paths, when it is saved', async () => {
    const utils = await open(trail(), { maps: PATHS });
    Service.fetchRouteForMap.mockClear();
    Service.fetchRouteForMap.mockResolvedValue(ROUTE_12);
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await settle();
    expect(global.__hiking.toggleSaveTrail).toHaveBeenCalledWith('trailapi-77', 'u1');
    // at once: the trail and the path on screen
    expect(keepCalls()[0]).toMatchObject({ pinned: true, maps: PATHS, routes: { 11: ROUTE } });
    expect(keepCalls()[0].trail.id).toBe('trailapi-77');
    // then only the path that is not on screen
    expect(Service.fetchRouteForMap.mock.calls).toEqual([[12]]);
    expect(keepCalls()[keepCalls().length - 1]).toMatchObject({ pinned: true, routes: { 12: ROUTE_12 } });
  });

  it('asks for the list of paths itself when the page did not get it', async () => {
    const utils = await open(trail(), { maps: new Error('no signal') });
    Service.getTrailMaps.mockReset();
    Service.getTrailMaps.mockResolvedValue(PATHS);
    Service.fetchRouteForMap.mockClear();
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await settle();
    expect(Service.getTrailMaps).toHaveBeenCalledWith('77');
    expect(Service.fetchRouteForMap.mock.calls).toEqual([[11], [12]]);
    expect(keepCalls()[keepCalls().length - 1]).toMatchObject({ maps: PATHS, pinned: true });
  });

  it('forgets the copy when the trail is un-saved, and downloads nothing', async () => {
    const utils = await open(trail(), { maps: PATHS, record: kept(), saved: true });
    Service.fetchRouteForMap.mockClear();
    global.__offline.keepTrail.mockClear();
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await settle();
    expect(global.__hiking.toggleSaveTrail).toHaveBeenCalledWith('trailapi-77', 'u1');
    expect(global.__offline.removeTrail).toHaveBeenCalledWith('trailapi-77');
    expect(Service.fetchRouteForMap).not.toHaveBeenCalled();
    expect(global.__offline.keepTrail).not.toHaveBeenCalled();
  });

  it('keeps nothing from a download that was still running when the trail was un-saved', async () => {
    const utils = await open(trail(), { maps: PATHS });
    let release;
    Service.fetchRouteForMap.mockReset();
    Service.fetchRouteForMap.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await settle();
    // the bookmark is un-pressed before the path arrives
    global.__hiking.savedTrailIds = ['trailapi-77'];
    utils.rerender(<TrailPreviewScreen />);
    global.__offline.keepTrail.mockClear();
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await act(async () => { release(ROUTE_12); });
    await settle();
    expect(global.__offline.removeTrail).toHaveBeenCalledWith('trailapi-77');
    expect(global.__offline.keepTrail).not.toHaveBeenCalled();
  });

  it('keeps what it finds for a trail that is already saved', async () => {
    await open(trail(), { maps: PATHS, saved: true });
    await settle();
    const last = keepCalls()[keepCalls().length - 1];
    expect(last).toMatchObject({ pinned: true, maps: PATHS, routes: { 11: ROUTE } });
    expect(last.trail.id).toBe('trailapi-77');
  });

  it('keeps nothing for a trail that is neither saved nor started', async () => {
    await open(trail(), { maps: PATHS });
    await settle();
    expect(global.__offline.keepTrail).not.toHaveBeenCalled();
  });

  it('keeps the trail and the chosen path when the hike starts, before the hike screen opens', async () => {
    const utils = await open(trail(), { maps: PATHS });
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    await settle();
    fireEvent.press(utils.getByText('Start Hike'));
    expect(global.__offline.keepTrail).toHaveBeenCalledTimes(1);
    expect(keepCalls()[0]).toMatchObject({ pinned: false, maps: PATHS, routes: { 12: ROUTE } });
    expect(global.__offline.keepTrail.mock.invocationCallOrder[0]).toBeLessThan(global.__router.push.mock.invocationCallOrder[0]);
  });

  it('keeps a trail that is started, as one the person saved when it is', async () => {
    const utils = await open(trail(), { maps: PATHS, saved: true });
    global.__offline.keepTrail.mockClear();
    fireEvent.press(utils.getByText('Start Hike'));
    expect(keepCalls()[0]).toMatchObject({ pinned: true });
  });

  it('still starts the hike when the trail has no path to keep', async () => {
    const utils = await open(trail({ id: 'osm-5', source: 'osm' }));
    fireEvent.press(utils.getByText('Start Hike'));
    expect(keepCalls()[0]).toMatchObject({ pinned: false, maps: [] });
    expect(keepCalls()[0].routes).toBeUndefined();
    expect(global.__router.push).toHaveBeenCalledTimes(1);
  });
});

describe('with no signal', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); jest.useRealTimers(); });

  const PATHS = [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }];
  const ROUTE_12 = { ...ROUTE, distanceKm: 7.1, elevationGainM: 200 };

  it('opens a trail from the copy on the phone, though the last search no longer has it', async () => {
    const utils = await open(trail(), { record: kept(), inSearch: false, maps: new Error('no signal'), route: null });
    expect(utils.queryByText(/Trail not found/)).toBeNull();
    expect(utils.getByText('Old Rag Loop')).toBeTruthy();
    expect(utils.getByText('Start Hike')).toBeTruthy();
    expect(utils.getByTestId('trail-route-sketch')).toBeTruthy();
    expect(utils.queryByTestId('trail-route-map')).toBeNull();
    expect(utils.getByText('Saved on this phone, so it works without a signal.')).toBeTruthy();
    expect(utils.getByText('4.2 km route')).toBeTruthy();
    expect(utils.getByText('120 m elevation gain')).toBeTruthy();
  });

  it('starts a hike from the copy on the phone', async () => {
    const utils = await open(trail(), { record: kept(), inSearch: false, maps: new Error('no signal'), route: null });
    fireEvent.press(utils.getByText('Start Hike'));
    expect(global.__router.push).toHaveBeenCalledWith({
      pathname: '/running/hiking/monitor',
      params: { id: 'trailapi-77', pathName: 'Main loop', mapId: '11' },
    });
  });

  it('draws the path kept on the phone when the trail service does not answer, and the fresh one if it still does', async () => {
    jest.useFakeTimers();
    const utils = await open(trail(), { record: kept() });
    let answer;
    Service.fetchRouteForMap.mockReset();
    // a path that never answers
    Service.fetchRouteForMap.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    utils.unmount();
    const again = render(<TrailPreviewScreen />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    act(() => { jest.advanceTimersByTime(3999); });
    expect(again.queryByText('Trail Route')).toBeNull();
    act(() => { jest.advanceTimersByTime(1); });
    expect(again.getByTestId('trail-route-sketch')).toBeTruthy();
    expect(again.getByText('4.2 km route')).toBeTruthy();
    await act(async () => { answer({ ...ROUTE, distanceKm: 5.5 }); });
    expect(again.getByTestId('trail-route-map')).toBeTruthy();
    expect(again.queryByTestId('trail-route-sketch')).toBeNull();
    expect(again.getByText('5.5 km route')).toBeTruthy();
    expect(again.queryByText(/Saved on this phone/)).toBeNull();
  });

  it('uses the fresh path, on the real map, when there is a signal', async () => {
    const utils = await open(trail(), { record: kept(), route: { ...ROUTE, distanceKm: 5.5 } });
    expect(utils.getByTestId('trail-route-map')).toBeTruthy();
    expect(utils.queryByTestId('trail-route-sketch')).toBeNull();
    expect(utils.getByText('5.5 km route')).toBeTruthy();
    expect(utils.queryByText(/Saved on this phone/)).toBeNull();
  });

  it('offers the paths kept on the phone, and draws the one that is chosen, not another', async () => {
    const record = kept({ maps: PATHS, routes: { 11: ROUTE, 12: ROUTE_12 } });
    const utils = await open(trail(), { record, inSearch: false, maps: new Error('no signal'), route: null });
    expect(utils.getByText('Choose a Path')).toBeTruthy();
    expect(utils.getByText('4.2 km route')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    expect(utils.getByText('7.1 km route')).toBeTruthy();
    expect(utils.queryByText('4.2 km route')).toBeNull();
  });

  it('shows no line for a path that is not kept, rather than another path\'s line', async () => {
    const record = kept({ maps: PATHS, routes: { 11: ROUTE } });
    const utils = await open(trail(), { record, inSearch: false, maps: new Error('no signal'), route: null });
    expect(utils.getByText('4.2 km route')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    expect(utils.queryByText('Trail Route')).toBeNull();
    expect(utils.queryByTestId('trail-route-sketch')).toBeNull();
  });

  it('prefers the list of paths from the trail service to the one kept', async () => {
    const record = kept({ maps: [{ id: 11, name: 'Old name' }] });
    const utils = await open(trail(), { record, maps: PATHS });
    expect(utils.getByText('Choose a Path')).toBeTruthy();
    expect(utils.getByText('Short cut')).toBeTruthy();
  });
});

describe('choosing another path', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  const PATHS = [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }];

  it('does not keep showing the first path while the one just chosen is still loading', async () => {
    const utils = await open(trail(), { maps: PATHS });
    expect(utils.getByText('4.2 km route')).toBeTruthy();
    Service.fetchRouteForMap.mockImplementation(() => new Promise(() => {}));
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    expect(utils.queryByText('Trail Route')).toBeNull();
    expect(utils.queryByText('4.2 km route')).toBeNull();
  });

  it('shows the chosen path when it arrives', async () => {
    const utils = await open(trail(), { maps: PATHS });
    Service.fetchRouteForMap.mockResolvedValue({ ...ROUTE, distanceKm: 6.6 });
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    expect(utils.getByText('6.6 km route')).toBeTruthy();
  });
});

describe('exporting the route', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  const PATHS = [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }];
  const press = async (utils) => { await act(async () => { fireEvent.press(utils.getByTestId('trail-export-gpx')); }); };

  it('offers to export the route once it is drawn', async () => {
    const utils = await open();
    await settle();
    expect(utils.getByText('Export route as GPX')).toBeTruthy();
    expect(utils.queryByTestId('trail-export-error')).toBeNull();
  });

  it('hands the share sheet a GPX file of the route, named for the trail and the path', async () => {
    const utils = await open();
    await settle();
    await press(utils);
    expect(global.__shareGpx).toHaveBeenCalledTimes(1);
    const file = global.__shareGpx.mock.calls[0][0];
    expect(file.filename).toBe('Old-Rag-Loop-Main-loop.gpx');
    expect(file.title).toBe('Old Rag Loop - Main loop');
    expect(file.xml).toContain('<name>Old Rag Loop - Main loop</name>');
    expect(file.xml).toContain('<desc>Trail route, 4.2 km. From Zown HQ.</desc>');
    expect(file.xml.match(/<trkpt /g)).toHaveLength(3);
    expect(file.xml).toContain('<trkpt lat="38.55" lon="-78.3"></trkpt>');
    expect(file.xml).toContain('<trkpt lat="38.57" lon="-78.32"></trkpt>');
  });

  it('exports the path that was chosen, not the first one', async () => {
    const utils = await open(trail(), { maps: PATHS });
    Service.fetchRouteForMap.mockResolvedValue({
      coordinates: [{ latitude: 38.6, longitude: -78.4 }, { latitude: 38.61, longitude: -78.41 }],
      distanceKm: 6.6,
      elevationGainM: null,
      elevationProfile: null,
    });
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    await settle();
    await press(utils);
    const file = global.__shareGpx.mock.calls[0][0];
    expect(file.title).toBe('Old Rag Loop - Short cut');
    expect(file.filename).toBe('Old-Rag-Loop-Short-cut.gpx');
    expect(file.xml.match(/<trkpt /g)).toHaveLength(2);
    expect(file.xml).toContain('<trkpt lat="38.6" lon="-78.4"></trkpt>');
  });

  it('exports from the copy kept on the phone when there is no signal', async () => {
    const record = kept();
    const utils = await open(trail(), { record, maps: new Error('offline'), route: null });
    await settle();
    await press(utils);
    expect(global.__shareGpx).toHaveBeenCalledTimes(1);
    expect(global.__shareGpx.mock.calls[0][0].xml.match(/<trkpt /g)).toHaveLength(3);
  });

  it('is not offered for a trail with no route', async () => {
    const utils = await open(trail({ id: 'osm-5', source: 'osm' }));
    await settle();
    expect(utils.queryByTestId('trail-export-gpx')).toBeNull();
  });

  it('is not offered while the chosen path is still loading', async () => {
    const utils = await open(trail(), { maps: PATHS });
    Service.fetchRouteForMap.mockImplementation(() => new Promise(() => {}));
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    expect(utils.queryByTestId('trail-export-gpx')).toBeNull();
  });

  it('says it is preparing the file, and ignores a second tap meanwhile', async () => {
    const utils = await open();
    await settle();
    let finish;
    global.__shareGpx.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await press(utils);
    expect(utils.getByText('Preparing...')).toBeTruthy();
    expect(utils.queryByText('Export route as GPX')).toBeNull();
    await press(utils);
    expect(global.__shareGpx).toHaveBeenCalledTimes(1);
    // Even a tap that reaches the handler anyway does nothing while it is busy.
    const button = utils.UNSAFE_getAllByProps({ testID: 'trail-export-gpx' }).find((n) => typeof n.props.onPress === 'function');
    await act(async () => { await button.props.onPress(); });
    expect(global.__shareGpx).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: true, uri: 'file:///x.gpx' }); });
    expect(utils.getByText('Export route as GPX')).toBeTruthy();
  });

  it('says what went wrong, and clears it on the next try', async () => {
    const utils = await open();
    await settle();
    global.__shareGpx.mockResolvedValueOnce({ ok: false, reason: 'unavailable' });
    await press(utils);
    expect(utils.getByTestId('trail-export-error').props.children).toBe('Sharing files is not available on this phone.');
    expect(utils.getByText('Export route as GPX')).toBeTruthy();
    await press(utils);
    expect(utils.queryByTestId('trail-export-error')).toBeNull();
  });

  it('does not start a hike, keep the trail, or change anything else', async () => {
    const utils = await open();
    await settle();
    await press(utils);
    expect(global.__router.push).not.toHaveBeenCalled();
    expect(global.__offline.keepTrail).not.toHaveBeenCalled();
    expect(global.__hiking.toggleSaveTrail).not.toHaveBeenCalled();
  });
});

// --- Paths from OpenStreetMap -------------------------------------------------------------------

const pathLine = (lat, lon, km) => ({
  coordinates: [{ latitude: lat, longitude: lon }, { latitude: lat + 0.005, longitude: lon + 0.002 }, { latitude: lat + 0.01, longitude: lon + 0.004 }],
  distanceKm: km, elevationGainM: null, elevationProfile: null,
});
const BLUE = 'osm-way-701';
const RED = 'osm-way-702';
const GREEN = 'osm-way-703';
const OSM = {
  maps: [
    { id: BLUE, name: 'Blue Trail', distanceKm: 1.1 },
    { id: RED, name: 'Red Trail', distanceKm: 2.3 },
    { id: GREEN, name: 'Green Trail', distanceKm: 0.7 },
  ],
  routes: { [BLUE]: pathLine(38.55, -78.3, 1.1), [RED]: pathLine(38.6, -78.35, 2.3), [GREEN]: pathLine(38.52, -78.28, 0.7) },
};
// A trail from the Places search: no path data from the trail service at all.
const placesTrail = (extra = {}) => trail({ id: 'ChIJabc123', source: 'places', lengthMiles: null, ...extra });
const polylines = (utils) => utils.UNSAFE_queryAllByType(Maps.Polyline);

describe('paths from OpenStreetMap', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); jest.useRealTimers(); });

  it('asks for the paths around the trail point, and not the trail service, for a trail it has nothing on', async () => {
    await open(placesTrail(), { osm: OSM });
    expect(Service.fetchOsmPaths).toHaveBeenCalledTimes(1);
    expect(Service.fetchOsmPaths).toHaveBeenCalledWith({ latitude: 38.55, longitude: -78.3 });
    expect(Service.getTrailMaps).not.toHaveBeenCalled();
  });

  it('offers the paths, with the first one on', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    expect(utils.getByText('Choose a Path')).toBeTruthy();
    ['Blue Trail', 'Red Trail', 'Green Trail'].forEach((name) => expect(utils.getByText(name)).toBeTruthy());
    expect(utils.getByText('Trail Route')).toBeTruthy();
    expect(utils.getByText('1.1 km route')).toBeTruthy();
    expect(utils.getByTestId('trail-path-' + BLUE).props.accessibilityState).toEqual({ selected: true });
    expect(utils.getByTestId('trail-path-' + RED).props.accessibilityState).toEqual({ selected: false });
  });

  it('does not ask the trail service for the line of a path that came with its line', async () => {
    await open(placesTrail(), { osm: OSM });
    expect(Service.fetchRouteForMap).not.toHaveBeenCalled();
  });

  it('shows how long each path is on its button, in the unit of Settings', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    expect(utils.getByText('1.1 km')).toBeTruthy();
    expect(utils.getByText('2.3 km')).toBeTruthy();
    expect(utils.getByText('0.7 km')).toBeTruthy();
  });

  it('shows them in miles when Settings say so', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await open(placesTrail(), { osm: OSM });
    expect(utils.getByText('0.7 mi')).toBeTruthy(); // 1.1 km
    expect(utils.getByText('1.4 mi')).toBeTruthy(); // 2.3 km
    expect(utils.getByText('0.7 mi route')).toBeTruthy();
    expect(utils.queryByText(/ km/)).toBeNull();
  });

  it('draws every path on the map, grey, with the chosen one on top in green', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    const lines = polylines(utils);
    expect(lines).toHaveLength(3);
    const chosen = lines[lines.length - 1].props;
    expect(chosen.strokeColor).toBe(require('@/constants/theme').colors.green);
    expect(chosen.coordinates).toEqual(OSM.routes[BLUE].coordinates);
    expect(chosen.strokeWidth).toBe(5);
    const others = lines.slice(0, 2).map((l) => l.props);
    others.forEach((o) => {
      expect(o.strokeWidth).toBe(3);
      expect(o.strokeColor).not.toBe(chosen.strokeColor);
      expect(o.tappable).toBe(true);
    });
    expect(others.map((o) => o.coordinates)).toEqual([OSM.routes[RED].coordinates, OSM.routes[GREEN].coordinates]);
  });

  it('chooses a path when its line on the map is tapped', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    const grey = polylines(utils).find((l) => l.props.coordinates === OSM.routes[RED].coordinates);
    await act(async () => { grey.props.onPress(); });
    expect(utils.getByText('2.3 km route')).toBeTruthy();
    expect(utils.getByTestId('trail-path-' + RED).props.accessibilityState).toEqual({ selected: true });
    const lines = polylines(utils);
    expect(lines[lines.length - 1].props.coordinates).toEqual(OSM.routes[RED].coordinates);
    expect(lines).toHaveLength(3);
  });

  it('chooses a path from its button, with a new map framed on that path', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    expect(global.__mapMounts).toBe(1);
    const first = utils.UNSAFE_getByType(Maps.MapView).props;
    expect(first.initialRegion).toEqual(routeRegion(OSM.routes[BLUE].coordinates, { padding: 1.5 }));
    await act(async () => { fireEvent.press(utils.getByText('Red Trail')); });
    expect(global.__mapMounts).toBe(2);
    const second = utils.UNSAFE_getByType(Maps.MapView).props;
    expect(second.initialRegion).toEqual(routeRegion(OSM.routes[RED].coordinates, { padding: 1.5 }));
    expect(second.initialRegion.latitude).not.toBe(first.initialRegion.latitude);
  });

  it('frames the whole path, flat, and keeps the map still', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    const props = utils.UNSAFE_getByType(Maps.MapView).props;
    const region = props.initialRegion;
    const line = OSM.routes[BLUE].coordinates;
    line.forEach((p) => {
      expect(Math.abs(p.latitude - region.latitude)).toBeLessThanOrEqual(region.latitudeDelta / 2);
      expect(Math.abs(p.longitude - region.longitude)).toBeLessThanOrEqual(region.longitudeDelta / 2);
    });
    expect(props.initialCamera).toBeUndefined();
    expect(props.scrollEnabled).toBe(false);
    expect(props.zoomEnabled).toBe(false);
    expect(props.pitchEnabled).toBe(false);
  });

  it('starts the hike on a path from OpenStreetMap, and keeps just its line for the hike screen', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    await act(async () => { fireEvent.press(utils.getByText('Red Trail')); });
    fireEvent.press(utils.getByText('Start Hike'));
    expect(global.__router.push).toHaveBeenCalledWith({
      pathname: '/running/hiking/monitor',
      params: { id: 'ChIJabc123', pathName: 'Red Trail', mapId: RED },
    });
    expect(keepCalls()).toHaveLength(1);
    expect(Object.keys(keepCalls()[0].routes)).toEqual([RED]);
    expect(keepCalls()[0].routes[RED]).toBe(OSM.routes[RED]);
    expect(keepCalls()[0].maps).toEqual(OSM.maps);
    expect(global.__offline.keepTrail.mock.invocationCallOrder[0]).toBeLessThan(global.__router.push.mock.invocationCallOrder[0]);
  });

  it('keeps the other paths too when the trail is saved, the chosen one last, and downloads nothing', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    await act(async () => { fireEvent.press(utils.getByText('Red Trail')); });
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await settle();
    expect(keepCalls()[0]).toMatchObject({ pinned: true, maps: OSM.maps });
    expect(Object.keys(keepCalls()[0].routes)).toEqual([BLUE, GREEN, RED]);
    expect(Service.fetchRouteForMap).not.toHaveBeenCalled();
    expect(Service.getTrailMaps).not.toHaveBeenCalled();
  });

  it('keeps no more than four lines for a trail, and always the chosen one', async () => {
    const many = { maps: [], routes: {} };
    for (let i = 1; i <= 7; i += 1) {
      const id = `osm-way-${800 + i}`;
      many.maps.push({ id, name: `Trail ${i}`, distanceKm: i });
      many.routes[id] = pathLine(38.5 + i * 0.01, -78.3, i);
    }
    const utils = await open(placesTrail(), { osm: many });
    await act(async () => { fireEvent.press(utils.getByText('Trail 7')); });
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await settle();
    const keys = Object.keys(keepCalls()[0].routes);
    expect(keys).toHaveLength(4);
    expect(keys[keys.length - 1]).toBe('osm-way-807');
    // the paths that have their line kept come first, so the phone does not keep names with no line
    expect(keepCalls()[0].maps.slice(0, 4).map((m) => m.id).sort()).toEqual(keys.slice().sort());
  });

  it('starts a hike from a path far down the list, with its line kept', async () => {
    const many = { maps: [], routes: {} };
    for (let i = 1; i <= 7; i += 1) {
      const id = `osm-way-${800 + i}`;
      many.maps.push({ id, name: `Trail ${i}`, distanceKm: i });
      many.routes[id] = pathLine(38.5 + i * 0.01, -78.3, i);
    }
    const utils = await open(placesTrail(), { osm: many });
    await act(async () => { fireEvent.press(utils.getByText('Trail 6')); });
    fireEvent.press(utils.getByText('Start Hike'));
    expect(Object.keys(keepCalls()[0].routes)).toEqual(['osm-way-806']);
    expect(keepCalls()[0].maps.slice(0, 4).map((m) => m.id)).toContain('osm-way-806');
    expect(global.__router.push.mock.calls[0][0].params.mapId).toBe('osm-way-806');
  });

  it('puts the paths of the trail service first, then the ones from OpenStreetMap', async () => {
    const utils = await open(trail(), { maps: [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }], osm: OSM });
    const order = ['Main loop', 'Short cut', 'Blue Trail', 'Red Trail', 'Green Trail'];
    const text = JSON.stringify(utils.toJSON());
    const at = order.map((n) => text.indexOf(`"${n}"`));
    expect(at.every((i) => i > -1)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // the first path of the trail service is the one on
    expect(Service.fetchRouteForMap).toHaveBeenCalledWith(11);
    expect(utils.getByTestId('trail-path-11').props.accessibilityState).toEqual({ selected: true });
  });

  it('does not ask the trail service for a line when a path from OpenStreetMap is chosen after one of its own', async () => {
    const utils = await open(trail(), { maps: [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }], osm: OSM });
    Service.fetchRouteForMap.mockClear();
    await act(async () => { fireEvent.press(utils.getByText('Blue Trail')); });
    await settle();
    expect(Service.fetchRouteForMap).not.toHaveBeenCalled();
    expect(utils.getByText('1.1 km route')).toBeTruthy();
  });

  it('draws a line of the trail service in grey too, once it has been seen', async () => {
    const utils = await open(trail(), { maps: [{ id: 11, name: 'Main loop' }], osm: OSM });
    // the trail service line (11) is on; the three from OpenStreetMap are under it in grey
    const lines = polylines(utils);
    expect(lines).toHaveLength(4);
    await act(async () => { fireEvent.press(utils.getByText('Red Trail')); });
    const after = polylines(utils);
    expect(after).toHaveLength(4);
    expect(after.some((l) => l.props.coordinates === ROUTE.coordinates && l.props.tappable === true)).toBe(true);
  });

  it('thanks OpenStreetMap when its data is shown, and not otherwise', async () => {
    const withOsm = await open(placesTrail(), { osm: OSM });
    expect(withOsm.getByTestId('trail-osm-credit')).toBeTruthy();
    expect(withOsm.getByText('Path data © OpenStreetMap contributors')).toBeTruthy();
    withOsm.unmount();
    const without = await open(trail(), { maps: [{ id: 11, name: 'Main loop' }] });
    expect(without.queryByTestId('trail-osm-credit')).toBeNull();
  });

  it('shows no height chart for a path from OpenStreetMap, which has no heights', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    expect(utils.queryByText(/elevation gain/)).toBeNull();
  });

  it('exports the line of a path from OpenStreetMap as GPX, named for it', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    await act(async () => { fireEvent.press(utils.getByText('Red Trail')); });
    await act(async () => { fireEvent.press(utils.getByTestId('trail-export-gpx')); });
    const file = global.__shareGpx.mock.calls[0][0];
    expect(file.title).toBe('Old Rag Loop - Red Trail');
    expect(file.xml.match(/<trkpt /g)).toHaveLength(3);
    expect(file.xml).toContain('<trkpt lat="38.6" lon="-78.35"></trkpt>');
  });

  it('puts the paths above the directions text, not far down the page', async () => {
    const utils = await open(placesTrail({ directions: 'Take exit 5 and follow the signs' }), { osm: OSM });
    const text = JSON.stringify(utils.toJSON());
    expect(text.indexOf('trail-path-picker')).toBeGreaterThan(-1);
    expect(text.indexOf('trail-path-picker')).toBeLessThan(text.indexOf('Take exit 5'));
    expect(text.indexOf('Trail Route')).toBeLessThan(text.indexOf('Take exit 5'));
    // and straight after the facts about the trail
    expect(text.indexOf('14.8 km trail') === -1 ? 0 : text.indexOf('14.8 km trail')).toBeLessThan(text.indexOf('trail-path-picker'));
  });
});

describe('when no paths show', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); jest.useRealTimers(); });

  it('says it is looking while OpenStreetMap has not answered', async () => {
    const utils = await open(placesTrail(), { osm: 'pending' });
    expect(utils.getByTestId('trail-paths-note')).toBeTruthy();
    expect(utils.getByText('Looking for trail paths…')).toBeTruthy();
    expect(utils.queryByText(/No marked paths/)).toBeNull();
    expect(utils.queryByTestId('trail-paths-retry')).toBeNull();
    await act(async () => { global.__resolveOsm(OSM); });
    expect(utils.queryByText('Looking for trail paths…')).toBeNull();
    expect(utils.getByText('Choose a Path')).toBeTruthy();
  });

  it('says there are no marked paths when OpenStreetMap has none, with no retry button', async () => {
    const utils = await open(placesTrail());
    expect(utils.getByText('Trail Paths')).toBeTruthy();
    expect(utils.getByText('No marked paths found near this trailhead.')).toBeTruthy();
    expect(utils.queryByTestId('trail-paths-retry')).toBeNull();
    expect(utils.queryByText('Choose a Path')).toBeNull();
    expect(utils.queryByText('Trail Route')).toBeNull();
    expect(utils.getByText('Start Hike')).toBeTruthy(); // the page still works
  });

  it('says so when the paths could not be loaded, and tries again when asked', async () => {
    const utils = await open(placesTrail(), { osm: new Error('Network request failed') });
    expect(utils.getByText("Couldn't load the trail paths. Check your signal and try again.")).toBeTruthy();
    expect(allText(utils)).not.toMatch(/Network request failed/);
    expect(warn).toHaveBeenCalledWith('[TrailDetail] fetchOsmPaths failed:', 'Network request failed');
    Service.fetchOsmPaths.mockReset();
    Service.fetchOsmPaths.mockResolvedValue(OSM);
    await act(async () => { fireEvent.press(utils.getByTestId('trail-paths-retry')); });
    await settle();
    expect(Service.fetchOsmPaths).toHaveBeenCalledTimes(1);
    expect(utils.queryByText(/Couldn't load/)).toBeNull();
    expect(utils.getByText('Choose a Path')).toBeTruthy();
    expect(utils.getByText('1.1 km route')).toBeTruthy();
  });

  it('shows "looking" again while a retry is running', async () => {
    const utils = await open(placesTrail(), { osm: new Error('Network request failed') });
    Service.fetchOsmPaths.mockReset();
    Service.fetchOsmPaths.mockImplementation(() => new Promise(() => {}));
    await act(async () => { fireEvent.press(utils.getByTestId('trail-paths-retry')); });
    expect(utils.getByText('Looking for trail paths…')).toBeTruthy();
    expect(utils.queryByText(/Couldn't load/)).toBeNull();
  });

  it('asks for the paths with the trail point as numbers when the trail service sent it as text', async () => {
    await open(placesTrail({ latitude: '38.55', longitude: ' -78.3 ' }), { osm: OSM });
    expect(Service.fetchOsmPaths).toHaveBeenCalledWith({ latitude: 38.55, longitude: -78.3 });
  });

  it.each([
    ['null', null, null],
    ['empty text', '', ''],
    ['blank text', '  ', '  '],
    ['words', 'north', 'west'],
    ['one missing', 38.55, undefined],
  ])('asks nothing of OpenStreetMap when the point is %s', async (_name, latitude, longitude) => {
    const utils = await open(placesTrail({ latitude, longitude }));
    expect(Service.fetchOsmPaths).not.toHaveBeenCalled();
    expect(utils.getByText('No marked paths found near this trailhead.')).toBeTruthy();
  });

  it('asks nothing of OpenStreetMap for a trail with no point on the map', async () => {
    const utils = await open(placesTrail({ latitude: undefined, longitude: undefined }));
    expect(Service.fetchOsmPaths).not.toHaveBeenCalled();
    expect(utils.getByText('No marked paths found near this trailhead.')).toBeTruthy();
  });

  it('shows a trail service path whose line will not load as a note, not a blank', async () => {
    const utils = await open(trail(), { maps: [{ id: 11, name: 'Main loop' }], route: null });
    expect(utils.getByText("This path's line isn't available right now.")).toBeTruthy();
    expect(utils.queryByText('Trail Route')).toBeNull();
  });

  it('says it is loading the path while the line of the chosen path is on its way', async () => {
    const utils = await open(trail(), { maps: [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }] });
    Service.fetchRouteForMap.mockImplementation(() => new Promise(() => {}));
    await act(async () => { fireEvent.press(utils.getByText('Short cut')); });
    expect(utils.getByText('Loading the path…')).toBeTruthy();
    expect(utils.getByText('Choose a Path')).toBeTruthy();
  });

  it('shows no note once there is a line', async () => {
    const utils = await open(placesTrail(), { osm: OSM });
    expect(utils.queryByTestId('trail-paths-note')).toBeNull();
    expect(utils.queryByTestId('trail-paths-status')).toBeNull();
  });

  it('does not change the page after it has been left', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = await open(placesTrail(), { osm: 'pending' });
    utils.unmount();
    await act(async () => { global.__resolveOsm(OSM); });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('paths from OpenStreetMap, kept and swapped', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  it('keeps the paths it finds for a trail that is already saved, the chosen one last', async () => {
    await open(placesTrail(), { saved: true, osm: 'pending' });
    expect(keepCalls().every((c) => c.routes === undefined)).toBe(true); // nothing found yet
    await act(async () => { global.__resolveOsm(OSM); });
    await settle();
    const last = keepCalls()[keepCalls().length - 1];
    expect(last).toMatchObject({ pinned: true, maps: OSM.maps });
    expect(Object.keys(last.routes)).toEqual([RED, GREEN, BLUE]);
    expect(last.trail.id).toBe('ChIJabc123');
  });

  it('ignores the answer for a trail that was left before it arrived', async () => {
    const A = placesTrail();
    const B = placesTrail({ id: 'ChIJother99', name: 'Other Trail' });
    const utils = await open(A, { osm: 'pending' });
    const resolveA = global.__resolveOsm;
    global.__params = { id: B.id };
    global.__hiking.getTrailById = (id) => (id === B.id ? B : null);
    Service.fetchOsmPaths.mockReset();
    Service.fetchOsmPaths.mockResolvedValue({
      maps: [{ id: 'osm-way-55', name: 'Other Loop', distanceKm: 1.5 }],
      routes: { 'osm-way-55': pathLine(38.7, -78.3, 1.5) },
    });
    utils.rerender(<TrailPreviewScreen />);
    await settle();
    expect(utils.getByText('Other Trail')).toBeTruthy();
    expect(utils.getByText('1.5 km route')).toBeTruthy();
    await act(async () => { resolveA(OSM); });
    expect(utils.queryByText('Blue Trail')).toBeNull();
    expect(utils.getByText('1.5 km route')).toBeTruthy();
  });
});

describe('a line that is already kept', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  const offline = { record: kept(), inSearch: false, maps: new Error('no signal'), route: null, osm: new Error('no signal') };

  it('is not written to the phone again when the trail is saved and the line on screen is the kept one', async () => {
    await open(trail(), { ...offline, saved: true });
    await settle();
    expect(keepCalls().length).toBeGreaterThan(0);
    expect(keepCalls().every((c) => c.routes === undefined)).toBe(true);
  });

  it('is kept again when the trail is bookmarked, so the copy has the line it shows', async () => {
    const utils = await open(trail(), offline);
    await act(async () => { fireEvent.press(utils.getByTestId('trail-save-button')); });
    await settle();
    expect(keepCalls()[0]).toMatchObject({ pinned: true, routes: { 11: ROUTE } });
  });

  it('gives the length of each path on its button even with no signal', async () => {
    const record = kept({ maps: [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }], routes: { 11: ROUTE, 12: { ...ROUTE, distanceKm: 7.1 } } });
    const utils = await open(trail(), { ...offline, record });
    expect(utils.getByText('4.2 km')).toBeTruthy();
    expect(utils.getByText('7.1 km')).toBeTruthy();
  });

  it('gives no length for a path with no line yet', async () => {
    const record = kept({ maps: [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }], routes: { 11: ROUTE } });
    const utils = await open(trail(), { ...offline, record });
    expect(utils.getByText('4.2 km')).toBeTruthy();
    expect(utils.queryAllByText(/^\d+(\.\d)? km$/)).toHaveLength(1);
  });
});

describe('odd paths', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  it('shows no length for a path whose line has none, rather than "NaN"', async () => {
    const odd = { maps: OSM.maps.slice(0, 2).map(({ id, name }) => ({ id, name })), routes: { [BLUE]: { ...OSM.routes[BLUE], distanceKm: undefined }, [RED]: OSM.routes[RED] } };
    const utils = await open(placesTrail(), { osm: odd });
    expect(allText(utils)).not.toMatch(/NaN|undefined/);
    expect(utils.getByText('2.3 km')).toBeTruthy();
    expect(within(utils.getByTestId('trail-path-' + BLUE)).queryAllByText(/km|mi/)).toHaveLength(0);
    expect(within(utils.getByTestId('trail-path-' + RED)).queryAllByText('2.3 km')).toHaveLength(1);
  });

  it('gives the map no region, rather than a broken one, for a line with no usable point', async () => {
    const bad = { coordinates: [{ latitude: NaN, longitude: NaN }, { latitude: NaN, longitude: NaN }], distanceKm: 1, elevationGainM: null, elevationProfile: null };
    const odd = { maps: [{ id: BLUE, name: 'Blue Trail' }], routes: { [BLUE]: bad } };
    const utils = await open(placesTrail(), { osm: odd });
    expect(utils.UNSAFE_getByType(Maps.MapView).props.initialRegion).toBeUndefined();
  });
});

describe('paths from OpenStreetMap with no signal', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); jest.useRealTimers(); });

  const KEPT_OSM = () => ({
    version: 1, id: 'ChIJabc123', savedAt: 1, pinned: true, trail: placesTrail(),
    maps: OSM.maps.slice(0, 2), routes: { [BLUE]: OSM.routes[BLUE], [RED]: OSM.routes[RED] },
  });

  it('offers the paths kept on the phone, and draws the one chosen from the kept lines', async () => {
    const utils = await open(placesTrail(), { record: KEPT_OSM(), inSearch: false, osm: new Error('no signal') });
    expect(utils.getByText('Choose a Path')).toBeTruthy();
    expect(utils.getByText('Blue Trail')).toBeTruthy();
    expect(utils.getByText('Red Trail')).toBeTruthy();
    expect(utils.queryByText('Green Trail')).toBeNull();
    expect(utils.getByTestId('trail-route-sketch')).toBeTruthy();
    expect(utils.queryByTestId('trail-route-map')).toBeNull();
    expect(utils.getByText('Saved on this phone, so it works without a signal.')).toBeTruthy();
    expect(utils.getByText('1.1 km route')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByText('Red Trail')); });
    expect(utils.getByText('2.3 km route')).toBeTruthy();
    // and the note about loading failed is not shown, there is a line
    expect(utils.queryByText(/Couldn't load/)).toBeNull();
  });

  it('starts a hike from a kept path with no signal', async () => {
    const utils = await open(placesTrail(), { record: KEPT_OSM(), inSearch: false, osm: new Error('no signal') });
    fireEvent.press(utils.getByText('Start Hike'));
    expect(global.__router.push).toHaveBeenCalledWith({
      pathname: '/running/hiking/monitor',
      params: { id: 'ChIJabc123', pathName: 'Blue Trail', mapId: BLUE },
    });
  });

  it('waits a few seconds for OpenStreetMap before it draws the kept line, then draws it', async () => {
    jest.useFakeTimers();
    const utils = await open(placesTrail(), { record: KEPT_OSM(), inSearch: false, osm: 'pending' });
    expect(utils.getByText('Blue Trail')).toBeTruthy(); // the names are there at once
    act(() => { jest.advanceTimersByTime(3999); });
    expect(utils.queryByTestId('trail-route-sketch')).toBeNull();
    expect(utils.queryByText('Trail Route')).toBeNull();
    act(() => { jest.advanceTimersByTime(1); });
    expect(utils.getByTestId('trail-route-sketch')).toBeTruthy();
    expect(utils.getByText('1.1 km route')).toBeTruthy();
  });

  it('swaps in the fresh paths on the real map when they do arrive', async () => {
    jest.useFakeTimers();
    const utils = await open(placesTrail(), { record: KEPT_OSM(), inSearch: false, osm: 'pending' });
    act(() => { jest.advanceTimersByTime(4000); });
    expect(utils.getByTestId('trail-route-sketch')).toBeTruthy();
    await act(async () => { global.__resolveOsm(OSM); });
    expect(utils.getByTestId('trail-route-map')).toBeTruthy();
    expect(utils.queryByTestId('trail-route-sketch')).toBeNull();
    expect(utils.queryByText(/Saved on this phone/)).toBeNull();
    expect(utils.getByText('Green Trail')).toBeTruthy(); // the fresh list, with a path that was not kept
  });

  it('shows the fresh paths, not the kept ones, when the fresh answer has other paths', async () => {
    const stale = { ...KEPT_OSM(), maps: [{ id: 'osm-way-9', name: 'Old Path' }], routes: { 'osm-way-9': pathLine(38.5, -78.3, 3) } };
    const utils = await open(placesTrail(), { record: stale, inSearch: true, osm: OSM });
    expect(utils.queryByText('Old Path')).toBeNull();
    expect(utils.getByText('Blue Trail')).toBeTruthy();
  });

  it('moves to the first fresh path when the path chosen from the kept list is no longer there', async () => {
    const stale = { ...KEPT_OSM(), maps: [{ id: 'osm-way-9', name: 'Old Path' }, { id: 'osm-way-8', name: 'Older Path' }], routes: { 'osm-way-9': pathLine(38.5, -78.3, 3), 'osm-way-8': pathLine(38.5, -78.3, 4) } };
    const utils = await open(placesTrail(), { record: stale, osm: 'pending' });
    await act(async () => { fireEvent.press(utils.getByText('Older Path')); });
    await act(async () => { global.__resolveOsm(OSM); });
    expect(utils.queryByText('Older Path')).toBeNull();
    expect(utils.getByTestId('trail-path-' + BLUE).props.accessibilityState).toEqual({ selected: true });
    expect(utils.getByText('1.1 km route')).toBeTruthy();
  });

  it('keeps the path that was chosen when the fresh list still has it', async () => {
    const utils = await open(placesTrail(), { record: KEPT_OSM(), osm: 'pending' });
    await act(async () => { fireEvent.press(utils.getByText('Red Trail')); });
    await act(async () => { global.__resolveOsm(OSM); });
    expect(utils.getByTestId('trail-path-' + RED).props.accessibilityState).toEqual({ selected: true });
    expect(utils.getByText('2.3 km route')).toBeTruthy();
  });

  it('keeps the paths from OpenStreetMap and the trail service apart in the copy on the phone', async () => {
    const mixed = {
      version: 1, id: 'trailapi-77', savedAt: 1, pinned: true, trail: trail(),
      maps: [{ id: 11, name: 'Main loop' }, { id: BLUE, name: 'Blue Trail' }],
      routes: { 11: ROUTE, [BLUE]: OSM.routes[BLUE] },
    };
    const utils = await open(trail(), { record: mixed, inSearch: false, maps: new Error('no signal'), route: null, osm: new Error('no signal') });
    expect(utils.getByText('Choose a Path')).toBeTruthy();
    expect(utils.getByText('Main loop')).toBeTruthy();
    expect(utils.getByText('Blue Trail')).toBeTruthy();
    // the trail service path first, drawn from the copy once it has been waited for
    expect(utils.getByText('4.2 km route')).toBeTruthy();
    await act(async () => { fireEvent.press(utils.getByText('Blue Trail')); });
    expect(utils.getByText('1.1 km route')).toBeTruthy();
  });
});

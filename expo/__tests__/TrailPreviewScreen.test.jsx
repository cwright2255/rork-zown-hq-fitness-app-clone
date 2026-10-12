import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

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
  const MapView = (props) => mockReact.createElement(mockRn.View, { testID: 'trail-route-map' }, props.children);
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
}));
// The share sheet is the phone's; the file it would be given is what is tested here.
jest.mock('@/services/gpxShare', () => ({
  shareGpx: jest.fn((file) => global.__shareGpx(file)),
  gpxShareErrorText: jest.requireActual('@/services/gpxShare').gpxShareErrorText,
}));

import TrailPreviewScreen from '../app/running/hiking/[id]';

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

const open = async (t = trail(), {
  maps = [{ id: 11, name: 'Main loop' }], route = ROUTE, record = null, saved = false, inSearch = true,
} = {}) => {
  global.__router = { push: jest.fn(), back: jest.fn() };
  global.__params = { id: t ? t.id : 'nope' };
  global.__hiking = {
    getTrailById: (id) => (inSearch && t && id === t.id ? t : null),
    savedTrailIds: saved && t ? [t.id] : [], toggleSaveTrail: jest.fn(), userLocation: null,
  };
  global.__offline = { trails: record ? { [record.id]: record } : {}, keepTrail: jest.fn(), removeTrail: jest.fn() };
  Service.getTrailMaps.mockReset();
  Service.fetchRouteForMap.mockReset();
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

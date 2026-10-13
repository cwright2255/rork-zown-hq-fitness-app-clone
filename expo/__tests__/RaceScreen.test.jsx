import React from 'react';
import { Linking, ScrollView } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ collection: name })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  query: jest.fn((...parts) => ({ query: parts })),
  where: jest.fn((field, op, value) => ({ where: field, op, value })),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
  useLocalSearchParams: () => global.__params,
  // Runs when the screen opens and whenever the callback changes; the test can also "come back to the screen".
  useFocusEffect: (callback) => {
    const mockReact = require('react');
    mockReact.useEffect(() => { global.__focus = callback; return callback(); }, [callback]);
  },
}), { virtual: true });
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/services/raceBoard', () => ({ publishMyRaces: (...args) => global.__publishMyRaces(...args) }));

import RaceScreen from '../app/running/races/[kind]';
import { useVirtualRaceStore } from '../store/virtualRaceStore';
import { useSettingsStore } from '../store/settingsStore';
import { currentRace, raceEntryId, areasNear } from '../lib/virtualRaces';
import { getDocs } from 'firebase/firestore';

const Location = require('expo-location');

const NOW = new Date(2026, 9, 14, 10, 0, 0).getTime(); // a Wednesday
const localRace = currentRace('local', new Date(NOW));
const worldRace = currentRace('world', new Date(NOW));
const me = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png' };
const home = { latitude: 40.05, longitude: -74.05 };
const docsOf = (list) => ({ docs: list.map(({ id, ...data }) => ({ id, data: () => data })) });
const entry = (race, uid, timeSec, extra = {}) => ({
  id: raceEntryId(race.id, uid), raceId: race.id, uid, name: uid.toUpperCase(), avatar: null, timeSec,
  distanceKm: race.distanceKm, finishedAt: '2026-10-14T09:00:00Z', ...extra,
});
const flush = () => act(async () => {});
const mount = async (kind = 'local') => {
  global.__params = { kind };
  const utils = render(<RaceScreen />);
  await flush();
  await flush();
  return utils;
};
const store = () => useVirtualRaceStore.getState();
const keep = (race, timeSec, posted, uid = 'u1') => {
  store().recordFinish(race, uid, { timeSec, finishedAt: '2026-10-14T08:00:00.000Z', areaId: '1300x1059' });
  if (posted) {
    useVirtualRaceStore.setState((s) => ({
      finished: { ...s.finished, [raceEntryId(race.id, uid)]: { ...s.finished[raceEntryId(race.id, uid)], posted: true } },
    }));
  }
};
const textsOf = (utils) => utils.UNSAFE_getAllByType('Text').map((n) => [].concat(n.props.children).join('')).join('|');

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(Linking, 'openSettings').mockImplementation(async () => undefined);
  Linking.openSettings.mockClear();
  global.__router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  global.__user = me;
  global.__publishMyRaces = jest.fn(async () => true);
  global.__focus = null;
  useSettingsStore.setState({ units: 'metric', showInLeaderboards: true });
  useVirtualRaceStore.setState({ joined: {}, finished: {}, boards: {} });
  getDocs.mockReset();
  getDocs.mockResolvedValue(docsOf([]));
  Location.getForegroundPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  Location.requestForegroundPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  Location.getLastKnownPositionAsync.mockReset().mockResolvedValue({ coords: home });
  Location.getCurrentPositionAsync.mockReset().mockResolvedValue({ coords: home });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('a race that does not exist', () => {
  it('says so and can go back', async () => {
    const utils = await mount('marathon');
    expect(utils.getByTestId('race-unknown').props.children).toBe('That race does not exist.');
    fireEvent.press(utils.getByTestId('race-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe('the race at the top', () => {
  it('is the Local 5K for the week, with what it is', async () => {
    const utils = await mount('local');
    expect(utils.getByText('Local 5K')).toBeTruthy();
    expect(utils.getByText('5K')).toBeTruthy();
    expect(utils.getByTestId('race-schedule').props.children).toBe('Weekly · 4 days left');
    expect(utils.getByText('Run 5K wherever you like this week. Your time is ranked against runners within about 40 km of where you start.')).toBeTruthy();
  });

  it('is the Worldwide 10K for the month', async () => {
    const utils = await mount('world');
    expect(utils.getByText('Worldwide 10K')).toBeTruthy();
    expect(utils.getByText('10K')).toBeTruthy();
    expect(utils.getByTestId('race-schedule').props.children).toMatch(/^Monthly · \d+ days left$/);
    expect(utils.getByText('Run 10K wherever you like this month. Your time is ranked against everyone in Zown.')).toBeTruthy();
  });

  it('shows miles beside the distance, and the radius in miles, for a person who reads miles', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await mount('local');
    expect(utils.getByText('5K · 3.1 mi')).toBeTruthy();
    expect(utils.getByText(/within about 25 miles/)).toBeTruthy();
  });

  it('goes back', async () => {
    const utils = await mount('world');
    fireEvent.press(utils.getByTestId('race-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
  });
});

describe('joining and starting', () => {
  it('offers to join, and then to start or leave', async () => {
    const utils = await mount('world');
    expect(utils.queryByTestId('race-start')).toBeNull();
    fireEvent.press(utils.getByTestId('race-join'));
    expect(store().joined[raceEntryId(worldRace.id, 'u1')].raceId).toBe(worldRace.id);
    expect(utils.queryByTestId('race-join')).toBeNull();
    expect(utils.getByText('Start race')).toBeTruthy();
    fireEvent.press(utils.getByTestId('race-leave'));
    expect(store().joined).toEqual({});
    expect(utils.getByTestId('race-join')).toBeTruthy();
  });

  it('starts the race on the run screen, as a run', async () => {
    const utils = await mount('local');
    fireEvent.press(utils.getByTestId('race-join'));
    fireEvent.press(utils.getByTestId('race-start'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/running/active', params: { raceKind: 'local' } });
  });

  it('starts the worldwide race with its own kind', async () => {
    const utils = await mount('world');
    fireEvent.press(utils.getByTestId('race-join'));
    fireEvent.press(utils.getByTestId('race-start'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/running/active', params: { raceKind: 'world' } });
  });

  it('says runs only, and when the time is taken', async () => {
    const utils = await mount('local');
    expect(utils.getByText('Runs only. Walks do not count. Your time is taken when you cross 5K on the run screen.')).toBeTruthy();
  });

  it('asks for a sign in when nobody is signed in', async () => {
    global.__user = null;
    const utils = await mount('world');
    expect(utils.getByTestId('race-signin').props.children).toBe('Sign in to join the race.');
    expect(utils.queryByTestId('race-join')).toBeNull();
    expect(utils.queryByTestId('race-start')).toBeNull();
    expect(global.__publishMyRaces).not.toHaveBeenCalled();
  });

  it('sends results that did not get posted earlier when it opens', async () => {
    await mount('world');
    expect(global.__publishMyRaces).toHaveBeenCalledWith({ user: me });
  });
});

describe('your result', () => {
  it('shows your time and pace, that it is on the board, and offers to run it again', async () => {
    keep(localRace, 1471, true);
    const utils = await mount('local');
    expect(utils.getByTestId('race-result-time').props.children).toBe('24:31');
    expect(utils.getAllByText('4:54/km').length).toBeGreaterThan(0);
    expect(utils.getByTestId('race-result-state').props.children).toBe('On the board');
    expect(utils.getByText('Run it again')).toBeTruthy();
    expect(utils.queryByTestId('race-leave')).toBeNull();
    expect(utils.queryByTestId('race-join')).toBeNull();
  });

  it('counts as joined even when the join record is gone', async () => {
    keep(worldRace, 3100, true);
    const utils = await mount('world');
    expect(utils.getByTestId('race-start')).toBeTruthy();
  });

  it('says when it is not on the board yet, or why it never will be', async () => {
    keep(localRace, 1471, false);
    const utils = await mount('local');
    expect(utils.getByTestId('race-result-state').props.children).toBe('Not on the board yet. It will be sent when you have a signal.');
    act(() => { useSettingsStore.setState({ showInLeaderboards: false }); });
    expect(utils.getByTestId('race-result-state').props.children).toBe('Not on the board, because you are hidden from leaderboards.');
  });

  it('shows nothing of the kind before you have finished', async () => {
    const utils = await mount('local');
    expect(utils.queryByTestId('race-result')).toBeNull();
  });

  it('keeps each race\'s result to itself', async () => {
    keep(worldRace, 3100, true);
    const utils = await mount('local');
    expect(utils.queryByTestId('race-result')).toBeNull();
  });
});

describe('the worldwide board', () => {
  it('lists the fastest first, with their times and pace', async () => {
    getDocs.mockResolvedValue(docsOf([entry(worldRace, 'b', 3300), entry(worldRace, 'a', 3100, { name: 'Ada' }), entry(worldRace, 'c', 3500)]));
    const utils = await mount('world');
    expect(utils.getByText('Fastest in the world')).toBeTruthy();
    const rows = utils.getAllByTestId(/^race-row-/).map((r) => r.props.testID);
    expect(rows).toEqual(['race-row-a', 'race-row-b', 'race-row-c']);
    const first = textsOf({ UNSAFE_getAllByType: (t) => utils.getByTestId('race-row-a').findAllByType(t) });
    expect(first).toBe('1|A|Ada|5:10/km|51:40');
    expect(utils.getByTestId('race-board')).toBeTruthy();
  });

  it('marks your own row', async () => {
    keep(worldRace, 3300, true);
    getDocs.mockResolvedValue(docsOf([entry(worldRace, 'a', 3100), entry(worldRace, 'u1', 3300, { name: 'Cj' })]));
    const utils = await mount('world');
    expect(utils.getByText('Cj (you)')).toBeTruthy();
    expect(utils.getAllByTestId('race-row-u1')).toHaveLength(1);
  });

  it('shows your time at the end, without a rank, when it is not among those loaded', async () => {
    keep(worldRace, 4000, true);
    getDocs.mockResolvedValue(docsOf([entry(worldRace, 'a', 3100)]));
    const utils = await mount('world');
    const rows = utils.getAllByTestId(/^race-row-/).map((r) => r.props.testID);
    expect(rows).toEqual(['race-row-a', 'race-row-u1']);
    expect(textsOf({ UNSAFE_getAllByType: (t) => utils.getByTestId('race-row-u1').findAllByType(t) })).toBe('–|Cj (you)|6:40/km|1:06:40');
  });

  it('does not show you on the board when your time was never posted', async () => {
    keep(worldRace, 4000, false);
    getDocs.mockResolvedValue(docsOf([entry(worldRace, 'a', 3100)]));
    const utils = await mount('world');
    expect(utils.queryByTestId('race-row-u1')).toBeNull();
  });

  it('shows a picture when there is one and the first letter when there is not', async () => {
    getDocs.mockResolvedValue(docsOf([entry(worldRace, 'a', 3100, { avatar: 'https://img/a.png' }), entry(worldRace, 'b', 3200, { name: 'bea' })]));
    const utils = await mount('world');
    expect(utils.UNSAFE_getByType('Image').props.source).toEqual({ uri: 'https://img/a.png' });
    expect(utils.getByText('B')).toBeTruthy();
  });

  it('says no one has finished yet when the board is empty', async () => {
    const utils = await mount('world');
    expect(utils.getByTestId('race-board-empty').props.children).toBe('No one has finished yet. Be the first.');
  });

  it('shows a spinner while the board loads', async () => {
    let release;
    getDocs.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const utils = await mount('world');
    expect(utils.getByTestId('race-board-loading')).toBeTruthy();
    await act(async () => { release(docsOf([entry(worldRace, 'a', 3100)])); });
    expect(utils.queryByTestId('race-board-loading')).toBeNull();
    expect(utils.getByTestId('race-row-a')).toBeTruthy();
  });

  it('says so when the board cannot be loaded, and loads it on Try again', async () => {
    getDocs.mockRejectedValue(new Error('offline'));
    const utils = await mount('world');
    expect(utils.getByTestId('race-board-error')).toBeTruthy();
    expect(utils.getByText("Couldn't load the board. Check your signal and try again.")).toBeTruthy();
    getDocs.mockReset().mockResolvedValue(docsOf([entry(worldRace, 'a', 3100)]));
    fireEvent.press(utils.getByTestId('race-board-retry'));
    await flush();
    expect(utils.queryByTestId('race-board-error')).toBeNull();
    expect(utils.getByTestId('race-row-a')).toBeTruthy();
  });

  it('never asks where you are', async () => {
    await mount('world');
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reads the board again when you pull down, and when you come back to the screen', async () => {
    const utils = await mount('world');
    const reads = () => getDocs.mock.calls.length;
    const before = reads();
    await act(async () => { await utils.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh(); });
    expect(reads()).toBe(before + 1);
    await act(async () => { global.__focus(); });
    expect(reads()).toBe(before + 2);
  });

  it('pulling down reads the board without looking for your position, and the spinner stops', async () => {
    const utils = await mount('world');
    const before = getDocs.mock.calls.length;
    await act(async () => { await utils.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh(); });
    expect(getDocs.mock.calls.length).toBe(before + 1);
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(utils.UNSAFE_getByType(ScrollView).props.refreshControl.props.refreshing).toBe(false);
  });

  it('stops the pull-down spinner even when the board cannot be read', async () => {
    const utils = await mount('world');
    getDocs.mockReset().mockRejectedValue(new Error('offline'));
    await act(async () => { await utils.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh(); });
    expect(utils.UNSAFE_getByType(ScrollView).props.refreshControl.props.refreshing).toBe(false);
    expect(utils.getByTestId('race-board-error')).toBeTruthy();
  });

  it('shows pace and distance in miles for a person who reads miles', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    keep(worldRace, 3100, true);
    getDocs.mockResolvedValue(docsOf([entry(worldRace, 'a', 3000), entry(worldRace, 'u1', 3100, { name: 'Cj' })]));
    const utils = await mount('world');
    const miles = (id) => textsOf({ UNSAFE_getAllByType: (t) => utils.getByTestId(id).findAllByType(t) });
    expect(miles('race-row-a')).toBe('1|A|A|8:03/mi|50:00');
    expect(utils.getByTestId('race-result').findAllByType('Text').map((n) => n.props.children)).toContain('8:19/mi');
  });

  it('has a globe for the worldwide race and a pin for the local one', async () => {
    const world = await mount('world');
    expect(world.UNSAFE_getAllByType('Ionicons').some((n) => n.props.name === 'globe-outline')).toBe(true);
    expect(world.UNSAFE_getAllByType('Ionicons').some((n) => n.props.name === 'location')).toBe(false);
    world.unmount();
    const local = await mount('local');
    expect(local.UNSAFE_getAllByType('Ionicons').some((n) => n.props.name === 'location')).toBe(true);
    expect(local.UNSAFE_getAllByType('Ionicons').some((n) => n.props.name === 'globe-outline')).toBe(false);
  });
});

describe('the local board', () => {
  it('asks for the squares around where you are, and lists the runners there', async () => {
    getDocs.mockResolvedValue(docsOf([entry(localRace, 'b', 1600, { areaId: '1300x1059' }), entry(localRace, 'a', 1500, { areaId: '1301x1059' })]));
    const utils = await mount('local');
    expect(utils.getByText('Fastest near you')).toBeTruthy();
    expect(getDocs).toHaveBeenCalledTimes(Math.ceil(areasNear(home).length / 10));
    expect(utils.getAllByTestId(/^race-row-/).map((r) => r.props.testID)).toEqual(['race-row-a', 'race-row-b']);
  });

  it('uses where you are now when the phone has no last position', async () => {
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    const utils = await mount('local');
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
    expect(getDocs).toHaveBeenCalled();
    expect(utils.queryByTestId('race-needs-location')).toBeNull();
  });

  it('asks you to allow location when it is not allowed yet, and then finds the board', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    getDocs.mockResolvedValue(docsOf([entry(localRace, 'a', 1500, { areaId: '1300x1059' })]));
    const utils = await mount('local');
    expect(utils.getByTestId('race-needs-location')).toBeTruthy();
    expect(utils.getByText(/Zown needs to know roughly where you are/)).toBeTruthy();
    expect(getDocs).not.toHaveBeenCalled();
    fireEvent.press(utils.getByTestId('race-allow-location'));
    await flush();
    await flush();
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(utils.queryByTestId('race-needs-location')).toBeNull();
    expect(utils.getByTestId('race-row-a')).toBeTruthy();
  });

  it('sends you to Settings when location was refused for good', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const utils = await mount('local');
    expect(utils.queryByTestId('race-allow-location')).toBeNull();
    fireEvent.press(utils.getByTestId('race-open-settings'));
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('sends you to Settings when you say no to the question', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const utils = await mount('local');
    fireEvent.press(utils.getByTestId('race-allow-location'));
    await flush();
    await flush();
    expect(utils.queryByTestId('race-allow-location')).toBeNull();
    fireEvent.press(utils.getByTestId('race-open-settings'));
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('lets you try again when the position could not be found', async () => {
    Location.getLastKnownPositionAsync.mockRejectedValue(new Error('no fix'));
    const utils = await mount('local');
    expect(utils.getByTestId('race-needs-location')).toBeTruthy();
    expect(utils.getByTestId('race-allow-location')).toBeTruthy();
    expect(utils.queryByTestId('race-open-settings')).toBeNull();
  });

  it('looks for your position again when you pull down', async () => {
    const utils = await mount('local');
    Location.getForegroundPermissionsAsync.mockClear();
    await act(async () => { await utils.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh(); });
    await flush();
    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('while your position is being found', () => {
  const pending = () => Location.getForegroundPermissionsAsync.mockReturnValue(new Promise(() => {}));

  it('shows the spinner, not a request for location or an empty board, and reads nothing yet', async () => {
    pending();
    const utils = await mount('local');
    expect(utils.getByTestId('race-board-loading')).toBeTruthy();
    expect(utils.queryByTestId('race-needs-location')).toBeNull();
    expect(utils.queryByTestId('race-board-empty')).toBeNull();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('does not show another week\'s board, nor another race\'s', async () => {
    pending();
    useVirtualRaceStore.setState({
      boards: { local: { raceId: 'local-5k-week-2026-10-05', status: 'done', entries: [entry(localRace, 'old', 1400)] } },
    });
    const utils = await mount('local');
    expect(utils.queryByTestId('race-row-old')).toBeNull();
    expect(utils.getByTestId('race-board-loading')).toBeTruthy();
  });
});

describe('Show in Leaderboards when it was never set', () => {
  it('counts as on', async () => {
    useSettingsStore.setState({ showInLeaderboards: undefined });
    keep(worldRace, 4000, false);
    const utils = await mount('world');
    expect(utils.getByTestId('race-result-state').props.children).toBe('Not on the board yet. It will be sent when you have a signal.');
    expect(utils.getByTestId('race-privacy').props.children.join('')).toMatch(/You can hide yourself in Settings under Show in Leaderboards\.$/);
  });
});

describe('what is said about privacy', () => {
  it('tells you what is shown, and where to hide yourself', async () => {
    const utils = await mount('local');
    expect(utils.getByTestId('race-privacy').props.children.join('')).toBe(
      'Your name, picture and time are shown to other Zown users. The local race uses a rough map square for where you started, never your exact location. You can hide yourself in Settings under Show in Leaderboards.',
    );
  });

  it('says so when you are already hidden', async () => {
    useSettingsStore.setState({ showInLeaderboards: false });
    const utils = await mount('world');
    expect(utils.getByTestId('race-privacy').props.children.join('')).toMatch(/You are hidden from leaderboards in Settings, so your times are not posted\.$/);
  });
});

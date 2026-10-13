import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('../services/journeyRewards', () => ({ rewardJourney: jest.fn() }));
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
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));

import JourneyScreen from '../app/running/journeys/[id]';
import { useVirtualChallengeStore } from '../store/virtualChallengeStore';
import { useSettingsStore } from '../store/settingsStore';
import { getDoc } from 'firebase/firestore';

const store = () => useVirtualChallengeStore.getState();
const flush = () => act(async () => {});
const mount = async (id = 'grand-canyon-rim') => {
  global.__params = { id };
  const utils = render(<JourneyScreen />);
  await flush();
  await flush();
  return utils;
};
const textOf = (node) => [].concat(node.props.children).join('');
const credit = async (km) => { await act(async () => { store().creditDistance(km, 'u1'); }); };
const joined = async (km = 0) => {
  store().joinChallenge('grand-canyon-rim', 'u1');
  if (km) store().creditDistance(km, 'u1');
  await flush();
};

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.__router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  global.__user = { uid: 'u1', name: 'Cj' };
  useSettingsStore.setState({ units: 'metric' });
  useVirtualChallengeStore.setState({ byUser: {}, loadedFor: null });
  getDoc.mockReset();
  getDoc.mockResolvedValue({ exists: () => false });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('a journey that does not exist', () => {
  it('says so and can go back', async () => {
    const utils = await mount('nowhere');
    expect(textOf(utils.getByTestId('journey-unknown'))).toBe('That journey does not exist.');
    fireEvent.press(utils.getByTestId('journey-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
    expect(utils.queryByTestId('journey-join')).toBeNull();
  });

  it('is what a list of ids, or no id, gives', async () => {
    expect((await mount(['grand-canyon-rim'])).getByTestId('journey-unknown')).toBeTruthy();
    expect((await mount(null)).getByTestId('journey-unknown')).toBeTruthy();
  });
});

describe('the top of the page', () => {
  it('shows the route, its length, where it is and what it is', async () => {
    const utils = await mount();
    expect(utils.getByText('Grand Canyon Rim Trail')).toBeTruthy();
    expect(textOf(utils.getByTestId('journey-length'))).toBe('34 km');
    expect(utils.getByText('Arizona, USA')).toBeTruthy();
    expect(utils.getByText('A walk along the South Rim of the Grand Canyon.')).toBeTruthy();
  });

  it('writes the length in miles for a person who reads miles', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-length'))).toBe('21.1 mi');
  });

  it('goes back', async () => {
    const utils = await mount();
    fireEvent.press(utils.getByTestId('journey-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
  });

  it('has a map for the route, and a tick once it is done', async () => {
    const utils = await mount();
    const icons = () => utils.UNSAFE_getAllByType('Ionicons').map((n) => n.props.name);
    expect(icons()).toContain('map-outline');
    expect(icons()).not.toContain('checkmark');
    await act(async () => { await joined(34); });
    expect(icons()).toContain('checkmark');
    expect(icons()).not.toContain('map-outline');
  });
});

describe('before joining', () => {
  it('offers to join, with what finishing earns, and shows no progress', async () => {
    const utils = await mount();
    expect(utils.getByText('Join journey')).toBeTruthy();
    expect(utils.queryByTestId('journey-progress')).toBeNull();
    expect(utils.queryByTestId('journey-start-run')).toBeNull();
    expect(utils.queryByTestId('journey-start-walk')).toBeNull();
    expect(utils.getByText('Every run and walk you record after you join adds to this journey. Finish it to earn 500 XP and the Trailblazer badge.')).toBeTruthy();
  });

  it('says how much more a long route earns', async () => {
    const utils = await mount('camino-frances');
    expect(utils.getByText(/Finish it to earn 2000 XP/)).toBeTruthy();
  });

  it('shows all four milestones, none reached, with how far along each is', async () => {
    const utils = await mount();
    const rows = utils.getAllByTestId(/^journey-milestone-\d+$/);
    expect(rows.map((r) => r.props.testID)).toEqual(['journey-milestone-25', 'journey-milestone-50', 'journey-milestone-75', 'journey-milestone-100']);
    expect(utils.getByText('A quarter of the way')).toBeTruthy();
    expect(utils.getByText('Halfway')).toBeTruthy();
    expect(utils.getByText('Three quarters')).toBeTruthy();
    expect(utils.getByText('The finish')).toBeTruthy();
    expect(['8.5 km', '17.0 km', '25.5 km', '34.0 km'].every((t) => utils.getByText(t))).toBe(true);
    expect(utils.queryAllByTestId(/-reached$/)).toHaveLength(0);
    expect(utils.queryAllByTestId(/-ahead$/)).toHaveLength(4);
  });

  it('shows the milestones in miles for a person who reads miles', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await mount();
    expect(['5.3 mi', '10.6 mi', '15.8 mi'].every((t) => utils.getByText(t))).toBe(true);
    expect(utils.getAllByText('21.1 mi')).toHaveLength(2); // the finish, and the length of the route at the top
  });

  it('joins when asked, and then shows the start of the journey', async () => {
    const utils = await mount();
    fireEvent.press(utils.getByTestId('journey-join'));
    await flush();
    expect(store().byUser.u1['grand-canyon-rim']).toMatchObject({ distanceKm: 0, completedAt: null });
    expect(utils.queryByTestId('journey-join')).toBeNull();
    expect(textOf(utils.getByTestId('journey-covered'))).toBe('0.0 km of 34 km');
    expect(utils.getByText('Your progress')).toBeTruthy();
    expect(textOf(utils.getByTestId('journey-state'))).toBe('34.0 km to go. Next: A quarter of the way.');
    expect(utils.getByTestId('journey-start-run')).toBeTruthy();
    expect(utils.getByTestId('journey-start-walk')).toBeTruthy();
    expect(utils.getByText('Every run and walk you record in Zown adds to this journey.')).toBeTruthy();
  });

  it('does not show somebody else\'s journey as yours', async () => {
    store().joinChallenge('grand-canyon-rim', 'u2');
    const utils = await mount();
    expect(utils.getByTestId('journey-join')).toBeTruthy();
    expect(utils.queryByTestId('journey-progress')).toBeNull();
  });
});

describe('part way', () => {
  it('shows how far, how far is left, and the next milestone', async () => {
    await joined(12);
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-covered'))).toBe('12.0 km of 34 km');
    expect(textOf(utils.getByTestId('journey-state'))).toBe('22.0 km to go. Next: Halfway.');
    expect(StyleSheet.flatten(utils.getByTestId('journey-fill').props.style).width).toBe('35%');
    expect(utils.queryByTestId('journey-join')).toBeNull();
  });

  it('fills the bar to the nearest whole per cent', async () => {
    await joined(20); // 58.8
    const utils = await mount();
    expect(StyleSheet.flatten(utils.getByTestId('journey-fill').props.style).width).toBe('59%');
  });

  it('keeps the map in the picture until the route is finished', async () => {
    await joined(12);
    const utils = await mount();
    const names = utils.UNSAFE_getAllByType('Ionicons').map((n) => n.props.name);
    expect(names).toContain('map-outline');
    expect(names).not.toContain('checkmark');
  });

  it('ticks the milestones behind you and not those ahead', async () => {
    await joined(18);
    const utils = await mount();
    expect(utils.queryAllByTestId(/-reached$/).map((n) => n.props.testID)).toEqual(['journey-milestone-25-reached', 'journey-milestone-50-reached']);
    expect(utils.queryAllByTestId(/-ahead$/).map((n) => n.props.testID)).toEqual(['journey-milestone-75-ahead', 'journey-milestone-100-ahead']);
    const names = utils.UNSAFE_getAllByType('Ionicons').filter((n) => /checkmark-circle|ellipse-outline/.test(n.props.name)).map((n) => n.props.name);
    expect(names).toEqual(['checkmark-circle', 'checkmark-circle', 'ellipse-outline', 'ellipse-outline']);
  });

  it('counts in miles for a person who reads miles', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    await joined(16.09344);
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-covered'))).toBe('10.0 mi of 21.1 mi');
    expect(textOf(utils.getByTestId('journey-state'))).toBe('11.1 mi to go. Next: Halfway.');
  });

  it('moves along when a run is saved while the page is open', async () => {
    await joined();
    const utils = await mount();
    await credit(10);
    expect(textOf(utils.getByTestId('journey-covered'))).toBe('10.0 km of 34 km');
    expect(textOf(utils.getByTestId('journey-state'))).toBe('24.0 km to go. Next: Halfway.');
  });

  it('starts a run or a walk', async () => {
    await joined(5);
    const utils = await mount();
    fireEvent.press(utils.getByTestId('journey-start-run'));
    expect(global.__router.push).toHaveBeenLastCalledWith('/running/active');
    fireEvent.press(utils.getByTestId('journey-start-walk'));
    expect(global.__router.push).toHaveBeenLastCalledWith({ pathname: '/running/active', params: { activity: 'walk' } });
  });
});

describe('finished', () => {
  it('says so, with the day, and has nothing left to start', async () => {
    await joined(34);
    const utils = await mount();
    expect(utils.getByText('Completed')).toBeTruthy();
    expect(textOf(utils.getByTestId('journey-covered'))).toBe('34.0 km of 34 km');
    expect(textOf(utils.getByTestId('journey-state'))).toMatch(/^Finished on .*\d{4}\. XP and the Trailblazer badge are yours\.$/);
    expect(StyleSheet.flatten(utils.getByTestId('journey-fill').props.style).width).toBe('100%');
    expect(utils.queryByTestId('journey-start-run')).toBeNull();
    expect(utils.queryByTestId('journey-start-walk')).toBeNull();
    expect(utils.queryByTestId('journey-join')).toBeNull();
    expect(utils.queryAllByTestId(/-reached$/)).toHaveLength(4);
  });

  it('writes the day as month, day and year, in the phone\'s language', async () => {
    const finishedAt = '2026-10-09T12:00:00Z';
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: 's', distanceKm: 34, completedAt: finishedAt } } } });
    const utils = await mount();
    const day = new Date(finishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    expect(textOf(utils.getByTestId('journey-state'))).toBe(`Finished on ${day}. XP and the Trailblazer badge are yours.`);
    expect(day).toMatch(/[A-Za-z]/); // a month name, not just numbers
  });

  it('shows a checkmark in the picture, and no map', async () => {
    await joined(34);
    const names = (await mount()).UNSAFE_getAllByType('Ionicons').map((n) => n.props.name);
    expect(names).toContain('checkmark');
    expect(names).not.toContain('map-outline');
  });

  it('says so without a day when the record has none', async () => {
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: 's', distanceKm: 34, completedAt: '' } } } });
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-state'))).toBe('Finished. XP and the Trailblazer badge are yours.');
  });

  it('says so without a day when the day cannot be read', async () => {
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: 's', distanceKm: 34, completedAt: 'not a date' } } } });
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-state'))).toBe('Finished on . XP and the Trailblazer badge are yours.');
  });

  it('turns to finished when the last run is saved while the page is open', async () => {
    await joined(30);
    const utils = await mount();
    expect(utils.getByTestId('journey-start-run')).toBeTruthy();
    await credit(10);
    expect(utils.getByText('Completed')).toBeTruthy();
    expect(utils.queryByTestId('journey-start-run')).toBeNull();
  });
});

describe('not signed in', () => {
  beforeEach(() => { global.__user = null; });

  it('asks for a sign in, and offers nothing to join or start', async () => {
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-signin'))).toBe('Sign in to join this journey.');
    expect(utils.queryByTestId('journey-join')).toBeNull();
    expect(utils.queryByTestId('journey-start-run')).toBeNull();
    expect(utils.queryByTestId('journey-progress')).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('still shows the route and the milestones', async () => {
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-length'))).toBe('34 km');
    expect(utils.getAllByTestId(/^journey-milestone-\d+$/)).toHaveLength(4);
  });
});

describe('loading and privacy', () => {
  it('reads the person\'s journeys from their account when it opens', async () => {
    await mount();
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/virtualChallenges' });
  });

  it('reads again for a different person who signs in while it is open', async () => {
    const utils = await mount();
    expect(getDoc).toHaveBeenCalledTimes(1);
    global.__user = { uid: 'u2', name: 'Sam' };
    await act(async () => { utils.rerender(<JourneyScreen />); });
    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(getDoc).toHaveBeenLastCalledWith({ path: 'users/u2/data/virtualChallenges' });
  });

  it('shows what the account had that the phone did not', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ activeChallenges: { 'grand-canyon-rim': { startedAt: '2026-10-01T00:00:00Z', distanceKm: 20, completedAt: null } } }),
    });
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-covered'))).toBe('20.0 km of 34 km');
  });

  it('says the progress is private and where it is kept', async () => {
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-privacy'))).toBe(
      'Your journey progress is private to you. It is kept on your phone and copied to your account, so it carries over to a new phone.',
    );
  });
});

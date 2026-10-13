import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

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
jest.mock('expo-router', () => {
  const mockRouter = { push: (...args) => global.__router.push(...args), back: (...args) => global.__router.back(...args) };
  return { useRouter: () => mockRouter, router: mockRouter };
}, { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));

import VirtualRacesScreen from '../app/running/races/index';
import { useVirtualChallengeStore } from '../store/virtualChallengeStore';
import { useVirtualRaceStore } from '../store/virtualRaceStore';
import { useSettingsStore } from '../store/settingsStore';
import { currentRace } from '../lib/virtualRaces';
import { JOURNEYS } from '../lib/virtualJourneys';
import { getDoc } from 'firebase/firestore';

const NOW = new Date(2026, 9, 14, 10, 0, 0); // a Wednesday, so the local week has 4 days left
const flush = () => act(async () => {});
const mount = async () => {
  const utils = render(<VirtualRacesScreen />);
  await flush();
  await flush();
  return utils;
};
const textOf = (node) => [].concat(node.props.children).join('');

beforeEach(() => {
  jest.useFakeTimers({ now: NOW.getTime() });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.__router = { push: jest.fn(), back: jest.fn() };
  global.__user = { uid: 'u1', name: 'Cj' };
  useSettingsStore.setState({ units: 'metric' });
  useVirtualChallengeStore.setState({ byUser: {}, loadedFor: null });
  useVirtualRaceStore.setState({ joined: {}, finished: {}, boards: {} });
  getDoc.mockReset();
  getDoc.mockResolvedValue({ exists: () => false });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('the top of the page', () => {
  it('has a title, goes back, and says what this is', async () => {
    const utils = await mount();
    expect(utils.getAllByText('Virtual Races').length).toBeGreaterThan(0);
    expect(utils.getByTestId('races-back').props.accessibilityLabel).toBe('Back');
    fireEvent.press(utils.getByTestId('races-back'));
    expect(global.__router.back).toHaveBeenCalledTimes(1);
    expect(textOf(utils.getByTestId('races-hero'))).toBe('Pick a finish line. Then chase it.');
    expect(utils.getByText(/Race the clock against runners near you and around the world, or travel a famous route one run at a time/)).toBeTruthy();
  });
});

describe('how it works', () => {
  it('has three numbered steps, in order', async () => {
    const utils = await mount();
    const steps = utils.getByTestId('races-steps');
    const texts = steps.findAllByType('Text').map((n) => textOf(n));
    expect(texts).toEqual([
      '1', 'Choose a race', 'Pick a timed race or a journey, open it and tap Join.',
      '2', 'Run or walk with Zown', 'Record your run or walk in Zown and the distance is counted for you.',
      '3', 'Earn XP and a badge', 'Cross the line or finish the route to earn XP and a badge. Timed races also put your time on the board.',
    ]);
    expect(utils.getByText('How it works')).toBeTruthy();
  });
});

describe('the cards', () => {
  it('has the two timed races, then every journey, as cards', async () => {
    const utils = await mount();
    expect(utils.getByText('Timed races')).toBeTruthy();
    expect(utils.getByText('Journeys')).toBeTruthy();
    const timed = within(utils.getByTestId('races-timed')).getAllByTestId(/^race-card-(local|world)$/);
    expect(timed.map((n) => n.props.testID)).toEqual(['race-card-local', 'race-card-world']);
    const journeys = within(utils.getByTestId('races-journeys')).getAllByTestId(/^journey-card-[a-z-]+$/);
    expect(journeys.map((n) => n.props.testID)).toEqual(JOURNEYS.map((j) => `journey-card-${j.id}`));
    expect(within(utils.getByTestId('races-timed')).queryAllByTestId(/^journey-card-/)).toHaveLength(0);
    expect(within(utils.getByTestId('races-journeys')).queryAllByTestId(/^race-card-/)).toHaveLength(0);
  });

  it('says what each timed race is', async () => {
    const utils = await mount();
    expect(utils.getByText('Local 5K')).toBeTruthy();
    expect(utils.getByText('Worldwide 10K')).toBeTruthy();
    expect(utils.getByText('5K · Weekly · 4 days left')).toBeTruthy();
    expect(utils.getByText(/^10K · Monthly · \d+ days left$/)).toBeTruthy();
    expect(utils.getByText('A new Local 5K starts every Monday and a new Worldwide 10K every month. Fastest time wins.')).toBeTruthy();
  });

  it('says what each journey is', async () => {
    const utils = await mount();
    expect(utils.getByText('Grand Canyon Rim Trail')).toBeTruthy();
    expect(utils.getByText('34 km · 4 milestones')).toBeTruthy();
    expect(utils.getByText('Marathon to Athens')).toBeTruthy();
    expect(utils.getByText('Camino de Santiago (Camino Francés)')).toBeTruthy();
    expect(utils.getByText('780 km · 4 milestones')).toBeTruthy();
    expect(utils.getByText('Pick a route. Every run and walk you record adds up along it, with milestones on the way.')).toBeTruthy();
  });

  it('shows distances in miles for a person who reads miles', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await mount();
    expect(utils.getByText('21.1 mi · 4 milestones')).toBeTruthy();
    expect(utils.getByText('5K · 3.1 mi · Weekly · 4 days left')).toBeTruthy();
  });

  it('opens the one that was tapped', async () => {
    const utils = await mount();
    fireEvent.press(utils.getByTestId('race-card-world'));
    expect(global.__router.push).toHaveBeenLastCalledWith('/running/races/world');
    fireEvent.press(utils.getByTestId('journey-card-inca-trail'));
    expect(global.__router.push).toHaveBeenLastCalledWith('/running/journeys/inca-trail');
  });

  it('shows where you are on a journey you have joined, and what you did in a race', async () => {
    useVirtualRaceStore.getState().recordFinish(currentRace('local', NOW), 'u1', { timeSec: 1471, finishedAt: NOW.toISOString(), areaId: '1300x1059' });
    await act(async () => {
      useVirtualChallengeStore.getState().joinChallenge('grand-canyon-rim', 'u1');
      useVirtualChallengeStore.getState().creditDistance(17, 'u1');
    });
    const utils = await mount();
    expect(textOf(utils.getByTestId('journey-card-grand-canyon-rim-label'))).toBe('50%');
    expect(StyleSheet.flatten(utils.getByTestId('journey-card-grand-canyon-rim-fill').props.style).width).toBe('50%');
    expect(utils.queryByTestId('journey-card-inca-trail-label')).toBeNull();
    expect(textOf(utils.getByTestId('race-card-status-local'))).toBe('Your time 24:31');
  });

  it('shows your own race time and not another person\'s on the same phone', async () => {
    global.__user = { uid: 'u2', name: 'Sam' };
    useVirtualRaceStore.getState().recordFinish(currentRace('local', NOW), 'u1', { timeSec: 1471, finishedAt: NOW.toISOString(), areaId: '1300x1059' });
    useVirtualRaceStore.getState().join(currentRace('world', NOW), 'u1');
    let utils = await mount();
    expect(utils.queryByTestId('race-card-status-local')).toBeNull();
    expect(utils.queryByTestId('race-card-status-world')).toBeNull();
    utils.unmount();
    useVirtualRaceStore.getState().recordFinish(currentRace('local', NOW), 'u2', { timeSec: 1500, finishedAt: NOW.toISOString(), areaId: '1300x1059' });
    utils = await mount();
    expect(textOf(utils.getByTestId('race-card-status-local'))).toBe('Your time 25:00');
  });

  it('lays the cards out two to a row, using the width of the screen', async () => {
    const utils = await mount();
    const cards = [
      ...within(utils.getByTestId('races-timed')).getAllByTestId(/^race-card-(local|world)$/),
      ...within(utils.getByTestId('races-journeys')).getAllByTestId(/^journey-card-[a-z-]+$/),
    ];
    const widths = cards.map((n) => StyleSheet.flatten(n.props.style).width);
    expect(new Set(widths).size).toBe(1);
    expect(widths[0] * 2 + 14 + 40).toBeLessThanOrEqual(750); // the test screen is 750 wide
    expect(widths[0] * 2 + 14 + 40).toBeGreaterThan(740);
  });
});

describe('on a phone whose width is not a round number', () => {
  const original = Dimensions.get('window');
  afterEach(() => { Dimensions.set({ window: original, screen: Dimensions.get('screen') }); });

  it('rounds the cards down, so two always fit in a row', async () => {
    Dimensions.set({ window: { ...original, width: 393 }, screen: Dimensions.get('screen') });
    const utils = await mount();
    const card = within(utils.getByTestId('races-timed')).getAllByTestId(/^race-card-(local|world)$/)[0];
    const width = StyleSheet.flatten(card.props.style).width;
    expect(width).toBe(169); // (393 - 40 - 14) / 2 = 169.5
    expect(width * 2 + 14 + 40).toBeLessThanOrEqual(393);
  });
});

describe('the grid of cards', () => {
  it('runs along and wraps, starting 20 in from the edge, 16 between rows', async () => {
    const utils = await mount();
    for (const id of ['races-timed', 'races-journeys']) {
      expect(StyleSheet.flatten(utils.getByTestId(id).props.style)).toMatchObject({
        flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 20, rowGap: 16,
      });
    }
  });
});

describe('the questions', () => {
  it('answers what counts, the medal, joining more than one and who sees results', async () => {
    const utils = await mount();
    const texts = utils.getByTestId('races-questions').findAllByType('Text').map((n) => textOf(n));
    expect(texts.filter((_, i) => i % 2 === 0)).toEqual(['What counts?', 'Is there a medal?', 'Can I join more than one?', 'Who can see my results?']);
    expect(utils.getByText(/A timed race counts a run only, and the full distance must be done in one run\. A journey counts every run and walk you record after you join, added together\./)).toBeTruthy();
    expect(utils.getByText('No physical medal. You earn XP and a badge: Race Day for a timed race and Trailblazer for a journey.')).toBeTruthy();
    expect(utils.getByText(/A run or walk adds to every journey you have joined/)).toBeTruthy();
    expect(utils.getByText(/Your journey progress is private to you\./)).toBeTruthy();
  });
});

describe('loading', () => {
  it('reads the person\'s journeys from their account', async () => {
    await mount();
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/virtualChallenges' });
  });

  it('reads again for a different person who signs in while it is open', async () => {
    const utils = await mount();
    expect(getDoc).toHaveBeenCalledTimes(1);
    global.__user = { uid: 'u2', name: 'Sam' };
    await act(async () => { utils.rerender(<VirtualRacesScreen />); });
    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(getDoc).toHaveBeenLastCalledWith({ path: 'users/u2/data/virtualChallenges' });
  });

  it('reads nothing when nobody is signed in', async () => {
    global.__user = null;
    const utils = await mount();
    expect(getDoc).not.toHaveBeenCalled();
    expect(utils.getByTestId('races-journeys')).toBeTruthy();
  });
});

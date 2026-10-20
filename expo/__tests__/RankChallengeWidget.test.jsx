// Home > Challenges & Rank: your place among the people you follow (by XP) and your live challenge, in one wide card with two taps.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th, so UTC says Thu 15 Oct
// and the challenge store's periods are day-2026-10-15, week-2026-10-12, month-2026-10 and season-fall-2026.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: { name: 'db' }, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...path) => ({ path: path.join('/') })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  query: jest.fn((...parts) => ({ query: parts })),
  orderBy: jest.fn((field, dir) => ({ orderBy: field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
  where: jest.fn((field, op, value) => ({ where: field, op, value })),
  documentId: jest.fn(() => '__name__'),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking and running stores import it; no GPS is used here
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import { getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import RankChallengeWidget from '../components/RankChallengeWidget';
import { useUserStore } from '../store/userStore';
import { useSocialGraphStore } from '../store/socialGraphStore';
import { useSettingsStore } from '../store/settingsStore';
import { useChallengeStore } from '../store/challengeStore';
import { useLeaderboardStore } from '../store/leaderboardStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const DASH = '\u2014';
const docs = (list) => ({ docs: list.map(({ id, ...data }) => ({ id, data: () => data })) });

// What the "server" holds. getDocs answers from it by the path or collection asked about.
let server;
const freshServer = () => ({
  following: [{ id: 'ana', name: 'Ana' }, { id: 'ben', name: 'Ben' }, { id: 'cat', name: 'Cat' }],
  leaderboard: [
    { id: 'ana', name: 'Ana', xp: 100 }, { id: 'ben', name: 'Ben', xp: 900 }, { id: 'cat', name: 'Cat', xp: 500 },
    { id: 'u1', name: 'Cj', xp: 700 }, { id: 'stranger', name: 'Stranger', xp: 99999 },
  ],
  challenges: [],
  joins: [],
  failFollowing: false,
  failLeaderboard: false,
});
const answer = async (q) => {
  const target = q.query ? q.query[0].path || q.query[0].orderBy : q.path;
  if (q.path === 'users/u1/following') {
    if (server.failFollowing) throw new Error('offline');
    return docs(server.following);
  }
  if (q.path === 'users/u1/challengeJoins') return docs(server.joins);
  if (q.query && q.query[0].path === 'challenges') return docs(server.challenges);
  if (q.query && q.query[0].path === 'leaderboard') {
    if (server.failLeaderboard) throw new Error('offline');
    const group = q.query[1].value;
    return docs(server.leaderboard.filter((e) => group.includes(e.id)));
  }
  throw new Error(`unexpected read of ${target}`);
};
const readsOf = (path) => getDocs.mock.calls.filter(([q]) => (q.query ? q.query[0].path : q.path) === path);

const weekly = (o = {}) => ({
  id: 'w1', cadence: 'weekly', periodKey: 'week-2026-10-12', title: 'Five workouts this week', goalType: 'workout_count', goalTarget: 5,
  startDate: '2026-10-12T00:00:00.000Z', endDate: '2026-10-18T01:30:00.000Z', createdAt: '2026-10-12T00:00:00.000Z', ...o,
});
const daily = (o = {}) => ({
  id: 'd1', cadence: 'daily', periodKey: 'day-2026-10-15', title: 'One workout today', goalType: 'workout_count', goalTarget: 1,
  startDate: '2026-10-15T00:00:00.000Z', endDate: '2026-10-15T23:59:59.000Z', createdAt: '2026-10-15T00:00:00.000Z', ...o,
});
const lift = (id, when) => ({ id, completedAt: when, duration: 1800, caloriesBurned: 200 });

const settle = async () => { for (let i = 0; i < 6; i += 1) { await act(async () => {}); } };
const open = async (props = {}) => {
  const utils = render(<RankChallengeWidget {...props} />);
  await settle();
  return utils;
};
const friendsText = (utils) => [utils.getByTestId('home-rank-value').props.children, ...utils.getByTestId('home-widget-rankchallenge-friends').findAll((n) => n.type === 'Text').map((n) => n.props.children)];
const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));

let warn;
beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  server = freshServer();
  getDocs.mockReset();
  getDocs.mockImplementation(answer);
  setDoc.mockClear();
  deleteDoc.mockClear();
  router.push.mockClear();
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } });
  useSocialGraphStore.setState({ following: [], isLoaded: false, isLoading: false });
  useSettingsStore.setState({ showInLeaderboards: true });
  useChallengeStore.setState({ challenges: [], joinedChallengeIds: new Set(), isLoading: false, isGenerating: false });
  useLeaderboardStore.setState({ entries: [], audienceEntries: [] });
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
});
afterEach(() => { jest.useRealTimers(); warn.mockRestore(); });

describe('Home > Challenges & Rank: friends rank', () => {
  it('shows where you stand among the people you follow, by XP', async () => {
    const utils = await open();
    expect(friendsText(utils)).toEqual(['#2', 'Friends rank', '#2', 'of 4 by XP']); // Ben 900, you 700, Cat 500, Ana 100
  });

  it('does not count people you do not follow, however much XP they have', async () => {
    const utils = await open();
    expect(utils.getByText('of 4 by XP')).toBeTruthy(); // not 5: the stranger is on the board but not on your list
  });

  it('says it is loading until the lookup is back', async () => {
    const utils = render(<RankChallengeWidget />);
    expect(friendsText(utils)).toEqual([DASH, 'Friends rank', DASH, 'Loading']);
    await settle();
    expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
  });

  it('asks the people you follow, and you, for their entries, ten at a time', async () => {
    server.following = Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, name: `F${i}` }));
    await open();
    expect(readsOf('users/u1/following')).toHaveLength(1);
    expect(readsOf('leaderboard')).toHaveLength(2); // 13 people: 10 + 3
  });

  it('opens the Leaderboard when tapped', async () => {
    const utils = await open();
    fireEvent.press(utils.getByTestId('home-widget-rankchallenge-friends'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/leaderboard');
  });

  it('is described to a screen reader, with where a tap goes', async () => {
    const utils = await open();
    expect(utils.getByTestId('home-widget-rankchallenge-friends').props.accessibilityLabel).toBe('Friends rank: 2nd of 4 by XP. Opens the Leaderboard.');
    expect(utils.getByTestId('home-widget-rankchallenge-friends').props.accessibilityRole).toBe('button');
  });

  describe('when there is no place to show', () => {
    it('asks you to follow friends when you follow nobody, and a tap opens Friends', async () => {
      server.following = [];
      const utils = await open();
      expect(friendsText(utils)).toEqual([DASH, 'Friends rank', DASH, 'Follow friends to compare']);
      fireEvent.press(utils.getByTestId('home-widget-rankchallenge-friends'));
      expect(router.push).toHaveBeenLastCalledWith('/friends');
      expect(utils.getByTestId('home-widget-rankchallenge-friends').props.accessibilityLabel).toBe('Friends rank: follow friends to compare. Opens Friends.');
      expect(readsOf('leaderboard')).toHaveLength(0);
    });

    it('says you are not ranked when you have no entry of your own', async () => {
      server.leaderboard = server.leaderboard.filter((e) => e.id !== 'u1');
      const utils = await open();
      expect(utils.getByText('Not ranked yet')).toBeTruthy();
      expect(utils.getByTestId('home-rank-value').props.children).toBe(DASH);
    });

    it('says no friends are ranked when none of the people you follow has an entry', async () => {
      server.leaderboard = server.leaderboard.filter((e) => e.id === 'u1');
      const utils = await open();
      expect(utils.getByText('No friends ranked yet')).toBeTruthy();
    });

    it('says you are hidden when "Show in Leaderboards" is off, and does not look anything up', async () => {
      useSettingsStore.setState({ showInLeaderboards: false });
      const utils = await open();
      expect(utils.getByText('Hidden from leaderboards')).toBeTruthy();
      expect(getDocs.mock.calls.filter(([q]) => (q.query ? q.query[0].path : q.path) === 'leaderboard' || q.path === 'users/u1/following')).toHaveLength(0);
    });

    it('says it could not load when the entries cannot be read, rather than that nobody is ranked', async () => {
      server.failLeaderboard = true;
      const utils = await open();
      expect(utils.getByText("Couldn't load")).toBeTruthy();
      expect(utils.getByTestId('home-rank-value').props.children).toBe(DASH);
    });

    it('says it could not load when the list of people you follow cannot be read', async () => {
      server.failFollowing = true;
      const utils = await open();
      expect(utils.getByText("Couldn't load")).toBeTruthy();
      expect(readsOf('leaderboard')).toHaveLength(0);
    });

    it('does not look anything up when nobody is signed in', async () => {
      useUserStore.setState({ user: null });
      const utils = await open();
      expect(getDocs).not.toHaveBeenCalled();
      expect(utils.getByText('Loading')).toBeTruthy();
    });
  });

  describe('keeping up', () => {
    it('looks again, and updates, when Home is pulled down to refresh', async () => {
      const utils = await open({ refreshTick: 0 });
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
      server.leaderboard = server.leaderboard.map((e) => (e.id === 'u1' ? { ...e, xp: 2000 } : e));
      utils.rerender(<RankChallengeWidget refreshTick={1} />);
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#1');
      expect(readsOf('users/u1/following')).toHaveLength(2);
    });

    it('does not look again when it is drawn again with nothing new', async () => {
      const utils = await open({ refreshTick: 3 });
      utils.rerender(<RankChallengeWidget refreshTick={3} />);
      await settle();
      expect(readsOf('leaderboard')).toHaveLength(1);
      expect(readsOf('users/u1/following')).toHaveLength(1);
    });

    it('looks at the new list, without loading it again, when you follow someone on the Friends screen', async () => {
      server.following = [];
      const utils = await open();
      expect(utils.getByText('Follow friends to compare')).toBeTruthy();
      await act(async () => {
        useSocialGraphStore.setState({ following: [{ uid: 'ben', name: 'Ben', avatar: null, close: false, followedAt: null }] });
      });
      await settle();
      expect(friendsText(utils)).toEqual(['#2', 'Friends rank', '#2', 'of 2 by XP']); // Ben 900, you 700
      expect(readsOf('users/u1/following')).toHaveLength(1);
      expect(readsOf('leaderboard')).toHaveLength(1);
    });

    it('goes back to asking you to follow friends when you unfollow everyone', async () => {
      const utils = await open();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
      await act(async () => { useSocialGraphStore.setState({ following: [] }); });
      await settle();
      expect(utils.getByText('Follow friends to compare')).toBeTruthy();
      fireEvent.press(utils.getByTestId('home-widget-rankchallenge-friends'));
      expect(router.push).toHaveBeenLastCalledWith('/friends');
    });

    it('does not look again for a change to the list that changes nobody (a close friend starred)', async () => {
      const utils = await open();
      await act(async () => {
        useSocialGraphStore.setState({ following: useSocialGraphStore.getState().following.map((f) => ({ ...f, close: true })) });
      });
      await settle();
      expect(readsOf('leaderboard')).toHaveLength(1);
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
    });

    it('looks up your place when "Show in Leaderboards" is switched back on, and shows hidden when it is switched off', async () => {
      const utils = await open();
      await act(async () => { useSettingsStore.setState({ showInLeaderboards: false }); });
      expect(utils.getByText('Hidden from leaderboards')).toBeTruthy();
      await act(async () => { useSettingsStore.setState({ showInLeaderboards: true }); });
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
    });

    it('looks up your place when you start with "Show in Leaderboards" off and switch it on', async () => {
      useSettingsStore.setState({ showInLeaderboards: false });
      const utils = await open();
      expect(readsOf('leaderboard')).toHaveLength(0);
      await act(async () => { useSettingsStore.setState({ showInLeaderboards: true }); });
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
    });

    it('looks up your place when you sign in while the card is showing', async () => {
      useUserStore.setState({ user: null });
      const utils = await open();
      expect(getDocs).not.toHaveBeenCalled();
      await act(async () => { useUserStore.setState({ user: { uid: 'u1', name: 'Cj' } }); });
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#2');
    });

    it('does not look anything up for a change to who you follow while you are hidden', async () => {
      const utils = await open();
      await act(async () => { useSettingsStore.setState({ showInLeaderboards: false }); });
      await act(async () => { useSocialGraphStore.setState({ following: [{ uid: 'ben', name: 'Ben', avatar: null, close: false, followedAt: null }] }); });
      await settle();
      expect(readsOf('leaderboard')).toHaveLength(1);
      expect(utils.getByText('Hidden from leaderboards')).toBeTruthy();
    });

    it('does not look anything up for a change to who you follow after you have signed out', async () => {
      await open();
      await act(async () => { useUserStore.setState({ user: null }); });
      await act(async () => { useSocialGraphStore.setState({ following: [{ uid: 'ben', name: 'Ben', avatar: null, close: false, followedAt: null }] }); });
      await settle();
      expect(readsOf('leaderboard')).toHaveLength(1);
      expect(readsOf('users/u1/following')).toHaveLength(1);
    });

    it('shows the answer to the newest lookup when an older one comes back later', async () => {
      const slow = [];
      getDocs.mockImplementation((q) => {
        if (q.query && q.query[0].path === 'leaderboard') return new Promise((resolve) => { slow.push(() => answer(q).then(resolve)); });
        return answer(q);
      });
      const utils = render(<RankChallengeWidget refreshTick={0} />);
      await settle();
      expect(slow).toHaveLength(1); // the first lookup is waiting on the leaderboard
      server.leaderboard = server.leaderboard.map((e) => (e.id === 'u1' ? { ...e, xp: 2000 } : e));
      utils.rerender(<RankChallengeWidget refreshTick={1} />);
      await settle();
      expect(slow).toHaveLength(2);
      await act(async () => { slow[1](); }); // the newer lookup answers first: you are first
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#1');
      server.leaderboard = server.leaderboard.map((e) => (e.id === 'u1' ? { ...e, xp: 50 } : e));
      await act(async () => { slow[0](); }); // then the older one, with old data, which must not replace it
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#1');
    });

    it('drops an older lookup that is still waiting for the list of people you follow', async () => {
      let release;
      const original = useSocialGraphStore.getState().loadFollowing;
      let calls = 0;
      useSocialGraphStore.setState({
        loadFollowing: (uid) => {
          calls += 1;
          if (calls > 1) return original(uid);
          return new Promise((resolve) => { release = () => original(uid).then(resolve); });
        },
      });
      const utils = render(<RankChallengeWidget refreshTick={0} />);
      await settle();
      server.leaderboard = server.leaderboard.map((e) => (e.id === 'u1' ? { ...e, xp: 2000 } : e));
      utils.rerender(<RankChallengeWidget refreshTick={1} />);
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#1');
      server.leaderboard = server.leaderboard.map((e) => (e.id === 'u1' ? { ...e, xp: 50 } : e));
      await act(async () => { release(); });
      await settle();
      expect(utils.getByTestId('home-rank-value').props.children).toBe('#1');
      expect(readsOf('leaderboard')).toHaveLength(1); // the older lookup never went on to read the leaderboard
      useSocialGraphStore.setState({ loadFollowing: original });
    });
  });

  it('never changes the list the Leaderboard screen is showing', async () => {
    const shown = [{ id: 'z', name: 'Zed', xp: 9, rank: 1 }];
    useLeaderboardStore.setState({ audienceEntries: shown, entries: shown });
    await open();
    expect(useLeaderboardStore.getState().audienceEntries).toBe(shown);
    expect(useLeaderboardStore.getState().entries).toBe(shown);
  });

  it('only reads: it writes nothing for you', async () => {
    server.challenges = [daily(), weekly()];
    server.joins = [{ id: 'w1' }];
    await open();
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

describe('Home > Challenges & Rank: live challenge', () => {
  const challengeText = (utils) => utils.getByTestId('home-widget-rankchallenge-challenge').findAll((n) => n.type === 'Text').map((n) => n.props.children);
  const barWidth = (utils) => StyleSheet.flatten(utils.getByTestId('home-challenge-bar').props.style).width;

  it('shows the progress of the challenge you joined, with its title and the days left', async () => {
    server.challenges = [daily(), weekly()];
    server.joins = [{ id: 'w1' }];
    useWorkoutStore.setState({ completedWorkouts: [lift('a', '2026-10-13T15:00:00.000Z'), lift('b', '2026-10-14T15:00:00.000Z')] });
    const utils = await open();
    expect(challengeText(utils)).toEqual(['Weekly challenge', '2/5', 'Five workouts this week', '3 days left']);
    expect(barWidth(utils)).toBe('40%');
  });

  it('counts a run or a hike toward it, as the Challenges screen does', async () => {
    server.challenges = [weekly()];
    server.joins = [{ id: 'w1' }];
    useWorkoutStore.setState({ completedWorkouts: [lift('a', '2026-10-13T15:00:00.000Z')] });
    useRunningStore.setState({ runs: [{ id: 'r1', startTime: '2026-10-14T10:00:00.000Z', endTime: '2026-10-14T10:30:00.000Z', distance: 5, duration: 1800 }] });
    useHikingStore.setState({ completedHikes: [{ id: 'h1', startTime: '2026-10-14T12:00:00.000Z', completedAt: '2026-10-14T14:00:00.000Z' }] });
    const utils = await open();
    expect(utils.getByTestId('home-challenge-value').props.children).toBe('3/5');
  });

  it('does not count what was done before the challenge began', async () => {
    server.challenges = [weekly()];
    server.joins = [{ id: 'w1' }];
    useWorkoutStore.setState({ completedWorkouts: [lift('old', '2026-10-05T15:00:00.000Z')] });
    const utils = await open();
    expect(utils.getByTestId('home-challenge-value').props.children).toBe('0/5');
    expect(barWidth(utils)).toBe('0%');
  });

  it('updates as you finish workouts', async () => {
    server.challenges = [weekly()];
    server.joins = [{ id: 'w1' }];
    const utils = await open();
    expect(utils.getByTestId('home-challenge-value').props.children).toBe('0/5');
    await act(async () => { useWorkoutStore.setState({ completedWorkouts: [lift('a', '2026-10-14T15:00:00.000Z')] }); });
    expect(utils.getByTestId('home-challenge-value').props.children).toBe('1/5');
    expect(barWidth(utils)).toBe('20%');
  });

  it('says Complete, and fills the bar green, once the goal is reached', async () => {
    server.challenges = [daily()];
    server.joins = [{ id: 'd1' }];
    useWorkoutStore.setState({ completedWorkouts: [lift('a', '2026-10-15T00:30:00.000Z')] });
    const utils = await open();
    expect(challengeText(utils)).toEqual(['Daily challenge', '1/1', 'One workout today', 'Complete']);
    expect(StyleSheet.flatten(utils.getByTestId('home-challenge-bar').props.style)).toMatchObject({ width: '100%', backgroundColor: '#22C55E' });
  });

  it('draws an unfinished bar in black', async () => {
    server.challenges = [weekly()];
    server.joins = [{ id: 'w1' }];
    const utils = await open();
    expect(StyleSheet.flatten(utils.getByTestId('home-challenge-bar').props.style).backgroundColor).toBe('#000');
  });

  it('suggests the weekly challenge when you have joined none, and has no bar', async () => {
    server.challenges = [daily(), weekly()];
    const utils = await open();
    expect(challengeText(utils)).toEqual(['Weekly challenge', 'Join', 'Five workouts this week', 'Tap to join']);
    expect(utils.queryByTestId('home-challenge-bar')).toBeNull();
  });

  it('does not show a challenge from an earlier week', async () => {
    server.challenges = [weekly({ periodKey: 'week-2026-10-05' })];
    server.joins = [{ id: 'w1' }];
    const utils = await open();
    expect(challengeText(utils)).toEqual(['Challenges', DASH, 'Open Challenges']);
  });

  it('says there is no live challenge, with a way to the Challenges screen, when there are none', async () => {
    const utils = await open();
    expect(challengeText(utils)).toEqual(['Challenges', DASH, 'Open Challenges']);
    expect(utils.queryByTestId('home-challenge-title')).toBeNull();
    expect(utils.queryByTestId('home-challenge-bar')).toBeNull();
  });

  it('opens Challenges when tapped, whatever it shows', async () => {
    for (const setup of [() => {}, () => { server.challenges = [weekly()]; }, () => { server.challenges = [weekly()]; server.joins = [{ id: 'w1' }]; }]) {
      server = freshServer();
      useChallengeStore.setState({ challenges: [], joinedChallengeIds: new Set() });
      setup();
      const utils = await open();
      router.push.mockClear();
      fireEvent.press(utils.getByTestId('home-widget-rankchallenge-challenge'));
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/challenges');
      utils.unmount();
    }
  });

  it('is described to a screen reader, with where a tap goes', async () => {
    server.challenges = [weekly()];
    server.joins = [{ id: 'w1' }];
    const utils = await open();
    expect(utils.getByTestId('home-widget-rankchallenge-challenge').props.accessibilityLabel).toBe(
      'Weekly challenge: Five workouts this week, 0 of 5, 3 days left. Opens Challenges.',
    );
  });

  it('loads the challenges and what you have joined, for you, when it appears and when Home is refreshed', async () => {
    server.challenges = [weekly()];
    const utils = await open({ refreshTick: 0 });
    expect(readsOf('challenges')).toHaveLength(1);
    expect(readsOf('users/u1/challengeJoins')).toHaveLength(1);
    utils.rerender(<RankChallengeWidget refreshTick={1} />);
    await settle();
    expect(readsOf('challenges')).toHaveLength(2);
  });

  it('does not ask the server to make new challenges, join you to one or publish your progress', async () => {
    const generate = jest.fn();
    const join = jest.fn();
    const publish = jest.fn();
    useChallengeStore.setState({ generateNewChallenges: generate, joinChallenge: join, publishMyProgress: publish });
    await open();
    expect(generate).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not load challenges when nobody is signed in', async () => {
    useUserStore.setState({ user: null });
    await open();
    expect(readsOf('challenges')).toHaveLength(0);
  });
});

describe('Home > Challenges & Rank: the card', () => {
  it('is one card with two halves, a friends icon and a flag icon', async () => {
    const utils = await open();
    expect(utils.getByTestId('home-widget-rankchallenge')).toBeTruthy();
    expect(utils.getByTestId('home-widget-rankchallenge-friends')).toBeTruthy();
    expect(utils.getByTestId('home-widget-rankchallenge-challenge')).toBeTruthy();
    expect(iconNames(utils).filter((n) => n !== 'chevron-forward')).toEqual(['people-outline', 'flag-outline']);
    expect(utils.getByText('Friends rank')).toBeTruthy();
  });

  it('keeps each half to its own tap', async () => {
    const utils = await open();
    fireEvent.press(utils.getByTestId('home-widget-rankchallenge-friends'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenLastCalledWith('/leaderboard');
    fireEvent.press(utils.getByTestId('home-widget-rankchallenge-challenge'));
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenLastCalledWith('/challenges');
  });
});

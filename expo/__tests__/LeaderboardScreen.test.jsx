import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => ({ Trophy: 'Trophy' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/AudienceFilter', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PersonSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/leaderboardStore', () => ({ useLeaderboardStore: () => global.__lb }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/socialGraphStore', () => ({
  useSocialGraphStore: (select) => select({ following: [{ uid: 'friend', close: true }] }),
}));
jest.mock('@/store/useAudience', () => ({ useAudience: () => global.__audience }));
jest.mock('@/services/distanceBoard', () => ({
  publishMyDistance: (...args) => global.__publish(...args),
}));

import LeaderboardScreen from '../app/leaderboard';
import { periodKeys } from '../lib/runLeaderboard';

const keys = periodKeys();

const people = [
  { id: 'a', name: 'Ana', xp: 1200, distance: { [keys.week]: 21.37, [keys.month]: 40 } },
  { id: 'b', name: 'Ben', xp: 800, distance: { [keys.week]: 12.4, [keys.month]: 130.2 } },
  { id: 'c', name: 'Cat', xp: 500, distance: { [keys.week]: 3 } },
  { id: 'u1', name: 'Cj', xp: 100, distance: { [keys.week]: 1.25 } },
];

const setup = (extra = {}) => {
  global.__user = { uid: 'u1', name: 'Cj' };
  global.__publish = jest.fn(async () => true);
  global.__audience = { audience: 'everyone', setAudience: jest.fn(), uids: null, uidKey: '' };
  global.__lb = {
    entries: people,
    audienceEntries: [],
    isLoading: false,
    isLoadingAudience: false,
    subscribeTop: jest.fn(),
    unsubscribe: jest.fn(),
    computeMyRank: jest.fn(),
    loadForUids: jest.fn(),
    ...extra,
  };
  return render(<LeaderboardScreen />);
};

describe('LeaderboardScreen', () => {
  it('opens on the XP board, as it always has', () => {
    const utils = setup();
    expect(global.__lb.subscribeTop).toHaveBeenCalledWith(50, 'xp');
    expect(utils.getByText('1200')).toBeTruthy(); // podium: plain XP number
    expect(utils.getByText('Ana')).toBeTruthy();
    expect(utils.queryByTestId('board-week')).toBeNull();
  });

  it('lists the rest of the XP board after the podium', () => {
    const utils = setup();
    expect(utils.getByText('Cj')).toBeTruthy();
    expect(utils.getByText('100')).toBeTruthy();
  });

  it('puts this person\'s weekly distance on the board when it opens', () => {
    setup();
    expect(global.__publish).toHaveBeenCalledWith({ user: global.__user, loadFirst: true });
  });

  it('does not publish anything when nobody is signed in', () => {
    global.__publish = jest.fn();
    global.__user = null;
    global.__lb = {
      entries: [], audienceEntries: [], isLoading: false, isLoadingAudience: false,
      subscribeTop: jest.fn(), unsubscribe: jest.fn(), computeMyRank: jest.fn(), loadForUids: jest.fn(),
    };
    global.__audience = { audience: 'everyone', setAudience: jest.fn(), uids: null, uidKey: '' };
    render(<LeaderboardScreen />);
    expect(global.__publish).not.toHaveBeenCalled();
  });

  it('switches to this week\'s distance and shows kilometres', () => {
    const utils = setup();
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(global.__lb.subscribeTop).toHaveBeenLastCalledWith(50, 'week');
    expect(global.__lb.unsubscribe).toHaveBeenCalled(); // the XP subscription was dropped
    expect(utils.getByText('21.4 km')).toBeTruthy();
    expect(utils.getByText('12.4 km')).toBeTruthy();
    expect(utils.getByText('3.0 km')).toBeTruthy();
    expect(utils.getByText('1.3 km')).toBeTruthy();
    expect(utils.getByTestId('board-week').props.accessibilityState.selected).toBe(true);
  });

  it('switches to this month, with whole kilometres from 100', () => {
    const utils = setup();
    fireEvent.press(utils.getByTestId('board-distance'));
    fireEvent.press(utils.getByTestId('board-month'));
    expect(global.__lb.subscribeTop).toHaveBeenLastCalledWith(50, 'month');
    expect(utils.getByText('130 km')).toBeTruthy();
    expect(utils.getByText('40.0 km')).toBeTruthy();
  });

  it('goes back to XP', () => {
    const utils = setup();
    fireEvent.press(utils.getByTestId('board-distance'));
    fireEvent.press(utils.getByTestId('board-xp'));
    expect(global.__lb.subscribeTop).toHaveBeenLastCalledWith(50, 'xp');
    expect(utils.getByText('1200')).toBeTruthy();
  });

  it('says nobody has logged a run yet on an empty distance board', () => {
    const utils = setup({ entries: [] });
    expect(utils.getByText('No rankings yet — complete a workout to be the first on the board.')).toBeTruthy();
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(utils.getByText('Nobody has logged a run or walk this week yet. Record one to get on the board.')).toBeTruthy();
    fireEvent.press(utils.getByTestId('board-month'));
    expect(utils.getByText('Nobody has logged a run or walk this month yet. Record one to get on the board.')).toBeTruthy();
  });

  it('asks for the friends\' entries on the board that is showing', () => {
    global.__user = { uid: 'u1' };
    const utils = setup();
    global.__audience = { audience: 'following', setAudience: jest.fn(), uids: ['friend'], uidKey: 'friend' };
    utils.rerender(<LeaderboardScreen />);
    expect(global.__lb.loadForUids).toHaveBeenLastCalledWith(['friend'], 'u1', 'xp');
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(global.__lb.loadForUids).toHaveBeenLastCalledWith(['friend'], 'u1', 'week');
  });

  it('shows a friends board by distance, using the friends list', () => {
    const utils = setup();
    global.__audience = { audience: 'following', setAudience: jest.fn(), uids: ['a'], uidKey: 'a' };
    global.__lb.audienceEntries = [people[1], people[0]];
    utils.rerender(<LeaderboardScreen />);
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(utils.getByText('21.4 km')).toBeTruthy();
    expect(utils.queryByText('3.0 km')).toBeNull(); // Cat is not in this list
  });
});

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// The two run features on the Social screen: run cards in the feed, and the
// XP / Distance picker on the Leaderboard tab.

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/components/AudienceFilter', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PersonSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PostMedia', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PostComposer', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/RunRouteMap', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: () => mockReact.createElement(mockRn.View, { testID: 'route-map' }),
    hasNativeMap: () => false,
  };
});
jest.mock('@/store/communityStore', () => ({ useCommunityStore: () => global.__community }));
jest.mock('@/store/leaderboardStore', () => ({ useLeaderboardStore: () => global.__lb }));
jest.mock('@/store/duelStore', () => ({
  DUEL_PRESETS: [],
  useDuelStore: () => ({
    duels: [], subscribeDuels: jest.fn(), unsubscribeDuels: jest.fn(), proposeDuel: jest.fn(),
    acceptDuel: jest.fn(), declineDuel: jest.fn(), getDisplayStatus: jest.fn(),
  }),
}));
jest.mock('@/store/groupStore', () => ({
  useGroupStore: () => ({ groups: [], joinedGroupIds: [], loadGroups: jest.fn(), joinGroup: jest.fn(), leaveGroup: jest.fn() }),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', name: 'Cj' } }) }));
jest.mock('@/store/messagingStore', () => ({ getConversationId: jest.fn() }));
jest.mock('@/store/socialGraphStore', () => ({
  useSocialGraphStore: (select) => select({ following: [] }),
}));
jest.mock('@/store/useAudience', () => ({
  useAudience: () => ({ audience: 'everyone', setAudience: jest.fn(), uids: null, uidKey: '', follows: [] }),
}));
jest.mock('@/services/distanceBoard', () => ({
  publishMyDistance: (...args) => global.__publish(...args),
}));

import SocialScreen from '../app/social';
import { periodKeys } from '../lib/runLeaderboard';

const keys = periodKeys();

const runPost = {
  id: 'post-1', authorId: 'u2', authorName: 'Ana', text: 'Morning Run: 5.23 km in 26:50',
  type: 'run', likeCount: 0, commentCount: 0, shareCount: 0, media: [],
  run: {
    v: 1, activity: 'run', title: 'Morning Run', distance: 5.23, duration: 1610, pace: 308,
    route: [40.002, -74, 40.01, -74, 40.018, -74], elevGain: 42,
  },
};
const plainPost = { id: 'post-2', authorId: 'u3', authorName: 'Ben', text: 'Leg day done', type: 'general', likeCount: 0, commentCount: 0, shareCount: 0, media: [] };

const setup = ({ posts = [plainPost, runPost], entries = [] } = {}) => {
  global.__publish = jest.fn(async () => true);
  global.__community = {
    posts, isLoading: false, subscribeFeed: jest.fn(), unsubscribeFeed: jest.fn(), createPost: jest.fn(),
    updatePost: jest.fn(), updatePostSettings: jest.fn(), deletePost: jest.fn(), toggleLike: jest.fn(),
    hasLiked: jest.fn(async () => false), loadComments: jest.fn(async () => []), addComment: jest.fn(),
  };
  global.__lb = {
    entries, audienceEntries: [], isLoadingAudience: false,
    subscribeTop: jest.fn(), unsubscribe: jest.fn(), loadForUids: jest.fn(),
  };
  return render(<SocialScreen />);
};

describe('Social feed', () => {
  it('shows a shared run as a run card, with its stats', async () => {
    const utils = setup();
    await act(async () => {});
    expect(utils.getAllByTestId('run-post-card')).toHaveLength(1);
    expect(utils.getByTestId('run-post-title').props.children).toBe('Morning Run');
    expect(utils.getByTestId('run-post-privacy').props.children).toBe('First and last 200 m hidden');
  });

  it('shows an ordinary post with no run card', async () => {
    const utils = setup({ posts: [plainPost] });
    await act(async () => {});
    expect(utils.getByText('Leg day done')).toBeTruthy();
    expect(utils.queryByTestId('run-post-card')).toBeNull();
  });

  it('keeps the people search on XP while the feed is showing', async () => {
    setup();
    await act(async () => {});
    expect(global.__lb.subscribeTop).toHaveBeenLastCalledWith(50, 'xp');
  });
});

describe('Social leaderboard tab', () => {
  const openLeaderboard = async (entries) => {
    const utils = setup({ entries });
    await act(async () => {});
    fireEvent.press(utils.getByText('Leaderboard'));
    return utils;
  };
  const entries = [
    { id: 'a', name: 'Ana', xp: 1200, distance: { [keys.week]: 21.37, [keys.month]: 40 } },
    { id: 'b', name: 'Ben', xp: 800, distance: { [keys.week]: 12.4, [keys.month]: 130.2 } },
  ];

  it('opens on XP with the picker above the list', async () => {
    const utils = await openLeaderboard(entries);
    expect(utils.getByText('1,200 XP')).toBeTruthy();
    expect(utils.getByTestId('board-xp')).toBeTruthy();
    expect(utils.getByTestId('board-distance')).toBeTruthy();
  });

  it('ranks by this week\'s distance, then this month\'s', async () => {
    const utils = await openLeaderboard(entries);
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(global.__lb.subscribeTop).toHaveBeenLastCalledWith(50, 'week');
    expect(utils.getByText('21.4 km')).toBeTruthy();
    expect(utils.getByText('12.4 km')).toBeTruthy();
    fireEvent.press(utils.getByTestId('board-month'));
    expect(global.__lb.subscribeTop).toHaveBeenLastCalledWith(50, 'month');
    expect(utils.getByText('130 km')).toBeTruthy();
  });

  it('says so when nobody has logged any distance', async () => {
    const utils = await openLeaderboard([]);
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(utils.getByText('Nobody has logged a run or walk this week yet. Record one to get on the board.')).toBeTruthy();
  });

  it('goes back to the XP list for the people search when the tab is left', async () => {
    const utils = await openLeaderboard(entries);
    fireEvent.press(utils.getByTestId('board-distance'));
    fireEvent.press(utils.getByText('Feed'));
    expect(global.__lb.subscribeTop).toHaveBeenLastCalledWith(50, 'xp');
  });

  it('puts this person\'s distance on the board when the screen opens', async () => {
    setup();
    await act(async () => {});
    expect(global.__publish).toHaveBeenCalledWith({ user: { uid: 'u1', name: 'Cj' }, loadFirst: true });
  });
});

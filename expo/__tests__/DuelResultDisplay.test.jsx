// Social > Duels: a duel that is over says what the server settled (a win, a loss or a draw), and one whose date has passed that the server
// has not settled yet says its result is coming rather than working one out on the phone.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
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
jest.mock('@/components/RunRouteMap', () => ({ __esModule: true, default: () => null, hasNativeMap: () => false }));
jest.mock('@/store/communityStore', () => ({ useCommunityStore: () => global.__community }));
jest.mock('@/store/leaderboardStore', () => ({ useLeaderboardStore: () => global.__lb }));
jest.mock('@/store/duelStore', () => ({
  DUEL_PRESETS: [],
  useDuelStore: () => ({
    duels: global.__duels, subscribeDuels: jest.fn(), unsubscribeDuels: jest.fn(), proposeDuel: jest.fn(),
    acceptDuel: jest.fn(), declineDuel: jest.fn(),
    // the real thing the screen uses to say what a duel's state is
    getDisplayStatus: (...a) => jest.requireActual('../store/duelStore').useDuelStore.getState().getDisplayStatus(...a),
  }),
}));
jest.mock('@/store/groupStore', () => ({
  useGroupStore: () => ({ groups: [], joinedGroupIds: [], loadGroups: jest.fn(), joinGroup: jest.fn(), leaveGroup: jest.fn() }),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', name: 'Cj' } }) }));
jest.mock('@/store/messagingStore', () => ({ getConversationId: jest.fn() }));
jest.mock('@/store/socialGraphStore', () => ({ useSocialGraphStore: (select) => select({ following: [] }) }));
jest.mock('@/store/useAudience', () => ({
  useAudience: () => ({ audience: 'everyone', setAudience: jest.fn(), uids: null, uidKey: '', follows: [] }),
}));
jest.mock('@/services/leaderboardVisibility', () => ({ publishMyProfile: jest.fn(async () => true) }));

import SocialScreen from '../app/social';

const PAST = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const duel = (over = {}) => ({
  id: 'd1', label: 'Most Workouts This Week', participantIds: ['u1', 'u2'], participantNames: { u1: 'Cj', u2: 'Ana' },
  progress: { u1: 3, u2: 2 }, mode: 'most_by_deadline', type: 'workout_count', status: 'active', endDate: FUTURE, ...over,
});

const openDuels = async (duels) => {
  global.__duels = duels;
  global.__community = {
    posts: [], isLoading: false, subscribeFeed: jest.fn(), unsubscribeFeed: jest.fn(), createPost: jest.fn(), updatePost: jest.fn(),
    updatePostSettings: jest.fn(), deletePost: jest.fn(), toggleLike: jest.fn(), hasLiked: jest.fn(async () => false),
    loadComments: jest.fn(async () => []), addComment: jest.fn(),
  };
  global.__lb = { entries: [], audienceEntries: [], isLoadingAudience: false, subscribeTop: jest.fn(), unsubscribe: jest.fn(), loadForUids: jest.fn() };
  const utils = render(<SocialScreen />);
  await act(async () => {});
  fireEvent.press(utils.getByText('Duels'));
  return utils;
};

describe('Social > Duels', () => {
  it('says "You won!" for a duel the server settled in the person\'s favour', async () => {
    const utils = await openDuels([duel({ status: 'completed', winnerId: 'u1', tied: false, endDate: PAST })]);
    expect(utils.getByText('You won!')).toBeTruthy();
    expect(utils.queryByText('Draw')).toBeNull();
  });

  it('says "You lost" for one the server settled for the other person', async () => {
    const utils = await openDuels([duel({ status: 'completed', winnerId: 'u2', tied: false, endDate: PAST })]);
    expect(utils.getByText('You lost')).toBeTruthy();
  });

  it('says "Draw" for one the server settled as a tie, never a loss', async () => {
    const utils = await openDuels([duel({ status: 'completed', winnerId: null, tied: true, progress: { u1: 2, u2: 2 }, endDate: PAST })]);
    expect(utils.getByText('Draw')).toBeTruthy();
    expect(utils.queryByText('You lost')).toBeNull();
    expect(utils.queryByText('You won!')).toBeNull();
  });

  it('does not say who won a deadline duel the server has not settled yet, however the scores stand', async () => {
    const utils = await openDuels([duel({ status: 'active', endDate: PAST, progress: { u1: 9, u2: 0 } })]);
    expect(utils.getByText('Final result soon')).toBeTruthy();
    expect(utils.queryByText('You won!')).toBeNull();
    expect(utils.queryByText('You lost')).toBeNull();
  });

  it('shows the scores and the time left, and no result, for a duel still running', async () => {
    const utils = await openDuels([duel()]);
    expect(utils.getByText(/You: 3\s+·\s+Them: 2/)).toBeTruthy();
    expect(utils.queryByText('You won!')).toBeNull();
    expect(utils.queryByText('Draw')).toBeNull();
    expect(utils.queryByText('Final result soon')).toBeNull();
  });
});

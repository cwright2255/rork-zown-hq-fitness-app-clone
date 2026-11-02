// The heart on the Social screen's feed (app/social.jsx): a double tap is one like, and the number does not lag behind the heart.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: (props) => mockReact.createElement(mockRn.Text, null, `icon:${props.name}`) };
}, { virtual: true });
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
jest.mock('@/components/RunPostCard', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/communityStore', () => ({ useCommunityStore: Object.assign(() => global.__community, { getState: () => global.__community }) }));
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
jest.mock('@/store/socialGraphStore', () => ({ useSocialGraphStore: (select) => select({ following: [] }) }));
jest.mock('@/store/useAudience', () => ({
  useAudience: () => ({ audience: 'everyone', setAudience: jest.fn(), uids: null, uidKey: '', follows: [] }),
}));
jest.mock('@/services/leaderboardVisibility', () => ({ publishMyProfile: jest.fn(async () => true) }));
jest.mock('@/store/blockStore', () => {
  const state = { subscribeBlocks: jest.fn(), blockUser: jest.fn(async () => true), unblockUser: jest.fn(async () => true) };
  const hook = (select) => select({ ...state, blocked: global.__blocked });
  hook.getState = () => state;
  return { useBlockStore: hook };
});
jest.mock('@/services/reportService', () => ({ submitReport: jest.fn(async () => ({ status: 'sent' })) }));

import SocialScreen from '../app/social';

const post = (extra = {}) => ({
  id: 'p1', authorId: 'u2', authorName: 'Ana Cruz', text: 'Morning miles', type: 'general', likeCount: 3, commentCount: 1, shareCount: 0, media: [], ...extra,
});

const setup = ({ toggleLike, posts = [post()] } = {}) => {
  global.__blocked = {};
  global.__community = {
    posts, isLoading: false, subscribeFeed: jest.fn(), unsubscribeFeed: jest.fn(), createPost: jest.fn(),
    updatePost: jest.fn(), updatePostSettings: jest.fn(), deletePost: jest.fn(), toggleLike: toggleLike || jest.fn(async () => true),
    hasLiked: jest.fn(async () => false), loadComments: jest.fn(async () => []), addComment: jest.fn(), deleteComment: jest.fn(),
  };
  global.__lb = {
    entries: [], audienceEntries: [], isLoadingAudience: false, subscribeTop: jest.fn(), unsubscribe: jest.fn(), loadForUids: jest.fn(),
  };
  return render(<SocialScreen />);
};
const settle = () => act(async () => {});
const heart = (utils, id = 'p1') => utils.getByTestId(`like-${id}`);
const tap = (utils) => act(async () => { fireEvent.press(heart(utils)); });

beforeEach(() => { jest.clearAllMocks(); });

describe('the heart on a post', () => {
  it('shows the number the feed has', async () => {
    const utils = setup();
    await settle();
    expect(utils.getByText('3')).toBeTruthy();
  });

  it('turns to a filled heart and takes the number up by one at once', async () => {
    const utils = setup();
    await settle();
    expect(utils.getByText('icon:heart-outline')).toBeTruthy();
    await tap(utils);
    expect(global.__community.toggleLike).toHaveBeenCalledWith('p1', 'u1');
    expect(utils.getByText('icon:heart')).toBeTruthy();
    expect(utils.getByText('4')).toBeTruthy();
  });

  it('is one like for a double tap: the second tap, while the first is being written, does nothing', async () => {
    let finish;
    const toggleLike = jest.fn(() => new Promise((resolve) => { finish = () => resolve(true); }));
    const utils = setup({ toggleLike });
    await settle();
    await act(async () => {
      fireEvent.press(heart(utils));
      fireEvent.press(heart(utils));
    });
    expect(toggleLike).toHaveBeenCalledTimes(1);
    expect(utils.getByText('4')).toBeTruthy();
    await act(async () => { finish(); });
    expect(utils.getByText('icon:heart')).toBeTruthy();
    expect(utils.getByText('4')).toBeTruthy();
  });

  it('goes back to an empty heart and the real number when the like could not be written', async () => {
    const utils = setup({ toggleLike: jest.fn(async () => null) });
    await settle();
    await tap(utils);
    expect(utils.getByText('icon:heart-outline')).toBeTruthy();
    expect(utils.getByText('3')).toBeTruthy();
  });

  it('does not add the like a second time once the feed has the new count', async () => {
    const utils = setup();
    await settle();
    await tap(utils);
    global.__community.posts = [post({ likeCount: 4 })];
    utils.rerender(<SocialScreen />);
    expect(utils.getByText('4')).toBeTruthy();
    expect(utils.queryByText('5')).toBeNull();
  });
});

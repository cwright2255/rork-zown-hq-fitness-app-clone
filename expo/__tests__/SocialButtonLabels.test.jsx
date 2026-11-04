// What VoiceOver says for the icon buttons on the Social screen (app/social.jsx), on the rendered screen: the label is the name the button is
// found by, and the ones that change with the screen (like / unlike, the numbers on a post) change with it. That every icon-only button
// has a label at all is checked from the source in iconButtonLabels.test.js; what VoiceOver really says is checked on the phone.
import React from 'react';
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
  id: 'p1', authorId: 'u2', authorName: 'Ana Cruz', text: 'Morning miles', type: 'general', likeCount: 3, commentCount: 1, shareCount: 2, media: [], ...extra,
});

const setup = (posts = [post()]) => {
  global.__blocked = {};
  global.__community = {
    posts, isLoading: false, subscribeFeed: jest.fn(), unsubscribeFeed: jest.fn(), createPost: jest.fn(),
    updatePost: jest.fn(), updatePostSettings: jest.fn(), deletePost: jest.fn(), toggleLike: jest.fn(async () => true),
    hasLiked: jest.fn(async () => false), loadComments: jest.fn(async () => []), addComment: jest.fn(), deleteComment: jest.fn(),
  };
  global.__lb = {
    entries: [], audienceEntries: [], isLoadingAudience: false, subscribeTop: jest.fn(), unsubscribe: jest.fn(), loadForUids: jest.fn(),
  };
  return render(<SocialScreen />);
};
const settle = () => act(async () => {});
const button = (utils, name) => utils.getByRole('button', { name });

beforeEach(() => { jest.clearAllMocks(); });

describe('the top of the screen', () => {
  it('has Messages and New post, each found as a button by what it does', async () => {
    const utils = setup();
    await settle();
    expect(button(utils, 'Messages')).toBeTruthy();
    expect(button(utils, 'New post')).toBeTruthy();
  });
});

describe('the buttons on a post', () => {
  it('says Like with the number of likes, and Unlike with the new number once it is liked', async () => {
    const utils = setup();
    await settle();
    expect(button(utils, 'Like').props.accessibilityValue).toEqual({ text: '3' });
    await act(async () => { fireEvent.press(button(utils, 'Like')); });
    expect(utils.queryByRole('button', { name: 'Like' })).toBeNull();
    expect(button(utils, 'Unlike').props.accessibilityValue).toEqual({ text: '4' });
  });

  it('keeps the number of likes to itself when the author has hidden it', async () => {
    const utils = setup([post({ likesHidden: true })]);
    await settle();
    expect(button(utils, 'Like').props.accessibilityValue.text).toBeUndefined();
  });

  it('says Comments with the number of comments, and Off when they are turned off', async () => {
    const utils = setup([post({ id: 'p1', commentCount: 5 }), post({ id: 'p2', commentsDisabled: true })]);
    await settle();
    const [on, off] = utils.getAllByRole('button', { name: 'Comments' });
    expect(on.props.accessibilityValue).toEqual({ text: '5' });
    expect(off.props.accessibilityValue).toEqual({ text: 'Off' });
  });

  it('says Share with the number of shares, and keeps the number to itself when it is hidden', async () => {
    const utils = setup([post({ id: 'p1', shareCount: 2 }), post({ id: 'p2', shareCountHidden: true })]);
    await settle();
    const [shown, hidden] = utils.getAllByRole('button', { name: 'Share' });
    expect(shown.props.accessibilityValue).toEqual({ text: '2' });
    expect(hidden.props.accessibilityValue.text).toBeUndefined();
  });

  it('says Report or block on someone else\'s post and Post options on your own', async () => {
    const utils = setup([post({ id: 'p1', authorId: 'u2' }), post({ id: 'p2', authorId: 'u1', authorName: 'Cj' })]);
    await settle();
    expect(utils.getAllByRole('button', { name: 'Report or block' })).toHaveLength(1);
    expect(utils.getAllByRole('button', { name: 'Post options' })).toHaveLength(1);
  });
});

describe('the search box', () => {
  it('has a Clear search button only once something is typed', async () => {
    const utils = setup();
    await settle();
    expect(utils.queryByRole('button', { name: 'Clear search' })).toBeNull();
    fireEvent.changeText(utils.getByPlaceholderText('Search people or topics'), 'ana');
    expect(button(utils, 'Clear search')).toBeTruthy();
  });
});

describe('the comments sheet', () => {
  it('has Close comments and Send comment', async () => {
    const utils = setup();
    await settle();
    await act(async () => { fireEvent.press(button(utils, 'Comments')); });
    expect(button(utils, 'Close comments')).toBeTruthy();
    expect(button(utils, 'Send comment')).toBeTruthy();
  });
});

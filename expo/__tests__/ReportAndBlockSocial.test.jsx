// Report, Block, Delete comment and the word list on the Social screen's feed (app/social.jsx).
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
import { contentNotAllowedError, NOT_ALLOWED_MESSAGE } from '../lib/wordFilter';
import { submitReport } from '../services/reportService';
import { useBlockStore } from '../store/blockStore';

const post = (extra = {}) => ({
  id: 'p1', authorId: 'u2', authorName: 'Ana Cruz', text: 'Morning miles', type: 'general', likeCount: 0, commentCount: 1, shareCount: 0, media: [], ...extra,
});
const comment = (extra = {}) => ({ id: 'c1', authorId: 'u3', authorName: 'Ben Ode', text: 'Strong pace', ...extra });

const setup = ({ posts = [post()], comments = [], blocked = {}, entries = [] } = {}) => {
  global.__blocked = blocked;
  global.__community = {
    posts, isLoading: false, subscribeFeed: jest.fn(), unsubscribeFeed: jest.fn(), createPost: jest.fn(),
    updatePost: jest.fn(async () => true), updatePostSettings: jest.fn(), deletePost: jest.fn(), toggleLike: jest.fn(),
    hasLiked: jest.fn(async () => false), loadComments: jest.fn(async () => comments), addComment: jest.fn(async () => 'c-new'),
    deleteComment: jest.fn(async () => true),
  };
  global.__lb = {
    entries, audienceEntries: [], isLoadingAudience: false, subscribeTop: jest.fn(), unsubscribe: jest.fn(), loadForUids: jest.fn(),
  };
  return render(<SocialScreen />);
};
const settle = () => act(async () => {});
const press = (utils, testID) => act(async () => { fireEvent.press(utils.getByTestId(testID)); });
const lastAlertButtons = () => Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][2];
const openComments = async (utils) => { await act(async () => { fireEvent.press(utils.getByText('1')); }); };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { Alert.alert.mockRestore(); });

describe('Social feed: posts', () => {
  it('follows who the person has blocked', async () => {
    setup();
    await settle();
    expect(useBlockStore.getState().subscribeBlocks).toHaveBeenCalledWith('u1');
  });

  it('has the three dots on other people\'s posts and, on your own post, the menu it always had', async () => {
    const utils = setup({ posts: [post(), post({ id: 'p2', authorId: 'u1', authorName: 'Cj', text: 'Mine' })] });
    await settle();
    expect(utils.getByTestId('post-more-p1')).toBeTruthy();
    expect(utils.queryByTestId('post-more-p2')).toBeNull();
    expect(utils.getAllByText('icon:ellipsis-vertical')).toHaveLength(2); // one each; yours opens the Edit / Delete menu
  });

  it('reports a post with its place and words', async () => {
    const utils = setup();
    await settle();
    await press(utils, 'post-more-p1');
    expect(utils.getByText('Report post')).toBeTruthy();
    expect(utils.getByText('Block Ana Cruz')).toBeTruthy();
    await press(utils, 'mod-report');
    await press(utils, 'mod-reason-sexual');
    expect(submitReport).toHaveBeenCalledWith({
      reporterId: 'u1', kind: 'post', targetId: 'p1', targetPath: 'communityPosts/p1', targetAuthorId: 'u2', reason: 'sexual', text: 'Morning miles',
    });
  });

  it('blocks the author after asking', async () => {
    const utils = setup();
    await settle();
    await press(utils, 'post-more-p1');
    await press(utils, 'mod-block');
    await act(async () => { await lastAlertButtons().find((b) => b.text === 'Block').onPress(); });
    expect(useBlockStore.getState().blockUser).toHaveBeenCalledWith({ myUid: 'u1', uid: 'u2', name: 'Ana Cruz', avatar: null });
  });

  it('hides the posts of blocked people, and keeps the rest', async () => {
    const utils = setup({
      posts: [post(), post({ id: 'p3', authorId: 'u4', authorName: 'Dee Fox', text: 'Hill repeats' })],
      blocked: { u2: { uid: 'u2', name: 'Ana Cruz' } },
    });
    await settle();
    expect(utils.queryByText('Morning miles')).toBeNull();
    expect(utils.getByText('Hill repeats')).toBeTruthy();
  });

  it('does not find a blocked person in the people search, which leads to messaging them', async () => {
    const entries = [{ id: 'u2', name: 'Ana Cruz', xp: 10 }, { id: 'u5', name: 'Ana Lyn', xp: 5 }];
    const utils = setup({ entries, blocked: { u2: { uid: 'u2', name: 'Ana Cruz' } } });
    await settle();
    fireEvent.changeText(utils.getByPlaceholderText('Search people or topics'), 'ana');
    expect(utils.getByText('Ana Lyn')).toBeTruthy();
    expect(utils.queryByText('Ana Cruz')).toBeNull();
  });
});

describe('Social feed: comments', () => {
  it('hides a blocked person\'s comments', async () => {
    const utils = setup({
      comments: [comment(), comment({ id: 'c2', authorId: 'u2', authorName: 'Ana Cruz', text: 'Hidden words' })],
      blocked: { u2: { uid: 'u2', name: 'Ana Cruz' } },
      posts: [post({ authorId: 'u9', authorName: 'Fay Poe' })],
    });
    await settle();
    await openComments(utils);
    expect(utils.getByText('Strong pace')).toBeTruthy();
    expect(utils.queryByText('Hidden words')).toBeNull();
  });

  it('reports a comment from its three dots', async () => {
    const utils = setup({ comments: [comment()] });
    await settle();
    await openComments(utils);
    await press(utils, 'comment-more-c1');
    expect(utils.getByText('Report comment')).toBeTruthy();
    expect(utils.queryByText('Delete comment')).toBeNull();
    await press(utils, 'mod-report');
    await press(utils, 'mod-reason-violence');
    expect(submitReport).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'comment', targetId: 'c1', targetPath: 'communityPosts/p1/comments/c1', targetAuthorId: 'u3', reason: 'violence', text: 'Strong pace',
    }));
  });

  it('lets the owner of the post delete someone else\'s comment, which then leaves the list', async () => {
    const utils = setup({ posts: [post({ authorId: 'u1', authorName: 'Cj' })], comments: [comment(), comment({ id: 'c2', authorId: 'u4', authorName: 'Ola', text: 'Another' })] });
    await settle();
    await openComments(utils);
    await press(utils, 'comment-more-c1');
    await press(utils, 'mod-delete');
    await act(async () => { await lastAlertButtons().find((b) => b.text === 'Delete').onPress(); });
    expect(global.__community.deleteComment).toHaveBeenCalledWith('p1', 'c1');
    expect(utils.queryByText('Strong pace')).toBeNull();
    expect(utils.getByText('Another')).toBeTruthy();
  });

  it('says why when the word list turns a comment away', async () => {
    const utils = setup({ comments: [] });
    await settle();
    global.__community.addComment.mockRejectedValue(contentNotAllowedError());
    await openComments(utils);
    fireEvent.changeText(utils.getByPlaceholderText('Add a comment...'), 'some words');
    await act(async () => { fireEvent.press(utils.UNSAFE_getByProps({ name: 'send' })); });
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', NOT_ALLOWED_MESSAGE);
  });
});

describe('Social feed: editing your own post', () => {
  it('is turned away by the word list with the reason, before anything is saved', async () => {
    const utils = setup({ posts: [post({ authorId: 'u1', authorName: 'Cj', text: 'Mine' })] });
    await settle();
    // the three dots on your own post open Edit / Delete / settings
    fireEvent.press(utils.getByText('icon:ellipsis-vertical').parent);
    fireEvent.press(utils.getByText('Edit'));
    fireEvent.changeText(utils.getByPlaceholderText("What's on your mind?"), 'what a load of bullshit');
    await act(async () => { fireEvent.press(utils.getByText('Save')); });
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', NOT_ALLOWED_MESSAGE);
    expect(global.__community.updatePost).not.toHaveBeenCalled();
  });

  it('is saved when it is fine', async () => {
    const utils = setup({ posts: [post({ authorId: 'u1', authorName: 'Cj', text: 'Mine' })] });
    await settle();
    fireEvent.press(utils.getByText('icon:ellipsis-vertical').parent);
    fireEvent.press(utils.getByText('Edit'));
    fireEvent.changeText(utils.getByPlaceholderText("What's on your mind?"), 'Mine, edited');
    await act(async () => { fireEvent.press(utils.getByText('Save')); });
    expect(global.__community.updatePost).toHaveBeenCalledWith('p1', 'u1', 'Mine, edited');
  });
});

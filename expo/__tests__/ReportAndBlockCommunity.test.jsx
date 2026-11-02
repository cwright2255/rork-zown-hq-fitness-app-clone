// Report, Block and Delete comment on the Community screen (app/community.jsx), with the real sheet (components/ModerationSheet.jsx).
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: (props) => mockReact.createElement(mockRn.Text, null, `icon:${props.name}`) };
}, { virtual: true });
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: (props) => mockReact.createElement(mockRn.Text, null, props.title) };
});
jest.mock('@/components/BottomNavigation', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PostMedia', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/RunPostCard', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PostComposer', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => (props.visible
      ? mockReact.createElement(
        mockRn.View,
        { testID: 'composer' },
        mockReact.createElement(mockRn.TextInput, { testID: 'composer-input', onChangeText: props.onChangeText }),
        mockReact.createElement(mockRn.Text, { testID: 'composer-submit', onPress: props.onSubmit }, 'post'),
      )
      : null),
  };
});
jest.mock('@/store/messagingStore', () => ({ getConversationId: (a, b) => `${a}_${b}` }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/communityStore', () => {
  const hook = () => global.__community;
  hook.getState = () => global.__community;
  return { useCommunityStore: hook };
});
jest.mock('@/store/blockStore', () => {
  const state = { subscribeBlocks: jest.fn(), blockUser: jest.fn(async () => true), unblockUser: jest.fn(async () => true) };
  const hook = (select) => select({ ...state, blocked: global.__blocked });
  hook.getState = () => state;
  return { useBlockStore: hook };
});
jest.mock('@/services/reportService', () => ({ submitReport: jest.fn(async () => ({ status: 'sent' })) }));

import CommunityScreen from '../app/community';
import { contentNotAllowedError, NOT_ALLOWED_MESSAGE } from '../lib/wordFilter';
import { submitReport } from '../services/reportService';
import { useBlockStore } from '../store/blockStore';

const post = (extra = {}) => ({
  id: 'p1', authorId: 'u2', authorName: 'Dana Lee', text: 'Hit a new 5K PR', likeCount: 3, commentCount: 2, shareCount: 0,
  createdAt: { toDate: () => new Date(Date.now() - 2 * 3600 * 1000) }, ...extra,
});
const comment = (extra = {}) => ({ id: 'c1', authorId: 'u3', authorName: 'Wes Hill', text: 'Great job', ...extra });

const open = ({ posts = [post()], comments = [], blocked = {} } = {}) => {
  global.__user = { uid: 'u1', name: 'Cj' };
  global.__blocked = blocked;
  global.__community = {
    posts,
    isLoading: false,
    subscribeFeed: jest.fn(),
    unsubscribeFeed: jest.fn(),
    createPost: jest.fn(async () => 'new'),
    toggleLike: jest.fn(async () => true),
    hasLiked: jest.fn(async () => false),
    loadComments: jest.fn(async () => comments),
    addComment: jest.fn(async () => 'c-new'),
    deleteComment: jest.fn(async () => true),
  };
  return render(<CommunityScreen />);
};
const settle = () => act(async () => {});
const press = (utils, testID) => act(async () => { fireEvent.press(utils.getByTestId(testID)); });
const openComments = async (utils, countText) => {
  await act(async () => { fireEvent.press(utils.getByText(countText)); });
};
const lastAlertButtons = () => Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][2];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { Alert.alert.mockRestore(); });

describe('posts', () => {
  it('start following the blocked people of whoever is signed in', async () => {
    open();
    await settle();
    expect(useBlockStore.getState().subscribeBlocks).toHaveBeenCalledWith('u1');
  });

  it('have a three-dot button on other people\'s posts, and not on your own', async () => {
    const utils = open({ posts: [post(), post({ id: 'p2', authorId: 'u1', authorName: 'Cj', text: 'My own post' })] });
    await settle();
    expect(utils.getByTestId('post-more-p1')).toBeTruthy();
    expect(utils.queryByTestId('post-more-p2')).toBeNull();
  });

  it('open Report and Block from the three dots, with the author\'s name', async () => {
    const utils = open();
    await settle();
    await press(utils, 'post-more-p1');
    expect(utils.getByText('Report post')).toBeTruthy();
    expect(utils.getByText('Block Dana Lee')).toBeTruthy();
  });

  it('can be reported: why, then a report with the post\'s id, place, author and words', async () => {
    const utils = open();
    await settle();
    await press(utils, 'post-more-p1');
    await press(utils, 'mod-report');
    await press(utils, 'mod-reason-harassment');
    expect(submitReport).toHaveBeenCalledWith({
      reporterId: 'u1', kind: 'post', targetId: 'p1', targetPath: 'communityPosts/p1', targetAuthorId: 'u2', reason: 'harassment', text: 'Hit a new 5K PR',
    });
    expect(Alert.alert).toHaveBeenCalledWith('Report sent', expect.any(String));
    expect(utils.queryByText('Report post')).toBeNull(); // the sheet is shut again
  });

  it('can have their author blocked: asked first, then the block is saved with their name', async () => {
    const utils = open();
    await settle();
    await press(utils, 'post-more-p1');
    await press(utils, 'mod-block');
    expect(Alert.alert.mock.calls[0][0]).toBe('Block Dana Lee?');
    await act(async () => { await lastAlertButtons().find((b) => b.text === 'Block').onPress(); });
    expect(useBlockStore.getState().blockUser).toHaveBeenCalledWith({ myUid: 'u1', uid: 'u2', name: 'Dana Lee', avatar: null });
  });

  it('from a blocked person are not shown, and everyone else\'s still are', async () => {
    const utils = open({
      posts: [post(), post({ id: 'p3', authorId: 'u4', authorName: 'Eli Ray', text: 'Rest day today' })],
      blocked: { u2: { uid: 'u2', name: 'Dana Lee' } },
    });
    await settle();
    expect(utils.queryByText('Hit a new 5K PR')).toBeNull();
    expect(utils.queryByText('Dana Lee')).toBeNull();
    expect(utils.getByText('Rest day today')).toBeTruthy();
  });

  it('leave nothing on the screen when the only posts are from blocked people', async () => {
    const utils = open({ blocked: { u2: { uid: 'u2', name: 'Dana Lee' } } });
    await settle();
    expect(utils.queryByText('Hit a new 5K PR')).toBeNull();
  });
});

describe('comments', () => {
  it('from a blocked person are not shown', async () => {
    const utils = open({
      comments: [comment(), comment({ id: 'c2', authorId: 'u2', authorName: 'Dana Lee', text: 'Blocked words' })],
      blocked: { u2: { uid: 'u2', name: 'Dana Lee' } },
      posts: [post({ authorId: 'u9', authorName: 'Fay Poe' })],
    });
    await settle();
    await openComments(utils, '2');
    expect(utils.getByText('Great job')).toBeTruthy();
    expect(utils.queryByText('Blocked words')).toBeNull();
  });

  it('can be reported from the three dots, with where they are', async () => {
    const utils = open({ comments: [comment()] });
    await settle();
    await openComments(utils, '2');
    await press(utils, 'comment-more-c1');
    expect(utils.getByText('Report comment')).toBeTruthy();
    expect(utils.getByText('Block Wes Hill')).toBeTruthy();
    expect(utils.queryByText('Delete comment')).toBeNull(); // not your post and not your comment
    await press(utils, 'mod-report');
    await press(utils, 'mod-reason-spam');
    expect(submitReport).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'comment', targetId: 'c1', targetPath: 'communityPosts/p1/comments/c1', targetAuthorId: 'u3', reason: 'spam', text: 'Great job',
    }));
  });

  it('can be deleted by the owner of the post, from the three dots, and leave the list', async () => {
    const utils = open({ posts: [post({ authorId: 'u1', authorName: 'Cj' })], comments: [comment(), comment({ id: 'c2', authorId: 'u4', authorName: 'Ola', text: 'Second' })] });
    await settle();
    await openComments(utils, '2');
    await press(utils, 'comment-more-c1');
    await press(utils, 'mod-delete');
    expect(Alert.alert.mock.calls[0][0]).toBe('Delete comment?');
    await act(async () => { await lastAlertButtons().find((b) => b.text === 'Delete').onPress(); });
    expect(global.__community.deleteComment).toHaveBeenCalledWith('p1', 'c1');
    expect(utils.queryByText('Great job')).toBeNull();
    expect(utils.getByText('Second')).toBeTruthy();
  });

  it('can be deleted by their author, who can do nothing else with them', async () => {
    const utils = open({ comments: [comment({ id: 'c9', authorId: 'u1', authorName: 'Cj', text: 'Mine' })] });
    await settle();
    await openComments(utils, '2');
    await press(utils, 'comment-more-c9');
    expect(utils.getByText('Delete comment')).toBeTruthy();
    expect(utils.queryByText('Report comment')).toBeNull();
    expect(utils.queryByText('Block Cj')).toBeNull();
  });

  it('stay on the screen, with a message, when the delete does not go through', async () => {
    const utils = open({ posts: [post({ authorId: 'u1', authorName: 'Cj' })], comments: [comment()] });
    await settle();
    global.__community.deleteComment.mockResolvedValue(false);
    await openComments(utils, '2');
    await press(utils, 'comment-more-c1');
    await press(utils, 'mod-delete');
    await act(async () => { await lastAlertButtons().find((b) => b.text === 'Delete').onPress(); });
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', "Couldn't delete that comment. Try again.");
    expect(utils.getByText('Great job')).toBeTruthy();
  });

  it('are turned away by the word list with a message that says why, not "try again"', async () => {
    const utils = open({ comments: [] });
    await settle();
    global.__community.addComment.mockRejectedValue(contentNotAllowedError());
    await openComments(utils, '2');
    fireEvent.changeText(utils.getByPlaceholderText('Add a comment...'), 'some words');
    await act(async () => { fireEvent.press(utils.UNSAFE_getByType('Send')); });
    expect(global.__community.addComment).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', NOT_ALLOWED_MESSAGE);
  });

  it('still say "try again" for any other failure', async () => {
    const utils = open({ comments: [] });
    await settle();
    global.__community.addComment.mockRejectedValue(new Error('offline'));
    await openComments(utils, '2');
    fireEvent.changeText(utils.getByPlaceholderText('Add a comment...'), 'some words');
    await act(async () => { fireEvent.press(utils.UNSAFE_getByType('Send')); });
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', "Couldn't post your comment. Try again.");
  });
});

describe('a new post', () => {
  const write = async (utils, text) => {
    fireEvent.press(utils.getByText('Share an update'));
    fireEvent.changeText(utils.getByTestId('composer-input'), text);
    await act(async () => { fireEvent.press(utils.getByTestId('composer-submit')); });
  };

  it('turned away by the word list says why, in words, and keeps what was written', async () => {
    const utils = open();
    await settle();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.__community.createPost.mockRejectedValue(contentNotAllowedError());
    await write(utils, 'some words');
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', NOT_ALLOWED_MESSAGE);
    expect(utils.getByTestId('composer')).toBeTruthy(); // still open, so the words can be changed
    console.warn.mockRestore();
  });

  it('that is fine is posted and the composer closes', async () => {
    const utils = open();
    await settle();
    await write(utils, 'Rest day today');
    expect(global.__community.createPost).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1', text: 'Rest day today' }));
    expect(utils.queryByTestId('composer')).toBeNull();
  });
});

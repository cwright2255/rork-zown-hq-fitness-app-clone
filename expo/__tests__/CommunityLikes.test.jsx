// The heart on the Community screen (app/community.jsx): a double tap is one like, and the number does not lag behind the heart.
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

const post = (extra = {}) => ({
  id: 'p1', authorId: 'u2', authorName: 'Dana Lee', text: 'Hit a new 5K PR', likeCount: 3, commentCount: 2, shareCount: 0,
  createdAt: { toDate: () => new Date(Date.now() - 2 * 3600 * 1000) }, ...extra,
});

const open = ({ toggleLike, posts = [post()] } = {}) => {
  global.__user = { uid: 'u1', name: 'Cj' };
  global.__blocked = {};
  global.__community = {
    posts, isLoading: false, subscribeFeed: jest.fn(), unsubscribeFeed: jest.fn(), createPost: jest.fn(),
    toggleLike: toggleLike || jest.fn(async () => true), hasLiked: jest.fn(async () => false),
    loadComments: jest.fn(async () => []), addComment: jest.fn(), deleteComment: jest.fn(),
  };
  return render(<CommunityScreen />);
};
const settle = () => act(async () => {});
const heart = (utils, id = 'p1') => utils.getByTestId(`like-${id}`);
const tap = (utils) => act(async () => { fireEvent.press(heart(utils)); });

beforeEach(() => { jest.clearAllMocks(); });

describe('the heart on a post', () => {
  it('shows the number the feed has', async () => {
    const utils = open();
    await settle();
    expect(utils.getByText('3')).toBeTruthy();
  });

  it('turns red and takes the number up by one at once, and keeps it there once the like is written', async () => {
    const utils = open();
    await settle();
    await tap(utils);
    expect(global.__community.toggleLike).toHaveBeenCalledWith('p1', 'u1');
    expect(utils.getByText('4')).toBeTruthy();
    expect(utils.queryByText('3')).toBeNull();
  });

  it('is one like for a double tap: the second tap, while the first is being written, does nothing', async () => {
    let finish;
    const toggleLike = jest.fn(() => new Promise((resolve) => { finish = () => resolve(true); }));
    const utils = open({ toggleLike });
    await settle();
    await act(async () => {
      fireEvent.press(heart(utils));
      fireEvent.press(heart(utils));
    });
    expect(toggleLike).toHaveBeenCalledTimes(1);
    expect(utils.getByText('4')).toBeTruthy();
    await act(async () => { finish(); });
    expect(utils.getByText('4')).toBeTruthy(); // up by one, not two and not back to three
  });

  it('goes back to the real number when the like could not be written', async () => {
    const utils = open({ toggleLike: jest.fn(async () => null) });
    await settle();
    await tap(utils);
    expect(utils.getByText('3')).toBeTruthy();
  });

  it('shows the real number as soon as the feed has it, and does not add the like a second time', async () => {
    const utils = open();
    await settle();
    await tap(utils);
    expect(utils.getByText('4')).toBeTruthy();
    global.__community.posts = [post({ likeCount: 4 })]; // the Cloud Function has moved the count
    utils.rerender(<CommunityScreen />);
    expect(utils.getByText('4')).toBeTruthy();
    expect(utils.queryByText('5')).toBeNull();
  });
});

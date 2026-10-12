import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

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
    default: (props) => (props.visible ? mockReact.createElement(mockRn.Text, { testID: 'composer' }, 'composer open') : null),
  };
});
jest.mock('@/store/messagingStore', () => ({ getConversationId: (a, b) => `${a}_${b}` }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/communityStore', () => {
  const hook = () => global.__community;
  hook.getState = () => global.__community;
  return { useCommunityStore: hook };
});

import CommunityScreen from '../app/community';

const { router } = require('expo-router');

const post = (extra = {}) => ({
  id: 'p1', authorId: 'u2', authorName: 'Dana Lee', text: 'Hit a new 5K PR', likeCount: 3, commentCount: 1, shareCount: 0,
  createdAt: { toDate: () => new Date(Date.now() - 2 * 3600 * 1000) }, ...extra,
});

const open = (posts = [post()]) => {
  router.push.mockClear();
  global.__user = { uid: 'u1', name: 'Cj' };
  global.__community = {
    posts,
    isLoading: false,
    subscribeFeed: jest.fn(),
    unsubscribeFeed: jest.fn(),
    createPost: jest.fn(),
    toggleLike: jest.fn(async () => true),
    hasLiked: jest.fn(async () => false),
    loadComments: jest.fn(async () => []),
    addComment: jest.fn(),
  };
  return render(<CommunityScreen />);
};

describe('Community screen', () => {
  it('shows the feed', async () => {
    const utils = open();
    await act(async () => {});
    expect(utils.getByText('Community')).toBeTruthy();
    expect(utils.getByText('Dana Lee')).toBeTruthy();
    expect(utils.getByText('Hit a new 5K PR')).toBeTruthy();
    expect(utils.getByText('Share an update')).toBeTruthy();
    expect(global.__community.subscribeFeed).toHaveBeenCalledWith(50);
  });

  it('has no Challenges tab, and none of the invented challenges', async () => {
    const utils = open();
    await act(async () => {});
    expect(utils.queryByText('Challenges')).toBeNull();
    expect(utils.queryByText('Feed')).toBeNull();
    expect(utils.queryByText('30-Day Cardio')).toBeNull();
    expect(utils.queryByText('Strength PR Month')).toBeNull();
    expect(utils.queryByText('Summer Shred')).toBeNull();
    expect(utils.queryByText(/participants/)).toBeNull();
    expect(utils.queryByText('Join')).toBeNull();
    expect(utils.queryByText(/coming soon/i)).toBeNull();
  });

  it('says so when there are no posts yet', async () => {
    const utils = open([]);
    await act(async () => {});
    expect(utils.getByText('No posts yet — be the first to share something.')).toBeTruthy();
  });

  it('opens the composer from "Share an update"', async () => {
    const utils = open();
    await act(async () => {});
    expect(utils.queryByTestId('composer')).toBeNull();
    fireEvent.press(utils.getByText('Share an update'));
    expect(utils.getByTestId('composer')).toBeTruthy();
  });

  it('opens a conversation with the author of a post', async () => {
    const utils = open();
    await act(async () => {});
    fireEvent.press(utils.getByText('Dana Lee'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/messages/[id]',
      params: { id: 'u1_u2', name: 'Dana Lee', otherUid: 'u2', avatar: '' },
    });
  });

  it('does not open a conversation with yourself', async () => {
    const utils = open([post({ authorId: 'u1', authorName: 'Cj' })]);
    await act(async () => {});
    fireEvent.press(utils.getByText('Cj'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('likes a post, counting what the store says it has', async () => {
    const utils = open();
    await act(async () => {});
    await act(async () => { fireEvent.press(utils.getByText('3')); });
    expect(global.__community.toggleLike).toHaveBeenCalledWith('p1', 'u1');
  });

  it('opens the comments of a post', async () => {
    const utils = open();
    await act(async () => {});
    await act(async () => { fireEvent.press(utils.getByText('1')); });
    expect(global.__community.loadComments).toHaveBeenCalledWith('p1');
    expect(utils.getByText('Comments')).toBeTruthy();
  });
});

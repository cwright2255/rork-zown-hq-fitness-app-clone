// Report and Block in the message thread (app/messages/[id].jsx), what Block hides in the Messages list (app/messages.jsx) and the
// Blocked people screen (app/profile/blocked.jsx).
import React from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: (props) => mockReact.createElement(mockRn.Text, null, `icon:${props.name}`) };
}, { virtual: true });
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => global.__params,
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'alice', name: 'Alice', profileImage: '' } }) }));
jest.mock('@/store/messagingStore', () => ({
  useMessagingStore: () => global.__messaging,
  getConversationId: (a, b) => [a, b].sort().join('_'),
}));
jest.mock('@/store/leaderboardStore', () => ({ useLeaderboardStore: () => global.__lb }));
jest.mock('@/store/blockStore', () => {
  const hook = (select) => select(global.__blockState);
  hook.getState = () => global.__blockState;
  return { useBlockStore: hook };
});
jest.mock('@/services/reportService', () => ({ submitReport: jest.fn(async () => ({ status: 'sent' })) }));

import { router } from 'expo-router';
import ChatScreen from '../app/messages/[id]';
import MessagesScreen from '../app/messages';
import BlockedPeopleScreen from '../app/profile/blocked';
import { submitReport } from '../services/reportService';

const settle = () => act(async () => {});
const press = (utils, testID) => act(async () => { fireEvent.press(utils.getByTestId(testID)); });
const lastAlert = () => Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1];
const answer = async (label) => {
  await act(async () => { await lastAlert()[2].find((b) => b.text === label).onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  router.canGoBack.mockReturnValue(true);
  global.__params = { id: 'alice_bob', name: 'Bob', otherUid: 'bob', avatar: '' };
  global.__blockState = {
    blocked: {}, isLoaded: true, error: null,
    subscribeBlocks: jest.fn(), blockUser: jest.fn(async () => true), unblockUser: jest.fn(async () => true),
  };
  global.__messaging = {
    activeMessages: [], isLoadingMessages: false, subscribeMessages: jest.fn(), unsubscribeMessages: jest.fn(),
    sendMessage: jest.fn(async () => 'alice_bob'),
    conversations: [], isLoadingConversations: false, subscribeConversations: jest.fn(), unsubscribeConversations: jest.fn(),
  };
  global.__lb = { entries: [], loadTop: jest.fn() };
});
afterEach(() => { Alert.alert.mockRestore(); console.warn.mockRestore(); });

describe('the message thread', () => {
  const messages = [
    { id: 'm1', senderId: 'bob', text: 'Hey, nice run' },
    { id: 'm2', senderId: 'alice', text: 'Thanks!' },
  ];
  const thread = (extra = {}) => {
    global.__messaging.activeMessages = messages;
    return render(<ChatScreen />);
  };

  it('follows who the person has blocked', () => {
    thread();
    expect(global.__blockState.subscribeBlocks).toHaveBeenCalledWith('alice');
  });

  it('puts the three dots on messages from the other person, and not on your own', () => {
    const utils = thread();
    expect(utils.getByTestId('message-more-m1')).toBeTruthy();
    expect(utils.queryByTestId('message-more-m2')).toBeNull();
  });

  it('reports a message, with the place it is in and what it says', async () => {
    const utils = thread();
    await press(utils, 'message-more-m1');
    expect(utils.getByText('Report message')).toBeTruthy();
    expect(utils.getByText('Block Bob')).toBeTruthy();
    await press(utils, 'mod-report');
    await press(utils, 'mod-reason-harassment');
    expect(submitReport).toHaveBeenCalledWith({
      reporterId: 'alice', kind: 'message', targetId: 'm1', targetPath: 'conversations/alice_bob/messages/m1',
      targetAuthorId: 'bob', reason: 'harassment', text: 'Hey, nice run',
    });
  });

  it('opens the same menu from a long press on what they sent', async () => {
    const utils = thread();
    await act(async () => { fireEvent(utils.getByText('Hey, nice run'), 'longPress'); });
    expect(utils.getByText('Report message')).toBeTruthy();
  });

  it('does not open it from a long press on your own message', async () => {
    const utils = thread();
    await act(async () => { fireEvent(utils.getByText('Thanks!'), 'longPress'); });
    expect(utils.queryByText('Report message')).toBeNull();
    expect(utils.queryByTestId('mod-cancel')).toBeNull();
  });

  it('has a menu in the header that only blocks: there is no one message to report', async () => {
    const utils = thread();
    await press(utils, 'thread-more');
    expect(utils.getByText('Block Bob')).toBeTruthy();
    expect(utils.queryByTestId('mod-report')).toBeNull();
  });

  it('blocks the person from the header, then leaves the thread', async () => {
    const utils = thread();
    await press(utils, 'thread-more');
    await press(utils, 'mod-block');
    await answer('Block');
    expect(global.__blockState.blockUser).toHaveBeenCalledWith({ myUid: 'alice', uid: 'bob', name: 'Bob', avatar: null });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('blocks from a message the same way, with their name', async () => {
    const utils = thread();
    await press(utils, 'message-more-m1');
    await press(utils, 'mod-block');
    await answer('Block');
    expect(global.__blockState.blockUser).toHaveBeenCalledWith({ myUid: 'alice', uid: 'bob', name: 'Bob', avatar: null });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('stays in the thread when the block does not go through', async () => {
    global.__blockState.blockUser.mockResolvedValue(false);
    const utils = thread();
    await press(utils, 'thread-more');
    await press(utils, 'mod-block');
    await answer('Block');
    expect(router.back).not.toHaveBeenCalled();
    expect(lastAlert()[0]).toBe("Couldn't block");
  });

  it('has a box to write in when nobody is blocked', () => {
    const utils = thread();
    expect(utils.getByPlaceholderText('Type message...')).toBeTruthy();
    expect(utils.queryByText(/You blocked/)).toBeNull();
  });

  describe('when you have blocked them', () => {
    beforeEach(() => { global.__blockState.blocked = { bob: { uid: 'bob', name: 'Bob' } }; });

    it('says so, and where to undo it, in place of the box to write in', () => {
      const utils = thread();
      expect(utils.getByText('You blocked Bob. To message them again, unblock them in Settings, under Blocked people.')).toBeTruthy();
      expect(utils.queryByPlaceholderText('Type message...')).toBeNull();
      expect(utils.queryByText('icon:send')).toBeNull();
    });

    it('has no Block in the header, as it is done', () => {
      const utils = thread();
      expect(utils.queryByTestId('thread-more')).toBeNull();
    });

    it('still lets you report what they sent', async () => {
      const utils = thread();
      await press(utils, 'message-more-m1');
      expect(utils.getByText('Report message')).toBeTruthy();
    });
  });

  describe('sending when the rules refuse', () => {
    const write = async (utils, text) => {
      fireEvent.changeText(utils.getByPlaceholderText('Type message...'), text);
      await act(async () => { fireEvent.press(utils.UNSAFE_getByProps({ name: 'send' })); });
    };

    it('says the message was not sent, in words that do not say who blocked whom, and gives the text back', async () => {
      global.__messaging.sendMessage.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
      const utils = thread();
      await write(utils, 'hello again');
      expect(Alert.alert).toHaveBeenCalledWith('Message not sent', "This message couldn't be sent. You may not be able to message this person.");
      expect(utils.getByPlaceholderText('Type message...').props.value).toBe('hello again');
    });

    it('does not say that for any other trouble, only gives the text back', async () => {
      global.__messaging.sendMessage.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));
      const utils = thread();
      await write(utils, 'hello again');
      expect(Alert.alert).not.toHaveBeenCalled();
      expect(utils.getByPlaceholderText('Type message...').props.value).toBe('hello again');
    });

    it('sends as it always did when nothing is wrong', async () => {
      const utils = thread();
      await write(utils, 'on my way');
      expect(global.__messaging.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ myUid: 'alice', otherUid: 'bob', text: 'on my way' }));
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });
});

describe('the Messages list', () => {
  const conversation = (id, otherUid, name) => ({ id, otherUid, name, avatar: '', lastMessage: { text: `hi from ${name}`, senderId: otherUid } });
  const conversations = [conversation('alice_bob', 'bob', 'Bob Ray'), conversation('alice_cy', 'cy', 'Cy Park')];

  it('follows who the person has blocked', () => {
    global.__messaging.conversations = conversations;
    render(<MessagesScreen />);
    expect(global.__blockState.subscribeBlocks).toHaveBeenCalledWith('alice');
  });

  it('shows everyone when nobody is blocked', () => {
    global.__messaging.conversations = conversations;
    const utils = render(<MessagesScreen />);
    expect(utils.getByText('Bob Ray')).toBeTruthy();
    expect(utils.getByText('Cy Park')).toBeTruthy();
  });

  it('leaves out a conversation with someone you blocked, and keeps the rest', () => {
    global.__messaging.conversations = conversations;
    global.__blockState.blocked = { bob: { uid: 'bob', name: 'Bob Ray' } };
    const utils = render(<MessagesScreen />);
    expect(utils.queryByText('Bob Ray')).toBeNull();
    expect(utils.queryByText('hi from Bob Ray')).toBeNull();
    expect(utils.getByText('Cy Park')).toBeTruthy();
  });

  it('shows the empty list, not a blank screen, when everyone in it is blocked', () => {
    global.__messaging.conversations = [conversations[0]];
    global.__blockState.blocked = { bob: { uid: 'bob', name: 'Bob Ray' } };
    const utils = render(<MessagesScreen />);
    expect(utils.getByText('No conversations yet. Tap + to start one.')).toBeTruthy();
  });

  it('leaves a blocked person out of the New Message picker, so a conversation cannot be started with them', async () => {
    global.__lb.entries = [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob Ray' }, { id: 'cy', name: 'Cy Park' }];
    global.__blockState.blocked = { bob: { uid: 'bob', name: 'Bob Ray' } };
    const utils = render(<MessagesScreen />);
    await act(async () => { fireEvent.press(utils.getByText('icon:add')); });
    expect(utils.getByText('New Message')).toBeTruthy();
    expect(utils.getByText('Cy Park')).toBeTruthy();
    expect(utils.queryByText('Bob Ray')).toBeNull();
  });

  it('offers them again once they are unblocked', async () => {
    global.__lb.entries = [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob Ray' }];
    const utils = render(<MessagesScreen />);
    await act(async () => { fireEvent.press(utils.getByText('icon:add')); });
    expect(utils.getByText('Bob Ray')).toBeTruthy();
  });
});

describe('the Blocked people screen', () => {
  const two = {
    bob: { uid: 'bob', name: 'Bob Ray', avatar: null, blockedAt: '2026-10-01T10:00:00.000Z' },
    cy: { uid: 'cy', name: 'Cy Park', avatar: null, blockedAt: '2026-10-20T10:00:00.000Z' },
  };

  it('follows the list for this person', () => {
    render(<BlockedPeopleScreen />);
    expect(global.__blockState.subscribeBlocks).toHaveBeenCalledWith('alice');
  });

  it('says in plain words what blocking does', () => {
    const utils = render(<BlockedPeopleScreen />);
    expect(utils.getByText(/neither of you can message the other/)).toBeTruthy();
  });

  it('lists the people, newest block first', () => {
    global.__blockState.blocked = two;
    const utils = render(<BlockedPeopleScreen />);
    const names = utils.getAllByText(/Bob Ray|Cy Park/).map((n) => n.props.children);
    expect(names).toEqual(['Cy Park', 'Bob Ray']);
    expect(utils.getByTestId('unblock-bob')).toBeTruthy();
    expect(utils.getByTestId('unblock-cy')).toBeTruthy();
  });

  it('asks before unblocking, and says what happens', async () => {
    global.__blockState.blocked = two;
    const utils = render(<BlockedPeopleScreen />);
    await press(utils, 'unblock-bob');
    expect(lastAlert()[0]).toBe('Unblock Bob Ray?');
    expect(lastAlert()[1]).toMatch(/see their posts and comments again/);
    expect(lastAlert()[2].map((b) => b.text)).toEqual(['Cancel', 'Unblock']);
    expect(global.__blockState.unblockUser).not.toHaveBeenCalled();
  });

  it('unblocks the person that was asked about', async () => {
    global.__blockState.blocked = two;
    const utils = render(<BlockedPeopleScreen />);
    await press(utils, 'unblock-bob');
    await answer('Unblock');
    expect(global.__blockState.unblockUser).toHaveBeenCalledWith({ myUid: 'alice', uid: 'bob' });
    expect(Alert.alert).toHaveBeenCalledTimes(1); // only the question: nothing went wrong
  });

  it('says so when it could not be undone', async () => {
    global.__blockState.blocked = two;
    global.__blockState.unblockUser.mockResolvedValue(false);
    const utils = render(<BlockedPeopleScreen />);
    await press(utils, 'unblock-cy');
    await answer('Unblock');
    expect(lastAlert()[0]).toBe("Couldn't unblock");
  });

  it('says how to block someone when nobody is', () => {
    const utils = render(<BlockedPeopleScreen />);
    expect(utils.getByText(/You haven't blocked anyone/)).toBeTruthy();
  });

  it('says when the list could not be loaded, rather than that nobody is blocked', () => {
    global.__blockState.error = new Error('offline');
    const utils = render(<BlockedPeopleScreen />);
    expect(utils.getByText(/Couldn't load your blocked people/)).toBeTruthy();
    expect(utils.queryByText(/You haven't blocked anyone/)).toBeNull();
  });

  it('shows it is loading before the list has come', () => {
    global.__blockState.isLoaded = false;
    const utils = render(<BlockedPeopleScreen />);
    expect(utils.UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();
    expect(utils.queryByText(/You haven't blocked anyone/)).toBeNull();
  });

  it('goes back, or to Settings when it was opened first', async () => {
    const utils = render(<BlockedPeopleScreen />);
    await act(async () => { fireEvent.press(utils.getByLabelText('Back')); });
    expect(router.back).toHaveBeenCalledTimes(1);
    router.canGoBack.mockReturnValue(false);
    await act(async () => { fireEvent.press(utils.getByLabelText('Back')); });
    expect(router.replace).toHaveBeenCalledWith('/profile/settings');
  });
});

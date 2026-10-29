// The message thread screen (app/messages/[id].jsx), with the real messaging store and a stand-in for the database.
//
// Opening a thread with someone you have never messaged, typing, and pressing send used to do nothing: the send was refused (the
// store read the conversation first), and the text came back into the box. And once it did go through, the thread stayed empty, because
// its live messages had been refused before the conversation existed and never started again. These walk through that on the screen.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
const mockParams = { current: { id: 'alice_bob', name: 'Bob', otherUid: 'bob', avatar: '' } };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams.current,
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({
  useUserStore: () => ({ user: { uid: 'alice', name: 'Alice', profileImage: 'https://img/a.png' } }),
}));

jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
const mockListeners = [];
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...p) => ({ collection: p.join('/') })),
  doc: jest.fn((db, ...p) => ({ path: p.join('/') })),
  getDoc: jest.fn(async () => { throw new Error('getDoc must not be called'); }),
  setDoc: jest.fn(async () => undefined),
  addDoc: jest.fn(async () => ({ id: 'm1' })),
  query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
  where: jest.fn(),
  orderBy: jest.fn((field, dir) => ({ orderBy: [field, dir || 'asc'] })),
  limit: jest.fn((n) => ({ limit: n })),
  onSnapshot: jest.fn((q, next, error) => {
    const listener = { q, next, error, stop: jest.fn() };
    mockListeners.push(listener);
    return listener.stop;
  }),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
}));

import { setDoc, addDoc, getDoc } from 'firebase/firestore';
import { useMessagingStore } from '../store/messagingStore';
import ChatScreen from '../app/messages/[id]';

const live = () => mockListeners.filter((l) => l.q.ref.collection === 'conversations/alice_bob/messages');
const input = (utils) => utils.getByPlaceholderText('Type message...');
const type = (utils, text) => fireEvent.changeText(input(utils), text);
const press = async (utils) => { await act(async () => { fireEvent.press(utils.UNSAFE_getByProps({ name: 'send' })); }); };
const refuse = (listener) => act(() => { listener.error(new Error('Missing or insufficient permissions.')); });
const deliver = (listener, docs) => act(() => { listener.next({ docs: docs.map((d) => ({ id: d.id, data: () => d })) }); });

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockListeners.length = 0;
  mockParams.current = { id: 'alice_bob', name: 'Bob', otherUid: 'bob', avatar: '' };
  useMessagingStore.setState(useMessagingStore.getInitialState(), true);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); warn.mockRestore(); });

describe('a thread with someone you have never messaged', () => {
  it('opens empty, with "Say hello", once the database has refused to read a conversation that is not there yet', () => {
    const utils = render(<ChatScreen />);
    expect(live()).toHaveLength(1);
    refuse(live()[0]);
    expect(utils.getByText('Say hello 👋')).toBeTruthy();
    expect(utils.getByText('Bob')).toBeTruthy();
  });

  it('sends the first message, empties the box and starts listening, so the message appears at once', async () => {
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Run tomorrow?');
    await press(utils);

    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][0]).toEqual({ path: 'conversations/alice_bob' });
    expect(setDoc.mock.calls[0][1].participantIds).toEqual(['alice', 'bob']);
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
    expect(addDoc.mock.calls[0][1]).toEqual({ senderId: 'alice', text: 'Run tomorrow?', createdAt: 'SERVER_TIME' });
    expect(input(utils).props.value).toBe('');

    expect(live()).toHaveLength(2); // a new listener, started after the send
    deliver(live()[1], [{ id: 'm1', senderId: 'alice', text: 'Run tomorrow?' }]);
    expect(utils.getByText('Run tomorrow?')).toBeTruthy();
    expect(utils.queryByText('Say hello 👋')).toBeNull();
  });

  it('can be sent with the Return key on the keyboard as well', async () => {
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Hello');
    await act(async () => { fireEvent(input(utils), 'submitEditing'); });
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(live()).toHaveLength(2);
  });

  it('puts the text back in the box when the message cannot be sent, and does not start listening', async () => {
    setDoc.mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Run tomorrow?');
    await press(utils);
    expect(input(utils).props.value).toBe('Run tomorrow?');
    expect(addDoc).not.toHaveBeenCalled();
    expect(live()).toHaveLength(1);
    expect(utils.getByText('Say hello 👋')).toBeTruthy();
  });

  it('can send again after a failed send', async () => {
    setDoc.mockRejectedValueOnce(new Error('offline'));
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Run tomorrow?');
    await press(utils);
    expect(input(utils).props.value).toBe('Run tomorrow?');
    await press(utils);
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(input(utils).props.value).toBe('');
    expect(live()).toHaveLength(2);
  });

  it('sends nothing for an empty box', async () => {
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, '   ');
    await press(utils);
    expect(setDoc).not.toHaveBeenCalled();
    expect(live()).toHaveLength(1);
  });
});

describe('the name stored for the other person', () => {
  it('is the one the thread was opened with', async () => {
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Hi');
    await press(utils);
    expect(setDoc.mock.calls[0][1].participantInfo).toEqual({
      alice: { name: 'Alice', avatar: 'https://img/a.png' },
      bob: { name: 'Bob' },
    });
  });

  it('is left out when the thread was opened without one, so the "Chat" shown in the header is not stored as their name', async () => {
    mockParams.current = { id: 'alice_bob' };
    const utils = render(<ChatScreen />);
    expect(utils.getByText('Chat')).toBeTruthy();
    refuse(live()[0]);
    type(utils, 'Hi');
    await press(utils);
    const info = setDoc.mock.calls[0][1].participantInfo;
    expect(info.bob).toBeUndefined();
    expect(JSON.stringify(info)).not.toContain('Chat');
  });

  it('includes their photo when the thread was opened with one', async () => {
    mockParams.current = { id: 'alice_bob', name: 'Bob', otherUid: 'bob', avatar: 'https://img/b.png' };
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Hi');
    await press(utils);
    expect(setDoc.mock.calls[0][1].participantInfo.bob).toEqual({ name: 'Bob', avatar: 'https://img/b.png' });
  });

  it('works out who the other person is from the conversation id when it was opened with only the id', async () => {
    mockParams.current = { id: 'alice_bob' };
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Hi');
    await press(utils);
    expect(setDoc.mock.calls[0][1].participantIds).toEqual(['alice', 'bob']);
  });
});

describe('a thread that already exists', () => {
  it('shows the messages, and sending does not start a second listener', async () => {
    const utils = render(<ChatScreen />);
    deliver(live()[0], [
      { id: 'm1', senderId: 'bob', text: 'Run tomorrow?' },
      { id: 'm2', senderId: 'alice', text: 'Yes' },
    ]);
    expect(utils.getByText('Run tomorrow?')).toBeTruthy();
    type(utils, 'See you at 7');
    await press(utils);
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(live()).toHaveLength(1);
    expect(live()[0].stop).not.toHaveBeenCalled();
  });

  it('sends the two ids with this message too, with no read first', async () => {
    const utils = render(<ChatScreen />);
    deliver(live()[0], [{ id: 'm1', senderId: 'bob', text: 'Hi' }]);
    type(utils, 'Hello');
    await press(utils);
    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc.mock.calls[0][1].participantIds).toEqual(['alice', 'bob']);
  });
});

describe('leaving the thread', () => {
  it('stops listening, and a message that finishes sending afterwards does not start it again', async () => {
    let finish;
    addDoc.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ id: 'm1' }); }));
    const utils = render(<ChatScreen />);
    refuse(live()[0]);
    type(utils, 'Hi');
    await press(utils); // waiting for the message to be written
    utils.unmount();
    await act(async () => { finish(); });
    expect(live()).toHaveLength(1);
    expect(useMessagingStore.getState()._msgUnsubscribe).toBeNull();
    expect(useMessagingStore.getState()._msgConversationId).toBeNull();
  });
});

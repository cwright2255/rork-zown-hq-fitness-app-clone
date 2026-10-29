// Sending a message (store/messagingStore.js).
//
// The first message to someone new used to fail. sendMessage read the conversation to see whether it existed, and the rules only
// let a conversation be read once it exists (they look inside it), so for a new person the read itself was refused and the send
// threw. Now it makes one merging write that always carries both ids and never reads first. A thread opened before the first message
// also had its live messages refused and stopped for good, so a new thread showed nothing until it was opened again: the store now
// starts them again after the first send.
//
// What the database does with these writes is checked in rules-tests/social.test.js (in CI, which has the emulator). Here it is
// what the app asks for.
const fs = require('fs');
const path = require('path');

jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
const mockListeners = [];
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...p) => ({ collection: p.join('/') })),
  doc: jest.fn((db, ...p) => ({ path: p.join('/') })),
  getDoc: jest.fn(async () => { throw new Error('getDoc must not be called: reading a conversation that does not exist is refused'); }),
  setDoc: jest.fn(async () => undefined),
  addDoc: jest.fn(async () => ({ id: 'm1' })),
  query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
  where: jest.fn((field, op, value) => ({ where: [field, op, value] })),
  orderBy: jest.fn((field, dir) => ({ orderBy: [field, dir || 'asc'] })),
  limit: jest.fn((n) => ({ limit: n })),
  onSnapshot: jest.fn((q, next, error) => {
    const listener = { q, next, error, stop: jest.fn() };
    mockListeners.push(listener);
    return listener.stop;
  }),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
}));

import { setDoc, addDoc, getDoc, onSnapshot, query } from 'firebase/firestore';
import { useMessagingStore, getConversationId } from '../store/messagingStore';

const store = () => useMessagingStore.getState();
const alice = { myUid: 'alice', myName: 'Alice', myAvatar: 'https://img/a.png' };
const send = (extra = {}) => store().sendMessage({ ...alice, otherUid: 'bob', otherName: 'Bob', otherAvatar: 'https://img/b.png', text: 'Run tomorrow?', ...extra });
/** The live listeners on one conversation's messages, oldest first. */
const messageListeners = (id = 'alice_bob') => mockListeners.filter((l) => l.q.ref.collection === `conversations/${id}/messages`);

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.length = 0;
  useMessagingStore.setState(useMessagingStore.getInitialState(), true);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { warn.mockRestore(); });

describe('the first message to someone new', () => {
  it('creates the conversation and sends the message, without reading the conversation first', async () => {
    const id = await send();
    expect(id).toBe('alice_bob');
    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(addDoc).toHaveBeenCalledTimes(1);
  });

  it('writes the conversation with one merging write, before the message, and always with both ids', async () => {
    await send();
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'conversations/alice_bob' });
    expect(options).toEqual({ merge: true });
    expect(data.participantIds).toEqual(['alice', 'bob']);
    expect(data.lastMessage).toEqual({ text: 'Run tomorrow?', senderId: 'alice', createdAt: 'SERVER_TIME' });
    expect(data.updatedAt).toBe('SERVER_TIME');
    expect(setDoc.mock.invocationCallOrder[0]).toBeLessThan(addDoc.mock.invocationCallOrder[0]);
    const [messages, message] = addDoc.mock.calls[0];
    expect(messages).toEqual({ collection: 'conversations/alice_bob/messages' });
    expect(message).toEqual({ senderId: 'alice', text: 'Run tomorrow?', createdAt: 'SERVER_TIME' });
  });

  it('sends the two ids in the same order whoever writes, under the id they make (the rules need both)', async () => {
    await store().sendMessage({ myUid: 'bob', otherUid: 'alice', text: 'Yes' });
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: `conversations/${getConversationId('bob', 'alice')}` });
    expect(ref.path).toBe('conversations/alice_bob');
    expect(data.participantIds).toEqual(['alice', 'bob']);
  });

  it('sends the ids with every message, not only the first: it cannot tell the first from a later one without reading', async () => {
    await send({ text: 'one' });
    await send({ text: 'two' });
    await send({ text: 'three' });
    expect(setDoc).toHaveBeenCalledTimes(3);
    for (const [, data, options] of setDoc.mock.calls) {
      expect(data.participantIds).toEqual(['alice', 'bob']);
      expect(options).toEqual({ merge: true });
    }
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('sends the text trimmed, in the message and in the preview', async () => {
    await send({ text: '   hello there  \n' });
    expect(setDoc.mock.calls[0][1].lastMessage.text).toBe('hello there');
    expect(addDoc.mock.calls[0][1].text).toBe('hello there');
  });

  it('sends nothing for an empty message or when someone is missing', async () => {
    expect(await send({ text: '   ' })).toBeNull();
    expect(await send({ text: undefined })).toBeNull();
    expect(await send({ otherUid: '' })).toBeNull();
    expect(await store().sendMessage({ otherUid: 'bob', text: 'hi' })).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
  });
});

describe('the names and photos stored with the conversation', () => {
  it('stores both people\'s names and photos when it knows them', async () => {
    await send();
    expect(setDoc.mock.calls[0][1].participantInfo).toEqual({
      alice: { name: 'Alice', avatar: 'https://img/a.png' },
      bob: { name: 'Bob', avatar: 'https://img/b.png' },
    });
  });

  it('writes nothing about the other person when it does not know their name or photo, so it cannot wipe what is stored', async () => {
    await send({ otherName: undefined, otherAvatar: '' });
    const info = setDoc.mock.calls[0][1].participantInfo;
    expect(info).toEqual({ alice: { name: 'Alice', avatar: 'https://img/a.png' } });
    expect('bob' in info).toBe(false);
  });

  it('writes only the field it knows: a name without a photo does not set the photo to nothing', async () => {
    await send({ otherName: 'Bob', otherAvatar: null, myAvatar: undefined });
    expect(setDoc.mock.calls[0][1].participantInfo).toEqual({ alice: { name: 'Alice' }, bob: { name: 'Bob' } });
    expect('avatar' in setDoc.mock.calls[0][1].participantInfo.bob).toBe(false);
  });

  it('never stores a made-up name such as "Zown User" or "Chat"', async () => {
    await send({ myName: '', otherName: undefined, myAvatar: undefined, otherAvatar: undefined });
    const text = JSON.stringify(setDoc.mock.calls[0][1].participantInfo);
    expect(text).not.toMatch(/Zown User|Chat/);
    expect(setDoc.mock.calls[0][1].participantInfo).toEqual({ alice: {} });
  });
});

describe('when the send fails', () => {
  it('throws, so the screen can put the text back, and does not send the message if the conversation could not be written', async () => {
    setDoc.mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    await expect(send()).rejects.toThrow('Missing or insufficient permissions.');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('throws when the message itself cannot be written', async () => {
    addDoc.mockRejectedValueOnce(new Error('offline'));
    await expect(send()).rejects.toThrow('offline');
  });

  it('does not start the thread\'s messages again', async () => {
    store().subscribeMessages('alice_bob');
    messageListeners()[0].error(new Error('denied'));
    setDoc.mockRejectedValueOnce(new Error('nope'));
    await expect(send()).rejects.toThrow('nope');
    expect(messageListeners()).toHaveLength(1);
  });
});

describe('the open thread\'s live messages', () => {
  it('start for the thread, and are replaced when another is opened', () => {
    store().subscribeMessages('alice_bob');
    expect(messageListeners('alice_bob')).toHaveLength(1);
    expect(store()._msgConversationId).toBe('alice_bob');
    expect(typeof store()._msgUnsubscribe).toBe('function');
    store().subscribeMessages('alice_carol');
    expect(messageListeners('alice_bob')[0].stop).toHaveBeenCalledTimes(1);
    expect(store()._msgConversationId).toBe('alice_carol');
  });

  it('show the messages as they come in', () => {
    store().subscribeMessages('alice_bob');
    messageListeners()[0].next({ docs: [{ id: 'm1', data: () => ({ senderId: 'bob', text: 'hi' }) }] });
    expect(store().activeMessages).toEqual([{ id: 'm1', senderId: 'bob', text: 'hi' }]);
    expect(store().isLoadingMessages).toBe(false);
  });

  it('are refused for a conversation that does not exist yet: the handle is dropped, so they can be started again', () => {
    store().subscribeMessages('alice_bob');
    expect(store().isLoadingMessages).toBe(true);
    messageListeners()[0].error(new Error('Missing or insufficient permissions.'));
    expect(store()._msgUnsubscribe).toBeNull();
    expect(store()._msgConversationId).toBe('alice_bob'); // still the open thread
    expect(store().isLoadingMessages).toBe(false);
    expect(store().error).toBe('Missing or insufficient permissions.');
  });

  it('are dropped too when the database refuses at once, before the call has returned', () => {
    onSnapshot.mockImplementationOnce((q, next, error) => { error(new Error('refused')); return jest.fn(); });
    store().subscribeMessages('alice_bob');
    expect(store()._msgUnsubscribe).toBeNull();
    expect(store().isLoadingMessages).toBe(false);
  });

  it('are not touched by the failure of an older listener that has been replaced', () => {
    store().subscribeMessages('alice_bob');
    const [old] = messageListeners();
    store().subscribeMessages('alice_bob');
    const live = store()._msgUnsubscribe;
    old.error(new Error('late'));
    expect(store()._msgUnsubscribe).toBe(live);
    expect(store().isLoadingMessages).toBe(true);
  });

  it('clear the error once messages arrive', () => {
    store().subscribeMessages('alice_bob');
    messageListeners()[0].error(new Error('denied'));
    store().subscribeMessages('alice_bob');
    messageListeners()[1].next({ docs: [] });
    expect(store().error).toBeNull();
  });

  it('stop, and forget the thread, when the screen closes', () => {
    store().subscribeMessages('alice_bob');
    store().unsubscribeMessages();
    expect(messageListeners()[0].stop).toHaveBeenCalledTimes(1);
    expect(store()._msgUnsubscribe).toBeNull();
    expect(store()._msgConversationId).toBeNull();
    expect(store().activeMessages).toEqual([]);
  });
});

describe('a thread opened before the first message', () => {
  const openNewThread = () => {
    store().subscribeMessages('alice_bob');
    messageListeners()[0].error(new Error('Missing or insufficient permissions.'));
  };

  it('starts listening again once the first message has been sent', async () => {
    openNewThread();
    expect(messageListeners()).toHaveLength(1);
    await send();
    expect(messageListeners()).toHaveLength(2);
    expect(typeof store()._msgUnsubscribe).toBe('function');
    expect(store().isLoadingMessages).toBe(true);
    // ...and the message shows up when it arrives
    messageListeners()[1].next({ docs: [{ id: 'm1', data: () => ({ senderId: 'alice', text: 'Run tomorrow?' }) }] });
    expect(store().activeMessages).toEqual([{ id: 'm1', senderId: 'alice', text: 'Run tomorrow?' }]);
  });

  it('starts them only once the conversation has been written, so the new listener is not refused too', async () => {
    openNewThread();
    let written;
    setDoc.mockImplementationOnce(() => new Promise((resolve) => { written = resolve; }));
    const sending = send();
    await Promise.resolve();
    await Promise.resolve();
    expect(messageListeners()).toHaveLength(1); // the conversation is not there yet
    written();
    await sending;
    expect(messageListeners()).toHaveLength(2);
  });

  it('listens to the messages of that conversation, oldest first, up to 200', async () => {
    openNewThread();
    await send();
    expect(messageListeners()[1].q.constraints).toEqual([{ orderBy: ['createdAt', 'asc'] }, { limit: 200 }]);
  });

  it('does not start a second listener while the first is still live', async () => {
    store().subscribeMessages('alice_bob');
    await send();
    await send({ text: 'again' });
    expect(messageListeners()).toHaveLength(1);
    expect(messageListeners()[0].stop).not.toHaveBeenCalled();
  });

  it('does not start any for a thread that is not the open one, or after the screen has closed', async () => {
    openNewThread();
    await send({ otherUid: 'carol', text: 'someone else' });
    expect(messageListeners('alice_bob')).toHaveLength(1);
    expect(messageListeners('alice_carol')).toHaveLength(0);
    store().unsubscribeMessages();
    await send();
    expect(mockListeners).toHaveLength(1);
  });

  it('does not fail the send if the listener cannot be started', async () => {
    openNewThread();
    onSnapshot.mockImplementationOnce(() => { throw new Error('no listener'); });
    await expect(send()).resolves.toBe('alice_bob');
    expect(addDoc).toHaveBeenCalledTimes(1);
  });

  it('ensureMessagesSubscribed starts only a thread that is open and stopped', () => {
    store().ensureMessagesSubscribed('alice_bob');
    expect(mockListeners).toHaveLength(0);
    openNewThread();
    store().ensureMessagesSubscribed('');
    store().ensureMessagesSubscribed('alice_carol');
    expect(mockListeners).toHaveLength(1);
    store().ensureMessagesSubscribed('alice_bob');
    expect(mockListeners).toHaveLength(2);
    store().ensureMessagesSubscribed('alice_bob');
    expect(mockListeners).toHaveLength(2);
  });
});

describe('the conversation list', () => {
  it('asks for the person\'s conversations, newest first, which needs the index in firestore.indexes.json', () => {
    store().subscribeConversations('alice');
    const q = query.mock.calls.find(([ref]) => ref.collection === 'conversations');
    const constraints = q.slice(1);
    expect(constraints).toEqual([{ where: ['participantIds', 'array-contains', 'alice'] }, { orderBy: ['updatedAt', 'desc'] }]);
    const indexes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firestore.indexes.json'), 'utf8')).indexes;
    const wanted = indexes.find((i) => i.collectionGroup === 'conversations');
    expect(wanted.queryScope).toBe('COLLECTION');
    expect(wanted.fields).toEqual([
      { fieldPath: 'participantIds', arrayConfig: 'CONTAINS' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ]);
  });
});

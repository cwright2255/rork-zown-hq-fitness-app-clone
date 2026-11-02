// Filing a report (services/reportService.js), the block list (store/blockStore.js), and the word list and comment delete in the
// community store (store/communityStore.js). What the database does with these writes is checked in rules-tests/social.test.js (in CI,
// which has the emulator); here it is what the app asks for.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
const mockListeners = [];
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...path) => ({ collection: path.join('/') })),
  doc: jest.fn((first, ...path) => (path.length
    ? { id: path[path.length - 1], path: path.join('/') }
    : { id: 'new-post', path: 'communityPosts/new-post' })),
  addDoc: jest.fn(async () => ({ id: 'c-new' })),
  deleteDoc: jest.fn(async () => undefined),
  setDoc: jest.fn(async () => undefined),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn((ref, next, error) => {
    const listener = { ref, next, error, stop: jest.fn() };
    mockListeners.push(listener);
    return listener.stop;
  }),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  increment: jest.fn((n) => ({ increment: n })),
  updateDoc: jest.fn(async () => undefined),
}));
jest.mock('../services/postMediaService', () => ({
  uploadPostMedia: jest.fn(async () => []),
  deletePostMedia: jest.fn(async () => undefined),
}));
jest.mock('../store/runningStore', () => ({ useRunningStore: { getState: () => ({}) } }));

import { setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { uploadPostMedia } from '../services/postMediaService';
import { submitReport, forgetSentReports } from '../services/reportService';
import { useBlockStore } from '../store/blockStore';
import { useCommunityStore } from '../store/communityStore';
import { CONTENT_NOT_ALLOWED, NOT_ALLOWED_MESSAGE } from '../lib/wordFilter';

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.length = 0;
  forgetSentReports();
  useBlockStore.setState(useBlockStore.getInitialState(), true);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { warn.mockRestore(); });

describe('filing a report', () => {
  const report = (over = {}) => ({
    reporterId: 'u1', kind: 'post', targetId: 'p1', targetPath: 'communityPosts/p1', targetAuthorId: 'u2', reason: 'spam', text: 'Buy my shake', ...over,
  });

  it('writes one document in reports, named for who reported what, with what the rules ask for', async () => {
    expect(await submitReport(report())).toEqual({ status: 'sent' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref).toEqual({ id: 'u1_post_p1', path: 'reports/u1_post_p1' });
    expect(data).toMatchObject({
      reporterId: 'u1', kind: 'post', targetId: 'p1', targetPath: 'communityPosts/p1', targetAuthorId: 'u2', reason: 'spam', text: 'Buy my shake',
    });
    expect(typeof data.createdAt).toBe('string');
  });

  it('reports a comment and a message the same way, with where each one is', async () => {
    await submitReport(report({ kind: 'comment', targetId: 'c1', targetPath: 'communityPosts/p1/comments/c1', reason: 'harassment' }));
    await submitReport(report({ kind: 'message', targetId: 'm1', targetPath: 'conversations/u1_u2/messages/m1', reason: 'hate' }));
    expect(setDoc.mock.calls.map(([ref]) => ref.path)).toEqual(['reports/u1_comment_c1', 'reports/u1_message_m1']);
    expect(setDoc.mock.calls[1][1].targetPath).toBe('conversations/u1_u2/messages/m1');
  });

  it('does not ask the database a second time for the same thing: the rules would refuse it', async () => {
    await submitReport(report());
    expect(await submitReport(report({ reason: 'hate' }))).toEqual({ status: 'already' });
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('lets the same person report something else, and someone else report the same thing', async () => {
    await submitReport(report());
    expect(await submitReport(report({ targetId: 'p2', targetPath: 'communityPosts/p2' }))).toEqual({ status: 'sent' });
    expect(await submitReport(report({ reporterId: 'u3' }))).toEqual({ status: 'sent' });
    expect(setDoc).toHaveBeenCalledTimes(3);
  });

  it('throws when the database refuses it, and tries again the next time rather than saying it was sent', async () => {
    setDoc.mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    await expect(submitReport(report())).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await submitReport(report())).toEqual({ status: 'sent' });
    expect(setDoc).toHaveBeenCalledTimes(2);
  });

  it('throws, without writing, when something it needs is missing or the reason is not one it offers', async () => {
    await expect(submitReport(report({ reporterId: '' }))).rejects.toThrow();
    await expect(submitReport(report({ targetId: '' }))).rejects.toThrow();
    await expect(submitReport(report({ reason: 'rude' }))).rejects.toThrow();
    await expect(submitReport(report({ kind: 'user' }))).rejects.toThrow();
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('the block list', () => {
  const store = () => useBlockStore.getState();
  const deliver = (listener, docs) => listener.next({ docs: docs.map(([id, data]) => ({ id, data: () => data })) });

  it('follows users/{uid}/blocks and keeps who is blocked, with their name and picture', () => {
    store().subscribeBlocks('u1');
    expect(mockListeners).toHaveLength(1);
    expect(mockListeners[0].ref).toEqual({ collection: 'users/u1/blocks' });
    expect(store().isLoaded).toBe(false);
    deliver(mockListeners[0], [
      ['u2', { name: 'Dana', avatar: 'd.png', blockedAt: '2026-10-29T12:00:00.000Z' }],
      ['u3', { blockedAt: '2026-10-29T13:00:00.000Z' }],
    ]);
    expect(store().isLoaded).toBe(true);
    expect(store().blocked.u2).toEqual({ uid: 'u2', name: 'Dana', avatar: 'd.png', blockedAt: '2026-10-29T12:00:00.000Z' });
    expect(store().blocked.u3).toEqual({ uid: 'u3', name: 'Zown User', avatar: null, blockedAt: '2026-10-29T13:00:00.000Z' });
    expect(store().isBlocked('u2')).toBe(true);
    expect(store().isBlocked('u9')).toBe(false);
    expect(store().isBlocked(undefined)).toBe(false);
  });

  it('follows the list as it changes, including when the last person is unblocked', () => {
    store().subscribeBlocks('u1');
    deliver(mockListeners[0], [['u2', { name: 'Dana', blockedAt: 'x' }]]);
    expect(Object.keys(store().blocked)).toEqual(['u2']);
    deliver(mockListeners[0], []);
    expect(store().blocked).toEqual({});
  });

  it('is safe to ask for from every screen: the second ask for the same person does nothing', () => {
    store().subscribeBlocks('u1');
    store().subscribeBlocks('u1');
    store().subscribeBlocks('u1');
    expect(mockListeners).toHaveLength(1);
    expect(mockListeners[0].stop).not.toHaveBeenCalled();
  });

  it('follows the new person, and stops following the old one, when the account changes', () => {
    store().subscribeBlocks('u1');
    store().subscribeBlocks('u2');
    expect(mockListeners).toHaveLength(2);
    expect(mockListeners[0].stop).toHaveBeenCalledTimes(1);
    expect(mockListeners[1].ref).toEqual({ collection: 'users/u2/blocks' });
  });

  it('does nothing without a person, and can be stopped', () => {
    store().subscribeBlocks(undefined);
    expect(mockListeners).toHaveLength(0);
    store().subscribeBlocks('u1');
    store().unsubscribeBlocks();
    expect(mockListeners[0].stop).toHaveBeenCalledTimes(1);
    store().subscribeBlocks('u1'); // asking again starts it again
    expect(mockListeners).toHaveLength(2);
  });

  it('says so when the list cannot be read, and is then finished loading rather than loading for ever', () => {
    store().subscribeBlocks('u1');
    mockListeners[0].error(new Error('Missing or insufficient permissions.'));
    expect(store().error).toBe('Missing or insufficient permissions.');
    expect(store().isLoaded).toBe(true);
  });

  describe('blocking', () => {
    it('writes users/{me}/blocks/{them} with their name, picture and when, and hides them at once', async () => {
      const pending = store().blockUser({ myUid: 'u1', uid: 'u2', name: 'Dana', avatar: 'd.png' });
      expect(store().isBlocked('u2')).toBe(true); // before the database has answered
      expect(await pending).toBe(true);
      const [ref, data] = setDoc.mock.calls[0];
      expect(ref).toEqual({ id: 'u2', path: 'users/u1/blocks/u2' });
      expect(data).toMatchObject({ name: 'Dana', avatar: 'd.png' });
      expect(typeof data.blockedAt).toBe('string');
      expect(Object.keys(data).sort()).toEqual(['avatar', 'blockedAt', 'name']);
    });

    it('writes only what it knows: no empty name or picture (the database does not take undefined)', async () => {
      await store().blockUser({ myUid: 'u1', uid: 'u2' });
      expect(Object.keys(setDoc.mock.calls[0][1])).toEqual(['blockedAt']);
      expect(store().blocked.u2.name).toBe('Zown User');
    });

    it('cuts a name to the length the rules allow', async () => {
      await store().blockUser({ myUid: 'u1', uid: 'u2', name: 'x'.repeat(300) });
      expect(setDoc.mock.calls[0][1].name).toHaveLength(100);
    });

    it('takes the block back, and says so, when the database refuses it', async () => {
      setDoc.mockRejectedValueOnce(new Error('offline'));
      expect(await store().blockUser({ myUid: 'u1', uid: 'u2', name: 'Dana' })).toBe(false);
      expect(store().isBlocked('u2')).toBe(false);
    });

    it('keeps an earlier block of the same person when a second try fails', async () => {
      store().subscribeBlocks('u1');
      deliver(mockListeners[0], [['u2', { name: 'Dana', blockedAt: 'x' }]]);
      setDoc.mockRejectedValueOnce(new Error('offline'));
      expect(await store().blockUser({ myUid: 'u1', uid: 'u2', name: 'Dana' })).toBe(false);
      expect(store().isBlocked('u2')).toBe(true);
    });

    it('cannot block yourself, or without knowing who is blocking or who', async () => {
      expect(await store().blockUser({ myUid: 'u1', uid: 'u1' })).toBe(false);
      expect(await store().blockUser({ myUid: '', uid: 'u2' })).toBe(false);
      expect(await store().blockUser({ myUid: 'u1', uid: '' })).toBe(false);
      expect(setDoc).not.toHaveBeenCalled();
      expect(store().blocked).toEqual({});
    });
  });

  describe('unblocking', () => {
    beforeEach(() => {
      store().subscribeBlocks('u1');
      deliver(mockListeners[0], [['u2', { name: 'Dana', blockedAt: 'x' }], ['u3', { name: 'Eli', blockedAt: 'y' }]]);
    });

    it('deletes users/{me}/blocks/{them} and shows them again at once, leaving the others blocked', async () => {
      const pending = store().unblockUser({ myUid: 'u1', uid: 'u2' });
      expect(store().isBlocked('u2')).toBe(false);
      expect(await pending).toBe(true);
      expect(deleteDoc.mock.calls[0][0]).toEqual({ id: 'u2', path: 'users/u1/blocks/u2' });
      expect(store().isBlocked('u3')).toBe(true);
    });

    it('puts the block back, and says so, when the database refuses it', async () => {
      deleteDoc.mockRejectedValueOnce(new Error('offline'));
      expect(await store().unblockUser({ myUid: 'u1', uid: 'u2' })).toBe(false);
      expect(store().blocked.u2).toMatchObject({ uid: 'u2', name: 'Dana' });
    });

    it('does nothing without knowing who is unblocking or who', async () => {
      expect(await store().unblockUser({ myUid: '', uid: 'u2' })).toBe(false);
      expect(await store().unblockUser({ myUid: 'u1', uid: '' })).toBe(false);
      expect(deleteDoc).not.toHaveBeenCalled();
    });
  });
});

describe('the word list in the community store', () => {
  const community = () => useCommunityStore.getState();
  const bad = 'what a load of bullshit';

  it('turns a post away before anything is uploaded or saved, with an error that says why', async () => {
    await expect(community().createPost({ uid: 'u1', text: bad, mediaItems: [{ uri: 'x.jpg' }] })).rejects.toMatchObject({ code: CONTENT_NOT_ALLOWED });
    expect(uploadPostMedia).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('still saves a post that is fine', async () => {
    expect(await community().createPost({ uid: 'u1', authorName: 'Cj', text: 'Hit a new 5K PR' })).toBe('new-post');
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('still does nothing for an empty post, whatever the list says', async () => {
    expect(await community().createPost({ uid: 'u1', text: '   ' })).toBeNull();
  });

  it('turns an edit away without writing it', async () => {
    expect(await community().updatePost('p1', 'u1', bad)).toBe(false);
    expect(updateDoc).not.toHaveBeenCalled();
    expect(await community().updatePost('p1', 'u1', 'Edited: now 5K in 24:10')).toBe(true);
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  it('turns a comment away without saving it or counting it', async () => {
    await expect(community().addComment('p1', { uid: 'u1', authorName: 'Cj', text: bad })).rejects.toMatchObject({ code: CONTENT_NOT_ALLOWED });
    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(await community().addComment('p1', { uid: 'u1', authorName: 'Cj', text: 'Nice run!' })).toBe('c-new');
  });

  it('says it in words a person can act on', () => {
    expect(NOT_ALLOWED_MESSAGE).toMatch(/Please change it and try again/);
  });
});

describe('deleting a comment', () => {
  const community = () => useCommunityStore.getState();

  it('deletes the comment and brings the post\'s comment count down by one', async () => {
    expect(await community().deleteComment('p1', 'c1')).toBe(true);
    expect(deleteDoc.mock.calls[0][0]).toEqual({ id: 'c1', path: 'communityPosts/p1/comments/c1' });
    expect(updateDoc).toHaveBeenCalledWith({ id: 'p1', path: 'communityPosts/p1' }, { commentCount: { increment: -1 } });
  });

  it('says it did not work, and leaves the count alone, when the delete is refused', async () => {
    deleteDoc.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    expect(await community().deleteComment('p1', 'c1')).toBe(false);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('still says it worked when only the count could not be brought down: the comment is gone', async () => {
    updateDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await community().deleteComment('p1', 'c1')).toBe(true);
  });

  it('does nothing without a post and a comment', async () => {
    expect(await community().deleteComment('', 'c1')).toBe(false);
    expect(await community().deleteComment('p1', '')).toBe(false);
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

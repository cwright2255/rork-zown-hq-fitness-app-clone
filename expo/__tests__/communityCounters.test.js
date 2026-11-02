// What the community store asks the database for now that the app no longer writes the like, comment and share counts
// (store/communityStore.js). The counts are moved by the Cloud Functions in functions/src/postCounters.js (tested in
// postCounters.test.js); what the rules do with these writes is checked in rules-tests/social.test.js, in CI.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
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
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  increment: jest.fn((n) => ({ increment: n })),
  updateDoc: jest.fn(async () => undefined),
}));
jest.mock('../services/postMediaService', () => ({
  uploadPostMedia: jest.fn(async () => []),
  deletePostMedia: jest.fn(async () => undefined),
}));
jest.mock('../store/runningStore', () => ({ useRunningStore: { getState: () => ({}) } }));
jest.mock('../services/publicProfile', () => ({ ensurePublicProfile: jest.fn() }));

import { setDoc, getDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import * as firestore from 'firebase/firestore';
import { ensurePublicProfile } from '../services/publicProfile';
import { useCommunityStore } from '../store/communityStore';

const store = () => useCommunityStore.getState();
const liked = (yes) => ({ exists: () => yes });

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  ensurePublicProfile.mockImplementation(async (uid, given = {}) => ({ name: 'Profile Name', avatar: 'https://img.example/p.jpg', given }));
});
afterEach(() => warn.mockRestore());

describe('liking a post', () => {
  it('writes one document, named by the person, and no count', async () => {
    getDoc.mockResolvedValueOnce(liked(false));
    expect(await store().toggleLike('p1', 'u1')).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith({ id: 'u1', path: 'communityPosts/p1/likes/u1' }, { likedAt: 'SERVER_TIME' });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('takes the like back by deleting that document, and writes no count', async () => {
    getDoc.mockResolvedValueOnce(liked(true));
    expect(await store().toggleLike('p1', 'u1')).toBe(false);
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'u1', path: 'communityPosts/p1/likes/u1' });
    expect(updateDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('makes a double tap one like: a second call while the first is being written gets the first one\'s answer', async () => {
    let finish;
    getDoc.mockResolvedValueOnce(liked(false));
    setDoc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = store().toggleLike('p1', 'u1');
    const second = store().toggleLike('p1', 'u1');
    await Promise.resolve();
    await Promise.resolve();
    finish();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('takes the next tap as a new one once the last is done', async () => {
    getDoc.mockResolvedValueOnce(liked(false)).mockResolvedValueOnce(liked(true));
    expect(await store().toggleLike('p1', 'u1')).toBe(true);
    expect(await store().toggleLike('p1', 'u1')).toBe(false);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('keeps two people\'s likes, and two posts\' likes, apart', async () => {
    getDoc.mockResolvedValue(liked(false));
    await Promise.all([store().toggleLike('p1', 'u1'), store().toggleLike('p1', 'u2'), store().toggleLike('p2', 'u1')]);
    expect(setDoc).toHaveBeenCalledTimes(3);
    getDoc.mockReset();
  });

  it('gives null, and lets the next tap try again, when the like could not be written', async () => {
    getDoc.mockResolvedValueOnce(liked(false));
    setDoc.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    expect(await store().toggleLike('p1', 'u1')).toBeNull();
    getDoc.mockResolvedValueOnce(liked(false));
    expect(await store().toggleLike('p1', 'u1')).toBe(true);
  });

  it('does nothing without a person', async () => {
    expect(await store().toggleLike('p1', '')).toBe(false);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('commenting on a post', () => {
  it('writes the comment with the name on the profile, and no count', async () => {
    expect(await store().addComment('p1', { uid: 'u1', authorName: 'screen name', text: ' Nice run ' })).toBe('c-new');
    expect(ensurePublicProfile).toHaveBeenCalledWith('u1', { name: 'screen name' });
    expect(addDoc).toHaveBeenCalledWith(
      { collection: 'communityPosts/p1/comments' },
      { authorId: 'u1', authorName: 'Profile Name', text: 'Nice run', createdAt: 'SERVER_TIME' },
    );
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('writes the profile before the comment, so the rules find the name there', async () => {
    await store().addComment('p1', { uid: 'u1', authorName: 'x', text: 'hi' });
    expect(ensurePublicProfile.mock.invocationCallOrder[0]).toBeLessThan(addDoc.mock.invocationCallOrder[0]);
  });

  it('takes a comment of 1000 characters and turns away one of 1001, without writing anything', async () => {
    expect(await store().addComment('p1', { uid: 'u1', text: 'x'.repeat(1000) })).toBe('c-new');
    await expect(store().addComment('p1', { uid: 'u1', text: 'x'.repeat(1001) })).rejects.toThrow(/at most 1000/);
    expect(addDoc).toHaveBeenCalledTimes(1);
  });

  it('counts the length of the trimmed text, which is what is saved', async () => {
    expect(await store().addComment('p1', { uid: 'u1', text: `  ${'x'.repeat(1000)}  ` })).toBe('c-new');
  });
});

describe('removing a comment', () => {
  it('deletes the comment and writes no count', async () => {
    expect(await store().deleteComment('p1', 'c1')).toBe(true);
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'c1', path: 'communityPosts/p1/comments/c1' });
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('sharing a post', () => {
  it('writes one document, named by the person, and no count', async () => {
    await store().recordShare('p1', 'u1');
    expect(setDoc).toHaveBeenCalledWith({ id: 'u1', path: 'communityPosts/p1/shares/u1' }, { sharedAt: 'SERVER_TIME' });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('treats sharing the same post again as nothing to report: the rules refuse the rewrite, and the person is already counted', async () => {
    setDoc.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    await expect(store().recordShare('p1', 'u1')).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('says so, without failing the share, for any other error', async () => {
    setDoc.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }));
    await expect(store().recordShare('p1', 'u1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('does nothing without a post and a person', async () => {
    await store().recordShare('', 'u1');
    await store().recordShare('p1', undefined);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('creating a post', () => {
  const create = (extra = {}) => store().createPost({ uid: 'u1', authorName: 'screen name', authorAvatar: 'https://img.example/screen.jpg', text: 'Hello', ...extra });

  it('puts the name and picture from the profile on it, not the ones the screen had', async () => {
    await create();
    expect(ensurePublicProfile).toHaveBeenCalledWith('u1', { name: 'screen name', avatar: 'https://img.example/screen.jpg' });
    const body = setDoc.mock.calls[0][1];
    expect(body.authorName).toBe('Profile Name');
    expect(body.authorAvatar).toBe('https://img.example/p.jpg');
  });

  it('starts every count at zero', async () => {
    await create();
    expect(setDoc.mock.calls[0][1]).toMatchObject({ likeCount: 0, commentCount: 0, shareCount: 0 });
  });

  it('is saved after the profile is brought up to date', async () => {
    await create();
    expect(ensurePublicProfile.mock.invocationCallOrder[0]).toBeLessThan(setDoc.mock.invocationCallOrder[0]);
  });

  it('takes a post of 2000 characters and turns away one of 2001, before anything is uploaded or saved', async () => {
    await expect(create({ text: 'x'.repeat(2001) })).rejects.toThrow(/at most 2000/);
    expect(setDoc).not.toHaveBeenCalled();
    expect(ensurePublicProfile).not.toHaveBeenCalled();
    expect(await create({ text: 'x'.repeat(2000) })).toBe('new-post');
  });
});

describe('editing a post', () => {
  it('changes only the text and the time, and not a count', async () => {
    expect(await store().updatePost('p1', 'u1', ' Edited ')).toBe(true);
    expect(updateDoc).toHaveBeenCalledWith({ id: 'p1', path: 'communityPosts/p1' }, { text: 'Edited', editedAt: 'SERVER_TIME' });
  });

  it('turns away a text over 2000 characters without writing it', async () => {
    expect(await store().updatePost('p1', 'u1', 'x'.repeat(2001))).toBe(false);
    expect(updateDoc).not.toHaveBeenCalled();
    expect(await store().updatePost('p1', 'u1', 'x'.repeat(2000))).toBe(true);
  });
});

describe('the app as a whole', () => {
  it('never uses increment on a post, which the rules would refuse: the store does not even import it', () => {
    expect(firestore.increment).not.toHaveBeenCalled();
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '..', 'store/communityStore.js'), 'utf8');
    expect(source).not.toMatch(/\bincrement\b\s*\(/);
    expect(source).not.toMatch(/(likeCount|commentCount|shareCount)\s*:\s*(increment|\d*\s*[+-])/);
  });
});

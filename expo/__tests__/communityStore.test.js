const mockForget = jest.fn();
const mockLoadRuns = jest.fn();
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...path) => ({ collection: path.join('/') })),
  doc: jest.fn((first, ...path) => (path.length
    ? { id: path[path.length - 1], path: path.join('/') }
    : { id: 'new-post', path: 'communityPosts/new-post' })),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(async () => undefined),
  setDoc: jest.fn(async () => undefined),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  increment: jest.fn(),
  updateDoc: jest.fn(),
}));
jest.mock('../services/postMediaService', () => ({
  uploadPostMedia: jest.fn(async () => []),
  deletePostMedia: jest.fn(async () => undefined),
}));
jest.mock('../store/runningStore', () => ({
  useRunningStore: { getState: () => ({ runs: global.__runs, loadRuns: mockLoadRuns, forgetSharedPost: mockForget }) },
}));

import { setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { deletePostMedia } from '../services/postMediaService';
import { useCommunityStore } from '../store/communityStore';

const sharedRun = (extra = {}) => ({
  v: 1, activity: 'run', title: 'Morning Run', distance: 5.23, duration: 1610, pace: 308,
  route: [40.002, -74, 40.01, -74, 40.018, -74], ...extra,
});
const create = (extra = {}) => useCommunityStore.getState().createPost({ uid: 'u1', authorName: 'Cj', ...extra });

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [setDoc, getDoc, deleteDoc, deletePostMedia, mockForget, mockLoadRuns].forEach((fn) => fn.mockClear());
  global.__runs = [{ id: 'run-1', sharedPostId: 'p1' }];
});
afterEach(() => warn.mockRestore());

describe('createPost with a run', () => {
  it('saves the run card on the post', async () => {
    const postId = await create({ text: 'Morning Run: 5.23 km in 26:50', type: 'run', run: sharedRun() });
    expect(postId).toBe('new-post');
    const body = setDoc.mock.calls[0][1];
    expect(body.run).toEqual(sharedRun());
    expect(body.type).toBe('run');
    expect(body.authorId).toBe('u1');
  });

  it('lets a run be posted with no text and no photo', async () => {
    expect(await create({ text: '', run: sharedRun() })).toBe('new-post');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].text).toBe('');
  });

  it('puts no run on an ordinary post', async () => {
    await create({ text: 'Hello' });
    expect(setDoc.mock.calls[0][1]).not.toHaveProperty('run');
  });

  it('refuses a post that has no text, no photo and no usable run', async () => {
    expect(await create({ text: '  ', run: { distance: 0, duration: 0 } })).toBeNull();
    expect(await create({ text: '', run: 'a run' })).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('drops a run that is not usable but keeps the text', async () => {
    await create({ text: 'Hello', run: { distance: 'far' } });
    expect(setDoc.mock.calls[0][1]).not.toHaveProperty('run');
    expect(setDoc.mock.calls[0][1].text).toBe('Hello');
  });
});

describe('deletePost', () => {
  const snapshot = (data) => ({ exists: () => true, data: () => data });

  it('frees the run to be shared again when a run card is deleted', async () => {
    getDoc.mockResolvedValueOnce(snapshot({ run: sharedRun(), media: [] }));
    await useCommunityStore.getState().deletePost('p1', 'u1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(mockForget).toHaveBeenCalledWith('u1', 'p1');
    expect(mockLoadRuns).not.toHaveBeenCalled();
  });

  it('loads the saved runs first when this phone has none yet', async () => {
    global.__runs = [];
    getDoc.mockResolvedValueOnce(snapshot({ run: sharedRun() }));
    await useCommunityStore.getState().deletePost('p1', 'u1');
    expect(mockLoadRuns).toHaveBeenCalledWith('u1');
    expect(mockForget).toHaveBeenCalledWith('u1', 'p1');
  });

  it('leaves the runs alone when an ordinary post is deleted', async () => {
    getDoc.mockResolvedValueOnce(snapshot({ text: 'Hello', media: [] }));
    await useCommunityStore.getState().deletePost('p2', 'u1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(mockForget).not.toHaveBeenCalled();
  });

  it('still deletes the post if freeing the run goes wrong', async () => {
    getDoc.mockResolvedValueOnce(snapshot({ run: sharedRun() }));
    mockForget.mockImplementationOnce(() => { throw new Error('storage'); });
    await useCommunityStore.getState().deletePost('p1', 'u1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});

// The lookup behind Home's Challenges & Rank card (services/friendsRank.js): the leaderboard entries of the people you follow and you,
// read without touching the list the Leaderboard screen is showing.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ collection: name })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  query: jest.fn((...parts) => ({ query: parts })),
  orderBy: jest.fn((field, dir) => ({ orderBy: field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
  where: jest.fn((field, op, value) => ({ where: field, op, value })),
  documentId: jest.fn(() => '__name__'),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));

import { collection, getDocs, query, where } from 'firebase/firestore';
import { fetchFriendEntries } from '../services/friendsRank';
import { useLeaderboardStore } from '../store/leaderboardStore';

const docs = (list) => ({ docs: list.map(({ id, ...data }) => ({ id, data: () => data })) });
const ids = (n, prefix = 'f') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [collection, getDocs, query, where].forEach((fn) => fn.mockClear());
  getDocs.mockReset();
  useLeaderboardStore.setState({ entries: [], audienceEntries: [] });
});
afterEach(() => { warn.mockRestore(); });

describe('fetchFriendEntries', () => {
  it('returns the entries of the people asked about, with their ids', async () => {
    getDocs.mockResolvedValueOnce(docs([{ id: 'a', name: 'Ana', xp: 100 }, { id: 'me', name: 'Cj', xp: 700 }]));
    const entries = await fetchFriendEntries(['a'], 'me');
    expect(entries).toEqual([{ id: 'a', name: 'Ana', xp: 100 }, { id: 'me', name: 'Cj', xp: 700 }]);
  });

  it('asks the leaderboard for those ids, and for the person themself', async () => {
    getDocs.mockResolvedValueOnce(docs([]));
    await fetchFriendEntries(['a', 'b'], 'me');
    expect(collection).toHaveBeenCalledWith({ name: 'db' }, 'leaderboard');
    expect(where).toHaveBeenCalledWith('__name__', 'in', ['a', 'b', 'me']);
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  it('asks ten ids at a time and puts the answers together', async () => {
    getDocs.mockResolvedValueOnce(docs([{ id: 'f0', xp: 1 }])).mockResolvedValueOnce(docs([{ id: 'me', xp: 2 }]));
    const entries = await fetchFriendEntries(ids(10), 'me');
    expect(getDocs).toHaveBeenCalledTimes(2); // 11 people: 10 + 1
    expect(where.mock.calls.map(([, , group]) => group.length)).toEqual([10, 1]);
    expect(entries.map((e) => e.id)).toEqual(['f0', 'me']);
  });

  it('asks about the person once when they are among the ones asked about', async () => {
    getDocs.mockResolvedValueOnce(docs([]));
    await fetchFriendEntries(['a', 'me', 'a'], 'me');
    expect(where).toHaveBeenCalledWith('__name__', 'in', ['a', 'me']);
  });

  it('asks about just the person when they follow nobody', async () => {
    getDocs.mockResolvedValueOnce(docs([{ id: 'me', xp: 5 }]));
    expect(await fetchFriendEntries([], 'me')).toEqual([{ id: 'me', xp: 5 }]);
    expect(where).toHaveBeenCalledWith('__name__', 'in', ['me']);
  });

  it('does not ask when there is nobody to ask about', async () => {
    expect(await fetchFriendEntries([], '')).toEqual([]);
    expect(await fetchFriendEntries(undefined, undefined)).toEqual([]);
    expect(await fetchFriendEntries('abc', null)).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('gives null, not an empty list, when the entries cannot be read', async () => {
    getDocs.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchFriendEntries(['a'], 'me')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[friendsRank] fetchFriendEntries error:', 'offline');
  });

  it('gives null when only one of the groups fails', async () => {
    getDocs.mockResolvedValueOnce(docs([{ id: 'f0', xp: 1 }])).mockRejectedValueOnce(new Error('denied'));
    expect(await fetchFriendEntries(ids(10), 'me')).toBeNull();
  });

  it('leaves the list the Leaderboard screen is showing alone', async () => {
    const shown = [{ id: 'z', name: 'Zed', xp: 9 }];
    useLeaderboardStore.setState({ audienceEntries: shown, entries: shown });
    getDocs.mockResolvedValueOnce(docs([{ id: 'a', name: 'Ana', xp: 100 }]));
    await fetchFriendEntries(['a'], 'me');
    expect(useLeaderboardStore.getState().audienceEntries).toBe(shown);
    expect(useLeaderboardStore.getState().entries).toBe(shown);
    getDocs.mockRejectedValueOnce(new Error('offline'));
    await fetchFriendEntries(['a'], 'me');
    expect(useLeaderboardStore.getState().audienceEntries).toBe(shown);
  });
});

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

import { setDoc, deleteDoc, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { useLeaderboardStore } from '../store/leaderboardStore';

const d = (month, day, hour = 12) => new Date(2026, month - 1, day, hour, 0, 0);
const THU = d(10, 8).getTime(); // week of Mon 5 Oct 2026

const ran = (start, km) => ({
  id: `${start.getTime()}`,
  startTime: start.toISOString(),
  endTime: new Date(start.getTime() + km * 300000).toISOString(),
  distance: km,
  duration: Math.round(km * 300),
});

const docs = (list) => ({ docs: list.map(({ id, ...data }) => ({ id, data: () => data })) });

const fresh = () => useLeaderboardStore.setState({
  entries: [], audienceEntries: [], myRank: null, isLoading: false, error: null,
  _unsubscribe: null, _board: 'xp', _distanceSignature: null,
});

let warn;
let now;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  now = jest.spyOn(Date, 'now').mockReturnValue(THU);
  [setDoc, deleteDoc, orderBy, getDocs, onSnapshot].forEach((fn) => fn.mockClear());
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  fresh();
});
afterEach(() => { warn.mockRestore(); now.mockRestore(); });

describe('_syncDistanceEntry', () => {
  const sync = (extra = {}) => useLeaderboardStore.getState()._syncDistanceEntry('u1', {
    name: 'Cj', avatar: 'https://img/p.png', runs: [ran(d(10, 8, 7), 5), ran(d(10, 1, 7), 10)], now: THU, ...extra,
  });

  it("writes this week's and this month's distance to the person's own entry", async () => {
    expect(await sync()).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'leaderboard/u1' });
    expect(data.distance).toEqual({ w20261005: 5, m202610: 15 });
    expect(data.name).toBe('Cj');
    expect(data.avatar).toBe('https://img/p.png');
    expect(typeof data.updatedAt).toBe('string');
    expect(options).toEqual({ mergeFields: ['distance', 'updatedAt', 'name', 'avatar'] });
  });

  it('touches only the fields it writes, so XP, level and streak are never overwritten', async () => {
    await sync();
    const [, data, options] = setDoc.mock.calls[0];
    expect(Object.keys(data).sort()).toEqual(['avatar', 'distance', 'name', 'updatedAt']);
    expect(options.mergeFields).not.toEqual(expect.arrayContaining(['xp']));
    expect(data).not.toHaveProperty('xp');
  });

  it('does not blank the name or picture when it does not know them', async () => {
    await sync({ name: '', avatar: undefined });
    const [, data, options] = setDoc.mock.calls[0];
    expect(data).not.toHaveProperty('name');
    expect(data).not.toHaveProperty('avatar');
    expect(options).toEqual({ mergeFields: ['distance', 'updatedAt'] });
  });

  it('writes an empty distance for someone with no runs this month, which clears last week\'s', async () => {
    await sync({ runs: [ran(d(9, 1, 7), 5)] });
    expect(setDoc.mock.calls[0][1].distance).toEqual({});
  });

  it('takes the whole entry off the boards, and writes nothing, when the person is hidden from leaderboards', async () => {
    expect(await sync({ visible: false })).toBe(true);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'leaderboard/u1' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('removes the entry once, not again every time the leaderboard is opened', async () => {
    await sync({ visible: false });
    expect(await sync({ visible: false })).toBe(true);
    expect(await sync({ visible: false, runs: [] })).toBe(true);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('writes the whole entry again when someone hidden is shown again, even with the same runs and name', async () => {
    await sync();
    await sync({ visible: false });
    expect(await sync()).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(setDoc.mock.calls[1][1].distance).toEqual({ w20261005: 5, m202610: 15 });
  });

  it('gives false, and tries the removal again next time, when it fails', async () => {
    deleteDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await sync({ visible: false })).toBe(false);
    expect(await sync({ visible: false })).toBe(true);
    expect(deleteDoc).toHaveBeenCalledTimes(2);
  });

  it('skips the write when nothing has changed since the last one', async () => {
    await sync();
    expect(await sync()).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('writes again when the totals, the name or the visibility change', async () => {
    await sync();
    await sync({ runs: [ran(d(10, 8, 7), 5), ran(d(10, 1, 7), 10), ran(d(10, 8, 9), 2)] });
    await sync({ runs: [ran(d(10, 8, 7), 5), ran(d(10, 1, 7), 10), ran(d(10, 8, 9), 2)], name: 'Carlton' });
    await sync({ visible: false });
    expect(setDoc).toHaveBeenCalledTimes(3);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('writes again in a new week, when the same runs add up differently', async () => {
    await sync();
    await sync({ now: d(10, 12).getTime() });
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(setDoc.mock.calls[1][1].distance).toEqual({ m202610: 15 });
  });

  it('does not count imported runs', async () => {
    await sync({ runs: [{ ...ran(d(10, 8, 7), 9), source: 'apple-health' }] });
    expect(setDoc.mock.calls[0][1].distance).toEqual({});
  });

  it('gives false, and tries again next time, when the write fails', async () => {
    setDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await sync()).toBe(false);
    expect(await sync()).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a user', async () => {
    expect(await useLeaderboardStore.getState()._syncDistanceEntry('', { runs: [] })).toBe(false);
    expect(await useLeaderboardStore.getState()._syncDistanceEntry('', { runs: [], visible: false })).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

describe('_syncLeaderboardEntry', () => {
  const store = () => useLeaderboardStore.getState();
  const entry = (extra = {}) => ({ name: 'Cj', avatar: 'https://img/p.png', xp: 1200, level: 4, streak: 6, ...extra });

  it("writes the person's name, picture, XP, level and streak to their own entry", async () => {
    expect(await store()._syncLeaderboardEntry('u1', entry())).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'leaderboard/u1' });
    expect(data).toEqual({
      name: 'Cj', avatar: 'https://img/p.png', xp: 1200, level: 4, streak: 6, updatedAt: expect.any(String),
    });
    expect(options).toEqual({ merge: true });
  });

  it('leaves the distance alone, so a new workout does not wipe it', async () => {
    await store()._syncLeaderboardEntry('u1', entry());
    expect(setDoc.mock.calls[0][1]).not.toHaveProperty('distance');
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  it('fills in what it does not know', async () => {
    await store()._syncLeaderboardEntry('u1', {});
    expect(setDoc.mock.calls[0][1]).toEqual({
      name: 'Zown User', avatar: null, xp: 0, level: 1, streak: 0, updatedAt: expect.any(String),
    });
    setDoc.mockClear();
    await store()._syncLeaderboardEntry('u1');
    expect(setDoc.mock.calls[0][1].name).toBe('Zown User');
  });

  it('keeps a real zero, for XP, level and streak', async () => {
    await store()._syncLeaderboardEntry('u1', entry({ xp: 0, level: 0, streak: 0 }));
    expect(setDoc.mock.calls[0][1]).toMatchObject({ xp: 0, level: 0, streak: 0 });
  });

  it('writes nothing for someone who has chosen not to be shown', async () => {
    expect(await store()._syncLeaderboardEntry('u1', entry({ visible: false }))).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('writes when told the person is shown', async () => {
    expect(await store()._syncLeaderboardEntry('u1', entry({ visible: true }))).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a user', async () => {
    expect(await store()._syncLeaderboardEntry('', entry())).toBe(false);
    expect(await store()._syncLeaderboardEntry(undefined, entry())).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('gives false, and says why, when the write fails', async () => {
    setDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await store()._syncLeaderboardEntry('u1', entry())).toBe(false);
    expect(warn).toHaveBeenCalledWith('[leaderboardStore] sync error:', 'offline');
  });
});

describe('_removeEntry', () => {
  const store = () => useLeaderboardStore.getState();

  it("deletes the person's own entry", async () => {
    expect(await store()._removeEntry('u1')).toBe(true);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'leaderboard/u1' });
  });

  it('makes the next distance publish write the whole entry again', async () => {
    useLeaderboardStore.setState({ _distanceSignature: 'something' });
    await store()._removeEntry('u1');
    expect(store()._distanceSignature).toBeNull();
  });

  it('keeps what it knew about the last publish when the removal fails', async () => {
    useLeaderboardStore.setState({ _distanceSignature: 'something' });
    deleteDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await store()._removeEntry('u1')).toBe(false);
    expect(store()._distanceSignature).toBe('something');
    expect(warn).toHaveBeenCalledWith('[leaderboardStore] remove error:', 'offline');
  });

  it('does nothing without a user', async () => {
    expect(await store()._removeEntry('')).toBe(false);
    expect(await store()._removeEntry(undefined)).toBe(false);
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

describe('subscribeTop', () => {
  const lastSnapshotHandler = () => onSnapshot.mock.calls[onSnapshot.mock.calls.length - 1][1];

  it('ranks by XP unless told otherwise', () => {
    useLeaderboardStore.getState().subscribeTop(50);
    expect(orderBy).toHaveBeenCalledWith('xp', 'desc');
  });

  it("ranks by this week's or this month's distance", () => {
    useLeaderboardStore.getState().subscribeTop(50, 'week');
    expect(orderBy).toHaveBeenLastCalledWith('distance.w20261005', 'desc');
    useLeaderboardStore.getState().subscribeTop(50, 'month');
    expect(orderBy).toHaveBeenLastCalledWith('distance.m202610', 'desc');
  });

  it('numbers the people in the order Firestore gives them', () => {
    useLeaderboardStore.getState().subscribeTop(50, 'week');
    lastSnapshotHandler()(docs([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]));
    expect(useLeaderboardStore.getState().entries.map((e) => [e.id, e.rank])).toEqual([['a', 1], ['b', 2]]);
    expect(useLeaderboardStore.getState().isLoading).toBe(false);
  });

  it('clears the old board\'s people when the board changes, but not when it stays the same', () => {
    const store = useLeaderboardStore;
    store.getState().subscribeTop(50, 'xp');
    lastSnapshotHandler()(docs([{ id: 'a', xp: 10 }]));
    store.getState().subscribeTop(50, 'xp');
    expect(store.getState().entries).toHaveLength(1);
    store.getState().subscribeTop(50, 'week');
    expect(store.getState().entries).toEqual([]);
    expect(store.getState().isLoading).toBe(true);
  });

  it('stops the previous subscription first', () => {
    const stop = jest.fn();
    onSnapshot.mockReturnValueOnce(stop);
    useLeaderboardStore.getState().subscribeTop(50, 'xp');
    useLeaderboardStore.getState().subscribeTop(50, 'week');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('reports a problem without throwing', () => {
    useLeaderboardStore.getState().subscribeTop(50, 'week');
    onSnapshot.mock.calls[0][2]({ message: 'permission-denied' });
    expect(useLeaderboardStore.getState().error).toBe('permission-denied');
    expect(useLeaderboardStore.getState().isLoading).toBe(false);
  });
});

describe('loadTop', () => {
  it('fetches the top of the chosen board once', async () => {
    getDocs.mockResolvedValueOnce(docs([{ id: 'a' }, { id: 'b' }]));
    const entries = await useLeaderboardStore.getState().loadTop(10, 'month');
    expect(orderBy).toHaveBeenCalledWith('distance.m202610', 'desc');
    expect(entries.map((e) => e.rank)).toEqual([1, 2]);
    expect(useLeaderboardStore.getState().isLoading).toBe(false);
  });

  it('gives an empty list when it fails', async () => {
    getDocs.mockRejectedValueOnce(new Error('offline'));
    expect(await useLeaderboardStore.getState().loadTop(10, 'week')).toEqual([]);
  });
});

describe('loadForUids', () => {
  const people = [
    { id: 'a', name: 'Ana', xp: 100, distance: { w20261005: 4.5 } },
    { id: 'b', name: 'Ben', xp: 900, distance: { w20261005: 12 } },
    { id: 'c', name: 'Cat', xp: 500 },                                  // never ran
    { id: 'd', name: 'Dan', xp: 700, distance: { w20260928: 30 } },     // ran last week only
  ];

  it('ranks the XP board by XP and keeps everyone', async () => {
    getDocs.mockResolvedValueOnce(docs(people));
    const entries = await useLeaderboardStore.getState().loadForUids(['a', 'b', 'c', 'd'], 'a');
    expect(entries.map((e) => e.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('ranks a distance board by distance, and leaves out people with none this period', async () => {
    getDocs.mockResolvedValueOnce(docs(people));
    const entries = await useLeaderboardStore.getState().loadForUids(['a', 'b', 'c', 'd'], 'a', 'week');
    expect(entries.map((e) => e.id)).toEqual(['b', 'a']);
    expect(useLeaderboardStore.getState().audienceEntries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('ranks the month board by the month', async () => {
    getDocs.mockResolvedValueOnce(docs([
      { id: 'a', name: 'Ana', distance: { m202610: 20 } },
      { id: 'b', name: 'Ben', distance: { m202610: 31.5 } },
    ]));
    const entries = await useLeaderboardStore.getState().loadForUids(['a', 'b'], 'a', 'month');
    expect(entries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('always includes the person themself, and asks ten people at a time', async () => {
    getDocs.mockResolvedValue(docs([]));
    const uids = Array.from({ length: 12 }, (_, i) => `f${i}`);
    await useLeaderboardStore.getState().loadForUids(uids, 'me', 'week');
    expect(getDocs).toHaveBeenCalledTimes(2); // 13 people: 10 + 3
  });

  it('is empty with nobody to ask about', async () => {
    expect(await useLeaderboardStore.getState().loadForUids([], '', 'week')).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

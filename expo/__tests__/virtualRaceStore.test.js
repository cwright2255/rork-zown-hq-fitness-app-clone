jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ collection: name })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  query: jest.fn((...parts) => ({ query: parts })),
  where: jest.fn((field, op, value) => ({ where: field, op, value })),
  orderBy: jest.fn((field, dir) => ({ orderBy: field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
}));

import {
  getDoc, getDocs, setDoc, deleteDoc, orderBy, limit, query,
} from 'firebase/firestore';
import { useVirtualRaceStore, keepRecent, BOARD_SIZE, KEEP_RACES } from '../store/virtualRaceStore';
import { currentRace, areasNear, raceEntryId } from '../lib/virtualRaces';

const localRace = currentRace('local', new Date(2026, 9, 14, 10));
const worldRace = currentRace('world', new Date(Date.UTC(2026, 9, 14, 10)));
const user = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png' };
const key = (race, uid = 'u1') => raceEntryId(race.id, uid);
const store = () => useVirtualRaceStore.getState();
const docsOf = (list) => ({ docs: list.map(({ id, ...data }) => ({ id, data: () => data })) });
const none = { exists: () => false };
const there = (data) => ({ exists: () => true, data: () => data });

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [getDoc, getDocs, setDoc, deleteDoc, orderBy, limit, query].forEach((fn) => fn.mockClear());
  getDoc.mockResolvedValue(none);
  getDocs.mockResolvedValue(docsOf([]));
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  useVirtualRaceStore.setState({ joined: {}, finished: {}, boards: {} });
});
afterEach(() => warn.mockRestore());

describe('what is kept on the phone', () => {
  it('is the races you joined and your finishes, under their own name, and not the boards', () => {
    const options = useVirtualRaceStore.persist.getOptions();
    expect(options.name).toBe('zown-virtual-races');
    const state = {
      joined: { a: 1 }, finished: { b: 2 }, boards: { local: { entries: [1] } }, join: () => {}, loadBoard: () => {},
    };
    expect(options.partialize(state)).toEqual({ joined: { a: 1 }, finished: { b: 2 } });
  });
});

describe('keepRecent', () => {
  const at = (n) => ({ stamp: `2026-10-${String(n).padStart(2, '0')}T00:00:00Z` });

  it('keeps the newest items, by the field given', () => {
    const record = { a: at(1), b: at(5), c: at(3), d: at(4) };
    expect(Object.keys(keepRecent(record, 'stamp', 2)).sort()).toEqual(['b', 'd']);
  });
  it('keeps everything while there is room', () => {
    const record = { a: at(1), b: at(2) };
    expect(keepRecent(record, 'stamp', 5)).toEqual(record);
  });
  it('keeps the dozen newest by default', () => {
    const record = {};
    for (let i = 1; i <= 20; i += 1) record[`r${i}`] = at(i);
    const kept = Object.keys(keepRecent(record, 'stamp'));
    expect(KEEP_RACES).toBe(12);
    expect(kept).toHaveLength(12);
    expect(kept).toContain('r20');
    expect(kept).toContain('r9');
    expect(kept).not.toContain('r8');
  });
  it('is steady when two items are as new as each other, and when one has no time', () => {
    const record = { a: at(3), b: at(3), c: at(3), x: {} };
    expect(Object.keys(keepRecent(record, 'stamp', 3)).sort()).toEqual(['a', 'b', 'c']);
    expect(Object.keys(keepRecent({ a: at(3), b: at(3) }, 'stamp', 1))).toEqual(['b']);
  });
  it('gives an empty record for nothing', () => {
    expect(keepRecent(null, 'stamp')).toEqual({});
    expect(keepRecent(undefined, 'stamp')).toEqual({});
  });
});

describe('join and leave', () => {
  it('records that you joined this race, on this phone only', () => {
    expect(store().join(localRace, 'u1')).toBe(true);
    const joined = store().joined[key(localRace)];
    expect(joined.raceId).toBe(localRace.id);
    expect(Number.isNaN(Date.parse(joined.joinedAt))).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });
  it('is per person and per race', () => {
    store().join(localRace, 'u1');
    expect(store().joined[key(localRace, 'u2')]).toBeUndefined();
    expect(store().joined[key(worldRace)]).toBeUndefined();
  });
  it('leaves a race without touching the others', () => {
    store().join(localRace, 'u1');
    store().join(worldRace, 'u1');
    store().join(localRace, 'u2');
    expect(store().leave(localRace, 'u1')).toBe(true);
    expect(Object.keys(store().joined).sort()).toEqual([key(worldRace), key(localRace, 'u2')].sort());
  });
  it('does nothing without a race or a person', () => {
    expect(store().join(null, 'u1')).toBe(false);
    expect(store().join(localRace, '')).toBe(false);
    expect(store().leave(null, 'u1')).toBe(false);
    expect(store().leave(localRace, undefined)).toBe(false);
    expect(store().joined).toEqual({});
  });
  it('keeps only the newest dozen races', () => {
    for (let i = 0; i < 15; i += 1) {
      store().join({ id: `local-5k-week-2026-${String(i + 1).padStart(2, '0')}-01` }, 'u1');
    }
    expect(Object.keys(store().joined)).toHaveLength(KEEP_RACES);
  });
});

describe('recordFinish', () => {
  const finish = (race, timeSec, extra = {}, uid = 'u1') => store().recordFinish(race, uid, {
    timeSec, finishedAt: '2026-10-14T10:00:00.000Z', areaId: '1300x1059', ...extra,
  });

  it('keeps your first finish', () => {
    const result = finish(localRace, 1500);
    expect(result.first).toBe(true);
    expect(result.improved).toBe(false);
    expect(result.record).toEqual({
      raceId: localRace.id, kind: 'local', distanceKm: 5, timeSec: 1500,
      finishedAt: '2026-10-14T10:00:00.000Z', areaId: '1300x1059', posted: false,
    });
    expect(store().finished[key(localRace)]).toEqual(result.record);
  });

  it('leaves your best alone when you run it again slower, or the same', () => {
    const first = finish(localRace, 1500).record;
    useVirtualRaceStore.setState({ finished: { [key(localRace)]: { ...first, posted: true } } });
    const slower = finish(localRace, 1600, { finishedAt: '2026-10-15T10:00:00.000Z' });
    expect(slower).toMatchObject({ first: false, improved: false });
    expect(slower.record.timeSec).toBe(1500);
    const same = finish(localRace, 1500, { finishedAt: '2026-10-16T10:00:00.000Z' });
    expect(same).toMatchObject({ first: false, improved: false });
    expect(store().finished[key(localRace)]).toEqual({ ...first, posted: true });
  });

  it('replaces it with a faster time, which has to be posted again', () => {
    const first = finish(localRace, 1500).record;
    useVirtualRaceStore.setState({ finished: { [key(localRace)]: { ...first, posted: true } } });
    const faster = finish(localRace, 1450, { finishedAt: '2026-10-17T10:00:00.000Z', areaId: '1301x1059' });
    expect(faster).toMatchObject({ first: false, improved: true });
    expect(faster.record).toMatchObject({ timeSec: 1450, finishedAt: '2026-10-17T10:00:00.000Z', areaId: '1301x1059', posted: false });
    expect(store().finished[key(localRace)]).toEqual(faster.record);
  });

  it('keeps each race and each person separately', () => {
    finish(localRace, 1500);
    finish(worldRace, 3100, { areaId: null });
    finish(localRace, 1800, {}, 'u2');
    expect(store().finished[key(localRace)].timeSec).toBe(1500);
    expect(store().finished[key(worldRace)]).toMatchObject({ timeSec: 3100, kind: 'world', distanceKm: 10, areaId: null });
    expect(store().finished[key(localRace, 'u2')].timeSec).toBe(1800);
  });

  it('keeps no area when none is given', () => {
    expect(store().recordFinish(localRace, 'u1', { timeSec: 1500, finishedAt: 'x' }).record.areaId).toBeNull();
  });

  it('does nothing without a race or a person', () => {
    expect(finish(null, 1500)).toEqual({ first: false, improved: false, record: null });
    expect(finish(localRace, 1500, {}, '')).toEqual({ first: false, improved: false, record: null });
    expect(store().finished).toEqual({});
  });

  it('keeps only the newest dozen finishes', () => {
    for (let i = 1; i <= 15; i += 1) {
      store().recordFinish({ id: `r${i}`, kind: 'world', distanceKm: 10 }, 'u1', { timeSec: 3000, finishedAt: `2026-10-${String(i).padStart(2, '0')}T10:00:00Z` });
    }
    expect(Object.keys(store().finished)).toHaveLength(KEEP_RACES);
    expect(store().finished[raceEntryId('r15', 'u1')]).toBeDefined();
    expect(store().finished[raceEntryId('r1', 'u1')]).toBeUndefined();
  });
});

describe('publish', () => {
  const kept = (race, timeSec, extra = {}) => store().recordFinish(race, 'u1', {
    timeSec, finishedAt: '2026-10-14T10:00:00.000Z', areaId: race.kind === 'local' ? '1300x1059' : null, ...extra,
  });

  it('puts the local result on the board with the name, picture, time and map square', async () => {
    kept(localRace, 1500);
    expect(await store().publish(key(localRace), user)).toBe('posted');
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: `raceEntries/${localRace.id}_u1` });
    expect(data).toEqual({
      raceId: localRace.id, uid: 'u1', kind: 'local', distanceKm: 5, name: 'Cj', avatar: 'https://img/p.png',
      timeSec: 1500, finishedAt: '2026-10-14T10:00:00.000Z', areaId: '1300x1059',
    });
    expect(store().finished[key(localRace)].posted).toBe(true);
  });

  it('puts the worldwide result on the board with no map square', async () => {
    kept(worldRace, 3100);
    expect(await store().publish(key(worldRace), user)).toBe('posted');
    expect(setDoc.mock.calls[0][1]).toMatchObject({ kind: 'world', distanceKm: 10, areaId: null, timeSec: 3100 });
  });

  it('does not post a local result that has no map square', async () => {
    kept(localRace, 1500, { areaId: null });
    expect(await store().publish(key(localRace), user)).toBe('noArea');
    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
    expect(store().finished[key(localRace)].posted).toBe(false);
  });

  it('leaves a faster or equal time that is already on the board', async () => {
    kept(localRace, 1500);
    getDoc.mockResolvedValue(there({ timeSec: 1450 }));
    expect(await store().publish(key(localRace), user)).toBe('posted');
    expect(setDoc).not.toHaveBeenCalled();
    expect(store().finished[key(localRace)].posted).toBe(true);
    useVirtualRaceStore.setState({ finished: {} });
    kept(localRace, 1500);
    getDoc.mockResolvedValue(there({ timeSec: 1500 }));
    await store().publish(key(localRace), user);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('replaces a slower time on the board', async () => {
    kept(localRace, 1500);
    getDoc.mockResolvedValue(there({ timeSec: 1600 }));
    expect(await store().publish(key(localRace), user)).toBe('posted');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].timeSec).toBe(1500);
  });

  it('says failed, keeps the result for next time, and does not throw, when it cannot be posted', async () => {
    kept(localRace, 1500);
    setDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await store().publish(key(localRace), user)).toBe('failed');
    expect(store().finished[key(localRace)].posted).toBe(false);
    getDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await store().publish(key(localRace), user)).toBe('failed');
    expect(await store().publish(key(localRace), user)).toBe('posted');
    expect(store().finished[key(localRace)].posted).toBe(true);
  });

  it('has nothing to do without a kept result or a person', async () => {
    expect(await store().publish('nope', user)).toBe('none');
    kept(localRace, 1500);
    expect(await store().publish(key(localRace), null)).toBe('none');
    expect(await store().publish(key(localRace), {})).toBe('none');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does not bring back a result that was removed while it was posting', async () => {
    kept(localRace, 1500);
    getDoc.mockImplementationOnce(async () => { useVirtualRaceStore.setState({ finished: {} }); return none; });
    expect(await store().publish(key(localRace), user)).toBe('posted');
    expect(store().finished).toEqual({});
  });
});

describe('unposted', () => {
  it('lists the results of this person that are not on the board yet', () => {
    store().recordFinish(localRace, 'u1', { timeSec: 1500, finishedAt: '2026-10-14T10:00:00Z', areaId: 'a' });
    store().recordFinish(worldRace, 'u1', { timeSec: 3100, finishedAt: '2026-10-14T11:00:00Z' });
    store().recordFinish(localRace, 'u2', { timeSec: 1600, finishedAt: '2026-10-14T12:00:00Z', areaId: 'a' });
    useVirtualRaceStore.setState((s) => ({ finished: { ...s.finished, [key(worldRace)]: { ...s.finished[key(worldRace)], posted: true } } }));
    expect(store().unposted('u1')).toEqual([key(localRace)]);
    expect(store().unposted('u2')).toEqual([key(localRace, 'u2')]);
    expect(store().unposted('nobody')).toEqual([]);
  });
});

describe('withdraw', () => {
  const post = (race, uid = 'u1') => {
    store().recordFinish(race, uid, { timeSec: 1500, finishedAt: '2026-10-14T10:00:00Z', areaId: 'a' });
    useVirtualRaceStore.setState((s) => ({ finished: { ...s.finished, [key(race, uid)]: { ...s.finished[key(race, uid)], posted: true } } }));
  };

  it('takes all of your results off the boards, keeps them on the phone, and leaves other people\'s', async () => {
    post(localRace);
    post(worldRace);
    post(localRace, 'u2');
    expect(await store().withdraw('u1')).toBe(true);
    expect(deleteDoc.mock.calls.map((c) => c[0].path).sort()).toEqual([`raceEntries/${localRace.id}_u1`, `raceEntries/${worldRace.id}_u1`].sort());
    expect(store().finished[key(localRace)]).toMatchObject({ timeSec: 1500, posted: false });
    expect(store().finished[key(worldRace)].posted).toBe(false);
    expect(store().finished[key(localRace, 'u2')].posted).toBe(true);
  });

  it('says it did not all go when one removal fails, and still tries the rest', async () => {
    post(localRace);
    post(worldRace);
    deleteDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await store().withdraw('u1')).toBe(false);
    expect(deleteDoc).toHaveBeenCalledTimes(2);
    expect(Object.values(store().finished).filter((r) => r.posted)).toHaveLength(1);
  });

  it('is true when there is nothing to take off, and false without a person', async () => {
    expect(await store().withdraw('u1')).toBe(true);
    expect(await store().withdraw('')).toBe(false);
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

describe('loadBoard: the worldwide race', () => {
  const entry = (uid, timeSec, extra = {}) => ({ id: `${worldRace.id}_${uid}`, uid, timeSec, name: uid, finishedAt: '2026-10-14T10:00:00Z', ...extra });

  it('asks for the fastest times of this race, in order, 50 at most', async () => {
    getDocs.mockResolvedValue(docsOf([entry('b', 3200), entry('a', 3100)]));
    const entries = await store().loadBoard(worldRace);
    const q = query.mock.calls.pop();
    expect(q[1]).toEqual({ where: 'raceId', op: '==', value: worldRace.id });
    expect(q[2]).toEqual({ orderBy: 'timeSec', dir: 'asc' });
    expect(q[3]).toEqual({ limit: 50 });
    expect(entries.map((e) => [e.uid, e.rank])).toEqual([['a', 1], ['b', 2]]);
    expect(store().boards.world).toMatchObject({ raceId: worldRace.id, status: 'done' });
    expect(store().boards.world.entries.map((e) => e.uid)).toEqual(['a', 'b']);
  });

  it('shows only the fastest 50', async () => {
    getDocs.mockResolvedValue(docsOf(Array.from({ length: 60 }, (_, i) => entry(`u${i}`, 3000 + i))));
    const entries = await store().loadBoard(worldRace);
    expect(BOARD_SIZE).toBe(50);
    expect(entries).toHaveLength(50);
    expect(entries[49].timeSec).toBe(3049);
  });

  it('reads some and sorts them itself when the index that orders by time is not there yet', async () => {
    getDocs.mockRejectedValueOnce(new Error('The query requires an index'));
    getDocs.mockResolvedValueOnce(docsOf([entry('b', 3200), entry('a', 3100), entry('c', 3300)]));
    const entries = await store().loadBoard(worldRace);
    expect(getDocs).toHaveBeenCalledTimes(2);
    const q = query.mock.calls.pop();
    expect(q[1]).toEqual({ where: 'raceId', op: '==', value: worldRace.id });
    expect(q[2]).toEqual({ limit: 200 });
    expect(q).toHaveLength(3);
    expect(entries.map((e) => e.uid)).toEqual(['a', 'b', 'c']);
    expect(store().boards.world.status).toBe('done');
  });

  it('says error, with an empty board, when nothing can be read', async () => {
    getDocs.mockRejectedValue(new Error('offline'));
    expect(await store().loadBoard(worldRace)).toEqual([]);
    expect(store().boards.world).toEqual({ raceId: worldRace.id, status: 'error', entries: [] });
  });

  it('shows loading while it reads, keeping the same race\'s old board but not another race\'s', async () => {
    getDocs.mockResolvedValue(docsOf([entry('a', 3100)]));
    await store().loadBoard(worldRace);
    let during;
    getDocs.mockImplementationOnce(async () => { during = store().boards.world; return docsOf([entry('a', 3100)]); });
    await store().loadBoard(worldRace);
    expect(during.status).toBe('loading');
    expect(during.entries.map((e) => e.uid)).toEqual(['a']);
    const nextMonth = { ...worldRace, id: 'world-10k-month-2026-11' };
    getDocs.mockImplementationOnce(async () => { during = store().boards.world; return docsOf([]); });
    await store().loadBoard(nextMonth);
    expect(during).toEqual({ raceId: 'world-10k-month-2026-11', status: 'loading', entries: [] });
  });

  it('does nothing without a race', async () => {
    expect(await store().loadBoard(null)).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe('loadBoard: the local race', () => {
  const home = { latitude: 40.05, longitude: -74.05 };
  const entry = (uid, timeSec, areaId = '1300x1059') => ({ id: `${localRace.id}_${uid}`, uid, timeSec, areaId, name: uid, finishedAt: '2026-10-14T10:00:00Z' });

  it('asks for this race\'s results from the squares around you, ten squares at a time', async () => {
    const areas = areasNear(home);
    getDocs.mockResolvedValue(docsOf([]));
    await store().loadBoard(localRace, { position: home });
    const queries = query.mock.calls.slice(-getDocs.mock.calls.length);
    expect(getDocs).toHaveBeenCalledTimes(Math.ceil(areas.length / 10));
    const asked = [];
    queries.forEach((q) => {
      expect(q[1]).toEqual({ where: 'raceId', op: '==', value: localRace.id });
      expect(q[2]).toMatchObject({ where: 'areaId', op: 'in' });
      expect(q[2].value.length).toBeLessThanOrEqual(10);
      expect(q[3]).toEqual({ limit: 200 });
      asked.push(...q[2].value);
    });
    expect(asked.sort()).toEqual([...areas].sort());
  });

  it('puts them together, without anyone twice, and ranks them', async () => {
    getDocs.mockResolvedValueOnce(docsOf([entry('b', 1600), entry('a', 1500)]));
    getDocs.mockResolvedValue(docsOf([entry('a', 1500), entry('c', 1550, '1301x1059')]));
    const entries = await store().loadBoard(localRace, { position: home });
    expect(entries.map((e) => [e.uid, e.rank])).toEqual([['a', 1], ['c', 2], ['b', 3]]);
    expect(store().boards.local).toMatchObject({ raceId: localRace.id, status: 'done' });
  });

  it('asks for your position when it has none, and reads nothing', async () => {
    expect(await store().loadBoard(localRace)).toEqual([]);
    expect(store().boards.local).toEqual({ raceId: localRace.id, status: 'needsLocation', entries: [] });
    expect(await store().loadBoard(localRace, { position: { latitude: 'x' } })).toEqual([]);
    expect(store().boards.local.status).toBe('needsLocation');
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('says error when a read fails, and keeps the worldwide board as it was', async () => {
    getDocs.mockResolvedValueOnce(docsOf([{ id: 'w', uid: 'w', timeSec: 3100, finishedAt: 'x' }]));
    await store().loadBoard(worldRace);
    getDocs.mockRejectedValue(new Error('offline'));
    expect(await store().loadBoard(localRace, { position: home })).toEqual([]);
    expect(store().boards.local.status).toBe('error');
    expect(store().boards.world.status).toBe('done');
  });
});

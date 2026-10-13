jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('../services/journeyRewards', () => ({ rewardJourney: jest.fn() }));

import { getDoc, setDoc } from 'firebase/firestore';
import { rewardJourney } from '../services/journeyRewards';
import { useVirtualChallengeStore, mergeJourneys, VIRTUAL_CHALLENGES } from '../store/virtualChallengeStore';
import { JOURNEYS, journeyById } from '../lib/virtualJourneys';

const store = () => useVirtualChallengeStore.getState();
const mine = (uid = 'u1') => store().byUser[uid] || {};
const remoteHas = (activeChallenges) => getDoc.mockResolvedValue({ exists: () => true, data: () => ({ activeChallenges }) });
const flush = () => new Promise((resolve) => setImmediate(resolve));
// Loaded, as it is after the screens have opened.
const loaded = async (uid = 'u1') => { await store().loadChallenges(uid); setDoc.mockClear(); };

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [getDoc, setDoc, rewardJourney].forEach((fn) => fn.mockClear());
  getDoc.mockResolvedValue({ exists: () => false });
  setDoc.mockResolvedValue(undefined);
  useVirtualChallengeStore.setState({ byUser: {}, loadedFor: null });
});
afterEach(() => warn.mockRestore());

describe('the catalogue', () => {
  it('is the same list the journey screens show', () => {
    expect(VIRTUAL_CHALLENGES).toBe(JOURNEYS);
  });
});

describe('mergeJourneys', () => {
  it('has every journey from either copy', () => {
    const a = { x: { startedAt: '2026-10-01', distanceKm: 3, completedAt: null } };
    const b = { y: { startedAt: '2026-10-02', distanceKm: 4, completedAt: null } };
    expect(mergeJourneys(a, b)).toEqual({ ...a, ...b });
    expect(mergeJourneys(a, undefined)).toEqual(a);
    expect(mergeJourneys(undefined, b)).toEqual(b);
    expect(mergeJourneys(undefined, undefined)).toEqual({});
  });

  it('keeps, for one in both, the further along: most distance, earliest start, earliest finish', () => {
    const a = { x: { startedAt: '2026-10-05T00:00:00Z', distanceKm: 3, completedAt: null } };
    const b = { x: { startedAt: '2026-10-01T00:00:00Z', distanceKm: 9, completedAt: '2026-10-09T00:00:00Z' } };
    expect(mergeJourneys(a, b)).toEqual({ x: { startedAt: '2026-10-01T00:00:00Z', distanceKm: 9, completedAt: '2026-10-09T00:00:00Z' } });
    expect(mergeJourneys(b, a)).toEqual(mergeJourneys(a, b));
  });

  it('takes the earlier finish when both are finished, and the only finish when one is', () => {
    const early = { x: { startedAt: 's', distanceKm: 34, completedAt: '2026-10-02' } };
    const late = { x: { startedAt: 's', distanceKm: 34, completedAt: '2026-10-08' } };
    expect(mergeJourneys(early, late).x.completedAt).toBe('2026-10-02');
    expect(mergeJourneys(late, early).x.completedAt).toBe('2026-10-02');
    const open = { x: { startedAt: 's', distanceKm: 5, completedAt: null } };
    expect(mergeJourneys(open, late).x.completedAt).toBe('2026-10-08');
    expect(mergeJourneys(late, open).x.completedAt).toBe('2026-10-08');
    expect(mergeJourneys(open, open).x.completedAt).toBeNull();
  });

  it('gives a journey no finish date as null, not as nothing, when neither copy has one', () => {
    const merged = mergeJourneys({ x: { startedAt: 'a', distanceKm: 1 } }, { x: { startedAt: 'b', distanceKm: 2 } });
    expect(merged.x.completedAt).toBeNull();
    expect(mergeJourneys({ x: { startedAt: 'a', distanceKm: 1, completedAt: null } }, { x: { startedAt: 'b', distanceKm: 2, completedAt: null } }).x.completedAt).toBeNull();
  });

  it('reads a distance that is not a number as nothing', () => {
    const a = { x: { startedAt: 's', distanceKm: 'far', completedAt: null } };
    const b = { x: { startedAt: 's', distanceKm: 4, completedAt: null } };
    expect(mergeJourneys(a, b).x.distanceKm).toBe(4);
    expect(mergeJourneys(a, a).x.distanceKm).toBe(0);
  });
});

describe('joining', () => {
  it('starts a journey at nothing, for that person', () => {
    expect(store().joinChallenge('grand-canyon-rim', 'u1')).toBe(true);
    expect(mine()['grand-canyon-rim']).toEqual({ startedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/), distanceKm: 0, completedAt: null });
    expect(mine('u2')).toEqual({});
  });

  it('does nothing for nobody, or for a route that does not exist', () => {
    expect(store().joinChallenge('grand-canyon-rim', '')).toBe(false);
    expect(store().joinChallenge('grand-canyon-rim', undefined)).toBe(false);
    expect(store().joinChallenge('nowhere', 'u1')).toBe(false);
    expect(store().byUser).toEqual({});
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('keeps the first start and the distance covered when joined again', () => {
    store().joinChallenge('grand-canyon-rim', 'u1');
    store().creditDistance(5, 'u1');
    const first = mine()['grand-canyon-rim'];
    expect(store().joinChallenge('grand-canyon-rim', 'u1')).toBe(true);
    expect(mine()['grand-canyon-rim']).toBe(first);
    expect(first.distanceKm).toBe(5);
  });

  it('keeps other journeys and other people as they were', () => {
    store().joinChallenge('grand-canyon-rim', 'u1');
    store().creditDistance(2, 'u1');
    store().joinChallenge('inca-trail', 'u1');
    store().joinChallenge('inca-trail', 'u2');
    expect(Object.keys(mine())).toEqual(['grand-canyon-rim', 'inca-trail']);
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(2);
    expect(Object.keys(mine('u2'))).toEqual(['inca-trail']);
  });

  it('is copied to the account once it has been read', async () => {
    await loaded();
    store().joinChallenge('grand-canyon-rim', 'u1');
    await flush();
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/u1/data/virtualChallenges' });
    expect(options).toEqual({ merge: true });
    expect(data.activeChallenges).toBe(mine());
    expect(data.updatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
});

describe('crediting a run', () => {
  const join = (...ids) => ids.forEach((id) => store().joinChallenge(id, 'u1'));

  it('adds the distance to every journey joined', () => {
    join('grand-canyon-rim', 'inca-trail');
    expect(store().creditDistance(5, 'u1')).toEqual({ completed: [] });
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(5);
    expect(mine()['inca-trail'].distanceKm).toBe(5);
    store().creditDistance(2.5, 'u1');
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(7.5);
    expect(mine()['inca-trail'].completedAt).toBeNull();
  });

  it('adds nothing to a journey not joined, or to somebody else\'s', () => {
    join('grand-canyon-rim');
    store().joinChallenge('inca-trail', 'u2');
    store().creditDistance(5, 'u1');
    expect(mine()['inca-trail']).toBeUndefined();
    expect(mine('u2')['inca-trail'].distanceKm).toBe(0);
  });

  it('ignores a distance that is not a positive number, and nobody', () => {
    join('grand-canyon-rim');
    for (const bad of [0, -3, NaN, Infinity, 'far', undefined, null]) {
      expect(store().creditDistance(bad, 'u1')).toEqual({ completed: [] });
    }
    expect(store().creditDistance(5, '')).toEqual({ completed: [] });
    expect(store().creditDistance(5, undefined)).toEqual({ completed: [] });
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(0);
  });

  it('writes nothing for a distance of zero', async () => {
    join('grand-canyon-rim');
    await loaded();
    store().creditDistance(0, 'u1');
    await flush();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('takes a distance given as text', () => {
    join('grand-canyon-rim');
    store().creditDistance('4.5', 'u1');
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(4.5);
  });

  it('changes nothing, and writes nothing, when no journey is joined', async () => {
    await loaded();
    const before = store().byUser;
    expect(store().creditDistance(5, 'u1')).toEqual({ completed: [] });
    expect(store().byUser).toBe(before);
    await flush();
    expect(setDoc).not.toHaveBeenCalled();
    expect(rewardJourney).not.toHaveBeenCalled();
  });

  it('finishes a journey at its length, once, and pays it', () => {
    join('grand-canyon-rim', 'inca-trail');
    store().creditDistance(30, 'u1');
    expect(rewardJourney).not.toHaveBeenCalled();
    const result = store().creditDistance(10, 'u1'); // 40: past the 34 of the canyon, short of the 43 of the Inca Trail
    expect(result).toEqual({ completed: ['grand-canyon-rim'] });
    expect(mine()['grand-canyon-rim']).toMatchObject({ distanceKm: 34, completedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) });
    expect(mine()['inca-trail']).toMatchObject({ distanceKm: 40, completedAt: null });
    expect(rewardJourney).toHaveBeenCalledTimes(1);
    expect(rewardJourney).toHaveBeenCalledWith(journeyById('grand-canyon-rim'), 'u1');
  });

  it('finishes at exactly the length', () => {
    join('grand-canyon-rim');
    store().creditDistance(34, 'u1');
    expect(mine()['grand-canyon-rim'].completedAt).not.toBeNull();
    expect(rewardJourney).toHaveBeenCalledTimes(1);
  });

  it('just short of the length is not finished', () => {
    join('grand-canyon-rim');
    store().creditDistance(33.99, 'u1');
    expect(mine()['grand-canyon-rim'].completedAt).toBeNull();
    expect(rewardJourney).not.toHaveBeenCalled();
  });

  it('does not add to a finished journey again, or pay it again', () => {
    join('grand-canyon-rim', 'inca-trail');
    store().creditDistance(34, 'u1');
    const finished = mine()['grand-canyon-rim'];
    expect(store().creditDistance(5, 'u1')).toEqual({ completed: [] });
    expect(mine()['grand-canyon-rim']).toBe(finished);
    expect(mine()['inca-trail'].distanceKm).toBe(39);
    expect(rewardJourney).toHaveBeenCalledTimes(1);
  });

  it('can finish several journeys with one run', () => {
    join('grand-canyon-rim', 'marathon-to-athens', 'camino-frances');
    expect(store().creditDistance(45, 'u1').completed).toEqual(['grand-canyon-rim', 'marathon-to-athens']);
    expect(rewardJourney).toHaveBeenCalledTimes(2);
    expect(mine()['camino-frances'].distanceKm).toBe(45);
  });

  it('counts a saved journey whose distance is missing or damaged from nothing', () => {
    useVirtualChallengeStore.setState({
      byUser: { u1: { 'grand-canyon-rim': { startedAt: 's' }, 'inca-trail': { startedAt: 's', distanceKm: 'far', completedAt: null } } },
    });
    store().creditDistance(5, 'u1');
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(5);
    expect(mine()['inca-trail'].distanceKm).toBe(5);
  });

  it('leaves a saved journey it does not know as it was', () => {
    useVirtualChallengeStore.setState({ byUser: { u1: { 'from-the-future': { startedAt: 's', distanceKm: 3, completedAt: null } } } });
    store().creditDistance(5, 'u1');
    expect(mine()['from-the-future']).toEqual({ startedAt: 's', distanceKm: 3, completedAt: null });
    expect(rewardJourney).not.toHaveBeenCalled();
  });

  it('is copied to the account once it has been read', async () => {
    join('grand-canyon-rim');
    await loaded();
    store().creditDistance(5, 'u1');
    await flush();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].distanceKm).toBe(5);
  });
});

describe('loading from the account', () => {
  it('reads the person\'s own document and takes what it holds', async () => {
    const record = { startedAt: '2026-10-01T00:00:00Z', distanceKm: 12, completedAt: null };
    remoteHas({ 'grand-canyon-rim': record });
    expect(await store().loadChallenges('u1')).toBe(true);
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/virtualChallenges' });
    expect(mine()).toEqual({ 'grand-canyon-rim': record });
    expect(store().loadedFor).toBe('u1');
    expect(setDoc).not.toHaveBeenCalled(); // nothing the account lacks
  });

  it('starts from nothing when the account has nothing', async () => {
    expect(await store().loadChallenges('u1')).toBe(true);
    expect(mine()).toEqual({});
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('copes with a document that has no journeys in it', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    expect(await store().loadChallenges('u1')).toBe(true);
    expect(mine()).toEqual({});
  });

  it('sends the phone\'s journeys to a document that has none in it', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    store().joinChallenge('grand-canyon-rim', 'u1');
    await flush();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(Object.keys(setDoc.mock.calls[0][1].activeChallenges)).toEqual(['grand-canyon-rim']);
  });

  it('sends the account an earlier start, even when the distance is the same', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: '2026-10-05T00:00:00Z', distanceKm: 3, completedAt: null } });
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: '2026-10-01T00:00:00Z', distanceKm: 3, completedAt: null } } } });
    await store().loadChallenges('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].startedAt).toBe('2026-10-01T00:00:00Z');
  });

  it('sends the account a finish it lacks, even when the distance is the same', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: 's', distanceKm: 34, completedAt: null } });
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: 's', distanceKm: 34, completedAt: '2026-10-09T00:00:00Z' } } } });
    await store().loadChallenges('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].completedAt).toBe('2026-10-09T00:00:00Z');
  });

  it('sends nothing when the account only lacks a finish date field that the phone has as null', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: 's', distanceKm: 3 } });
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: 's', distanceKm: 3, completedAt: null } } } });
    await store().loadChallenges('u1');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('joins the phone\'s journeys with the account\'s, and sends the account what it lacks', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: '2026-10-01T00:00:00Z', distanceKm: 12, completedAt: null } });
    store().joinChallenge('inca-trail', 'u1'); // the phone reads the account as soon as it has something to send
    store().creditDistance(7, 'u1');
    await store().loadChallenges('u1');
    expect(Object.keys(mine()).sort()).toEqual(['grand-canyon-rim', 'inca-trail']);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(Object.keys(setDoc.mock.calls[0][1].activeChallenges).sort()).toEqual(['grand-canyon-rim', 'inca-trail']);
  });

  it('keeps the further along of the two copies, and never writes the nearer one over it', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: '2026-10-01T00:00:00Z', distanceKm: 20, completedAt: null } });
    store().joinChallenge('grand-canyon-rim', 'u1');
    store().creditDistance(5, 'u1');
    await store().loadChallenges('u1');
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(20);
    expect(setDoc).not.toHaveBeenCalled(); // the account already has the further copy
  });

  it('sends the account the phone\'s copy when the phone is further along', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: '2026-10-01T00:00:00Z', distanceKm: 3, completedAt: null } });
    store().joinChallenge('grand-canyon-rim', 'u1');
    store().creditDistance(25, 'u1');
    await store().loadChallenges('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].distanceKm).toBe(25);
  });

  it('reads once for a person each time the app opens', async () => {
    await store().loadChallenges('u1');
    await store().loadChallenges('u1');
    expect(getDoc).toHaveBeenCalledTimes(1);
    await store().loadChallenges('u2');
    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(store().loadedFor).toBe('u2');
    await store().loadChallenges('u1'); // u1 again after u2 has been in
    expect(getDoc).toHaveBeenCalledTimes(3);
  });

  it('shares one read between two calls made together', async () => {
    const [a, b] = await Promise.all([store().loadChallenges('u1'), store().loadChallenges('u1')]);
    expect([a, b]).toEqual([true, true]);
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it('keeps sharing a person\'s read after another person\'s read has finished', async () => {
    const pending = [];
    getDoc.mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
    const first = store().loadChallenges('u1');
    const second = store().loadChallenges('u2');
    pending[0]({ exists: () => false });
    await first;
    const again = store().loadChallenges('u2'); // u2's read is still under way
    expect(getDoc).toHaveBeenCalledTimes(2);
    pending[1]({ exists: () => false });
    expect(await Promise.all([second, again])).toEqual([true, true]);
  });

  it('reads separately for two people at once', async () => {
    await Promise.all([store().loadChallenges('u1'), store().loadChallenges('u2')]);
    expect(getDoc).toHaveBeenCalledTimes(2);
  });

  it('says false, keeps the phone\'s journeys and tries again next time when there is no signal', async () => {
    getDoc.mockRejectedValueOnce(new Error('offline'));
    store().joinChallenge('grand-canyon-rim', 'u1');
    expect(await store().loadChallenges('u1')).toBe(false);
    expect(store().loadedFor).toBeNull();
    expect(mine()['grand-canyon-rim']).toBeDefined();
    expect(warn).toHaveBeenCalledWith('[virtualChallengeStore] loadChallenges error:', 'offline');
    expect(await store().loadChallenges('u1')).toBe(true);
    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(store().loadedFor).toBe('u1');
  });

  it('does not let one person\'s journeys into another\'s', async () => {
    store().joinChallenge('grand-canyon-rim', 'u1');
    remoteHas({ 'inca-trail': { startedAt: 's', distanceKm: 1, completedAt: null } });
    await store().loadChallenges('u2');
    expect(Object.keys(mine('u2'))).toEqual(['inca-trail']);
    expect(Object.keys(mine('u1'))).toEqual(['grand-canyon-rim']);
  });

  it('does nothing without a person', async () => {
    expect(await store().loadChallenges('')).toBe(false);
    expect(await store().loadChallenges(undefined)).toBe(false);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('copying to the account', () => {
  it('reads the account first, and does not write over a copy that is further on', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: '2026-10-01T00:00:00Z', distanceKm: 20, completedAt: null } });
    store().joinChallenge('grand-canyon-rim', 'u1'); // a phone that has not read the account yet
    await flush();
    await flush();
    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(20);
    expect(setDoc).not.toHaveBeenCalled(); // nothing the account lacks, and certainly not the nearer copy
  });

  it('writes nothing when the account could not be read, and sends it all next time', async () => {
    getDoc.mockRejectedValueOnce(new Error('offline'));
    store().joinChallenge('grand-canyon-rim', 'u1');
    store().creditDistance(5, 'u1');
    await flush();
    await flush();
    expect(setDoc).not.toHaveBeenCalled();
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(5);
    await store().loadChallenges('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].distanceKm).toBe(5);
  });

  it('says so, and carries on, when the write fails', async () => {
    await loaded();
    setDoc.mockRejectedValueOnce(new Error('denied'));
    store().joinChallenge('grand-canyon-rim', 'u1');
    await flush();
    expect(warn).toHaveBeenCalledWith('[virtualChallengeStore] persist error:', 'denied');
    expect(mine()['grand-canyon-rim']).toBeDefined();
  });

  it('writes nothing for nobody', async () => {
    await store()._persist('');
    await store()._persist(undefined);
    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('what stays on the phone', () => {
  it('is the journeys, and not whose account was read', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.setItem.mockClear();
    await loaded();
    store().joinChallenge('grand-canyon-rim', 'u1');
    await flush();
    const saved = AsyncStorage.setItem.mock.calls.filter(([key]) => key === 'zown-virtual-journeys').map(([, value]) => JSON.parse(value));
    expect(saved.length).toBeGreaterThan(0);
    const last = saved[saved.length - 1].state;
    expect(Object.keys(last)).toEqual(['byUser']);
    expect(last.byUser.u1['grand-canyon-rim'].distanceKm).toBe(0);
  });
});

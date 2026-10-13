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
import { JOURNEYS, journeyById, isActiveRecord } from '../lib/virtualJourneys';

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

describe('mergeJourneys with a journey that was left', () => {
  const Oct = (day) => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;
  const active = (startedAt, distanceKm) => ({ startedAt, distanceKm, completedAt: null });
  const left = (startedAt, leftAt) => ({ startedAt, distanceKm: 0, completedAt: null, leftAt });
  const both = (a, b) => {
    const merged = mergeJourneys({ x: a }, { x: b }).x;
    expect(mergeJourneys({ x: b }, { x: a }).x).toEqual(merged); // the same whichever copy is which
    return merged;
  };

  it('keeps a journey left on one phone as left, even though another phone is further along', () => {
    expect(both(left(Oct(2), Oct(5)), active(Oct(1), 12))).toEqual({ startedAt: Oct(2), distanceKm: 0, completedAt: null, leftAt: Oct(5) });
  });

  it('keeps a left journey as left when both phones know of the leave', () => {
    expect(both(left(Oct(2), Oct(5)), left(Oct(2), Oct(5)))).toEqual(left(Oct(2), Oct(5)));
  });

  it('takes the later leave when the phones left at different times', () => {
    expect(both(left(Oct(1), Oct(4)), left(Oct(2), Oct(6)))).toEqual({ startedAt: Oct(2), distanceKm: 0, completedAt: null, leftAt: Oct(6) });
  });

  it('keeps a journey joined again after a leave, and not the distance from before it', () => {
    const rejoined = { startedAt: Oct(7), distanceKm: 3, completedAt: null, leftAt: Oct(5) };
    expect(both(rejoined, active(Oct(1), 12))).toEqual(rejoined);
    expect(both(rejoined, left(Oct(2), Oct(5)))).toEqual(rejoined);
  });

  it('joins two phones that both joined again after the leave: the further along', () => {
    const a = { startedAt: Oct(8), distanceKm: 3, completedAt: null, leftAt: Oct(5) };
    const b = { startedAt: Oct(7), distanceKm: 9, completedAt: null, leftAt: Oct(5) };
    expect(both(a, b)).toEqual({ startedAt: Oct(7), distanceKm: 9, completedAt: null, leftAt: Oct(5) });
  });

  it('joins a journey joined again on one phone with another that started after the leave', () => {
    const a = { startedAt: Oct(7), distanceKm: 3, completedAt: null, leftAt: Oct(5) };
    expect(both(a, active(Oct(8), 6))).toEqual({ startedAt: Oct(7), distanceKm: 6, completedAt: null, leftAt: Oct(5) });
  });

  it('does not let a leave undo a journey that was finished', () => {
    const finished = { startedAt: Oct(1), distanceKm: 21, completedAt: Oct(4) };
    expect(both(finished, left(Oct(1), Oct(5)))).toEqual({ startedAt: Oct(1), distanceKm: 21, completedAt: Oct(4) });
  });

  it('counts nothing from a copy that began at the very moment of the leave', () => {
    expect(both(left(Oct(5), Oct(5)), active(Oct(5), 4))).toEqual({ startedAt: Oct(5), distanceKm: 0, completedAt: null, leftAt: Oct(5) });
  });

  it('keeps a journey that is on one phone only, left or not', () => {
    const gone = left(Oct(2), Oct(5));
    expect(mergeJourneys({ x: gone }, {}).x).toBe(gone);
    expect(mergeJourneys({}, { x: gone }).x).toBe(gone);
  });

  it('gives no leave to a journey nobody left', () => {
    expect(mergeJourneys({ x: active(Oct(1), 2) }, { x: active(Oct(2), 5) }).x).toEqual({ startedAt: Oct(1), distanceKm: 5, completedAt: null });
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

describe('leaving', () => {
  const join = (...ids) => ids.forEach((id) => store().joinChallenge(id, 'u1'));
  const clockAt = (iso) => jest.useFakeTimers({ now: new Date(iso).getTime(), doNotFake: ['setImmediate', 'nextTick'] });
  afterEach(() => jest.useRealTimers());

  it('clears what was covered and marks the journey left, keeping when it was started', () => {
    clockAt('2026-10-01T10:00:00.000Z');
    join('grand-canyon-rim');
    store().creditDistance(7, 'u1');
    clockAt('2026-10-05T10:00:00.000Z');
    expect(store().leaveChallenge('grand-canyon-rim', 'u1')).toBe(true);
    expect(mine()['grand-canyon-rim']).toEqual({
      startedAt: '2026-10-01T10:00:00.000Z', distanceKm: 0, completedAt: null, leftAt: '2026-10-05T10:00:00.000Z',
    });
  });

  it('leaves the person\'s other journeys, and other people, alone', () => {
    join('grand-canyon-rim', 'inca-trail');
    store().joinChallenge('grand-canyon-rim', 'u2');
    store().creditDistance(7, 'u1');
    const inca = mine()['inca-trail'];
    store().leaveChallenge('grand-canyon-rim', 'u1');
    expect(mine()['inca-trail']).toBe(inca);
    expect(mine('u2')['grand-canyon-rim'].leftAt).toBeUndefined();
  });

  it('does nothing for nobody, a journey not joined, one already left, or an unknown one', () => {
    join('grand-canyon-rim');
    expect(store().leaveChallenge('grand-canyon-rim', '')).toBe(false);
    expect(store().leaveChallenge('grand-canyon-rim', undefined)).toBe(false);
    expect(store().leaveChallenge('inca-trail', 'u1')).toBe(false);
    expect(store().leaveChallenge('nowhere', 'u1')).toBe(false);
    expect(store().leaveChallenge('grand-canyon-rim', 'u2')).toBe(false);
    expect(Object.keys(mine())).toEqual(['grand-canyon-rim']);
    expect(mine()['grand-canyon-rim'].leftAt).toBeUndefined();
    expect(store().leaveChallenge('grand-canyon-rim', 'u1')).toBe(true);
    const gone = mine()['grand-canyon-rim'];
    expect(store().leaveChallenge('grand-canyon-rim', 'u1')).toBe(false);
    expect(mine()['grand-canyon-rim']).toBe(gone);
  });

  it('cannot leave a journey that is finished', async () => {
    join('grand-canyon-rim');
    store().creditDistance(21, 'u1');
    await loaded();
    const finished = mine()['grand-canyon-rim'];
    expect(store().leaveChallenge('grand-canyon-rim', 'u1')).toBe(false);
    expect(mine()['grand-canyon-rim']).toBe(finished);
    await flush();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is not before the start, even if the clock has gone back', () => {
    clockAt('2026-10-05T10:00:00.000Z');
    join('grand-canyon-rim');
    clockAt('2026-10-01T10:00:00.000Z');
    store().leaveChallenge('grand-canyon-rim', 'u1');
    expect(mine()['grand-canyon-rim'].leftAt).toBe('2026-10-05T10:00:00.000Z');
    expect(isActiveRecord(mine()['grand-canyon-rim'])).toBe(false);
  });

  it('is left at once, even in the same moment as it was joined', () => {
    clockAt('2026-10-05T10:00:00.000Z');
    join('grand-canyon-rim');
    store().leaveChallenge('grand-canyon-rim', 'u1');
    expect(isActiveRecord(mine()['grand-canyon-rim'])).toBe(false);
  });

  it('stops later runs counting toward it', async () => {
    join('grand-canyon-rim', 'inca-trail');
    store().leaveChallenge('grand-canyon-rim', 'u1');
    await loaded();
    expect(store().creditDistance(30, 'u1')).toEqual({ completed: [] });
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(0);
    expect(mine()['inca-trail'].distanceKm).toBe(30);
    expect(rewardJourney).not.toHaveBeenCalled();
  });

  it('writes nothing for a run when the only journey joined has been left', async () => {
    join('grand-canyon-rim');
    store().leaveChallenge('grand-canyon-rim', 'u1');
    await loaded();
    store().creditDistance(5, 'u1');
    await flush();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is copied to the account once it has been read', async () => {
    join('grand-canyon-rim');
    await loaded();
    store().leaveChallenge('grand-canyon-rim', 'u1');
    await flush();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim']).toMatchObject({ distanceKm: 0, leftAt: expect.any(String) });
  });

  describe('and joining again', () => {
    it('starts from nothing, after the leave, and keeps the leave', () => {
      clockAt('2026-10-01T10:00:00.000Z');
      join('grand-canyon-rim');
      store().creditDistance(7, 'u1');
      clockAt('2026-10-05T10:00:00.000Z');
      store().leaveChallenge('grand-canyon-rim', 'u1');
      clockAt('2026-10-09T10:00:00.000Z');
      expect(store().joinChallenge('grand-canyon-rim', 'u1')).toBe(true);
      expect(mine()['grand-canyon-rim']).toEqual({
        startedAt: '2026-10-09T10:00:00.000Z', distanceKm: 0, completedAt: null, leftAt: '2026-10-05T10:00:00.000Z',
      });
    });

    it('counts runs again', () => {
      join('grand-canyon-rim');
      store().leaveChallenge('grand-canyon-rim', 'u1');
      jest.useFakeTimers({ now: Date.now() + 1000, doNotFake: ['setImmediate', 'nextTick'] });
      store().joinChallenge('grand-canyon-rim', 'u1');
      store().creditDistance(6, 'u1');
      expect(mine()['grand-canyon-rim'].distanceKm).toBe(6);
    });

    it('is after the leave even in the very same moment', () => {
      clockAt('2026-10-05T10:00:00.000Z');
      join('grand-canyon-rim');
      store().leaveChallenge('grand-canyon-rim', 'u1');
      store().joinChallenge('grand-canyon-rim', 'u1');
      const record = mine()['grand-canyon-rim'];
      expect(record.startedAt).toBe('2026-10-05T10:00:00.001Z');
      expect(isActiveRecord(record)).toBe(true);
    });

    it('is after the leave even if the clock has gone back', () => {
      clockAt('2026-10-05T10:00:00.000Z');
      join('grand-canyon-rim');
      store().leaveChallenge('grand-canyon-rim', 'u1');
      clockAt('2026-09-01T10:00:00.000Z');
      store().joinChallenge('grand-canyon-rim', 'u1');
      expect(isActiveRecord(mine()['grand-canyon-rim'])).toBe(true);
    });

    it('is not undone by an older copy of the journey from before it was left', async () => {
      clockAt('2026-10-01T10:00:00.000Z');
      remoteHas({ 'grand-canyon-rim': { startedAt: '2026-10-01T10:00:00.000Z', distanceKm: 12, completedAt: null } });
      join('grand-canyon-rim');
      clockAt('2026-10-05T10:00:00.000Z');
      store().leaveChallenge('grand-canyon-rim', 'u1');
      clockAt('2026-10-09T10:00:00.000Z');
      store().joinChallenge('grand-canyon-rim', 'u1');
      await store().loadChallenges('u1'); // the account still holds the old copy
      expect(mine()['grand-canyon-rim']).toMatchObject({ distanceKm: 0, startedAt: '2026-10-09T10:00:00.000Z', leftAt: '2026-10-05T10:00:00.000Z' });
    });
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
    store().creditDistance(15, 'u1');
    expect(rewardJourney).not.toHaveBeenCalled();
    const result = store().creditDistance(10, 'u1'); // 25: past the 21 of the Rim Trail, short of the 43 of the Inca Trail
    expect(result).toEqual({ completed: ['grand-canyon-rim'] });
    expect(mine()['grand-canyon-rim']).toMatchObject({ distanceKm: 21, completedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) });
    expect(mine()['inca-trail']).toMatchObject({ distanceKm: 25, completedAt: null });
    expect(rewardJourney).toHaveBeenCalledTimes(1);
    expect(rewardJourney).toHaveBeenCalledWith(journeyById('grand-canyon-rim'), 'u1');
  });

  it('finishes at exactly the length', () => {
    join('grand-canyon-rim');
    store().creditDistance(21, 'u1');
    expect(mine()['grand-canyon-rim'].completedAt).not.toBeNull();
    expect(rewardJourney).toHaveBeenCalledTimes(1);
  });

  it('just short of the length is not finished', () => {
    join('grand-canyon-rim');
    store().creditDistance(20.99, 'u1');
    expect(mine()['grand-canyon-rim'].completedAt).toBeNull();
    expect(rewardJourney).not.toHaveBeenCalled();
  });

  it('does not add to a finished journey again, or pay it again', () => {
    join('grand-canyon-rim', 'inca-trail');
    store().creditDistance(21, 'u1');
    const finished = mine()['grand-canyon-rim'];
    expect(store().creditDistance(5, 'u1')).toEqual({ completed: [] });
    expect(mine()['grand-canyon-rim']).toBe(finished);
    expect(mine()['inca-trail'].distanceKm).toBe(26);
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
    remoteHas({ 'grand-canyon-rim': { startedAt: 's', distanceKm: 21, completedAt: null } });
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: 's', distanceKm: 21, completedAt: '2026-10-09T00:00:00Z' } } } });
    await store().loadChallenges('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].completedAt).toBe('2026-10-09T00:00:00Z');
  });

  it('sends nothing when the account only lacks a finish date field that the phone has as null', async () => {
    remoteHas({ 'grand-canyon-rim': { startedAt: 's', distanceKm: 3, leftAt: null } });
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
    store().creditDistance(15, 'u1');
    await store().loadChallenges('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].distanceKm).toBe(15);
  });

  it('does not bring back a journey left on another phone', async () => {
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: '2026-10-01T10:00:00.000Z', distanceKm: 12, completedAt: null } } } });
    remoteHas({ 'grand-canyon-rim': { startedAt: '2026-10-02T10:00:00.000Z', distanceKm: 0, completedAt: null, leftAt: '2026-10-05T10:00:00.000Z' } });
    await store().loadChallenges('u1');
    expect(isActiveRecord(mine()['grand-canyon-rim'])).toBe(false);
    expect(mine()['grand-canyon-rim'].distanceKm).toBe(0);
    expect(setDoc).not.toHaveBeenCalled(); // the account already has it as left
  });

  it('tells the account about a leave made on this phone, even with the same start and distance', async () => {
    useVirtualChallengeStore.setState({ byUser: { u1: { 'grand-canyon-rim': { startedAt: 's', distanceKm: 0, completedAt: null, leftAt: 't' } } } });
    remoteHas({ 'grand-canyon-rim': { startedAt: 's', distanceKm: 0, completedAt: null } });
    await store().loadChallenges('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].activeChallenges['grand-canyon-rim'].leftAt).toBe('t');
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

jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ collection: name })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  query: jest.fn((...parts) => ({ query: parts })),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));
jest.mock('../store/expStore', () => ({
  useExpStore: { getState: () => global.__exp },
  baseExpValues: { virtualRace: 750 },
}));
jest.mock('../store/badgeStore', () => ({
  useBadgeStore: { getState: () => global.__badges },
}));
jest.mock('../store/settingsStore', () => ({
  useSettingsStore: { getState: () => global.__settings },
}));

import { getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useVirtualRaceStore } from '../store/virtualRaceStore';
import { finishRace, publishMyRaces, withdrawMyRaces, RACE_BADGE_ID } from '../services/raceBoard';
import { currentRace, areaOf, raceEntryId } from '../lib/virtualRaces';

const localRace = currentRace('local', new Date(2026, 9, 14, 10));
const worldRace = currentRace('world', new Date(Date.UTC(2026, 9, 14, 10)));
const NOW = Date.UTC(2026, 9, 14, 10, 30); // inside both races (local: the phone's own week)
const user = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png' };
const route = [{ latitude: 40.05, longitude: -74.05 }, { latitude: 40.06, longitude: -74.04 }];
const splits5k = [300, 300, 300, 300, 300]; // 25:00
const splits10k = [310, 310, 310, 310, 310, 310, 310, 310, 310, 310]; // 51:40
const store = () => useVirtualRaceStore.getState();

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [getDoc, setDoc, deleteDoc].forEach((fn) => fn.mockClear());
  getDoc.mockResolvedValue({ exists: () => false });
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  global.__exp = { addExpActivity: jest.fn() };
  global.__badges = { unlockBadge: jest.fn() };
  global.__settings = { showInLeaderboards: true };
  useVirtualRaceStore.setState({ joined: {}, finished: {}, boards: {} });
});
afterEach(() => warn.mockRestore());

const finishLocal = (over = {}) => finishRace({ race: localRace, user, splits: splits5k, coords: route, now: NOW, ...over });

describe('finishRace: a finish that counts', () => {
  it('posts the time with the map square the run started in, and says so', async () => {
    const result = await finishLocal();
    expect(result).toEqual({ status: 'finished', timeSec: 1500, bestSec: 1500, first: true, improved: false, posted: 'posted' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: `raceEntries/${localRace.id}_u1` });
    expect(data).toMatchObject({
      raceId: localRace.id, uid: 'u1', kind: 'local', timeSec: 1500, name: 'Cj',
      areaId: areaOf(route[0]), finishedAt: new Date(NOW).toISOString(),
    });
    expect(data.areaId).toBe('1300x1059');
  });

  it('puts a local run in the square where it started, not where it went next', async () => {
    const farAway = [{ latitude: 40.05, longitude: -74.05 }, { latitude: 41.5, longitude: -72.5 }, { latitude: 41.6, longitude: -72.4 }];
    expect(areaOf(farAway[1])).not.toBe(areaOf(farAway[0]));
    await finishLocal({ coords: farAway });
    expect(setDoc.mock.calls[0][1].areaId).toBe(areaOf(farAway[0]));
    expect(store().finished[raceEntryId(localRace.id, 'u1')].areaId).toBe(areaOf(farAway[0]));
  });

  it('uses the kilometres of the run up to the line, not what comes after', async () => {
    const result = await finishLocal({ splits: [300, 300, 300, 300, 300, 100, 100] });
    expect(result.timeSec).toBe(1500);
  });

  it('posts the worldwide time with no map square', async () => {
    const result = await finishRace({ race: worldRace, user, splits: splits10k, coords: route, now: NOW });
    expect(result).toMatchObject({ status: 'finished', timeSec: 3100, first: true, posted: 'posted' });
    expect(setDoc.mock.calls[0][1]).toMatchObject({ kind: 'world', distanceKm: 10, areaId: null, timeSec: 3100 });
  });

  it('works for the worldwide race with no route at all', async () => {
    const result = await finishRace({ race: worldRace, user, splits: splits10k, now: NOW });
    expect(result.posted).toBe('posted');
  });

  it('keeps a map square for the local race only', async () => {
    await finishLocal();
    await finishRace({ race: worldRace, user, splits: splits10k, coords: route, now: NOW });
    expect(store().finished[raceEntryId(localRace.id, 'u1')].areaId).toBe('1300x1059');
    expect(store().finished[raceEntryId(worldRace.id, 'u1')].areaId).toBeNull();
  });

  it('keeps the time, the finish moment and which race it was', async () => {
    await finishLocal();
    expect(store().finished[raceEntryId(localRace.id, 'u1')]).toEqual({
      raceId: localRace.id, kind: 'local', distanceKm: 5, timeSec: 1500,
      finishedAt: new Date(NOW).toISOString(), areaId: '1300x1059', posted: true,
    });
  });

  it('uses the clock for the time of the finish when none is given', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      const result = await finishRace({ race: worldRace, user, splits: splits10k });
      expect(result.status).toBe('finished');
      expect(setDoc.mock.calls[0][1].finishedAt).toBe(new Date(NOW).toISOString());
    } finally {
      spy.mockRestore();
    }
  });
});

describe('finishRace: the reward for a first finish', () => {
  it('gives the race XP and the Race Day badge, once, to the person who finished', async () => {
    await finishLocal();
    expect(global.__exp.addExpActivity).toHaveBeenCalledTimes(1);
    expect(global.__exp.addExpActivity).toHaveBeenCalledWith({
      id: `race-${localRace.id}`,
      type: 'running',
      baseExp: 750,
      multiplier: 1.0,
      date: '2026-10-14',
      description: 'Finished the Local 5K',
      completed: true,
    }, 'u1');
    expect(RACE_BADGE_ID).toBe('badge-14');
    expect(global.__badges.unlockBadge).toHaveBeenCalledWith('badge-14', 'u1');
  });

  it('names the worldwide race in the XP entry', async () => {
    await finishRace({ race: worldRace, user, splits: splits10k, coords: route, now: NOW });
    expect(global.__exp.addExpActivity.mock.calls[0][0].description).toBe('Finished the Worldwide 10K');
  });

  it('does not give it again for a slower run, the same time or a faster one', async () => {
    await finishLocal();
    await finishLocal({ splits: [310, 310, 310, 310, 310] });
    await finishLocal({ splits: [300, 300, 300, 300, 300] });
    await finishLocal({ splits: [290, 290, 290, 290, 290] });
    expect(global.__exp.addExpActivity).toHaveBeenCalledTimes(1);
    expect(global.__badges.unlockBadge).toHaveBeenCalledTimes(1);
  });

  it('gives it again for the next race, which is a first finish of that race', async () => {
    await finishLocal();
    await finishRace({ race: worldRace, user, splits: splits10k, coords: route, now: NOW });
    expect(global.__exp.addExpActivity).toHaveBeenCalledTimes(2);
  });

  it('gives it even when the person is hidden from the leaderboards', async () => {
    global.__settings.showInLeaderboards = false;
    await finishLocal();
    expect(global.__exp.addExpActivity).toHaveBeenCalledTimes(1);
    expect(global.__badges.unlockBadge).toHaveBeenCalledTimes(1);
  });

  it('still gives the badge when the XP fails, and still finishes when either fails', async () => {
    global.__exp.addExpActivity = jest.fn(() => { throw new Error('xp down'); });
    const result = await finishLocal();
    expect(global.__badges.unlockBadge).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('finished');
    expect(warn).toHaveBeenCalledTimes(1);
    global.__exp.addExpActivity = jest.fn();
    global.__badges.unlockBadge = jest.fn(() => { throw new Error('badge down'); });
    useVirtualRaceStore.setState({ finished: {} });
    expect((await finishLocal()).posted).toBe('posted');
    expect(global.__exp.addExpActivity).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('finishRace: a second run of the same race', () => {
  it('keeps your best and does not post a slower time', async () => {
    await finishLocal();
    setDoc.mockClear();
    const result = await finishLocal({ splits: [310, 310, 310, 310, 310], now: NOW + 3600000 });
    expect(result).toEqual({ status: 'finished', timeSec: 1550, bestSec: 1500, first: false, improved: false, posted: 'posted' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('posts a faster time', async () => {
    await finishLocal();
    setDoc.mockClear();
    const result = await finishLocal({ splits: [290, 290, 290, 290, 290], now: NOW + 3600000 });
    expect(result).toMatchObject({ timeSec: 1450, bestSec: 1450, first: false, improved: true, posted: 'posted' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].timeSec).toBe(1450);
  });

  it('sends the best, not the slower run, when the best never got posted', async () => {
    global.__settings.showInLeaderboards = false;
    await finishLocal();
    global.__settings.showInLeaderboards = true;
    const result = await finishLocal({ splits: [310, 310, 310, 310, 310], now: NOW + 3600000 });
    expect(result).toMatchObject({ bestSec: 1500, first: false, improved: false, posted: 'posted' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].timeSec).toBe(1500);
  });
});

describe('finishRace: when the time is not posted', () => {
  it('keeps it on the phone and posts nothing while the person is hidden from leaderboards', async () => {
    global.__settings.showInLeaderboards = false;
    const result = await finishLocal();
    expect(result).toMatchObject({ status: 'finished', timeSec: 1500, first: true, posted: 'hidden' });
    expect(setDoc).not.toHaveBeenCalled();
    expect(getDoc).not.toHaveBeenCalled();
    expect(store().finished[raceEntryId(localRace.id, 'u1')]).toMatchObject({ timeSec: 1500, posted: false });
  });

  it('posts when the setting was never touched', async () => {
    global.__settings = {};
    expect((await finishLocal()).posted).toBe('posted');
  });

  it('says failed, keeps the time and tries again later, when the post does not go through', async () => {
    setDoc.mockRejectedValueOnce(new Error('offline'));
    const result = await finishLocal();
    expect(result).toMatchObject({ status: 'finished', posted: 'failed' });
    expect(store().finished[raceEntryId(localRace.id, 'u1')]).toMatchObject({ timeSec: 1500, posted: false });
    expect(await publishMyRaces({ user })).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(store().finished[raceEntryId(localRace.id, 'u1')].posted).toBe(true);
  });

  it('says there was no map square when the local run has no route', async () => {
    const result = await finishLocal({ coords: [] });
    expect(result).toMatchObject({ status: 'finished', posted: 'noArea' });
    expect((await finishLocal({ coords: undefined })).posted).toBe('noArea');
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('finishRace: a finish that does not count', () => {
  const untouched = () => {
    expect(setDoc).not.toHaveBeenCalled();
    expect(store().finished).toEqual({});
    expect(global.__exp.addExpActivity).not.toHaveBeenCalled();
    expect(global.__badges.unlockBadge).not.toHaveBeenCalled();
  };

  it('is unfinished before the distance is done, or with nothing to go on', async () => {
    expect(await finishLocal({ splits: [300, 300, 300, 300] })).toEqual({ status: 'unfinished' });
    expect(await finishLocal({ splits: [] })).toEqual({ status: 'unfinished' });
    expect(await finishLocal({ splits: undefined })).toEqual({ status: 'unfinished' });
    expect(await finishRace({ user, splits: splits5k, now: NOW })).toEqual({ status: 'unfinished' });
    expect(await finishRace()).toEqual({ status: 'unfinished' });
    untouched();
  });

  it('is not counted when the pace is faster than a person can run', async () => {
    const result = await finishLocal({ splits: [60, 60, 60, 60, 60] }); // a car
    expect(result).toEqual({ status: 'implausible', timeSec: 300 });
    untouched();
  });

  it('is not counted when the race had ended', async () => {
    const result = await finishRace({ race: worldRace, user, splits: splits10k, coords: route, now: worldRace.endsAt });
    expect(result).toEqual({ status: 'closed', timeSec: 3100 });
    expect((await finishRace({ race: worldRace, user, splits: splits10k, coords: route, now: worldRace.startsAt - 1 })).status).toBe('closed');
    untouched();
  });

  it('is not counted with nobody signed in', async () => {
    expect(await finishLocal({ user: null })).toEqual({ status: 'signedOut', timeSec: 1500 });
    expect(await finishLocal({ user: {} })).toEqual({ status: 'signedOut', timeSec: 1500 });
    untouched();
  });
});

describe('publishMyRaces', () => {
  const keep = (race, uid = 'u1', timeSec = 1500, areaId = 'a') => store().recordFinish(race, uid, { timeSec, finishedAt: '2026-10-14T10:00:00Z', areaId });

  it('sends the results that have not reached the board, and says all went', async () => {
    keep(localRace);
    keep(worldRace, 'u1', 3100);
    keep(localRace, 'u2');
    expect(await publishMyRaces({ user })).toBe(true);
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(setDoc.mock.calls.map((c) => c[0].path).sort()).toEqual([`raceEntries/${localRace.id}_u1`, `raceEntries/${worldRace.id}_u1`].sort());
  });

  it('does not send one that is already there', async () => {
    keep(localRace);
    await publishMyRaces({ user });
    setDoc.mockClear();
    expect(await publishMyRaces({ user })).toBe(true);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('says not everything went when a post fails', async () => {
    keep(localRace);
    setDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await publishMyRaces({ user })).toBe(false);
  });

  it('does not count a local result with no map square, which can never be posted', async () => {
    keep(localRace, 'u1', 1500, null);
    expect(await publishMyRaces({ user })).toBe(true);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does nothing while the person is hidden from leaderboards', async () => {
    keep(localRace);
    global.__settings.showInLeaderboards = false;
    expect(await publishMyRaces({ user })).toBe(true);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is true when nothing is waiting, and false with nobody signed in', async () => {
    expect(await publishMyRaces({ user })).toBe(true);
    expect(await publishMyRaces({})).toBe(false);
    expect(await publishMyRaces({ user: {} })).toBe(false);
    expect(await publishMyRaces()).toBe(false);
  });
});

describe('withdrawMyRaces', () => {
  it('takes the person\'s results off the boards', async () => {
    store().recordFinish(localRace, 'u1', { timeSec: 1500, finishedAt: 'x', areaId: 'a' });
    expect(await withdrawMyRaces({ user })).toBe(true);
    expect(deleteDoc).toHaveBeenCalledWith({ path: `raceEntries/${localRace.id}_u1` });
  });

  it('says false when a removal fails, and with nobody signed in', async () => {
    store().recordFinish(localRace, 'u1', { timeSec: 1500, finishedAt: 'x', areaId: 'a' });
    deleteDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await withdrawMyRaces({ user })).toBe(false);
    expect(await withdrawMyRaces({})).toBe(false);
    expect(await withdrawMyRaces()).toBe(false);
  });
});

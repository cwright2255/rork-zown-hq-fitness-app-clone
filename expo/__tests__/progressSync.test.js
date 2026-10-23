// services/progressSync.js: follows the person's lifetime totals, achievements, badges and Battle Pass claims on the server and hands every
// change to the store that shows it.
jest.mock('../src/config/firebase', () => ({ db: { stand: 'in' }, functions: {} }));
jest.mock('../store/lifetimeStore', () => ({ useLifetimeStore: { getState: () => global.__life } }));
jest.mock('../store/achievementStore', () => ({ useAchievementStore: { getState: () => global.__ach } }));
jest.mock('../store/badgeStore', () => ({ useBadgeStore: { getState: () => global.__badge } }));
jest.mock('../store/battlePassStore', () => ({ useBattlePassStore: { getState: () => global.__pass } }));
jest.mock('../services/callProxy', () => ({ callProxy: (...a) => global.__call(...a) }));
jest.mock('expo-updates', () => ({
  get updateId() { return global.__upd.updateId; },
  get isEmbeddedLaunch() { return global.__upd.isEmbeddedLaunch; },
  get channel() { return global.__upd.channel; },
  get runtimeVersion() { return global.__upd.runtimeVersion; },
}), { virtual: true });

import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { startProgressSync, stopProgressSync } from '../services/progressSync';

let warn;
let stops;
let listeners;
const listenerAt = (path) => listeners.find((l) => l.ref.path === path);
// Like Firestore's: a document that is not there gives `undefined` from data().
const snap = (data, fromCache = false) => ({ exists: () => data !== null && data !== undefined, data: () => (data === null ? undefined : data), metadata: { fromCache } });

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.__life = { applyTotals: jest.fn(), clearTotals: jest.fn() };
  global.__ach = { applyServerUnlocks: jest.fn(), clearServerUnlocks: jest.fn() };
  global.__badge = { applyServerUnlocks: jest.fn(), clearServerUnlocks: jest.fn() };
  global.__pass = { applyServerClaims: jest.fn(), clearServerClaims: jest.fn() };
  global.__call = jest.fn(async () => ({ totals: {} }));
  global.__upd = { updateId: 'upd-1', isEmbeddedLaunch: false, channel: 'production', runtimeVersion: '1.0.0' };
  doc.mockReset();
  doc.mockImplementation((_db, ...parts) => ({ path: parts.join('/') }));
  setDoc.mockReset();
  setDoc.mockImplementation(async () => undefined);
  stops = [];
  listeners = [];
  onSnapshot.mockReset();
  onSnapshot.mockImplementation((ref, onNext, onError) => {
    const stop = jest.fn();
    stops.push(stop);
    listeners.push({ ref, onNext, onError });
    return stop;
  });
  stopProgressSync(); // whatever an earlier test left running
  [global.__life, global.__ach, global.__badge, global.__pass].forEach((s) => Object.values(s).forEach((fn) => fn.mockClear()));
});
afterEach(() => warn.mockRestore());

describe('startProgressSync', () => {
  it('does nothing without a person', () => {
    startProgressSync(null);
    startProgressSync(undefined);
    startProgressSync('');
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(global.__call).not.toHaveBeenCalled();
  });

  it('listens to the person\'s own totals, achievements, badges and battle pass, and nobody else\'s', () => {
    startProgressSync('u1');
    expect(listeners.map((l) => l.ref.path).sort()).toEqual([
      'users/u1/data/achievements', 'users/u1/data/badges', 'users/u1/data/battlePass', 'users/u1/stats/totals',
    ]);
  });

  it('hands the lifetime store the totals document each time it changes, and null when there is none', () => {
    startProgressSync('u1');
    listenerAt('users/u1/stats/totals').onNext(snap({ v: 2, totalWorkouts: 300 }));
    expect(global.__life.applyTotals).toHaveBeenLastCalledWith({ v: 2, totalWorkouts: 300 });
    listenerAt('users/u1/stats/totals').onNext(snap(null));
    expect(global.__life.applyTotals).toHaveBeenLastCalledWith(null);
  });

  it('hands the achievement store the unlocked map', () => {
    startProgressSync('u1');
    listenerAt('users/u1/data/achievements').onNext(snap({ unlocked: { 'first-workout': 't' } }));
    expect(global.__ach.applyServerUnlocks).toHaveBeenLastCalledWith({ 'first-workout': 't' });
  });

  it('hands the badge store the unlocked map', () => {
    startProgressSync('u1');
    listenerAt('users/u1/data/badges').onNext(snap({ unlocked: { 'badge-1': 't' } }));
    expect(global.__badge.applyServerUnlocks).toHaveBeenLastCalledWith({ 'badge-1': 't' });
  });

  it('hands the battle pass store the claimed tiers', () => {
    startProgressSync('u1');
    listenerAt('users/u1/data/battlePass').onNext(snap({ claimedTiers: [1, 2] }));
    expect(global.__pass.applyServerClaims).toHaveBeenLastCalledWith([1, 2]);
  });

  it('says nothing unlocked and nothing claimed when the server has no document yet', () => {
    startProgressSync('u1');
    listenerAt('users/u1/data/achievements').onNext(snap(null));
    listenerAt('users/u1/data/badges').onNext(snap(null));
    listenerAt('users/u1/data/battlePass').onNext(snap(null));
    expect(global.__ach.applyServerUnlocks).toHaveBeenLastCalledWith(null);
    expect(global.__badge.applyServerUnlocks).toHaveBeenLastCalledWith(null);
    expect(global.__pass.applyServerClaims).toHaveBeenLastCalledWith(null);
  });

  it('leaves what is on screen alone when a document is reported missing from the phone\'s own cache: it has not heard from the server', () => {
    startProgressSync('u1');
    ['users/u1/stats/totals', 'users/u1/data/achievements', 'users/u1/data/badges', 'users/u1/data/battlePass'].forEach((path) => {
      listenerAt(path).onNext(snap(null, true));
    });
    expect(global.__life.applyTotals).not.toHaveBeenCalled();
    expect(global.__ach.applyServerUnlocks).not.toHaveBeenCalled();
    expect(global.__badge.applyServerUnlocks).not.toHaveBeenCalled();
    expect(global.__pass.applyServerClaims).not.toHaveBeenCalled();
  });

  it('treats a missing document as missing when the snapshot says nothing about its source', () => {
    startProgressSync('u1');
    const bare = { exists: () => false, data: () => undefined };
    expect(() => listenerAt('users/u1/data/battlePass').onNext(bare)).not.toThrow();
    expect(global.__pass.applyServerClaims).toHaveBeenLastCalledWith(null);
  });

  it('shows a document that is there even when it comes from the cache', () => {
    startProgressSync('u1');
    listenerAt('users/u1/data/battlePass').onNext(snap({ claimedTiers: [3] }, true));
    expect(global.__pass.applyServerClaims).toHaveBeenLastCalledWith([3]);
  });

  it('asks the server to catch up once, without waiting for an answer', () => {
    global.__call = jest.fn(() => new Promise(() => undefined));
    expect(() => startProgressSync('u1')).not.toThrow();
    expect(global.__call).toHaveBeenCalledTimes(1);
    expect(global.__call).toHaveBeenCalledWith('syncMyProgress', {});
  });

  it('only warns when the catch-up fails, and the listeners are already going', async () => {
    global.__call = jest.fn(async () => { throw new Error('offline'); });
    startProgressSync('u1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledWith('[progressSync] catch-up failed:', 'offline');
    expect(onSnapshot).toHaveBeenCalledTimes(4);
  });

  it('only warns when the catch-up throws before it can start', () => {
    global.__call = jest.fn(() => { throw new Error('no network layer'); });
    expect(() => startProgressSync('u1')).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[progressSync] catch-up failed:', 'no network layer');
  });

  it('only warns when a listener fails, and leaves what is on screen alone', () => {
    startProgressSync('u1');
    expect(() => listenerAt('users/u1/stats/totals').onError(new Error('permission-denied'))).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[progressSync] totals listener error:', 'permission-denied');
    expect(global.__life.applyTotals).not.toHaveBeenCalled();
  });

  it('only warns when a store cannot show what the server sent', () => {
    global.__ach.applyServerUnlocks = jest.fn(() => { throw new Error('bad shape'); });
    startProgressSync('u1');
    expect(() => listenerAt('users/u1/data/achievements').onNext(snap({ unlocked: {} }))).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[progressSync] could not show achievements:', 'bad shape');
  });

  it('carries on with the other listeners when one cannot start', () => {
    onSnapshot.mockImplementation((ref, onNext, onError) => {
      if (ref.path === 'users/u1/data/badges') throw new Error('no network layer');
      const stop = jest.fn();
      stops.push(stop);
      listeners.push({ ref, onNext, onError });
      return stop;
    });
    expect(() => startProgressSync('u1')).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[progressSync] could not start badges:', 'no network layer');
    expect(listeners).toHaveLength(3);
  });

  it('stops the earlier listeners when it is started again, so one person has one set, and does not clear what is shown', () => {
    startProgressSync('u1');
    startProgressSync('u2');
    expect(stops.slice(0, 4).every((stop) => stop.mock.calls.length === 1)).toBe(true);
    expect(stops.slice(4).every((stop) => stop.mock.calls.length === 0)).toBe(true);
    expect(listeners.slice(4).every((l) => l.ref.path.startsWith('users/u2/'))).toBe(true);
    expect(global.__life.clearTotals).not.toHaveBeenCalled();
    expect(global.__ach.clearServerUnlocks).not.toHaveBeenCalled();
  });
});

describe('stopProgressSync', () => {
  it('stops every listener and clears what the stores were showing', () => {
    startProgressSync('u1');
    stopProgressSync();
    expect(stops).toHaveLength(4);
    stops.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
    expect(global.__life.clearTotals).toHaveBeenCalledTimes(1);
    expect(global.__ach.clearServerUnlocks).toHaveBeenCalledTimes(1);
    expect(global.__badge.clearServerUnlocks).toHaveBeenCalledTimes(1);
    expect(global.__pass.clearServerClaims).toHaveBeenCalledTimes(1);
  });

  it('can be called twice, or with nothing started: each listener is stopped once', () => {
    startProgressSync('u1');
    stopProgressSync();
    stopProgressSync();
    stops.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
    expect(() => stopProgressSync()).not.toThrow();
  });

  it('copes with a listener that fails to stop, and still stops the rest and clears the stores', () => {
    onSnapshot.mockImplementation((ref) => {
      const stop = jest.fn(() => { if (ref.path === 'users/u1/data/badges') throw new Error('already closed'); });
      stops.push(stop);
      return stop;
    });
    startProgressSync('u1');
    expect(() => stopProgressSync()).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[progressSync] stop failed:', 'already closed');
    stops.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
    expect(global.__pass.clearServerClaims).toHaveBeenCalled();
  });

  it('copes with a store that cannot be cleared', () => {
    global.__life.clearTotals = jest.fn(() => { throw new Error('store down'); });
    expect(() => stopProgressSync()).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[progressSync] clear failed:', 'store down');
  });
});

// The temporary check: users/{uid}/data/progressSyncDebug says which build is running and how the catch-up call ended.
describe('the progress sync check note', () => {
  const CHECK = 'users/u1/data/progressSyncDebug';
  const notes = () => setDoc.mock.calls.filter((c) => c[0].path === CHECK);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('writes nothing without a person', () => {
    startProgressSync(null);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('writes, before the call is answered, which build is running and that the call was made, merging into the one document', () => {
    global.__call = jest.fn(() => new Promise(() => undefined));
    startProgressSync('u1');
    expect(notes()).toHaveLength(1);
    const [ref, fields, options] = notes()[0];
    expect(ref).toEqual({ path: CHECK });
    expect(options).toEqual({ merge: true });
    expect(fields).toMatchObject({
      updateId: 'upd-1', embeddedLaunch: false, channel: 'production', runtimeVersion: '1.0.0',
      finishedAt: null, outcome: 'asking', errorCode: null, errorMessage: null,
    });
    expect(typeof fields.startedAt).toBe('string');
    expect(Number.isNaN(Date.parse(fields.startedAt))).toBe(false);
  });

  it('says ok once the server has answered', async () => {
    startProgressSync('u1');
    await settle();
    expect(notes()).toHaveLength(2);
    const [, fields, options] = notes()[1];
    expect(options).toEqual({ merge: true });
    expect(fields).toMatchObject({ outcome: 'ok', errorCode: null, errorMessage: null });
    expect(Number.isNaN(Date.parse(fields.finishedAt))).toBe(false);
    expect(fields).not.toHaveProperty('startedAt');
  });

  it('says why when the call fails: its code and its message, cut to 300 characters', async () => {
    const e = Object.assign(new Error('x'.repeat(500)), { code: 'functions/unauthenticated' });
    global.__call = jest.fn(async () => { throw e; });
    startProgressSync('u1');
    await settle();
    const [, fields] = notes()[1];
    expect(fields).toMatchObject({ outcome: 'failed', errorCode: 'functions/unauthenticated' });
    expect(fields.errorMessage).toBe('x'.repeat(300));
    expect(Number.isNaN(Date.parse(fields.finishedAt))).toBe(false);
  });

  it('says why when the call cannot start, and when the failure has no code', () => {
    global.__call = jest.fn(() => { throw new Error('no network layer'); });
    startProgressSync('u1');
    expect(notes()).toHaveLength(2);
    expect(notes()[1][1]).toMatchObject({ outcome: 'failed', errorCode: null, errorMessage: 'no network layer' });
  });

  it('copes with a failure that is not an Error', async () => {
    global.__call = jest.fn(async () => { throw 'plain text'; }); // eslint-disable-line no-throw-literal
    startProgressSync('u1');
    await settle();
    expect(notes()[1][1]).toMatchObject({ outcome: 'failed', errorCode: null, errorMessage: 'plain text' });
  });

  it('records the build as unknown when expo-updates cannot say', () => {
    global.__upd = { get updateId() { throw new Error('no native module'); } };
    global.__call = jest.fn(() => new Promise(() => undefined));
    startProgressSync('u1');
    expect(notes()[0][1]).toMatchObject({ updateId: null, embeddedLaunch: null, channel: null, runtimeVersion: null, outcome: 'asking' });
  });

  it('records a build with no update (the one inside the app) as embedded, with no id', () => {
    global.__upd = { updateId: null, isEmbeddedLaunch: true, channel: null, runtimeVersion: '1.0.0' };
    global.__call = jest.fn(() => new Promise(() => undefined));
    startProgressSync('u1');
    expect(notes()[0][1]).toMatchObject({ updateId: null, embeddedLaunch: true, channel: null, runtimeVersion: '1.0.0' });
  });

  it('records embeddedLaunch as unknown when expo-updates does not say', () => {
    global.__upd = { updateId: 'u' };
    global.__call = jest.fn(() => new Promise(() => undefined));
    startProgressSync('u1');
    expect(notes()[0][1]).toMatchObject({ updateId: 'u', embeddedLaunch: null });
  });

  it('only warns when a note cannot be written, and still asks the server and listens', async () => {
    setDoc.mockImplementation(async () => { throw new Error('write refused'); });
    expect(() => startProgressSync('u1')).not.toThrow();
    await settle();
    expect(warn).toHaveBeenCalledWith('[progressSync] check note failed:', 'write refused');
    expect(global.__call).toHaveBeenCalledWith('syncMyProgress', {});
    expect(onSnapshot).toHaveBeenCalledTimes(4);
  });

  it('only warns when a note throws before it can be written', () => {
    setDoc.mockImplementation(() => { throw new Error('no network layer'); });
    expect(() => startProgressSync('u1')).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[progressSync] check note failed:', 'no network layer');
    expect(global.__call).toHaveBeenCalledWith('syncMyProgress', {});
    expect(onSnapshot).toHaveBeenCalledTimes(4);
  });
});

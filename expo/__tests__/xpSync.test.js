// services/xpSync.js: follows the person's XP ledger on the server and hands every change to the XP store.
jest.mock('../src/config/firebase', () => ({ db: { stand: 'in' }, functions: {} }));
jest.mock('../store/expStore', () => ({
  useExpStore: { getState: () => global.__exp },
}));
jest.mock('../services/streakService', () => ({
  getActivityDayKeys: (...a) => global.__dayKeys(...a),
}));

import { doc, onSnapshot } from 'firebase/firestore';
import { startXpSync, stopXpSync } from '../services/xpSync';

let warn;
let stops;
let listeners;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.__exp = { beginXpSync: jest.fn(), endXpSync: jest.fn(), applyLedger: jest.fn() };
  global.__dayKeys = jest.fn(() => ['2026-10-12', '2026-10-13']);
  doc.mockReset();
  doc.mockImplementation((_db, ...parts) => ({ path: parts.join('/') }));
  stops = [];
  listeners = [];
  onSnapshot.mockReset();
  onSnapshot.mockImplementation((ref, onNext, onError) => {
    const stop = jest.fn();
    stops.push(stop);
    listeners.push({ ref, onNext, onError });
    return stop;
  });
  stopXpSync(); // whatever an earlier test left running
  global.__exp.endXpSync.mockClear();
});
afterEach(() => warn.mockRestore());

describe('startXpSync', () => {
  it('does nothing without a person', () => {
    startXpSync(null);
    startXpSync(undefined);
    startXpSync('');
    expect(global.__exp.beginXpSync).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('tells the store to start with the days the person was active, so a streak carries over', () => {
    startXpSync('u1');
    expect(global.__exp.beginXpSync).toHaveBeenCalledWith('u1', { activeDays: ['2026-10-12', '2026-10-13'] });
  });

  it('listens to the person\'s own ledger, and nobody else\'s', () => {
    startXpSync('u1');
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(listeners[0].ref).toEqual({ path: 'users/u1/stats/xp' });
  });

  it('starts the store before it listens, so what is waiting is shown before the ledger arrives', () => {
    const order = [];
    global.__exp.beginXpSync.mockImplementation(() => order.push('begin'));
    onSnapshot.mockImplementation(() => { order.push('listen'); return jest.fn(); });
    startXpSync('u1');
    expect(order).toEqual(['begin', 'listen']);
  });

  it('hands the store the ledger each time it changes', () => {
    startXpSync('u1');
    listeners[0].onNext({ exists: () => true, data: () => ({ total: 700 }) });
    expect(global.__exp.applyLedger).toHaveBeenLastCalledWith('u1', { total: 700 });
    listeners[0].onNext({ exists: () => true, data: () => ({ total: 900 }) });
    expect(global.__exp.applyLedger).toHaveBeenLastCalledWith('u1', { total: 900 });
  });

  it('says so when the person has no ledger yet', () => {
    startXpSync('u1');
    listeners[0].onNext({ exists: () => false, data: () => undefined });
    expect(global.__exp.applyLedger).toHaveBeenCalledWith('u1', null);
  });

  it('only warns when the listener fails, and leaves what is on screen alone', () => {
    startXpSync('u1');
    expect(() => listeners[0].onError(new Error('permission-denied'))).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[xpSync] ledger listener error:', 'permission-denied');
    expect(global.__exp.applyLedger).not.toHaveBeenCalled();
  });

  it('stops the earlier listener when it is started again, so one person has one listener', () => {
    startXpSync('u1');
    startXpSync('u2');
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).not.toHaveBeenCalled();
    expect(listeners[1].ref).toEqual({ path: 'users/u2/stats/xp' });
    expect(global.__exp.beginXpSync).toHaveBeenLastCalledWith('u2', expect.any(Object));
  });

  it('still starts when the active days cannot be read', () => {
    global.__dayKeys = jest.fn(() => { throw new Error('store not ready'); });
    startXpSync('u1');
    expect(global.__exp.beginXpSync).toHaveBeenCalledWith('u1', { activeDays: [] });
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[xpSync] could not read the active days:', 'store not ready');
  });

  it('never throws when the listener cannot be started', () => {
    onSnapshot.mockImplementation(() => { throw new Error('no network layer'); });
    expect(() => startXpSync('u1')).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[xpSync] could not start:', 'no network layer');
    expect(global.__exp.beginXpSync).toHaveBeenCalled();
  });
});

describe('stopXpSync', () => {
  it('stops the listener and tells the store to stop following', () => {
    startXpSync('u1');
    global.__exp.endXpSync.mockClear();
    stopXpSync();
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(global.__exp.endXpSync).toHaveBeenCalledTimes(1);
  });

  it('can be called twice, or with nothing started: the listener is stopped once', () => {
    startXpSync('u1');
    stopXpSync();
    stopXpSync();
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(() => stopXpSync()).not.toThrow();
  });

  it('copes with a listener that fails to stop', () => {
    onSnapshot.mockImplementation(() => () => { throw new Error('already closed'); });
    startXpSync('u1');
    expect(() => stopXpSync()).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[xpSync] stop failed:', 'already closed');
    expect(global.__exp.endXpSync).toHaveBeenCalled();
  });
});

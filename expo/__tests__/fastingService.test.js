jest.mock('../src/config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  collection: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  query: jest.fn((...args) => ({ query: args })),
  orderBy: jest.fn((field, dir) => ({ orderBy: [field, dir] })),
  limit: jest.fn((n) => ({ limit: n })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
}));

import {
  doc, collection, query, orderBy, limit, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import {
  getActiveFast, startFast, updateFastStart, endFast, getFastHistory, deleteFast,
} from '../services/fastingService';

const H = 3600000;
const STARTED = new Date(2026, 9, 11, 20, 0, 0);
const stamp = (d) => ({ toDate: () => d });

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [doc, collection, query, orderBy, limit, getDoc, getDocs, setDoc, updateDoc, deleteDoc].forEach((m) => m.mockClear());
  setDoc.mockImplementation(async () => undefined);
  deleteDoc.mockImplementation(async () => undefined);
});
afterEach(() => warn.mockRestore());

describe('getActiveFast', () => {
  it('is null without a signed in person, or with no fast running', async () => {
    expect(await getActiveFast(null)).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await getActiveFast('u1')).toBeNull();
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1/data/fasting' });
  });

  it('reads the start, the target and the plan', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ startedAt: stamp(STARTED), targetHours: 23, plan: 'omad' }) });
    expect(await getActiveFast('u1')).toEqual({ startedAt: STARTED, targetHours: 23, plan: 'omad' });
  });

  it('copes with a fast saved before plans existed, or with a plain date', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ startedAt: STARTED.toISOString(), targetHours: 18 }) });
    expect(await getActiveFast('u1')).toEqual({ startedAt: STARTED, targetHours: 18, plan: null });
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ startedAt: STARTED }) });
    expect((await getActiveFast('u1')).targetHours).toBe(16);
  });

  it('is null for a document with no start time', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ targetHours: 16 }) });
    expect(await getActiveFast('u1')).toBeNull();
  });
});

describe('startFast', () => {
  it('saves the running fast with its plan and returns it', async () => {
    const begin = new Date(2026, 9, 12, 8, 0, 0);
    const out = await startFast('u1', 23, { plan: 'omad', startedAt: begin });
    expect(setDoc).toHaveBeenCalledWith({ path: 'users/u1/data/fasting' }, { startedAt: begin, targetHours: 23, plan: 'omad' });
    expect(out).toEqual({ startedAt: begin, targetHours: 23, plan: 'omad' });
  });

  it('starts now, at 16 hours, with no plan, by default', async () => {
    const before = Date.now();
    const out = await startFast('u1');
    expect(out.targetHours).toBe(16);
    expect(out.plan).toBeNull();
    expect(out.startedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(out.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('does nothing without a signed in person', async () => {
    expect(await startFast(null, 16)).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('updateFastStart', () => {
  it('changes only the start time of the running fast', async () => {
    await updateFastStart('u1', STARTED);
    expect(updateDoc).toHaveBeenCalledWith({ path: 'users/u1/data/fasting' }, { startedAt: STARTED });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does nothing without a signed in person', async () => {
    await updateFastStart('', STARTED);
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('endFast', () => {
  const active = { startedAt: STARTED, targetHours: 16, plan: '16' };
  const ended = new Date(STARTED.getTime() + 17 * H);

  it('keeps the fast in the history, named by its start time, then removes the running one', async () => {
    const order = [];
    setDoc.mockImplementation(async () => { order.push('save'); });
    deleteDoc.mockImplementation(async () => { order.push('delete'); });

    const out = await endFast('u1', active, ended);

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      { path: `users/u1/fastingHistory/${STARTED.getTime()}` },
      { startedAt: STARTED, endedAt: ended, targetHours: 16, plan: '16', hours: 17, completed: true },
    );
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/data/fasting' });
    expect(order).toEqual(['save', 'delete']);
    expect(out.saved).toBe(true);
    expect(out.entry).toMatchObject({ id: String(STARTED.getTime()), hours: 17, completed: true, saveable: true });
  });

  it('saves a fast that fell short as not completed', async () => {
    await endFast('u1', active, new Date(STARTED.getTime() + 10 * H));
    expect(setDoc.mock.calls[0][1]).toMatchObject({ hours: 10, completed: false });
  });

  it('does not keep a fast under ten minutes, but still ends it', async () => {
    const out = await endFast('u1', active, new Date(STARTED.getTime() + 9 * 60000));
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/data/fasting' });
    expect(out.saved).toBe(false);
    expect(out.entry.saveable).toBe(false);
  });

  it('still ends the fast when the history can not be saved, and says it was not', async () => {
    setDoc.mockRejectedValue(new Error('permission-denied'));
    const out = await endFast('u1', active, ended);
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/data/fasting' });
    expect(out.saved).toBe(false);
    expect(out.entry.saveable).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it('leaves the fast running when it can not be removed', async () => {
    deleteDoc.mockRejectedValue(new Error('offline'));
    await expect(endFast('u1', active, ended)).rejects.toThrow('offline');
  });

  it('does nothing without a signed in person', async () => {
    expect(await endFast(null, active, ended)).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

describe('getFastHistory', () => {
  it('reads the newest 500 by end time', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await getFastHistory('u1');
    expect(collection).toHaveBeenCalledWith({}, 'users', 'u1', 'fastingHistory');
    expect(orderBy).toHaveBeenCalledWith('endedAt', 'desc');
    expect(limit).toHaveBeenCalledWith(500);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('turns the documents into fasts, newest first, leaving out any that are not real fasts', async () => {
    const end2 = new Date(STARTED.getTime() + 18 * H);
    const end1 = new Date(STARTED.getTime() - 6 * H);
    getDocs.mockResolvedValue({
      docs: [
        { id: 'b', data: () => ({ startedAt: stamp(STARTED), endedAt: stamp(end2), targetHours: 18, plan: '18', hours: 18, completed: true }) },
        { id: 'broken', data: () => ({ startedAt: stamp(STARTED) }) },
        { id: 'a', data: () => ({ startedAt: stamp(new Date(end1.getTime() - 16 * H)), endedAt: stamp(end1), targetHours: 16 }) },
      ],
    });
    const out = await getFastHistory('u1');
    expect(out.map((f) => f.id)).toEqual(['b', 'a']);
    expect(out[0]).toEqual({ id: 'b', startedAt: STARTED, endedAt: end2, targetHours: 18, plan: '18' });
    expect(out[1].plan).toBeNull();
  });

  it('is empty without a signed in person', async () => {
    expect(await getFastHistory(undefined)).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe('deleteFast', () => {
  it('removes one fast from the history', async () => {
    await deleteFast('u1', '12345');
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/fastingHistory/12345' });
  });

  it('does nothing without a person or an id', async () => {
    await deleteFast('', '12345');
    await deleteFast('u1', '');
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

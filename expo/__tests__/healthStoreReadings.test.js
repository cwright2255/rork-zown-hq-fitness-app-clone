// The daily record of sleep, HRV and resting heart rate in the health store (store/healthStore.js): filled from the last 28 days of
// Apple Health, and from today's wearable reading, kept on the phone and with the account. Sums and trends are in dailyReadings.test.js.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: (_db, ...path) => path.join('/'),
  getDoc: (...a) => global.__getDoc(...a),
  setDoc: (...a) => global.__setDoc(...a),
}), { virtual: true });
jest.mock('../services/rookService', () => ({ rookService: { getTodayRecovery: (...a) => global.__rook(...a) } }));
jest.mock('../services/appleHealthService', () => ({
  appleHealthService: {
    getTodayRecovery: (...a) => global.__appleRecovery(...a),
    getDailyReadings: (...a) => global.__appleReadings(...a),
  },
}));

import { useHealthStore, READINGS_SYNC_DAYS, READINGS_SYNC_EVERY_MS } from '../store/healthStore';

const EVENING = new Date('2026-10-15T01:30:00Z');
const TODAY = '2026-10-14';
const at = (date) => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(date); };
const healthWrites = () => global.__setDoc.mock.calls.filter(([ref]) => ref === 'users/u1/data/health').map(([, data]) => data);
const history = () => useHealthStore.getState().readingsHistory;

beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
beforeEach(() => {
  global.__getDoc = jest.fn(async () => ({ exists: () => false }));
  global.__setDoc = jest.fn(async () => undefined);
  global.__rook = jest.fn(async () => null);
  global.__appleRecovery = jest.fn(async () => null);
  global.__appleReadings = jest.fn(async () => ({ ok: true, days: { '2026-10-13': { restingHeartRate: 57, hrv: 48, sleepHours: 7.2 } } }));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  useHealthStore.setState({ readingsHistory: {}, readingsSyncedAt: 0, rookRecovery: null });
  at(EVENING);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('the record before anything is read', () => {
  it('starts as an empty set of days', () => {
    expect(useHealthStore.getState().readingsHistory).toEqual({});
    expect(READINGS_SYNC_DAYS).toBe(28);
    expect(READINGS_SYNC_EVERY_MS).toBe(10 * 60 * 1000);
  });
});

describe('recordReadings', () => {
  it('files a day\'s readings, and adds to a day that is already there', () => {
    useHealthStore.getState().recordReadings(TODAY, { restingHeartRate: 58 });
    useHealthStore.getState().recordReadings(TODAY, { hrv: 44.4 });
    useHealthStore.getState().recordReadings('2026-10-13', { sleepHours: 7 });
    expect(history()).toEqual({ [TODAY]: { restingHeartRate: 58, hrv: 44.4 }, '2026-10-13': { sleepHours: 7 } });
  });

  it('leaves out a reading that cannot be believed', () => {
    useHealthStore.getState().recordReadings(TODAY, { restingHeartRate: 0, hrv: null, sleepHours: 'x' });
    expect(history()).toEqual({});
  });

  it('saves to the account when it knows who the person is, and keeps it on the phone only when it does not', () => {
    useHealthStore.getState().recordReadings(TODAY, { restingHeartRate: 58 });
    expect(global.__setDoc).not.toHaveBeenCalled();
    useHealthStore.getState().recordReadings(TODAY, { hrv: 40 }, 'u1');
    expect(healthWrites()).toHaveLength(1);
    expect(healthWrites()[0].readingsHistory).toEqual({ [TODAY]: { restingHeartRate: 58, hrv: 40 } });
  });
});

describe('syncReadings', () => {
  it('fills the record from the last 28 days of Apple Health and saves it for the person', async () => {
    const out = await useHealthStore.getState().syncReadings('u1');
    expect(global.__appleReadings).toHaveBeenCalledWith({ days: 28 });
    expect(out).toEqual({ '2026-10-13': { restingHeartRate: 57, hrv: 48, sleepHours: 7.2 } });
    expect(history()).toEqual({ '2026-10-13': { restingHeartRate: 57, hrv: 48, sleepHours: 7.2 } });
    expect(healthWrites()).toHaveLength(1);
    expect(healthWrites()[0].readingsHistory).toEqual(history());
  });

  it('puts what it reads on top of what is there, reading by reading', async () => {
    useHealthStore.setState({ readingsHistory: { '2026-10-13': { hrv: 30, sleepHours: 6 }, '2026-10-12': { hrv: 41 } } });
    await useHealthStore.getState().syncReadings('u1');
    expect(history()).toEqual({
      '2026-10-12': { hrv: 41 },
      '2026-10-13': { restingHeartRate: 57, hrv: 48, sleepHours: 7.2 },
    });
  });

  it('keeps it on the phone only when there is no signed-in person', async () => {
    await useHealthStore.getState().syncReadings();
    expect(history()['2026-10-13']).toBeDefined();
    expect(global.__setDoc).not.toHaveBeenCalled();
  });

  it('does not read Health again within ten minutes, and does after that', async () => {
    await useHealthStore.getState().syncReadings('u1');
    expect(await useHealthStore.getState().syncReadings('u1')).toBeNull();
    jest.setSystemTime(Date.now() + READINGS_SYNC_EVERY_MS - 1);
    expect(await useHealthStore.getState().syncReadings('u1')).toBeNull();
    expect(global.__appleReadings).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 1);
    await useHealthStore.getState().syncReadings('u1');
    expect(global.__appleReadings).toHaveBeenCalledTimes(2);
  });

  it('shares one read between two screens that ask at the same moment', async () => {
    await Promise.all([useHealthStore.getState().syncReadings('u1'), useHealthStore.getState().syncReadings('u1')]);
    expect(global.__appleReadings).toHaveBeenCalledTimes(1);
  });

  it('leaves the record as it was, and tries again next time, when Health could not be read', async () => {
    useHealthStore.setState({ readingsHistory: { '2026-10-12': { hrv: 41 } } });
    global.__appleReadings.mockResolvedValueOnce({ ok: false, reason: 'not-authorized', days: {} });
    expect(await useHealthStore.getState().syncReadings('u1')).toBeNull();
    expect(history()).toEqual({ '2026-10-12': { hrv: 41 } });
    expect(global.__setDoc).not.toHaveBeenCalled();
    await useHealthStore.getState().syncReadings('u1');
    expect(global.__appleReadings).toHaveBeenCalledTimes(2);
    expect(history()['2026-10-13']).toBeDefined();
  });

  it('does not throw, and tries again next time, when reading Health fails', async () => {
    global.__appleReadings.mockRejectedValueOnce(new Error('boom'));
    expect(await useHealthStore.getState().syncReadings('u1')).toBeNull();
    expect(history()).toEqual({});
    await useHealthStore.getState().syncReadings('u1');
    expect(global.__appleReadings).toHaveBeenCalledTimes(2);
  });

  it('answers nothing when there is no answer from Health at all', async () => {
    global.__appleReadings.mockResolvedValueOnce(undefined);
    expect(await useHealthStore.getState().syncReadings('u1')).toBeNull();
    expect(history()).toEqual({});
  });
});

describe('loadRookRecovery and the daily record', () => {
  const ROOK_TODAY = { restingHeartRate: 52, hrv: 88, sleepHours: 7.4, source: 'WHOOP' };

  it('files the wearable\'s readings under today', async () => {
    global.__rook.mockResolvedValue(ROOK_TODAY);
    await useHealthStore.getState().loadRookRecovery();
    expect(history()).toEqual({ [TODAY]: { restingHeartRate: 52, hrv: 88, sleepHours: 7.4 } });
    expect(useHealthStore.getState().rookRecovery).toEqual(ROOK_TODAY);
  });

  it('files only the readings the wearable gave', async () => {
    global.__rook.mockResolvedValue({ restingHeartRate: 50, hrv: null, sleepHours: undefined, source: 'Oura' });
    await useHealthStore.getState().loadRookRecovery();
    expect(history()).toEqual({ [TODAY]: { restingHeartRate: 50 } });
  });

  it('files nothing under today for Apple Health, whose latest reading may be from another day', async () => {
    global.__appleRecovery.mockResolvedValue({ restingHeartRate: 58, hrv: 41, sleepEfficiency: null, sleepHours: null, source: 'Apple Health' });
    await useHealthStore.getState().loadRookRecovery();
    expect(history()).toEqual({});
    expect(global.__rook).not.toHaveBeenCalled();
  });

  it('files nothing when there is nothing connected', async () => {
    await useHealthStore.getState().loadRookRecovery();
    expect(history()).toEqual({});
    expect(useHealthStore.getState().rookRecovery).toBeNull();
  });

  it('keeps what it had when the wearable could not be asked', async () => {
    useHealthStore.setState({ readingsHistory: { [TODAY]: { hrv: 40 } } });
    global.__rook.mockRejectedValue(new Error('offline'));
    await useHealthStore.getState().loadRookRecovery();
    expect(history()).toEqual({ [TODAY]: { hrv: 40 } });
  });
});

describe('loading and saving with the account', () => {
  it('brings in the saved record and keeps this phone\'s own reading of a day over the saved one', async () => {
    useHealthStore.setState({ readingsHistory: { '2026-10-13': { hrv: 48 } } });
    global.__getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ readingsHistory: { '2026-10-13': { hrv: 30, sleepHours: 6.5 }, '2026-10-11': { restingHeartRate: 60 } } }),
    });
    await useHealthStore.getState().loadAllHealth('u1');
    expect(history()).toEqual({
      '2026-10-11': { restingHeartRate: 60 },
      '2026-10-13': { hrv: 48, sleepHours: 6.5 },
    });
  });

  it('copes with an account that has no saved record yet', async () => {
    useHealthStore.setState({ readingsHistory: { '2026-10-13': { hrv: 48 } } });
    global.__getDoc.mockResolvedValue({ exists: () => true, data: () => ({ steps: 100 }) });
    await useHealthStore.getState().loadAllHealth('u1');
    expect(history()).toEqual({ '2026-10-13': { hrv: 48 } });
  });

  it('saves the record with the rest of the health data', async () => {
    useHealthStore.setState({ readingsHistory: { '2026-10-13': { hrv: 48 } } });
    await useHealthStore.getState()._persist('u1');
    expect(healthWrites()[0].readingsHistory).toEqual({ '2026-10-13': { hrv: 48 } });
  });
});

describe('what stays on the phone', () => {
  const options = () => useHealthStore.persist.getOptions();

  it('keeps the record, and not the time it was last read', () => {
    const kept = options().partialize({ ...useHealthStore.getState(), readingsHistory: { '2026-10-13': { hrv: 48 } }, readingsSyncedAt: 123 });
    expect(kept.readingsHistory).toEqual({ '2026-10-13': { hrv: 48 } });
    expect('readingsSyncedAt' in kept).toBe(false);
  });

  it('brings the saved record back, with what was read before it loaded', () => {
    const current = { ...useHealthStore.getState(), readingsHistory: { '2026-10-14': { hrv: 50 }, '2026-10-13': { hrv: 1.5 } } };
    const merged = options().merge({ readingsHistory: { '2026-10-13': { hrv: 48 }, '2026-10-12': { sleepHours: 7 } } }, current);
    expect(merged.readingsHistory).toEqual({
      '2026-10-12': { sleepHours: 7 },
      '2026-10-13': { hrv: 48 },
      '2026-10-14': { hrv: 50 },
    });
  });

  it('copes with a phone that saved its data before the record existed, or saved something damaged', () => {
    const current = useHealthStore.getState();
    expect(options().merge({ steps: 5 }, current).readingsHistory).toEqual({});
    expect(options().merge(undefined, current).readingsHistory).toEqual({});
    expect(options().merge({ readingsHistory: [1, 2] }, current).readingsHistory).toEqual({});
    expect(options().merge({ readingsHistory: 'x' }, current).readingsHistory).toEqual({});
  });
});

// getRookRecoveryData asks ROOK for one day of sleep and heart data. The server clock is UTC, which is already
// tomorrow from about 8 PM in New Jersey, so the app now sends the person's own day and the function uses it.
// index.js is loaded with the Firebase packages replaced by small fakes, and fetch replaced.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: {} }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: jest.fn() }));

import { recoveryDay } from '../functions/src/recoveryDay.js';

const EVENING_UTC = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey

describe('recoveryDay', () => {
  it('uses the person\'s own day when the app sends it', () => {
    expect(recoveryDay('2026-10-14', EVENING_UTC)).toBe('2026-10-14');
    expect(recoveryDay('2026-10-15', EVENING_UTC)).toBe('2026-10-15');
    expect(recoveryDay('2026-10-16', EVENING_UTC)).toBe('2026-10-16'); // a day ahead (east of Greenwich) is possible
  });

  it('falls back to the UTC date for an older app that sends nothing', () => {
    expect(recoveryDay(undefined, EVENING_UTC)).toBe('2026-10-15');
    expect(recoveryDay(null, EVENING_UTC)).toBe('2026-10-15');
  });

  it('ignores anything that is not a real calendar day', () => {
    for (const bad of ['', 'today', '2026-10-1', '2026/10/14', '2026-02-30', '2026-13-01', '2026-10-14T01:00:00Z', 20261014, {}, [], true]) {
      expect({ bad: String(bad), day: recoveryDay(bad, EVENING_UTC) }).toEqual({ bad: String(bad), day: '2026-10-15' });
    }
  });

  it('ignores a day that does not exist even when it reads back as a day next to today', () => {
    expect(recoveryDay('2026-02-30', new Date('2026-03-01T01:00:00Z'))).toBe('2026-03-01');
    expect(recoveryDay('2026-02-31', new Date('2026-03-01T01:00:00Z'))).toBe('2026-03-01');
    expect(recoveryDay('2026-04-31', new Date('2026-05-01T01:00:00Z'))).toBe('2026-05-01');
    expect(recoveryDay('2026-02-28', new Date('2026-03-01T01:00:00Z'))).toBe('2026-02-28');
  });

  it('ignores a day with anything extra on it', () => {
    for (const bad of [' 2026-10-14', '2026-10-14 ', '2026-10-14\n', '+2026-10-14', '2026-10-14Z']) {
      expect({ bad, day: recoveryDay(bad, EVENING_UTC) }).toEqual({ bad, day: '2026-10-15' });
    }
  });

  it('ignores a day more than one day away from the UTC date (no clock on Earth is that far out)', () => {
    expect(recoveryDay('2026-10-13', EVENING_UTC)).toBe('2026-10-15');
    expect(recoveryDay('2026-10-17', EVENING_UTC)).toBe('2026-10-15');
    expect(recoveryDay('2020-01-01', EVENING_UTC)).toBe('2026-10-15');
  });

  it('defaults to the real clock', () => {
    expect(recoveryDay()).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('getRookRecoveryData', () => {
  let fns;
  const noContent = { ok: true, status: 204, json: async () => ({}), text: async () => '' };
  const datesAsked = () => global.fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('date'));

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ now: EVENING_UTC, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    fns = require('../functions/src/index.js');
    global.fetch = jest.fn(async () => noContent);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); delete global.fetch; });

  const call = (data, auth = { uid: 'u1' }) => fns.getRookRecoveryData({ auth, data });

  it('needs a signed-in caller', async () => {
    await expect(call({ date: '2026-10-14' }, null)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('asks ROOK about the day the app sent, for both the sleep and the physical summary', async () => {
    expect(await call({ date: '2026-10-14' })).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(datesAsked()).toEqual(['2026-10-14', '2026-10-14']);
  });

  it('asks about the UTC date when the app sends no day, as before', async () => {
    await call(undefined);
    expect(datesAsked()).toEqual(['2026-10-15', '2026-10-15']);
    global.fetch.mockClear();
    await call({});
    expect(datesAsked()).toEqual(['2026-10-15', '2026-10-15']);
  });

  it('does not let a made-up day through to ROOK', async () => {
    await call({ date: "2026-10-14&user_id=someone-else" });
    expect(datesAsked()).toEqual(['2026-10-15', '2026-10-15']);
  });

  it('still returns the readings for that day', async () => {
    global.fetch.mockImplementation(async (url) => {
      const body = String(url).includes('sleep_health')
        ? { sleep_health: { summary: { sleep_summary: {
          heart_rate: { hrv_avg_rmssd_float: 61, hr_resting_bpm_int: 54 },
          scores: { sleep_efficiency_1_100_score_int: 91 },
          duration: { sleep_duration_seconds_int: 27000 },
          metadata: { sources_of_data_array: ['Oura'] },
        } } } }
        : {};
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    });
    expect(await call({ date: '2026-10-14' })).toEqual({ hrv: 61, restingHeartRate: 54, sleepEfficiency: 91, sleepHours: 7.5, source: 'Oura' });
  });
});

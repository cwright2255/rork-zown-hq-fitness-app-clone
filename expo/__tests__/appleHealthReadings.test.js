// Reading the last 28 days of resting heart rate, HRV and sleep from Apple Health for the daily record
// (services/appleHealthService.js getDailyReadings; the sums and averages themselves are tested in dailyReadings.test.js).
import { Platform } from 'react-native';

// The package is native, so tests stand in for it.
const mockHK = {
  requestAuthorization: jest.fn(async () => true),
  queryQuantitySamples: jest.fn(async () => []),
  queryCategorySamples: jest.fn(async () => []),
};
jest.mock('@kingstinct/react-native-healthkit', () => mockHK, { virtual: true });

import { appleHealthService } from '../services/appleHealthService';

const RHR = 'HKQuantityTypeIdentifierRestingHeartRate';
const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
// Tuesday 20 October 2026, 3 PM in the person's own time.
const NOW = new Date(2026, 9, 20, 15, 0);
const q = (when, quantity) => ({ startDate: when, endDate: when, quantity });

beforeEach(() => {
  mockHK.requestAuthorization.mockReset().mockResolvedValue(true);
  mockHK.queryQuantitySamples.mockReset().mockResolvedValue([]);
  mockHK.queryCategorySamples.mockReset().mockResolvedValue([]);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('getDailyReadings', () => {
  it('asks for access to sleep as well as the readings, before it reads anything, which this library requires', async () => {
    const order = [];
    mockHK.requestAuthorization.mockImplementation(async () => { order.push('access'); return true; });
    mockHK.queryQuantitySamples.mockImplementation(async () => { order.push('quantity'); return []; });
    mockHK.queryCategorySamples.mockImplementation(async () => { order.push('category'); return []; });
    await appleHealthService.getDailyReadings({ now: NOW });
    expect(order[0]).toBe('access');
    expect(order).toHaveLength(4);
    expect(mockHK.requestAuthorization).toHaveBeenCalledTimes(1);
    expect(mockHK.requestAuthorization).toHaveBeenCalledWith({
      toRead: [
        RHR, HRV, 'HKQuantityTypeIdentifierStepCount', 'HKQuantityTypeIdentifierDistanceWalkingRunning',
        'HKQuantityTypeIdentifierFlightsClimbed', SLEEP,
      ],
    });
  });

  it('reads resting heart rate, HRV and sleep since midnight 28 days before, newest first', async () => {
    await appleHealthService.getDailyReadings({ now: NOW });
    const since = new Date(2026, 8, 22); // 28 days before the 20th: the 22nd of September
    const options = { filter: { date: { startDate: since } }, limit: 3000, ascending: false };
    expect(mockHK.queryQuantitySamples).toHaveBeenCalledTimes(2);
    expect(mockHK.queryQuantitySamples).toHaveBeenCalledWith(RHR, options);
    expect(mockHK.queryQuantitySamples).toHaveBeenCalledWith(HRV, options);
    expect(mockHK.queryCategorySamples).toHaveBeenCalledTimes(1);
    expect(mockHK.queryCategorySamples).toHaveBeenCalledWith(SLEEP, options);
  });

  it('reads as many days as it is asked for', async () => {
    await appleHealthService.getDailyReadings({ days: 7, now: NOW });
    expect(mockHK.queryCategorySamples.mock.calls[0][1].filter.date.startDate).toEqual(new Date(2026, 9, 13));
  });

  it('keeps only the days it was asked for', async () => {
    mockHK.queryQuantitySamples.mockImplementation(async (type) => (type === RHR
      ? [q(new Date(2026, 9, 8, 7), 61), q(new Date(2026, 9, 16, 7), 58)]
      : []));
    expect((await appleHealthService.getDailyReadings({ days: 7, now: NOW })).days).toEqual({ '2026-10-16': { restingHeartRate: 58 } });
    expect((await appleHealthService.getDailyReadings({ days: 28, now: NOW })).days).toEqual({
      '2026-10-08': { restingHeartRate: 61 }, '2026-10-16': { restingHeartRate: 58 },
    });
  });

  it('gives one reading a day', async () => {
    mockHK.queryQuantitySamples.mockImplementation(async (type) => (type === RHR
      ? [q(new Date(2026, 9, 20, 7), 55), q(new Date(2026, 9, 19, 7), 57)]
      : [q(new Date(2026, 9, 20, 3), 48), q(new Date(2026, 9, 20, 4), 52)]));
    mockHK.queryCategorySamples.mockResolvedValue([
      { value: 3, startDate: new Date(2026, 9, 19, 23), endDate: new Date(2026, 9, 20, 6, 30) },
    ]);
    const out = await appleHealthService.getDailyReadings({ now: NOW });
    expect(out).toEqual({
      ok: true,
      days: {
        '2026-10-19': { restingHeartRate: 57 },
        '2026-10-20': { restingHeartRate: 55, hrv: 50, sleepHours: 7.5 },
      },
    });
  });

  it('gives an empty record, not an error, when Health has nothing', async () => {
    expect(await appleHealthService.getDailyReadings({ now: NOW })).toEqual({ ok: true, days: {} });
  });

  it('reads a reading that did not fail when another one did', async () => {
    mockHK.queryCategorySamples.mockRejectedValue(new Error('no sleep access'));
    mockHK.queryQuantitySamples.mockImplementation(async (type) => (type === RHR ? [q(new Date(2026, 9, 20, 7), 55)] : []));
    expect(await appleHealthService.getDailyReadings({ now: NOW })).toEqual({ ok: true, days: { '2026-10-20': { restingHeartRate: 55 } } });
  });

  it('says it could not read Health when every read failed', async () => {
    mockHK.queryCategorySamples.mockRejectedValue(new Error('x'));
    mockHK.queryQuantitySamples.mockRejectedValue(new Error('y'));
    expect(await appleHealthService.getDailyReadings({ now: NOW })).toEqual({ ok: false, reason: 'error', days: {} });
  });

  it('says so, without throwing, when the library itself throws', async () => {
    mockHK.queryQuantitySamples.mockImplementation(() => { throw new Error('boom'); });
    expect(await appleHealthService.getDailyReadings({ now: NOW })).toEqual({ ok: false, reason: 'error', days: {} });
  });

  it('reads nothing when access could not be asked for', async () => {
    mockHK.requestAuthorization.mockRejectedValue(new Error('nope'));
    expect(await appleHealthService.getDailyReadings({ now: NOW })).toEqual({ ok: false, reason: 'not-authorized', days: {} });
    expect(mockHK.queryQuantitySamples).not.toHaveBeenCalled();
    expect(mockHK.queryCategorySamples).not.toHaveBeenCalled();
  });

  it('does nothing off iPhone', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(await appleHealthService.getDailyReadings({ now: NOW })).toEqual({ ok: false, reason: 'unsupported', days: {} });
    expect(mockHK.requestAuthorization).not.toHaveBeenCalled();
  });
});

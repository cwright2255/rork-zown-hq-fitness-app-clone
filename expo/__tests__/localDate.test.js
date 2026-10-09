import { localDateKey, parseDateKey, shiftDateKey } from '../lib/localDate';

describe('localDateKey', () => {
  it('is the calendar day in the phone\'s own time zone', () => {
    expect(localDateKey(new Date(2026, 9, 8, 7, 5))).toBe('2026-10-08');
    expect(localDateKey(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
    expect(localDateKey(new Date(2026, 9, 9, 0, 1))).toBe('2026-10-09');
  });

  it('pads single-digit months and days', () => {
    expect(localDateKey(new Date(2026, 0, 3, 12))).toBe('2026-01-03');
  });

  it('takes a timestamp or a date string too', () => {
    expect(localDateKey(new Date(2026, 9, 8, 12).getTime())).toBe('2026-10-08');
    expect(localDateKey(new Date(2026, 9, 8, 12).toISOString())).toBe('2026-10-08');
  });

  it('falls back to today for junk', () => {
    expect(localDateKey('not a date')).toBe(localDateKey(new Date()));
    expect(localDateKey(undefined)).toBe(localDateKey(new Date()));
  });

  describe('in New Jersey in the evening', () => {
    const original = process.env.TZ;
    beforeAll(() => { process.env.TZ = 'America/New_York'; });
    afterAll(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });

    it('keeps 9:30 PM on the same day, where the UTC date has already turned over', () => {
      // 9:30 PM on Oct 8 in New York (EDT, UTC-4) is 01:30 UTC on Oct 9.
      const nineThirtyPm = new Date('2026-10-09T01:30:00Z');
      expect(nineThirtyPm.toISOString().slice(0, 10)).toBe('2026-10-09');
      expect(localDateKey(nineThirtyPm)).toBe('2026-10-08');
    });
  });
});

describe('parseDateKey', () => {
  it('is local midnight of that calendar day', () => {
    const d = parseDateKey('2026-10-08');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 8, 0]);
  });

  it('gives null for anything that is not a real day', () => {
    ['2026-02-30', '2026-13-01', '2026-10-8', 'today', '', null, undefined, 20261008, '2026-10-08T00:00'].forEach((v) => {
      expect(parseDateKey(v)).toBeNull();
    });
  });

  it('knows leap days', () => {
    expect(parseDateKey('2028-02-29')).not.toBeNull();
    expect(parseDateKey('2026-02-29')).toBeNull();
  });
});

describe('shiftDateKey', () => {
  it('moves by whole days, across months and years', () => {
    expect(shiftDateKey('2026-10-08', -1)).toBe('2026-10-07');
    expect(shiftDateKey('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2026-10-08', 3)).toBe('2026-10-11');
    expect(shiftDateKey('2026-10-08', 0)).toBe('2026-10-08');
  });

  it('keeps the day right over the spring and autumn clock changes', () => {
    expect(shiftDateKey('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftDateKey('2026-03-09', -1)).toBe('2026-03-08');
    expect(shiftDateKey('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDateKey('2026-11-02', -1)).toBe('2026-11-01');
  });

  it('gives null for a bad key', () => {
    expect(shiftDateKey('nope', 1)).toBeNull();
  });
});

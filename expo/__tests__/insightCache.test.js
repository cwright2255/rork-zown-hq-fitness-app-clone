// lib/insightCache.js: which comment belongs to which numbers on which day, what is remembered, and for how long.
import {
  INSIGHT_KEEP, INSIGHT_MISS_MS, INSIGHT_SETTLE_MS, trainingLoadKey, readInsight, rememberInsight,
} from '../lib/insightCache';

const LOAD = { acuteLoad: 900, chronicWeeklyAvg: 600, ratio: 1.5, zone: 'elevated', zoneLabel: 'x' };
const NOW = 1_800_000_000_000;

describe('the constants', () => {
  it('wait a second and a half for the stores, remember "nothing" for half an hour, and keep a dozen comments', () => {
    expect(INSIGHT_SETTLE_MS).toBe(1500);
    expect(INSIGHT_MISS_MS).toBe(30 * 60 * 1000);
    expect(INSIGHT_KEEP).toBe(12);
  });
});

describe('trainingLoadKey', () => {
  it('names the person, the day, the zone and the two numbers the AI is given', () => {
    expect(trainingLoadKey('u1', '2026-10-14', LOAD)).toBe('trainingLoad|u1|2026-10-14|elevated|900|600');
  });

  it('is different for another person, another day, another zone or another number', () => {
    const base = trainingLoadKey('u1', '2026-10-14', LOAD);
    expect(trainingLoadKey('u2', '2026-10-14', LOAD)).not.toBe(base);
    expect(trainingLoadKey('u1', '2026-10-15', LOAD)).not.toBe(base);
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, zone: 'high' })).not.toBe(base);
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, acuteLoad: 901 })).not.toBe(base);
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, chronicWeeklyAvg: 601 })).not.toBe(base);
  });

  it('is the same for the same numbers, whatever else the reading carries', () => {
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, ratio: 9, zoneLabel: 'other' })).toBe(trainingLoadKey('u1', '2026-10-14', LOAD));
  });

  it('accepts a load of 0', () => {
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, acuteLoad: 0 })).toBe('trainingLoad|u1|2026-10-14|elevated|0|600');
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, chronicWeeklyAvg: 0 })).toBe('trainingLoad|u1|2026-10-14|elevated|900|0');
  });

  it('is null when there is nothing to key by', () => {
    expect(trainingLoadKey('', '2026-10-14', LOAD)).toBeNull();
    expect(trainingLoadKey(undefined, '2026-10-14', LOAD)).toBeNull();
    expect(trainingLoadKey(7, '2026-10-14', LOAD)).toBeNull();
    expect(trainingLoadKey('u1', '', LOAD)).toBeNull();
    expect(trainingLoadKey('u1', undefined, LOAD)).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', null)).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, zone: '' })).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, zone: undefined })).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, zone: 5 })).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, zone: 'insufficient_data' })).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, acuteLoad: NaN })).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, acuteLoad: '900' })).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, chronicWeeklyAvg: undefined })).toBeNull();
    expect(trainingLoadKey('u1', '2026-10-14', { ...LOAD, chronicWeeklyAvg: Infinity })).toBeNull();
  });
});

describe('readInsight', () => {
  const key = 'k';

  it('finds a comment, however old: its day is part of its key', () => {
    expect(readInsight({ k: { text: 'Steady.', at: NOW - 40 * 3600_000 } }, key, NOW)).toEqual({ found: true, text: 'Steady.' });
  });

  it('finds a recent "nothing", so a failed try is not repeated at once', () => {
    expect(readInsight({ k: { text: null, at: NOW - 60_000 } }, key, NOW)).toEqual({ found: true, text: null });
    expect(readInsight({ k: { text: null, at: NOW - INSIGHT_MISS_MS + 1 } }, key, NOW)).toEqual({ found: true, text: null });
  });

  it('lets an old "nothing" be tried again', () => {
    expect(readInsight({ k: { text: null, at: NOW - INSIGHT_MISS_MS } }, key, NOW)).toEqual({ found: false });
    expect(readInsight({ k: { text: null, at: NOW - 3600_000 } }, key, NOW)).toEqual({ found: false });
  });

  it('finds nothing for a key that is not there, or an entry that is not one', () => {
    expect(readInsight({}, key, NOW)).toEqual({ found: false });
    expect(readInsight({ other: { text: 'x', at: NOW } }, key, NOW)).toEqual({ found: false });
    expect(readInsight({ k: null }, key, NOW)).toEqual({ found: false });
    expect(readInsight({ k: 'text' }, key, NOW)).toEqual({ found: false });
    expect(readInsight({ k: { text: null } }, key, NOW)).toEqual({ found: false });
    expect(readInsight({ k: { text: null, at: 'now' } }, key, NOW)).toEqual({ found: false });
    expect(readInsight(null, key, NOW)).toEqual({ found: false });
    expect(readInsight('x', key, NOW)).toEqual({ found: false });
    expect(readInsight({ k: { text: 'x', at: NOW } }, '', NOW)).toEqual({ found: false });
    expect(readInsight({ k: { text: 'x', at: NOW } }, null, NOW)).toEqual({ found: false });
  });

  it('finds nothing for no key, even if something is filed under an empty one', () => {
    expect(readInsight({ '': { text: 'x', at: NOW } }, '', NOW)).toEqual({ found: false });
  });

  it('does not take a comment that is not text, or a time that is not a number, for the real thing', () => {
    expect(readInsight({ k: { text: 42, at: NOW - 3600_000 } }, key, NOW)).toEqual({ found: false });
    expect(readInsight({ k: { text: null, at: String(NOW) } }, key, NOW)).toEqual({ found: false });
  });

  it('does not take an empty comment for one', () => {
    expect(readInsight({ k: { text: '', at: NOW - 3600_000 } }, key, NOW)).toEqual({ found: false });
  });

  it('uses the clock when it is not told the time', () => {
    expect(readInsight({ k: { text: null, at: Date.now() } }, key)).toEqual({ found: true, text: null });
    expect(readInsight({ k: { text: null, at: Date.now() - 2 * INSIGHT_MISS_MS } }, key)).toEqual({ found: false });
  });
});

describe('rememberInsight', () => {
  it('files a comment under its key, with the time', () => {
    expect(rememberInsight({}, 'k', 'Steady.', NOW)).toEqual({ k: { text: 'Steady.', at: NOW } });
  });

  it('files "nothing" as null, for a missing, empty, blank or non-text comment', () => {
    for (const text of [null, undefined, '', '   ', 42, {}]) {
      expect({ text, out: rememberInsight({}, 'k', text, NOW).k }).toEqual({ text, out: { text: null, at: NOW } });
    }
  });

  it('keeps what was already there, and replaces the entry for the same key', () => {
    const out = rememberInsight({ a: { text: 'A', at: 1 }, k: { text: null, at: 2 } }, 'k', 'New.', NOW);
    expect(out).toEqual({ a: { text: 'A', at: 1 }, k: { text: 'New.', at: NOW } });
  });

  it('does not change the entries it was given', () => {
    const entries = { a: { text: 'A', at: 1 } };
    rememberInsight(entries, 'k', 'x', NOW);
    expect(entries).toEqual({ a: { text: 'A', at: 1 } });
  });

  it('keeps only the newest dozen', () => {
    let entries = {};
    for (let i = 0; i < INSIGHT_KEEP + 5; i += 1) entries = rememberInsight(entries, `k${i}`, `text ${i}`, NOW + i);
    const keys = Object.keys(entries);
    expect(keys).toHaveLength(INSIGHT_KEEP);
    expect(keys).toContain(`k${INSIGHT_KEEP + 4}`);
    expect(keys).toContain('k5');
    expect(keys).not.toContain('k4');
    expect(keys).not.toContain('k0');
  });

  it('keeps the entry just filed even when it is older than the others', () => {
    let entries = {};
    for (let i = 0; i < INSIGHT_KEEP - 1; i += 1) entries = rememberInsight(entries, `k${i}`, 't', NOW + 100 + i);
    expect(Object.keys(rememberInsight(entries, 'old', 't', NOW))).toContain('old');
  });

  it('starts from nothing when what was kept is not a set of entries', () => {
    expect(rememberInsight(null, 'k', 'x', NOW)).toEqual({ k: { text: 'x', at: NOW } });
    expect(rememberInsight('x', 'k', 'x', NOW)).toEqual({ k: { text: 'x', at: NOW } });
  });

  it('does not stop at an entry that was damaged on the phone', () => {
    const out = rememberInsight({ broken: null, a: { text: 'A', at: 1 } }, 'k', 'x', NOW);
    expect(out.k).toEqual({ text: 'x', at: NOW });
    expect(out.a).toEqual({ text: 'A', at: 1 });
  });

  it('files nothing under no key', () => {
    expect(rememberInsight({ a: { text: 'A', at: 1 } }, '', 'x', NOW)).toEqual({ a: { text: 'A', at: 1 } });
    expect(rememberInsight(null, null, 'x', NOW)).toEqual({});
  });

  it('uses the clock when it is not told the time', () => {
    const before = Date.now();
    const at = rememberInsight({}, 'k', 'x').k.at;
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });
});

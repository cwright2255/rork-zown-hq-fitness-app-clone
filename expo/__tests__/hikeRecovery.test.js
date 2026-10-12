import {
  STILL_RECORDING_MS, KEEP_UNFINISHED_MS, isHikeKind, hikeTrailId, canResumeSession, durableTracker, restoreTracker,
  durationLabel, recoveryMessage, cleanContext,
} from '../lib/hikeRecovery';
import {
  createTracker, startTracker, applyFixes, pauseTracker, resumeTracker, trackedMs, elevationGain,
} from '../lib/runTracker';

const T0 = 1_700_000_000_000;
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

// A reading `sec` seconds in, `x` metres east of the start, at height `alt` (metres) if given.
const fix = (sec, x, alt) => ({
  timestamp: T0 + sec * SEC,
  coords: {
    latitude: 40.7,
    longitude: -74 + x / 84300,
    accuracy: 4,
    speed: 1.4,
    altitude: alt === undefined ? null : alt,
    altitudeAccuracy: alt === undefined ? -1 : 3,
    heading: 0,
  },
});

// A hike on trail "t1", walked for `seconds` at 1.4 m/s (climbing 0.1 m a second if `climb`).
function hike(seconds, { kind = 'hike:t1', climb = false } = {}) {
  let t = startTracker(createTracker({ autoPause: false, kind }), T0);
  const fixes = [];
  for (let s = 1; s <= seconds; s += 1) fixes.push(fix(s, s * 1.4, climb ? 100 + s * 0.1 : undefined));
  t = applyFixes(t, fixes);
  return t;
}

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

// What would come back from the phone's storage: the saved copy, through text.
const saved = (tracker) => JSON.parse(JSON.stringify(durableTracker(tracker)));

describe('isHikeKind and hikeTrailId', () => {
  it('knows a hike by its kind', () => {
    expect(isHikeKind('hike:123')).toBe(true);
    expect(isHikeKind('hike:')).toBe(true);
    expect(isHikeKind('hike:a:b')).toBe(true);
  });

  it('does not take anything else for a hike', () => {
    ['run', 'walk', 'program:3', '', 'hiking', 'Hike:1', ' hike:1', 'xhike:1', null, undefined, 5, {}].forEach((kind) => {
      expect(isHikeKind(kind)).toBe(false);
    });
  });

  it('gives the trail of a hike', () => {
    expect(hikeTrailId('hike:abc')).toBe('abc');
    expect(hikeTrailId('hike:a:b')).toBe('a:b');
    expect(hikeTrailId('hike:')).toBe('');
  });

  it('gives no trail for anything else', () => {
    expect(hikeTrailId('run')).toBe('');
    expect(hikeTrailId('')).toBe('');
    expect(hikeTrailId(null)).toBe('');
    expect(hikeTrailId(undefined)).toBe('');
  });
});

describe('canResumeSession', () => {
  const running = (kind) => startTracker(createTracker({ kind }), T0);

  it('is false when nothing is being recorded', () => {
    expect(canResumeSession(createTracker(), 'hike:t1')).toBe(false);
    expect(canResumeSession(createTracker())).toBe(false);
    expect(canResumeSession(null, 'hike:t1')).toBe(false);
    expect(canResumeSession(undefined)).toBe(false);
  });

  it('is true for a recording of the same kind', () => {
    expect(canResumeSession(running('hike:t1'), 'hike:t1')).toBe(true);
  });

  it('is false for a recording of another kind', () => {
    expect(canResumeSession(running('hike:t1'), 'hike:t2')).toBe(false);
    expect(canResumeSession(running('hike:t1'), 'run')).toBe(false);
    expect(canResumeSession(running('run'), 'hike:t1')).toBe(false);
  });

  it('takes any recording when no kind is asked for', () => {
    expect(canResumeSession(running('hike:t1'))).toBe(true);
    expect(canResumeSession(running('hike:t1'), undefined)).toBe(true);
    expect(canResumeSession(running('hike:t1'), null)).toBe(true);
    expect(canResumeSession(running(''))).toBe(true);
  });

  it('compares a kind that is not text by its text', () => {
    expect(canResumeSession(running('5'), 5)).toBe(true);
    expect(canResumeSession(running('hike:t1'), 5)).toBe(false);
  });

  it('does not mind how long ago it was left', () => {
    const old = { ...pauseTracker(running('hike:t1'), T0 + MIN), lastT: T0 - 30 * 24 * HOUR };
    expect(canResumeSession(old, 'hike:t1')).toBe(true);
  });

  it('counts a paused recording too', () => {
    expect(canResumeSession(pauseTracker(running('hike:t1'), T0 + MIN), 'hike:t1')).toBe(true);
  });
});

describe('durableTracker', () => {
  it('keeps nothing when there is no recording', () => {
    expect(durableTracker(createTracker())).toBeNull();
    expect(durableTracker(createTracker({ kind: 'hike:t1' }))).toBeNull();
    expect(durableTracker(null)).toBeNull();
    expect(durableTracker(undefined)).toBeNull();
  });

  it('keeps nothing that is not a hike', () => {
    expect(durableTracker(hike(60, { kind: 'run' }))).toBeNull();
    expect(durableTracker(hike(60, { kind: 'walk' }))).toBeNull();
    expect(durableTracker(hike(60, { kind: '' }))).toBeNull();
    expect(durableTracker(hike(60, { kind: 'program:2' }))).toBeNull();
  });

  it('keeps what a hike is made of, and nothing else', () => {
    const t = hike(120);
    const kept = durableTracker(t);
    expect(Object.keys(kept).sort()).toEqual([
      'autoPause', 'current', 'distanceM', 'elev', 'kind', 'lastFixT', 'lastT', 'movingMs', 'pausedAt', 'route',
      'splitMs', 'splits', 'startedAt', 'status',
    ]);
    expect(kept).toMatchObject({
      status: 'running', autoPause: false, kind: 'hike:t1', startedAt: T0, lastT: t.lastT, lastFixT: t.lastFixT,
      pausedAt: 0, movingMs: t.movingMs, distanceM: t.distanceM, splitMs: t.splitMs,
    });
    expect(kept.distanceM).toBeGreaterThan(100);
    expect(kept.route).toBe(t.route);
    expect(kept.splits).toBe(t.splits);
    expect(kept.current).toBe(t.current);
  });

  it('keeps a hike that is paused, and one that is paused by itself', () => {
    expect(durableTracker(pauseTracker(hike(60), T0 + 61 * SEC)).status).toBe('paused');
    expect(durableTracker({ ...hike(60), status: 'auto' }).status).toBe('auto');
    expect(durableTracker(pauseTracker(hike(60), T0 + 61 * SEC)).pausedAt).toBe(T0 + 61 * SEC);
  });

  it('keeps only the totals of the climb', () => {
    const t = hike(300, { climb: true });
    expect(t.elev.gain).toBeGreaterThan(5);
    expect(Object.keys(t.elev).length).toBeGreaterThan(2);
    expect(durableTracker(t).elev).toEqual({ gain: t.elev.gain, loss: t.elev.loss });
  });

  it('keeps no climb when there has been no height reading', () => {
    expect(hike(60).elev).toBeNull();
    expect(durableTracker(hike(60)).elev).toBeNull();
  });

  it('leaves out what is worked out again from the next reading', () => {
    const kept = durableTracker(hike(60));
    ['kf', 'win', 'anchor', 'pauseAnchor', 'lastRaw', 'rejects', 'gps', 'acc', 'still', 'slowSince', 'moveSince', 'holdUntil', 'dopplerSeen']
      .forEach((key) => expect(kept).not.toHaveProperty(key));
  });

  it('survives being turned into text and back', () => {
    const kept = durableTracker(hike(120, { climb: true }));
    expect(JSON.parse(JSON.stringify(kept))).toEqual(kept);
  });
});

describe('restoreTracker: what is refused', () => {
  const good = () => saved(hike(120));
  const NOW = T0 + 130 * SEC;

  it('is nothing for nothing', () => {
    [null, undefined, 0, '', 'x', 5, true].forEach((value) => expect(restoreTracker(value, NOW)).toBeNull());
  });

  it('is nothing for something that is not a hike', () => {
    expect(restoreTracker({ ...good(), kind: 'run' }, NOW)).toBeNull();
    expect(restoreTracker({ ...good(), kind: '' }, NOW)).toBeNull();
    expect(restoreTracker({ ...good(), kind: undefined }, NOW)).toBeNull();
    expect(restoreTracker({ ...good(), kind: 5 }, NOW)).toBeNull();
  });

  it('is nothing for a recording that is not going or paused', () => {
    ['idle', 'done', '', undefined, null, 3].forEach((status) => {
      expect(restoreTracker({ ...good(), status }, NOW)).toBeNull();
    });
  });

  it.each(['startedAt', 'lastT', 'movingMs', 'distanceM'])('is nothing when %s is missing or no use', (key) => {
    [undefined, null, 'x', '5', NaN, Infinity, -1, {}, []].forEach((value) => {
      expect(restoreTracker({ ...good(), [key]: value }, NOW)).toBeNull();
    });
  });

  it('is nothing when the start or the last time is 0', () => {
    expect(restoreTracker({ ...good(), startedAt: 0 }, NOW)).toBeNull();
    expect(restoreTracker({ ...good(), lastT: 0 }, NOW)).toBeNull();
  });

  it('takes a hike that has not got anywhere yet', () => {
    const t = restoreTracker({ ...good(), movingMs: 0, distanceM: 0 }, NOW);
    expect(t.movingMs).toBe(0);
    expect(t.distanceM).toBe(0);
  });

  it('is nothing for a hike left more than a week ago, and the hike for exactly a week', () => {
    const s = good();
    expect(restoreTracker(s, s.lastT + KEEP_UNFINISHED_MS)).not.toBeNull();
    expect(restoreTracker(s, s.lastT + KEEP_UNFINISHED_MS + 1)).toBeNull();
    expect(KEEP_UNFINISHED_MS).toBe(7 * 24 * HOUR);
  });

  it('counts the week from the last reading when that is later than the last time counted', () => {
    const s = { ...good(), lastT: T0 + MIN, lastFixT: T0 + 3 * HOUR };
    expect(restoreTracker(s, T0 + 3 * HOUR + KEEP_UNFINISHED_MS)).not.toBeNull();
    expect(restoreTracker(s, T0 + 3 * HOUR + KEEP_UNFINISHED_MS + 1)).toBeNull();
  });

  it('works out the week from the time counted when there is no reading time', () => {
    const s = { ...good(), lastFixT: undefined };
    expect(restoreTracker(s, s.lastT + KEEP_UNFINISHED_MS)).not.toBeNull();
    expect(restoreTracker(s, s.lastT + KEEP_UNFINISHED_MS + 1)).toBeNull();
  });
});

describe('restoreTracker: going or paused', () => {
  const s = () => saved(hike(120));
  const lastT = () => s().lastT;

  it('carries on recording a hike last heard from a moment ago', () => {
    const t = restoreTracker(s(), lastT() + 30 * SEC);
    expect(t.status).toBe('running');
    expect(t.pausedAt).toBe(0);
  });

  it('carries on for up to two minutes, and not for longer', () => {
    expect(STILL_RECORDING_MS).toBe(2 * MIN);
    expect(restoreTracker(s(), lastT() + STILL_RECORDING_MS).status).toBe('running');
    expect(restoreTracker(s(), lastT() + STILL_RECORDING_MS + 1).status).toBe('paused');
  });

  it('carries on at once when it is the same moment', () => {
    expect(restoreTracker(s(), lastT()).status).toBe('running');
  });

  it('carries on when the clock reads earlier than the hike (the clock was put back)', () => {
    expect(restoreTracker(s(), lastT() - 5 * HOUR).status).toBe('running');
  });

  it('judges how long ago from the last reading when that is later than the time counted', () => {
    const later = { ...s(), lastT: T0 + MIN, lastFixT: T0 + 10 * MIN };
    expect(restoreTracker(later, T0 + 10 * MIN + MIN).status).toBe('running');
    expect(restoreTracker(later, T0 + 10 * MIN + 3 * MIN).status).toBe('paused');
  });

  it('judges how long ago from the time counted when there is no reading time', () => {
    const noFix = { ...s(), lastFixT: undefined };
    expect(restoreTracker(noFix, noFix.lastT + MIN).status).toBe('running');
    expect(restoreTracker(noFix, noFix.lastT + 3 * MIN).status).toBe('paused');
  });

  it('brings back a hike left longer ago paused where it was last heard from', () => {
    const t = restoreTracker(s(), lastT() + 3 * HOUR);
    expect(t.status).toBe('paused');
    expect(t.pausedAt).toBe(lastT());
  });

  it('does not count the time the app was closed', () => {
    const before = hike(120);
    const t = restoreTracker(saved(before), lastT() + 3 * HOUR);
    expect(t.movingMs).toBe(before.movingMs);
    expect(trackedMs(t, lastT() + 3 * HOUR)).toBe(before.movingMs);
  });

  it('brings back a hike paused by itself as paused, even a moment later', () => {
    const auto = { ...s(), status: 'auto' };
    expect(restoreTracker(auto, auto.lastT + SEC).status).toBe('paused');
    expect(restoreTracker(auto, auto.lastT + 3 * HOUR).status).toBe('paused');
    expect(restoreTracker(auto, auto.lastT + SEC).pausedAt).toBe(auto.lastT);
  });

  it('keeps a hike paused by hand paused, as of when it was paused', () => {
    const paused = saved(pauseTracker(hike(120), T0 + 125 * SEC));
    const t = restoreTracker(paused, T0 + 126 * SEC);
    expect(t.status).toBe('paused');
    expect(t.pausedAt).toBe(T0 + 125 * SEC);
    expect(restoreTracker(paused, T0 + 5 * HOUR).pausedAt).toBe(T0 + 125 * SEC);
  });

  it('keeps the time it was paused at when readings went on coming in after that', () => {
    const paused = { ...saved(pauseTracker(hike(120), T0 + 125 * SEC)), lastT: T0 + 300 * SEC, lastFixT: T0 + 300 * SEC };
    expect(restoreTracker(paused, T0 + 5 * HOUR).pausedAt).toBe(T0 + 125 * SEC);
  });

  it('does not take a paused time from a hike that was going, however stale', () => {
    const going = { ...s(), pausedAt: 5 };
    expect(going.status).toBe('running');
    expect(restoreTracker(going, going.lastT + 3 * HOUR).pausedAt).toBe(going.lastT);
  });

  it('says it was paused where it was last heard from when the paused time is missing', () => {
    const paused = { ...saved(pauseTracker(hike(120), T0 + 125 * SEC)), pausedAt: 0 };
    expect(restoreTracker(paused, T0 + 5 * HOUR).pausedAt).toBe(paused.lastT);
    expect(restoreTracker({ ...paused, pausedAt: 'x' }, T0 + 5 * HOUR).pausedAt).toBe(paused.lastT);
    expect(restoreTracker({ ...paused, pausedAt: -5 }, T0 + 5 * HOUR).pausedAt).toBe(paused.lastT);
  });
});

describe('restoreTracker: what comes back', () => {
  const before = hike(300, { climb: true });
  const s = () => saved(before);
  const NOW = before.lastT + 3 * HOUR;

  it('has everything a tracker has', () => {
    const t = restoreTracker(s(), NOW);
    expect(Object.keys(t).sort()).toEqual(Object.keys(createTracker()).sort());
  });

  it('brings back the numbers of the hike', () => {
    const t = restoreTracker(s(), NOW);
    expect(t.kind).toBe('hike:t1');
    expect(t.startedAt).toBe(T0);
    expect(t.lastT).toBe(before.lastT);
    expect(t.lastFixT).toBe(before.lastFixT);
    expect(t.movingMs).toBe(before.movingMs);
    expect(t.distanceM).toBe(before.distanceM);
    expect(t.splitMs).toBe(before.splitMs);
    expect(t.splits).toEqual(before.splits);
    expect(t.route).toEqual(before.route);
    expect(t.current).toEqual(before.current);
    expect(t.elev).toEqual({ gain: before.elev.gain, loss: before.elev.loss });
    expect(t.distanceM).toBeGreaterThan(300);
    expect(t.route.length).toBeGreaterThan(10);
  });

  it('starts again with the smoothing and jump checking', () => {
    const t = restoreTracker(s(), NOW);
    expect(t).toMatchObject({
      kf: null, win: [], anchor: null, pauseAnchor: null, lastRaw: null, rejects: 0, gps: 'searching', acc: null,
      still: false, slowSince: 0, moveSince: 0, holdUntil: 0, dopplerSeen: false,
    });
  });

  it('keeps auto-pause on only when it was on', () => {
    expect(restoreTracker({ ...s(), autoPause: true }, NOW).autoPause).toBe(true);
    expect(restoreTracker({ ...s(), autoPause: false }, NOW).autoPause).toBe(false);
    expect(restoreTracker({ ...s(), autoPause: 'yes' }, NOW).autoPause).toBe(false);
    expect(restoreTracker({ ...s(), autoPause: 1 }, NOW).autoPause).toBe(false);
    expect(restoreTracker({ ...s(), autoPause: undefined }, NOW).autoPause).toBe(false);
  });

  it('keeps the splits that make sense', () => {
    const t = restoreTracker({ ...s(), splits: [300, NaN, 'x', -5, 0, 280, null, Infinity] }, NOW);
    expect(t.splits).toEqual([300, 280]);
    expect(restoreTracker({ ...s(), splits: 'x' }, NOW).splits).toEqual([]);
    expect(restoreTracker({ ...s(), splits: undefined }, NOW).splits).toEqual([]);
  });

  it('has 0 for a split time it cannot use', () => {
    expect(restoreTracker({ ...s(), splitMs: 123000 }, NOW).splitMs).toBe(123000);
    expect(restoreTracker({ ...s(), splitMs: 0 }, NOW).splitMs).toBe(0);
    [undefined, null, 'x', NaN, -1].forEach((value) => {
      expect(restoreTracker({ ...s(), splitMs: value }, NOW).splitMs).toBe(0);
    });
  });

  it('has 0 for a reading time it cannot use', () => {
    [undefined, null, 'x', NaN, -1].forEach((value) => {
      expect(restoreTracker({ ...s(), lastFixT: value }, NOW).lastFixT).toBe(0);
    });
  });

  it('keeps the places on the route that are real, and nothing else about them', () => {
    const route = [
      { latitude: 40.1, longitude: -74.1, extra: 'x' },
      { latitude: NaN, longitude: -74 },
      { latitude: 40.2 },
      null,
      'x',
      { latitude: '40.3', longitude: -74.3 },
      { latitude: 0, longitude: 0 },
      { latitude: 40.4, longitude: -74.4 },
    ];
    const t = restoreTracker({ ...s(), route }, NOW);
    expect(t.route).toEqual([{ latitude: 40.1, longitude: -74.1 }, { latitude: 0, longitude: 0 }, { latitude: 40.4, longitude: -74.4 }]);
    expect(restoreTracker({ ...s(), route: 'x' }, NOW).route).toEqual([]);
    expect(restoreTracker({ ...s(), route: undefined }, NOW).route).toEqual([]);
  });

  it('keeps the current place only when it is real', () => {
    expect(restoreTracker({ ...s(), current: { latitude: 40.5, longitude: -74.5, x: 1 } }, NOW).current)
      .toEqual({ latitude: 40.5, longitude: -74.5 });
    [undefined, null, 'x', {}, { latitude: 40.5 }, { latitude: 40.5, longitude: 'x' }].forEach((current) => {
      expect(restoreTracker({ ...s(), current }, NOW).current).toBeNull();
    });
  });

  it('keeps the climb only when both totals are real', () => {
    expect(restoreTracker({ ...s(), elev: { gain: 12, loss: 4, smooth: 99 } }, NOW).elev).toEqual({ gain: 12, loss: 4 });
    expect(restoreTracker({ ...s(), elev: { gain: 0, loss: 0 } }, NOW).elev).toEqual({ gain: 0, loss: 0 });
    [
      undefined, null, 'x', {}, { gain: 5 }, { loss: 5 }, { gain: -1, loss: 0 }, { gain: 0, loss: -1 },
      { gain: 'x', loss: 0 }, { gain: 0, loss: NaN },
    ].forEach((elev) => {
      expect(restoreTracker({ ...s(), elev }, NOW).elev).toBeNull();
    });
  });

  it('does not change what it is given', () => {
    const frozen = deepFreeze(s());
    expect(() => restoreTracker(frozen, NOW)).not.toThrow();
  });

  it('does not share the lists with what it is given', () => {
    const input = s();
    const t = restoreTracker(input, NOW);
    expect(t.route).not.toBe(input.route);
    expect(t.splits).not.toBe(input.splits);
  });

  it('is not changed by the current time when the hike is not going', () => {
    expect(restoreTracker(s(), NOW)).toEqual(restoreTracker(s(), NOW + HOUR));
  });

  it('uses the time of the call when it is not given one', () => {
    const t = restoreTracker({ ...s(), lastT: Date.now() - 10 * SEC, lastFixT: Date.now() - 10 * SEC });
    expect(t.status).toBe('running');
    expect(restoreTracker({ ...s(), lastT: Date.now() - 10 * MIN, lastFixT: Date.now() - 10 * MIN }).status).toBe('paused');
  });
});

describe('carrying on after a restore', () => {
  const walk = (tracker, from, to, x0) => {
    const fixes = [];
    for (let sec = from; sec <= to; sec += 1) fixes.push(fix(sec, x0 + (sec - from + 1) * 1.4));
    return applyFixes(tracker, fixes);
  };

  it('does not count the time the app was closed, or the way walked in it, once resumed', () => {
    const before = hike(300);
    const restoredAt = T0 + 3 * HOUR;
    let t = restoreTracker(saved(before), restoredAt);
    expect(t.status).toBe('paused');
    t = resumeTracker(t, restoredAt);
    expect(t.status).toBe('running');
    // 60 more seconds of walking, from somewhere else entirely.
    const fixes = [];
    for (let sec = 1; sec <= 60; sec += 1) {
      fixes.push({ ...fix(0, 5000 + sec * 1.4), timestamp: restoredAt + sec * SEC });
    }
    t = applyFixes(t, fixes);
    const addedMs = t.movingMs - before.movingMs;
    const addedM = t.distanceM - before.distanceM;
    expect(addedMs).toBeGreaterThan(55 * SEC);
    expect(addedMs).toBeLessThan(65 * SEC);
    expect(addedM).toBeGreaterThan(50);
    expect(addedM).toBeLessThan(100);
    expect(t.route.length).toBeGreaterThan(before.route.length);
  });

  it('keeps counting a hike the phone woke the app for again straight away', () => {
    const before = hike(300);
    let t = restoreTracker(saved(before), before.lastT + 20 * SEC);
    expect(t.status).toBe('running');
    t = walk(t, 321, 380, 500);
    // The 20 seconds in between count as hiking time; the way walked in them does not.
    expect(t.movingMs - before.movingMs).toBeGreaterThan(75 * SEC);
    expect(t.movingMs - before.movingMs).toBeLessThan(85 * SEC);
    expect(t.distanceM).toBeGreaterThan(before.distanceM);
  });

  it('does not count the way between the last place and the first new one', () => {
    const before = hike(300);
    const restoredAt = before.lastT + 20 * SEC;
    let t = restoreTracker(saved(before), restoredAt);
    t = applyFixes(t, [{ ...fix(0, 3000), timestamp: restoredAt + SEC }]);
    expect(t.distanceM).toBe(before.distanceM);
  });

  it('keeps the totals of a climb, and does not add the change of height while away', () => {
    const before = hike(300, { climb: true });
    expect(elevationGain(before)).toBeGreaterThan(5);
    const restoredAt = T0 + 3 * HOUR;
    let t = resumeTracker(restoreTracker(saved(before), restoredAt), restoredAt);
    // Back on the trail 400 m lower than where it was left.
    const lower = [];
    for (let sec = 1; sec <= 30; sec += 1) {
      lower.push({ ...fix(0, 2000 + sec * 1.4, 300 - sec * 0.01), timestamp: restoredAt + sec * SEC });
    }
    t = applyFixes(t, lower);
    expect(elevationGain(t)).toBeGreaterThanOrEqual(elevationGain(before));
    expect(elevationGain(t)).toBeLessThan(elevationGain(before) + 2);
    expect(t.elev.loss).toBeLessThan(before.elev.loss + 2);
  });

  it('finishes with the same numbers as the hike had when the app was closed', () => {
    const before = hike(300, { climb: true });
    const t = restoreTracker(saved(before), T0 + 3 * HOUR);
    const a = require('../lib/runTracker').finishTracker(before, before.lastT);
    const b = require('../lib/runTracker').finishTracker(t, T0 + 3 * HOUR);
    expect(b).toEqual(a);
  });
});

describe('durationLabel', () => {
  it('shows minutes, and hours with minutes from an hour', () => {
    expect(durationLabel(0)).toBe('0m');
    expect(durationLabel(59)).toBe('0m');
    expect(durationLabel(60)).toBe('1m');
    expect(durationLabel(3599)).toBe('59m');
    expect(durationLabel(3600)).toBe('1h 0m');
    expect(durationLabel(7800)).toBe('2h 10m');
    expect(durationLabel(7859)).toBe('2h 10m');
    expect(durationLabel(36000)).toBe('10h 0m');
  });
});

describe('recoveryMessage', () => {
  const paused = (distanceM, movingMs) => ({ ...createTracker({ kind: 'hike:t1' }), status: 'paused', lastT: T0, movingMs, distanceM });

  it('says how far and how long, and what to do', () => {
    expect(recoveryMessage(paused(5234, 7800 * SEC), T0 + HOUR))
      .toBe('You have an unfinished hike: 5.2 km in 2h 10m. Open it to carry on or to save it.');
  });

  it('shows one decimal for the distance', () => {
    expect(recoveryMessage(paused(5240, 600 * SEC), T0)).toContain('5.2 km');
    expect(recoveryMessage(paused(5260, 600 * SEC), T0)).toContain('5.3 km');
    expect(recoveryMessage(paused(40, 600 * SEC), T0)).toContain('0.0 km');
    expect(recoveryMessage(paused(12000, 600 * SEC), T0)).toContain('12.0 km');
  });

  it('counts the time a hike that is still going has run since it was last heard from', () => {
    const going = { ...paused(2000, 600 * SEC), status: 'running' };
    expect(recoveryMessage(going, T0 + 60 * SEC)).toContain('in 11m');
    expect(recoveryMessage(paused(2000, 600 * SEC), T0 + 60 * SEC)).toContain('in 10m');
  });

  it('rounds the seconds, so a minute turns over at the half second', () => {
    expect(recoveryMessage(paused(2000, 3599_600), T0)).toContain('in 1h 0m');
    expect(recoveryMessage(paused(2000, 3599_400), T0)).toContain('in 59m');
  });

  it('uses the time of the call when it is not given one', () => {
    const going = { ...paused(2000, 600 * SEC), status: 'running', lastT: Date.now() - 5 * MIN };
    expect(recoveryMessage(going)).toContain('in 15m');
  });
});

describe('cleanContext', () => {
  it('is nothing for nothing', () => {
    [null, undefined, '', 'x', 5, true, [], {}].forEach((value) => expect(cleanContext(value)).toBeNull());
  });

  it('keeps the map and the path name', () => {
    expect(cleanContext({ mapId: '12', pathName: 'Loop' })).toEqual({ mapId: '12', pathName: 'Loop' });
    expect(cleanContext({ mapId: '12' })).toEqual({ mapId: '12' });
    expect(cleanContext({ pathName: 'Loop' })).toEqual({ pathName: 'Loop' });
  });

  it('keeps nothing else', () => {
    expect(cleanContext({ mapId: '12', pathName: 'Loop', id: 'x', resume: '1' })).toEqual({ mapId: '12', pathName: 'Loop' });
  });

  it('leaves out what is not text or is empty', () => {
    expect(cleanContext({ mapId: 12, pathName: 'Loop' })).toEqual({ pathName: 'Loop' });
    expect(cleanContext({ mapId: '12', pathName: null })).toEqual({ mapId: '12' });
    expect(cleanContext({ mapId: '12', pathName: 5 })).toEqual({ mapId: '12' });
    expect(cleanContext({ mapId: '', pathName: 'Loop' })).toEqual({ pathName: 'Loop' });
    expect(cleanContext({ mapId: '12', pathName: '' })).toEqual({ mapId: '12' });
    expect(cleanContext({ mapId: '', pathName: '' })).toBeNull();
    expect(cleanContext({ mapId: 12, pathName: undefined })).toBeNull();
    expect(cleanContext({ mapId: null, pathName: null })).toBeNull();
  });
});

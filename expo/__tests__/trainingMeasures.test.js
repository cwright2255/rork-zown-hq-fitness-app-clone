// The counters the training engine's claims are backed with (lib/trainingMeasures.js): what each one counts, the rates they make, and which sets
// and which exercises count as hitting a target and as skipped. Every expected number is worked out by hand from the definitions at the top of that file.
import {
  MEASURE_FIELDS, MEASURE_MAX, emptyMeasures, sanitizeMeasures, noteStart, noteSet, noteEnd, measureRates, setHitTarget, skippedKeys, sessionOutcome,
} from '../lib/trainingMeasures';

const T0 = new Date('2026-10-26T12:00:00.000Z');
const T1 = new Date('2026-11-02T08:00:00.000Z');
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

describe('the counters', () => {
  it('are these nine, all whole numbers, and the day counting began', () => {
    expect(MEASURE_FIELDS).toEqual([
      'sessionsStarted', 'exercisesOffered', 'exercisesSwapped', 'exercisesExcluded',
      'sessionsFinished', 'sessionsCutShort', 'exercisesSkipped',
      'setsWithTarget', 'setsHitTarget',
    ]);
    expect(emptyMeasures()).toEqual({
      v: 1, since: '', sessionsStarted: 0, exercisesOffered: 0, exercisesSwapped: 0, exercisesExcluded: 0,
      sessionsFinished: 0, sessionsCutShort: 0, exercisesSkipped: 0, setsWithTarget: 0, setsHitTarget: 0,
    });
  });

  it('hold nothing about the person: no name, no weight, no exercise', () => {
    const everything = noteEnd(noteSet(noteStart(emptyMeasures(), { exercises: 5, swapped: 1, excluded: 1 }, T0), true, T0), { cutShort: true, skipped: 2 }, T0);
    expect(Object.keys(everything).sort()).toEqual(['v', 'since', ...MEASURE_FIELDS].sort());
    Object.entries(everything).forEach(([k, v]) => { if (k !== 'since') expect(typeof v).toBe('number'); });
  });
});

describe('sanitizeMeasures', () => {
  it('gives all zeros for anything that is not an object', () => {
    [undefined, null, 'x', 5, [], true].forEach((raw) => expect(sanitizeMeasures(raw)).toEqual(emptyMeasures()));
  });

  it('keeps whole non-negative numbers, rounds a fraction down, and zeroes the rest', () => {
    const out = sanitizeMeasures({
      sessionsStarted: 7, exercisesOffered: 3.9, exercisesSwapped: -2, exercisesExcluded: '4', sessionsFinished: NaN, sessionsCutShort: Infinity,
      exercisesSkipped: null, setsWithTarget: 12, setsHitTarget: 9, since: '2026-10-01T00:00:00.000Z', extra: 5,
    });
    expect(out).toEqual({
      v: 1, since: '2026-10-01T00:00:00.000Z', sessionsStarted: 7, exercisesOffered: 3, exercisesSwapped: 0, exercisesExcluded: 0,
      sessionsFinished: 0, sessionsCutShort: 0, exercisesSkipped: 0, setsWithTarget: 12, setsHitTarget: 9,
    });
  });

  it('cannot hold more than a million in a counter, and keeps `since` only when it is text', () => {
    expect(sanitizeMeasures({ setsWithTarget: 5e9 }).setsWithTarget).toBe(1000000);
    expect(sanitizeMeasures({ since: 5 }).since).toBe('');
  });

  it('does not change what it is given', () => {
    const raw = deepFreeze({ sessionsStarted: 2 });
    expect(sanitizeMeasures(raw).sessionsStarted).toBe(2);
  });
});

describe('Start Workout is counted', () => {
  it('as one session, the exercises in it, and how many were swapped and excluded first', () => {
    const out = noteStart(emptyMeasures(), { exercises: 5, swapped: 2, excluded: 1 }, T0);
    expect(out).toMatchObject({ sessionsStarted: 1, exercisesOffered: 5, exercisesSwapped: 2, exercisesExcluded: 1 });
    expect(out).toMatchObject({ sessionsFinished: 0, sessionsCutShort: 0, exercisesSkipped: 0, setsWithTarget: 0, setsHitTarget: 0 });
  });

  it('and adds to what was counted', () => {
    const a = noteStart(emptyMeasures(), { exercises: 5, swapped: 2, excluded: 1 }, T0);
    const b = noteStart(a, { exercises: 4, swapped: 0, excluded: 0 }, T1);
    expect(b).toMatchObject({ sessionsStarted: 2, exercisesOffered: 9, exercisesSwapped: 2, exercisesExcluded: 1 });
  });

  it('with nothing made up for what is missing or wrong', () => {
    expect(noteStart(emptyMeasures(), undefined, T0)).toMatchObject({ sessionsStarted: 1, exercisesOffered: 0, exercisesSwapped: 0, exercisesExcluded: 0 });
    expect(noteStart(emptyMeasures(), { exercises: -3, swapped: 'x', excluded: NaN }, T0)).toMatchObject({ exercisesOffered: 0, exercisesSwapped: 0, exercisesExcluded: 0 });
  });
});

describe('a set that had a target is counted', () => {
  it('as one set with a target, and one that hit it when it did', () => {
    const hit = noteSet(emptyMeasures(), true, T0);
    const miss = noteSet(hit, false, T0);
    expect(hit).toMatchObject({ setsWithTarget: 1, setsHitTarget: 1 });
    expect(miss).toMatchObject({ setsWithTarget: 2, setsHitTarget: 1 });
  });

  it('and only a set that really hit it counts as hitting it', () => {
    expect(noteSet(emptyMeasures(), 'yes', T0).setsHitTarget).toBe(0);
    expect(noteSet(emptyMeasures(), 1, T0).setsHitTarget).toBe(0);
    expect(noteSet(emptyMeasures(), undefined, T0).setsHitTarget).toBe(0);
  });
});

describe('the end of an engine workout is counted', () => {
  it('as finished, with the exercises skipped in it', () => {
    expect(noteEnd(emptyMeasures(), { cutShort: false, skipped: 2 }, T0)).toMatchObject({ sessionsFinished: 1, sessionsCutShort: 0, exercisesSkipped: 2 });
  });

  it('as cut short when it was saved part way, with the exercises skipped in it', () => {
    expect(noteEnd(emptyMeasures(), { cutShort: true, skipped: 1 }, T0)).toMatchObject({ sessionsFinished: 0, sessionsCutShort: 1, exercisesSkipped: 1 });
  });

  it('as finished unless it says it was cut short, whatever else it says', () => {
    expect(noteEnd(emptyMeasures(), { cutShort: 'yes' }, T0)).toMatchObject({ sessionsFinished: 1, sessionsCutShort: 0 });
    expect(noteEnd(emptyMeasures(), undefined, T0)).toMatchObject({ sessionsFinished: 1, exercisesSkipped: 0 });
  });
});

describe('since', () => {
  it('is the day the first thing was counted, and stays', () => {
    const a = noteSet(emptyMeasures(), true, T0);
    expect(a.since).toBe('2026-10-26T12:00:00.000Z');
    expect(noteStart(a, { exercises: 1 }, T1).since).toBe('2026-10-26T12:00:00.000Z');
    expect(noteEnd(a, {}, T1).since).toBe('2026-10-26T12:00:00.000Z');
  });

  it('takes the time from the number, the date or the clock', () => {
    expect(noteSet(emptyMeasures(), true, T0.getTime()).since).toBe('2026-10-26T12:00:00.000Z');
    jest.useFakeTimers({ now: T1 });
    try {
      expect(noteSet(emptyMeasures(), true).since).toBe('2026-11-02T08:00:00.000Z');
      expect(noteSet(emptyMeasures(), true, new Date('nonsense')).since).toBe('2026-11-02T08:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('counting never changes what it is given, and keeps a damaged copy usable', () => {
  it('returns a new object', () => {
    const base = deepFreeze(emptyMeasures());
    const out = noteStart(base, { exercises: 3 }, T0);
    expect(out).not.toBe(base);
    expect(base.sessionsStarted).toBe(0);
  });

  it('starts again from zero where a counter was damaged', () => {
    expect(noteSet({ setsWithTarget: 'lots', setsHitTarget: 4 }, true, T0)).toMatchObject({ setsWithTarget: 1, setsHitTarget: 5 });
    expect(noteSet(undefined, false, T0)).toMatchObject({ setsWithTarget: 1, setsHitTarget: 0 });
  });

  it('stops at a million', () => {
    expect(noteSet({ setsWithTarget: MEASURE_MAX, setsHitTarget: MEASURE_MAX }, true, T0)).toMatchObject({ setsWithTarget: MEASURE_MAX, setsHitTarget: MEASURE_MAX });
  });
});

describe('measureRates', () => {
  it('are null until there is something to divide by', () => {
    expect(measureRates(emptyMeasures())).toEqual({ setsHit: null, cutShort: null, swapped: null, skipped: null });
    expect(measureRates(undefined)).toEqual({ setsHit: null, cutShort: null, swapped: null, skipped: null });
  });

  it('are the share of sets that hit their target, workouts cut short, exercises swapped and exercises skipped', () => {
    const m = {
      ...emptyMeasures(), setsWithTarget: 40, setsHitTarget: 30, sessionsFinished: 6, sessionsCutShort: 2, exercisesOffered: 50, exercisesSwapped: 5, exercisesSkipped: 3,
    };
    expect(measureRates(m)).toEqual({ setsHit: 0.75, cutShort: 0.25, swapped: 0.1, skipped: 0.06 });
  });

  it('are rounded to four places', () => {
    expect(measureRates({ ...emptyMeasures(), setsWithTarget: 3, setsHitTarget: 2 }).setsHit).toBe(0.6667);
  });

  it('count a workout cut short and one finished each, as the denominators say: cut short / (finished + cut short)', () => {
    expect(measureRates({ ...emptyMeasures(), sessionsCutShort: 1 }).cutShort).toBe(1);
    expect(measureRates({ ...emptyMeasures(), sessionsFinished: 1 }).cutShort).toBe(0);
    expect(measureRates({ ...emptyMeasures(), sessionsFinished: 3, sessionsCutShort: 1 }).cutShort).toBe(0.25);
  });

  it('use the sessions started, not the workouts ended, for swaps and skips', () => {
    expect(measureRates({ ...emptyMeasures(), exercisesSwapped: 2, exercisesOffered: 8, sessionsFinished: 100 }).swapped).toBe(0.25);
    expect(measureRates({ ...emptyMeasures(), exercisesSkipped: 2 }).skipped).toBeNull();
  });
});

describe('setHitTarget', () => {
  const loaded = { weight: 60, targetReps: 8 };

  it('is true when the weight and the reps reach the target', () => {
    expect(setHitTarget({ weight: 60, reps: 8, prescription: loaded })).toBe(true);
    expect(setHitTarget({ weight: 62.5, reps: 10, prescription: loaded })).toBe(true);
  });

  it('is false when either falls short', () => {
    expect(setHitTarget({ weight: 60, reps: 7, prescription: loaded })).toBe(false);
    expect(setHitTarget({ weight: 57.5, reps: 8, prescription: loaded })).toBe(false);
    expect(setHitTarget({ weight: 55, reps: 5, prescription: loaded })).toBe(false);
  });

  it('allows for a weight typed to the nearest hundredth', () => {
    expect(setHitTarget({ weight: 59.996, reps: 8, prescription: { weight: 60, targetReps: 8 } })).toBe(true);
    expect(setHitTarget({ weight: 59.99, reps: 8, prescription: { weight: 60, targetReps: 8 } })).toBe(false);
  });

  it('judges a bodyweight exercise on its reps alone', () => {
    expect(setHitTarget({ weight: 0, reps: 12, prescription: { weight: null, targetReps: 12 }, bodyweight: true })).toBe(true);
    expect(setHitTarget({ weight: 0, reps: 11, prescription: { weight: null, targetReps: 12 }, bodyweight: true })).toBe(false);
    expect(setHitTarget({ reps: 15, prescription: { targetReps: 12 }, bodyweight: true })).toBe(true);
  });

  it('is null, and nothing is counted, when there was no target to reach', () => {
    [undefined, null, 'x', 5, []].forEach((prescription) => expect(setHitTarget({ weight: 60, reps: 8, prescription })).toBeNull());
    expect(setHitTarget()).toBeNull();
    expect(setHitTarget({ weight: 60, reps: 8, prescription: { weight: 60 } })).toBeNull();
    expect(setHitTarget({ weight: 60, reps: 8, prescription: { weight: 60, targetReps: 0 } })).toBeNull();
    expect(setHitTarget({ weight: 60, reps: 8, prescription: { weight: 60, targetReps: 'eight' } })).toBeNull();
  });

  it('is null when a loaded exercise\'s target has no weight, or what was logged is not a number', () => {
    expect(setHitTarget({ weight: 60, reps: 8, prescription: { weight: null, targetReps: 8 } })).toBeNull();
    expect(setHitTarget({ weight: 60, reps: 8, prescription: { targetReps: 8 } })).toBeNull();
    expect(setHitTarget({ weight: Number.NaN, reps: 8, prescription: loaded })).toBeNull();
    expect(setHitTarget({ weight: 60, reps: Number.NaN, prescription: loaded })).toBeNull();
    expect(setHitTarget({ weight: '60', reps: 8, prescription: loaded })).toBeNull();
  });
});

describe('skippedKeys: the exercises of a workout that were skipped', () => {
  const done = (name, performed = [], extra = {}) => ({ name, done: true, performed, ...extra });
  const sets = [{ weight: 60, reps: 8, rpe: 'moderate' }];

  it('are those marked done with no set logged', () => {
    expect(skippedKeys([done('Barbell Bench Press'), done('Barbell Row', sets), done('Deadlift')])).toEqual(['barbell-bench-press', 'deadlift']);
  });

  it('are not those with a set logged, nor those not done', () => {
    expect(skippedKeys([done('Barbell Bench Press', sets), { name: 'Deadlift', done: false, performed: [] }, { name: 'Barbell Row' }])).toEqual([]);
  });

  it('do not include a timed hold, which is done without logging a set', () => {
    expect(skippedKeys([done('Plank')])).toEqual([]);
    expect(skippedKeys([done('Plank'), done('Deadlift')])).toEqual(['deadlift']);
  });

  it('count a bodyweight rung as the whole progression, once', () => {
    expect(skippedKeys([done('Wall Push-Up'), done('Push-Up')])).toEqual(['ladder:push']);
  });

  it('are found by the name a program or the AI typed, as the library finds it', () => {
    expect(skippedKeys([done('bench press')])).toEqual(['barbell-bench-press']);
  });

  it('leave out an exercise the library does not know, and anything that is not an exercise', () => {
    expect(skippedKeys([done('Made Up Move'), null, 'x', 5, { done: true }, { name: 7, done: true }])).toEqual([]);
  });

  it('treat a missing list of sets as no sets, and anything but a list of exercises as none', () => {
    expect(skippedKeys([{ name: 'Deadlift', done: true }])).toEqual(['deadlift']);
    [undefined, null, 'x', {}, 5].forEach((x) => expect(skippedKeys(x)).toEqual([]));
  });
});

describe('sessionOutcome', () => {
  const ex = [{ name: 'Deadlift', done: true, performed: [] }, { name: 'Barbell Row', done: true, performed: [{ weight: 100, reps: 8, rpe: 'hard' }] }];

  it('is what an engine workout tells the engine: whether it was cut short, and the exercises skipped', () => {
    expect(sessionOutcome('engine_session', ex, true)).toEqual({ cutShort: true, skipped: ['deadlift'] });
    expect(sessionOutcome('engine_session', ex, false)).toEqual({ cutShort: false, skipped: ['deadlift'] });
    expect(sessionOutcome('engine_session', ex)).toEqual({ cutShort: false, skipped: ['deadlift'] });
  });

  it('is nothing for a workout the engine did not build', () => {
    ['quick', 'ai_plan', 'program', 'custom', undefined, null, '', 'ENGINE_SESSION', 5].forEach((source) => expect(sessionOutcome(source, ex, true)).toBeNull());
  });
});

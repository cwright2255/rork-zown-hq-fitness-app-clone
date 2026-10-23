// The load rules (lib/loadRules.js): what to lift next, from the sets already logged. Every expected number below was worked out by hand
// from the table in LOAD_RULES (the arithmetic is in the comments), not copied from the code's output.
import {
  LOAD_RULES, GOALS, EFFORT_OPTIONS, goalForLoad, levelKey, roundToPlates, weightFromOneRepMax, capStep, stepUp, repRangeFor, isOutlierOneRepMax,
  describeLift, prescribeNext, trustedSets, countLowReadinessDays, effortLegend, prescriptionText,
} from '../lib/loadRules';
import { shiftDateKey } from '../lib/localDate';
import { computeReadiness } from '../lib/readiness';

const TODAY = '2026-10-23';
const day = (offset) => shiftDateKey(TODAY, offset);

// The sets of one session: the same weight for every set, one reps value per set, one rating for all (or one per set).
const sets = (date, weight, reps, rating = 'moderate') => reps.map((r, i) => ({
  weight, reps: r, rpe: Array.isArray(rating) ? rating[i] : rating, date,
}));
const next = (history, options = {}) => prescribeNext(history, { today: TODAY, ...options });

describe('the numbers behind it', () => {
  it('are these, and no others', () => {
    expect(LOAD_RULES.repRanges).toEqual({
      strength: { heavy: { min: 3, max: 5 }, light: { min: 6, max: 8 }, accessory: { min: 6, max: 8 } },
      muscle: { heavy: { min: 6, max: 8 }, light: { min: 10, max: 15 }, accessory: { min: 8, max: 12 } },
      general: { heavy: { min: 8, max: 10 }, light: { min: 12, max: 15 }, accessory: { min: 12, max: 15 } },
    });
    expect(LOAD_RULES.bodyweightRepRanges).toEqual({ strength: { min: 5, max: 8 }, muscle: { min: 8, max: 15 }, general: { min: 10, max: 20 } });
    expect(LOAD_RULES.repsLeft).toEqual({ beginner: 3, intermediate: 2, advanced: 1 });
    expect(LOAD_RULES.ratingRepsLeft).toEqual({ easy: 3, moderate: 2, hard: 1 });
    expect(LOAD_RULES.unratedRepsLeft).toBe(2);
    expect(LOAD_RULES.plateJump).toEqual({ lb: 5, kg: 2.5 });
    expect(LOAD_RULES.stepShare).toEqual({ lower: 0.05, upper: 0.025, isolation: 0.025 });
    expect(LOAD_RULES.maxStepShare).toBe(0.1);
    expect(LOAD_RULES.maxShareOfOneRepMax).toBe(0.9);
    expect(LOAD_RULES.deloadAfterWeeks).toEqual({ beginner: 8, intermediate: 6, advanced: 4 });
    expect(LOAD_RULES.deloadLoadFactor).toBe(0.9);
    expect(LOAD_RULES.deloadSetsFactor).toBe(0.5);
    expect(LOAD_RULES.lighterSessionShare).toBe(0.95);
    expect(LOAD_RULES.belowRangeSessionsForDeload).toBe(2);
    expect(LOAD_RULES.lowReadinessDaysForDeload).toBe(3);
    expect(LOAD_RULES.lowReadinessWindowDays).toBe(7);
    expect(LOAD_RULES.blockGapDays).toBe(10);
    expect(LOAD_RULES.holdAfterGapDays).toBe(21);
    expect(LOAD_RULES.zoneTolerance).toBe(2);
    expect(LOAD_RULES.outlierFactor).toBe(1.5);
    expect(LOAD_RULES.outlierLookbackSessions).toBe(5);
    expect(LOAD_RULES.outlierMinSessions).toBe(3);
  });

  it('keep to the limits the plan sets', () => {
    GOALS.forEach((goal) => {
      const { heavy, light, accessory } = LOAD_RULES.repRanges[goal];
      [heavy, light, accessory].forEach((r) => expect(r.min).toBeLessThan(r.max));
      // A light day is always lighter than a heavy one: it starts above where the heavy range ends.
      expect(light.min).toBeGreaterThan(heavy.max);
      // Muscle growth stays in 6-15 reps, strength below that, general fitness above muscle growth's heavy day.
      if (goal === 'muscle') [heavy, light, accessory].forEach((r) => { expect(r.min).toBeGreaterThanOrEqual(6); expect(r.max).toBeLessThanOrEqual(15); });
      if (goal === 'strength') expect(heavy.max).toBeLessThanOrEqual(6);
    });
    expect(LOAD_RULES.repRanges.general.heavy.min).toBeGreaterThan(LOAD_RULES.repRanges.muscle.heavy.min);
    // Reps left is 0 to 3, and beginners stay three or more short of failure.
    Object.values(LOAD_RULES.repsLeft).forEach((n) => { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(3); });
    expect(LOAD_RULES.repsLeft.beginner).toBeGreaterThanOrEqual(3);
    // Each step is 2.5 to 5% of the load, and no more than 10% in a session.
    Object.values(LOAD_RULES.stepShare).forEach((s) => { expect(s).toBeGreaterThanOrEqual(0.025); expect(s).toBeLessThanOrEqual(0.05); });
    expect(LOAD_RULES.maxStepShare).toBeLessThanOrEqual(0.1);
    // A deload comes every 4 to 8 weeks.
    Object.values(LOAD_RULES.deloadAfterWeeks).forEach((w) => { expect(w).toBeGreaterThanOrEqual(4); expect(w).toBeLessThanOrEqual(8); });
    // Heavy work stays at or below 85-90% of the one-rep max.
    expect(LOAD_RULES.maxShareOfOneRepMax).toBeLessThanOrEqual(0.9);
  });

  it('are frozen', () => {
    expect(Object.isFrozen(LOAD_RULES)).toBe(true);
    expect(Object.isFrozen(LOAD_RULES.repRanges.muscle)).toBe(true);
    expect(Object.isFrozen(EFFORT_OPTIONS)).toBe(true);
  });

  it('give the three effort buttons the reps left the rules read', () => {
    expect(EFFORT_OPTIONS.map((o) => o.rating)).toEqual(['easy', 'moderate', 'hard']);
    expect(EFFORT_OPTIONS.map((o) => o.label)).toEqual(['Easy', 'OK', 'Hard']);
    expect(EFFORT_OPTIONS.map((o) => o.repsLeft)).toEqual(['3+ left', '1-2 left', '0-1 left']);
    EFFORT_OPTIONS.forEach((o) => expect(LOAD_RULES.ratingRepsLeft[o.rating]).toBeGreaterThan(0));
  });
});

describe('the goal and the level', () => {
  it.each([
    [['increase_strength'], 'strength'],
    [['build_muscle'], 'muscle'],
    [['build_muscle', 'increase_strength'], 'strength'],
    [['lose_weight', 'build_muscle'], 'muscle'],
    [['lose_weight', 'stay_active'], 'general'],
    [[], 'general'],
    [undefined, 'general'],
    ['build_muscle', 'general'],
  ])('%j is %s', (ids, goal) => expect(goalForLoad(ids)).toBe(goal));

  it.each([
    ['beginner', 'beginner'], ['intermediate', 'intermediate'], ['advanced', 'advanced'], ['elite', 'advanced'],
    ['Intermediate', 'intermediate'], [' ADVANCED ', 'advanced'], ['', 'beginner'], [undefined, 'beginner'], ['pro', 'beginner'], [3, 'beginner'],
  ])('%j is %s', (level, key) => expect(levelKey(level)).toBe(key));

  it.each([
    ['strength', 'heavy', { min: 3, max: 5 }], ['strength', 'light', { min: 6, max: 8 }], ['strength', null, { min: 6, max: 8 }],
    ['muscle', 'heavy', { min: 6, max: 8 }], ['muscle', 'light', { min: 10, max: 15 }], ['muscle', null, { min: 8, max: 12 }],
    ['general', 'heavy', { min: 8, max: 10 }], ['general', 'light', { min: 12, max: 15 }], ['general', null, { min: 12, max: 15 }],
    ['nonsense', 'heavy', { min: 8, max: 10 }],
  ])('the rep range for %s on a %s day is %j', (goal, dayType, range) => expect(repRangeFor(goal, dayType)).toEqual(range));

  it.each([
    ['strength', { min: 5, max: 8 }], ['muscle', { min: 8, max: 15 }], ['general', { min: 10, max: 20 }], ['nonsense', { min: 10, max: 20 }],
  ])('the bodyweight rep range for %s is %j', (goal, range) => expect(repRangeFor(goal, 'heavy', { bodyweight: true })).toEqual(range));

  it('hands out a copy, so a caller cannot change the table', () => {
    const r = repRangeFor('muscle', 'heavy');
    r.min = 1;
    expect(repRangeFor('muscle', 'heavy').min).toBe(6);
  });
});

describe('plates', () => {
  it.each([
    [100, 'lb', 100], [102, 'lb', 100], [102.5, 'lb', 105], [103, 'lb', 105], [2, 'lb', 5], [0, 'lb', 5],
    [100, 'kg', 100], [101, 'kg', 100], [101.25, 'kg', 102.5], [1, 'kg', 2.5], [47.4, 'kg', 47.5], [100, 'stone', 100],
  ])('%s %s rounds to %s', (weight, unit, expected) => expect(roundToPlates(weight, unit)).toBe(expected));

  // one-rep max / (1 + (reps + reps left) / 30), to the nearest plate jump, never above 90% of the one-rep max.
  it.each([
    // 200 / (1 + 8/30) = 157.89 -> 160
    [200, 6, 2, 'lb', 160],
    // 140 / (1 + 5/30) = 120.0
    [140, 3, 2, 'lb', 120],
    // 200 / (1 + 11/30) = 146.34 -> 145 ; 200 / 1.3333 = 150 ; 200 / (1 + 9/30) = 153.85 -> 155
    [200, 8, 3, 'lb', 145], [200, 8, 2, 'lb', 150], [200, 8, 1, 'lb', 155],
    // 100 / (1 + 4/30) = 88.2 -> 90, which is exactly the 90% cap
    [100, 3, 1, 'lb', 90],
    // one rep with nothing left would be 96.8%: held to the 90% cap
    [100, 1, 0, 'lb', 90],
    // 100 / (1 + 7/30) = 81.08 kg -> 80 (nearest 2.5)
    [100, 5, 2, 'kg', 80],
    // rounding up would pass the cap: 71 / (1 + 4/30) = 62.65 raw is under the cap, 62.65 -> 65 and 65 > 0.9 * 71 = 63.9 -> down to 60
    [71, 3, 1, 'lb', 60],
    // the ceiling is 90% of the one-rep max in whole jumps: 112 / (1 + 2/30) = 105.0, over floor(0.9 * 112 / 5) * 5 = 100
    [112, 2, 0, 'lb', 100],
    // 107 / (1 + 2/30) = 100.3 -> 100, over floor(0.9 * 107 / 5) * 5 = 95
    [107, 2, 0, 'lb', 95],
    // never less than one jump
    [4, 3, 1, 'lb', 5], [4, 3, 1, 'kg', 2.5],
  ])('from a one-rep max of %s, %s reps with %s left (%s) is %s', (oneRepMax, reps, left, unit, expected) => {
    expect(weightFromOneRepMax(oneRepMax, reps, left, unit)).toBe(expected);
  });

  it('has no weight for a one-rep max or rep count that is not a positive number', () => {
    [[0, 5, 2], [-5, 5, 2], [NaN, 5, 2], [undefined, 5, 2], [100, 0, 2], [100, -1, 2], [100, undefined, 2]].forEach(([e, r, l]) => {
      expect(weightFromOneRepMax(e, r, l, 'lb')).toBeNull();
    });
  });

  // lb jump 5, kg jump 2.5. wanted = share of the load, in whole jumps, at least one; cap = 10% of the load in whole jumps, at least one.
  it.each([
    // 2.5% of 100 = 2.5 -> 5 (one jump); cap floor(10/5)*5 = 10
    [100, 'upper', 'lb', 5],
    // 5% of 100 = 5
    [100, 'lower', 'lb', 5],
    // 5% of 200 = 10 ; 5% of 300 = 15 ; 5% of 400 = 20
    [200, 'lower', 'lb', 10], [300, 'lower', 'lb', 15], [400, 'lower', 'lb', 20],
    // 2.5% of 200 = 5 ; of 400 = 10
    [200, 'upper', 'lb', 5], [400, 'upper', 'lb', 10], [400, 'isolation', 'lb', 10],
    // light loads: 2.5% of 30 = 0.75 -> still one 5 lb jump, though that is 16.7% (one plate is the smallest change there is)
    [30, 'upper', 'lb', 5], [45, 'lower', 'lb', 5], [15, 'isolation', 'lb', 5],
    // 5% of 60 = 3 -> one jump (5); cap floor(6/5)*5 = 5
    [60, 'lower', 'lb', 5],
    // kilograms: 5% of 100 = 5 ; 2.5% of 60 = 1.5 -> 2.5 ; 5% of 150 = 7.5
    [100, 'lower', 'kg', 5], [60, 'upper', 'kg', 2.5], [150, 'lower', 'kg', 7.5],
    // an unknown class is treated as isolation (2.5%)
    [400, 'mystery', 'lb', 10],
  ])('a %s %s load goes up %s (%s)', (load, liftClass, unit, expected) => {
    expect(stepUp(load, liftClass, unit)).toBe(expected);
  });

  // wanted step, load, unit -> held to 10% of the load in whole jumps (at least one jump)
  it.each([
    [10, 100, 'lb', 10], [15, 100, 'lb', 10], [100, 100, 'lb', 10], [5, 100, 'lb', 5],
    [20, 60, 'lb', 5], [5, 20, 'lb', 5], [10, 20, 'lb', 5],
    [10, 150, 'lb', 10], [15, 149, 'lb', 10], [15, 150, 'lb', 15],
    [7.5, 75, 'kg', 7.5], [10, 75, 'kg', 7.5], [5, 20, 'kg', 2.5],
  ])('a step of %s on %s %s is held to %s', (wanted, load, unit, expected) => {
    expect(capStep(wanted, load, unit)).toBe(expected);
  });

  it('never steps more than 10% of the load, except where one plate is already more than that', () => {
    ['lb', 'kg'].forEach((unit) => {
      const jump = LOAD_RULES.plateJump[unit];
      ['lower', 'upper', 'isolation'].forEach((cls) => {
        for (let load = jump; load <= 700; load += jump) {
          const step = stepUp(load, cls, unit);
          expect(step).toBeGreaterThanOrEqual(jump);
          expect(Number.isInteger(Math.round(step / jump * 1000) / 1000 / 1)).toBe(true);
          expect(step % jump).toBe(0);
          if (step > jump) expect(step).toBeLessThanOrEqual(load * 0.1 + 1e-9);
        }
      });
    });
  });
});

describe('the outlier test', () => {
  it.each([
    [150, 100, false], [150.01, 100, true], [149.99, 100, false], [1000, 100, true], [90, 100, false], [100, 0, false], [100, undefined, false],
  ])('%s against a recent best of %s is %s', (value, best, expected) => expect(isOutlierOneRepMax(value, best)).toBe(expected));
});

describe('what kind of exercise it is', () => {
  it.each([
    // name, main lift, class, timed hold
    ['Squat', true, 'lower', false], ['Back Squat', true, 'lower', false], ['Deadlift', true, 'lower', false],
    ['Romanian Deadlift', true, 'lower', false], ['Hip Thrust', true, 'lower', false], ['Goblet Squat', true, 'lower', false],
    ['Bench Press', true, 'upper', false], ['Dumbbell Bench Press', true, 'upper', false], ['Overhead Press', true, 'upper', false],
    ['Barbell Row', true, 'upper', false], ['Bent-Over Row', true, 'upper', false],
    // machines, cables, lunges and isolation work have one range
    ['Leg Press', false, 'lower', false], ['Lat Pulldown', false, 'upper', false], ['Face Pull', false, 'upper', false],
    ['Walking Lunge', false, 'lower', false], ['Bicep Curl', false, 'isolation', false], ['Tricep Pushdown', false, 'isolation', false],
    ['Calf Raise', false, 'isolation', false],
    // bodyweight moves use the bodyweight rules, not heavy and light
    ['Push-Up', false, 'upper', false], ['Pull-Up', false, 'upper', false],
    // holds are timed
    ['Plank', false, 'isolation', true], ['Side Plank', false, 'isolation', true],
  ])('%s: main %s, %s, timed %s', (name, main, liftClass, timed) => {
    const lift = describeLift(name);
    expect(lift.main).toBe(main);
    expect(lift.liftClass).toBe(liftClass);
    expect(lift.timed).toBe(timed);
  });

  it('reads the common lifts from the name when the library does not know it', () => {
    const cases = [
      ['Pause Squat', 'squat', true, 'lower'], ['Trap Bar Deadlift Variation', 'hinge', true, 'lower'], ['Spoto Bench', 'horizontal_push', true, 'upper'],
      ['Seal Row', 'horizontal_pull', true, 'upper'], ['Landmine Push Press', 'vertical_push', true, 'upper'], ['Zercher Split Squat', 'lunge', false, 'lower'],
      ['Mystery Machine', null, false, 'isolation'], ['', null, false, 'isolation'], [undefined, null, false, 'isolation'],
    ];
    cases.forEach(([name, pattern, main, liftClass]) => {
      const lift = describeLift(name);
      expect([name, lift.exercise, lift.pattern, lift.main, lift.liftClass]).toEqual([name, null, pattern, main, liftClass]);
    });
  });

  it('reads the ladder an exercise sits on', () => {
    expect(describeLift('Push-Up').ladder).toEqual({ name: 'push', rung: 4 });
    expect(describeLift('Bench Press').ladder).toBeNull();
  });

  it('treats a hold by its name even when the library does not know it', () => {
    expect(describeLift('Wall Sit').timed).toBe(true);
    expect(describeLift('Dead Hang').timed).toBe(true);
    expect(describeLift('Dead Bug').timed).toBe(false);
    // the library knows 'Hollow Body Hold' as the hollow hold, a rung of the plank ladder
    expect(describeLift('Hollow Body Hold').exercise.id).toBe('hollow-hold');
    expect(describeLift('Hollow Body Hold').timed).toBe(true);
  });
});

describe('with nothing to build on', () => {
  it('gives no prescription for an empty or missing history', () => {
    [[], null, undefined, 'abc', 7].forEach((h) => expect(next(h, { exerciseName: 'Bench Press' })).toBeNull());
  });

  it('gives none when every set is today, or unusable', () => {
    expect(next(sets(TODAY, 100, [8, 8, 8]), { exerciseName: 'Tricep Pushdown' })).toBeNull();
    const junk = [
      { weight: 100, reps: 0, date: day(-3) }, { weight: 100, reps: -4, date: day(-3) }, { weight: 100, reps: NaN, date: day(-3) },
      { weight: 100, reps: 101, date: day(-3) }, { weight: -5, reps: 8, date: day(-3) }, { weight: 3000, reps: 8, date: day(-3) },
      { weight: 100, reps: 8 }, { weight: 100, reps: 8, date: 'not a date' }, null, undefined, 'x',
    ];
    expect(next(junk, { exerciseName: 'Tricep Pushdown' })).toBeNull();
  });

  it('gives none for a timed hold, however much is logged', () => {
    expect(next(sets(day(-3), 0, [30, 30, 30]), { exerciseName: 'Plank' })).toBeNull();
    expect(next(sets(day(-3), 0, [45, 45, 45]), { exerciseName: 'Side Plank' })).toBeNull();
    expect(next(sets(day(-3), 0, [60, 60]), { exerciseName: 'Wall Sit' })).toBeNull();
  });
});

describe('an exercise with one rep range (Tricep Pushdown, muscle growth, 8-12 reps, intermediate)', () => {
  const opts = { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate' };
  const last = (weight, reps, rating, date = day(-3)) => sets(date, weight, reps, rating);

  it.each([
    // every set at 12: up one jump (2.5% of 50 = 1.25 -> one 5 lb jump), back to 8
    ['every set reached the top', [12, 12, 12], 'moderate', 55, 8],
    ['every set above the top', [14, 13, 12], 'moderate', 55, 8],
    // 10, 10, 9: the lowest set was 9, so 10
    ['in the middle of the range', [10, 10, 9], 'moderate', 50, 10],
    // easy on one set: up two reps, 9 + 2
    ['one set rated easy', [10, 10, 9], ['moderate', 'easy', 'moderate'], 50, 11],
    // two reps would pass the top: held to 12
    ['easy near the top', [12, 12, 11], ['easy', 'easy', 'easy'], 50, 12],
    // not all at the top: the lowest is 11, so 12
    ['one rep short of the top', [12, 12, 11], 'moderate', 50, 12],
    // hard on any set: the same weight and the lowest reps (9)
    ['one set rated hard', [10, 10, 9], ['moderate', 'hard', 'moderate'], 50, 9],
    // hard beats a full set of top reps
    ['hard with every set at the top', [12, 12, 12], 'hard', 50, 12],
    // below 8: the same weight, back to the bottom of the range
    ['below the range', [7, 7, 6], 'moderate', 50, 8],
    ['barely any reps', [6, 6, 6], 'moderate', 50, 8],
    // holding keeps the target inside the range, whatever was done
    ['hard with reps above the top', [14, 14, 14], 'hard', 50, 12],
    ['hard below the range', [6, 6, 6], 'hard', 50, 8],
  ])('%s: %j rated %j is %s lb for %s reps', (_what, reps, rating, weight, targetReps) => {
    const p = next(last(50, reps, rating), opts);
    expect(p.weight).toBe(weight);
    expect(p.targetReps).toBe(targetReps);
    expect(p.dayType).toBeNull();
    expect(p.repRange).toEqual({ min: 8, max: 12 });
    expect(p.deload).toBe(false);
    expect(p.setsFactor).toBe(1);
    expect(p.moveUpTo).toBeNull();
    expect(p.reason.length).toBeGreaterThan(10);
  });

  it('says what happened, in words', () => {
    expect(next(last(50, [12, 12, 12]), opts).reason).toBe('Every set reached 12 reps - the weight goes up 5 lb.');
    expect(next(last(50, [10, 10, 9]), opts).reason).toBe('Up a rep, working toward 12 before the weight goes up.');
    expect(next(last(50, [10, 10, 9], 'easy'), opts).reason).toBe('Rated easy last time - up 2 reps, working toward 12 before the weight goes up.');
    expect(next(last(50, [10, 10, 9], 'hard'), opts).reason).toBe('Last time was rated hard - the same weight again before adding more.');
    expect(next(last(50, [7, 7, 6]), opts).reason).toBe('Below the rep range last time - the same weight again.');
  });

  it('rounds reps that are not whole numbers', () => {
    const p = next(last(50, [9.6, 9.6, 9.6]), opts);
    expect(p.targetReps).toBe(11);
  });

  it('holds on low readiness, ahead of anything else', () => {
    const p = next(last(50, [12, 12, 12]), { ...opts, readiness: 'low' });
    expect([p.weight, p.targetReps]).toEqual([50, 12]);
    expect(p.reason).toMatch(/low readiness/);
    // high and medium change nothing
    ['high', 'medium', undefined, 'bogus'].forEach((readiness) => {
      expect(next(last(50, [12, 12, 12]), { ...opts, readiness }).weight).toBe(55);
    });
  });

  it('repeats the weight, with no increase, after more than three weeks away', () => {
    // 28 days: the same weight, the same reps (clamped into the range)
    const p = next(last(50, [12, 12, 12], 'moderate', day(-28)), opts);
    expect([p.weight, p.targetReps]).toEqual([50, 12]);
    expect(p.reason).toMatch(/28 days/);
    // exactly three weeks is still a normal progression; the next day is not
    expect(next(last(50, [12, 12, 12], 'moderate', day(-21)), opts).weight).toBe(55);
    expect(next(last(50, [12, 12, 12], 'moderate', day(-22)), opts).weight).toBe(50);
  });

  it('starts from the one-rep max when the last session was done at very different reps', () => {
    // 50 x 20 rated OK: 50 * (1 + 22/30) = 86.67; 8 reps with 2 left: 86.67 / (1 + 10/30) = 65.0
    const p = next(last(50, [20, 20, 20]), opts);
    expect([p.weight, p.targetReps]).toEqual([65, 8]);
    expect(p.estimatedOneRepMax).toBeCloseTo(86.667, 2);
    expect(p.shareOfOneRepMax).toBe(75);
    expect(p.reason).toBe('Set from your estimated 1-rep max of about 87 lb.');
    // 7 and 17 reps are still the same kind of work (within 2 of 8-12 ... 6 to 14), 14 and 15 are not
    expect(next(last(50, [14, 14, 14]), opts).weight).toBe(55);
    expect(next(last(50, [15, 15, 15]), opts).weight).not.toBe(55);
    expect(next(last(50, [6, 6, 6]), opts).weight).toBe(50);
    expect(next(last(50, [5, 5, 5]), opts).weight).not.toBe(50);
  });

  it('works from the weight most of the sets were done at, whatever order they come back in', () => {
    const warm = [{ weight: 30, reps: 12, rpe: 'easy', date: day(-3) }, ...last(50, [10, 10, 9])];
    const a = next(warm, opts);
    const b = next([...warm].reverse(), opts);
    const c = next([warm[2], warm[0], warm[3], warm[1]], opts);
    [a, b, c].forEach((p) => expect([p.weight, p.targetReps]).toEqual([50, 10]));
    // a tie goes to the heavier weight
    const tie = next([...sets(day(-3), 50, [10, 10]), ...sets(day(-3), 55, [10, 10])], opts);
    expect(tie.weight).toBe(55);
  });

  it('builds on the latest session, not an older one', () => {
    const history = [...last(40, [12, 12, 12], 'moderate', day(-10)), ...last(45, [10, 10, 10], 'moderate', day(-6)), ...last(50, [10, 10, 9])];
    expect(next(history, opts).weight).toBe(50);
  });

  it('does not count today\'s sets towards today\'s target', () => {
    const history = [...last(50, [10, 10, 9]), ...sets(TODAY, 80, [12, 12, 12])];
    const p = next(history, opts);
    expect([p.weight, p.targetReps]).toEqual([50, 10]);
  });

  it('reads sets dated as Date objects, ISO strings and Firestore timestamps', () => {
    const when = new Date(2026, 9, 20, 18, 30);
    const forms = [
      when, when.toISOString(), { toDate: () => when }, '2026-10-20',
    ];
    forms.forEach((date) => {
      const p = next([{ weight: 50, reps: 12, rpe: 'moderate', date }, { weight: 50, reps: 12, rpe: 'moderate', date }], opts);
      expect([p.weight, p.targetReps]).toEqual([55, 8]);
    });
  });

  it('treats sets with no rating like the middle button', () => {
    const rated = next(sets(day(-3), 50, [20, 20, 20], 'moderate'), opts);
    const plain = [20, 20, 20].map((reps) => ({ weight: 50, reps, date: day(-3) }));
    const unrated = next(plain, opts);
    const odd = next(sets(day(-3), 50, [20, 20, 20], 'brutal'), opts);
    // easy would raise it, so the unrated sets are really being counted as the middle button and not as something else
    expect(next(sets(day(-3), 50, [20, 20, 20], 'easy'), opts).estimatedOneRepMax).toBeGreaterThan(rated.estimatedOneRepMax);
    expect(unrated.weight).toBe(rated.weight);
    expect(odd.weight).toBe(rated.weight);
    expect(unrated.estimatedOneRepMax).toBeCloseTo(rated.estimatedOneRepMax, 6);
  });

  it('goes by the goal', () => {
    const history = last(50, [10, 10, 10]);
    expect(next(history, { ...opts, goal: 'strength' }).repRange).toEqual({ min: 6, max: 8 });
    expect(next(history, { ...opts, goal: 'general' }).repRange).toEqual({ min: 12, max: 15 });
    expect(next(history, { ...opts, goal: undefined }).repRange).toEqual({ min: 12, max: 15 });
  });

  it('counts kilograms in half-jumps', () => {
    // 60 kg: 2.5% = 1.5 -> one 2.5 kg jump
    expect(next(last(60, [12, 12, 12]), { ...opts, unit: 'kg' }).weight).toBe(62.5);
    expect(next(last(60, [12, 12, 12]), { ...opts, unit: 'lb' }).weight).toBe(65);
    expect(next(last(60, [12, 12, 12]), { ...opts, unit: 'stone' }).weight).toBe(65);
  });
});

describe('a main lift alternates heavy and light days (Bench Press, muscle growth, intermediate)', () => {
  const opts = { exerciseName: 'Bench Press', goal: 'muscle', level: 'intermediate' };

  it.each([
    [1, 'heavy'], [2, 'light'], [3, 'heavy'], [4, 'light'], [5, 'heavy'],
  ])('after %s session(s) the next day is %s', (count, dayType) => {
    const history = [];
    for (let i = 0; i < count; i += 1) history.push(...sets(day(-3 * (count - i)), 130, [8, 8, 8]));
    expect(next(history, opts).dayType).toBe(dayType);
  });

  it('starts the first heavy day from the one-rep max', () => {
    // 150 x 8 rated OK: 150 * (1 + 10/30) = 200. Heavy range 6-8, 6 reps with 2 left: 200 / (1 + 8/30) = 157.89 -> 160 (80% of 200)
    const p = next(sets(day(-3), 150, [8, 8, 8]), opts);
    expect([p.dayType, p.weight, p.targetReps, p.shareOfOneRepMax]).toEqual(['heavy', 160, 6, 80]);
    expect(p.estimatedOneRepMax).toBeCloseTo(200, 6);
    expect(p.repRange).toEqual({ min: 6, max: 8 });
    expect(p.repsLeft).toBe(2);
    expect(p.reason).toBe('Set from your estimated 1-rep max of about 200 lb.');
  });

  it('builds the light day on the light session before it', () => {
    // sessions: 130 x 12 (10 days ago), 150 x 8 (3 days ago). Two sessions logged -> next is light; its chain is the first one.
    // light range 10-15, 12 is inside, so up a rep: 13 at 130
    const history = [...sets(day(-10), 130, [12, 12, 12]), ...sets(day(-3), 150, [8, 8, 8])];
    const p = next(history, opts);
    expect([p.dayType, p.weight, p.targetReps]).toEqual(['light', 130, 13]);
    expect(p.reason).toBe('Up a rep, working toward 15 before the weight goes up.');
  });

  it('builds the heavy day on the heavy session before it, and raises it when every set reached 8', () => {
    // light 130x13, heavy 150x8 (all at the top), light 130x13 -> next is heavy, chain is the heavy 150. 2.5% of 150 = 3.75 -> one 5 lb jump
    const history = [...sets(day(-10), 130, [13, 13, 13]), ...sets(day(-7), 150, [8, 8, 8]), ...sets(day(-3), 130, [13, 13, 13])];
    const p = next(history, opts);
    expect([p.dayType, p.weight, p.targetReps]).toEqual(['heavy', 155, 6]);
    expect(p.reason).toBe('Every set reached 8 reps - the weight goes up 5 lb.');
  });

  it('climbs the reps on a heavy day that stopped short of the top', () => {
    const history = [...sets(day(-10), 130, [13, 13, 13]), ...sets(day(-7), 150, [7, 7, 6]), ...sets(day(-3), 130, [13, 13, 13])];
    const p = next(history, opts);
    expect([p.weight, p.targetReps]).toEqual([150, 7]);
  });

  it('holds a heavy day that was rated hard', () => {
    const history = [...sets(day(-10), 130, [13, 13, 13]), ...sets(day(-7), 150, [8, 8, 8], 'hard'), ...sets(day(-3), 130, [13, 13, 13])];
    const p = next(history, opts);
    expect([p.weight, p.targetReps]).toEqual([150, 8]);
    expect(p.reason).toMatch(/rated hard/);
  });

  it('is lighter on the light day than the heavy day, for the same lifter', () => {
    // the same three sessions, asked on a heavy day and on a light one: the light start (from the one-rep max) is below the heavy start
    const base = [...sets(day(-12), 140, [10, 10, 10]), ...sets(day(-9), 140, [10, 10, 10])];
    const lightDay = next(base, opts);
    const heavyDay = next([...base, ...sets(day(-6), 140, [10, 10, 10])], opts);
    expect(lightDay.dayType).toBe('light');
    expect(heavyDay.dayType).toBe('heavy');
    // heavy: the chain is the first 140 x 10 session; 10 is two above the heavy range 6-8, still the same kind of work, and every set is at or above
    // the top, so the weight goes up one jump (2.5% of 140 = 3.5 -> 5) and the reps go back to 6
    expect(heavyDay.weight).toBe(145);
    expect(heavyDay.targetReps).toBe(6);
    // light: the chain is the first session, 140 x 10 inside 10-15 -> up a rep at 140
    expect([lightDay.weight, lightDay.targetReps]).toEqual([140, 11]);
  });

  it('puts the start weight of a light day below that of a heavy day', () => {
    // 200 x 3 is far from both muscle-growth ranges (6-8 and 10-15), so neither day can build on it and both start from the one-rep max
    const one = sets(day(-3), 200, [3, 3, 3]);
    const heavy = next(one, opts);
    const light = next([...sets(day(-6), 200, [3, 3, 3]), ...one], opts);
    expect(heavy.dayType).toBe('heavy');
    expect(light.dayType).toBe('light');
    expect(light.weight).toBeLessThan(heavy.weight);
  });

  it('uses a lower step on upper body and a bigger one on lower body', () => {
    const bench = [...sets(day(-10), 300, [13, 13, 13]), ...sets(day(-7), 300, [8, 8, 8]), ...sets(day(-3), 300, [13, 13, 13])];
    // 2.5% of 300 = 7.5, which is 1.5 jumps and rounds to 2 jumps: 10 (cap: 10% of 300 = 30)
    expect(next(bench, { ...opts, exerciseName: 'Bench Press' }).weight).toBe(310);
    // 5% of 300 = 15
    expect(next(bench, { ...opts, exerciseName: 'Squat' }).weight).toBe(315);
  });

  it('keeps strength sessions at 3-5 reps and light days at 6-8', () => {
    const squat = { ...opts, goal: 'strength', exerciseName: 'Squat' };
    // light, heavy (all five reps), light -> heavy. 5% of 220 = 11 -> 2 jumps: 10
    const history = [...sets(day(-10), 200, [8, 8, 8]), ...sets(day(-7), 220, [5, 5, 5]), ...sets(day(-3), 200, [8, 8, 8])];
    const heavy = next(history, squat);
    expect([heavy.dayType, heavy.weight, heavy.targetReps, heavy.repRange]).toEqual(['heavy', 230, 3, { min: 3, max: 5 }]);
    // two sessions logged -> light, built on the first (200 x 8 is the top of 6-8): 5% of 200 = 10
    const light = next([...sets(day(-6), 200, [8, 8, 8]), ...sets(day(-3), 220, [5, 5, 5])], squat);
    expect([light.dayType, light.weight, light.targetReps, light.repRange]).toEqual(['light', 210, 6, { min: 6, max: 8 }]);
  });

  it('is gentler for a beginner (3 reps left) than for an advanced lifter (1 left)', () => {
    // 100 x 10 rated OK: 100 * (1 + 12/30) = 140. Heavy general-fitness range 8-10, 8 reps:
    // beginner 140 / (1 + 11/30) = 102.4 -> 100 ; advanced 140 / (1 + 9/30) = 107.7 -> 110. With one session there is no earlier session of
    // the kind to build on, so both start from the one-rep max.
    const history = sets(day(-3), 100, [10, 10, 10]);
    const beginner = next(history, { exerciseName: 'Squat', goal: 'general', level: 'beginner' });
    const advanced = next(history, { exerciseName: 'Squat', goal: 'general', level: 'advanced' });
    expect(beginner.weight).toBe(100);
    expect(advanced.weight).toBe(110);
    expect(beginner.repsLeft).toBe(3);
    expect(advanced.repsLeft).toBe(1);
  });

  it('counts kilograms', () => {
    // 100 kg x 5 rated OK: 100 * (1 + 7/30) = 123.33 ; heavy strength 3 reps, 2 left: 123.33 / (1 + 5/30) = 105.71 -> nearest 2.5 = 105
    const p = next(sets(day(-3), 100, [5, 5, 5]), { exerciseName: 'Deadlift', goal: 'strength', level: 'intermediate', unit: 'kg' });
    expect([p.dayType, p.weight, p.targetReps]).toEqual(['heavy', 105, 3]);
  });

  it('never starts above 90% of the one-rep max', () => {
    // a single heavy double at the 'hard' rating: 200 x 2 hard -> 200 * (1 + 3/30) = 220 ; muscle heavy 6 reps with 1 left (advanced): 220 / (1 + 7/30) = 178.4
    const p = next(sets(day(-3), 200, [2, 2], 'hard'), { exerciseName: 'Squat', goal: 'strength', level: 'advanced' });
    expect(p.weight).toBeLessThanOrEqual(p.estimatedOneRepMax * 0.9);
  });
});

describe('the one-rep max is the lower middle of the last three sessions', () => {
  it('ignores a single great day and a single awful one', () => {
    // sessions of 100 x 10 (e1RM 100 * (1 + 12/30) = 140), then one at 100 x 20 (100 * (1 + 22/30) = 173.3), then 100 x 10 again
    const history = [...sets(day(-12), 100, [10, 10, 10]), ...sets(day(-9), 100, [20, 20, 20]), ...sets(day(-6), 100, [10, 10, 10])];
    const p = next(history, { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate' });
    // the middle of 140, 173.3, 140 is 140
    expect(p.estimatedOneRepMax).toBeCloseTo(140, 6);
    const two = next(history.slice(0, 6), { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate' });
    // two sessions: the lower of 140 and 173.3
    expect(two.estimatedOneRepMax).toBeCloseTo(140, 6);
  });

  it('counts the reps left, so easy sets raise it and hard ones lower it', () => {
    const easy = next(sets(day(-3), 100, [10, 10], 'easy'), { exerciseName: 'Bench Press' });
    const hard = next(sets(day(-3), 100, [10, 10], 'hard'), { exerciseName: 'Bench Press' });
    expect(easy.estimatedOneRepMax).toBeCloseTo(100 * (1 + 13 / 30), 6);
    expect(hard.estimatedOneRepMax).toBeCloseTo(100 * (1 + 11 / 30), 6);
  });
});

describe('deloads', () => {
  const opts = { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate' };
  // Steady training from `start`: a session every 3 or 4 days at 50 for 10, 10, 10.
  const START = '2026-09-11';
  const offsetsUntil = (limit) => {
    const out = [];
    for (let o = 0, i = 0; o < limit; o += i % 2 === 0 ? 4 : 3, i += 1) out.push(o);
    return out;
  };
  const steady = (limit, weight = 50) => offsetsUntil(limit).flatMap((o) => sets(shiftDateKey(START, o), weight, [10, 10, 10]));
  const on = (offset, extra = {}) => ({ today: shiftDateKey(START, offset), ...opts, ...extra });

  it.each([
    ['beginner', 8], ['intermediate', 6], ['advanced', 4],
  ])('a %s gets a lighter week after %s weeks of steady training, and again after the next %s', (level, length) => {
    const l = (n) => prescribeNext(steady(7 * n + 2), { ...opts, level, today: shiftDateKey(START, 7 * n + 2) });
    // the week before the deload week, and the week after, are ordinary
    expect(l(length - 1).deload).toBe(false);
    expect(l(length).deload).toBe(true);
    expect(l(length + 1).deload).toBe(false);
    expect(l(length + 2).deload).toBe(false);
    // the cycle repeats: length + 1 weeks later
    expect(l(2 * length).deload).toBe(false);
    expect(l(2 * length + 1).deload).toBe(true);
  });

  it('is about 10% lighter, at the bottom of the range, with about half the sets', () => {
    // intermediate, week 6: 50 -> 45
    const p = prescribeNext(steady(44), on(44));
    expect([p.deload, p.weight, p.targetReps, p.setsFactor]).toEqual([true, 45, 8, 0.5]);
    expect(p.reason).toMatch(/^Deload \(6 weeks of steady training - a lighter week\): about 10% lighter and about half the usual sets/);
    // 100 -> 90 ; 125 -> 112.5 -> 115 (nearest 5: 22.5 -> 23 * 5)
    expect(prescribeNext(steady(44, 100), on(44)).weight).toBe(90);
    expect(prescribeNext(steady(44, 125), on(44)).weight).toBe(115);
    // never below one plate jump
    expect(prescribeNext(steady(44, 5), on(44)).weight).toBe(5);
    // kilograms: 60 -> 54 -> 55
    expect(prescribeNext(steady(44, 60), on(44, { unit: 'kg' })).weight).toBe(55);
  });

  it('does not come after a gap, because the gap was a rest', () => {
    // sessions to day 14, a 12-day hole, then from day 26 to 41: the block restarts at 26, so day 42 is only in week 2 of it
    const history = [...offsetsUntil(15), ...[26, 30, 33, 37, 40]].flatMap((o) => sets(shiftDateKey(START, o), 50, [10, 10, 10]));
    expect(prescribeNext(history, on(42)).deload).toBe(false);
    // ten days apart is not a gap, eleven is
    const tenApart = [0, 10, 20, 30, 40].flatMap((o) => sets(shiftDateKey(START, o), 50, [10, 10, 10]));
    expect(prescribeNext(tenApart, on(42)).deload).toBe(true);
    const elevenApart = [0, 11, 22, 33, 41].flatMap((o) => sets(shiftDateKey(START, o), 50, [10, 10, 10]));
    expect(prescribeNext(elevenApart, on(42)).deload).toBe(false);
  });

  it('still counts as the same block when the last session was exactly ten days ago, and not eleven', () => {
    // steady to day 32; day 42 is ten days on, day 43 eleven. Both are in week 6.
    expect(prescribeNext(steady(33), on(42)).deload).toBe(true);
    expect(prescribeNext(steady(33), on(43)).deload).toBe(false);
  });

  it('does not come when the last session was more than ten days ago', () => {
    // steady to day 30, nothing since: on day 42 the block is over
    expect(prescribeNext(steady(30), on(42)).deload).toBe(false);
  });

  it('builds on the weight from before the deload week once the deload week is over', () => {
    // normal sessions to day 39 at 50, deload-week sessions on days 43 and 46 at 45, then day 49 (week 7)
    const history = [...steady(40), ...sets(shiftDateKey(START, 43), 45, [10, 10, 10]), ...sets(shiftDateKey(START, 46), 45, [10, 10, 10])];
    const p = prescribeNext(history, on(49));
    expect(p.deload).toBe(false);
    // chain is the last session outside the deload week (50 x 10, 10, 10): up a rep at 50, not at 45
    expect([p.weight, p.targetReps]).toEqual([50, 11]);
  });

  it('comes sooner after two sessions in a row below the bottom of the range', () => {
    // range 8-12: 6s and 7s are below, so the next session is a deload from the last weight (50 -> 45)
    const history = [...sets(day(-7), 50, [10, 10, 10]), ...sets(day(-5), 50, [6, 6, 6]), ...sets(day(-3), 50, [7, 7, 7])];
    const p = next(history, opts);
    expect([p.deload, p.weight, p.targetReps]).toEqual([true, 45, 8]);
    expect(p.reason).toMatch(/two sessions in a row below the rep range/);
    // just one below, then back in range: no deload
    const once = [...sets(day(-7), 50, [10, 10, 10]), ...sets(day(-5), 50, [7, 7, 7]), ...sets(day(-3), 50, [9, 9, 9])];
    expect(next(once, opts).deload).toBe(false);
    // below, in range, below: not in a row
    const split = [...sets(day(-7), 50, [7, 7, 7]), ...sets(day(-5), 50, [9, 9, 9]), ...sets(day(-3), 50, [7, 7, 7])];
    expect(next(split, opts).deload).toBe(false);
    // most sets below counts, one weak last set does not
    const weakLast = [...sets(day(-5), 50, [9, 9, 6]), ...sets(day(-3), 50, [9, 8, 6])];
    expect(next(weakLast, opts).deload).toBe(false);
    const mostly = [...sets(day(-5), 50, [9, 7, 6]), ...sets(day(-3), 50, [9, 7, 6])];
    expect(next(mostly, opts).deload).toBe(true);
  });

  it('checks each session against the range of its own kind on a main lift', () => {
    // Bench Press, muscle growth: heavy 6-8, light 10-15. Sessions in order are light, heavy, light, heavy; 5s on a heavy day and 9s on a
    // light day are both below their ranges, and two in a row means a deload. Chain for the next (light) day is the light 9s: 130 x 9.
    const history = [
      ...sets(day(-12), 130, [12, 12, 12]), ...sets(day(-9), 150, [8, 8, 8]), ...sets(day(-6), 130, [9, 9, 9]), ...sets(day(-3), 150, [5, 5, 5]),
    ];
    const p = next(history, { exerciseName: 'Bench Press', goal: 'muscle', level: 'intermediate' });
    expect([p.deload, p.dayType]).toEqual([true, 'light']);
    // 9s on the light day are below 10, but 7s on the heavy day are inside 6-8: not in a row
    const fine = [
      ...sets(day(-12), 130, [12, 12, 12]), ...sets(day(-9), 150, [8, 8, 8]), ...sets(day(-6), 130, [9, 9, 9]), ...sets(day(-3), 150, [7, 7, 7]),
    ];
    expect(next(fine, { exerciseName: 'Bench Press', goal: 'muscle', level: 'intermediate' }).deload).toBe(false);
  });

  it('comes sooner after three low-readiness days in the last week, not two', () => {
    const history = sets(day(-3), 50, [10, 10, 10]);
    const p = next(history, { ...opts, lowReadinessDays: 3 });
    expect([p.deload, p.weight]).toEqual([true, 45]);
    expect(p.reason).toMatch(/several low-readiness days/);
    expect(next(history, { ...opts, lowReadinessDays: 7 }).deload).toBe(true);
    expect(next(history, { ...opts, lowReadinessDays: 2 }).deload).toBe(false);
    expect(next(history, { ...opts, lowReadinessDays: undefined }).deload).toBe(false);
    expect(next(history, { ...opts, lowReadinessDays: 'lots' }).deload).toBe(false);
  });

  describe('an early deload', () => {
    const run = (offsets, weight) => offsets.flatMap((o) => sets(shiftDateKey(START, o), weight, [10, 10, 10]));
    // 3- and 4-day gaps from `from` up to (not including) `limit`
    const every = (from, limit) => { const out = []; for (let o = from, i = 0; o < limit; o += i % 2 === 0 ? 4 : 3, i += 1) out.push(o); return out; };

    it('starts the count of weeks again, so the scheduled deload does not follow it two weeks later', () => {
      // 50 until day 21, then a session at 45 on day 25 (lighter), and 45 after: the six weeks run from day 25, not from day 0
      const history = [...run([0, 4, 7, 11, 14, 18, 21], 50), ...run(every(25, 42), 45)];
      expect(prescribeNext(history, on(42)).deload).toBe(false);
      // ... and the deload comes six weeks after day 25: week 6 of the new count is days 67-73
      const later = [...run([0, 4, 7, 11, 14, 18, 21], 50), ...run(every(25, 67), 45)];
      expect(prescribeNext(later, on(66)).deload).toBe(false);
      expect(prescribeNext(later, on(67)).deload).toBe(true);
    });

    it('counts a session 5% lighter than the one of its kind before it, and not 4%', () => {
      const lighter = (weight) => [...run([0, 4, 7, 11, 14, 18, 21], 100), ...run(every(25, 42), weight)];
      expect(prescribeNext(lighter(95), on(42)).deload).toBe(false);
      expect(prescribeNext(lighter(96), on(42)).deload).toBe(true);
    });

    it('is found by comparing with the session two back on a main lift, where heavy and light days alternate', () => {
      // Bench Press at 150 on heavy days and 130 on light ones: the light days are 13% lighter than the heavy days, but they are not lighter
      // weeks, so the six weeks still run from the first session and the deload comes on day 42
      const bench = { exerciseName: 'Bench Press', goal: 'muscle', level: 'intermediate' };
      const alternating = every(0, 41).flatMap((o, i) => sets(shiftDateKey(START, o), i % 2 === 0 ? 130 : 150, [10, 10, 10]));
      expect(prescribeNext(alternating, { ...bench, today: shiftDateKey(START, 42) }).deload).toBe(true);
    });

    it('builds back up from the lighter weight, where a scheduled deload goes back to the weight before it', () => {
      const history = [...run([0, 4, 7], 50), ...run([11], 45)];
      const p = next(history, { ...opts, today: shiftDateKey(START, 14) });
      expect([p.deload, p.weight, p.targetReps]).toEqual([false, 45, 11]);
    });

    it('is not taken twice on top of itself', () => {
      // the last session was already a lighter one (45 after 50), so three low-readiness days do not take it down to 40
      const history = [...sets(day(-10), 50, [10, 10, 10]), ...sets(day(-6), 45, [10, 10, 10])];
      const p = next(history, { ...opts, lowReadinessDays: 3 });
      expect(p.deload).toBe(false);
      expect(p.weight).toBe(45);
      // but a session that is not lighter does not stop it
      const level = [...sets(day(-10), 50, [10, 10, 10]), ...sets(day(-6), 48, [10, 10, 10])];
      expect(next(level, { ...opts, lowReadinessDays: 3 }).deload).toBe(true);
    });
  });

  it('deloads from the one-rep max when there is no earlier session of the kind to take the weight from', () => {
    // Bench Press, one session of 150 x 8 rated OK -> start 160 (see above); a deload is 90% of that: 144 -> 145
    const p = next(sets(day(-3), 150, [8, 8, 8]), { exerciseName: 'Bench Press', goal: 'muscle', level: 'intermediate', lowReadinessDays: 4 });
    expect([p.deload, p.weight]).toEqual([true, 145]);
  });
});

describe('the outlier guard', () => {
  const opts = { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate' };
  // Four ordinary sessions at 50 for 10: the recent level is 50 * (1 + 10/30) = 66.7, so anything above 100 is suspect.
  const normal = [
    ...sets(day(-18), 50, [10, 10, 10]), ...sets(day(-14), 50, [10, 10, 10]), ...sets(day(-10), 50, [10, 10, 10]), ...sets(day(-7), 50, [10, 10, 10]),
  ];

  it('ignores one mistyped weight', () => {
    // the last session: 50 x 12, and 500 x 12 by mistake. Tied on count, the heavier would win: without the guard the next weight is 505.
    const slip = [...normal, { weight: 50, reps: 12, rpe: 'moderate', date: day(-3) }, { weight: 500, reps: 12, rpe: 'moderate', date: day(-3) }];
    const p = next(slip, opts);
    // the 50 x 12 alone: 12 is the top, so up one jump to 55, back to 8
    expect([p.weight, p.targetReps]).toEqual([55, 8]);
    expect(p.estimatedOneRepMax).toBeLessThan(100);
  });

  it('ignores a session that is all slips, as though it had not happened', () => {
    const slip = [...normal, ...sets(day(-3), 500, [12, 12, 12])];
    const withoutIt = next(normal, opts);
    const withIt = next(slip, opts);
    expect([withIt.weight, withIt.targetReps]).toEqual([withoutIt.weight, withoutIt.targetReps]);
  });

  it('accepts a real jump that the next session repeats', () => {
    // two sessions at 130 x 12: both are far above the 66.7 level, and each confirms the other
    const jump = [...normal, ...sets(day(-5), 130, [12, 12, 12]), ...sets(day(-2), 130, [12, 12, 12])];
    const p = next(jump, opts);
    // chain is the last session, 130 x 12 at the top of the range: 2.5% of 130 = 3.25 -> 5
    expect([p.weight, p.targetReps]).toEqual([135, 8]);
  });

  it('accepts a jump that is confirmed by the session before it', () => {
    const jump = [...normal, ...sets(day(-5), 130, [12, 12, 12]), ...sets(day(-2), 140, [12, 12, 12])];
    expect(next(jump, opts).weight).toBe(145);
  });

  it('does not accept two unrelated slips', () => {
    // 500 and 130 are far apart (more than 1.5 times), so neither confirms the other
    const slips = [...normal, ...sets(day(-5), 500, [12, 12, 12]), ...sets(day(-2), 130, [12, 12, 12])];
    const p = next(slips, opts);
    // both dropped: built on the last good session, 50 x 10 -> up a rep
    expect([p.weight, p.targetReps]).toEqual([50, 11]);
  });

  it('needs three earlier sessions to have a level to compare with', () => {
    const early = [...sets(day(-10), 50, [10, 10, 10]), ...sets(day(-7), 50, [10, 10, 10]), ...sets(day(-3), 500, [12, 12, 12])];
    expect(next(early, opts).weight).toBeGreaterThan(500);
  });

  it('keeps a set exactly 1.5 times the recent level and drops one just above it', () => {
    // three sessions of 40 x 30 (one-rep max 40 * (1 + 30/30) = 80); 60 x 30 is exactly 120 = 1.5 * 80, 61 x 30 is 122
    const base = [day(-12), day(-9), day(-6)].flatMap((d) => sets(d, 40, [30]));
    expect(trustedSets([...base, ...sets(day(-3), 60, [30])], TODAY)).toHaveLength(4);
    expect(trustedSets([...base, ...sets(day(-3), 61, [30])], TODAY)).toHaveLength(3);
  });

  it('takes the middle of an even number of earlier sessions as the average of the two in the middle', () => {
    // earlier one-rep maxes 60, 60, 100, 100 (reps 30 doubles the weight): the level is 80, so the limit is 120 ; 65 x 30 is 130, over it.
    // (Taking the upper of the two middle values, 100, would put the limit at 150 and keep it.)
    const earlier = [30, 30, 50, 50].flatMap((w, i) => sets(day(-20 + i * 3), w, [30]));
    expect(trustedSets([...earlier, ...sets(day(-3), 65, [30])], TODAY)).toHaveLength(4);
    expect(trustedSets([...earlier, ...sets(day(-3), 59, [30])], TODAY)).toHaveLength(5);
  });

  it('compares with the last five sessions, not the whole history', () => {
    // five old sessions with a one-rep max of 40 (20 x 30 doubles to 40), five recent ones at 100 (50 x 30), then 70 x 30 = 140.
    // Against the last five (level 100, limit 150) 140 is fine; against all ten (level 70, limit 105) it would look like a slip.
    const early = Array.from({ length: 5 }, (_, i) => sets(day(-40 + i * 3), 20, [30])).flat();
    const recent = Array.from({ length: 5 }, (_, i) => sets(day(-20 + i * 3), 50, [30])).flat();
    expect(trustedSets([...early, ...recent, ...sets(day(-3), 70, [30])], TODAY)).toHaveLength(11);
  });

  it('keeps both sessions of a jump that only the next one confirms', () => {
    // 130 x 12 and then 130 x 12 again after four ordinary sessions: the first is confirmed by the one after it, the second by the one before
    const normal = [-18, -14, -10, -7].flatMap((d) => sets(day(d), 50, [10, 10, 10]));
    const jump = [...normal, ...sets(day(-5), 130, [12, 12, 12]), ...sets(day(-2), 130, [12, 12, 12])];
    expect(trustedSets(jump, TODAY)).toHaveLength(18);
  });

  it('gives a clean list of sets for other checks', () => {
    const history = [...normal, { weight: 500, reps: 12, date: day(-3) }, { weight: 50, reps: 12, date: day(-3) }];
    const clean = trustedSets(history, TODAY);
    expect(clean).toHaveLength(13);
    expect(Math.max(...clean.map((s) => s.weight))).toBe(50);
    expect(trustedSets([], TODAY)).toEqual([]);
    expect(trustedSets(undefined, TODAY)).toEqual([]);
  });
});

describe('bodyweight exercises (push-up ladder, general fitness 10-20 reps)', () => {
  const opts = { exerciseName: 'Push-Up', goal: 'general', level: 'beginner' };
  const last = (reps, rating, date = day(-3)) => sets(date, 0, reps, rating);

  it.each([
    ['in the middle', [12, 12, 10], 'moderate', 11],
    ['one rating easy', [12, 12, 10], ['moderate', 'easy', 'moderate'], 12],
    ['near the top', [20, 19, 19], 'moderate', 20],
    ['below the range', [8, 9, 9], 'moderate', 10],
    ['rated hard', [12, 12, 10], 'hard', 10],
    ['hard well inside the range', [14, 14, 14], 'hard', 14],
    ['easy near the top', [19, 19, 19], 'easy', 20],
    ['hard above the top', [25, 24, 22], 'hard', 20],
    ['hard below the range', [6, 7, 8], 'hard', 10],
  ])('%s: %j rated %j is %s reps', (_what, reps, rating, targetReps) => {
    const p = next(last(reps, rating), opts);
    expect(p.weight).toBe(0);
    expect(p.targetReps).toBe(targetReps);
    expect(p.repRange).toEqual({ min: 10, max: 20 });
    expect(p.estimatedOneRepMax).toBeNull();
    expect(p.dayType).toBeNull();
    expect(p.deload).toBe(false);
    expect(p.moveUpTo).toBeNull();
  });

  it('moves up the ladder when every set reaches the top', () => {
    const p = next(last([20, 20, 20]), opts);
    expect(p.moveUpTo).toEqual({ id: 'decline-push-up', name: 'Decline Push-Up' });
    expect(p.targetReps).toBe(20);
    expect(p.weight).toBe(0);
    expect(p.reason).toBe('Every set reached 20 reps - ready for a harder version: Decline Push-Up. Start it at 10 reps.');
    // the pull-up ladder, strength range 5-8
    const pull = next(last([8, 8, 8]), { exerciseName: 'Pull-Up', goal: 'strength' });
    expect(pull.moveUpTo).toEqual({ id: 'archer-pull-up', name: 'Archer Pull-Up' });
    expect(pull.reason).toMatch(/Start it at 5 reps/);
  });

  it('suggests slower reps at the top of a ladder, and for exercises that are on none', () => {
    const top = next(last([20, 20, 20]), { exerciseName: 'Single-Arm Push-Up', goal: 'general' });
    expect(top.moveUpTo).toBeNull();
    expect(top.reason).toMatch(/make each rep harder.*3 seconds.*longer range/);
    const none = next(last([20, 20, 20]), { exerciseName: 'Burpees', goal: 'general', bodyweight: true });
    expect(none.moveUpTo).toBeNull();
    expect(none.reason).toMatch(/make each rep harder/);
  });

  it('does not move up on a hard rating or low readiness', () => {
    expect(next(last([20, 20, 20], 'hard'), opts).moveUpTo).toBeNull();
    const low = next(last([20, 20, 20]), { ...opts, readiness: 'low' });
    expect(low.moveUpTo).toBeNull();
    expect(low.targetReps).toBe(20);
    expect(low.reason).toMatch(/low readiness/);
  });

  it('holds after more than three weeks away', () => {
    const p = next(last([20, 20, 20], 'moderate', day(-30)), opts);
    expect(p.moveUpTo).toBeNull();
    expect(p.reason).toMatch(/30 days/);
  });

  it('is recognised from weights of zero even when the screen does not say so', () => {
    const p = next(last([12, 12, 12]), { exerciseName: 'Mystery Movement', goal: 'general' });
    expect([p.weight, p.targetReps]).toEqual([0, 13]);
  });

  it('counts a weighted set of a bodyweight move as weight, when the screen says it is not bodyweight', () => {
    const p = next(sets(day(-3), 25, [8, 8, 8]), { exerciseName: 'Pull-Up', goal: 'muscle', level: 'intermediate', bodyweight: false });
    expect(p.weight).toBeGreaterThan(0);
  });

  it('gives nothing for a weighted exercise whose sets are all zero when told it is not bodyweight', () => {
    expect(next(last([10, 10]), { exerciseName: 'Tricep Pushdown', bodyweight: false })).toBeNull();
  });
});

describe('low-readiness days', () => {
  const baseline = {};
  for (let i = 1; i <= 28; i += 1) baseline[day(-i)] = { hrv: 50, restingHeartRate: 60, sleepHours: 8 };
  const rough = { hrv: 25, restingHeartRate: 80, sleepHours: 4 };

  it('counts the days in the last week with a readiness below 50', () => {
    const history = { ...baseline, [day(0)]: rough, [day(-2)]: rough, [day(-5)]: rough };
    expect(countLowReadinessDays(history, TODAY)).toBe(3);
  });

  it('counts none for ordinary days', () => {
    expect(countLowReadinessDays(baseline, TODAY)).toBe(0);
  });

  it('looks at today and the six days before it, no further', () => {
    expect(countLowReadinessDays({ ...baseline, [day(-8)]: rough }, TODAY)).toBe(0);
    expect(countLowReadinessDays({ ...baseline, [day(-7)]: rough }, TODAY)).toBe(0);
    expect(countLowReadinessDays({ ...baseline, [day(-6)]: rough }, TODAY)).toBe(1);
    expect(countLowReadinessDays({ ...baseline, [day(0)]: rough }, TODAY)).toBe(1);
  });

  it('counts what the Health screen calls Low: below 50, not 50 itself', () => {
    // HRV 10% under usual scores 50, resting heart rate 5% over scores 50, six hours of sleep scores 50: the average is exactly 50
    const fifty = { hrv: 45, restingHeartRate: 63, sleepHours: 6 };
    const r = computeReadiness({ history: { ...baseline, [day(0)]: fifty }, today: day(0) });
    expect([r.score, r.label]).toEqual([50, 'Moderate']);
    expect(countLowReadinessDays({ ...baseline, [day(0)]: fifty }, TODAY)).toBe(0);
    // one hour less sleep takes it under
    const under = { ...fifty, sleepHours: 5 };
    const u = computeReadiness({ history: { ...baseline, [day(0)]: under }, today: day(0) });
    expect(u.label).toBe('Low');
    expect(countLowReadinessDays({ ...baseline, [day(0)]: under }, TODAY)).toBe(1);
  });

  it('counts nothing when there is not enough to build a score from', () => {
    expect(countLowReadinessDays({}, TODAY)).toBe(0);
    expect(countLowReadinessDays(null, TODAY)).toBe(0);
    expect(countLowReadinessDays(undefined, TODAY)).toBe(0);
    expect(countLowReadinessDays([], TODAY)).toBe(0);
    expect(countLowReadinessDays('x', TODAY)).toBe(0);
    expect(countLowReadinessDays(baseline, 'not a day')).toBe(0);
    // sleep alone is only one of the parts a score needs
    const sleepOnly = {};
    for (let i = 0; i < 7; i += 1) sleepOnly[day(-i)] = { sleepHours: 3 };
    expect(countLowReadinessDays(sleepOnly, TODAY)).toBe(0);
  });
});

describe('the words on the workout screen', () => {
  it('explains the three buttons in one line', () => {
    expect(effortLegend()).toBe('Rate each set by the reps you had left: Easy = 3+ left, OK = 1-2 left, Hard = 0-1 left.');
  });

  const bench = { exerciseName: 'Bench Press', goal: 'muscle', level: 'intermediate' };

  it('shows a heavy day: the target, the kind of day, the range, how hard to push and where it sits against the one-rep max', () => {
    const p = next(sets(day(-3), 150, [8, 8, 8]), bench);
    expect(prescriptionText(p)).toEqual({
      target: "Today's target: 160 lb x 6 reps",
      detail: 'Heavy day · 6-8 reps · stop with about 2 reps left · about 80% of your estimated 1-rep max',
      reason: 'Set from your estimated 1-rep max of about 200 lb.',
    });
  });

  it('shows a light day, and one rep as "rep"', () => {
    const light = next([...sets(day(-10), 130, [12, 12, 12]), ...sets(day(-3), 150, [8, 8, 8])], bench);
    expect(prescriptionText(light).detail).toMatch(/^Light day · 10-15 reps · stop with about 2 reps left/);
    const advanced = next(sets(day(-3), 150, [8, 8, 8]), { ...bench, level: 'advanced' });
    expect(prescriptionText(advanced).detail).toMatch(/stop with about 1 rep left/);
  });

  it('shows an exercise with one range without a kind of day', () => {
    const p = next(sets(day(-3), 50, [10, 10, 9]), { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate' });
    expect(prescriptionText(p)).toEqual({
      target: "Today's target: 50 lb x 10 reps",
      // the one-rep max here is 50 x (1 + (10 + 2) / 30) = 70, and 50 is 71% of it
      detail: '8-12 reps · stop with about 2 reps left · about 71% of your estimated 1-rep max',
      reason: 'Up a rep, working toward 12 before the weight goes up.',
    });
  });

  it('shows a deload as a lighter week with fewer sets, not as a rep goal', () => {
    const p = next(sets(day(-3), 50, [10, 10, 10]), { exerciseName: 'Tricep Pushdown', goal: 'muscle', level: 'intermediate', lowReadinessDays: 3 });
    const t = prescriptionText(p);
    expect(t.target).toBe("Today's target: 45 lb x 8 reps");
    expect(t.detail).toBe('Deload · 8-12 reps · about half the usual sets');
  });

  it('shows bodyweight work in reps only, and the pounds or kilograms it is given', () => {
    const p = next(sets(day(-3), 0, [12, 12, 10]), { exerciseName: 'Push-Up', goal: 'general', bodyweight: true });
    expect(prescriptionText(p, { bodyweight: true })).toEqual({
      target: "Today's target: 11 reps",
      detail: '10-20 reps',
      reason: 'Up a rep, working toward 20 before making it harder.',
    });
    const kg = next(sets(day(-3), 60, [12, 12, 12]), { exerciseName: 'Tricep Pushdown', goal: 'muscle', unit: 'kg' });
    expect(prescriptionText(kg, { unit: 'kg' }).target).toBe("Today's target: 62.5 kg x 8 reps");
  });

  it('shows nothing when there is no prescription', () => {
    expect(prescriptionText(null)).toBeNull();
    expect(prescriptionText(undefined)).toBeNull();
  });
});

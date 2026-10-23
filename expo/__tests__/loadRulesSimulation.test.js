// Twelve simulated weeks for made-up lifters, run through the load rules (lib/loadRules.js) one session at a time, to check that the loads
// and the weekly volume stay inside the limits whatever the lifter does: a beginner who keeps getting stronger, a lifter who stops
// progressing, one who is injured for three weeks, one who keeps missing sessions, one who is tired for a week, and a bodyweight lifter
// climbing a ladder.
//
// The lifter is a small model, not a person. Each session the lifter does what the screen says (the weight and the reps) until the reps run
// out. How many reps are in them is worked out from the Epley formula the app uses for the one-rep max: at a weight w, a lifter whose true
// one-rep max is R can do 30 * (R / w - 1) reps before failing, a little fewer on each later set and a little more or less each day. The
// rating the lifter presses is how many reps were left (3 or more: Easy, 1 or 2: OK, none: Hard). A lifter who cannot finish a set logs the
// reps done; one who cannot do a single rep logs nothing. Nothing is random: the "form" each day comes from a fixed-seed generator.
//
// What is checked, for every lifter:
//   - a weight is always a whole number of plate jumps, above zero, and never more than 92% of the lifter's true one-rep max
//   - the reps asked for are always inside the rep range
//   - the weight goes up by no more than 10% from one session to the next of the same kind (or one plate jump), except where it is set
//     afresh from the one-rep max, and that is never above 90% of the estimate
//   - the sets in a week never rise more than 10% above the busiest of the four weeks before
//   - a deload comes when it should and not when it should not
import { prescribeNext, LOAD_RULES, describeLift } from '../lib/loadRules';
import { shiftDateKey } from '../lib/localDate';

const START = '2026-01-05';
const dayOf = (offset) => shiftDateKey(START, offset);
const SETS_PER_SESSION = 3;

// A small fixed-seed generator (mulberry32), so every run of the suite sees the same twelve weeks.
function generator(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sets done at `weight`, asked for `target` reps, by a lifter whose strength that day is `strength` (a one-rep max, or reps to failure at body weight when `bodyweight`). */
function perform({ weight, target, count, strength, rng, date, bodyweight = false }) {
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const form = 0.97 + 0.06 * rng();
    const toFailure = bodyweight
      ? Math.max(0, strength * form * (1 - 0.04 * k))
      : Math.max(0, 30 * ((strength * form * (1 - 0.03 * k)) / weight - 1));
    const possible = Math.floor(toFailure);
    const reps = Math.min(target, possible);
    if (reps < 1) continue;
    const left = possible - reps;
    out.push({ weight, reps, rpe: left >= 3 ? 'easy' : left >= 1 ? 'moderate' : 'hard', date });
  }
  return out;
}

/**
 * Runs `weeks` weeks. `lifter`: { exerciseName, goal, level, unit, trueOneRepMax(offset) -> number, days(week) -> offsets of the week's sessions,
 * lowReadinessDays(offset) -> number }. Returns one row per session.
 */
function simulate(lifter, weeks = 12) {
  const rng = generator(lifter.seed || 1);
  const unit = lifter.unit || 'lb';
  const history = [];
  // Two sessions already logged before the twelve weeks start, at about 70% of the one-rep max and 8 reps.
  [-7, -3].forEach((offset) => {
    const w = Math.round((lifter.trueOneRepMax(offset) * 0.7) / LOAD_RULES.plateJump[unit]) * LOAD_RULES.plateJump[unit];
    history.push(...perform({ weight: w, target: 8, count: SETS_PER_SESSION, strength: lifter.trueOneRepMax(offset), rng, date: dayOf(offset) }));
  });
  const rows = [];
  for (let week = 0; week < weeks; week += 1) {
    for (const offset of lifter.days(week)) {
      const today = dayOf(offset);
      const rm = lifter.trueOneRepMax(offset);
      const p = prescribeNext(history, {
        exerciseName: lifter.exerciseName, goal: lifter.goal, level: lifter.level, unit, today,
        lowReadinessDays: lifter.lowReadinessDays ? lifter.lowReadinessDays(offset) : 0,
      });
      expect(p).not.toBeNull();
      const count = p.setsFactor < 1 ? Math.ceil(SETS_PER_SESSION * p.setsFactor) : SETS_PER_SESSION;
      const done = perform({ weight: p.weight, target: p.targetReps, count, strength: rm, rng, date: today });
      history.push(...done);
      rows.push({ week, offset, today, rm, p, count, done });
    }
  }
  return rows;
}

const jump = (unit = 'lb') => LOAD_RULES.plateJump[unit];

/** Everything every weighted lifter must satisfy. */
function expectSafe(rows, { unit = 'lb' } = {}) {
  const j = jump(unit);
  const last = {};
  rows.forEach(({ p, rm, today, count, done }) => {
    // the sets: the engine can ask for fewer, never more, and the lifter does them
    expect(p.setsFactor).toBeGreaterThan(0);
    expect(p.setsFactor).toBeLessThanOrEqual(1);
    expect(count).toBe(p.deload ? Math.ceil(SETS_PER_SESSION * LOAD_RULES.deloadSetsFactor) : SETS_PER_SESSION);
    expect(done.length).toBeGreaterThan(0);
    // the weight
    expect(p.weight).toBeGreaterThan(0);
    expect(p.weight % j).toBe(0);
    expect(p.weight).toBeLessThanOrEqual(rm * 0.92);
    // the reps
    expect(p.targetReps).toBeGreaterThanOrEqual(p.repRange.min);
    expect(p.targetReps).toBeLessThanOrEqual(p.repRange.max);
    // the step
    const kind = p.dayType || 'one';
    const fresh = /set from your estimated/.test(p.reason);
    if (fresh) expect(p.weight).toBeLessThanOrEqual(p.estimatedOneRepMax * LOAD_RULES.maxShareOfOneRepMax + 1e-9);
    if (!fresh && !p.deload && last[kind] !== undefined && p.weight > last[kind]) {
      expect(p.weight - last[kind]).toBeLessThanOrEqual(Math.max(j, last[kind] * LOAD_RULES.maxStepShare + 1e-9));
    }
    if (!p.deload) last[kind] = p.weight;
    expect(typeof today).toBe('string');
  });
}

/** Sets per week, from the rows. */
function weeklySets(rows, weeks = 12) {
  const out = Array.from({ length: weeks }, () => 0);
  rows.forEach((r) => { out[r.week] += r.count; });
  return out;
}

/** No week has more than 10% above the busiest of the four before it (once there are four before it). */
function expectVolumeInLimits(rows, weeks = 12) {
  const w = weeklySets(rows, weeks);
  for (let i = 1; i < weeks; i += 1) {
    const before = Math.max(...w.slice(Math.max(0, i - 4), i));
    expect(w[i]).toBeLessThanOrEqual(before * 1.1 + 1e-9);
  }
}

const everyWeek = (offsets) => () => offsets;

describe('a beginner who keeps getting stronger (Squat, general fitness, 3 sessions a week, +1.5% a week)', () => {
  const rows = simulate({
    exerciseName: 'Squat', goal: 'general', level: 'beginner', seed: 11,
    trueOneRepMax: (o) => 180 * (1 + 0.015 * (o / 7)),
    days: (w) => [w * 7, w * 7 + 2, w * 7 + 4],
  });

  it('stays safe', () => expectSafe(rows));
  it('never has a week with more sets than the busiest of the four before it', () => expectVolumeInLimits(rows));
  it('alternates heavy and light days', () => {
    rows.forEach((r, i) => { if (i > 0 && !r.p.deload && !rows[i - 1].p.deload) expect(r.p.dayType).not.toBe(rows[i - 1].p.dayType); });
  });
  it('stays at 3 reps left or more of failure on the one-rep-max starts', () => {
    rows.filter((r) => /set from your estimated/.test(r.p.reason)).forEach((r) => expect(r.p.repsLeft).toBe(3));
  });
  it('carries the load up as the lifter gets stronger', () => {
    const early = Math.max(...rows.slice(0, 6).map((r) => r.p.weight));
    const late = Math.max(...rows.slice(-6).map((r) => r.p.weight));
    expect(late).toBeGreaterThanOrEqual(early * 1.1);
  });
  it('has one deload week in twelve, eight weeks after the count started', () => {
    // The count starts at day 0 here: the first sessions the rules prescribe are more than 5% lighter than the ones the lifter logged before
    // (70% of the one-rep max at 8 reps), and a lighter session starts the count again. Eight weeks on from day 0 is week 8.
    const deloadWeeks = [...new Set(rows.filter((r) => r.p.deload).map((r) => r.week))];
    expect(deloadWeeks).toEqual([8]);
  });
  it('asks for about half the sets in the deload week', () => {
    rows.filter((r) => r.p.deload).forEach((r) => { expect(r.count).toBe(2); expect(r.p.weight).toBeLessThan(Math.max(...rows.slice(0, r.week * 3).map((x) => x.p.weight))); });
  });
});

describe('a lifter who stops progressing (Bench Press, muscle growth, intermediate, 2 sessions a week, one-rep max fixed at 200)', () => {
  const rows = simulate({
    exerciseName: 'Bench Press', goal: 'muscle', level: 'intermediate', seed: 22,
    trueOneRepMax: () => 200,
    days: (w) => [w * 7, w * 7 + 3],
  });

  it('stays safe', () => expectSafe(rows));
  it('never has a week with more sets than the busiest of the four before it', () => expectVolumeInLimits(rows));
  it('does not climb past what the lifter can do: no weight above 90% of the real one-rep max', () => {
    rows.forEach((r) => expect(r.p.weight).toBeLessThanOrEqual(200 * 0.9));
  });
  it('never has three sessions in a row below the bottom of the rep range', () => {
    let run = 0;
    rows.forEach((r) => {
      const reps = r.done.map((s) => s.reps);
      run = reps.length === 0 || Math.min(...reps) < r.p.repRange.min ? run + 1 : 0;
      expect(run).toBeLessThan(3);
    });
  });
  it('has its scheduled deload after six weeks of steady training (week 6 here: the count starts with the sessions logged the week before)', () => {
    const deloadWeeks = [...new Set(rows.filter((r) => r.p.deload).map((r) => r.week))];
    expect(deloadWeeks).toContain(5);
    // every other deload is an early one, and says why
    rows.filter((r) => r.p.deload && r.week !== 5).forEach((r) => expect(r.p.reason).toMatch(/two sessions in a row below the rep range/));
  });
  it('stops adding weight once the lifter has stopped improving', () => {
    const heavy = rows.filter((r) => r.p.dayType === 'heavy' && !r.p.deload).map((r) => r.p.weight);
    // the last quarter of the heavy days is no heavier than the best heavy day so far, plus one plate jump
    const best = Math.max(...heavy.slice(0, -3));
    heavy.slice(-3).forEach((w) => expect(w).toBeLessThanOrEqual(best + jump()));
  });
});

describe('an injured lifter (Deadlift, strength, intermediate, off for weeks 5 to 7)', () => {
  const rows = simulate({
    exerciseName: 'Deadlift', goal: 'strength', level: 'intermediate', seed: 33,
    trueOneRepMax: (o) => 300 * (1 + 0.005 * (o / 7)),
    days: (w) => (w >= 4 && w <= 6 ? [] : [w * 7, w * 7 + 3]),
  });

  it('stays safe', () => expectSafe(rows));
  it('never has a week with more sets than the busiest of the four before it', () => expectVolumeInLimits(rows));
  it('holds the weight on the first sessions back, with no increase', () => {
    const before = rows.filter((r) => r.week < 4);
    const back = rows.filter((r) => r.week === 7);
    expect(back.length).toBe(2);
    const heaviest = Math.max(...before.map((r) => r.p.weight));
    back.forEach((r) => expect(r.p.weight).toBeLessThanOrEqual(heaviest));
    expect(back[0].p.reason).toMatch(/days since your last session|set from your estimated/);
  });
  it('does not deload for it, because the layoff was the rest', () => {
    expect(rows.filter((r) => r.p.deload).length).toBe(0);
  });
});

describe('a lifter who keeps missing sessions (Overhead Press, muscle growth, beginner, every third session skipped and a two-week break)', () => {
  const rows = simulate({
    exerciseName: 'Overhead Press', goal: 'muscle', level: 'beginner', seed: 44,
    trueOneRepMax: (o) => 110 * (1 + 0.01 * (o / 7)),
    days: (w) => {
      if (w === 5 || w === 6) return [];
      const planned = [w * 7, w * 7 + 2, w * 7 + 4];
      return planned.filter((_, i) => (w * 3 + i) % 3 !== 2);
    },
  });

  it('stays safe', () => expectSafe(rows));
  it('never has a week with more sets than the busiest of the four before it', () => expectVolumeInLimits(rows));
  it('never raises the weight on the session after the two-week break', () => {
    const i = rows.findIndex((r) => r.week === 7);
    const before = Math.max(...rows.slice(0, i).map((r) => r.p.weight));
    expect(rows[i].p.weight).toBeLessThanOrEqual(before);
  });
});

describe('a lifter who is tired for a week (Squat, muscle growth, intermediate, 2 sessions a week, three low-readiness days in week 4)', () => {
  const rows = simulate({
    exerciseName: 'Squat', goal: 'muscle', level: 'intermediate', seed: 55,
    trueOneRepMax: (o) => 250 * (1 + 0.01 * (o / 7)),
    days: (w) => [w * 7, w * 7 + 3],
    lowReadinessDays: (o) => (o >= 21 && o < 28 ? 3 : 0),
  });

  it('stays safe', () => expectSafe(rows));
  it('never has a week with more sets than the busiest of the four before it', () => expectVolumeInLimits(rows));
  it('deloads in the tired week, once for each kind of day, and says why', () => {
    const early = rows.filter((r) => r.p.deload && r.offset < 60);
    expect(early.map((r) => r.offset)).toEqual([21, 24]);
    early.forEach((r) => expect(r.p.reason).toMatch(/several low-readiness days/));
  });
  it('starts the count of weeks again from the tired week: the next deload is the scheduled one, six weeks on', () => {
    const later = rows.filter((r) => r.p.deload && r.offset >= 60);
    expect(later.map((r) => r.offset)).toEqual([66, 70]);
    later.forEach((r) => expect(r.p.reason).toMatch(/6 weeks of steady training/));
  });
});

describe('a bodyweight lifter climbing the push-up ladder (general fitness, beginner, 3 sessions a week)', () => {
  // Reps to failure on the current rung start at 14 and grow by one a week; each rung up is a third harder.
  it('moves up one rung at a time, with targets inside the range, and never asks for a weight', () => {
    const rng = generator(66);
    const history = [];
    let name = 'Push-Up';
    let capacityScale = 1;
    const moves = [];
    const targets = [];
    for (let week = 0; week < 12; week += 1) {
      [week * 7, week * 7 + 2, week * 7 + 4].forEach((offset) => {
        const today = dayOf(offset);
        const p = prescribeNext(history.filter((h) => h.name === name), { exerciseName: name, goal: 'general', level: 'beginner', today, bodyweight: true });
        const range = LOAD_RULES.bodyweightRepRanges.general;
        const target = p ? p.targetReps : range.min;
        if (p) {
          expect(p.weight).toBe(0);
          expect(p.targetReps).toBeGreaterThanOrEqual(range.min);
          expect(p.targetReps).toBeLessThanOrEqual(range.max);
        }
        targets.push(target);
        const strength = (14 + offset / 7) * capacityScale;
        const done = perform({ weight: 0, target, count: SETS_PER_SESSION, strength, rng, date: today, bodyweight: true })
          .map((s) => ({ ...s, name }));
        history.push(...done);
        if (p && p.moveUpTo) {
          const here = describeLift(name).ladder.rung;
          const there = describeLift(p.moveUpTo.name).ladder;
          expect(there.name).toBe('push');
          expect(there.rung).toBe(here + 1);
          moves.push(p.moveUpTo.name);
          name = p.moveUpTo.name;
          capacityScale *= 0.7;
        }
      });
    }
    expect(moves.length).toBeGreaterThanOrEqual(1);
    expect(moves[0]).toBe('Decline Push-Up');
    // the first session on a new rung has no history on it, so it falls back to the bottom of the range
    expect(targets.every((t) => t >= LOAD_RULES.bodyweightRepRanges.general.min && t <= LOAD_RULES.bodyweightRepRanges.general.max)).toBe(true);
  });
});

describe('a lifter in kilograms (Deadlift, strength, advanced, 2 sessions a week)', () => {
  const rows = simulate({
    exerciseName: 'Deadlift', goal: 'strength', level: 'advanced', unit: 'kg', seed: 77,
    trueOneRepMax: (o) => 160 * (1 + 0.008 * (o / 7)),
    days: (w) => [w * 7, w * 7 + 3],
  });
  it('stays safe, in 2.5 kg jumps', () => expectSafe(rows, { unit: 'kg' }));
  it('deloads after each four weeks of steady training: weeks 4 and 9 here, counting from the sessions logged the week before', () => {
    const deloadWeeks = [...new Set(rows.filter((r) => r.p.deload).map((r) => r.week))];
    expect(deloadWeeks).toEqual([3, 8]);
  });
});

describe('the lifters are not all one lifter', () => {
  it('end up with different loads for the same lift', () => {
    const a = simulate({ exerciseName: 'Squat', goal: 'general', level: 'beginner', seed: 1, trueOneRepMax: () => 150, days: everyWeek([0, 3]) ? (w) => [w * 7, w * 7 + 3] : null });
    const b = simulate({ exerciseName: 'Squat', goal: 'strength', level: 'advanced', seed: 1, trueOneRepMax: () => 300, days: (w) => [w * 7, w * 7 + 3] });
    expect(a[a.length - 1].p.weight).toBeLessThan(b[b.length - 1].p.weight);
  });
});

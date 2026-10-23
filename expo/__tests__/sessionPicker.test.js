// The session picker (lib/sessionPicker.js). Every expected number below was worked out by hand from the rules at the top of that file and the
// exercise tags in data/exerciseLibrary.js, e.g. a chest with 10 sets this week and 10 the week before may reach 11 (10 x 1.1), so a 2-set press
// (12) does not fit and the answer is "full"; with 8 sets this week a 3-set press (11) fits exactly.
import {
  SESSION_RULES, EQUIPMENT_PRESETS, EQUIPMENT_LABELS, SESSION_DISCLAIMER, weeklyVolume, currentRungs, minutesFromPreference,
  pickSession, attachTargets, sessionToWorkout,
} from '../lib/sessionPicker';
import { LIBRARY, LEVELS, EQUIPMENT, getExercise } from '../lib/exerciseLibrary';
import { MUSCLES } from '../lib/muscleVocabulary';
import { muscleLabel } from '../lib/homeWidgetData';
import { blockedBy } from '../lib/injuryRules';
import { repRangeFor, describeLift } from '../lib/loadRules';
import { calculateXpReward } from '../lib/coachActions';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(NOW.getTime() - days * DAY).toISOString();
const lift = (name, n, rpe = 'hard') => ({ name, sets: n, reps: 8, done: true, performed: Array.from({ length: n }, () => ({ weight: 100, reps: 8, rpe })) });
const workout = (days, exercises) => ({ completedAt: ago(days), exercises });
// Every muscle but those named is only 20% recovered.
const tiredExcept = (...ready) => Object.fromEntries(MUSCLES.filter((m) => !ready.includes(m)).map((m) => [m, 20]));
const ids = (s) => s.exercises.map((x) => x.id);
const lib = (id) => getExercise(id);
const base = { level: 'intermediate', goal: 'muscle', minutes: 45 };
const minutesOf = (x) => (x.sets * (x.workSeconds + x.restSeconds) + SESSION_RULES.transitionSeconds) / 60;
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

describe('the rules', () => {
  it('are these, and no others (the starting values; change them here and in lib/sessionPicker.js together)', () => {
    expect(SESSION_RULES).toEqual({
      readyRecovery: 70,
      weeklySets: { min: 10, max: 20, aim: { beginner: 10, intermediate: 14, advanced: 18 } },
      maxWeeklyRise: 1.1,
      sessionMinSets: 2,
      frequencyBonus: { none: 0.3, once: 0.15 },
      needFloor: 0.1,
      muscleWeight: {
        chest: 1, lats: 1, upper_back: 1, shoulders: 1, quadriceps: 1, hamstrings: 1, glutes: 1,
        biceps: 0.7, triceps: 0.7, core: 0.6, lower_back: 0.5, calves: 0.5, traps: 0.4, adductors: 0.3, abductors: 0.3, forearms: 0.25, neck: 0.2,
      },
      secondaryWeight: 0.25,
      bodyweightShare: 0.8,
      perPatternMax: { default: 1, isolation: 2, core: 2 },
      stapleBonus: 0.1,
      staples: [
        'barbell-bench-press', 'dumbbell-bench-press', 'barbell-overhead-press', 'seated-dumbbell-shoulder-press',
        'barbell-row', 'seated-cable-row', 'pull-up', 'lat-pulldown',
        'barbell-back-squat', 'goblet-squat', 'leg-press', 'deadlift', 'trap-bar-deadlift', 'romanian-deadlift', 'dumbbell-romanian-deadlift', 'dumbbell-lunge',
        'dumbbell-curl', 'triceps-pushdown', 'dumbbell-lateral-raise', 'lying-leg-curl', 'leg-extension', 'standing-calf-raise', 'plank', 'cable-crunch',
      ],
      goalBonus: { strength: { compound: 0.5, other: 0 }, muscle: { compound: 0.25, other: 0.1 }, general: { compound: 0.25, other: 0 } },
      setsPerExercise: { compound: { beginner: 3, intermediate: 3, advanced: 4 }, other: { beginner: 2, intermediate: 3, advanced: 3 } },
      minSets: 2,
      restSeconds: { compound: { strength: 180, muscle: 120, general: 90 }, other: { strength: 90, muscle: 60, general: 45 } },
      workSecondsPerSet: 45,
      holdSeconds: { beginner: 30, intermediate: 40, advanced: 45 },
      transitionSeconds: 60,
      maxExercises: 8,
      perMuscleMax: 2,
      defaultMinutes: 30,
      minutesRange: { min: 10, max: 120 },
      minutesOptions: [15, 30, 45, 60],
    });
  });

  it('are fixed, so nothing can change them from outside', () => {
    const frozen = (o) => { expect(Object.isFrozen(o)).toBe(true); Object.values(o).forEach((v) => { if (v && typeof v === 'object') frozen(v); }); };
    frozen(SESSION_RULES);
    frozen(EQUIPMENT_PRESETS);
    expect(Object.isFrozen(EQUIPMENT_LABELS)).toBe(true);
  });

  it('keep the weekly sets between 10 and 20, with the aim rising with the level', () => {
    const { min, max, aim } = SESSION_RULES.weeklySets;
    expect([min, max]).toEqual([10, 20]);
    expect(aim).toEqual({ beginner: 10, intermediate: 14, advanced: 18 });
    Object.values(aim).forEach((a) => { expect(a).toBeGreaterThanOrEqual(min); expect(a).toBeLessThanOrEqual(max); });
    expect(SESSION_RULES.maxWeeklyRise).toBe(1.1);
  });

  it('weigh every muscle there is, the big ones most', () => {
    const w = SESSION_RULES.muscleWeight;
    expect(Object.keys(w).sort()).toEqual([...MUSCLES].sort());
    Object.values(w).forEach((v) => { expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(1); });
    ['chest', 'lats', 'upper_back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes'].forEach((m) => expect(w[m]).toBe(1));
    expect(w.neck).toBeLessThan(w.forearms + 1e-9);
    expect(w.forearms).toBeLessThan(w.core);
    expect(SESSION_RULES.secondaryWeight).toBeLessThan(1);
  });

  it('name staples that are in the library, each once', () => {
    const ok = new Set(LIBRARY.map((e) => e.id));
    SESSION_RULES.staples.forEach((id) => expect(ok.has(id)).toBe(true));
    expect(new Set(SESSION_RULES.staples).size).toBe(SESSION_RULES.staples.length);
  });

  it('offer times that fit the allowed range, and equipment the library knows', () => {
    const { minutesOptions, minutesRange, defaultMinutes } = SESSION_RULES;
    expect(minutesOptions).toEqual([15, 30, 45, 60]);
    minutesOptions.forEach((m) => { expect(m).toBeGreaterThanOrEqual(minutesRange.min); expect(m).toBeLessThanOrEqual(minutesRange.max); });
    expect(minutesOptions).toContain(defaultMinutes);
    expect(Object.keys(EQUIPMENT_PRESETS).sort()).toEqual(['bodyweight', 'dumbbells', 'gym']);
    expect(Object.keys(EQUIPMENT_LABELS).sort()).toEqual(['bodyweight', 'dumbbells', 'gym']);
    expect(EQUIPMENT_PRESETS.gym).toEqual(EQUIPMENT);
    expect(EQUIPMENT_PRESETS.dumbbells).toEqual(['dumbbell', 'bench']);
    expect(EQUIPMENT_PRESETS.bodyweight).toEqual([]);
  });

  it('say, in the disclaimer, that this is not clinically validated and not medical advice', () => {
    expect(SESSION_DISCLAIMER).toMatch(/not clinically validated/i);
    expect(SESSION_DISCLAIMER).toMatch(/not medical advice/i);
  });
});

describe('weeklyVolume', () => {
  const workouts = [
    workout(1, [lift('Barbell Bench Press', 4)]), // chest 4, shoulders 2, triceps 2
    workout(3, [lift('Barbell Bench Press', 3), lift('Dumbbell Curl', 3)]), // chest 3, shoulders 1.5, triceps 1.5, biceps 3, forearms 1.5
    workout(9, [lift('Barbell Bench Press', 5)]), // the week before: chest 5, shoulders 2.5, triceps 2.5
    workout(20, [lift('Barbell Bench Press', 9)]), // too old
    { completedAt: new Date(NOW.getTime() + 2 * 3600000).toISOString(), exercises: [lift('Barbell Bench Press', 9)] }, // in the future
    { exercises: [lift('Barbell Bench Press', 9)] }, // no date
  ];

  it('adds the effective sets of the last 7 days, the 7 days before, and the workouts that gave a muscle at least 2 sets', () => {
    const v = weeklyVolume({ workouts, now: NOW });
    expect(v.thisWeek).toEqual({ chest: 7, shoulders: 3.5, triceps: 3.5, biceps: 3, forearms: 1.5 });
    expect(v.lastWeek).toEqual({ chest: 5, shoulders: 2.5, triceps: 2.5 });
    // shoulders and triceps: 2 effective sets in the first workout, 1.5 in the second; forearms never reached 2 in one workout
    expect(v.sessions).toEqual({ chest: 2, shoulders: 1, triceps: 1, biceps: 1 });
  });

  it('counts exactly 7 days ago as last week and a moment less as this week, and drops 14 days', () => {
    const at = (days) => weeklyVolume({ workouts: [workout(days, [lift('Barbell Bench Press', 2)])], now: NOW });
    expect(at(6.99).thisWeek.chest).toBe(2);
    expect(at(6.99).lastWeek.chest).toBeUndefined();
    expect(at(7).thisWeek.chest).toBeUndefined();
    expect(at(7).lastWeek.chest).toBe(2);
    expect(at(13.99).lastWeek.chest).toBe(2);
    expect(at(14)).toEqual({ thisWeek: {}, lastWeek: {}, sessions: {} });
  });

  it('weighs each set by how hard it was', () => {
    const v = weeklyVolume({ workouts: [workout(1, [lift('Barbell Bench Press', 2, 'hard'), lift('Dumbbell Curl', 2, 'moderate'), lift('Triceps Pushdown', 5, 'easy')])], now: NOW });
    expect(v.thisWeek.chest).toBeCloseTo(2, 9);
    expect(v.thisWeek.biceps).toBeCloseTo(1.2, 9);
    expect(v.thisWeek.triceps).toBeCloseTo(1 + 5 * 0.3, 9); // 2 hard bench sets help it for 1, 5 easy pushdowns
  });

  it('answers nothing for no workouts, bad ones, and no arguments', () => {
    const empty = { thisWeek: {}, lastWeek: {}, sessions: {} };
    expect(weeklyVolume()).toEqual(empty);
    expect(weeklyVolume({})).toEqual(empty);
    expect(weeklyVolume({ workouts: null, now: NOW })).toEqual(empty);
    expect(weeklyVolume({ workouts: [null, 7, 'x', {}, { completedAt: 'nonsense' }], now: NOW })).toEqual(empty);
  });

  it('uses the clock when it is not given a valid time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    try {
      const one = [workout(1, [lift('Barbell Bench Press', 4)])];
      expect(weeklyVolume({ workouts: one }).thisWeek.chest).toBe(4);
      expect(weeklyVolume({ workouts: one, now: 'yesterday' }).thisWeek.chest).toBe(4);
      expect(weeklyVolume({ workouts: one, now: new Date('nope') }).thisWeek.chest).toBe(4);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not change what it is given', () => {
    const input = deepFreeze(JSON.parse(JSON.stringify(workouts)));
    expect(() => weeklyVolume({ workouts: input, now: NOW })).not.toThrow();
  });
});

describe('currentRungs', () => {
  it('is the rung of each ladder the person did most recently', () => {
    const w = [
      workout(10, [lift('Wall Push-Up', 3), lift('Bodyweight Squat', 3)]),
      workout(2, [lift('Push-Up', 3), lift('Barbell Bench Press', 3), lift('Not An Exercise', 3)]),
    ];
    expect(currentRungs(w)).toEqual({ push: 4, squat: 2 });
    expect(currentRungs([...w].reverse())).toEqual({ push: 4, squat: 2 }); // the order of the list does not matter
  });

  it('skips an exercise marked not done with nothing logged, and counts one with sets logged', () => {
    const w = [
      workout(10, [lift('Wall Push-Up', 3)]),
      workout(2, [{ name: 'Push-Up', sets: 3, done: false }]),
    ];
    expect(currentRungs(w)).toEqual({ push: 1 });
    w[1].exercises[0].performed = [{ weight: 0, reps: 5, rpe: 'hard' }];
    expect(currentRungs(w)).toEqual({ push: 4 });
    w[1].exercises[0].performed = [];
    expect(currentRungs(w)).toEqual({ push: 1 });
  });

  it('ignores workouts with no date and bad input', () => {
    expect(currentRungs([{ exercises: [lift('Push-Up', 3)] }])).toEqual({});
    expect(currentRungs([null, 4, { completedAt: ago(1), exercises: [null, 5, { name: 7 }, { name: 'Push-Up' }] }])).toEqual({ push: 4 });
    expect(currentRungs()).toEqual({});
    expect(currentRungs('x')).toEqual({});
    expect(currentRungs([{ completedAt: ago(1) }])).toEqual({});
  });
});

describe('minutesFromPreference', () => {
  it('reads the profile times that the screen offers', () => {
    expect(minutesFromPreference('15min')).toBe(15);
    expect(minutesFromPreference('30min')).toBe(30);
    expect(minutesFromPreference('45min')).toBe(45);
    expect(minutesFromPreference('60min+')).toBe(60);
  });

  it('falls back to 30 for anything else', () => {
    ['20min', '90min', '5min', '', 'quick', null, undefined, 45, {}].forEach((v) => expect(minutesFromPreference(v)).toBe(30));
  });
});

describe('the scenarios from the plan', () => {
  it('fresh chest: with only the chest rested, it is a chest session that starts with a press', () => {
    const s = pickSession({ ...base, recovery: tiredExcept('chest') });
    expect(s.status).toBe('ok');
    expect(s.name).toBe('Chest');
    expect(s.exercises).toHaveLength(2); // two exercises may mainly work one muscle
    s.exercises.forEach((x) => expect(x.primary).toEqual(['chest']));
    // The dumbbell and barbell bench press are worth the same (both classics); the dumbbell one needs less equipment, so it wins the tie.
    expect(s.exercises[0].id).toBe('dumbbell-bench-press');
    expect(s.exercises[0].sets).toBe(3);
    expect(s.exercises[0].reason).toBe('Chest: fully rested, no sets logged this week (aim 14).');
    expect(s.exercises.filter((x) => lib(x.id).pattern === 'horizontal_push')).toHaveLength(1);
    expect(s.leftOutFor).toEqual([]);
  });

  it('sore legs: no pick mainly works a leg muscle, and the upper body is trained instead', () => {
    const legs = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];
    const s = pickSession({ ...base, recovery: Object.fromEntries(legs.map((m) => [m, 40])) });
    expect(s.status).toBe('ok');
    expect(s.exercises.length).toBeGreaterThanOrEqual(4);
    s.exercises.forEach((x) => legs.forEach((m) => expect(x.primary).not.toContain(m)));
    expect(ids(s)).not.toContain('deadlift');
    expect(ids(s)).not.toContain('barbell-back-squat');
    expect(s.exercises.some((x) => x.primary.includes('chest'))).toBe(true);
    expect(s.exercises.some((x) => x.primary.includes('upper_back') || x.primary.includes('lats'))).toBe(true);
  });

  it('protected shoulder: nothing that loads the shoulder is picked, the person is told it was left out, and legs are still trained', () => {
    const s = pickSession({ ...base, injuries: ['shoulder'] });
    expect(s.status).toBe('ok');
    expect(s.leftOutFor).toEqual(['shoulder']);
    s.exercises.forEach((x) => expect(blockedBy(lib(x.id), ['shoulder'])).toEqual([]));
    s.exercises.forEach((x) => { expect(x.primary).not.toContain('shoulders'); expect(x.secondary).not.toContain('shoulders'); });
    expect(s.exercises.some((x) => x.primary.includes('quadriceps') || x.primary.includes('glutes'))).toBe(true);
  });

  it('several injuries: all are left out, and the list says which ones took something out', () => {
    const s = pickSession({ ...base, minutes: 60, injuries: ['shoulder', 'knee', 'made_up'] });
    expect(s.status).toBe('ok');
    expect([...s.leftOutFor].sort()).toEqual(['knee', 'shoulder']);
    s.exercises.forEach((x) => expect(blockedBy(lib(x.id), ['shoulder', 'knee'])).toEqual([]));
  });

  it('no injury leaves nothing out', () => {
    expect(pickSession({ ...base }).leftOutFor).toEqual([]);
    expect(pickSession({ ...base, injuries: [] }).leftOutFor).toEqual([]);
  });
});

describe('who is ready', () => {
  it('needs a main muscle to be at least 70% recovered: 70 is ready, 69 is not', () => {
    expect(pickSession({ ...base, recovery: { ...tiredExcept('chest'), chest: 70 } }).status).toBe('ok');
    const s = pickSession({ ...base, recovery: { ...tiredExcept('chest'), chest: 69 } });
    expect(s.status).toBe('rest');
    expect(s.message).toMatch(/recovering/);
  });

  it('treats a muscle that is not in the recovery answer as fully recovered, and reads bad values as no information', () => {
    const rested = pickSession({ ...base, recovery: {} });
    expect(rested.status).toBe('ok');
    expect(pickSession({ ...base, recovery: { chest: NaN, lats: 'x', glutes: null } })).toEqual(rested);
    expect(pickSession({ ...base, recovery: { ...tiredExcept('chest'), chest: 250 } }).exercises[0].reason).toBe('Chest: fully rested, no sets logged this week (aim 14).');
    expect(pickSession({ ...base, recovery: { ...tiredExcept('chest'), chest: -5 } }).status).toBe('rest');
  });

  it('does not count a recovery above 100 as more than fully rested', () => {
    const at = (chest) => pickSession({ ...base, recovery: { ...tiredExcept('chest', 'lats'), chest, lats: 100 } });
    expect(at(250)).toEqual(at(100));
    // (equal worth: the lat pulldown needs less equipment and goes first; if the chest were worth 2.5 times as much it would go first)
    expect(at(250).exercises[0].id).toBe('lat-pulldown');
  });

  it('is a rest day when every muscle is still recovering', () => {
    const s = pickSession({ ...base, recovery: tiredExcept() });
    expect(s).toEqual({
      status: 'rest', message: expect.stringMatching(/rest day/i), name: 'Session', goal: 'muscle', level: 'intermediate', minutes: 0, totalSets: 0, exercises: [], leftOutFor: [],
    });
  });

  it('prefers the muscle that is more rested, all else equal', () => {
    const a = pickSession({ ...base, recovery: { ...tiredExcept('chest', 'lats'), chest: 75, lats: 100 } });
    expect(a.exercises[0].primary).toContain('lats');
    const b = pickSession({ ...base, recovery: { ...tiredExcept('chest', 'lats'), chest: 100, lats: 75 } });
    expect(b.exercises[0].primary).toContain('chest');
  });
});

describe('what is missing this week', () => {
  const two = { ...base, recovery: tiredExcept('chest', 'lats') };

  it('goes first to the muscle that is further from its weekly aim', () => {
    const lowLats = pickSession({ ...two, volume: { thisWeek: { chest: 12 }, lastWeek: { chest: 14 }, sessions: { chest: 2, lats: 2 } } });
    expect(lowLats.exercises[0].primary).toContain('lats');
    const lowChest = pickSession({ ...two, volume: { thisWeek: { lats: 12 }, lastWeek: { lats: 14 }, sessions: { chest: 2, lats: 2 } } });
    expect(lowChest.exercises[0].primary).toContain('chest');
  });

  it('goes first to a muscle that has not been trained this week, when the sets are the same', () => {
    const w = { thisWeek: { chest: 6, lats: 6 }, lastWeek: {} };
    const chestTrained = pickSession({ ...two, volume: { ...w, sessions: { chest: 2, lats: 0 } } });
    expect(chestTrained.exercises[0].primary).toContain('lats');
    const latsTrained = pickSession({ ...two, volume: { ...w, sessions: { chest: 0, lats: 2 } } });
    expect(latsTrained.exercises[0].primary).toContain('chest');
    const once = pickSession({ ...two, volume: { ...w, sessions: { chest: 1, lats: 2 } } });
    expect(once.exercises[0].primary).toContain('chest');
    const onceOther = pickSession({ ...two, volume: { ...w, sessions: { chest: 2, lats: 1 } } });
    expect(onceOther.exercises[0].primary).toContain('lats');
  });

  it('prefers a muscle with no session this week to one with a single session, when the sets are the same (0.3 against 0.15)', () => {
    const v = (chest, lats) => ({ thisWeek: { chest: 6, lats: 6 }, lastWeek: {}, sessions: { chest, lats } });
    expect(pickSession({ ...two, volume: v(0, 1) }).exercises[0].primary).toContain('chest');
    expect(pickSession({ ...two, volume: v(1, 0) }).exercises[0].primary).toContain('lats');
  });

  it('still builds a session when every aim has been met, and then goes by how rested each muscle is (the floor of 0.1)', () => {
    const met = { thisWeek: { chest: 14, lats: 14 }, lastWeek: { chest: 14, lats: 14 }, sessions: { chest: 2, lats: 2 } };
    // With nothing left to make up, the rested chest comes before the lats at 75%; with the floor missing the two would tie and the lat pulldown,
    // which needs less equipment, would come first.
    const chestFirst = pickSession({ ...two, recovery: { ...two.recovery, chest: 100, lats: 75 }, volume: met });
    expect(chestFirst.exercises.map((x) => x.id)).toEqual(['dumbbell-bench-press', 'lat-pulldown']);
    const latsFirst = pickSession({ ...two, recovery: { ...two.recovery, chest: 75, lats: 100 }, volume: met });
    expect(latsFirst.exercises.map((x) => x.id)).toEqual(['lat-pulldown', 'dumbbell-bench-press']);
    expect(chestFirst.exercises.map((x) => x.sets)).toEqual([2, 2]);
  });

  it('counts the sets the session has already given a muscle: after a press and a dip the triceps are worth less than the chest was', () => {
    // Chest 8 sets this week, triceps 4, both 14-set aims. After the bench press (chest 3, triceps 1.5 as a helper) and the bench dip (triceps 3,
    // chest 1.5) the chest still needs 1 - 12.5/14 = 0.11 (the floor, 0.1, would be lower) and the triceps 1 - 8.5/14 = 0.39: the pushdown (0.39 x 0.7
    // x 1.1 x 1.1 = 0.33) comes before the pullover (0.11 + helpers, about 0.27). If the session's own sets were not counted the chest would still need
    // 0.43 and the pullover would come first.
    const s = pickSession({
      ...base, recovery: tiredExcept('chest', 'triceps'), volume: { thisWeek: { chest: 8, triceps: 4 }, lastWeek: { chest: 14, triceps: 14 }, sessions: {} },
    });
    expect(ids(s)).toEqual(['dumbbell-bench-press', 'bench-dip', 'triceps-pushdown', 'dumbbell-pullover']);
  });

  it('gives up the "not trained this week" bonus once the session has trained the muscle', () => {
    // The lats have had no session this week (+0.3) and the chest two (+0), so the pulldown comes first. Once it is in, the lats are no longer
    // "untrained" and the pullover (chest) goes before the straight-arm pulldown (lats); if the bonus were kept, the pulldown would go first.
    const s = pickSession({ ...two, volume: { thisWeek: {}, lastWeek: { chest: 14, lats: 14 }, sessions: { chest: 2 } } });
    expect(ids(s)).toEqual(['lat-pulldown', 'dumbbell-bench-press', 'dumbbell-pullover', 'straight-arm-pulldown']);
  });

  it('writes the reason from the weighted need, not the raw one: a deadlift is picked for the glutes before the lower back', () => {
    // Glutes and hamstrings 6 sets short... 14 - 6 = 8 and 8; lower back 14 - 4 = 10 short, but the lower back counts half (weight 0.5): 0.71 x 0.5 = 0.36
    // against 0.57, so the reason names the glutes (the first of two equal).
    const s = pickSession({
      ...base, recovery: tiredExcept('glutes', 'hamstrings', 'lower_back'),
      volume: { thisWeek: { glutes: 6, hamstrings: 6, lower_back: 4 }, lastWeek: { glutes: 14, hamstrings: 14, lower_back: 14 }, sessions: { glutes: 2, hamstrings: 2, lower_back: 2 } },
    });
    expect(s.exercises[0].id).toBe('deadlift');
    expect(s.exercises[0].reason).toBe("Glutes: fully rested, 8 sets short of this week's 14-set aim.");
  });

  it('still builds a session when every aim has been met, because a rested muscle is always worth a little', () => {
    const met = { thisWeek: { chest: 14 }, lastWeek: { chest: 14 }, sessions: { chest: 2 } };
    const s = pickSession({ ...base, recovery: tiredExcept('chest'), volume: met });
    expect(s.status).toBe('ok');
    expect(s.exercises[0].reason).toBe("Chest: fully rested, at this week's 14-set aim, a top-up.");
  });

  it('writes the reason from the figures: how rested, and how many sets short', () => {
    const v = (chest) => ({ thisWeek: { chest }, lastWeek: { chest: 14 }, sessions: {} });
    const at = (chest, rested = 100) => pickSession({ ...base, recovery: { ...tiredExcept('chest'), chest: rested }, volume: v(chest) }).exercises[0].reason;
    expect(at(8, 92)).toBe("Chest: about 92% recovered, 6 sets short of this week's 14-set aim.");
    expect(at(8, 99)).toBe("Chest: about 99% recovered, 6 sets short of this week's 14-set aim.");
    expect(at(13)).toBe("Chest: fully rested, 1 set short of this week's 14-set aim.");
    expect(at(14)).toBe("Chest: fully rested, at this week's 14-set aim, a top-up.");
    expect(at(0)).toBe('Chest: fully rested, no sets logged this week (aim 14).');
  });

  it('counts the sets already picked in the reason of the next exercise, a helper muscle for half', () => {
    // Deadlift (3 sets) works the quadriceps as a helper: 1.5 sets. The squat is then 14 - 0 - 1.5 = 12.5 short, which rounds to 13.
    const s = pickSession({ ...base, minutes: 60 });
    const squat = s.exercises.find((x) => x.id === 'barbell-back-squat');
    expect(ids(s)).toContain('deadlift');
    expect(squat.reason).toBe("Quadriceps: fully rested, 13 sets short of this week's 14-set aim.");
    expect(s.exercises[0].reason).toBe('Glutes: fully rested, no sets logged this week (aim 14).');
  });

  it('aims for 10 sets a week for a beginner and 18 for an advanced lifter', () => {
    expect(pickSession({ ...base, level: 'beginner', recovery: tiredExcept('chest') }).exercises[0].reason).toMatch(/\(aim 10\)\.$/);
    expect(pickSession({ ...base, level: 'advanced', recovery: tiredExcept('chest') }).exercises[0].reason).toMatch(/\(aim 18\)\.$/);
  });
});

describe('the figures behind each reason, and the tired muscles', () => {
  const chestAt = (chest, rested = 100) => pickSession({
    ...base, recovery: { ...tiredExcept('chest'), chest: rested }, volume: { thisWeek: { chest }, lastWeek: { chest: 14 }, sessions: {} },
  });

  it('keeps on every pick the muscle, how recovered it is, the sets done, the sets short and the aim that its reason was written from', () => {
    expect(chestAt(8, 92).exercises[0].facts).toEqual({ muscle: 'chest', recovered: 92, done: 8, short: 6, aim: 14 });
    expect(chestAt(8, 92).exercises[0].reason).toBe("Chest: about 92% recovered, 6 sets short of this week's 14-set aim.");
    expect(chestAt(0).exercises[0].facts).toEqual({ muscle: 'chest', recovered: 100, done: 0, short: 14, aim: 14 });
    expect(chestAt(14).exercises[0].facts).toEqual({ muscle: 'chest', recovered: 100, done: 14, short: 0, aim: 14 });
  });

  it('counts the sets the session has already given the muscle, as the reason does', () => {
    const s = pickSession({ ...base, minutes: 60 });
    expect(s.exercises.find((x) => x.id === 'barbell-back-squat').facts).toEqual({ muscle: 'quadriceps', recovered: 100, done: 0, short: 13, aim: 14 });
  });

  it('has every figure in the reason of every pick, in the facts of that pick, across a whole session', () => {
    const s = pickSession({ ...base, minutes: 60, level: 'advanced', recovery: { chest: 85, lats: 91 }, volume: { thisWeek: { chest: 7, lats: 3.4 }, lastWeek: {}, sessions: {} } });
    expect(s.exercises.length).toBeGreaterThan(3);
    s.exercises.forEach((x) => {
      const numbers = (x.reason.match(/\d+/g) || []).map(Number);
      const known = [x.facts.recovered, x.facts.short, x.facts.aim];
      numbers.forEach((n) => expect(known).toContain(n));
    });
  });

  it('names, in the facts, the muscle the reason is about, for every pick of every kind of session', () => {
    let picks = 0;
    ['beginner', 'intermediate', 'advanced'].forEach((level) => ['strength', 'muscle', 'general'].forEach((goal) => [15, 30, 45, 60].forEach((minutes) => {
      pickSession({ level, goal, minutes }).exercises.forEach((x) => {
        expect(x.primary).toContain(x.facts.muscle);
        expect(x.reason.startsWith(`${muscleLabel(x.facts.muscle)}:`)).toBe(true);
        picks += 1;
      });
    })));
    expect(picks).toBeGreaterThan(100);
    // a deadlift is picked for the glutes, not for the first muscle it lists
    const s = pickSession({
      ...base, recovery: tiredExcept('glutes', 'hamstrings', 'lower_back'),
      volume: { thisWeek: { glutes: 6, hamstrings: 6, lower_back: 4 }, lastWeek: { glutes: 14, hamstrings: 14, lower_back: 14 }, sessions: { glutes: 2, hamstrings: 2, lower_back: 2 } },
    });
    expect(s.exercises[0].facts).toEqual({ muscle: 'glutes', recovered: 100, done: 6, short: 8, aim: 14 });
  });

  it('lists the muscles under the readiness line, least recovered first, equal ones alphabetically, rounded and kept between 0 and 100', () => {
    const s = pickSession({
      ...base, recovery: { chest: 95, triceps: 40, biceps: 40, glutes: 12, calves: 55.4, lats: 70, shoulders: 250, neck: -20 },
    });
    expect(s.status).toBe('ok');
    expect(s.tired).toEqual([
      { muscle: 'neck', recovered: 0 }, { muscle: 'glutes', recovered: 12 }, { muscle: 'biceps', recovered: 40 },
      { muscle: 'triceps', recovered: 40 }, { muscle: 'calves', recovered: 55 },
    ]);
  });

  it('has no tired muscles when every muscle is ready, or no recovery is known', () => {
    expect(pickSession({ ...base }).tired).toEqual([]);
    expect(pickSession({ ...base, recovery: { chest: 95, lats: 70 } }).tired).toEqual([]);
    expect(pickSession({ ...base, recovery: { chest: NaN, lats: 'x', glutes: null } }).tired).toEqual([]);
  });

  it('is only on a session that was picked', () => {
    expect('tired' in pickSession({ ...base, recovery: tiredExcept() })).toBe(false);
    expect('tired' in pickSession({ ...base, equipment: [], level: 'beginner', excluded: LIBRARY.map((e) => e.id) })).toBe(false);
  });
});

describe('the weekly limit', () => {
  const chest = (thisChest, lastChest) => pickSession({
    ...base, recovery: tiredExcept('chest'), volume: { thisWeek: { chest: thisChest }, lastWeek: { chest: lastChest }, sessions: {} },
  });

  // cap = last week x 1.1 rounded up, but at least 10 and at most 20; this week plus today's sets may not pass it
  it.each([
    // [this week, last week, cap, sets of the one exercise]
    [8, 0, 10, 2],
    [8, 10, 11, 3],
    [9, 10, 11, 2],
    [13, 14, 16, 3],
    [14, 14, 16, 2],
    [18, 20, 20, 2],
    [18, 40, 20, 2],
  ])('this week %s, last week %s: the cap is %s, so the press gets %s sets', (thisChest, lastChest, cap, sets) => {
    const s = chest(thisChest, lastChest);
    expect(s.status).toBe('ok');
    expect(s.exercises).toHaveLength(1);
    expect(s.exercises[0].sets).toBe(sets);
    expect(thisChest + sets).toBeLessThanOrEqual(cap);
    expect(thisChest + sets).toBeGreaterThan(cap - 1); // and it is as many as fit
  });

  it.each([
    [9, 0],
    [10, 10],
    [15, 14],
    [19, 20],
    [25, 25],
  ])('this week %s, last week %s: not even 2 sets fit, so it is a full week', (thisChest, lastChest) => {
    const s = chest(thisChest, lastChest);
    expect(s.status).toBe('full');
    expect(s.message).toMatch(/set limit/);
    expect(s.exercises).toEqual([]);
    expect(s.totalSets).toBe(0);
  });

  it('lets a new lifter start: with no sets in either week the cap is 10', () => {
    const s = chest(0, 0);
    expect(s.exercises[0].sets).toBe(3);
    expect(s.exercises.reduce((sum, x) => sum + x.sets, 0)).toBeLessThanOrEqual(10);
  });

  it('applies to the muscles an exercise only helps: a triceps at its limit rules out the presses', () => {
    const withLimit = pickSession({ ...base, recovery: tiredExcept('chest'), volume: { thisWeek: { triceps: 10 }, lastWeek: {}, sessions: {} } });
    expect(withLimit.status).toBe('ok');
    withLimit.exercises.forEach((x) => expect(x.secondary).not.toContain('triceps'));
    const without = pickSession({ ...base, recovery: tiredExcept('chest') });
    expect(without.exercises.some((x) => x.secondary.includes('triceps'))).toBe(true);
  });

  it('reads bad volume figures as none', () => {
    const odd = { thisWeek: { chest: -4, lats: NaN, glutes: 'x' }, lastWeek: { chest: -9 }, sessions: { chest: 'a' } };
    expect(pickSession({ ...base, volume: odd })).toEqual(pickSession({ ...base, volume: { thisWeek: {}, lastWeek: {}, sessions: {} } }));
    expect(pickSession({ ...base, volume: 'x' })).toEqual(pickSession({ ...base }));
    expect(pickSession({ ...base, volume: { thisWeek: 4, lastWeek: [], sessions: 'x' } })).toEqual(pickSession({ ...base }));
  });
});

describe('the time available', () => {
  it('fits a 15-minute strength session to one lift: three sets with 3 minutes rest is 12.25 minutes, and nothing else fits', () => {
    const s = pickSession({ level: 'intermediate', goal: 'strength', minutes: 15 });
    expect(s.exercises).toHaveLength(1);
    expect(s.exercises[0].sets).toBe(3);
    expect(s.exercises[0].restSeconds).toBe(180);
    expect(s.minutes).toBe(12);
    expect(s.exactMinutes).toBe(12.3);
    expect(s.totalSets).toBe(3);
  });

  it('uses a time that fits to the minute: 12.25 + 7.75 = 20 minutes exactly', () => {
    const s = pickSession({ level: 'intermediate', goal: 'strength', minutes: 20, recovery: tiredExcept('chest') });
    expect(s.exercises.map((x) => x.id)).toEqual(['dumbbell-bench-press', 'dumbbell-pullover']);
    expect(s.exercises.map((x) => x.sets)).toEqual([3, 3]);
    expect(s.exactMinutes).toBe(20);
  });

  it('rounds the time asked for before fitting to it: 11.6 minutes is 12, which holds four sets of an advanced lifter\'s press (12.0 minutes)', () => {
    const s = pickSession({ level: 'advanced', goal: 'muscle', minutes: 11.6, recovery: tiredExcept('chest') });
    expect(s.exercises.map((x) => x.sets)).toEqual([4]);
    expect(s.exactMinutes).toBe(12);
    expect(pickSession({ level: 'advanced', goal: 'muscle', minutes: 11, recovery: tiredExcept('chest') }).exercises.map((x) => x.sets)).toEqual([3]);
  });

  it('never goes over the minutes asked, for every time, goal and level', () => {
    SESSION_RULES.minutesOptions.forEach((minutes) => ['strength', 'muscle', 'general'].forEach((goal) => LEVELS.forEach((level) => ['gym', 'dumbbells', 'bodyweight'].forEach((equipment) => {
      const s = pickSession({ minutes, goal, level, equipment });
      const total = s.exercises.reduce((sum, x) => sum + minutesOf(x), 0);
      expect(total).toBeLessThanOrEqual(minutes + 1e-9);
      expect(s.minutes).toBeLessThanOrEqual(minutes);
      expect(s.minutes).toBe(Math.round(total));
      expect(s.exactMinutes).toBe(Math.round(total * 10) / 10);
    }))));
  });

  it('cuts the last exercise to fewer sets rather than leaving it out, but never below 2', () => {
    SESSION_RULES.minutesOptions.forEach((minutes) => {
      const s = pickSession({ ...base, minutes });
      s.exercises.forEach((x) => expect(x.sets).toBeGreaterThanOrEqual(SESSION_RULES.minSets));
    });
    // 45 minutes, strength, dumbbells: three 12.25-minute lifts use 36.75, and the 4th is a 2-set accessory
    const s = pickSession({ level: 'intermediate', goal: 'strength', minutes: 45, equipment: 'dumbbells' });
    expect(s.exercises.map((x) => x.sets)).toEqual([3, 3, 3, 3]);
    const tight = pickSession({ ...base, minutes: 40, recovery: tiredExcept('chest') });
    expect(tight.exercises.map((x) => x.sets)).toEqual([3, 3]);
  });

  it('reads a bad time as 30 minutes, keeps one between 10 and 120, and rounds', () => {
    const thirty = pickSession({ ...base, minutes: 30 });
    [undefined, null, NaN, 0, -20, '45', {}, Infinity].forEach((m) => expect(pickSession({ ...base, minutes: m })).toEqual(thirty));
    expect(pickSession({ ...base, minutes: 5 }).minutes).toBeLessThanOrEqual(10);
    expect(pickSession({ ...base, minutes: 5 }).exercises).toHaveLength(1);
    expect(pickSession({ ...base, minutes: 5 })).toEqual(pickSession({ ...base, minutes: 10 }));
    expect(pickSession({ ...base, minutes: 500 })).toEqual(pickSession({ ...base, minutes: 120 }));
    expect(pickSession({ ...base, minutes: 44.6 })).toEqual(pickSession({ ...base, minutes: 45 }));
    expect(pickSession({ ...base, minutes: 44.4 })).toEqual(pickSession({ ...base, minutes: 44 }));
  });

  it('puts at most 8 exercises in a session, however long it is', () => {
    const s = pickSession({ ...base, minutes: 120 });
    expect(s.exercises.length).toBeLessThanOrEqual(SESSION_RULES.maxExercises);
    expect(s.exercises.length).toBeGreaterThanOrEqual(6);
  });

  it('a 10-minute session still fits one exercise at 2 sets (8.5 minutes for a strength lift)', () => {
    const s = pickSession({ level: 'intermediate', goal: 'strength', minutes: 10 });
    expect(s.exercises).toHaveLength(1);
    expect(s.exercises[0].sets).toBe(2);
    expect(s.exactMinutes).toBe(8.5);
  });
});

describe('the shape of a session', () => {
  const full = pickSession({ ...base, minutes: 120 });

  it('has no repeated exercise, no conditioning move, one compound lift per movement pattern and at most two isolation or core moves', () => {
    expect(new Set(ids(full)).size).toBe(full.exercises.length);
    const patterns = {};
    full.exercises.forEach((x) => {
      const p = lib(x.id).pattern;
      expect(p).not.toBe('conditioning');
      patterns[p] = (patterns[p] || 0) + 1;
    });
    Object.entries(patterns).forEach(([p, n]) => expect(n).toBeLessThanOrEqual(p === 'isolation' || p === 'core' ? 2 : 1));
  });

  it('puts a compound lift before an accessory even when the accessory is worth more', () => {
    // Chest 12 sets in (a 0.14 need), biceps none: the curl is worth more than the press, and is picked first, but the press is listed first.
    const s = pickSession({
      ...base, recovery: tiredExcept('chest', 'biceps'), volume: { thisWeek: { chest: 12 }, lastWeek: { chest: 14 }, sessions: { chest: 2 } },
    });
    expect(s.exercises[0]).toMatchObject({ id: 'dumbbell-bench-press', role: 'compound' });
    expect(ids(s).indexOf('dumbbell-curl')).toBeGreaterThan(0);
  });

  it('puts at most two isolation moves in a session and never the same exercise twice, even when only arms are ready', () => {
    const s = pickSession({ ...base, minutes: 60, recovery: tiredExcept('biceps', 'triceps') });
    expect(new Set(ids(s)).size).toBe(s.exercises.length);
    expect(s.exercises.filter((x) => lib(x.id).pattern === 'isolation')).toHaveLength(2);
    expect(ids(s)).toEqual(['close-grip-bench-press', 'dumbbell-curl', 'triceps-pushdown']);
    expect(s.name).toBe('Triceps and Biceps');
  });

  it('breaks a tie in worth by the earlier id: of three cable chest moves worth the same, cable-crossover', () => {
    const s = pickSession({ ...base, recovery: tiredExcept('chest'), excluded: ['dumbbell-pullover', 'chest-dip'] });
    expect(ids(s)).toEqual(['dumbbell-bench-press', 'cable-crossover']);
  });

  it('puts at most two exercises on the same main muscle', () => {
    const count = {};
    full.exercises.forEach((x) => x.primary.forEach((m) => { count[m] = (count[m] || 0) + 1; }));
    Object.values(count).forEach((n) => expect(n).toBeLessThanOrEqual(2));
  });

  it('puts the compound lifts first, then the rest', () => {
    const roles = full.exercises.map((x) => x.role);
    expect(roles).toEqual([...roles].sort((a, b) => (a === b ? 0 : a === 'compound' ? -1 : 1)));
    expect(roles[0]).toBe('compound');
    expect(roles).toContain('accessory');
  });

  it('adds the sets and the minutes up', () => {
    expect(full.totalSets).toBe(full.exercises.reduce((sum, x) => sum + x.sets, 0));
  });

  it('gives each exercise a name, muscles, a reason that names its muscle, and the muscles for the workout record', () => {
    full.exercises.forEach((x) => {
      const l = lib(x.id);
      expect(x.name).toBe(l.name);
      expect(x.primary).toEqual(l.primary);
      expect(x.secondary).toEqual(l.secondary);
      expect(x.muscleGroups).toEqual([...l.primary, ...l.secondary]);
      expect(x.bodyweight).toBe(l.bodyweight);
      expect(x.reason).toMatch(/^[A-Z][a-z ]+: .+\.$/);
      expect(l.primary.map((m) => m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' '))).toContain(x.reason.split(':')[0]);
      expect(x.weight).toBeNull();
      expect(x.unit).toBeNull();
      expect(x.dayType).toBeNull();
      expect(x.deload).toBe(false);
      expect(x.target).toBeNull();
      expect(x.detail).toBeNull();
    });
  });

  it('names a session after the muscles it works most, and calls a wide one Full Body', () => {
    expect(full.name).toBe('Full Body');
    expect(pickSession({ ...base, recovery: tiredExcept('chest', 'lats') }).name).toBe('Chest and Lats');
    expect(pickSession({ ...base, recovery: tiredExcept('biceps') }).name).toBe('Biceps');
    // three muscles near the top are named, four are a full body, and a muscle under half of the top one is left out of the name
    expect(pickSession({ ...base, minutes: 60, recovery: tiredExcept('chest', 'lats', 'quadriceps') }).name).toBe('Chest, Quadriceps and Lats');
    expect(pickSession({ ...base, minutes: 60, recovery: tiredExcept('chest', 'lats', 'quadriceps', 'shoulders') }).name).toBe('Full Body');
    expect(pickSession({ ...base, minutes: 20, recovery: tiredExcept('chest', 'triceps') }).name).toBe('Chest'); // chest 6 sets, triceps 2
    expect(pickSession({ level: 'beginner', goal: 'general', minutes: 30, equipment: 'bodyweight' }).name).toBe('Glutes, Quadriceps and Chest');
  });

  it('carries the goal and level it was built for', () => {
    expect(full.goal).toBe('muscle');
    expect(full.level).toBe('intermediate');
    expect(pickSession({ goal: 'strength', level: 'advanced' })).toEqual(expect.objectContaining({ goal: 'strength', level: 'advanced' }));
  });
});

describe('goal and level', () => {
  const first = (extra) => pickSession({ minutes: 120, ...extra }).exercises;

  it('times a hold by its hold time, shows no reps for it, and counts it as an accessory with the accessory rest', () => {
    let timedSeen = 0;
    LEVELS.forEach((level) => ['strength', 'muscle', 'general'].forEach((goal) => {
      first({ level, goal, equipment: 'bodyweight' }).filter((x) => x.timed).forEach((x) => {
        timedSeen += 1;
        expect(x.role).toBe('accessory');
        expect(x.workSeconds).toBe(SESSION_RULES.holdSeconds[level]);
        expect(x.holdSeconds).toBe(SESSION_RULES.holdSeconds[level]);
        expect(x.restSeconds).toBe(SESSION_RULES.restSeconds.other[goal]);
        expect(x.reps).toBeNull();
        expect(x.repRange).toBeNull();
      });
    }));
    expect(timedSeen).toBeGreaterThanOrEqual(9);
  });

  it('does not discount a bodyweight move for general fitness, and does for size: the push-up and the loaded close-grip press tie, then differ', () => {
    // Only the triceps are ready. Close-grip bench press (barbell) and the diamond push-up (bodyweight) are both compound: worth the same except
    // that, for strength or size, the bodyweight one counts 80%. General fitness: a tie, which goes to the move that needs less equipment.
    const gym = (goal) => pickSession({ level: 'intermediate', goal, minutes: 30, recovery: { ...tiredExcept('triceps'), chest: 0, shoulders: 0 } }).exercises[0].id;
    expect(gym('general')).toBe('diamond-push-up');
    expect(gym('muscle')).toBe('close-grip-bench-press');
    expect(gym('strength')).toBe('close-grip-bench-press');
  });

  it('sets the sets, the rest and the reps from the goal and level', () => {
    LEVELS.forEach((level) => ['strength', 'muscle', 'general'].forEach((goal) => {
      const exercises = first({ level, goal });
      exercises.forEach((x) => {
        const kind = x.role === 'compound' ? 'compound' : 'other';
        expect(x.restSeconds).toBe(SESSION_RULES.restSeconds[kind][goal]);
        expect(x.sets).toBeLessThanOrEqual(SESSION_RULES.setsPerExercise[kind][level]);
        if (x.timed) {
          expect(x.workSeconds).toBe(SESSION_RULES.holdSeconds[level]);
          expect(x.holdSeconds).toBe(SESSION_RULES.holdSeconds[level]);
          expect(x.reps).toBeNull();
          expect(x.repRange).toBeNull();
        } else {
          expect(x.workSeconds).toBe(SESSION_RULES.workSecondsPerSet);
          expect(x.holdSeconds).toBeNull();
          const range = repRangeFor(goal, describeLift(x.name).main ? 'light' : null, { bodyweight: x.bodyweight });
          expect(x.repRange).toEqual(range);
          expect(x.reps).toBe(`${range.min}-${range.max}`);
        }
      });
      // with all the time there is, the first lift has the full number of sets
      expect(exercises[0].sets).toBe(SESSION_RULES.setsPerExercise.compound[level]);
    }));
    expect(SESSION_RULES.setsPerExercise.compound).toEqual({ beginner: 3, intermediate: 3, advanced: 4 });
    expect(SESSION_RULES.restSeconds.compound).toEqual({ strength: 180, muscle: 120, general: 90 });
    expect(SESSION_RULES.restSeconds.other).toEqual({ strength: 90, muscle: 60, general: 45 });
  });

  it('starts a main lift on its light day, with the goal rep range', () => {
    const squat = first({ level: 'intermediate', goal: 'strength' }).find((x) => x.id === 'barbell-back-squat');
    expect(squat.repRange).toEqual(repRangeFor('strength', 'light'));
    const curl = first({ level: 'intermediate', goal: 'strength' }).find((x) => x.id === 'dumbbell-curl');
    if (curl) expect(curl.repRange).toEqual(repRangeFor('strength', null));
  });

  it('does not offer a move above the person\'s level, unless they are already on that rung of a ladder', () => {
    const rank = (d) => LEVELS.indexOf(d);
    LEVELS.forEach((level) => {
      pickSession({ level, goal: 'muscle', minutes: 120 }).exercises.forEach((x) => expect(rank(lib(x.id).difficulty)).toBeLessThanOrEqual(rank(level)));
      pickSession({ level, goal: 'muscle', minutes: 120, equipment: 'bodyweight' }).exercises.forEach((x) => expect(rank(lib(x.id).difficulty)).toBeLessThanOrEqual(rank(level)));
    });
    const archer = pickSession({ ...base, level: 'beginner', equipment: 'bodyweight', recovery: tiredExcept('chest'), ladderRungs: { push: 6 } });
    expect(archer.exercises[0].id).toBe('archer-push-up');
  });

  it('weighs a compound lift against an isolation move by the goal, and a bodyweight move against a loaded one', () => {
    // Only the triceps are ready (chest and shoulders are spent, so they add nothing). The diamond push-up is a bodyweight compound lift and the
    // overhead extension an isolation move with a dumbbell, both worth 1.3 before the goal: strength gives a compound lift +50% and an isolation move
    // nothing, size +25% and +10%, general fitness +25% and nothing; a bodyweight move is worth 80% of that for someone who has weights and
    // wants strength or size. So: strength 1.56 against 1.3, size 1.3 against 1.43, general 1.625 against 1.3.
    const triceps = (goal) => pickSession({
      level: 'intermediate', goal, minutes: 30, equipment: 'dumbbells', recovery: { ...tiredExcept('triceps'), chest: 0, shoulders: 0 },
    }).exercises[0].id;
    expect(triceps('strength')).toBe('diamond-push-up');
    expect(triceps('muscle')).toBe('overhead-dumbbell-triceps-extension');
    expect(triceps('general')).toBe('diamond-push-up');
  });

  it('starts a ladder one level below the person with no history: wall push-up, push-up, then push-up again (no bench)', () => {
    const first = (level, rungs) => pickSession({ level, goal: 'general', minutes: 30, equipment: 'bodyweight', recovery: tiredExcept('chest'), ladderRungs: rungs }).exercises[0].id;
    expect(first('beginner')).toBe('wall-push-up');
    expect(first('intermediate')).toBe('push-up');
    expect(first('advanced')).toBe('push-up');
    expect(first('beginner', { push: 3 })).toBe('knee-push-up');
    expect(first('intermediate', { push: 1 })).toBe('wall-push-up');
    expect(first('advanced', { push: 7 })).toBe('single-arm-push-up');
    expect(first('intermediate', { push: 4.5 })).toBe('push-up'); // the nearest rung at or below
  });

  it('leaves out a ladder whose first rung is above a beginner, but offers it to an intermediate', () => {
    const pike = (level) => pickSession({ level, goal: 'general', minutes: 30, equipment: 'bodyweight', recovery: tiredExcept('shoulders') });
    expect(pike('beginner').status).toBe('rest');
    expect(pike('intermediate').exercises[0].id).toBe('pike-push-up');
  });

  it('reads an unknown goal as general and an unknown level as a beginner', () => {
    expect(pickSession({ goal: 'swole', level: 'god' })).toEqual(pickSession({ goal: 'general', level: 'beginner' }));
    expect(pickSession({ goal: undefined, level: undefined })).toEqual(pickSession({ goal: 'general', level: 'beginner' }));
    expect(pickSession({ level: ' Advanced ' }).level).toBe('advanced');
    expect(pickSession({ level: 'elite' }).level).toBe('advanced');
  });
});

describe('equipment', () => {
  const needs = (s) => s.exercises.flatMap((x) => lib(x.id).equipment);

  it('uses nothing but bodyweight when there is no equipment', () => {
    const s = pickSession({ ...base, equipment: 'bodyweight' });
    expect(s.status).toBe('ok');
    expect(new Set(needs(s))).toEqual(new Set(['bodyweight']));
  });

  it('uses only dumbbells and a bench for the dumbbell preset', () => {
    const s = pickSession({ ...base, equipment: 'dumbbells', minutes: 60 });
    expect(s.status).toBe('ok');
    needs(s).forEach((q) => expect(['bodyweight', 'dumbbell', 'bench']).toContain(q));
    expect(needs(s)).toContain('dumbbell');
  });

  it('uses a list of equipment as it is given, and drops words the library does not know', () => {
    const s = pickSession({ ...base, equipment: ['dumbbell', 'warp_drive'], minutes: 60 });
    needs(s).forEach((q) => expect(['bodyweight', 'dumbbell']).toContain(q));
    expect(pickSession({ ...base, equipment: ['warp_drive'] })).toEqual(pickSession({ ...base, equipment: 'bodyweight' }));
    expect(pickSession({ ...base, equipment: [] })).toEqual(pickSession({ ...base, equipment: 'bodyweight' }));
  });

  it('is the whole gym when no equipment is given, and nothing for a preset that does not exist', () => {
    expect(pickSession({ ...base })).toEqual(pickSession({ ...base, equipment: 'gym' }));
    expect(pickSession({ ...base, equipment: null })).toEqual(pickSession({ ...base, equipment: 'gym' }));
    expect(pickSession({ ...base, equipment: 'moon base' })).toEqual(pickSession({ ...base, equipment: 'bodyweight' }));
    expect(pickSession({ ...base, equipment: 'toString' })).toEqual(pickSession({ ...base, equipment: 'bodyweight' }));
    expect(pickSession({ ...base, equipment: 7 })).toEqual(pickSession({ ...base, equipment: 'bodyweight' }));
  });

  it('says so when nothing at all fits: every exercise excluded', () => {
    const s = pickSession({ ...base, excluded: LIBRARY.map((e) => e.id), injuries: ['shoulder'] });
    expect(s).toEqual({
      status: 'limited', message: expect.stringMatching(/Nothing in the exercise library fits/), name: 'Session', goal: 'muscle', level: 'intermediate',
      minutes: 0, totalSets: 0, exercises: [], leftOutFor: [],
    });
    expect(pickSession({ ...base, excluded: LIBRARY.filter((e) => e.pattern !== 'conditioning').map((e) => e.id) }).status).toBe('limited');
  });
});

describe('exercises the person excluded', () => {
  it('are never picked: the next best takes their place', () => {
    const chest = pickSession({ ...base, recovery: tiredExcept('chest') });
    expect(ids(chest)[0]).toBe('dumbbell-bench-press');
    const without = pickSession({ ...base, recovery: tiredExcept('chest'), excluded: ['dumbbell-bench-press'] });
    expect(ids(without)).not.toContain('dumbbell-bench-press');
    expect(ids(without)[0]).toBe('barbell-bench-press');
  });

  it('ignore anything that is not an id', () => {
    expect(pickSession({ ...base, excluded: [4, null, {}, '', 'nonsense'] })).toEqual(pickSession({ ...base }));
    expect(pickSession({ ...base, excluded: 'deadlift' })).toEqual(pickSession({ ...base }));
  });
});

describe('determinism and the inputs', () => {
  it('gives the same session for the same inputs, and changes nothing it is given', () => {
    const input = deepFreeze({
      ...base,
      recovery: { chest: 80, quadriceps: 60 }, volume: { thisWeek: { lats: 6 }, lastWeek: { lats: 8 }, sessions: { lats: 1 } },
      injuries: ['knee'], excluded: ['pull-up'], ladderRungs: { push: 3 },
    });
    const a = pickSession(input);
    const b = pickSession(input);
    expect(a).toEqual(b);
    expect(a.status).toBe('ok');
  });

  it('does not throw on missing or odd options', () => {
    [undefined, null, 'x', 5, [], {}, { recovery: 5, volume: 7, ladderRungs: 'x', injuries: 'knee', excluded: 3 }].forEach((options) => {
      expect(() => pickSession(options)).not.toThrow();
      expect(pickSession(options).status).toBe('ok');
    });
    expect(pickSession()).toEqual(pickSession({ level: 'beginner', goal: 'general', minutes: 30, equipment: 'gym' }));
  });

  it('returns fresh arrays: changing a result does not change the library', () => {
    const s = pickSession({ ...base });
    s.exercises[0].primary.push('neck');
    s.exercises[0].muscleGroups.push('neck');
    expect(pickSession({ ...base }).exercises[0].primary).toEqual(lib(s.exercises[0].id).primary);
    expect(pickSession({ ...base }).exercises[0].muscleGroups).toEqual([...lib(s.exercises[0].id).primary, ...lib(s.exercises[0].id).secondary]);
  });
});

describe('attachTargets', () => {
  const session = pickSession({ ...base, minutes: 60, equipment: 'bodyweight', level: 'beginner' });
  const timed = session.exercises.find((x) => x.timed);
  const loaded = pickSession({ ...base, minutes: 60 });
  const bench = loaded.exercises.find((x) => x.id === 'barbell-bench-press') || loaded.exercises[0];
  const rx = (extra = {}) => ({
    weight: 135, targetReps: 6, repRange: { min: 6, max: 8 }, dayType: 'heavy', repsLeft: 2, shareOfOneRepMax: 80, deload: false, setsFactor: 1, reason: 'x', ...extra,
  });

  it('adds the weight, the rep range and the words from the load rules to the exercise they belong to', () => {
    const out = attachTargets(loaded, { [bench.id]: rx() });
    const x = out.exercises.find((e) => e.id === bench.id);
    expect(x.weight).toBe(135);
    expect(x.unit).toBe('lb');
    expect(x.repRange).toEqual({ min: 6, max: 8 });
    expect(x.reps).toBe('6-8');
    expect(x.dayType).toBe('heavy');
    expect(x.deload).toBe(false);
    expect(x.target).toBe('135 lb x 6 reps');
    expect(x.detail).toBe('Heavy day · 6-8 reps · stop with about 2 reps left · about 80% of your estimated 1-rep max');
    expect(x.sets).toBe(bench.sets);
  });

  it('shows the unit it is asked for', () => {
    const x = attachTargets(loaded, { [bench.id]: rx() }, { unit: 'kg' }).exercises.find((e) => e.id === bench.id);
    expect(x.unit).toBe('kg');
    expect(x.target).toBe('135 kg x 6 reps');
  });

  it('leaves an exercise with no prescription exactly as it was', () => {
    const out = attachTargets(loaded, { [bench.id]: rx() });
    out.exercises.filter((e) => e.id !== bench.id).forEach((e) => expect(e).toBe(loaded.exercises.find((o) => o.id === e.id)));
    expect(attachTargets(loaded, {}).exercises).toEqual(loaded.exercises);
    expect(attachTargets(loaded, null).exercises).toEqual(loaded.exercises);
    expect(attachTargets(loaded, { [bench.id]: null }).exercises).toEqual(loaded.exercises);
    expect(attachTargets(loaded, { [bench.id]: 'x' }).exercises).toEqual(loaded.exercises);
  });

  it('shows reps and no weight for a bodyweight move, and does not touch a timed hold', () => {
    const wall = session.exercises.find((x) => x.bodyweight && !x.timed);
    const out = attachTargets(session, { [wall.id]: rx({ weight: 0, targetReps: 12, dayType: null, repsLeft: null, shareOfOneRepMax: null, repRange: { min: 10, max: 20 } }), [timed.id]: rx() });
    const w = out.exercises.find((e) => e.id === wall.id);
    expect(w.weight).toBeNull();
    expect(w.unit).toBeNull();
    expect(w.target).toBe('12 reps');
    expect(w.detail).toBe('10-20 reps');
    expect(out.exercises.find((e) => e.id === timed.id)).toBe(timed);
  });

  it('keeps the goal range when the prescription has none, and the weight null when it has none', () => {
    const x = attachTargets(loaded, { [bench.id]: rx({ repRange: { min: 0, max: 0 }, weight: null }) }).exercises.find((e) => e.id === bench.id);
    expect(x.repRange).toEqual(bench.repRange);
    expect(x.reps).toBe(bench.reps);
    expect(x.weight).toBeNull();
    expect(x.unit).toBeNull();
    const noRange = attachTargets(loaded, { [bench.id]: rx({ repRange: undefined }) }).exercises.find((e) => e.id === bench.id);
    expect(noRange.repRange).toEqual(bench.repRange);
  });

  it('halves the sets in a deload week, never below 1, and recomputes the totals', () => {
    const three = loaded.exercises.filter((e) => e.sets === 3);
    expect(three.length).toBeGreaterThan(0);
    const x0 = three[0];
    const out = attachTargets(loaded, { [x0.id]: rx({ deload: true, setsFactor: 0.5, dayType: null }) });
    const x = out.exercises.find((e) => e.id === x0.id);
    expect(x.sets).toBe(2); // 3 x 0.5 = 1.5, rounded
    expect(x.deload).toBe(true);
    expect(x.detail).toMatch(/^Deload · 6-8 reps · about half the usual sets$/);
    expect(out.totalSets).toBe(loaded.totalSets - 1);
    expect(out.exactMinutes).toBeLessThan(loaded.exactMinutes);
    expect(out.minutes).toBe(Math.round(out.exercises.reduce((sum, e) => sum + minutesOf(e), 0)));
    const tiny = attachTargets(loaded, { [x0.id]: rx({ deload: true, setsFactor: 0.1 }) }).exercises.find((e) => e.id === x0.id);
    expect(tiny.sets).toBe(1);
    const none = attachTargets(loaded, { [x0.id]: rx({ deload: true, setsFactor: undefined }) }).exercises.find((e) => e.id === x0.id);
    expect(none.sets).toBe(3);
    const notDeload = attachTargets(loaded, { [x0.id]: rx({ deload: false, setsFactor: 0.5 }) }).exercises.find((e) => e.id === x0.id);
    expect(notDeload.sets).toBe(3);
  });

  it('does not change the session it is given, and passes through something that is not a session', () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(loaded)));
    expect(() => attachTargets(frozen, { [bench.id]: rx() })).not.toThrow();
    expect(attachTargets(null, {})).toBeNull();
    expect(attachTargets({ status: 'rest' }, {})).toEqual({ status: 'rest' });
    expect(attachTargets(undefined)).toBeUndefined();
  });
});

describe('sessionToWorkout', () => {
  const s = pickSession({ ...base, minutes: 60, equipment: 'bodyweight', level: 'beginner' });
  const w = sessionToWorkout(s);

  it('is the workout Quick Workout saves: a name, a description, a length, XP, and each exercise with its sets, reps and rest', () => {
    expect(w.name).toBe(s.name);
    expect(w.category).toBe('Build Muscle');
    expect(w.difficulty).toBe('beginner');
    expect(w.duration).toBe(s.minutes);
    expect(w.xpReward).toBe(calculateXpReward('beginner', s.minutes));
    expect(w.source).toBe('engine_session');
    expect(w.description).toBe(`Built from your recovery and this week's training: ${s.exercises.length} exercises, about ${s.minutes} minutes.`);
    expect(w.exercises).toHaveLength(s.exercises.length);
    w.exercises.forEach((e, i) => {
      const x = s.exercises[i];
      expect(e.name).toBe(x.name);
      expect(e.sets).toBe(x.sets);
      expect(e.restSeconds).toBe(x.restSeconds);
      expect(e.muscleGroups).toEqual(x.muscleGroups);
      expect(e.muscleGroups).not.toBe(x.muscleGroups);
      if (x.timed) {
        expect(e.duration).toBe(x.holdSeconds);
        expect(e).not.toHaveProperty('reps');
      } else {
        expect(e.reps).toBe(x.reps);
        expect(e).not.toHaveProperty('duration');
      }
    });
    expect(w.exercises.some((e) => 'duration' in e)).toBe(true);
  });

  it('names the category after the goal', () => {
    expect(sessionToWorkout(pickSession({ goal: 'strength' })).category).toBe('Strength');
    expect(sessionToWorkout(pickSession({ goal: 'general' })).category).toBe('General Fitness');
    expect(sessionToWorkout({ ...s, goal: 'other' }).category).toBe('General Fitness');
  });

  it('is at least 5 minutes long', () => {
    expect(sessionToWorkout({ ...s, minutes: 2 }).duration).toBe(5);
    expect(sessionToWorkout({ ...s, minutes: 2 }).xpReward).toBe(calculateXpReward('beginner', 5));
  });

  it('is nothing for a session that was not built', () => {
    expect(sessionToWorkout(null)).toBeNull();
    expect(sessionToWorkout(undefined)).toBeNull();
    expect(sessionToWorkout({ ...s, status: 'rest' })).toBeNull();
    expect(sessionToWorkout({ ...s, exercises: 'x' })).toBeNull();
    expect(sessionToWorkout(pickSession({ recovery: tiredExcept() }))).toBeNull();
  });
});

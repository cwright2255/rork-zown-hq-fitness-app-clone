// The training state the AI plan call and the Coach are told (lib/trainingState.js): what is counted over the last 14 days, how recovered
// each muscle still recovering is, what is left out when it is not known, how reported injuries are carried, and the Coach's sentences for it.
import {
  countWorkoutsSince, musclesWorkedSince, buildTrainingState, isEmptyTrainingState, coachTrainingFacts, workoutPlanRequest,
  TRAINING_STATE_VERSION, MAX_MUSCLES, MAX_LIFTS, RECENT_DAYS,
} from '../lib/trainingState';
import { MUSCLES } from '../lib/muscleVocabulary';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-23T12:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const session = (days, ...groups) => ({ date: ago(days), exercises: groups.map((muscleGroups) => ({ muscleGroups })) });

const bench = { name: 'Bench Press', bestWeight: 185, bestReps: 5, bestE1RM: 216, bestDate: '2026-09-30', lastSessionDate: '2026-10-20', sessionCount: 12 };
const squat = { name: 'Squat', bestWeight: 225, bestReps: 3, bestE1RM: 248, bestDate: '2026-10-01', lastSessionDate: '2026-10-18', sessionCount: 9 };
const ready = { hidden: false, ready: true, score: 71.4, label: 'Moderate', used: 3, parts: [] };
const loaded = { acuteLoad: 900, chronicWeeklyAvg: 800, ratio: 1.13, zone: 'sweet_spot', zoneLabel: 'In your typical training range' };

it('looks back 14 days for workouts and muscles worked', () => {
  expect(RECENT_DAYS).toBe(14);
});

describe('countWorkoutsSince', () => {
  it('counts the workouts in the last 14 days, whatever form the date is in', () => {
    const workouts = [
      { date: ago(1) },
      { date: ago(2).toISOString() },
      { date: { toDate: () => ago(3) } },
      { completedAt: ago(4).toISOString() },
      { date: ago(13.9) },
      { date: ago(14.1) },
      { date: ago(30) },
    ];
    expect(countWorkoutsSince(workouts, NOW)).toBe(5);
  });

  it('counts a workout from 10 days ago, which a week would have left out', () => {
    expect(countWorkoutsSince([{ date: ago(10) }], NOW)).toBe(1);
    expect(countWorkoutsSince([{ date: ago(10) }], NOW, 7)).toBe(0);
  });

  it('reads the finish time first, then the saved date, then the timestamp, the way Workout History does', () => {
    expect(countWorkoutsSince([{ completedAt: ago(2).toISOString(), date: ago(20) }], NOW)).toBe(1);
    expect(countWorkoutsSince([{ completedAt: ago(20).toISOString(), date: ago(2) }], NOW)).toBe(0);
    expect(countWorkoutsSince([{ completedAt: '', date: ago(2) }], NOW)).toBe(1);
    expect(countWorkoutsSince([{ timestamp: ago(2).toISOString() }], NOW)).toBe(1);
  });

  it('does not count a record whose date is not a date, or one dated after now', () => {
    const workouts = [
      { date: null }, { date: undefined }, { date: true }, { date: 'not a date' }, { date: {} }, {}, null, 'text', 5,
      { date: new Date(NOW.getTime() + DAY) },
    ];
    expect(countWorkoutsSince(workouts, NOW)).toBe(0);
  });

  it('takes the window from the days it is given', () => {
    expect(countWorkoutsSince([{ date: ago(2) }, { date: ago(10) }], NOW, 30)).toBe(2);
    expect(countWorkoutsSince([{ date: ago(2) }, { date: ago(10) }], NOW, 3)).toBe(1);
  });

  it('is zero for anything that is not a list', () => {
    expect(countWorkoutsSince(undefined, NOW)).toBe(0);
    expect(countWorkoutsSince('workouts', NOW)).toBe(0);
  });
});

describe('musclesWorkedSince', () => {
  it('counts the workouts that worked each muscle, most often first, equal ones alphabetically', () => {
    const workouts = [session(1, ['chest', 'triceps']), session(4, ['chest']), session(8, ['quadriceps', 'glutes']), session(12, ['triceps'])];
    expect(musclesWorkedSince({ workouts, now: NOW })).toEqual([
      { muscle: 'chest', sessions: 2 },
      { muscle: 'triceps', sessions: 2 },
      { muscle: 'glutes', sessions: 1 },
      { muscle: 'quadriceps', sessions: 1 },
    ]);
  });

  it('counts a muscle once for a workout, however many of its exercises used it, and in any spelling the muscle map knows', () => {
    const workouts = [session(2, ['Chest'], ['chest', 'triceps'], [' chest '], ['quads'], ['quadriceps'])];
    expect(musclesWorkedSince({ workouts, now: NOW })).toEqual([
      { muscle: 'chest', sessions: 1 },
      { muscle: 'quadriceps', sessions: 1 },
      { muscle: 'triceps', sessions: 1 },
    ]);
  });

  it('leaves out workouts older than the window, and any not dated', () => {
    const workouts = [session(15, ['lats']), { exercises: [{ muscleGroups: ['lats'] }] }, session(13, ['calves'])];
    expect(musclesWorkedSince({ workouts, now: NOW })).toEqual([{ muscle: 'calves', sessions: 1 }]);
    expect(musclesWorkedSince({ workouts, now: NOW, days: 7 })).toEqual([]);
  });

  it('finds an exercise the library knows by its name, so a program-day workout with no muscle tags still counts: the main muscles and the helpers', () => {
    const workouts = [{ date: ago(1), exercises: [{ name: 'Bench Press', sets: 4, reps: '8-10' }] }, { date: ago(2), exercises: [{ name: 'Squat', sets: 3 }] }];
    expect(musclesWorkedSince({ workouts, now: NOW }).map((m) => m.muscle)).toEqual([
      'adductors', 'chest', 'core', 'glutes', 'hamstrings', 'lower_back', 'quadriceps', 'shoulders', 'triceps',
    ]);
  });

  it('prefers the library over the exercise\'s own tags, as the recovery figures do', () => {
    const workouts = [{ date: ago(1), exercises: [{ name: 'Barbell Curl', sets: 3, muscleGroups: ['calves'] }] }];
    expect(musclesWorkedSince({ workouts, now: NOW })).toEqual([{ muscle: 'biceps', sessions: 1 }, { muscle: 'forearms', sessions: 1 }]);
  });

  it('does not count an exercise that was marked not done, nor one in a workout saved before sets were recorded that had none', () => {
    const workouts = [{
      date: ago(1),
      exercises: [
        { name: 'Barbell Curl', sets: 3, done: false, performed: [] },
        { name: 'Custom move', muscleGroups: ['calves'], sets: 3, done: false },
        { name: 'Barbell Bench Press', sets: 3, done: true, performed: [{ weight: 100, reps: 5, rpe: 'hard' }] },
      ],
    }];
    expect(musclesWorkedSince({ workouts, now: NOW }).map((m) => m.muscle)).toEqual(['chest', 'shoulders', 'triceps']);
  });

  it('reads a group word as the muscles it stands for', () => {
    expect(musclesWorkedSince({ workouts: [session(1, ['back'])], now: NOW }).map((m) => m.muscle)).toEqual(['lats', 'traps', 'upper_back']);
  });

  it('counts runs and hikes for the muscles the muscle map gives them', () => {
    const runs = [{ endTime: ago(2).toISOString() }, { startTime: ago(5).toISOString() }, { endTime: ago(30).toISOString() }];
    const hikes = [{ completedAt: ago(3).toISOString() }, { completedAt: ago(40).toISOString() }];
    expect(musclesWorkedSince({ runs, hikes, now: NOW })).toEqual([
      { muscle: 'calves', sessions: 3 },
      { muscle: 'core', sessions: 3 },
      { muscle: 'glutes', sessions: 3 },
      { muscle: 'hamstrings', sessions: 3 },
      { muscle: 'quadriceps', sessions: 3 },
    ]);
  });

  it('adds runs, hikes and workouts together for the same muscle', () => {
    const out = musclesWorkedSince({
      workouts: [session(1, ['quadriceps', 'chest'])], runs: [{ endTime: ago(2).toISOString() }], hikes: [{ completedAt: ago(3).toISOString() }], now: NOW,
    });
    expect(out[0]).toEqual({ muscle: 'quadriceps', sessions: 3 });
    expect(out.find((m) => m.muscle === 'chest')).toEqual({ muscle: 'chest', sessions: 1 });
  });

  it('ignores muscle names that are not text, exercises with none, and records of the wrong shape, without throwing', () => {
    const workouts = [
      { date: ago(1), exercises: [{ muscleGroups: [null, 7, '', 'chest'] }, { muscleGroups: 'legs' }, {}, null, 'x'] },
      { date: ago(1), exercises: 'none' },
      { date: ago(1) },
      null,
      'text',
    ];
    expect(musclesWorkedSince({ workouts, runs: [null, 3], hikes: [undefined, 'x'], now: NOW })).toEqual([{ muscle: 'chest', sessions: 1 }]);
  });

  it('is an empty list for nothing', () => {
    expect(musclesWorkedSince()).toEqual([]);
    expect(musclesWorkedSince({ workouts: 'x', runs: {}, hikes: 5, now: NOW })).toEqual([]);
  });
});

describe('buildTrainingState', () => {
  const workouts = [
    session(1, ['chest', 'triceps'], ['Chest']),
    session(3, ['quads']),
    session(10, ['chest']),
    session(20, ['back']),
  ];
  const everything = () => buildTrainingState({
    now: NOW,
    workouts,
    runs: [],
    hikes: [],
    recovery: { chest: 33.4, triceps: 80.2, quadriceps: 60, calves: 100 },
    liftPRs: [bench, squat],
    readiness: ready,
    trainingLoad: loaded,
    injuries: ['shoulder'],
  });

  it('gathers the last 14 days, the muscles worked, how recovered the tired muscles are, the lifts, readiness, the training load and whether an injury was reported', () => {
    expect(everything()).toEqual({
      v: TRAINING_STATE_VERSION,
      recentWorkouts: 3,
      musclesWorked: [{ muscle: 'chest', sessions: 2 }, { muscle: 'quadriceps', sessions: 1 }, { muscle: 'triceps', sessions: 1 }],
      muscleRecovery: [{ muscle: 'chest', recovery: 33 }, { muscle: 'quadriceps', recovery: 60 }, { muscle: 'triceps', recovery: 80 }],
      lifts: [
        { name: 'Bench Press', e1rm: 216, bestWeight: 185, bestReps: 5, lastSessionDate: '2026-10-20', sessions: 12 },
        { name: 'Squat', e1rm: 248, bestWeight: 225, bestReps: 3, lastSessionDate: '2026-10-18', sessions: 9 },
      ],
      readiness: { score: 71, label: 'Moderate' },
      trainingLoad: { zone: 'sweet_spot', ratio: 1.13 },
      hasInjuries: true,
    });
  });

  it('is plain data that survives being sent as JSON', () => {
    const state = everything();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('keeps the version the server checks for', () => {
    expect(TRAINING_STATE_VERSION).toBe(3);
  });

  it('keeps the most often worked muscles first and at most the limit', () => {
    const many = MUSCLES.slice(0, 12);
    const { musclesWorked } = buildTrainingState({ now: NOW, workouts: [session(1, many), session(2, ['hamstrings'])] });
    expect(musclesWorked).toHaveLength(MAX_MUSCLES);
    expect(musclesWorked[0]).toEqual({ muscle: 'hamstrings', sessions: 2 }); // the 12th muscle on the list is the only one worked twice
  });

  it('keeps the least recovered muscles first and at most the limit, leaving out muscles that are fully recovered or not a number', () => {
    const recovery = {};
    for (let i = 0; i < 12; i += 1) recovery[`muscle_${String.fromCharCode(97 + i)}`] = 50 + i;
    recovery.rested = 100;
    recovery.beyond = 130;
    recovery.broken = Number.NaN;
    recovery.text = '40';
    const { muscleRecovery } = buildTrainingState({ now: NOW, workouts: [{ date: ago(1) }], recovery });
    expect(muscleRecovery).toHaveLength(MAX_MUSCLES);
    expect(muscleRecovery[0]).toEqual({ muscle: 'muscle_a', recovery: 50 });
    expect(muscleRecovery[MAX_MUSCLES - 1]).toEqual({ muscle: 'muscle_h', recovery: 57 });
    expect(muscleRecovery.map((m) => m.recovery)).toEqual([...muscleRecovery.map((m) => m.recovery)].sort((a, b) => a - b));
    expect(muscleRecovery.find((m) => ['rested', 'beyond', 'broken', 'text'].includes(m.muscle))).toBeUndefined();
  });

  it('puts equal recoveries in alphabetical order, and keeps a muscle that cannot move yet at 0 and a nearly recovered one at 99', () => {
    const { muscleRecovery } = buildTrainingState({
      now: NOW, workouts: [{ date: ago(1) }], recovery: { glutes: 40, calves: 99.4, core: 0, chest: 40, triceps: 0.4, biceps: -3 },
    });
    expect(muscleRecovery).toEqual([
      { muscle: 'biceps', recovery: 0 }, { muscle: 'core', recovery: 0 }, { muscle: 'triceps', recovery: 0 },
      { muscle: 'chest', recovery: 40 }, { muscle: 'glutes', recovery: 40 }, { muscle: 'calves', recovery: 99 },
    ]);
  });

  it('rounds 99.6 to 99, never to 100, since a muscle at 100 is not listed', () => {
    expect(buildTrainingState({ now: NOW, workouts: [{ date: ago(1) }], recovery: { chest: 99.6 } }).muscleRecovery).toEqual([{ muscle: 'chest', recovery: 99 }]);
  });

  it('does not take the old load answer: the figures come from the recovery answer only', () => {
    const state = buildTrainingState({ now: NOW, workouts: [{ date: ago(1) }], fatigue: { chest: 80 } });
    expect(state.muscleRecovery).toEqual([]);
    expect('muscleLoad' in state).toBe(false);
  });

  it('leaves out a lift without a usable best set, and keeps at most the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...bench, name: `Lift ${i}` }));
    const { lifts } = buildTrainingState({
      now: NOW,
      liftPRs: [{ name: 'Deadlift' }, { ...bench, bestE1RM: 0 }, { ...bench, name: '  ' }, null, 'Squat', { ...bench, bestWeight: -5 }, ...many],
    });
    expect(lifts).toHaveLength(MAX_LIFTS);
    expect(lifts.map((l) => l.name)).toEqual(['Lift 0', 'Lift 1', 'Lift 2', 'Lift 3', 'Lift 4', 'Lift 5']);
  });

  it('keeps a lift whose session date or count is missing, with those left empty', () => {
    const { lifts } = buildTrainingState({ now: NOW, liftPRs: [{ ...bench, lastSessionDate: undefined, sessionCount: undefined }] });
    expect(lifts).toEqual([{ name: 'Bench Press', e1rm: 216, bestWeight: 185, bestReps: 5, lastSessionDate: null, sessions: null }]);
  });

  it('adds no unit to a weight and does not change it', () => {
    const { lifts } = buildTrainingState({ now: NOW, liftPRs: [{ ...bench, bestWeight: 82.5 }] });
    expect(lifts[0].bestWeight).toBe(82.5);
    expect(JSON.stringify(lifts)).not.toMatch(/\b(lb|lbs|kg|pounds|kilograms)\b/i);
  });

  describe('injuries', () => {
    const has = (injuries) => buildTrainingState({ now: NOW, injuries }).hasInjuries;

    it('records only whether any injury was reported, never which', () => {
      expect(has(['knee', 'lower_back'])).toBe(true);
      expect(JSON.stringify(buildTrainingState({ now: NOW, injuries: ['knee', 'lower_back'] }))).not.toMatch(/knee|lower_back/);
    });

    it('is false for none, and for anything that is not a list of injuries', () => {
      for (const injuries of [undefined, null, [], [''], ['  '], [null, 3, {}], 'knee', {}, 0]) expect(has(injuries)).toBe(false);
    });

    it('is true as soon as one is a real name', () => {
      expect(has(['', 'shoulder'])).toBe(true);
    });
  });

  describe('what is left out because it is not known', () => {
    it('says nothing about the workouts when there are none to count from, but says 0 when there are only old ones', () => {
      expect(buildTrainingState({ now: NOW, workouts: [] }).recentWorkouts).toBeNull();
      expect(buildTrainingState({ now: NOW }).recentWorkouts).toBeNull();
      expect(buildTrainingState({ now: NOW, workouts: [{ date: ago(40) }] }).recentWorkouts).toBe(0);
    });

    it('says nothing about muscles worked or muscle recovery when there is no history at all, and an empty list when there is history but nothing recent or everything has recovered', () => {
      const none = buildTrainingState({ now: NOW, recovery: {} });
      expect(none.musclesWorked).toBeNull();
      expect(none.muscleRecovery).toBeNull();
      for (const history of [{ workouts: [{ date: ago(40) }] }, { runs: [{ distance: 5 }] }, { hikes: [{ distance: 5 }] }]) {
        const state = buildTrainingState({ now: NOW, recovery: {}, ...history });
        expect(state.musclesWorked).toEqual([]);
        expect(state.muscleRecovery).toEqual([]);
      }
      expect(buildTrainingState({ now: NOW, workouts: [{ date: ago(40) }] }).muscleRecovery).toEqual([]);
      expect(buildTrainingState({ now: NOW, workouts: [{ date: ago(40) }], recovery: null }).muscleRecovery).toEqual([]);
      expect(buildTrainingState({ now: NOW, workouts: [{ date: ago(40) }], recovery: 'chest' }).muscleRecovery).toEqual([]);
    });

    it('leaves readiness out until it has a score', () => {
      const none = { hidden: true, ready: false, score: null, label: null };
      expect(buildTrainingState({ now: NOW, readiness: none }).readiness).toBeNull();
      expect(buildTrainingState({ now: NOW, readiness: { ...ready, ready: false } }).readiness).toBeNull();
      expect(buildTrainingState({ now: NOW, readiness: { ...ready, score: Number.NaN } }).readiness).toBeNull();
      expect(buildTrainingState({ now: NOW, readiness: null }).readiness).toBeNull();
    });

    it('keeps a readiness score without its label when the label is missing', () => {
      expect(buildTrainingState({ now: NOW, readiness: { ...ready, label: null } }).readiness).toEqual({ score: 71, label: null });
    });

    it('leaves the training load out until there is enough history for a ratio', () => {
      const thin = { acuteLoad: 10, chronicWeeklyAvg: 0, ratio: null, zone: 'insufficient_data', zoneLabel: 'Not enough history yet' };
      expect(buildTrainingState({ now: NOW, trainingLoad: thin }).trainingLoad).toBeNull();
      expect(buildTrainingState({ now: NOW, trainingLoad: { ...loaded, ratio: null } }).trainingLoad).toBeNull();
      expect(buildTrainingState({ now: NOW, trainingLoad: { ...thin, ratio: 1.2 } }).trainingLoad).toBeNull();
      expect(buildTrainingState({ now: NOW, trainingLoad: null }).trainingLoad).toBeNull();
    });

    it('does not throw for nothing at all, and says nothing', () => {
      const state = buildTrainingState();
      expect(state).toEqual({
        v: TRAINING_STATE_VERSION, recentWorkouts: null, musclesWorked: null, muscleRecovery: null, lifts: [], readiness: null, trainingLoad: null, hasInjuries: false,
      });
      expect(isEmptyTrainingState(state)).toBe(true);
    });
  });
});

describe('isEmptyTrainingState', () => {
  it('is true for nothing and for a state with every piece missing', () => {
    expect(isEmptyTrainingState(null)).toBe(true);
    expect(isEmptyTrainingState(undefined)).toBe(true);
    expect(isEmptyTrainingState('state')).toBe(true);
    expect(isEmptyTrainingState({})).toBe(true);
  });

  it('is false as soon as any one piece is known, even 0 workouts or an empty list of muscles', () => {
    expect(isEmptyTrainingState({ recentWorkouts: 0 })).toBe(false);
    expect(isEmptyTrainingState({ musclesWorked: [] })).toBe(false);
    expect(isEmptyTrainingState({ muscleRecovery: [] })).toBe(false);
    expect(isEmptyTrainingState({ lifts: [{ name: 'Squat' }] })).toBe(false);
    expect(isEmptyTrainingState({ readiness: { score: 40 } })).toBe(false);
    expect(isEmptyTrainingState({ trainingLoad: { zone: 'high', ratio: 1.6 } })).toBe(false);
  });

  it('does not count a reported injury as something to tell the AI', () => {
    expect(isEmptyTrainingState({ hasInjuries: true })).toBe(true);
  });
});

describe('coachTrainingFacts', () => {
  const state = {
    recentWorkouts: 6,
    musclesWorked: [{ muscle: 'chest', sessions: 4 }, { muscle: 'upper_back', sessions: 2.2 }],
    muscleRecovery: [{ muscle: 'upper_back', recovery: 12 }, { muscle: 'quadriceps', recovery: 41.6 }],
    readiness: { score: 71, label: 'Moderate' },
    hasInjuries: false,
  };

  it('puts the 14 days, the muscles worked, the muscle recovery and readiness in plain sentences', () => {
    expect(coachTrainingFacts(state)).toEqual({
      recent: 'Workouts logged in the last 14 days: 6.',
      worked: 'Muscles worked in the last 14 days, with how many workouts, runs or hikes worked each (how often, not how hard): Chest 4, Upper back 2.',
      recovery: 'Estimated muscle recovery right now (100 is fully recovered; worked out from logged sets with a simple model, not a measurement), ' +
        'lowest first, muscles not listed have no logged work still being recovered from: Upper back 12, Quadriceps 42.',
      readiness: "Readiness today: 71 of 100 (Moderate), a guide made from this person's own sleep, heart-rate and training-load readings. It is not medical advice.",
      injuries: null,
    });
  });

  it('says 0 for 14 days with no workouts when there is history to count from', () => {
    expect(coachTrainingFacts({ recentWorkouts: 0 }).recent).toBe('Workouts logged in the last 14 days: 0.');
  });

  it('says nothing was worked, rather than listing nothing, for a known empty list', () => {
    const facts = coachTrainingFacts({ musclesWorked: [], muscleRecovery: [] });
    expect(facts.worked).toBe('No muscles worked by logged workouts, runs or hikes in the last 14 days.');
    expect(facts.recovery).toBe('No muscle is still recovering from logged workouts, runs or hikes, by a simple estimate made from the logged sets.');
  });

  it('says nothing for a piece that is missing', () => {
    const none = { recent: null, worked: null, recovery: null, readiness: null, injuries: null };
    expect(coachTrainingFacts({ recentWorkouts: null, musclesWorked: null, muscleRecovery: null, readiness: null })).toEqual(none);
    expect(coachTrainingFacts({})).toEqual(none);
  });

  it('drops the label when there is none', () => {
    expect(coachTrainingFacts({ readiness: { score: 40, label: null } }).readiness).toMatch(/^Readiness today: 40 of 100, a guide/);
  });

  describe('a reported injury', () => {
    const injured = { ...state, hasInjuries: true };

    it('is said to come before the muscle figures, which is the last thing said', () => {
      expect(coachTrainingFacts(injured).injuries).toBe(
        'The injuries this person reported come before the muscle figures above: never suggest training an injured area because it shows as recovered, ' +
        'and do not advise on an injury beyond suggesting they see a professional.',
      );
    });

    it('is said beside either set of muscle figures', () => {
      expect(coachTrainingFacts({ musclesWorked: [], hasInjuries: true }).injuries).not.toBeNull();
      expect(coachTrainingFacts({ muscleRecovery: [{ muscle: 'chest', recovery: 50 }], hasInjuries: true }).injuries).not.toBeNull();
      expect(coachTrainingFacts({ muscleRecovery: [], hasInjuries: true }).injuries).not.toBeNull();
    });

    it('is not said when there are no muscle figures for it to come before', () => {
      expect(coachTrainingFacts({ recentWorkouts: 3, readiness: { score: 50 }, hasInjuries: true }).injuries).toBeNull();
      expect(coachTrainingFacts({ hasInjuries: true }).injuries).toBeNull();
    });

    it('is not said when no injury was reported, or when the flag is not exactly true', () => {
      for (const hasInjuries of [false, undefined, null, 'true', 1, ['knee']]) {
        expect(coachTrainingFacts({ ...state, hasInjuries }).injuries).toBeNull();
      }
    });
  });

  it('says nothing for a state that is not the right shape, and does not throw', () => {
    const none = { recent: null, worked: null, recovery: null, readiness: null, injuries: null };
    expect(coachTrainingFacts(null)).toEqual(none);
    expect(coachTrainingFacts('state')).toEqual(none);
    expect(coachTrainingFacts({ recentWorkouts: '3', musclesWorked: 'chest', muscleRecovery: 'chest', readiness: 'high' })).toEqual(none);
    expect(coachTrainingFacts({ recentWorkouts: -1, readiness: { score: Number.NaN } })).toEqual(none);
    const odd = [null, 7, { muscle: '', recovery: 5, sessions: 5 }, { muscle: 'chest', recovery: 'a lot', sessions: 'many' }];
    expect(coachTrainingFacts({ musclesWorked: odd, muscleRecovery: odd })).toMatchObject({
      worked: 'No muscles worked by logged workouts, runs or hikes in the last 14 days.',
      recovery: 'No muscle is still recovering from logged workouts, runs or hikes, by a simple estimate made from the logged sets.',
    });
  });

  it('never names a unit', () => {
    const { recent, worked, recovery, readiness } = coachTrainingFacts(state);
    expect(`${recent} ${worked} ${recovery} ${readiness}`).not.toMatch(/\b(lb|lbs|kg|pounds|kilograms)\b/i);
  });
});

describe('workoutPlanRequest', () => {
  const history = [{ name: 'Push', category: 'Strength', completedAt: '2026-10-22T10:00:00Z' }];
  const state = { v: 3, recentWorkouts: 2, musclesWorked: null, muscleRecovery: null, lifts: [], readiness: null, trainingLoad: null, hasInjuries: false };

  it('carries the level, goals, history and profile, with the training state when there is one', () => {
    expect(workoutPlanRequest({ fitnessLevel: 'intermediate', goals: ['strength'], history, profile: { daysPerWeek: 4 }, trainingState: state })).toEqual({
      fitnessLevel: 'intermediate', goals: ['strength'], history, profile: { daysPerWeek: 4 }, trainingState: state,
    });
  });

  it('is exactly the request it always was when there is no state', () => {
    for (const trainingState of [null, undefined]) {
      const request = workoutPlanRequest({ fitnessLevel: 'intermediate', goals: ['strength'], history, profile: { daysPerWeek: 4 }, trainingState });
      expect(request).toEqual({ fitnessLevel: 'intermediate', goals: ['strength'], history, profile: { daysPerWeek: 4 } });
      expect('trainingState' in request).toBe(false);
    }
  });

  it('keeps the old defaults: a beginner, no goals, no profile', () => {
    expect(workoutPlanRequest({ history: [] })).toEqual({ fitnessLevel: 'beginner', goals: [], history: [], profile: {} });
    expect(workoutPlanRequest({ fitnessLevel: '', goals: null, history: [], profile: null })).toEqual({ fitnessLevel: 'beginner', goals: [], history: [], profile: {} });
    expect(Object.keys(workoutPlanRequest())).toEqual(['fitnessLevel', 'goals', 'history', 'profile']);
  });
});

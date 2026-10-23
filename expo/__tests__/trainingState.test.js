// The training state the AI plan call and the Coach are told (lib/trainingState.js): what is counted over the last 14 days, what is left
// out when it is not known, how reported injuries are carried, and the Coach's sentences for it.
import {
  countWorkoutsSince, musclesWorkedSince, buildTrainingState, isEmptyTrainingState, coachTrainingFacts, workoutPlanRequest,
  TRAINING_STATE_VERSION, MAX_MUSCLES, MAX_LIFTS, RECENT_DAYS, MUSCLE_WINDOW_DAYS,
} from '../lib/trainingState';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-23T12:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const session = (days, ...groups) => ({ date: ago(days), exercises: groups.map((muscleGroups) => ({ muscleGroups })) });

const bench = { name: 'Bench Press', bestWeight: 185, bestReps: 5, bestE1RM: 216, bestDate: '2026-09-30', lastSessionDate: '2026-10-20', sessionCount: 12 };
const squat = { name: 'Squat', bestWeight: 225, bestReps: 3, bestE1RM: 248, bestDate: '2026-10-01', lastSessionDate: '2026-10-18', sessionCount: 9 };
const ready = { hidden: false, ready: true, score: 71.4, label: 'Moderate', used: 3, parts: [] };
const loaded = { acuteLoad: 900, chronicWeeklyAvg: 800, ratio: 1.13, zone: 'sweet_spot', zoneLabel: 'In your typical training range' };

it('looks back 14 days for workouts and muscles worked, and 5 for muscle load', () => {
  expect(RECENT_DAYS).toBe(14);
  expect(MUSCLE_WINDOW_DAYS).toBe(5);
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
    const workouts = [session(15, ['back']), { exercises: [{ muscleGroups: ['back'] }] }, session(13, ['legs'])];
    expect(musclesWorkedSince({ workouts, now: NOW })).toEqual([{ muscle: 'legs', sessions: 1 }]);
    expect(musclesWorkedSince({ workouts, now: NOW, days: 7 })).toEqual([]);
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
    fatigue: { pectorals: 100, triceps: 64.4, quadriceps: 40, calves: 0 },
    liftPRs: [bench, squat],
    readiness: ready,
    trainingLoad: loaded,
    injuries: ['shoulder'],
  });

  it('gathers the last 14 days, the muscles worked, the muscle load, the lifts, readiness, the training load and whether an injury was reported', () => {
    expect(everything()).toEqual({
      v: TRAINING_STATE_VERSION,
      recentWorkouts: 3,
      musclesWorked: [{ muscle: 'chest', sessions: 2 }, { muscle: 'quadriceps', sessions: 1 }, { muscle: 'triceps', sessions: 1 }],
      muscleLoad: [{ muscle: 'pectorals', load: 100 }, { muscle: 'triceps', load: 64 }, { muscle: 'quadriceps', load: 40 }],
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
    expect(TRAINING_STATE_VERSION).toBe(2);
  });

  it('keeps the most often worked muscles first and at most the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) => String.fromCharCode(97 + i));
    const { musclesWorked } = buildTrainingState({ now: NOW, workouts: [session(1, many), session(2, ['k'])] });
    expect(musclesWorked).toHaveLength(MAX_MUSCLES);
    expect(musclesWorked[0]).toEqual({ muscle: 'k', sessions: 2 });
  });

  it('keeps the heaviest-loaded muscles first and at most the limit, leaving out muscles with nothing on them', () => {
    const fatigue = {};
    for (let i = 0; i < 12; i += 1) fatigue[`muscle_${String.fromCharCode(97 + i)}`] = 50 + i;
    fatigue.rested = 0;
    fatigue.broken = Number.NaN;
    const { muscleLoad } = buildTrainingState({ now: NOW, workouts: [{ date: ago(1) }], fatigue });
    expect(muscleLoad).toHaveLength(MAX_MUSCLES);
    expect(muscleLoad[0]).toEqual({ muscle: 'muscle_l', load: 61 });
    expect(muscleLoad.map((m) => m.load)).toEqual([...muscleLoad.map((m) => m.load)].sort((a, b) => b - a));
    expect(muscleLoad.find((m) => m.muscle === 'rested' || m.muscle === 'broken')).toBeUndefined();
  });

  it('keeps the load of a lightly worked muscle at 1 and never above 100', () => {
    const { muscleLoad } = buildTrainingState({ now: NOW, workouts: [{ date: ago(1) }], fatigue: { calves: 0.4, core: 140 } });
    expect(muscleLoad).toEqual([{ muscle: 'core', load: 100 }, { muscle: 'calves', load: 1 }]);
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

    it('says nothing about muscles worked or muscle load when there is no history at all, and an empty list when there is history but nothing recent', () => {
      const none = buildTrainingState({ now: NOW, fatigue: {} });
      expect(none.musclesWorked).toBeNull();
      expect(none.muscleLoad).toBeNull();
      for (const history of [{ workouts: [{ date: ago(40) }] }, { runs: [{ distance: 5 }] }, { hikes: [{ distance: 5 }] }]) {
        const state = buildTrainingState({ now: NOW, fatigue: {}, ...history });
        expect(state.musclesWorked).toEqual([]);
        expect(state.muscleLoad).toEqual([]);
      }
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
        v: TRAINING_STATE_VERSION, recentWorkouts: null, musclesWorked: null, muscleLoad: null, lifts: [], readiness: null, trainingLoad: null, hasInjuries: false,
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
    expect(isEmptyTrainingState({ muscleLoad: [] })).toBe(false);
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
    muscleLoad: [{ muscle: 'upper_back', load: 100 }, { muscle: 'quadriceps', load: 41.6 }],
    readiness: { score: 71, label: 'Moderate' },
    hasInjuries: false,
  };

  it('puts the 14 days, the muscles worked, the muscle load and readiness in plain sentences', () => {
    expect(coachTrainingFacts(state)).toEqual({
      recent: 'Workouts logged in the last 14 days: 6.',
      worked: 'Muscles worked in the last 14 days, with how many workouts, runs or hikes worked each (how often, not how hard): Chest 4, Upper back 2.',
      load: 'Muscle load still being carried from the last 5 days, as a share of the most worked muscle (100 is the most worked of them, not a maximum): Upper back 100, Quadriceps 42.',
      readiness: "Readiness today: 71 of 100 (Moderate), a guide made from this person's own sleep, heart-rate and training-load readings. It is not medical advice.",
      injuries: null,
    });
  });

  it('says 0 for 14 days with no workouts when there is history to count from', () => {
    expect(coachTrainingFacts({ recentWorkouts: 0 }).recent).toBe('Workouts logged in the last 14 days: 0.');
  });

  it('says nothing was worked, rather than listing nothing, for a known empty list', () => {
    const facts = coachTrainingFacts({ musclesWorked: [], muscleLoad: [] });
    expect(facts.worked).toBe('No muscles worked by logged workouts, runs or hikes in the last 14 days.');
    expect(facts.load).toBe('No muscle load from logged workouts, runs or hikes in the last 5 days.');
  });

  it('says nothing for a piece that is missing', () => {
    const none = { recent: null, worked: null, load: null, readiness: null, injuries: null };
    expect(coachTrainingFacts({ recentWorkouts: null, musclesWorked: null, muscleLoad: null, readiness: null })).toEqual(none);
    expect(coachTrainingFacts({})).toEqual(none);
  });

  it('drops the label when there is none', () => {
    expect(coachTrainingFacts({ readiness: { score: 40, label: null } }).readiness).toMatch(/^Readiness today: 40 of 100, a guide/);
  });

  describe('a reported injury', () => {
    const injured = { ...state, hasInjuries: true };

    it('is said to come before the muscle figures, which is the last thing said', () => {
      expect(coachTrainingFacts(injured).injuries).toBe(
        'The injuries this person reported come before the muscle figures above: never suggest training an injured area because it shows little recent load, ' +
        'and do not advise on an injury beyond suggesting they see a professional.',
      );
    });

    it('is said beside either set of muscle figures', () => {
      expect(coachTrainingFacts({ musclesWorked: [], hasInjuries: true }).injuries).not.toBeNull();
      expect(coachTrainingFacts({ muscleLoad: [{ muscle: 'chest', load: 50 }], hasInjuries: true }).injuries).not.toBeNull();
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
    const none = { recent: null, worked: null, load: null, readiness: null, injuries: null };
    expect(coachTrainingFacts(null)).toEqual(none);
    expect(coachTrainingFacts('state')).toEqual(none);
    expect(coachTrainingFacts({ recentWorkouts: '3', musclesWorked: 'chest', muscleLoad: 'chest', readiness: 'high' })).toEqual(none);
    expect(coachTrainingFacts({ recentWorkouts: -1, readiness: { score: Number.NaN } })).toEqual(none);
    const odd = [null, 7, { muscle: '', load: 5, sessions: 5 }, { muscle: 'chest', load: 'a lot', sessions: 'many' }];
    expect(coachTrainingFacts({ musclesWorked: odd, muscleLoad: odd })).toMatchObject({
      worked: 'No muscles worked by logged workouts, runs or hikes in the last 14 days.',
      load: 'No muscle load from logged workouts, runs or hikes in the last 5 days.',
    });
  });

  it('never names a unit', () => {
    const { recent, worked, load, readiness } = coachTrainingFacts(state);
    expect(`${recent} ${worked} ${load} ${readiness}`).not.toMatch(/\b(lb|lbs|kg|pounds|kilograms)\b/i);
  });
});

describe('workoutPlanRequest', () => {
  const history = [{ name: 'Push', category: 'Strength', completedAt: '2026-10-22T10:00:00Z' }];
  const state = { v: 2, recentWorkouts: 2, musclesWorked: null, muscleLoad: null, lifts: [], readiness: null, trainingLoad: null, hasInjuries: false };

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

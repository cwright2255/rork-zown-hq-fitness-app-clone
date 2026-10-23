// Twelve weeks of made-up lifters following the picker (lib/sessionPicker.js): each session is picked from the recovery, the weekly sets and the
// ladder rungs that the earlier sessions left behind (the real muscle recovery of lib/muscleRecovery.js, not a stand-in), "done" exactly as picked,
// and logged. What is checked is what must hold on every day whatever the rules' numbers are: never an exercise a rested-enough muscle cannot take,
// never over the weekly limit, never an injured area, never more time than was asked for. The few outcome checks (every large muscle is worked)
// are floors a long way under the aim, there to notice a change that breaks the picker, not to prove that it is good.
import { pickSession, weeklyVolume, currentRungs, SESSION_RULES, EQUIPMENT_PRESETS } from '../lib/sessionPicker';
import { calculateMuscleRecovery } from '../lib/muscleRecovery';
import { blockedBy } from '../lib/injuryRules';
import { getExercise } from '../lib/exerciseLibrary';
import { MUSCLES } from '../lib/muscleVocabulary';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 7, 3, 18, 0, 0); // a Monday evening
const BIG = ['chest', 'lats', 'upper_back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes'];
// The most a muscle may reach this week, worked out apart from the picker: 10% over the week before, at least 10, at most 20.
const capFor = (lastWeek) => Math.min(20, Math.max(10, Math.ceil((lastWeek || 0) * 1.1 - 1e-9)));

/** Follows the picker: on each training day, picks from the history so far and logs what was picked (every set at effort `rpe`). */
function simulate({ weeks = 12, days = [0, 2, 4], skipWeeks = [], rpe = 'hard', ...options }) {
  const history = [];
  const log = [];
  for (let w = 0; w < weeks; w += 1) {
    if (!skipWeeks.includes(w)) {
      days.forEach((d) => {
        const now = new Date(START + (7 * w + d) * DAY);
        const recovery = calculateMuscleRecovery({ completedWorkouts: history, now });
        const volume = weeklyVolume({ workouts: history, now });
        const session = pickSession({ ...options, recovery, volume, ladderRungs: currentRungs(history) });
        let after = null;
        if (session.status === 'ok') {
          history.push({
            completedAt: now.toISOString(),
            exercises: session.exercises.map((x) => ({ name: x.name, sets: x.sets, done: true, performed: Array.from({ length: x.sets }, () => ({ weight: 50, reps: 10, rpe })) })),
          });
          after = weeklyVolume({ workouts: history, now });
        }
        log.push({ w, d, now, session, recovery, volume, after });
      });
    }
  }
  return { history, log };
}

const LIFTERS = {
  'a beginner with a gym, 30 minutes, general fitness': { level: 'beginner', goal: 'general', minutes: 30 },
  'an intermediate lifter, 45 minutes, building muscle': { level: 'intermediate', goal: 'muscle', minutes: 45 },
  'an advanced lifter, 60 minutes, strength': { level: 'advanced', goal: 'strength', minutes: 60 },
  'a lifter with dumbbells and a bench': { level: 'intermediate', goal: 'muscle', minutes: 45, equipment: 'dumbbells' },
  'a beginner with no equipment': { level: 'beginner', goal: 'general', minutes: 30, equipment: 'bodyweight' },
  'a lifter with 15 minutes': { level: 'intermediate', goal: 'muscle', minutes: 15 },
  'a lifter protecting a shoulder and a knee': { level: 'intermediate', goal: 'muscle', minutes: 45, injuries: ['shoulder', 'knee'] },
  'a lifter protecting a lower back and a wrist, with dumbbells': { level: 'intermediate', goal: 'strength', minutes: 45, equipment: 'dumbbells', injuries: ['lower_back', 'wrist'] },
  'a lifter who rates every set OK': { level: 'intermediate', goal: 'muscle', minutes: 45, rpe: 'moderate' },
  'a lifter who rates every set Easy': { level: 'intermediate', goal: 'muscle', minutes: 45, rpe: 'easy' },
  'a lifter who trains every day for six weeks': { level: 'intermediate', goal: 'muscle', minutes: 45, days: [0, 1, 2, 3, 4, 5, 6], weeks: 6 },
  'a lifter who trains twice a week': { level: 'intermediate', goal: 'general', minutes: 45, days: [1, 4] },
  'a lifter who is away for three weeks': { level: 'intermediate', goal: 'muscle', minutes: 45, skipWeeks: [4, 5, 6], weeks: 10 },
};

const cache = new Map();
const run = (label) => {
  if (!cache.has(label)) cache.set(label, simulate(LIFTERS[label]));
  return cache.get(label);
};

describe.each(Object.keys(LIFTERS))('%s', (label) => {
  const options = LIFTERS[label];

  it('is given a session on almost every training day, and only ever "ok", "rest" or "full"', () => {
    const { log } = run(label);
    log.forEach((l) => expect(['ok', 'rest', 'full']).toContain(l.session.status));
    expect(log.filter((l) => l.session.status === 'ok').length).toBeGreaterThanOrEqual(Math.floor(log.length * 0.8));
  });

  it('only picks exercises whose main muscles were at least 70% recovered that day', () => {
    run(label).log.forEach((l) => l.session.exercises.forEach((x) => x.primary.forEach((m) => {
      const recovered = Number.isFinite(l.recovery[m]) ? l.recovery[m] : 100;
      expect(recovered).toBeGreaterThanOrEqual(SESSION_RULES.readyRecovery);
    })));
  });

  it('never uses more time than it was given, nor fewer than 2 sets of anything, nor more than 8 exercises', () => {
    run(label).log.forEach((l) => {
      expect(l.session.minutes).toBeLessThanOrEqual(options.minutes);
      expect(l.session.exercises.length).toBeLessThanOrEqual(SESSION_RULES.maxExercises);
      l.session.exercises.forEach((x) => expect(x.sets).toBeGreaterThanOrEqual(SESSION_RULES.minSets));
    });
  });

  it('never takes a muscle past 20 effective sets in 7 days, nor past 10% over the week before (10 at the least)', () => {
    run(label).log.filter((l) => l.after).forEach((l) => {
      const touched = new Set(l.session.exercises.flatMap((x) => [...x.primary, ...x.secondary]));
      MUSCLES.forEach((m) => expect(l.after.thisWeek[m] || 0).toBeLessThanOrEqual(20 + 1e-9));
      touched.forEach((m) => expect(l.after.thisWeek[m] || 0).toBeLessThanOrEqual(capFor(l.volume.lastWeek[m]) + 1e-9));
    });
  });

  it('only uses the equipment it has', () => {
    const have = new Set(options.equipment === undefined ? EQUIPMENT_PRESETS.gym : EQUIPMENT_PRESETS[options.equipment]);
    run(label).log.forEach((l) => l.session.exercises.forEach((x) => getExercise(x.id).equipment.forEach((q) => {
      expect(q === 'bodyweight' || have.has(q)).toBe(true);
    })));
  });

  it('never picks anything the reported injuries rule out, and says which injuries took something out', () => {
    const injuries = options.injuries || [];
    run(label).log.filter((l) => l.session.status === 'ok').forEach((l) => {
      l.session.exercises.forEach((x) => expect(blockedBy(getExercise(x.id), injuries)).toEqual([]));
      if (injuries.length === 0) expect(l.session.leftOutFor).toEqual([]);
      else {
        expect(l.session.leftOutFor.length).toBeGreaterThan(0);
        l.session.leftOutFor.forEach((id) => expect(injuries).toContain(id));
      }
    });
  });

  it('gives the same twelve weeks when it is run again', () => {
    const again = simulate(options);
    expect(again.log.map((l) => [l.session.status, l.session.name, l.session.exercises.map((x) => `${x.id}x${x.sets}`)]))
      .toEqual(run(label).log.map((l) => [l.session.status, l.session.name, l.session.exercises.map((x) => `${x.id}x${x.sets}`)]));
  });
});

describe('what a lifter gets over the weeks', () => {
  // Effective sets in the 7 days to each Friday's session (counting it), from week 4 on.
  const weeklySets = (label) => {
    const { log } = run(label);
    const out = {};
    log.filter((l) => l.w >= 3 && l.d === 4 && l.after).forEach((l) => MUSCLES.forEach((m) => { (out[m] = out[m] || []).push(l.after.thisWeek[m] || 0); }));
    return out;
  };

  it.each([
    'a beginner with a gym, 30 minutes, general fitness',
    'an intermediate lifter, 45 minutes, building muscle',
    'an advanced lifter, 60 minutes, strength',
    'a lifter with dumbbells and a bench',
  ])('works every large muscle at least 6 effective sets a week: %s', (label) => {
    const sets = weeklySets(label);
    BIG.forEach((m) => expect(Math.min(...sets[m])).toBeGreaterThanOrEqual(6));
  });

  it('does not pile on one muscle week after week: for a beginner and an intermediate lifter no muscle averages over 18 effective sets', () => {
    ['an intermediate lifter, 45 minutes, building muscle', 'a beginner with a gym, 30 minutes, general fitness'].forEach((label) => {
      const sets = weeklySets(label);
      MUSCLES.forEach((m) => {
        const mean = sets[m].reduce((a, b) => a + b, 0) / sets[m].length;
        expect(mean).toBeLessThanOrEqual(18);
      });
    });
  });

  it('varies the exercises: a 45-minute lifter uses at least 12 different ones in 12 weeks, a 60-minute advanced lifter at least 15', () => {
    const distinct = (label) => new Set(run(label).log.flatMap((l) => l.session.exercises.map((x) => x.id))).size;
    expect(distinct('an intermediate lifter, 45 minutes, building muscle')).toBeGreaterThanOrEqual(12);
    expect(distinct('an advanced lifter, 60 minutes, strength')).toBeGreaterThanOrEqual(15);
  });

  it('keeps a bodyweight lifter on the ladder rung they log: moving up is the load rules\' hint on the workout card, not a change of exercise', () => {
    const { log, history } = run('a beginner with no equipment');
    const pushes = log.flatMap((l) => l.session.exercises).filter((x) => getExercise(x.id).ladder && getExercise(x.id).ladder.name === 'push');
    expect(pushes.length).toBeGreaterThan(10);
    pushes.forEach((x) => expect(x.id).toBe('wall-push-up'));
    expect(currentRungs(history).push).toBe(1);
  });

  it('starts a lifter coming back after three weeks away on 10 effective sets or fewer for every muscle in the first week', () => {
    const { log } = run('a lifter who is away for three weeks');
    expect(log.filter((l) => l.w === 4 || l.w === 5 || l.w === 6)).toEqual([]);
    const back = log.filter((l) => l.w === 7);
    expect(back).toHaveLength(3);
    expect(back[0].session.status).toBe('ok');
    expect(back[0].volume.lastWeek).toEqual({}); // so the cap is the 10-set floor
    back.forEach((l) => MUSCLES.forEach((m) => expect(l.after.thisWeek[m] || 0).toBeLessThanOrEqual(10 + 1e-9)));
  });
});

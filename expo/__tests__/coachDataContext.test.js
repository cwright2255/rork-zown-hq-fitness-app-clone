// The data message the Coach (and the Today brief) are given (services/coachService.js buildUserDataContext), with the training state
// (lib/trainingState.js) added: the last 14 days' workouts and the muscles they worked, the muscle load still carried, readiness and, when
// an injury was reported, that it comes first. A caller that passes no state must get the message it always got, word for word.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}));

import { buildUserDataContext } from '../services/coachService';

const liftPRs = [{ name: 'Bench Press', bestWeight: 185, bestReps: 5, bestE1RM: 216, bestDate: '2026-09-30', lastSessionDate: '2026-10-20', sessionCount: 12 }];
const cardioVolume = { days: 7, runCount: 2, runKm: 10.5, hikeCount: 1, hikeKm: 6 };
const trainingLoad = { acuteLoad: 900, chronicWeeklyAvg: 800, ratio: 1.13, zone: 'sweet_spot', zoneLabel: 'In your typical training range' };
const base = { liftPRs, cardioVolume, monthlyWorkoutCount: 11, trainingLoad };

const trainingState = {
  v: 2,
  recentWorkouts: 6,
  musclesWorked: [{ muscle: 'pectorals', sessions: 4 }, { muscle: 'triceps', sessions: 3 }],
  muscleLoad: [{ muscle: 'pectorals', load: 100 }, { muscle: 'triceps', load: 64 }],
  lifts: [{ name: 'Bench Press', e1rm: 216, bestWeight: 185, bestReps: 5, lastSessionDate: '2026-10-20', sessions: 12 }],
  readiness: { score: 71, label: 'Moderate' },
  trainingLoad: { zone: 'sweet_spot', ratio: 1.13 },
  hasInjuries: false,
};

const RECENT = 'Workouts logged in the last 14 days: 6.';
const WORKED = 'Muscles worked in the last 14 days, with how many workouts, runs or hikes worked each (how often, not how hard): Pectorals 4, Triceps 3.';
const LOAD = 'Muscle load still being carried from the last 5 days, as a share of the most worked muscle (100 is the most worked of them, not a maximum): Pectorals 100, Triceps 64.';
const INJURIES = 'The injuries this person reported come before the muscle figures above: never suggest training an injured area because it shows little recent load, and do not advise on an injury beyond suggesting they see a professional.';
const READINESS = "Readiness today: 71 of 100 (Moderate), a guide made from this person's own sleep, heart-rate and training-load readings. It is not medical advice.";

const text = (params) => buildUserDataContext(params).content;

describe('buildUserDataContext with no training state', () => {
  it('is the same message the Coach has always been given', () => {
    expect(buildUserDataContext(base)).toEqual({
      role: 'system',
      content:
        "Here is this user's real, current logged data. Only cite specific numbers or dates from this message - " +
        "if asked about something not covered here, say you don't have that logged rather than guessing or estimating. " +
        'Workouts logged in the last 30 days: 11. ' +
        'Primary lift history: Bench Press - best 185 lb x 5 (est. 1RM ~216 lb) on 2026-09-30, most recent session 2026-10-20, 12 sessions logged. ' +
        'Last 7 days: 2 run(s) totaling 10.5 km, 1 hike(s) totaling 6 km. ' +
        'Current training load: In your typical training range (acute:chronic ratio 1.13).',
    });
  });

  it('is unchanged by a state of null, undefined or the wrong type', () => {
    const plain = text(base);
    expect(text({ ...base, trainingState: null })).toBe(plain);
    expect(text({ ...base, trainingState: undefined })).toBe(plain);
    expect(text({ ...base, trainingState: 'ready' })).toBe(plain);
    expect(text({ ...base, trainingState: [] })).toBe(plain);
    expect(text({ ...base, trainingState: {} })).toBe(plain);
  });

  it('is unchanged for a state with every piece unknown', () => {
    expect(text({
      ...base,
      trainingState: { v: 2, recentWorkouts: null, musclesWorked: null, muscleLoad: null, lifts: [], readiness: null, trainingLoad: null, hasInjuries: false },
    })).toBe(text(base));
  });

  it('still builds with nothing passed at all', () => {
    expect(text()).toMatch(/No logged history yet for Squat, Bench Press, or Deadlift specifically\.$/);
  });
});

describe('buildUserDataContext with a training state', () => {
  it('adds the 14 days after the 30, and the muscles worked, the muscle load and readiness after the training load', () => {
    const out = text({ ...base, trainingState });
    for (const line of [RECENT, WORKED, LOAD, READINESS]) expect(out).toContain(line);
    expect(out.indexOf('Workouts logged in the last 30 days: 11.')).toBeLessThan(out.indexOf(RECENT));
    expect(out.indexOf(RECENT)).toBeLessThan(out.indexOf('Primary lift history:'));
    expect(out.indexOf('Current training load:')).toBeLessThan(out.indexOf(WORKED));
    expect(out.indexOf(WORKED)).toBeLessThan(out.indexOf(LOAD));
    expect(out.indexOf(LOAD)).toBeLessThan(out.indexOf(READINESS));
  });

  it('keeps everything it said before, in the same words', () => {
    const plain = text(base);
    const withState = text({ ...base, trainingState });
    const without = withState.replace(` ${RECENT}`, '').replace(` ${WORKED}`, '').replace(` ${LOAD}`, '').replace(` ${READINESS}`, '');
    expect(without).toBe(plain);
  });

  it('does not repeat the lift records or the training load it already carries', () => {
    const out = text({ ...base, trainingState });
    expect(out.match(/Bench Press/g)).toHaveLength(1);
    expect(out.match(/Current training load/g)).toHaveLength(1);
    expect(out.match(/Primary lift history/g)).toHaveLength(1);
  });

  it('adds only the pieces that are known', () => {
    const onlyRecent = text({ ...base, trainingState: { ...trainingState, musclesWorked: null, muscleLoad: null, readiness: null } });
    expect(onlyRecent).toContain(RECENT);
    expect(onlyRecent).not.toContain('Muscles worked');
    expect(onlyRecent).not.toContain('Muscle load');
    expect(onlyRecent).not.toContain('Readiness today');

    const onlyReadiness = text({ ...base, trainingState: { readiness: { score: 40, label: 'Low' } } });
    expect(onlyReadiness).toContain('Readiness today: 40 of 100 (Low)');
    expect(onlyReadiness).not.toContain('Workouts logged in the last 14 days');
  });

  it('says nothing was worked, rather than leaving it out, when the lists are known to be empty', () => {
    const out = text({ ...base, trainingState: { musclesWorked: [], muscleLoad: [] } });
    expect(out).toContain('No muscles worked by logged workouts, runs or hikes in the last 14 days.');
    expect(out).toContain('No muscle load from logged workouts, runs or hikes in the last 5 days.');
  });

  describe('a reported injury', () => {
    it('is said to come before the muscle figures, as the last thing the state adds', () => {
      const out = text({ ...base, trainingState: { ...trainingState, hasInjuries: true } });
      expect(out).toContain(INJURIES);
      expect(out.indexOf(READINESS)).toBeLessThan(out.indexOf(INJURIES));
      expect(out.endsWith(INJURIES)).toBe(true);
    });

    it('is not said when none was reported', () => {
      expect(text({ ...base, trainingState })).not.toContain('injuries');
      expect(text({ ...base, trainingState: { ...trainingState, hasInjuries: false } })).not.toContain('reported');
    });

    it('is not said when there are no muscle figures for it to come before', () => {
      expect(text({ ...base, trainingState: { recentWorkouts: 3, hasInjuries: true } })).not.toContain('injuries');
    });

    it('does not change the message when there is no state at all', () => {
      expect(text({ ...base, trainingState: { hasInjuries: true } })).toBe(text(base));
    });
  });

  it('puts the readiness line in even when the training load is not known yet', () => {
    const out = text({ liftPRs, trainingLoad: { zone: 'insufficient_data' }, trainingState });
    expect(out).not.toContain('Current training load');
    expect(out).toContain(WORKED);
    expect(out).toContain(LOAD);
    expect(out).toContain(READINESS);
  });

  it('is still a single system message', () => {
    const msg = buildUserDataContext({ ...base, trainingState });
    expect(msg.role).toBe('system');
    expect(typeof msg.content).toBe('string');
  });

  it('does not throw for a state of the wrong shape, and leaves it out', () => {
    const odd = { recentWorkouts: 'three', musclesWorked: { chest: 4 }, muscleLoad: { chest: 90 }, readiness: 'high', hasInjuries: true };
    expect(() => text({ ...base, trainingState: odd })).not.toThrow();
    expect(text({ ...base, trainingState: odd })).toBe(text(base));
  });
});

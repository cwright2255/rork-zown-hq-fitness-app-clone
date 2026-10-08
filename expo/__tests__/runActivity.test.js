import {
  ACTIVITIES, activityOf, caloriesFor, xpFor, buildSavedRun, personalRecords, summarizeRuns,
} from '../lib/runStats';
import { createTracker, startTracker, shouldAdoptSession, pauseTracker, ADOPT_WITHIN_MS } from '../lib/runTracker';
import { useRunTrackerStore } from '../store/runTrackerStore';

const T0 = 1_700_000_000_000;

describe('activity rates', () => {
  it('a walk burns and earns less per kilometre than a run', () => {
    expect(ACTIVITIES.walk.kcalPerKm).toBeLessThan(ACTIVITIES.run.kcalPerKm);
    expect(ACTIVITIES.walk.xpPerKm).toBeLessThan(ACTIVITIES.run.xpPerKm);
  });

  it('works out calories and XP, rounded', () => {
    expect(caloriesFor('run', 5)).toBe(350);
    expect(caloriesFor('walk', 5)).toBe(200);
    expect(caloriesFor('run', 2.345)).toBe(164);
    expect(xpFor('run', 5)).toBe(150);
    expect(xpFor('walk', 5)).toBe(90);
  });

  it('treats anything unknown as a run, and never goes negative', () => {
    expect(caloriesFor('cycling', 2)).toBe(140);
    expect(caloriesFor(undefined, 2)).toBe(140);
    expect(caloriesFor('run', -3)).toBe(0);
    expect(xpFor('walk', NaN)).toBe(0);
  });

  it('activityOf: only a walk is a walk', () => {
    expect(activityOf({ activity: 'walk' })).toBe('walk');
    expect(activityOf({ activity: 'run' })).toBe('run');
    expect(activityOf({})).toBe('run');
    expect(activityOf(null)).toBe('run');
  });
});

describe('saving a walk', () => {
  const now = Date.UTC(2026, 9, 8, 12);
  it('keeps the activity for a walk and leaves runs exactly as before', () => {
    const walk = buildSavedRun(null, { distance: 2, duration: 1500, activity: 'walk' }, { now });
    expect(walk.activity).toBe('walk');
    const run = buildSavedRun(null, { distance: 2, duration: 600, activity: 'run' }, { now });
    expect('activity' in run).toBe(false);
    const plain = buildSavedRun(null, { distance: 2, duration: 600 }, { now });
    expect('activity' in plain).toBe(false);
  });
});

describe('walks and the running records', () => {
  const run5 = { id: 'r1', endTime: '2026-10-01T10:00:00Z', distance: 5, duration: 1500 };
  const run10 = { id: 'r2', endTime: '2026-10-02T10:00:00Z', distance: 10, duration: 3300 };
  const longWalk = { id: 'w1', endTime: '2026-10-03T10:00:00Z', distance: 15, duration: 10800, activity: 'walk' };
  const quickWalk = { id: 'w2', endTime: '2026-10-04T10:00:00Z', distance: 1.2, duration: 200, activity: 'walk' };

  it('a walk never sets the longest run, the fastest pace or the 5K', () => {
    const p = personalRecords([run5, run10, longWalk, quickWalk]);
    expect(p.longestRun.id).toBe('r2');
    expect(p.fastestPace.id).toBe('r1'); // 5 km in 25:00 is quicker per km than 10 km in 55:00
    expect(p.best5k.id).toBe('r1');
  });

  it('but it counts toward total distance', () => {
    expect(personalRecords([run5, longWalk]).totalDistance).toBe(20);
  });

  it('someone who has only walked has distance and no running records', () => {
    expect(personalRecords([longWalk])).toEqual({ longestRun: null, fastestPace: null, best5k: null, totalDistance: 15 });
  });

  it('the log totals count every outing but average pace comes from runs', () => {
    const s = summarizeRuns([run5, longWalk]);
    expect(s.totalRuns).toBe(2);
    expect(s.totalDistance).toBe(20);
    expect(s.avgPace).toBeCloseTo(300, 5); // the run alone: 1500 s over 5 km
  });

  it('with only walks, the pace is the walks', () => {
    expect(summarizeRuns([longWalk]).avgPace).toBeCloseTo(720, 5);
    expect(summarizeRuns([]).avgPace).toBe(0);
  });
});

describe('a left-behind run is only picked up as the same kind of outing', () => {
  const left = (kind) => pauseTracker(startTracker(createTracker({ autoPause: true, kind }), T0), T0 + 1000);

  it('a tracker remembers its kind, and a restart keeps it', () => {
    expect(createTracker({ kind: 'walk' }).kind).toBe('walk');
    expect(createTracker().kind).toBe('');
    expect(startTracker(createTracker({ kind: 'walk' }), T0).kind).toBe('walk');
  });

  it('adopts a recent one of the same kind', () => {
    expect(shouldAdoptSession(left('run'), T0 + 60000, 'run')).toBe(true);
  });

  it('does not adopt one of another kind', () => {
    expect(shouldAdoptSession(left('run'), T0 + 60000, 'walk')).toBe(false);
    expect(shouldAdoptSession(left('walk'), T0 + 60000, 'run')).toBe(false);
    expect(shouldAdoptSession(left('c25k:1:0'), T0 + 60000, 'run')).toBe(false);
    expect(shouldAdoptSession(left('c25k:1:0'), T0 + 60000, 'c25k:1:1')).toBe(false);
  });

  it('adopts any kind when none is asked for, as before', () => {
    expect(shouldAdoptSession(left('walk'), T0 + 60000)).toBe(true);
    expect(shouldAdoptSession(left('walk'), T0 + 60000, null)).toBe(true);
  });

  it('still refuses an old or idle one', () => {
    expect(shouldAdoptSession(left('run'), T0 + ADOPT_WITHIN_MS + 5000, 'run')).toBe(false);
    expect(shouldAdoptSession(createTracker({ kind: 'run' }), T0, 'run')).toBe(false);
    expect(shouldAdoptSession(null, T0, 'run')).toBe(false);
  });

  describe('in the store', () => {
    beforeEach(() => useRunTrackerStore.getState().reset());

    it('starts a fresh walk instead of picking up a paused run', () => {
      const s = () => useRunTrackerStore.getState();
      expect(s().begin({ kind: 'run', now: T0 })).toBe('new');
      s().pause(T0 + 5000);
      expect(s().begin({ kind: 'walk', now: T0 + 60000 })).toBe('new');
      expect(s().tracker.kind).toBe('walk');
      expect(s().tracker.status).toBe('running');
      expect(s().tracker.startedAt).toBe(T0 + 60000);
    });

    it('still picks up a paused run of the same kind', () => {
      const s = () => useRunTrackerStore.getState();
      s().begin({ kind: 'walk', now: T0 });
      s().pause(T0 + 5000);
      expect(s().begin({ kind: 'walk', now: T0 + 60000 })).toBe('resumed');
      expect(s().tracker.startedAt).toBe(T0);
    });
  });
});

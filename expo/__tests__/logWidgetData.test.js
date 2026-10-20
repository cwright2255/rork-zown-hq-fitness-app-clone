// What the Workout History and Running Log cards on Home say (lib/logWidgetData.js). jest.global-setup.js pins the time zone to
// America/New_York.
import { LOG_PERIODS, hoursMinutes, runningLogSummary, workoutHistorySummary } from '../lib/logWidgetData';

// Mon 19 Oct 2026, 8:00 AM in New York.
const NOW = new Date(2026, 9, 19, 8, 0);
const at = (y, m, d, h = 9, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const workout = (o = {}) => ({ id: 'w', name: 'Full Body', completedAt: at(2026, 10, 18), duration: 1800, caloriesBurned: 300, ...o });
const run = (o = {}) => ({ id: 'r', startTime: at(2026, 10, 18, 7), endTime: at(2026, 10, 18, 7, 30), distance: 5, duration: 1500, pace: 300, ...o });
const statsOf = (summary, key) => summary.pages.find((p) => p.key === key).stats.map((s) => s.value);

describe('the pages', () => {
  it('are the last 7 days, this month and everything logged, in that order', () => {
    expect(LOG_PERIODS.map((p) => p.key)).toEqual(['week', 'month', 'all']);
    expect(LOG_PERIODS.map((p) => p.title)).toEqual(['Last 7 days', 'This month', 'All logged']);
    expect(workoutHistorySummary({ workouts: [workout()], now: NOW }).pages.map((p) => p.title)).toEqual(['Last 7 days', 'This month', 'All logged']);
    expect(runningLogSummary({ runs: [run()], now: NOW }).pages.map((p) => p.key)).toEqual(['week', 'month', 'all']);
  });
});

describe('hoursMinutes', () => {
  it.each([
    [0, '0m'],
    [59, '0m'],
    [60, '1m'],
    [2700, '45m'],
    [3599, '59m'],
    [3600, '1h 0m'],
    [7500, '2h 5m'],
    [90061, '25h 1m'],
  ])('writes %s seconds as %s', (secs, text) => {
    expect(hoursMinutes(secs)).toBe(text);
  });

  it.each([[undefined], [null], [NaN], ['90'], [-5]])('writes %s as 0m rather than a broken number', (bad) => {
    expect(hoursMinutes(bad)).toBe('0m');
  });
});

describe('workoutHistorySummary', () => {
  const list = [
    workout({ id: 'a', name: 'Full Body', completedAt: at(2026, 10, 18), caloriesBurned: 300, duration: 1800 }), // yesterday
    workout({ id: 'b', name: 'Legs', completedAt: at(2026, 10, 14), caloriesBurned: 600, duration: 3600 }), // 5 days ago
    workout({ id: 'c', name: 'Arms', completedAt: at(2026, 10, 5), caloriesBurned: 200, duration: 3600 }), // 14 days ago, same month
    workout({ id: 'd', name: 'Core', completedAt: at(2026, 9, 28), caloriesBurned: 100, duration: 600 }), // last month
  ];

  it('adds up workouts, calories and time for each page', () => {
    const s = workoutHistorySummary({ workouts: list, now: NOW });
    expect(statsOf(s, 'week')).toEqual(['2', '900', '1h 30m']);
    expect(statsOf(s, 'month')).toEqual(['3', (1100).toLocaleString(), '2h 30m']);
    expect(statsOf(s, 'all')).toEqual(['4', (1200).toLocaleString(), '2h 40m']);
    expect(s.pages.map((p) => p.stats.map((x) => x.label))).toEqual([
      ['Workouts', 'Calories', 'Time'], ['Workouts', 'Calories', 'Time'], ['Workouts', 'Calories', 'Time'],
    ]);
    expect(s.pages.map((p) => p.right)).toEqual(['', '', '']);
    expect(s.total).toBe(4);
    expect(s.empty).toBe(false);
  });

  it('writes a thousand calories the way the full log does', () => {
    const s = workoutHistorySummary({ workouts: [workout({ caloriesBurned: 1250 })], now: NOW });
    expect(statsOf(s, 'all')[1]).toBe((1250).toLocaleString());
  });

  it('gives the same answer whichever way round the list comes (the server sends newest first, the phone keeps oldest first)', () => {
    const forward = workoutHistorySummary({ workouts: list, now: NOW });
    const backward = workoutHistorySummary({ workouts: [...list].reverse(), now: NOW });
    expect(backward.pages).toEqual(forward.pages);
    expect(backward.latest).toEqual(forward.latest);
    expect(forward.latest.title).toBe('Full Body');
  });

  describe('the edges of a page', () => {
    const sevenDaysBefore = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    it('counts a workout from exactly 7 days ago in the last 7 days, and one a moment older not', () => {
      const exactly = workoutHistorySummary({ workouts: [workout({ completedAt: sevenDaysBefore.toISOString() })], now: NOW });
      expect(statsOf(exactly, 'week')[0]).toBe('1');
      const older = workoutHistorySummary({ workouts: [workout({ completedAt: new Date(sevenDaysBefore.getTime() - 1).toISOString() })], now: NOW });
      expect(statsOf(older, 'week')[0]).toBe('0');
      expect(statsOf(older, 'month')[0]).toBe('1');
    });

    it('starts this month at midnight on the 1st', () => {
      const first = workoutHistorySummary({ workouts: [workout({ completedAt: at(2026, 10, 1, 0, 0) })], now: NOW });
      expect(statsOf(first, 'month')[0]).toBe('1');
      const before = workoutHistorySummary({ workouts: [workout({ completedAt: at(2026, 9, 30, 23, 59) })], now: NOW });
      expect(statsOf(before, 'month')[0]).toBe('0');
      expect(statsOf(before, 'all')[0]).toBe('1');
    });

    it('does not count October of another year as this month', () => {
      const s = workoutHistorySummary({ workouts: [workout({ completedAt: at(2025, 10, 18) })], now: NOW });
      expect(statsOf(s, 'month')[0]).toBe('0');
      expect(statsOf(s, 'week')[0]).toBe('0');
      expect(statsOf(s, 'all')[0]).toBe('1');
    });
  });

  describe('records that are not tidy', () => {
    it('reads the time from completedAt, then date, then timestamp', () => {
      const s = workoutHistorySummary({
        workouts: [
          workout({ id: '1', completedAt: at(2026, 10, 18), date: at(2026, 1, 1), timestamp: at(2026, 1, 2) }),
          workout({ id: '2', completedAt: undefined, date: at(2026, 10, 17), timestamp: at(2026, 1, 2) }),
          workout({ id: '3', completedAt: undefined, date: undefined, timestamp: at(2026, 10, 16) }),
        ],
        now: NOW,
      });
      expect(statsOf(s, 'week')[0]).toBe('3');
    });

    it('reads a time that is a Firestore Timestamp', () => {
      const stamp = { toDate: () => new Date(2026, 9, 17, 9, 0) };
      const s = workoutHistorySummary({ workouts: [workout({ completedAt: undefined, date: stamp })], now: NOW });
      expect(statsOf(s, 'week')[0]).toBe('1');
      expect(s.latest.when).toBe('Sat, Oct 17');
    });

    it.each([
      [{ timestamp: null }],
      [{ timestamp: '' }],
      [{ timestamp: false }],
      [{ timestamp: 0 }],
      [{ completedAt: true }],
      [{ completedAt: 'not a date' }],
      [{ completedAt: {} }],
      [{}],
    ])('counts a workout whose time is %j only under All logged, and never as the latest', (fields) => {
      const s = workoutHistorySummary({ workouts: [workout({ completedAt: undefined, date: undefined, timestamp: undefined, ...fields })], now: NOW });
      expect(statsOf(s, 'week')[0]).toBe('0');
      expect(statsOf(s, 'month')[0]).toBe('0');
      expect(statsOf(s, 'all')[0]).toBe('1');
      expect(s.latest).toBeNull();
      expect(s.empty).toBe(false);
    });

    it('skips entries that are not records, and does not count them', () => {
      const s = workoutHistorySummary({ workouts: [null, undefined, 'x', 7, workout()], now: NOW });
      expect(s.total).toBe(1);
      expect(statsOf(s, 'all')[0]).toBe('1');
    });

    it('adds up only numbers: a calorie count or a length that is not one is left out', () => {
      const s = workoutHistorySummary({
        workouts: [workout({ caloriesBurned: '300', duration: '1800' }), workout({ caloriesBurned: NaN, duration: undefined }), workout({ caloriesBurned: 120, duration: 600 })],
        now: NOW,
      });
      expect(statsOf(s, 'all')).toEqual(['3', '120', '10m']);
    });

    it('rounds calories to a whole number', () => {
      const s = workoutHistorySummary({ workouts: [workout({ caloriesBurned: 100.4 }), workout({ caloriesBurned: 100.4 })], now: NOW });
      expect(statsOf(s, 'all')[1]).toBe('201');
    });

    it.each([[undefined], [null], ['x'], [{}], [[]]])('is empty for %j', (bad) => {
      const s = workoutHistorySummary({ workouts: bad, now: NOW });
      expect(s.empty).toBe(true);
      expect(s.total).toBe(0);
      expect(s.latest).toBeNull();
      expect(s.sentence).toBe('Workout history: no workouts yet');
      expect(s.pages.map((p) => p.stats.map((x) => x.value))).toEqual([['0', '0', '0m'], ['0', '0', '0m'], ['0', '0', '0m']]);
    });

    it('can be called with nothing at all', () => {
      expect(workoutHistorySummary().empty).toBe(true);
    });
  });

  describe('the latest workout', () => {
    it('is the newest one, with its name and when', () => {
      const s = workoutHistorySummary({ workouts: list, now: NOW });
      expect(s.latest).toEqual({ title: 'Full Body', when: 'Yesterday', line: 'Full Body \u00B7 Yesterday' });
    });

    it.each([
      [at(2026, 10, 19, 6, 30), 'Today'],
      [at(2026, 10, 18, 23, 0), 'Yesterday'],
      [at(2026, 10, 17, 9, 0), 'Sat, Oct 17'],
      [at(2026, 10, 5, 9, 0), 'Mon, Oct 5'],
    ])('says a workout finished at %s was %s', (when, label) => {
      expect(workoutHistorySummary({ workouts: [workout({ completedAt: when })], now: NOW }).latest.when).toBe(label);
    });

    it('goes by the day the person lived it: 9 PM the day before is yesterday, though it is the next day in UTC', () => {
      const s = workoutHistorySummary({ workouts: [workout({ completedAt: at(2026, 10, 18, 21, 0) })], now: NOW });
      expect(s.latest.when).toBe('Yesterday');
    });

    it('takes the first of two finished at the same moment', () => {
      const same = at(2026, 10, 18);
      const s = workoutHistorySummary({ workouts: [workout({ name: 'First', completedAt: same }), workout({ name: 'Second', completedAt: same })], now: NOW });
      expect(s.latest.title).toBe('First');
    });

    it('trims the name, and calls an unnamed workout "Workout"', () => {
      expect(workoutHistorySummary({ workouts: [workout({ name: '  Push Day  ' })], now: NOW }).latest.title).toBe('Push Day');
      expect(workoutHistorySummary({ workouts: [workout({ name: '' })], now: NOW }).latest.title).toBe('Workout');
      expect(workoutHistorySummary({ workouts: [workout({ name: '   ' })], now: NOW }).latest.title).toBe('Workout');
      expect(workoutHistorySummary({ workouts: [workout({ name: undefined })], now: NOW }).latest.title).toBe('Workout');
      expect(workoutHistorySummary({ workouts: [workout({ name: 42 })], now: NOW }).latest.title).toBe('Workout');
    });
  });

  describe('the sentence', () => {
    it('says every page and the latest workout', () => {
      const s = workoutHistorySummary({ workouts: list, now: NOW });
      expect(s.sentence).toBe(
        `Workout history. Last 7 days: 2 workouts, 900 calories, 1h 30m. This month: 3 workouts, ${(1100).toLocaleString()} calories, 2h 30m. `
        + `All logged: 4 workouts, ${(1200).toLocaleString()} calories, 2h 40m. Latest: Full Body \u00B7 Yesterday`,
      );
    });

    it('says "1 workout" for one and "0 workouts" for none', () => {
      const s = workoutHistorySummary({ workouts: [workout({ completedAt: at(2026, 9, 1) })], now: NOW });
      expect(s.sentence).toContain('Last 7 days: 0 workouts,');
      expect(s.sentence).toContain('All logged: 1 workout,');
    });

    it('leaves out the latest when no workout has a time', () => {
      const s = workoutHistorySummary({ workouts: [workout({ completedAt: null, date: undefined, timestamp: undefined })], now: NOW });
      expect(s.sentence).toBe('Workout history. Last 7 days: 0 workouts, 0 calories, 0m. This month: 0 workouts, 0 calories, 0m. All logged: 1 workout, 300 calories, 30m');
    });
  });
});

describe('runningLogSummary', () => {
  const KM_PER_MILE = 1.609344;
  const runs = [
    run({ id: 'a', startTime: at(2026, 10, 18, 18), endTime: at(2026, 10, 18, 18, 25), distance: 5, duration: 1500, route: undefined }), // yesterday, evening
    run({ id: 'b', startTime: at(2026, 10, 14, 7), endTime: at(2026, 10, 14, 7, 50), distance: 10, duration: 3000 }), // 5 days ago
    run({ id: 'c', startTime: at(2026, 10, 5, 7), endTime: at(2026, 10, 5, 7, 30), distance: 5, duration: 1800 }), // 14 days ago, same month
    run({ id: 'd', startTime: at(2026, 9, 20, 7), endTime: at(2026, 9, 20, 7, 20), distance: 4, duration: 1200 }), // last month
  ];

  it('adds up distance, time and average pace for each page, in kilometres by default', () => {
    const s = runningLogSummary({ runs, now: NOW });
    expect(statsOf(s, 'week')).toEqual(['15.0 km', '1h 15m', '5:00 /km']);
    expect(statsOf(s, 'month')).toEqual(['20.0 km', '1h 45m', '5:15 /km']);
    expect(statsOf(s, 'all')).toEqual(['24.0 km', '2h 5m', '5:13 /km']);
    expect(s.pages.map((p) => p.stats.map((x) => x.label))).toEqual([
      ['Distance', 'Time', 'Avg pace'], ['Distance', 'Time', 'Avg pace'], ['Distance', 'Time', 'Avg pace'],
    ]);
    expect(s.pages.map((p) => p.right)).toEqual(['2 runs', '3 runs', '4 runs']);
    expect(s.total).toBe(4);
    expect(s.empty).toBe(false);
  });

  it('shows miles and a pace per mile when Settings says imperial, and kilometres for metric', () => {
    const imperial = runningLogSummary({ runs: [run({ distance: 5 * KM_PER_MILE, duration: 1500 })], units: 'imperial', now: NOW });
    expect(statsOf(imperial, 'week')).toEqual(['5.0 mi', '25m', '5:00 /mi']);
    const metric = runningLogSummary({ runs: [run({ distance: 5, duration: 1500 })], units: 'metric', now: NOW });
    expect(statsOf(metric, 'week')).toEqual(['5.0 km', '25m', '5:00 /km']);
    const none = runningLogSummary({ runs: [run({ distance: 5, duration: 1500 })], now: NOW });
    expect(statsOf(none, 'week')).toEqual(['5.0 km', '25m', '5:00 /km']);
  });

  it('gives the same answer whichever way round the list comes', () => {
    const forward = runningLogSummary({ runs, now: NOW });
    const backward = runningLogSummary({ runs: [...runs].reverse(), now: NOW });
    expect(backward.pages).toEqual(forward.pages);
    expect(backward.latest).toEqual(forward.latest);
  });

  describe('the edges of a page', () => {
    const sevenDaysBefore = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    it('counts a run that finished exactly 7 days ago in the last 7 days, and one a moment older not', () => {
      const exactly = runningLogSummary({ runs: [run({ endTime: sevenDaysBefore.toISOString() })], now: NOW });
      expect(exactly.pages[0].right).toBe('1 run');
      const older = runningLogSummary({ runs: [run({ endTime: new Date(sevenDaysBefore.getTime() - 1).toISOString() })], now: NOW });
      expect(older.pages[0].right).toBe('0 runs');
      expect(older.pages[1].right).toBe('1 run');
    });

    it('goes by when the run finished, and falls back to when it started', () => {
      const finished = runningLogSummary({ runs: [run({ startTime: at(2026, 10, 1, 7), endTime: at(2026, 10, 18, 7) })], now: NOW });
      expect(finished.pages[0].right).toBe('1 run');
      const started = runningLogSummary({ runs: [run({ startTime: at(2026, 10, 18, 7), endTime: undefined })], now: NOW });
      expect(started.pages[0].right).toBe('1 run');
    });

    it('does not count October of another year as this month', () => {
      const s = runningLogSummary({ runs: [run({ startTime: at(2025, 10, 18), endTime: at(2025, 10, 18, 1) })], now: NOW });
      expect(s.pages.map((p) => p.right)).toEqual(['0 runs', '0 runs', '1 run']);
    });
  });

  describe('records that are not tidy', () => {
    it('counts a run with no usable time only under All logged, and never as the latest', () => {
      const s = runningLogSummary({ runs: [run({ startTime: undefined, endTime: undefined })], now: NOW });
      expect(s.pages.map((p) => p.right)).toEqual(['0 runs', '0 runs', '1 run']);
      expect(s.latest).toBeNull();
      expect(s.empty).toBe(false);
    });

    it('skips entries that are not records', () => {
      const s = runningLogSummary({ runs: [null, undefined, 'x', run()], now: NOW });
      expect(s.total).toBe(1);
    });

    it.each([[undefined], [null], ['x'], [[]]])('is empty for %j, with a dash for the pace', (bad) => {
      const s = runningLogSummary({ runs: bad, now: NOW });
      expect(s.empty).toBe(true);
      expect(s.total).toBe(0);
      expect(s.latest).toBeNull();
      expect(s.sentence).toBe('Running log: no runs yet');
      expect(s.pages.map((p) => p.stats.map((x) => x.value))).toEqual([['0.0 km', '0m', '--'], ['0.0 km', '0m', '--'], ['0.0 km', '0m', '--']]);
      expect(s.pages.map((p) => p.right)).toEqual(['0 runs', '0 runs', '0 runs']);
    });

    it('can be called with nothing at all', () => {
      expect(runningLogSummary().empty).toBe(true);
    });

    it('shows a dash for the pace of a page with no run in it', () => {
      const s = runningLogSummary({ runs: [run({ startTime: at(2026, 9, 1), endTime: at(2026, 9, 1, 1) })], now: NOW });
      expect(statsOf(s, 'week')).toEqual(['0.0 km', '0m', '--']);
      expect(statsOf(s, 'all')[2]).not.toBe('--');
    });
  });

  describe('walks', () => {
    it('are counted as activities once any is saved, and a page average pace is of the runs in it when there are any', () => {
      const walk = run({ id: 'w', activity: 'walk', startTime: at(2026, 10, 18, 12), endTime: at(2026, 10, 18, 13), distance: 3, duration: 2700 });
      const s = runningLogSummary({ runs: [run(), walk], now: NOW });
      expect(s.pages.map((p) => p.right)).toEqual(['2 activities', '2 activities', '2 activities']);
      expect(statsOf(s, 'week')[2]).toBe('5:00 /km'); // the run's pace, not the walk's 15:00
    });

    it('says "1 activity" for one', () => {
      const s = runningLogSummary({ runs: [run({ activity: 'walk' })], now: NOW });
      expect(s.pages[0].right).toBe('1 activity');
    });

    it('uses the walks for the average pace when there is no run', () => {
      const s = runningLogSummary({ runs: [run({ activity: 'walk', distance: 3, duration: 2700 })], now: NOW });
      expect(statsOf(s, 'week')[2]).toBe('15:00 /km');
    });

    it('says "activities" on every page once a walk is saved anywhere, even one older than the page', () => {
      const old = run({ id: 'old', activity: 'walk', startTime: at(2026, 8, 1), endTime: at(2026, 8, 1, 1) });
      const s = runningLogSummary({ runs: [run(), old], now: NOW });
      expect(s.pages.map((p) => p.right)).toEqual(['1 activity', '1 activity', '2 activities']);
    });
  });

  describe('the latest run', () => {
    it('is the newest, named by the time of day it started and how far it went', () => {
      const s = runningLogSummary({ runs, now: NOW });
      expect(s.latest).toEqual({ title: 'Evening Run, 5.0 km', when: 'Yesterday', line: 'Evening Run, 5.0 km \u00B7 Yesterday' });
    });

    it('uses the name the person gave a route, in the shown unit', () => {
      const s = runningLogSummary({ runs: [run({ route: 'Canal loop', distance: 8.04672 })], units: 'imperial', now: NOW });
      expect(s.latest.title).toBe('Canal loop, 5.0 mi');
    });

    it('calls a walk a walk', () => {
      const s = runningLogSummary({ runs: [run({ activity: 'walk', startTime: at(2026, 10, 18, 7) })], now: NOW });
      expect(s.latest.title).toBe('Morning Walk, 5.0 km');
    });

    it('writes a distance that is missing as zero', () => {
      const s = runningLogSummary({ runs: [run({ distance: undefined })], now: NOW });
      expect(s.latest.title).toBe('Morning Run, 0.0 km');
    });

    it.each([
      [at(2026, 10, 19, 6, 30), 'Today'],
      [at(2026, 10, 18, 20, 0), 'Yesterday'],
      [at(2026, 10, 14, 7, 0), 'Wed, Oct 14'],
    ])('says a run that finished at %s was %s', (when, label) => {
      expect(runningLogSummary({ runs: [run({ endTime: when })], now: NOW }).latest.when).toBe(label);
    });

    it('takes the first of two that finished at the same moment', () => {
      const same = at(2026, 10, 18, 7, 30);
      const s = runningLogSummary({ runs: [run({ route: 'First', endTime: same }), run({ route: 'Second', endTime: same })], now: NOW });
      expect(s.latest.title).toContain('First');
    });
  });

  describe('the sentence', () => {
    it('says every page and the latest run', () => {
      const s = runningLogSummary({ runs, now: NOW });
      expect(s.sentence).toBe(
        'Running log. Last 7 days: 2 runs, 15.0 km, 1h 15m, average pace 5:00 /km. This month: 3 runs, 20.0 km, 1h 45m, average pace 5:15 /km. '
        + 'All logged: 4 runs, 24.0 km, 2h 5m, average pace 5:13 /km. Latest: Evening Run, 5.0 km \u00B7 Yesterday',
      );
    });

    it('leaves out the pace of a page with no run, rather than reading a dash aloud', () => {
      const s = runningLogSummary({ runs: [run({ startTime: at(2026, 9, 1), endTime: at(2026, 9, 1, 1) })], now: NOW });
      expect(s.sentence).toContain('Last 7 days: 0 runs, 0.0 km, 0m. This month: 0 runs, 0.0 km, 0m. All logged: 1 run, 5.0 km, 25m, average pace 5:00 /km');
    });

    it('leaves out the latest when no run has a time', () => {
      const s = runningLogSummary({ runs: [run({ startTime: undefined, endTime: undefined })], now: NOW });
      expect(s.sentence.endsWith('average pace 5:00 /km')).toBe(true);
      expect(s.sentence).not.toContain('Latest');
    });
  });
});

// "Today" is the day on the person's own calendar. The old code cut the day in UTC, so in New Jersey everything
// after about 8 PM landed on tomorrow: hydration and daily XP reset, an evening workout counted for the next day, and
// two workouts a few hours apart could count as one. jest.global-setup.js pins the zone to America/New_York.
//
// 9:30 PM on Wed 14 Oct 2026 in New Jersey is 01:30Z on the 15th.

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
// healthStore reaches for the wearable services, which pull in native modules; the day logic under test needs none of them.
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));

import { dayKeyOf, localDateKey } from '../lib/localDate';
import { useHealthStore } from '../store/healthStore';
import { useExpStore } from '../store/expStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useAnalyticsStore } from '../store/analyticsStore';
import { computeCalorieMetrics } from '../lib/calorieMetrics';
import { computeStepsMetrics } from '../lib/stepsMetrics';
import { computeXpMetrics } from '../lib/xpMetrics';
import { aggregateDailyLoad, calculateTrainingLoad } from '../lib/trainingLoad';
import { findCrossDomainCause } from '../lib/crossDomainInsights';
import { groupSetsBySession } from '../services/progressiveOverloadService';

const EVENING = new Date('2026-10-15T01:30:00Z'); // Wed 14 Oct, 9:30 PM
const at = (date) => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(date); };

// The user store finishes loading on a timer once the file is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
afterEach(() => { jest.useRealTimers(); });

describe('dayKeyOf', () => {
  it('gives the local day of a moment, whatever form it comes in', () => {
    expect(dayKeyOf(new Date('2026-10-15T01:00:00Z'))).toBe('2026-10-14');
    expect(dayKeyOf('2026-10-15T01:00:00.000Z')).toBe('2026-10-14');
    expect(dayKeyOf(Date.parse('2026-10-15T01:00:00Z'))).toBe('2026-10-14');
    expect(dayKeyOf({ toDate: () => new Date('2026-10-15T01:00:00Z') })).toBe('2026-10-14');
    expect(dayKeyOf('2026-10-14T16:00:00Z')).toBe('2026-10-14');
    expect(dayKeyOf('2026-10-15T04:30:00Z')).toBe('2026-10-15'); // 12:30 AM is already the 15th
  });

  it('returns a plain calendar day as it is, instead of reading it as midnight UTC (the evening before)', () => {
    expect(dayKeyOf('2026-10-14')).toBe('2026-10-14');
    expect(dayKeyOf('2026-01-01')).toBe('2026-01-01');
  });

  it('gives null for anything that is not a usable date', () => {
    for (const bad of [null, undefined, '', 'tomorrow', {}, [], NaN, true, false, '2026-02-30', '2026-13-01', new Date('nope'), { toDate: () => 'x' }]) {
      expect({ bad: String(bad), key: dayKeyOf(bad) }).toEqual({ bad: String(bad), key: null });
    }
  });

  it('agrees with localDateKey for a Date', () => {
    for (const d of [new Date('2026-10-15T01:30:00Z'), new Date('2026-03-08T07:30:00Z'), new Date('2026-11-01T05:30:00Z')]) {
      expect(dayKeyOf(d)).toBe(localDateKey(d));
    }
  });
});

describe('hydration and daily XP', () => {
  it('the water count belongs to today until local midnight, then starts again', () => {
    at(EVENING);
    useHealthStore.setState({ hydration: { glasses: 0, target: 8, date: '2026-10-14' } });
    useHealthStore.getState().addGlass();
    expect(useHealthStore.getState().hydration).toMatchObject({ glasses: 1, date: '2026-10-14' });
    useHealthStore.getState().addGlass();
    expect(useHealthStore.getState().hydration).toMatchObject({ glasses: 2, date: '2026-10-14' });

    at(new Date('2026-10-15T03:59:00Z')); // 11:59 PM, still the 14th
    useHealthStore.getState().addGlass();
    expect(useHealthStore.getState().hydration).toMatchObject({ glasses: 3, date: '2026-10-14' });

    at(new Date('2026-10-15T04:05:00Z')); // 12:05 AM on the 15th
    useHealthStore.getState().addGlass();
    expect(useHealthStore.getState().hydration).toMatchObject({ glasses: 1, date: '2026-10-15' });
  });

  it('XP earned in the evening is that day\'s XP', () => {
    at(EVENING);
    useExpStore.setState({ xpHistory: {}, dailyXp: 0, dailyXpDate: null });
    useExpStore.getState().addExp(40);
    const s = useExpStore.getState();
    expect(s.dailyXpDate).toBe('2026-10-14');
    expect(s.dailyXp).toBe(40);
    expect(s.xpHistory).toEqual({ '2026-10-14': 40 });
    expect(useExpStore.getState().getDailyExp()).toBe(40);

    at(new Date('2026-10-15T04:05:00Z')); // after midnight the day starts over
    expect(useExpStore.getState().getDailyExp()).toBe(0);
    useExpStore.getState().addExp(10);
    expect(useExpStore.getState().xpHistory).toEqual({ '2026-10-14': 40, '2026-10-15': 10 });
  });

  it('the XP widget finds that day, and calls it Wednesday', () => {
    at(EVENING);
    const m = computeXpMetrics({ '2026-10-14': 120, '2026-10-07': 60 });
    expect(m.last7[6]).toEqual({ day: 'Wed', xp: 120 });
    expect(m.weekOverWeek).toMatchObject({ dayLabel: 'Wednesday', todayXp: 120, lastWeekXp: 60, hasComparison: true, changePct: 100 });
  });
});

describe('workout streaks and lookups', () => {
  const workout = (completedAt) => ({ id: completedAt, completedAt });

  it('a 9 PM workout one day and a 3 PM workout the next are two days, not one', () => {
    at(EVENING);
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T01:00:00Z'), workout('2026-10-14T19:00:00Z')] }); // 13th 9 PM, 14th 3 PM
    expect(useWorkoutStore.getState().getWorkoutStreak()).toEqual({ current: 2, longest: 2 });
  });

  it('a workout at 9 PM counts for today when it is 9:30 PM', () => {
    at(EVENING);
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-15T01:10:00Z')] }); // 9:10 PM on the 14th
    expect(useWorkoutStore.getState().getWorkoutStreak()).toEqual({ current: 1, longest: 1 });
  });

  it('yesterday evening still keeps the streak alive the next morning, and two days ago does not', () => {
    at(new Date('2026-10-15T12:00:00Z')); // Thu 15th, 8 AM
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-15T01:10:00Z')] }); // 9:10 PM on the 14th
    expect(useWorkoutStore.getState().getWorkoutStreak().current).toBe(1);
    at(new Date('2026-10-16T12:00:00Z')); // Fri 16th, 8 AM
    expect(useWorkoutStore.getState().getWorkoutStreak().current).toBe(0);
  });

  it('in the evening, yesterday\'s workout still counts and the day before does not (the clock\'s UTC date is already tomorrow)', () => {
    at(EVENING); // 9:30 PM on the 14th; in UTC it is already the 15th
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T01:10:00Z')] }); // 9:10 PM on the 13th
    expect(useWorkoutStore.getState().getWorkoutStreak().current).toBe(1);
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-13T01:10:00Z')] }); // 9:10 PM on the 12th
    expect(useWorkoutStore.getState().getWorkoutStreak().current).toBe(0);
  });

  it('counts a long run of evenings, and stops at a gap', () => {
    at(EVENING);
    useWorkoutStore.setState({
      completedWorkouts: ['2026-10-15T01:10:00Z', '2026-10-14T01:10:00Z', '2026-10-13T01:10:00Z', '2026-10-11T01:10:00Z'].map(workout), // 14th, 13th, 12th, 10th
    });
    expect(useWorkoutStore.getState().getWorkoutStreak()).toEqual({ current: 3, longest: 3 });
  });

  it('steps back a calendar day at a time over the clocks going back', () => {
    at(new Date('2026-11-02T14:00:00Z')); // Mon 2 Nov, 9 AM; the clocks went back on the 1st (a 25-hour day)
    useWorkoutStore.setState({ completedWorkouts: ['2026-11-02T01:00:00Z', '2026-11-01T14:00:00Z', '2026-10-31T23:00:00Z', '2026-10-30T23:00:00Z'].map(workout) });
    expect(useWorkoutStore.getState().getWorkoutStreak().current).toBe(3);
  });

  it('looks workouts up by their local day', () => {
    at(EVENING);
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T01:00:00Z'), workout('2026-10-15T01:10:00Z'), workout('2026-10-14T19:00:00Z')] });
    expect(useWorkoutStore.getState().getWorkoutsByDate('2026-10-14').map((w) => w.completedAt)).toEqual(['2026-10-15T01:10:00Z', '2026-10-14T19:00:00Z']);
    expect(useWorkoutStore.getState().getWorkoutsByDate('2026-10-13').map((w) => w.completedAt)).toEqual(['2026-10-14T01:00:00Z']);
    expect(useWorkoutStore.getState().getWorkoutsByDate('2026-10-15')).toEqual([]);
  });

  it('the analytics streak keeps yesterday\'s workout going in the evening, too', () => {
    at(EVENING);
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T01:00:00Z'), workout('2026-10-13T01:00:00Z')] }); // 9 PM on the 13th and the 12th
    expect(useAnalyticsStore.getState().getAnalytics('week').streakDays).toBe(2);
  });

  it('the analytics streak agrees', () => {
    at(EVENING);
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T01:00:00Z'), workout('2026-10-14T19:00:00Z')] });
    expect(useAnalyticsStore.getState().getAnalytics('week').streakDays).toBe(2);
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-15T01:10:00Z')] });
    expect(useAnalyticsStore.getState().getAnalytics('week').streakDays).toBe(1);
    useWorkoutStore.setState({ completedWorkouts: [] });
    expect(useAnalyticsStore.getState().getAnalytics('week').streakDays).toBe(0);
  });
});

describe('calories', () => {
  it('counts an evening workout for today', () => {
    at(EVENING);
    const m = computeCalorieMetrics([{ completedAt: '2026-10-15T01:00:00Z', caloriesBurned: 400, duration: 3000, category: 'Strength' }], [], 300, 50);
    expect(m.todayCalories).toBe(450);
    expect(m.streak).toBe(1);
  });

  it('puts a 9 PM and a 3 PM session on their own days', () => {
    at(EVENING);
    const m = computeCalorieMetrics([
      { completedAt: '2026-10-14T01:00:00Z', caloriesBurned: 300, duration: 1800 }, // 13th, 9 PM
      { completedAt: '2026-10-14T19:00:00Z', caloriesBurned: 500, duration: 1800 }, // 14th, 3 PM
    ], [], 0, 0);
    expect(m.todayCalories).toBe(500);
    expect(m.weeklyTotal).toBe(800);
  });

  it('knows past Wednesdays are Wednesdays', () => {
    at(EVENING);
    const m = computeCalorieMetrics([{ completedAt: '2026-10-07T16:00:00Z', caloriesBurned: 300, duration: 1800 }], [], 0, 0);
    expect(m.historicalDailyAverage).toBe(300);
    const tuesday = computeCalorieMetrics([{ completedAt: '2026-10-06T16:00:00Z', caloriesBurned: 300, duration: 1800 }], [], 0, 0);
    expect(tuesday.historicalDailyAverage).toBeNull();
  });

  it('counts runs the same way, and skips a session with no usable date instead of failing', () => {
    at(EVENING);
    const m = computeCalorieMetrics(
      [{ completedAt: 'not a date', caloriesBurned: 999, duration: 600 }],
      [{ startTime: '2026-10-15T00:30:00Z', calories: 250, duration: 1500 }], 0, 0,
    );
    expect(m.todayCalories).toBe(250);
    expect(m.lifetimeCalories).toBe(1249);
  });
});

describe('steps', () => {
  it('reads today\'s steps and the weekday pattern by local day', () => {
    at(EVENING);
    const m = computeStepsMetrics({ '2026-10-14': 5000, '2026-10-13': 9000, '2026-10-07': 7000 }, 4000);
    expect(m.todaySteps).toBe(5000);
    expect(m.streak).toBe(2);
    expect(m.historicalDailyAverage).toBe(6000); // the 14th and the 7th are both Wednesdays: (5000 + 7000) / 2
    const byDay = Object.fromEntries(m.weekdayBreakdown.map((d) => [d.day, d.averageSteps]));
    expect(byDay.Wednesday).toBe(6000);
    expect(byDay.Tuesday).toBe(9000);
    expect(byDay.Thursday).toBeNull();
  });
});

describe('training load', () => {
  it('puts a workout, a run and a hike on the local day they happened', () => {
    const load = aggregateDailyLoad({
      completedWorkouts: [{ date: '2026-10-15T01:00:00Z', caloriesBurned: 300 }, { date: '2026-10-14T19:00:00Z', caloriesBurned: 200 }],
      runs: [{ startTime: '2026-10-15T00:30:00Z', calories: 100 }],
      completedHikes: [{ completedAt: { toDate: () => new Date('2026-10-14T13:00:00Z') }, calories: 50 }],
    });
    expect(load).toEqual({ '2026-10-14': 650 });
  });

  it('leaves out a record with no usable date, and takes a plain day as it is', () => {
    expect(aggregateDailyLoad({ runs: [{ startTime: 'nope', calories: 100 }, { startTime: '2026-10-14', calories: 70 }] })).toEqual({ '2026-10-14': 70 });
  });

  it('counts today\'s evening load in the acute week', () => {
    at(EVENING);
    const days = {};
    for (let i = 0; i < 28; i++) {
      const d = new Date(2026, 9, 14 - i);
      days[localDateKey(d)] = 100;
    }
    days['2026-10-14'] = 600;
    const r = calculateTrainingLoad(days);
    expect(r.acuteLoad).toBe(600 + 6 * 100);
  });

  it('reaches a full 28 distinct days back over the clocks going forward (a 23-hour day)', () => {
    at(new Date('2026-03-09T04:30:00Z')); // Mon 9 Mar, 12:30 AM; the 8th was a 23-hour day
    const days = {};
    for (let i = 0; i < 28; i++) days[localDateKey(new Date(2026, 2, 9 - i))] = 100;
    days['2026-03-08'] = 500;
    const r = calculateTrainingLoad(days);
    expect(r.acuteLoad).toBe(6 * 100 + 500);
    expect(r.chronicWeeklyAvg).toBe(Math.round((27 * 100 + 500) / 4));
  });
});

describe('a lift plateau and the cardio before it', () => {
  const caloriesDay = (day) => ({ startTime: `${day}T14:00:00Z`, calories: 50 });

  it('groups a session that runs past 8 PM into one day', () => {
    const sets = [
      { date: new Date('2026-10-14T23:50:00Z'), weight: 100, reps: 5 }, // 7:50 PM
      { date: new Date('2026-10-15T00:20:00Z'), weight: 100, reps: 5 }, // 8:20 PM
      { date: new Date('2026-10-16T01:00:00Z'), weight: 105, reps: 5 }, // 9 PM the next day
    ];
    expect(groupSetsBySession(sets).map((s) => [s.day, s.sets.length])).toEqual([['2026-10-14', 2], ['2026-10-15', 1]]);
  });

  it('puts a logged set from the database (a timestamp) on its day, and skips one with no date', () => {
    const sets = [{ date: { toDate: () => new Date('2026-10-15T01:00:00Z') }, weight: 100, reps: 5 }, { date: undefined, weight: 90, reps: 5 }, { date: 'junk', weight: 90, reps: 5 }];
    expect(groupSetsBySession(sets).map((s) => s.day)).toEqual(['2026-10-14']);
  });

  it('sees the week of running before a session, evenings included', () => {
    const runs = [];
    for (let i = 0; i < 20; i++) runs.push({ startTime: new Date(2026, 8, 1 + i, 12).toISOString(), calories: 50 }); // baseline days in September
    runs.push({ startTime: '2026-10-14T01:00:00Z', calories: 2000 }); // 9 PM on the 13th, the evening before the 14th
    const cause = findCrossDomainCause({ muscleGroups: ['quadriceps', 'glutes'], plateauSessionDays: ['2026-10-14'], runs });
    expect(cause).toMatchObject({ elevatedSessionCount: 1, totalSessionsChecked: 1 });
  });

  it('does not count a run from the session\'s own evening as before it', () => {
    const runs = [];
    for (let i = 0; i < 20; i++) runs.push({ startTime: new Date(2026, 8, 1 + i, 12).toISOString(), calories: 50 });
    runs.push({ startTime: '2026-10-15T01:00:00Z', calories: 2000 }); // 9 PM on the 14th: the session day itself
    expect(findCrossDomainCause({ muscleGroups: ['quadriceps'], plateauSessionDays: ['2026-10-14'], runs })).toBeNull();
  });

  it('copes with a session day that is not a date', () => {
    const runs = Array.from({ length: 6 }, (_, i) => caloriesDay(`2026-09-${String(10 + i)}`));
    expect(() => findCrossDomainCause({ muscleGroups: ['quadriceps'], plateauSessionDays: ['junk'], runs })).not.toThrow();
  });
});

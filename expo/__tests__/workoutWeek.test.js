// "This Week" on the Workouts tab (lib/workoutWeek.js): the workouts finished since Monday, not the last seven days.
import { startOfWeek, workoutsThisWeek } from '../lib/workoutWeek';

// Wednesday 18 November 2026, midday, local time. The week began on Monday the 16th.
const WED = new Date(2026, 10, 18, 12, 0, 0);
const at = (month, day, hour = 12, minute = 0) => new Date(2026, month, day, hour, minute).toISOString();

describe('startOfWeek', () => {
  it('is Monday at midnight of the week a moment falls in', () => {
    expect(startOfWeek(WED)).toEqual(new Date(2026, 10, 16, 0, 0, 0, 0));
  });

  it('is the same moment on Monday at midnight, and still that Monday one minute before the next one', () => {
    expect(startOfWeek(new Date(2026, 10, 16, 0, 0))).toEqual(new Date(2026, 10, 16));
    expect(startOfWeek(new Date(2026, 10, 22, 23, 59))).toEqual(new Date(2026, 10, 16)); // the Sunday night
    expect(startOfWeek(new Date(2026, 10, 23, 0, 0))).toEqual(new Date(2026, 10, 23)); // the next Monday
  });

  it('reaches back across a month and a year', () => {
    expect(startOfWeek(new Date(2026, 11, 3, 9))).toEqual(new Date(2026, 10, 30)); // Thursday 3 Dec -> Monday 30 Nov
    expect(startOfWeek(new Date(2027, 0, 1, 9))).toEqual(new Date(2026, 11, 28)); // Friday 1 Jan 2027 -> Monday 28 Dec
  });

  it('does not change the moment it is given', () => {
    const now = new Date(WED);
    startOfWeek(now);
    expect(now).toEqual(WED);
  });
});

describe('workoutsThisWeek', () => {
  it('counts what was finished since Monday morning, and nothing before it', () => {
    const list = [
      { completedAt: at(10, 16, 0, 0) }, // Monday, midnight: this week
      { completedAt: at(10, 17) }, // Tuesday
      { completedAt: at(10, 18, 8) }, // this morning
      { completedAt: at(10, 15, 23, 59) }, // Sunday night: last week
      { completedAt: at(10, 9) }, // a week ago
    ];
    expect(workoutsThisWeek(list, WED)).toBe(3);
  });

  it('no longer counts a workout from six days ago, which "the last 7 days" did', () => {
    // Thursday 12 November was inside seven days of Wednesday the 18th, and is in last week.
    expect(workoutsThisWeek([{ completedAt: at(10, 12) }], WED)).toBe(0);
  });

  it('starts again on Monday: a Sunday workout counts on Sunday and not on the Monday after', () => {
    const sunday = [{ completedAt: at(10, 22, 20) }];
    expect(workoutsThisWeek(sunday, new Date(2026, 10, 22, 21))).toBe(1);
    expect(workoutsThisWeek(sunday, new Date(2026, 10, 23, 7))).toBe(0);
  });

  it('reads a workout\'s date from completedAt, or from timestamp when it has no completedAt', () => {
    expect(workoutsThisWeek([{ timestamp: at(10, 17) }], WED)).toBe(1);
    expect(workoutsThisWeek([{ completedAt: at(10, 10), timestamp: at(10, 17) }], WED)).toBe(0); // completedAt wins
  });

  it('does not count a workout with no date, or one it cannot read, and does not fall over on bad input', () => {
    expect(workoutsThisWeek([{}, { completedAt: 'not a date' }, null, { completedAt: null }], WED)).toBe(0);
    expect(workoutsThisWeek(null, WED)).toBe(0);
    expect(workoutsThisWeek(undefined, WED)).toBe(0);
    expect(workoutsThisWeek([], WED)).toBe(0);
  });

  it('uses the real clock when it is not given one', () => {
    expect(workoutsThisWeek([{ completedAt: new Date().toISOString() }])).toBe(1);
  });
});

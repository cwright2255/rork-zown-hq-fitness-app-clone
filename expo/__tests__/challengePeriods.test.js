import {
  CADENCES, getPeriod, getDayBounds, getWeekBounds, getMonthBounds, getSeasonBounds, getCurrentPeriodKey, challengeDocId,
  easternDate, easternMidnight, daysLeft,
} from '../lib/challengePeriods';
import { aiDayKey } from '../lib/entitlements';

const at = (iso) => new Date(iso);
const iso = (d) => d.toISOString();

// New York is 5 hours behind UTC in winter (EST) and 4 in summer (EDT). Clocks went forward on 2026-03-08 and back on 2026-11-01.

describe('the daily challenge is cut at midnight in New York', () => {
  it('is still today at 8 PM Eastern, when it is already tomorrow in UTC', () => {
    const eightPm = at('2026-11-03T01:00:00Z'); // 8:00 PM EST on Nov 2
    expect(eightPm.toISOString().slice(0, 10)).toBe('2026-11-03'); // UTC has moved on
    const day = getDayBounds(eightPm);
    expect(day.periodKey).toBe('day-2026-11-02');
    expect(iso(day.start)).toBe('2026-11-02T05:00:00.000Z');
    expect(iso(day.end)).toBe('2026-11-03T04:59:59.999Z');
  });

  it('turns over at midnight Eastern exactly, in winter', () => {
    expect(getDayBounds(at('2026-11-03T04:59:59.999Z')).periodKey).toBe('day-2026-11-02'); // 11:59:59 PM
    expect(getDayBounds(at('2026-11-03T05:00:00.000Z')).periodKey).toBe('day-2026-11-03'); // 12:00:00 AM
  });

  it('turns over at midnight Eastern exactly, in summer', () => {
    expect(getDayBounds(at('2026-07-15T03:59:59.999Z')).periodKey).toBe('day-2026-07-14');
    expect(getDayBounds(at('2026-07-15T04:00:00.000Z')).periodKey).toBe('day-2026-07-15');
  });

  it('is still the same day at 8 PM Eastern in summer, and the next one has begun by morning', () => {
    expect(getDayBounds(at('2026-07-15T00:00:00Z')).periodKey).toBe('day-2026-07-14'); // 8 PM EDT
    expect(getDayBounds(at('2026-07-15T12:00:00Z')).periodKey).toBe('day-2026-07-15'); // 8 AM EDT
  });

  it('is 23 hours long the day the clocks go forward and 25 the day they go back', () => {
    const spring = getDayBounds(at('2026-03-08T15:00:00Z'));
    expect(spring.periodKey).toBe('day-2026-03-08');
    expect(iso(spring.start)).toBe('2026-03-08T05:00:00.000Z');
    expect(iso(spring.end)).toBe('2026-03-09T03:59:59.999Z');
    expect((spring.end - spring.start + 1) / 3600000).toBe(23);

    const fall = getDayBounds(at('2026-11-01T15:00:00Z'));
    expect(fall.periodKey).toBe('day-2026-11-01');
    expect(iso(fall.start)).toBe('2026-11-01T04:00:00.000Z');
    expect(iso(fall.end)).toBe('2026-11-02T04:59:59.999Z');
    expect((fall.end - fall.start + 1) / 3600000).toBe(25);
  });

  it('gets the new year right: 11:30 PM Eastern on New Year\'s Eve is still the old year', () => {
    expect(getDayBounds(at('2027-01-01T04:30:00Z')).periodKey).toBe('day-2026-12-31');
    expect(getDayBounds(at('2027-01-01T05:00:00Z')).periodKey).toBe('day-2027-01-01');
  });

  it('is the same day as the AI limits use, at every hour of a stretch that holds both clock changes', () => {
    for (let ms = Date.parse('2026-03-06T00:00:00Z'); ms < Date.parse('2026-03-11T00:00:00Z'); ms += 15 * 60 * 1000) {
      expect(getDayBounds(new Date(ms)).periodKey).toBe(`day-${aiDayKey(new Date(ms))}`);
    }
    for (let ms = Date.parse('2026-10-30T00:00:00Z'); ms < Date.parse('2026-11-04T00:00:00Z'); ms += 15 * 60 * 1000) {
      expect(getDayBounds(new Date(ms)).periodKey).toBe(`day-${aiDayKey(new Date(ms))}`);
    }
  });
});

describe('the weekly, monthly and seasonal challenges are cut at midnight in New York too', () => {
  it('runs a week from Monday to Sunday night', () => {
    const week = getWeekBounds(at('2026-11-04T15:00:00Z')); // a Wednesday
    expect(week.periodKey).toBe('week-2026-11-02');
    expect(iso(week.start)).toBe('2026-11-02T05:00:00.000Z');
    expect(iso(week.end)).toBe('2026-11-09T04:59:59.999Z');
    // 11:59 PM Sunday is still the week; midnight Monday is the next.
    expect(getWeekBounds(at('2026-11-09T04:59:59.999Z')).periodKey).toBe('week-2026-11-02');
    expect(getWeekBounds(at('2026-11-09T05:00:00.000Z')).periodKey).toBe('week-2026-11-09');
  });

  it('keeps Sunday evening in the week that is ending, though UTC has reached Monday', () => {
    const sundayEvening = at('2026-11-09T02:00:00Z'); // 9 PM EST Sunday Nov 8
    expect(sundayEvening.getUTCDay()).toBe(1); // Monday in UTC
    expect(getWeekBounds(sundayEvening).periodKey).toBe('week-2026-11-02');
  });

  it('holds the clock change inside the week it falls in', () => {
    const week = getWeekBounds(at('2026-03-09T12:00:00Z'));
    expect(week.periodKey).toBe('week-2026-03-09');
    const before = getWeekBounds(at('2026-03-07T12:00:00Z'));
    expect(before.periodKey).toBe('week-2026-03-02');
    expect(iso(before.end)).toBe('2026-03-09T03:59:59.999Z'); // Monday 12:00 AM EDT
    expect(iso(week.start)).toBe('2026-03-09T04:00:00.000Z');
  });

  it('runs a month from the first to the last evening of it', () => {
    const month = getMonthBounds(at('2026-11-15T12:00:00Z'));
    expect(month.periodKey).toBe('month-2026-11');
    expect(iso(month.start)).toBe('2026-11-01T04:00:00.000Z'); // still EDT at midnight on Nov 1
    expect(iso(month.end)).toBe('2026-12-01T04:59:59.999Z');
    expect(getMonthBounds(at('2026-11-01T03:59:59.999Z')).periodKey).toBe('month-2026-10'); // 11:59 PM Oct 31
    expect(getMonthBounds(at('2026-11-01T04:00:00.000Z')).periodKey).toBe('month-2026-11');
  });

  it('keeps the evening of the last day of a month in that month', () => {
    const lastEvening = at('2026-12-01T03:00:00Z'); // 10 PM EST on Nov 30
    expect(getMonthBounds(lastEvening).periodKey).toBe('month-2026-11');
    expect(getDayBounds(lastEvening).periodKey).toBe('day-2026-11-30');
  });

  it('names a season by its first year and splits at the first of Dec, Mar, Jun and Sep', () => {
    expect(getSeasonBounds(at('2026-11-15T12:00:00Z')).periodKey).toBe('season-fall-2026');
    expect(getSeasonBounds(at('2026-12-15T12:00:00Z')).periodKey).toBe('season-winter-2026');
    expect(getSeasonBounds(at('2027-01-15T12:00:00Z')).periodKey).toBe('season-winter-2026');
    expect(getSeasonBounds(at('2027-02-27T12:00:00Z')).periodKey).toBe('season-winter-2026');
    expect(getSeasonBounds(at('2027-04-10T12:00:00Z')).periodKey).toBe('season-spring-2027');
    expect(getSeasonBounds(at('2027-07-10T12:00:00Z')).periodKey).toBe('season-summer-2027');
    expect(getSeasonBounds(at('2027-09-10T12:00:00Z')).periodKey).toBe('season-fall-2027');
    // The turn from fall to winter is at midnight Eastern, not midnight UTC.
    expect(getSeasonBounds(at('2026-12-01T04:59:59.999Z')).periodKey).toBe('season-fall-2026');
    expect(getSeasonBounds(at('2026-12-01T05:00:00.000Z')).periodKey).toBe('season-winter-2026');
  });

  it('gives a season its first and last moment', () => {
    const fall = getSeasonBounds(at('2026-11-15T12:00:00Z'));
    expect(fall.seasonName).toBe('fall');
    expect(iso(fall.start)).toBe('2026-09-01T04:00:00.000Z');
    expect(iso(fall.end)).toBe('2026-12-01T04:59:59.999Z');
    const winter = getSeasonBounds(at('2027-01-15T12:00:00Z'));
    expect(winter.seasonName).toBe('winter');
    expect(iso(winter.start)).toBe('2026-12-01T05:00:00.000Z');
    expect(iso(winter.end)).toBe('2027-03-01T04:59:59.999Z');
  });
});

describe('periods follow each other with no gap and no overlap', () => {
  it('starts each period the millisecond after the one before it ends', () => {
    const starts = {};
    for (let ms = Date.parse('2026-02-20T00:00:00Z'); ms < Date.parse('2027-03-10T00:00:00Z'); ms += 6 * 3600 * 1000) {
      CADENCES.forEach((cadence) => {
        const p = getPeriod(cadence, new Date(ms));
        starts[cadence] = starts[cadence] || {};
        starts[cadence][p.periodKey] = p;
        // The moment asked about is inside its own period.
        expect(p.start.getTime()).toBeLessThanOrEqual(ms);
        expect(p.end.getTime()).toBeGreaterThanOrEqual(ms);
      });
    }
    CADENCES.forEach((cadence) => {
      const periods = Object.values(starts[cadence]).sort((a, b) => a.start - b.start);
      expect(periods.length).toBeGreaterThan(3);
      for (let i = 1; i < periods.length; i++) {
        expect(periods[i].start.getTime()).toBe(periods[i - 1].end.getTime() + 1);
      }
    });
  });

  it('gives the same key to every moment inside one period, and a different key to the next', () => {
    const day = getDayBounds(at('2026-11-02T20:00:00Z'));
    for (let ms = day.start.getTime(); ms <= day.end.getTime(); ms += 30 * 60 * 1000) {
      expect(getDayBounds(new Date(ms)).periodKey).toBe(day.periodKey);
    }
    expect(getDayBounds(new Date(day.end.getTime() + 1)).periodKey).not.toBe(day.periodKey);
  });
});

describe('the document id of a challenge', () => {
  it('is fixed for a cadence and period, so two people get the same id', () => {
    const now = at('2026-11-03T01:00:00Z');
    const a = challengeDocId('daily', getCurrentPeriodKey('daily', now));
    const b = challengeDocId('daily', getCurrentPeriodKey('daily', at('2026-11-02T14:00:00Z')));
    expect(a).toBe('daily_day-2026-11-02');
    expect(b).toBe(a);
  });

  it('differs between cadences and between periods', () => {
    const ids = new Set();
    [at('2026-11-02T14:00:00Z'), at('2026-11-03T14:00:00Z'), at('2026-11-10T14:00:00Z'), at('2026-12-10T14:00:00Z')].forEach((now) => {
      CADENCES.forEach((c) => ids.add(challengeDocId(c, getCurrentPeriodKey(c, now))));
    });
    // 4 instants x 4 cadences, but the weekly/monthly/seasonal of the first two instants are the same period.
    expect([...ids].sort()).toEqual([
      'daily_day-2026-11-02', 'daily_day-2026-11-03', 'daily_day-2026-11-10', 'daily_day-2026-12-10',
      'monthly_month-2026-11', 'monthly_month-2026-12',
      'seasonal_season-fall-2026', 'seasonal_season-winter-2026',
      'weekly_week-2026-11-02', 'weekly_week-2026-11-09', 'weekly_week-2026-12-07',
    ]);
  });

  it('is a legal Firestore document id', () => {
    CADENCES.forEach((c) => {
      const id = challengeDocId(c, getCurrentPeriodKey(c, at('2026-11-02T14:00:00Z')));
      expect(id).toMatch(/^[a-z]+_[a-z]+-[0-9a-z-]+$/);
      expect(id).not.toContain('/');
    });
  });
});

describe('the pieces', () => {
  it('lists the four cadences and gives no period for another', () => {
    expect(CADENCES).toEqual(['daily', 'weekly', 'monthly', 'seasonal']);
    expect(getPeriod('hourly')).toBeNull();
    expect(getCurrentPeriodKey('hourly')).toBeNull();
    expect(getCurrentPeriodKey('daily', at('2026-11-03T01:00:00Z'))).toBe('day-2026-11-02');
  });

  it('reads the date in New York and finds its midnight', () => {
    expect(easternDate(at('2026-11-03T01:00:00Z'))).toEqual({ year: 2026, month: 11, day: 2 });
    expect(iso(easternMidnight(2026, 11, 2))).toBe('2026-11-02T05:00:00.000Z');
    expect(iso(easternMidnight(2026, 7, 4))).toBe('2026-07-04T04:00:00.000Z');
    expect(iso(easternMidnight(2026, 3, 8))).toBe('2026-03-08T05:00:00.000Z');
    expect(iso(easternMidnight(2026, 3, 9))).toBe('2026-03-09T04:00:00.000Z');
    expect(iso(easternMidnight(2026, 12, 32))).toBe('2027-01-01T05:00:00.000Z'); // rolls into the next month
  });

  it('counts the days left in a period as whole days, never less than one', () => {
    const season = getSeasonBounds(at('2026-11-15T12:00:00Z'));
    expect(daysLeft(season, at('2026-11-15T12:00:00Z'))).toBe(16);
    expect(daysLeft(season, at('2026-12-01T04:00:00Z'))).toBe(1);
    expect(daysLeft(season, at('2027-02-01T00:00:00Z'))).toBe(1);
  });
});

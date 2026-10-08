import {
  BOARDS, DEFAULT_BOARD, MIN_BOARD_PACE, isDistanceBoard, cleanBoard, weekStart, periodKeys,
  countsForBoard, distanceTotals, boardField, boardValue, formatBoardValue, emptyBoardMessage,
} from '../lib/runLeaderboard';

// Dates in the phone's own time zone (weeks and months are the local ones).
const d = (month, day, hour = 12, minute = 0) => new Date(2026, month - 1, day, hour, minute, 0);
const THU = d(10, 8).getTime(); // Thu 8 Oct 2026; its week began Mon 5 Oct

// A run that started at `start` and went `km` at 5:00 per km.
const ran = (start, km, extra = {}) => {
  const duration = Math.round(km * 300);
  return {
    id: `${start.getTime()}-${km}`,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + duration * 1000).toISOString(),
    distance: km,
    duration,
    ...extra,
  };
};

describe('the boards', () => {
  it('has XP first and the two distance boards after it', () => {
    expect(BOARDS.map((b) => b.id)).toEqual(['xp', 'week', 'month']);
    expect(BOARDS.map((b) => b.label)).toEqual(['XP', 'This week', 'This month']);
    expect(DEFAULT_BOARD).toBe('xp');
  });

  it('knows which are distance boards', () => {
    expect(isDistanceBoard('week')).toBe(true);
    expect(isDistanceBoard('month')).toBe(true);
    expect(isDistanceBoard('xp')).toBe(false);
    expect(isDistanceBoard(undefined)).toBe(false);
  });

  it('turns junk into the default board', () => {
    expect(cleanBoard('week')).toBe('week');
    expect(cleanBoard('month')).toBe('month');
    expect(cleanBoard('year')).toBe('xp');
    expect(cleanBoard(undefined)).toBe('xp');
  });
});

describe('weekStart', () => {
  it('is the Monday at midnight', () => {
    expect(weekStart(THU).getTime()).toBe(d(10, 5, 0).getTime());
  });

  it('counts Sunday as the end of the week, not the start', () => {
    expect(weekStart(d(10, 11, 23, 59).getTime()).getTime()).toBe(d(10, 5, 0).getTime());
  });

  it('starts a new week at midnight on Monday', () => {
    expect(weekStart(d(10, 12, 0, 0).getTime()).getTime()).toBe(d(10, 12, 0).getTime());
    expect(weekStart(d(10, 5, 0, 0).getTime()).getTime()).toBe(d(10, 5, 0).getTime());
  });
});

describe('periodKeys', () => {
  it('names the week by its Monday and the month by its number', () => {
    expect(periodKeys(THU)).toEqual({ week: 'w20261005', month: 'm202610' });
  });

  it('changes the week on Monday and the month on the 1st', () => {
    expect(periodKeys(d(10, 11, 23, 59).getTime()).week).toBe('w20261005');
    expect(periodKeys(d(10, 12, 0, 0).getTime()).week).toBe('w20261012');
    expect(periodKeys(d(10, 31, 23, 59).getTime()).month).toBe('m202610');
    expect(periodKeys(d(11, 1, 0, 0).getTime()).month).toBe('m202611');
  });

  it('uses the Monday in the old month when the week crosses months', () => {
    expect(periodKeys(d(10, 2).getTime())).toEqual({ week: 'w20260928', month: 'm202610' });
  });

  it('crosses the new year', () => {
    // Fri 1 Jan 2027: its week began on Mon 28 Dec 2026.
    expect(periodKeys(new Date(2027, 0, 1, 12).getTime())).toEqual({ week: 'w20261228', month: 'm202701' });
  });
});

describe('countsForBoard', () => {
  it('counts a run or walk recorded in Zown', () => {
    expect(countsForBoard(ran(d(10, 8, 7), 5))).toBe(true);
    expect(countsForBoard(ran(d(10, 8, 7), 3, { activity: 'walk' }))).toBe(true);
  });

  it('does not count an imported run', () => {
    expect(countsForBoard(ran(d(10, 8, 7), 5, { source: 'apple-health' }))).toBe(false);
  });

  it('does not count "runs" faster than 2:30 per km (a bike or a car)', () => {
    expect(MIN_BOARD_PACE).toBe(150);
    expect(countsForBoard({ ...ran(d(10, 8, 7), 10), duration: 900 })).toBe(false); // 1:30 per km
    expect(countsForBoard({ ...ran(d(10, 8, 7), 10), duration: 1499 })).toBe(false);
    expect(countsForBoard({ ...ran(d(10, 8, 7), 10), duration: 1500 })).toBe(true); // exactly 2:30
  });

  it('does not count a run with no distance, no time or no date', () => {
    expect(countsForBoard(ran(d(10, 8, 7), 0))).toBe(false);
    expect(countsForBoard({ ...ran(d(10, 8, 7), 5), duration: 0 })).toBe(false);
    expect(countsForBoard({ distance: 5, duration: 1500 })).toBe(false);
    expect(countsForBoard({ ...ran(d(10, 8, 7), 5), distance: NaN })).toBe(false);
    expect(countsForBoard({ ...ran(d(10, 8, 7), 5), distance: -2 })).toBe(false);
    expect(countsForBoard(null)).toBe(false);
    expect(countsForBoard('run')).toBe(false);
  });
});

describe('distanceTotals', () => {
  it('adds up this week and this month', () => {
    const runs = [
      ran(d(10, 8, 7), 5),   // today
      ran(d(10, 6, 18), 3),  // Tuesday
      ran(d(10, 4, 9), 10),  // Sunday: last week, still this month
      ran(d(9, 30, 9), 20),  // last month
    ];
    expect(distanceTotals(runs, THU)).toEqual({ w20261005: 8, m202610: 18 });
  });

  it('leaves out imports, bikes and runs that have not happened yet', () => {
    const runs = [
      ran(d(10, 8, 7), 5),
      ran(d(10, 7, 7), 8, { source: 'apple-health' }),
      { ...ran(d(10, 7, 8), 30), duration: 3000 }, // 1:40 per km
      ran(d(10, 9, 7), 12), // tomorrow
    ];
    expect(distanceTotals(runs, THU)).toEqual({ w20261005: 5, m202610: 5 });
  });

  it('counts a run on the day it began, even if it ended after midnight', () => {
    const lateSunday = ran(d(10, 11, 23, 50), 4); // ends 00:10 on Monday
    const monday = d(10, 12, 12).getTime();
    expect(distanceTotals([lateSunday], monday)).toEqual({ m202610: 4 });
    expect(distanceTotals([lateSunday], d(10, 11, 23, 55).getTime())).toEqual({ w20261005: 4, m202610: 4 });
  });

  it('leaves out a period with nothing in it', () => {
    expect(distanceTotals([ran(d(10, 1, 9), 6)], THU)).toEqual({ m202610: 6 });
    expect(distanceTotals([ran(d(9, 20, 9), 6)], THU)).toEqual({});
    expect(distanceTotals([], THU)).toEqual({});
    expect(distanceTotals(undefined, THU)).toEqual({});
  });

  it('rounds to two decimals', () => {
    const runs = [ran(d(10, 8, 7), 1.234), ran(d(10, 8, 8), 2.345), ran(d(10, 8, 9), 0.4444)];
    expect(distanceTotals(runs, THU)).toEqual({ w20261005: 4.02, m202610: 4.02 });
  });

  it('uses the end time for a run saved without a start time', () => {
    const run = { id: 'x', endTime: d(10, 7, 8).toISOString(), distance: 4, duration: 1200 };
    expect(distanceTotals([run], THU)).toEqual({ w20261005: 4, m202610: 4 });
  });

  it('ignores junk in the list', () => {
    expect(distanceTotals([null, 'run', {}, ran(d(10, 8, 7), 2)], THU)).toEqual({ w20261005: 2, m202610: 2 });
  });
});

describe('boardField', () => {
  it('orders XP by xp, and distance by the current period', () => {
    expect(boardField('xp', THU)).toBe('xp');
    expect(boardField('week', THU)).toBe('distance.w20261005');
    expect(boardField('month', THU)).toBe('distance.m202610');
    expect(boardField('nonsense', THU)).toBe('xp');
  });

  it('moves to the new week by itself', () => {
    expect(boardField('week', d(10, 12).getTime())).toBe('distance.w20261012');
  });
});

describe('boardValue', () => {
  const entry = { id: 'a', xp: 1250, distance: { w20261005: 12.4, m202610: 31.8, w20260928: 40 } };

  it('reads XP, or the distance for the current period', () => {
    expect(boardValue(entry, 'xp', THU)).toBe(1250);
    expect(boardValue(entry, 'week', THU)).toBe(12.4);
    expect(boardValue(entry, 'month', THU)).toBe(31.8);
  });

  it('is 0 for someone with nothing on that board', () => {
    expect(boardValue({ id: 'b', xp: 10 }, 'week', THU)).toBe(0);
    expect(boardValue(entry, 'week', d(10, 19).getTime())).toBe(0); // two weeks on
    expect(boardValue({ distance: 'far' }, 'week', THU)).toBe(0);
    expect(boardValue({ distance: { w20261005: -3 } }, 'week', THU)).toBe(0);
    expect(boardValue({ distance: { w20261005: 'x' } }, 'week', THU)).toBe(0);
    expect(boardValue({ xp: 'lots' }, 'xp', THU)).toBe(0);
    expect(boardValue(null, 'xp', THU)).toBe(0);
    expect(boardValue(undefined, 'week', THU)).toBe(0);
  });
});

describe('formatBoardValue', () => {
  it('writes XP with thousands separators', () => {
    expect(formatBoardValue('xp', 1250)).toBe(`${(1250).toLocaleString()} XP`);
    expect(formatBoardValue('xp', 0)).toBe('0 XP');
    expect(formatBoardValue('xp', 99.6)).toBe('100 XP');
  });

  it('writes distance to a tenth of a km, and whole km from 100', () => {
    expect(formatBoardValue('week', 12.44)).toBe('12.4 km');
    expect(formatBoardValue('week', 12)).toBe('12.0 km');
    expect(formatBoardValue('month', 0.04)).toBe('0.0 km');
    expect(formatBoardValue('month', 99.96)).toBe('100 km');
    expect(formatBoardValue('month', 128.4)).toBe('128 km');
  });

  it('copes with junk', () => {
    expect(formatBoardValue('week', undefined)).toBe('0.0 km');
    expect(formatBoardValue('xp', 'x')).toBe('0 XP');
  });
});

describe('emptyBoardMessage', () => {
  it('says who has not run yet, for the period and the audience', () => {
    expect(emptyBoardMessage('week')).toBe('Nobody has logged a run or walk this week yet. Record one to get on the board.');
    expect(emptyBoardMessage('month', 'everyone')).toBe('Nobody has logged a run or walk this month yet. Record one to get on the board.');
    expect(emptyBoardMessage('week', 'following')).toBe('Nobody you follow has logged a run or walk this week yet.');
    expect(emptyBoardMessage('month', 'close')).toBe('None of your close friends have logged a run or walk this month yet.');
  });
});

// The Battle Pass missions (lib/battlePassMissions.js), shared by the Battle Pass screen and the card on Home.
// jest.global-setup.js pins the time zone to America/New_York.
import { buildMissions, getMonday, missionsDone, DAILY_STEPS_TARGET } from '../lib/battlePassMissions';

// Wed 14 Oct 2026, 9:30 PM in New York (so it is already the 15th in UTC).
const NOW = new Date(2026, 9, 14, 21, 30);
const noon = (d, m = 10) => new Date(2026, m - 1, d, 12, 0).toISOString();
const workout = (d) => ({ id: `w${d}`, completedAt: noon(d) });
const run = (d, distance = 5) => ({ id: `r${d}`, startTime: noon(d), endTime: noon(d), distance });
const hike = (d) => ({ id: `h${d}`, startTime: noon(d), completedAt: noon(d) });
const meal = (foods = [{ name: 'Eggs' }]) => ({ date: '2026-10-14', foods });
const daily = (o) => buildMissions({ now: NOW, ...o }).daily;
const weekly = (o) => buildMissions({ now: NOW, ...o }).weekly;

describe('getMonday', () => {
  it.each([
    ['a Wednesday', new Date(2026, 9, 14, 21, 30), new Date(2026, 9, 12)],
    ['a Monday', new Date(2026, 9, 12, 8, 0), new Date(2026, 9, 12)],
    ['a Sunday, which is the end of the week before', new Date(2026, 9, 18, 23, 59), new Date(2026, 9, 12)],
    ['the first of a month, a Sunday', new Date(2026, 10, 1, 9, 0), new Date(2026, 9, 26)],
  ])('is local midnight on the Monday of the week for %s', (_name, date, monday) => {
    expect(getMonday(date).getTime()).toBe(monday.getTime());
  });

  it('does not change the date it is given', () => {
    const d = new Date(2026, 9, 14, 21, 30);
    getMonday(d);
    expect(d.getTime()).toBe(new Date(2026, 9, 14, 21, 30).getTime());
  });
});

describe('buildMissions', () => {
  it('has the same missions, worth the same, with nothing done', () => {
    expect(buildMissions({ now: NOW })).toEqual({
      daily: [
        { title: 'Complete 1 workout', xp: 50, current: 0, target: 1 },
        { title: 'Log 3 meals', xp: 30, current: 0, target: 3 },
        { title: 'Walk 5,000 steps', xp: 40, current: 0, target: 5000 },
      ],
      weekly: [
        { title: 'Run 10km this week', xp: 200, current: 0, target: 10, unit: 'km' },
        { title: 'Complete 5 workouts', xp: 300, current: 0, target: 5 },
      ],
    });
    expect(DAILY_STEPS_TARGET).toBe(5000);
  });

  it('copes with every list missing', () => {
    expect(() => buildMissions()).not.toThrow();
    expect(buildMissions({ completedWorkouts: null, runs: undefined, completedHikes: null, mealsToday: null }).daily[0].current).toBe(0);
  });

  it('uses the clock when it is not given a time', () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      expect(buildMissions({ completedWorkouts: [workout(14)] }).daily[0].current).toBe(1);
      jest.setSystemTime(new Date(2026, 9, 15, 9, 0));
      expect(buildMissions({ completedWorkouts: [workout(14)] }).daily[0].current).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  describe('the workout missions', () => {
    it('counts a workout, a run and a hike today as workouts today', () => {
      expect(daily({ completedWorkouts: [workout(14)] })[0].current).toBe(1);
      expect(daily({ runs: [run(14)] })[0].current).toBe(1);
      expect(daily({ completedHikes: [hike(14)] })[0].current).toBe(1);
      expect(daily({ completedWorkouts: [workout(14)], runs: [run(14)], completedHikes: [hike(14)] })[0].current).toBe(3);
    });

    it('counts a 9 PM run as today\'s, though it is tomorrow in UTC', () => {
      const late = { id: 'r', startTime: '2026-10-15T01:00:00Z', endTime: '2026-10-15T01:00:00Z', distance: 5 };
      expect(daily({ runs: [late] })[0].current).toBe(1);
    });

    it('does not count yesterday toward today, but does toward the week', () => {
      const lists = { completedWorkouts: [workout(13)], runs: [run(13)], completedHikes: [hike(13)] };
      expect(daily(lists)[0].current).toBe(0);
      expect(weekly(lists)[1].current).toBe(3);
    });

    it('counts the week from Monday, so Sunday before is out', () => {
      const lists = { completedWorkouts: [workout(11), workout(12), workout(13)] };
      expect(weekly(lists)[1].current).toBe(2); // the 11th is last Sunday
    });

    it('counts a workout at the start of Monday and not one at the end of Sunday', () => {
      const sundayNight = { id: 'a', completedAt: new Date(2026, 9, 11, 23, 59).toISOString() };
      const mondayMorning = { id: 'b', completedAt: new Date(2026, 9, 12, 0, 0).toISOString() };
      expect(weekly({ completedWorkouts: [sundayNight] })[1].current).toBe(0);
      expect(weekly({ completedWorkouts: [mondayMorning] })[1].current).toBe(1);
    });
  });

  describe('the 10 km mission', () => {
    it('adds up this week\'s runs, from Monday', () => {
      const w = weekly({ runs: [run(12, 3.5), run(13, 2.5), run(11, 9)] });
      expect(w[0]).toEqual({ title: 'Run 10km this week', xp: 200, current: 6, target: 10, unit: 'km' });
    });

    it('counts a run that starts at the very start of Monday and not one that started a minute before', () => {
      const monday = { id: 'a', startTime: new Date(2026, 9, 12, 0, 0).toISOString(), endTime: new Date(2026, 9, 12, 0, 40).toISOString(), distance: 4 };
      const sunday = { id: 'b', startTime: new Date(2026, 9, 11, 23, 59).toISOString(), endTime: new Date(2026, 9, 12, 0, 30).toISOString(), distance: 7 };
      expect(weekly({ runs: [monday] })[0].current).toBe(4);
      expect(weekly({ runs: [sunday] })[0].current).toBe(0);
    });

    it('rounds to one decimal place', () => {
      expect(weekly({ runs: [run(12, 1.23), run(13, 2.04)] })[0].current).toBe(3.3);
    });

    it('is about runs only: a hike or a workout does not add to it', () => {
      expect(weekly({ runs: [run(12, 5)], completedHikes: [{ ...hike(13), distanceKm: 8 }], completedWorkouts: [{ ...workout(13), distance: 8 }] })[0].current).toBe(5);
    });

    it('treats a run with no distance as nothing', () => {
      expect(weekly({ runs: [{ id: 'x', startTime: noon(13), endTime: noon(13) }, run(12, 2)] })[0].current).toBe(2);
    });

    it('leaves out a run with no start time', () => {
      expect(weekly({ runs: [{ id: 'x', distance: 4 }, run(12, 2)] })[0].current).toBe(2);
    });
  });

  describe('the meals mission', () => {
    it('counts the meals that have foods in them', () => {
      expect(daily({ mealsToday: [meal(), meal(), meal()] })[1].current).toBe(3);
    });

    it('does not count a meal with no foods yet', () => {
      expect(daily({ mealsToday: [meal(), meal([]), { date: '2026-10-14' }] })[1].current).toBe(1);
    });

    it('is nothing without a diary', () => {
      expect(daily({})[1].current).toBe(0);
      expect(daily({ mealsToday: [] })[1].current).toBe(0);
    });
  });

  describe('the steps mission', () => {
    it('counts today\'s steps', () => {
      expect(daily({ steps: 3200, stepsDate: '2026-10-14' })[2]).toEqual({ title: 'Walk 5,000 steps', xp: 40, current: 3200, target: 5000 });
    });

    it('does not count a count from another day, or one with no day', () => {
      expect(daily({ steps: 9000, stepsDate: '2026-10-13' })[2].current).toBe(0);
      expect(daily({ steps: 9000, stepsDate: null })[2].current).toBe(0);
      expect(daily({ steps: 9000 })[2].current).toBe(0);
    });

    it('goes by the person\'s own day, not the UTC one, in the evening', () => {
      expect(daily({ steps: 4100, stepsDate: '2026-10-14' })[2].current).toBe(4100); // 9:30 PM on the 14th is the 15th in UTC
      expect(daily({ steps: 4100, stepsDate: '2026-10-15' })[2].current).toBe(0);
    });

    it.each([[undefined], [null], [NaN], ['lots'], [Infinity]])('is nothing for a count of %s', (bad) => {
      expect(daily({ steps: bad, stepsDate: '2026-10-14' })[2].current).toBe(0);
    });
  });
});

describe('missionsDone', () => {
  const m = (current, target) => ({ title: 't', xp: 1, current, target });

  it('counts the missions whose progress has reached the target', () => {
    expect(missionsDone([m(1, 1), m(2, 3), m(5000, 5000)])).toEqual({ done: 2, total: 3 });
  });

  it('counts one that has gone past its target', () => {
    expect(missionsDone([m(9000, 5000)])).toEqual({ done: 1, total: 1 });
  });

  it('counts none when none are done', () => {
    expect(missionsDone([m(0, 1), m(0, 3), m(4999, 5000)])).toEqual({ done: 0, total: 3 });
  });

  it('works on what buildMissions makes', () => {
    expect(missionsDone(buildMissions({ now: NOW, completedWorkouts: [workout(14)], steps: 6000, stepsDate: '2026-10-14' }).daily)).toEqual({ done: 2, total: 3 });
  });

  it.each([[undefined], [null], [{}], ['x'], [[]]])('is nothing for %s', (bad) => {
    expect(missionsDone(bad)).toEqual({ done: 0, total: 0 });
  });

  it('skips an entry that is not a mission', () => {
    expect(missionsDone([null, m(1, 1), undefined])).toEqual({ done: 1, total: 3 });
  });
});

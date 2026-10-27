import {
  ADVICE_BASE, DAILY_BASE_CAP, FORMCHECK_BASE_PER_REP, KEEP_DAYS, KEEP_IDS, LEVEL_CAP, MAX_ACTIVE_DAYS, MAX_BACKDATE_DAYS,
  MAX_MULTIPLIER, MAX_STEPS_PER_DAY, MAX_TOTAL_XP, MEAL_BASES, MEAL_XP_PER_STAR, PLAN_BASE, RACE_BASE,
  applyClaim, boardChanged, dailyCap, dayKeyOf, dayNumber, emptyLedger, leaderboardFields, levelFromXp, levelMultiplier,
  mealXpForStars, monthKeyOf, normalizeLedger, streakFrom, utcDayKey, weekKeyOf, xpRequiredForLevel,
} from '../lib/xpRules';

// Monday 19 October 2026, 15:00 UTC.
const NOW = Date.UTC(2026, 9, 19, 15, 0, 0);
const TODAY = '2026-10-19';
let counter = 0;
const nextId = () => `claim-${(counter += 1)}`;

const file = (ledger, claim, options = {}) => applyClaim({ ledger, id: options.id || nextId(), claim, now: options.now || NOW, ageDays: options.ageDays });
const claim = (kind, extra = {}) => ({ kind, day: TODAY, ...extra });
const run = (extra = {}) => claim('run', { activity: 'run', distanceKm: 5, durationSec: 1800, ...extra });
// A ledger that is already at a level (the total is the least XP that level needs).
const atLevel = (level) => ({ ...emptyLedger(), total: xpRequiredForLevel(level), level });

describe('the level curve', () => {
  it('needs nothing for level 1 and 1,000 XP for level 2', () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(0)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(1000);
    expect(xpRequiredForLevel(3)).toBe(2030);
  });

  it('finds the level a total falls in, at the edges', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(999.99)).toBe(1);
    expect(levelFromXp(1000)).toBe(2);
    expect(levelFromXp(2029)).toBe(2);
    expect(levelFromXp(2030)).toBe(3);
  });

  it('stops at the level cap', () => {
    expect(levelFromXp(xpRequiredForLevel(LEVEL_CAP))).toBe(LEVEL_CAP);
    expect(levelFromXp(MAX_TOTAL_XP * 100)).toBe(LEVEL_CAP);
  });

  it('multiplies by 3.6% for each level, up to the maximum', () => {
    expect(levelMultiplier(1)).toBe(1);
    expect(levelMultiplier(2)).toBeCloseTo(1.036, 10);
    expect(levelMultiplier(10)).toBeCloseTo(Math.pow(1.036, 9), 10);
    expect(levelMultiplier(LEVEL_CAP)).toBe(MAX_MULTIPLIER);
  });

  it('gives a new account a lower daily limit than a veteran', () => {
    expect(dailyCap(1)).toBe(DAILY_BASE_CAP);
    expect(dailyCap(LEVEL_CAP)).toBe(DAILY_BASE_CAP * MAX_MULTIPLIER);
    expect(dailyCap(20)).toBeGreaterThan(dailyCap(10));
  });
});

describe('days', () => {
  it('turns a day key into a number and back', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayKeyOf(dayNumber('2026-10-19'))).toBe('2026-10-19');
    expect(dayNumber('2026-10-20') - dayNumber('2026-10-19')).toBe(1);
    expect(utcDayKey(NOW)).toBe(TODAY);
    expect(utcDayKey(Date.UTC(2026, 9, 19, 23, 59, 59))).toBe(TODAY);
    expect(utcDayKey(Date.UTC(2026, 9, 20, 0, 0, 0))).toBe('2026-10-20');
  });

  it('refuses anything that is not a real calendar day', () => {
    ['', null, undefined, 20261019, '2026-10-32', '2026-13-01', '2026-02-30', '2026-1-1', '2026/10/19', '2026-10-19T00:00'].forEach((bad) => {
      expect(dayNumber(bad)).toBeNull();
    });
    expect(dayNumber('2028-02-29')).not.toBeNull();
    expect(dayNumber('2027-02-29')).toBeNull();
  });

  it('names the week by its Monday, and the month', () => {
    expect(weekKeyOf('2026-10-19')).toBe('w20261019'); // a Monday
    expect(weekKeyOf('2026-10-25')).toBe('w20261019'); // the Sunday after
    expect(weekKeyOf('2026-10-26')).toBe('w20261026');
    expect(weekKeyOf('2026-10-18')).toBe('w20261012'); // the Sunday before
    expect(weekKeyOf('2026-11-01')).toBe('w20261026'); // a week that crosses a month
    expect(weekKeyOf('nonsense')).toBeNull();
    expect(monthKeyOf('2026-10-19')).toBe('m202610');
    expect(monthKeyOf('2026-01-01')).toBe('m202601');
    expect(monthKeyOf('nonsense')).toBeNull();
  });

  it('counts days in a row up to the latest active day', () => {
    expect(streakFrom(['2026-10-17', '2026-10-18', '2026-10-19'], TODAY)).toBe(3);
    expect(streakFrom(['2026-10-15', '2026-10-17', '2026-10-18', '2026-10-19'], TODAY)).toBe(3);
    expect(streakFrom(['2026-10-19'], TODAY)).toBe(1);
  });

  it('keeps a streak alive until the day after it, and no longer', () => {
    expect(streakFrom(['2026-10-17', '2026-10-18'], TODAY)).toBe(2); // not yet today
    expect(streakFrom(['2026-10-16', '2026-10-17'], TODAY)).toBe(0); // two days ago
    expect(streakFrom([], TODAY)).toBe(0);
    expect(streakFrom(null, TODAY)).toBe(0);
    expect(streakFrom(['2026-10-19'], 'bad')).toBe(0);
  });

  it('ignores bad day keys and repeats', () => {
    expect(streakFrom(['2026-10-19', '2026-10-19', 'junk', '2026-10-18'], TODAY)).toBe(2);
  });
});

describe('a workout claim', () => {
  it('is worth its base XP at level 1', () => {
    const { ledger, outcome } = file(null, claim('workout', { baseExp: 200 }));
    expect(outcome).toEqual({ status: 'awarded', amount: 200, reason: null });
    expect(ledger.total).toBe(200);
    expect(ledger.level).toBe(1);
  });

  it('is multiplied by the level multiplier of the ledger, not by anything in the claim', () => {
    const { outcome } = file(atLevel(10), claim('workout', { baseExp: 200, multiplier: 5, level: 100 }));
    expect(outcome.amount).toBe(Math.round(200 * levelMultiplier(10)));
  });

  it.each([[0], [-5], [3001], [100.5], ['200'], [null], [NaN], [Infinity]])('refuses a base of %p', (baseExp) => {
    const { ledger, outcome } = file(null, claim('workout', { baseExp }));
    expect(outcome).toEqual({ status: 'rejected', reason: 'invalid', amount: 0 });
    expect(ledger.total).toBe(0);
  });

  it('refuses a claim with no base at all', () => {
    expect(file(null, claim('workout')).outcome.reason).toBe('invalid');
  });

  it('pays up to ten a day', () => {
    let ledger = null;
    for (let i = 0; i < 10; i++) ledger = file(ledger, claim('workout', { baseExp: 10 })).ledger;
    const eleventh = file(ledger, claim('workout', { baseExp: 10 }));
    expect(eleventh.outcome.reason).toBe('too-many');
    expect(eleventh.ledger.total).toBe(100);
    // ...and another day starts again.
    expect(file(ledger, claim('workout', { baseExp: 10, day: '2026-10-18' })).outcome.status).toBe('awarded');
  });

  it('counts toward the workouts line and the streak', () => {
    const { ledger } = file(null, claim('workout', { baseExp: 100 }));
    expect(ledger.sources.workouts).toBe(100);
    expect(ledger.activeDays).toEqual([TODAY]);
    expect(ledger.streak).toBe(1);
  });
});

describe('a run claim', () => {
  it('is worked out from the distance, not from a number in the claim', () => {
    const { outcome } = file(null, run({ distanceKm: 5.2, baseExp: 99999 }));
    expect(outcome.amount).toBe(156); // 5.2 km at 30 XP a km
  });

  it('pays a walk less per kilometre', () => {
    expect(file(null, run({ activity: 'walk', distanceKm: 5, durationSec: 3600 })).outcome.amount).toBe(90);
  });

  it('refuses an activity that is not a run or a walk', () => {
    ['bike', '', undefined, '__proto__', 'constructor', 7].forEach((activity) => {
      expect(file(null, run({ activity })).outcome.reason).toBe('invalid');
    });
  });

  it('refuses a pace nobody could run, but allows a very quick one', () => {
    expect(file(null, run({ distanceKm: 10, durationSec: 1000 })).outcome.reason).toBe('too-fast'); // 1:40 /km
    expect(file(null, run({ distanceKm: 10, durationSec: 1499 })).outcome.reason).toBe('too-fast');
    expect(file(null, run({ distanceKm: 10, durationSec: 1500 })).outcome.status).toBe('awarded'); // exactly 2:30 /km
  });

  it.each([
    ['no distance', { distanceKm: 0 }],
    ['a negative distance', { distanceKm: -3 }],
    ['a distance that is not a number', { distanceKm: '5' }],
    ['a distance past the limit', { distanceKm: 251, durationSec: 999999 }],
    ['no time', { durationSec: 0 }],
    ['under ten seconds', { distanceKm: 0.01, durationSec: 9 }],
    ['a time that is not a number', { durationSec: NaN }],
    ['a run too short to earn any XP', { distanceKm: 0.01, durationSec: 60 }],
  ])('refuses %s', (label, extra) => {
    expect(file(null, run(extra)).outcome.status).toBe('rejected');
  });

  it('adds the distance to this week and this month', () => {
    const { ledger } = file(null, run({ distanceKm: 5.2 }));
    expect(ledger.distance).toEqual({ weeks: { w20261019: 5.2 }, months: { m202610: 5.2 } });
    const second = file(ledger, run({ distanceKm: 3.05 })).ledger;
    expect(second.distance.weeks.w20261019).toBe(8.25);
    expect(second.distance.months.m202610).toBe(8.25);
  });

  it('puts a run on the week and month of the day it was run', () => {
    const { ledger } = file(null, run({ day: '2026-10-18' })); // the Sunday before
    expect(Object.keys(ledger.distance.weeks)).toEqual(['w20261012']);
    const crossing = file(null, run({ day: '2026-10-19' }), { now: Date.UTC(2026, 10, 1, 12) }); // claimed in November for October
    expect(Object.keys(crossing.ledger.distance.months)).toEqual(['m202610']);
  });

  it('keeps only the latest two weeks and months', () => {
    let ledger = null;
    [['2026-09-14'], ['2026-09-28'], ['2026-10-05'], ['2026-10-19']].forEach(([day]) => {
      ledger = file(ledger, run({ day, distanceKm: 1 }), { now: NOW }).ledger;
    });
    expect(Object.keys(ledger.distance.weeks)).toEqual(['w20261005', 'w20261019']);
    expect(Object.keys(ledger.distance.months)).toEqual(['m202609', 'm202610']);
  });

  it('does not add distance for anything but a run', () => {
    const { ledger } = file(null, claim('hike', { distanceKm: 8, durationSec: 7200, multiplier: 1.4 }));
    expect(ledger.distance).toEqual({ weeks: {}, months: {} });
  });
});

describe('a hike claim', () => {
  const hike = (extra = {}) => claim('hike', { distanceKm: 10, durationSec: 10000, multiplier: 1.4, ...extra });

  it('is 40 XP a km times the difficulty, times the level multiplier', () => {
    expect(file(null, hike()).outcome.amount).toBe(560);
    expect(file(atLevel(10), hike()).outcome.amount).toBe(Math.round(400 * levelMultiplier(10) * 1.4));
  });

  it('only takes the difficulty multipliers the app has', () => {
    [1, 1.4, 1.8, 2.2, 2.6].forEach((multiplier) => expect(file(null, hike({ multiplier })).outcome.status).toBe('awarded'));
    [0, 1.5, 3, 100, '1.4', undefined].forEach((multiplier) => expect(file(null, hike({ multiplier })).outcome.reason).toBe('invalid'));
  });

  it('refuses a distance past the limit, no time, and a pace nobody could hike', () => {
    expect(file(null, hike({ distanceKm: 101, durationSec: 999999 })).outcome.reason).toBe('invalid');
    expect(file(null, hike({ durationSec: 0 })).outcome.reason).toBe('invalid');
    expect(file(null, hike({ distanceKm: 10, durationSec: 100 })).outcome.reason).toBe('too-fast');
  });

  it('keeps the streak but is not counted on a line of the breakdown', () => {
    const { ledger } = file(null, hike());
    expect(ledger.streak).toBe(1);
    expect(ledger.sources).toEqual({ workouts: 0, nutrition: 0, social: 0 });
  });
});

describe('a meal claim', () => {
  const meal = (extra = {}) => claim('meal', { baseExp: 44, foodKey: 'Banana', ...extra });

  it('is worth one of the ten half-star amounts and nothing else', () => {
    [6, 11, 17, 22, 28, 33, 39, 44, 50, 55].forEach((baseExp) => expect(file(null, meal({ baseExp })).outcome.amount).toBe(baseExp));
    [0, 1, 5, 7, 12, 34, 56, 1000, 33.5, -33].forEach((baseExp) => expect(file(null, meal({ baseExp })).outcome.reason).toBe('invalid'));
  });

  it('keeps the amounts a 3, 4 and 5 star food has always been worth, and pays 11 XP a star', () => {
    expect(MEAL_XP_PER_STAR).toBe(11);
    expect([3, 4, 5].map(mealXpForStars)).toEqual([33, 44, 55]);
    expect([1, 2].map(mealXpForStars)).toEqual([11, 22]);
  });

  it('pays half a star as half of 11 XP, rounded up to the whole number', () => {
    expect([0.5, 1.5, 2.5, 3.5, 4.5].map(mealXpForStars)).toEqual([6, 17, 28, 39, 50]);
  });

  it('lists exactly the amounts a half-star rating can be worth, lowest first', () => {
    expect(MEAL_BASES).toEqual([6, 11, 17, 22, 28, 33, 39, 44, 50, 55]);
    expect(MEAL_BASES).toEqual([...MEAL_BASES].sort((a, b) => a - b));
  });

  it('pays more for more stars, and the top is no more than it was', () => {
    for (let i = 1; i < MEAL_BASES.length; i++) expect(MEAL_BASES[i]).toBeGreaterThan(MEAL_BASES[i - 1]);
    expect(MEAL_BASES[MEAL_BASES.length - 1]).toBe(55);
  });

  it('pays a food once a day, however it is typed', () => {
    const first = file(null, meal());
    expect(first.outcome.status).toBe('awarded');
    expect(first.ledger.sources.nutrition).toBe(44);
    ['Banana', 'banana', '  BANANA  '].forEach((foodKey) => {
      expect(file(first.ledger, meal({ foodKey })).outcome.reason).toBe('repeat');
    });
    expect(file(first.ledger, meal({ foodKey: 'apple' })).outcome.status).toBe('awarded');
  });

  it('pays the same food again the next day', () => {
    const first = file(null, meal({ day: '2026-10-18' }));
    expect(file(first.ledger, meal()).outcome.status).toBe('awarded');
  });

  it('refuses a claim with no food, or a food name that is too long', () => {
    ['', '   ', undefined, 5, 'x'.repeat(81)].forEach((foodKey) => expect(file(null, meal({ foodKey })).outcome.reason).toBe('invalid'));
    expect(file(null, meal({ foodKey: 'x'.repeat(80) })).outcome.status).toBe('awarded');
  });

  it('pays thirty different foods a day', () => {
    let ledger = null;
    for (let i = 0; i < 30; i++) ledger = file(ledger, meal({ foodKey: `food ${i}`, baseExp: 33 })).ledger;
    expect(file(ledger, meal({ foodKey: 'one more' })).outcome.reason).toBe('too-many');
  });

  it('is multiplied by the level multiplier', () => {
    expect(file(atLevel(20), meal({ baseExp: 55 })).outcome.amount).toBe(Math.round(55 * levelMultiplier(20)));
  });
});

describe('the fixed-value claims', () => {
  it.each([
    ['plan', PLAN_BASE],
    ['advice', ADVICE_BASE],
    ['race', RACE_BASE],
  ])('%s is worth one amount, whatever the claim says', (kind, base) => {
    expect(file(null, claim(kind, { baseExp: base })).outcome.amount).toBe(base);
    expect(file(null, claim(kind, { baseExp: base + 1 })).outcome.reason).toBe('invalid');
    expect(file(null, claim(kind, { baseExp: 1 })).outcome.reason).toBe('invalid');
  });

  it('plan and advice are paid twice a day each', () => {
    let ledger = null;
    ledger = file(ledger, claim('plan', { baseExp: PLAN_BASE })).ledger;
    ledger = file(ledger, claim('plan', { baseExp: PLAN_BASE })).ledger;
    expect(file(ledger, claim('plan', { baseExp: PLAN_BASE })).outcome.reason).toBe('too-many');
    expect(file(ledger, claim('advice', { baseExp: ADVICE_BASE })).outcome.status).toBe('awarded');
  });

  it('a form check is 40 XP a rep, up to sixty reps', () => {
    expect(file(null, claim('formcheck', { baseExp: FORMCHECK_BASE_PER_REP * 12 })).outcome.amount).toBe(480);
    expect(file(null, claim('formcheck', { baseExp: FORMCHECK_BASE_PER_REP * 60 })).outcome.status).toBe('awarded');
    [0, 39, 41, FORMCHECK_BASE_PER_REP * 61, 100000].forEach((baseExp) => {
      expect(file(null, claim('formcheck', { baseExp })).outcome.reason).toBe('invalid');
    });
  });

  it('a journey is worth 500, 1,000 or 2,000', () => {
    [500, 1000, 2000].forEach((baseExp) => expect(file(null, claim('journey', { baseExp })).outcome.amount).toBe(baseExp));
    [0, 499, 750, 5000].forEach((baseExp) => expect(file(null, claim('journey', { baseExp })).outcome.reason).toBe('invalid'));
  });

  it('a journey or a race counts on the workouts line', () => {
    expect(file(null, claim('journey', { baseExp: 500 })).ledger.sources.workouts).toBe(500);
    expect(file(null, claim('race', { baseExp: RACE_BASE })).ledger.sources.workouts).toBe(RACE_BASE);
  });
});

describe('a water claim', () => {
  const water = (tier, extra = {}) => claim('hydration', { tier, ...extra });

  it('pays each tier reached once, and not at the level multiplier', () => {
    let step = file(atLevel(30), water(1));
    expect(step.outcome.amount).toBe(11);
    step = file(step.ledger, water(2));
    expect(step.outcome.amount).toBe(22);
    expect(step.ledger.total).toBe(xpRequiredForLevel(30) + 33);
  });

  it('pays every tier a jump skips', () => {
    expect(file(null, water(4)).outcome.amount).toBe(11 + 22 + 33 + 44);
    const partway = file(null, water(2)).ledger;
    expect(file(partway, water(5)).outcome.amount).toBe(33 + 44 + 55);
  });

  it('pays nothing for a tier already paid', () => {
    const first = file(null, water(3)).ledger;
    expect(file(first, water(3)).outcome.reason).toBe('nothing-new');
    expect(file(first, water(2)).outcome.reason).toBe('nothing-new');
  });

  it('tracks each day on its own', () => {
    const yesterday = file(null, water(5, { day: '2026-10-18' })).ledger;
    expect(file(yesterday, water(1)).outcome.amount).toBe(11);
  });

  it.each([[0], [6], [1.5], ['3'], [undefined], [-1]])('refuses tier %p', (tier) => {
    expect(file(null, water(tier)).outcome.reason).toBe('invalid');
  });
});

describe('a steps claim', () => {
  const steps = (count, extra = {}) => claim('steps', { steps: count, ...extra });

  it('pays a tenth of an XP for each step, for the steps not yet paid', () => {
    let step = file(null, steps(1000));
    expect(step.outcome.amount).toBe(100);
    step = file(step.ledger, steps(1500));
    expect(step.outcome.amount).toBe(50);
    expect(step.ledger.total).toBe(150);
  });

  it('is not multiplied by the level', () => {
    expect(file(atLevel(50), steps(1000)).outcome.amount).toBe(100);
  });

  it('pays nothing for a count that is not higher than the last', () => {
    const first = file(null, steps(2000)).ledger;
    expect(file(first, steps(2000)).outcome.reason).toBe('nothing-new');
    expect(file(first, steps(1500)).outcome.reason).toBe('nothing-new');
  });

  it('rounds to a hundredth of an XP', () => {
    expect(file(null, steps(7)).outcome.amount).toBe(0.7);
    const second = file(file(null, steps(7)).ledger, steps(10));
    expect(second.outcome.amount).toBe(0.3);
    expect(second.ledger.total).toBe(1);
  });

  it('allows up to the most steps in a day, and not past it', () => {
    expect(file(null, steps(MAX_STEPS_PER_DAY)).outcome.status).toBe('awarded');
    expect(file(null, steps(MAX_STEPS_PER_DAY + 1)).outcome.reason).toBe('invalid');
    [0, -4, 10.5, '500', undefined].forEach((count) => expect(file(null, steps(count)).outcome.reason).toBe('invalid'));
  });

  it('does not keep the streak', () => {
    expect(file(null, steps(1000)).ledger.streak).toBe(0);
  });
});

describe('which day a claim can be for', () => {
  const w = (day) => claim('workout', { baseExp: 100, day });

  it('accepts today, back to the backdate limit, and one day ahead for time zones', () => {
    expect(file(null, w(TODAY)).outcome.status).toBe('awarded');
    expect(file(null, w(dayKeyOf(dayNumber(TODAY) - MAX_BACKDATE_DAYS))).outcome.status).toBe('awarded');
    expect(file(null, w('2026-10-20')).outcome.status).toBe('awarded');
  });

  it('refuses a day before that, two days ahead, and anything that is not a day', () => {
    expect(file(null, w(dayKeyOf(dayNumber(TODAY) - MAX_BACKDATE_DAYS - 1))).outcome.reason).toBe('bad-day');
    expect(file(null, w('2026-10-21')).outcome.reason).toBe('bad-day');
    ['', null, undefined, '2026-02-30', 'today', 20261019].forEach((day) => expect(file(null, w(day)).outcome.reason).toBe('bad-day'));
  });

  it('goes by the server clock, not by the phone', () => {
    expect(file(null, w('2026-10-19'), { now: Date.UTC(2026, 11, 25) }).outcome.reason).toBe('bad-day');
  });
});

describe('the daily limit', () => {
  it('trims the award that goes over, and then refuses the rest of the day', () => {
    const nearly = { ...emptyLedger(), days: { [TODAY]: { xp: DAILY_BASE_CAP - 10 } } };
    const over = file(nearly, claim('workout', { baseExp: 100 }));
    expect(over.outcome).toEqual({ status: 'awarded', amount: 10, reason: null });
    expect(over.ledger.days[TODAY].xp).toBe(DAILY_BASE_CAP);
    expect(over.ledger.total).toBe(10);
    expect(file(over.ledger, claim('plan', { baseExp: PLAN_BASE })).outcome).toEqual({ status: 'rejected', reason: 'daily-cap', amount: 0 });
  });

  it('adds up every kind of claim toward the same limit', () => {
    let ledger = atLevel(100);
    for (let i = 0; i < 3; i++) ledger = file(ledger, claim('workout', { baseExp: 1300 })).ledger; // 6,500 each
    expect(ledger.days[TODAY].xp).toBe(19500);
    const last = file(ledger, claim('plan', { baseExp: PLAN_BASE })); // would be 5,625; 500 is left
    expect(last.outcome.amount).toBe(500);
    expect(file(last.ledger, claim('journey', { baseExp: 500 })).outcome.reason).toBe('daily-cap');
  });

  it('is a separate allowance each day', () => {
    const full = { ...emptyLedger(), days: { [TODAY]: { xp: DAILY_BASE_CAP } } };
    expect(file(full, claim('workout', { baseExp: 500 })).outcome.reason).toBe('daily-cap');
    expect(file(full, claim('workout', { baseExp: 500, day: '2026-10-18' })).outcome.status).toBe('awarded');
  });

  it('is higher at a higher level', () => {
    const veteran = { ...atLevel(60), days: { [TODAY]: { xp: DAILY_BASE_CAP + 100 } } };
    expect(file(veteran, claim('workout', { baseExp: 100 })).outcome.status).toBe('awarded');
    const newcomer = { ...emptyLedger(), days: { [TODAY]: { xp: DAILY_BASE_CAP + 100 } } };
    expect(file(newcomer, claim('workout', { baseExp: 100 })).outcome.reason).toBe('daily-cap');
  });
});

describe('the record that is kept', () => {
  it('remembers the id of every claim, rejected ones too, and only the latest', () => {
    let ledger = file(null, claim('workout', { baseExp: 0 }), { id: 'bad' }).ledger;
    expect(ledger.ids).toEqual(['bad']);
    for (let i = 0; i < KEEP_IDS + 5; i++) ledger = file(ledger, claim('steps', { steps: i + 1 }), { id: `s${i}` }).ledger;
    expect(ledger.ids).toHaveLength(KEEP_IDS);
    expect(ledger.ids[KEEP_IDS - 1]).toBe(`s${KEEP_IDS + 4}`);
    expect(ledger.ids).not.toContain('bad');
  });

  it('forgets the counts of days older than it needs', () => {
    const old = dayKeyOf(dayNumber(TODAY) - KEEP_DAYS - 1);
    const recent = dayKeyOf(dayNumber(TODAY) - 5);
    const ledger = { ...emptyLedger(), days: { [old]: { xp: 5 }, [recent]: { xp: 7 } } };
    const { ledger: next } = file(ledger, claim('workout', { baseExp: 100 }));
    expect(Object.keys(next.days).sort()).toEqual([recent, TODAY].sort());
  });

  it('works out the level from the total', () => {
    const { ledger } = file({ ...emptyLedger(), total: 950 }, claim('workout', { baseExp: 100 }));
    expect(ledger.total).toBe(1050);
    expect(ledger.level).toBe(2);
  });

  it('never goes past the most XP a record can hold', () => {
    const { ledger } = file({ ...emptyLedger(), total: MAX_TOTAL_XP - 1 }, claim('workout', { baseExp: 500 }));
    expect(ledger.total).toBe(MAX_TOTAL_XP);
  });

  it('keeps the streak for workouts, runs and hikes and not for the rest', () => {
    let ledger = file(null, claim('workout', { baseExp: 100, day: '2026-10-17' })).ledger;
    ledger = file(ledger, run({ day: '2026-10-18' })).ledger;
    expect(ledger.streak).toBe(2);
    ledger = file(ledger, claim('meal', { baseExp: 33, foodKey: 'egg' })).ledger;
    expect(ledger.activeDays).toEqual(['2026-10-17', '2026-10-18']);
    ledger = file(ledger, claim('hike', { distanceKm: 3, durationSec: 3600, multiplier: 1 })).ledger;
    expect(ledger.streak).toBe(3);
  });

  it('lets a streak run out when nothing new is claimed for days', () => {
    const ledger = file(null, claim('workout', { baseExp: 100, day: '2026-10-10' }), { now: Date.UTC(2026, 9, 10, 12) }).ledger;
    expect(ledger.streak).toBe(1);
    const later = file(ledger, claim('steps', { steps: 500 }));
    expect(later.ledger.streak).toBe(0);
  });

  it('keeps only the most recent active days', () => {
    const days = Array.from({ length: MAX_ACTIVE_DAYS + 20 }, (_, i) => dayKeyOf(dayNumber('2025-01-01') + i));
    const { ledger } = file({ ...emptyLedger(), activeDays: days }, claim('workout', { baseExp: 100 }));
    expect(ledger.activeDays).toHaveLength(MAX_ACTIVE_DAYS);
    expect(ledger.activeDays[MAX_ACTIVE_DAYS - 1]).toBe(TODAY);
  });

  it('does not change the ledger it was given', () => {
    const before = file(null, run({ distanceKm: 4 })).ledger;
    const snapshot = JSON.stringify(before);
    file(before, claim('meal', { baseExp: 55, foodKey: 'rice' }));
    file(before, run({ distanceKm: 2 }));
    file(before, claim('workout', { baseExp: 0 }));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('a claim that is not a claim', () => {
  it.each([[null], [undefined], ['workout'], [42], [[]], [{}], [{ kind: 'bogus', day: TODAY }], [{ kind: 'workout' }]])('is refused, not thrown on: %p', (bad) => {
    const result = file(null, bad);
    expect(result.outcome.status).toBe('rejected');
    expect(result.ledger.total).toBe(0);
  });

  it('is refused when it has no id', () => {
    expect(applyClaim({ ledger: null, id: '', claim: claim('workout', { baseExp: 100 }), now: NOW }).outcome.reason).toBe('invalid');
    expect(applyClaim({ ledger: null, id: undefined, claim: claim('workout', { baseExp: 100 }), now: NOW }).outcome.reason).toBe('invalid');
  });

  it('cannot reach the ledger through the claim', () => {
    const { ledger } = file(null, claim('workout', { baseExp: 100, total: 9999999, level: 100, streak: 5000, ids: ['x'], imported: true, days: {} }));
    expect(ledger.total).toBe(100);
    expect(ledger.level).toBe(1);
    expect(ledger.imported).toBe(false);
  });
});

describe('the one-off import of XP from before the ledger', () => {
  const imported = (extra = {}, options = {}) => file(null, { kind: 'import', day: TODAY, total: 12000, ...extra }, options);

  it('adds what the phone had, once', () => {
    const first = imported({}, { ageDays: 60 });
    expect(first.outcome).toEqual({ status: 'awarded', amount: 12000, reason: null });
    expect(first.ledger.total).toBe(12000);
    expect(first.ledger.level).toBe(levelFromXp(12000));
    expect(first.ledger.imported).toBe(true);
    const again = file(first.ledger, { kind: 'import', day: TODAY, total: 500 }, { ageDays: 60 });
    expect(again.outcome.reason).toBe('already-imported');
    expect(again.ledger.total).toBe(12000);
  });

  it('adds to what claims have already earned', () => {
    const earned = file(null, claim('workout', { baseExp: 300 })).ledger;
    expect(file(earned, { kind: 'import', total: 1000 }, { ageDays: 30 }).ledger.total).toBe(1300);
  });

  it('is no more than an account that old could have earned', () => {
    const young = imported({ total: 5000000 }, { ageDays: 0 });
    expect(young.outcome.amount).toBe(dailyCap(LEVEL_CAP));
    const older = imported({ total: 5000000 }, { ageDays: 9 });
    expect(older.outcome.amount).toBe(dailyCap(LEVEL_CAP) * 10);
    expect(imported({ total: 5000000 }, { ageDays: 100000 }).outcome.amount).toBe(MAX_TOTAL_XP);
  });

  it('knows nothing about an account whose age is unknown, so allows one day', () => {
    expect(imported({ total: 5000000 }).outcome.amount).toBe(dailyCap(LEVEL_CAP));
  });

  it.each([[-1], ['5000'], [undefined], [NaN], [null]])('refuses a total of %p', (total) => {
    const result = file(null, { kind: 'import', day: TODAY, total }, { ageDays: 60 });
    expect(result.outcome.reason).toBe('invalid');
    expect(result.ledger.imported).toBe(false);
  });

  it('takes the active days that are real and not older than the account, for the streak', () => {
    const { ledger } = imported({
      total: 100,
      activeDays: ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-25', '2026-10-01', 'junk', 5],
    }, { ageDays: 3 });
    // Today and yesterday and the day before, the day ahead (time zones), but not next week or before the account.
    expect(ledger.activeDays).toEqual(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
    expect(ledger.streak).toBe(4);
  });

  it('cannot give a new account a long streak', () => {
    const days = Array.from({ length: 60 }, (_, i) => dayKeyOf(dayNumber(TODAY) - i));
    const { ledger } = imported({ total: 100, activeDays: days }, { ageDays: 4 });
    expect(ledger.activeDays).toHaveLength(6);
  });

  it('does not count against any day\'s limit', () => {
    const { ledger } = imported({}, { ageDays: 60 });
    expect(ledger.days).toEqual({});
  });
});

describe('the leaderboard entry', () => {
  it('shows XP, level, streak and the latest two weeks and months of distance', () => {
    const ledger = {
      ...emptyLedger(), total: 1234.5, level: 2, streak: 4,
      distance: {
        weeks: { w20260928: 1, w20261005: 2, w20261012: 3 },
        months: { m202608: 4, m202609: 5, m202610: 6 },
      },
    };
    expect(leaderboardFields(ledger)).toEqual({
      xp: 1234.5, level: 2, streak: 4,
      distance: { w20261005: 2, w20261012: 3, m202609: 5, m202610: 6 },
    });
  });

  it('has no distance for someone who has not run', () => {
    expect(leaderboardFields(null)).toEqual({ xp: 0, level: 1, streak: 0, distance: {} });
  });

  it('notices when what shows has changed, and when it has not', () => {
    const a = file(null, claim('workout', { baseExp: 100 })).ledger;
    const b = file(a, claim('workout', { baseExp: 100 })).ledger;
    expect(boardChanged(a, b)).toBe(true);
    expect(boardChanged(a, file(a, claim('workout', { baseExp: 0 })).ledger)).toBe(false);
    expect(boardChanged(null, a)).toBe(true);
  });
});

describe('a ledger read back', () => {
  it('fills in anything that is missing and ignores junk', () => {
    expect(normalizeLedger(null)).toEqual(emptyLedger());
    expect(normalizeLedger('nope')).toEqual(emptyLedger());
    const odd = normalizeLedger({ total: -5, days: [], activeDays: ['2026-10-19', 'junk'], ids: ['a', 7], sources: { workouts: 3 }, imported: 'yes' });
    expect(odd.total).toBe(0);
    expect(odd.days).toEqual({});
    expect(odd.activeDays).toEqual(['2026-10-19']);
    expect(odd.ids).toEqual(['a']);
    expect(odd.sources).toEqual({ workouts: 3, nutrition: 0, social: 0 });
    expect(odd.imported).toBe(false);
  });

  it('keeps the total within the limit and works the level out from it', () => {
    const l = normalizeLedger({ total: MAX_TOTAL_XP * 2, level: 1 });
    expect(l.total).toBe(MAX_TOTAL_XP);
    expect(l.level).toBe(LEVEL_CAP);
  });
});

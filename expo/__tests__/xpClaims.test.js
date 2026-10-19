// What the app files for XP (lib/xpClaims.js): the activity objects the app has always made, turned into claims for the server.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import {
  claimFromActivity, hydrationClaim, importClaim, kindOfActivity, stepsClaim,
} from '../lib/xpClaims';
import { CLAIM_KINDS, MAX_ACTIVE_DAYS, MAX_FOOD_KEY, applyClaim } from '../lib/xpRules';

const NOW = new Date('2026-10-15T01:30:00Z').getTime();
const TODAY = '2026-10-14';

// What the server would make of one claim, on a fresh account.
const serverSays = (body, id = 'x-1') => applyClaim({ ledger: null, id, claim: body, now: NOW }).outcome;

describe('kindOfActivity', () => {
  it('gives each activity type its kind', () => {
    expect(kindOfActivity({ type: 'workout' })).toBe('workout');
    expect(kindOfActivity({ type: 'running', id: 'run-9' })).toBe('run');
    expect(kindOfActivity({ type: 'hiking' })).toBe('hike');
    expect(kindOfActivity({ type: 'meal' })).toBe('meal');
    expect(kindOfActivity({ type: 'mainMission' })).toBe('plan');
    expect(kindOfActivity({ type: 'sideMission' })).toBe('advice');
  });

  it('tells a journey and a race from a run by the id', () => {
    expect(kindOfActivity({ type: 'running', id: 'journey-42' })).toBe('journey');
    expect(kindOfActivity({ type: 'running', id: 'race-5k' })).toBe('race');
    expect(kindOfActivity({ type: 'running', id: 'journeyman' })).toBe('run');
    expect(kindOfActivity({ type: 'running' })).toBe('run');
  });

  it('takes an explicit kind over the type', () => {
    expect(kindOfActivity({ type: 'workout', kind: 'formcheck' })).toBe('formcheck');
  });

  it('has no kind for what does not earn XP on the server', () => {
    expect(kindOfActivity({ type: 'event' })).toBeNull();
    expect(kindOfActivity({})).toBeNull();
    expect(kindOfActivity(null)).toBeNull();
    expect(kindOfActivity(undefined)).toBeNull();
    expect(kindOfActivity('workout')).toBeNull();
  });
});

describe('claimFromActivity: workouts, plans, advice, form checks, journeys and races', () => {
  it('claims the base XP and the day, nothing the person could use to claim more', () => {
    const claim = claimFromActivity({ id: 'w-7', type: 'workout', baseExp: 450, multiplier: 1, date: TODAY }, NOW);
    expect(claim).toEqual({ id: 'workout-w-7', body: { kind: 'workout', day: TODAY, baseExp: 450 } });
  });

  it('leaves out the multiplier and level: the server applies its own', () => {
    const { body } = claimFromActivity({ id: 'w-7', type: 'workout', baseExp: 450, multiplier: 99, level: 100, date: TODAY }, NOW);
    expect(Object.keys(body).sort()).toEqual(['baseExp', 'day', 'kind']);
  });

  it('rounds the base to a whole number', () => {
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 449.6, date: TODAY }, NOW).body.baseExp).toBe(450);
  });

  it('claims nothing for a base that is not above zero', () => {
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 0, date: TODAY }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: -5, date: TODAY }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 'lots', date: TODAY }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'w', type: 'workout', date: TODAY }, NOW)).toBeNull();
  });

  it('handles each of the kinds that carry only a base', () => {
    const kinds = {
      plan: { type: 'mainMission', baseExp: 1125 },
      advice: { type: 'sideMission', baseExp: 375 },
      formcheck: { type: 'workout', kind: 'formcheck', baseExp: 400 },
      journey: { type: 'running', id: 'journey-1', baseExp: 1000 },
      race: { type: 'running', id: 'race-1', baseExp: 750 },
    };
    Object.entries(kinds).forEach(([kind, activity]) => {
      const claim = claimFromActivity({ id: `${kind}-a`, date: TODAY, ...activity }, NOW);
      expect(claim.body).toEqual({ kind, day: TODAY, baseExp: activity.baseExp });
      expect(serverSays(claim.body, claim.id).status).toBe('awarded');
    });
  });

  it('files a claim the server will accept', () => {
    const claim = claimFromActivity({ id: 'w-7', type: 'workout', baseExp: 450, date: TODAY }, NOW);
    expect(serverSays(claim.body, claim.id)).toMatchObject({ status: 'awarded', amount: 450 });
  });
});

describe('claimFromActivity: the day', () => {
  it('uses the activity\'s own day when it is a real day', () => {
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 100, date: '2026-10-10' }, NOW).body.day).toBe('2026-10-10');
  });

  it('uses the person\'s own calendar day for now, not the UTC date', () => {
    // 01:30Z on the 15th is still the 14th in New Jersey.
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 100 }, NOW).body.day).toBe(TODAY);
  });

  it('falls back to today for a date that is not a real day', () => {
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 100, date: '2026-13-45' }, NOW).body.day).toBe(TODAY);
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 100, date: 'yesterday' }, NOW).body.day).toBe(TODAY);
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 100, date: 20261010 }, NOW).body.day).toBe(TODAY);
  });

  it('never makes a claim for a day the server would turn away', () => {
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 100, date: '2026-01-01' }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'w', type: 'workout', baseExp: 100, date: '2026-12-25' }, NOW)).toBeNull();
  });
});

describe('claimFromActivity: the id', () => {
  it('is the kind and the activity\'s own id, so one activity is claimed once', () => {
    const a = claimFromActivity({ id: 'abc', type: 'workout', baseExp: 100, date: TODAY }, NOW);
    const b = claimFromActivity({ id: 'abc', type: 'workout', baseExp: 100, date: TODAY }, NOW + 5000);
    expect(a.id).toBe('workout-abc');
    expect(b.id).toBe(a.id);
  });

  it('does not say the kind twice when the id already starts with it', () => {
    expect(claimFromActivity({ id: 'journey-77', type: 'running', baseExp: 1000, date: TODAY }, NOW).id).toBe('journey-77');
    expect(claimFromActivity({ id: 'race-9', type: 'running', baseExp: 750, date: TODAY }, NOW).id).toBe('race-9');
  });

  it('turns anything a document id may not hold into an underscore, and keeps it to 100 characters', () => {
    const odd = claimFromActivity({ id: 'a/b c.d', type: 'workout', baseExp: 100, date: TODAY }, NOW).id;
    expect(odd).toBe('workout-a_b_c_d');
    expect(odd).toMatch(/^[A-Za-z0-9_-]+$/);
    const long = claimFromActivity({ id: 'x'.repeat(300), type: 'workout', baseExp: 100, date: TODAY }, NOW).id;
    expect(long).toHaveLength(100);
    expect(long).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('uses the time when the activity has no id', () => {
    expect(claimFromActivity({ type: 'workout', baseExp: 100, date: TODAY }, NOW).id).toBe(`workout-${NOW}`);
    expect(claimFromActivity({ id: '', type: 'workout', baseExp: 100, date: TODAY }, NOW).id).toBe(`workout-${NOW}`);
    expect(claimFromActivity({ id: null, type: 'workout', baseExp: 100, date: TODAY }, NOW).id).toBe(`workout-${NOW}`);
  });

  it('is a number id turned into text', () => {
    expect(claimFromActivity({ id: 1760000000000, type: 'workout', baseExp: 100, date: TODAY }, NOW).id).toBe('workout-1760000000000');
  });
});

describe('claimFromActivity: meals', () => {
  it('claims the food by its lower-cased, trimmed name', () => {
    const claim = claimFromActivity({ id: 'm-1', type: 'meal', baseExp: 44, foodKey: '  Greek Yogurt ', date: TODAY }, NOW);
    expect(claim).toEqual({ id: 'meal-m-1', body: { kind: 'meal', day: TODAY, baseExp: 44, foodKey: 'greek yogurt' } });
  });

  it('cuts a long name to what the rules hold', () => {
    const { body } = claimFromActivity({ id: 'm', type: 'meal', baseExp: 33, foodKey: 'a'.repeat(500), date: TODAY }, NOW);
    expect(body.foodKey).toHaveLength(MAX_FOOD_KEY);
  });

  it('claims nothing without a food name or a base', () => {
    expect(claimFromActivity({ id: 'm', type: 'meal', baseExp: 44, date: TODAY }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'm', type: 'meal', baseExp: 44, foodKey: '   ', date: TODAY }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'm', type: 'meal', baseExp: 44, foodKey: 7, date: TODAY }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'm', type: 'meal', baseExp: 0, foodKey: 'egg', date: TODAY }, NOW)).toBeNull();
  });

  it('makes a claim the server accepts', () => {
    const claim = claimFromActivity({ id: 'm-1', type: 'meal', baseExp: 55, foodKey: 'egg', date: TODAY }, NOW);
    expect(serverSays(claim.body, claim.id)).toMatchObject({ status: 'awarded', amount: 55 });
  });
});

describe('claimFromActivity: runs', () => {
  const run = (extra = {}) => ({ id: 'r-1', type: 'running', activity: 'run', distanceKm: 5.2, durationSec: 1800, date: TODAY, ...extra });

  it('claims what was done: the distance and the time, not an XP amount', () => {
    const claim = claimFromActivity(run(), NOW);
    expect(claim).toEqual({ id: 'run-r-1', body: { kind: 'run', day: TODAY, activity: 'run', distanceKm: 5.2, durationSec: 1800 } });
  });

  it('is a walk only when it says so', () => {
    expect(claimFromActivity(run({ activity: 'walk', durationSec: 3600 }), NOW).body.activity).toBe('walk');
    expect(claimFromActivity(run({ activity: undefined }), NOW).body.activity).toBe('run');
    expect(claimFromActivity(run({ activity: 'swim' }), NOW).body.activity).toBe('run');
  });

  it('rounds the distance to a metre and the time to a second', () => {
    const { body } = claimFromActivity(run({ distanceKm: 5.123456, durationSec: 1800.6 }), NOW);
    expect(body.distanceKm).toBe(5.123);
    expect(body.durationSec).toBe(1801);
  });

  it('claims nothing without a distance and a time', () => {
    [{ distanceKm: 0 }, { distanceKm: -1 }, { distanceKm: undefined }, { distanceKm: 'far' }, { distanceKm: Infinity }, { distanceKm: NaN },
      { durationSec: 0 }, { durationSec: undefined }, { durationSec: -5 }, { durationSec: Infinity }].forEach((extra) => {
      expect(claimFromActivity(run(extra), NOW)).toBeNull();
    });
  });

  it('makes no claim for a pace nobody could run, a run longer than the limit, or one that is over in seconds', () => {
    expect(claimFromActivity(run({ distanceKm: 10, durationSec: 600 }), NOW)).toBeNull(); // 60 s per km
    expect(claimFromActivity(run({ distanceKm: 300, durationSec: 300 * 600 }), NOW)).toBeNull();
    expect(claimFromActivity(run({ distanceKm: 0.01, durationSec: 5 }), NOW)).toBeNull();
  });

  it('makes a claim the server accepts, worth the distance at the run rate', () => {
    const claim = claimFromActivity(run({ distanceKm: 5, durationSec: 1800 }), NOW);
    expect(serverSays(claim.body, claim.id)).toMatchObject({ status: 'awarded', amount: 150 });
  });
});

describe('claimFromActivity: hikes', () => {
  const hike = (extra = {}) => ({ id: 'h-1', type: 'hiking', distanceKm: 6, durationSec: 7200, multiplier: 1.4, date: TODAY, ...extra });

  it('claims the distance, the time and the difficulty multiplier', () => {
    expect(claimFromActivity(hike(), NOW)).toEqual({
      id: 'hike-h-1', body: { kind: 'hike', day: TODAY, distanceKm: 6, durationSec: 7200, multiplier: 1.4 },
    });
  });

  it('claims nothing without a distance, a time and a multiplier', () => {
    [{ distanceKm: 0 }, { durationSec: 0 }, { distanceKm: undefined }, { durationSec: undefined }, { multiplier: undefined },
      { multiplier: 'hard' }, { multiplier: NaN }].forEach((extra) => {
      expect(claimFromActivity(hike(extra), NOW)).toBeNull();
    });
  });

  it('makes no claim for a pace nobody could keep on foot', () => {
    expect(claimFromActivity(hike({ distanceKm: 30, durationSec: 1800 }), NOW)).toBeNull();
  });

  it('makes no claim for a multiplier the rules do not allow: the server would turn it away', () => {
    expect(serverSays({ kind: 'hike', day: TODAY, distanceKm: 6, durationSec: 7200, multiplier: 7 })).toMatchObject({ status: 'rejected', reason: 'invalid' });
    expect(claimFromActivity(hike({ multiplier: 7 }), NOW)).toBeNull();
    expect(claimFromActivity(hike({ multiplier: 1.5 }), NOW)).toBeNull();
  });

  it('makes a claim the server accepts', () => {
    const claim = claimFromActivity(hike({ distanceKm: 5, multiplier: 1 }), NOW);
    expect(serverSays(claim.body, claim.id)).toMatchObject({ status: 'awarded', amount: 200 });
  });
});

describe('claimFromActivity: what is not for the server', () => {
  it('gives null for an activity with no kind, or none at all', () => {
    expect(claimFromActivity({ id: 'e', type: 'event', baseExp: 100 }, NOW)).toBeNull();
    expect(claimFromActivity(null, NOW)).toBeNull();
    expect(claimFromActivity(undefined, NOW)).toBeNull();
  });

  it('gives null for a kind the app has no way to claim by activity', () => {
    expect(claimFromActivity({ id: 'x', kind: 'hydration', baseExp: 100 }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'x', kind: 'steps', baseExp: 100 }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'x', kind: 'import', baseExp: 100 }, NOW)).toBeNull();
    expect(claimFromActivity({ id: 'x', kind: 'bonus', baseExp: 100 }, NOW)).toBeNull();
  });

  it('uses the current time when none is given', () => {
    const claim = claimFromActivity({ type: 'workout', baseExp: 100 });
    expect(claim.id).toMatch(/^workout-\d+$/);
  });
});

describe('hydrationClaim', () => {
  it('is the day and the tier reached, with an id for that tier of that day', () => {
    expect(hydrationClaim(TODAY, 3)).toEqual({ id: `hydration-${TODAY}-3`, body: { kind: 'hydration', day: TODAY, tier: 3 } });
  });

  it('is accepted by the server', () => {
    const { body, id } = hydrationClaim(TODAY, 2);
    expect(serverSays(body, id)).toMatchObject({ status: 'awarded', amount: 33 });
  });
});

describe('stepsClaim', () => {
  it('is the day and the steps counted so far, with an id for that count', () => {
    expect(stepsClaim(TODAY, 4200)).toEqual({ id: `steps-${TODAY}-4200`, body: { kind: 'steps', day: TODAY, steps: 4200 } });
  });

  it('is accepted by the server, paid at a tenth of an XP a step', () => {
    const { body, id } = stepsClaim(TODAY, 4200);
    expect(serverSays(body, id)).toMatchObject({ status: 'awarded', amount: 420 });
  });
});

describe('importClaim', () => {
  it('is always the same claim id, so the XP is brought in once', () => {
    expect(importClaim({ day: TODAY, total: 100, activeDays: [] }).id).toBe('import-v1');
    expect(importClaim({ day: TODAY, total: 5000, activeDays: [] }).id).toBe('import-v1');
  });

  it('holds the day, the total and the days with activity, oldest first and without repeats', () => {
    const { body } = importClaim({ day: TODAY, total: 1234.5678, activeDays: ['2026-10-12', '2026-10-10', '2026-10-12', '2026-10-11'] });
    expect(body).toEqual({ kind: 'import', day: TODAY, total: 1234.57, activeDays: ['2026-10-10', '2026-10-11', '2026-10-12'] });
  });

  it('drops days that are not real days, and copes with no list', () => {
    expect(importClaim({ day: TODAY, total: 10, activeDays: ['2026-10-10', 'nope', '2026-02-31', 5, null] }).body.activeDays).toEqual(['2026-10-10']);
    expect(importClaim({ day: TODAY, total: 10 }).body.activeDays).toEqual([]);
    expect(importClaim({ day: TODAY, total: 10, activeDays: 'x' }).body.activeDays).toEqual([]);
  });

  it('keeps only the latest days when there are more than the rules hold', () => {
    const many = [];
    for (let i = 0; i < MAX_ACTIVE_DAYS + 25; i += 1) {
      const d = new Date(Date.UTC(2025, 0, 1) + i * 86400000);
      many.push(d.toISOString().slice(0, 10));
    }
    const { body } = importClaim({ day: TODAY, total: 10, activeDays: many });
    expect(body.activeDays).toHaveLength(MAX_ACTIVE_DAYS);
    expect(body.activeDays[body.activeDays.length - 1]).toBe(many[many.length - 1]);
  });

  it('never claims less than nothing, and treats a total that is not a number as nothing', () => {
    expect(importClaim({ day: TODAY, total: -50, activeDays: [] }).body.total).toBe(0);
    expect(importClaim({ day: TODAY, total: 'lots', activeDays: [] }).body.total).toBe(0);
    expect(importClaim({ day: TODAY, total: NaN, activeDays: [] }).body.total).toBe(0);
  });

  it('is accepted by the server for an account old enough to have earned it', () => {
    const { body, id } = importClaim({ day: TODAY, total: 3000, activeDays: ['2026-10-12', '2026-10-13', TODAY] });
    const { outcome } = applyClaim({ ledger: null, id, claim: body, now: NOW, ageDays: 200 });
    expect(outcome).toMatchObject({ status: 'awarded', amount: 3000 });
  });
});

describe('what the app can claim', () => {
  it('is only kinds the rules know', () => {
    const made = [
      claimFromActivity({ id: 'a', type: 'workout', baseExp: 100, date: TODAY }, NOW),
      claimFromActivity({ id: 'a', type: 'running', activity: 'run', distanceKm: 3, durationSec: 1200, date: TODAY }, NOW),
      claimFromActivity({ id: 'a', type: 'hiking', distanceKm: 3, durationSec: 5400, multiplier: 1, date: TODAY }, NOW),
      claimFromActivity({ id: 'a', type: 'meal', baseExp: 33, foodKey: 'egg', date: TODAY }, NOW),
      hydrationClaim(TODAY, 1),
      stepsClaim(TODAY, 500),
      importClaim({ day: TODAY, total: 10, activeDays: [] }),
    ];
    made.forEach((claim) => expect(CLAIM_KINDS).toContain(claim.body.kind));
  });
});

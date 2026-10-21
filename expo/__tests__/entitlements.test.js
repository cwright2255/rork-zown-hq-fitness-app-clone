import {
  TIERS, TIER_NAMES, FEATURES, FEATURE_NAMES, AI_BUCKETS, AI_DAILY_LIMITS, ENTITLED_STATUSES,
  bucketOf, dailyLimit, tierAtLeast, featureTier, canUseFeature, plainEntitlement, effectiveTier, aiDayKey,
} from '../lib/entitlements';

const NOW = new Date('2026-10-20T15:00:00.000Z');
const plan = (over = {}) => ({ tier: 'pro', status: 'active', expiresAt: null, source: 'manual', ...over });

describe('the plans', () => {
  it('are Free, Pro and Legend, each with a name', () => {
    expect(TIERS).toEqual(['free', 'pro', 'legend']);
    expect(TIER_NAMES).toEqual({ free: 'Free', pro: 'Pro', legend: 'Legend' });
  });

  it('go up: Legend has everything Pro has, and Pro everything Free has', () => {
    expect(tierAtLeast('legend', 'pro')).toBe(true);
    expect(tierAtLeast('legend', 'legend')).toBe(true);
    expect(tierAtLeast('pro', 'legend')).toBe(false);
    expect(tierAtLeast('pro', 'free')).toBe(true);
    expect(tierAtLeast('free', 'pro')).toBe(false);
    expect(tierAtLeast('free', 'free')).toBe(true);
  });

  it('treat a plan that does not exist as Free', () => {
    expect(tierAtLeast('platinum', 'pro')).toBe(false);
    expect(tierAtLeast(undefined, 'pro')).toBe(false);
    expect(tierAtLeast(undefined, 'free')).toBe(true);
  });
});

describe('which plan a feature needs', () => {
  it('puts AI workout plans, analytics and the daily Today brief on Pro and the body scan on Legend', () => {
    expect(FEATURES).toEqual({ aiWorkoutPlan: 'pro', analytics: 'pro', todayBrief: 'pro', bodyScan: 'legend' });
    expect(featureTier('aiWorkoutPlan')).toBe('pro');
    expect(featureTier('analytics')).toBe('pro');
    expect(featureTier('todayBrief')).toBe('pro');
    expect(featureTier('bodyScan')).toBe('legend');
  });

  it('opens the daily Today brief to Pro and Legend and not to Free', () => {
    expect(canUseFeature('free', 'todayBrief')).toBe(false);
    expect(canUseFeature('pro', 'todayBrief')).toBe(true);
    expect(canUseFeature('legend', 'todayBrief')).toBe(true);
    expect(FEATURE_NAMES.todayBrief).toBe('Daily Today brief');
  });

  it('names every locked feature, for the upgrade screens', () => {
    expect(Object.keys(FEATURE_NAMES).sort()).toEqual(Object.keys(FEATURES).sort());
  });

  it('leaves a feature that is not listed open to everyone', () => {
    expect(featureTier('logWorkout')).toBe('free');
    expect(canUseFeature('free', 'logWorkout')).toBe(true);
  });

  it('opens a feature to its plan and the plans above it only', () => {
    expect(canUseFeature('free', 'analytics')).toBe(false);
    expect(canUseFeature('pro', 'analytics')).toBe(true);
    expect(canUseFeature('legend', 'analytics')).toBe(true);
    expect(canUseFeature('free', 'bodyScan')).toBe(false);
    expect(canUseFeature('pro', 'bodyScan')).toBe(false);
    expect(canUseFeature('legend', 'bodyScan')).toBe(true);
  });
});

describe('the daily AI messages', () => {
  it('are 5 for Free, 100 for Pro and 300 for Legend, for the Coach and for the helpers', () => {
    for (const bucket of ['coach', 'assist']) {
      expect(dailyLimit('free', bucket)).toBe(5);
      expect(dailyLimit('pro', bucket)).toBe(100);
      expect(dailyLimit('legend', bucket)).toBe(300);
    }
  });

  it('give the comment the Health screen asks for by itself its own, separate allowance', () => {
    expect(dailyLimit('free', 'insight')).toBe(9);
    expect(dailyLimit('pro', 'insight')).toBe(60);
    expect(dailyLimit('legend', 'insight')).toBe(120);
  });

  it('have a limit for every bucket and every plan, going up with the plan', () => {
    expect(AI_BUCKETS).toEqual(['coach', 'assist', 'insight']);
    expect(Object.keys(AI_DAILY_LIMITS).sort()).toEqual([...AI_BUCKETS].sort());
    for (const bucket of AI_BUCKETS) {
      const { free, pro, legend } = AI_DAILY_LIMITS[bucket];
      expect(free).toBeGreaterThan(0);
      expect(pro).toBeGreaterThan(free);
      expect(legend).toBeGreaterThan(pro);
    }
  });

  it('count a request that does not say what it is, or says something else, as the Coach', () => {
    expect(bucketOf('assist')).toBe('assist');
    expect(bucketOf('insight')).toBe('insight');
    expect(bucketOf('coach')).toBe('coach');
    expect(bucketOf('__proto__')).toBe('coach');
    expect(bucketOf(['assist'])).toBe('coach');
    expect(bucketOf(undefined)).toBe('coach');
    expect(bucketOf('anything')).toBe('coach');
    expect(bucketOf({ kind: 'assist' })).toBe('coach');
    expect(dailyLimit('pro', undefined)).toBe(AI_DAILY_LIMITS.coach.pro);
  });

  it('give an unknown plan the Free allowance', () => {
    expect(dailyLimit('platinum', 'coach')).toBe(5);
    expect(dailyLimit(undefined, 'assist')).toBe(5);
  });
});

describe('plainEntitlement', () => {
  it('is null for anything that is not a document', () => {
    for (const bad of [null, undefined, 'pro', 7, true]) expect(plainEntitlement(bad)).toBeNull();
  });

  it('keeps the plan, status, end date and source, with the end date as ISO text', () => {
    expect(plainEntitlement(plan({ expiresAt: '2026-12-01T00:00:00.000Z' }))).toEqual({
      tier: 'pro', status: 'active', expiresAt: '2026-12-01T00:00:00.000Z', source: 'manual',
    });
  });

  it('reads an end date written as a Firestore timestamp, a date or a number', () => {
    const iso = '2026-12-01T00:00:00.000Z';
    const ms = Date.parse(iso);
    expect(plainEntitlement(plan({ expiresAt: { toMillis: () => ms } })).expiresAt).toBe(iso);
    expect(plainEntitlement(plan({ expiresAt: { seconds: ms / 1000, nanoseconds: 0 } })).expiresAt).toBe(iso);
    expect(plainEntitlement(plan({ expiresAt: new Date(ms) })).expiresAt).toBe(iso);
    expect(plainEntitlement(plan({ expiresAt: ms })).expiresAt).toBe(iso);
  });

  it('forgives capital letters and spaces in a plan or status typed by hand', () => {
    expect(plainEntitlement({ tier: ' Pro ', status: 'Active' })).toMatchObject({ tier: 'pro', status: 'active' });
    expect(plainEntitlement({ tier: 'LEGEND' }).tier).toBe('legend');
  });

  it('forgives spaces around a status typed by hand', () => {
    expect(plainEntitlement({ tier: 'pro', status: ' active ' }).status).toBe('active');
    expect(effectiveTier({ tier: 'pro', status: ' Active ' }, NOW)).toBe('pro');
  });

  it('counts a missing status as active and a missing source as manual', () => {
    expect(plainEntitlement({ tier: 'pro' })).toEqual({ tier: 'pro', status: 'active', expiresAt: null, source: 'manual' });
    expect(plainEntitlement({ tier: 'pro', status: null }).status).toBe('active');
    expect(effectiveTier({ tier: 'pro', status: null }, NOW)).toBe('pro');
  });

  it('turns a plan it does not know into Free', () => {
    expect(plainEntitlement({ tier: 'gold' }).tier).toBe('free');
    expect(plainEntitlement({ tier: 3 }).tier).toBe('free');
    expect(plainEntitlement({}).tier).toBe('free');
  });

  it('keeps an end date it cannot read as already passed, never as no end date', () => {
    expect(plainEntitlement(plan({ expiresAt: 'next friday' })).expiresAt).toBe('1970-01-01T00:00:00.000Z');
    expect(plainEntitlement(plan({ expiresAt: {} })).expiresAt).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('effectiveTier: the plan a person has right now', () => {
  it('is Free with no document, or a document that is not one', () => {
    expect(effectiveTier(null, NOW)).toBe('free');
    expect(effectiveTier(undefined, NOW)).toBe('free');
    expect(effectiveTier('pro', NOW)).toBe('free');
  });

  it('is the plan in the document while it is active, trialing, in grace or cancelled but not yet ended', () => {
    for (const status of ENTITLED_STATUSES) {
      expect(effectiveTier(plan({ status }), NOW)).toBe('pro');
      expect(effectiveTier(plan({ tier: 'legend', status }), NOW)).toBe('legend');
    }
  });

  it('names the statuses that keep a plan: active, trialing, grace and cancelled, and no others', () => {
    expect(ENTITLED_STATUSES).toEqual(['active', 'trialing', 'grace', 'cancelled']);
    for (const status of ['active', 'trialing', 'grace', 'cancelled']) expect(effectiveTier(plan({ status }), NOW)).toBe('pro');
  });

  it('is Free once the status is expired or revoked, or is one nobody knows', () => {
    for (const status of ['expired', 'revoked', 'refunded', '', 'paused']) {
      expect(effectiveTier(plan({ status }), NOW)).toBe('free');
    }
    expect(effectiveTier(plan({ status: 7 }), NOW)).toBe('free');
  });

  it('keeps a plan with no end date, and one that ends later', () => {
    expect(effectiveTier(plan({ expiresAt: null }), NOW)).toBe('pro');
    expect(effectiveTier(plan({ expiresAt: '2026-10-20T15:00:00.001Z' }), NOW)).toBe('pro');
  });

  it('ends a plan at its end date, to the millisecond', () => {
    expect(effectiveTier(plan({ expiresAt: '2026-10-20T15:00:00.000Z' }), NOW)).toBe('free');
    expect(effectiveTier(plan({ expiresAt: '2026-10-19T15:00:00.000Z' }), NOW)).toBe('free');
  });

  it('keeps a cancelled plan until its end date, then drops it', () => {
    expect(effectiveTier(plan({ status: 'cancelled', expiresAt: '2026-11-01T00:00:00.000Z' }), NOW)).toBe('pro');
    expect(effectiveTier(plan({ status: 'cancelled', expiresAt: '2026-10-01T00:00:00.000Z' }), NOW)).toBe('free');
  });

  it('is Free for a Free document and for a document with an end date nobody can read', () => {
    expect(effectiveTier(plan({ tier: 'free' }), NOW)).toBe('free');
    expect(effectiveTier(plan({ expiresAt: 'soon' }), NOW)).toBe('free');
  });

  it('uses the real time when none is given', () => {
    expect(effectiveTier(plan({ expiresAt: '2999-01-01T00:00:00.000Z' }))).toBe('pro');
    expect(effectiveTier(plan({ expiresAt: '2001-01-01T00:00:00.000Z' }))).toBe('free');
  });
});

describe('aiDayKey: the day the AI messages are counted in', () => {
  it('is the calendar day in New York', () => {
    expect(aiDayKey(new Date('2026-10-20T15:00:00.000Z'))).toBe('2026-10-20');
  });

  it('starts over at midnight Eastern in summer (UTC-4), not at midnight UTC', () => {
    expect(aiDayKey(new Date('2026-10-20T03:59:59.000Z'))).toBe('2026-10-19');
    expect(aiDayKey(new Date('2026-10-20T04:00:00.000Z'))).toBe('2026-10-20');
  });

  it('starts over at midnight Eastern in winter (UTC-5)', () => {
    expect(aiDayKey(new Date('2026-12-20T04:59:59.000Z'))).toBe('2026-12-19');
    expect(aiDayKey(new Date('2026-12-20T05:00:00.000Z'))).toBe('2026-12-20');
  });

  it('is written year-month-day, with zeros', () => {
    expect(aiDayKey(new Date('2026-03-05T12:00:00.000Z'))).toBe('2026-03-05');
  });

  it('uses today when no time is given', () => {
    expect(aiDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

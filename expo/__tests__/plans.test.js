import { PLAN_TAGLINES, planCards, planFeatures } from '../lib/plans';
import { AI_DAILY_LIMITS, FEATURES, FEATURE_NAMES, TIERS } from '../lib/entitlements';

describe('what each plan lists', () => {
  it('starts Free with what it does and the Coach messages it has', () => {
    expect(planFeatures('free')).toEqual([
      'Log workouts, runs, hikes and meals',
      'Calendar, friends and leaderboards',
      '5 Coach messages a day',
    ]);
  });

  it('gives Pro everything in Free, its own messages, and what it unlocks', () => {
    expect(planFeatures('pro')).toEqual(['Everything in Free', '100 Coach messages a day', 'AI workout plans', 'Analytics', 'Daily Today brief']);
  });

  it('gives Legend everything in Pro, its own messages, and what only it unlocks', () => {
    expect(planFeatures('legend')).toEqual(['Everything in Pro', '300 Coach messages a day', 'Body scan and 3D body']);
  });

  it('is built from the rules, so every locked feature is listed once, under the plan that needs it', () => {
    for (const feature of Object.keys(FEATURES)) {
      const listedUnder = TIERS.filter((tier) => planFeatures(tier).includes(FEATURE_NAMES[feature]));
      expect(listedUnder).toEqual([FEATURES[feature]]);
    }
  });

  it('quotes the daily limits the server enforces', () => {
    for (const tier of TIERS) expect(planFeatures(tier)).toContain(`${AI_DAILY_LIMITS.coach[tier]} Coach messages a day`);
  });

  it('never promises something that is not enforced: offline trails, AI meal plans and AI challenges are not listed', () => {
    const all = TIERS.flatMap(planFeatures).join(' | ').toLowerCase();
    for (const word of ['offline', 'meal plan', 'challenge', 'unlimited']) expect(all).not.toContain(word);
  });
});

describe('the plan cards', () => {
  it('are Free, Pro and Legend in that order, each with a name, a line about it and its list', () => {
    expect(planCards().map((c) => [c.tier, c.name])).toEqual([['free', 'Free'], ['pro', 'Pro'], ['legend', 'Legend']]);
    for (const card of planCards()) {
      expect(card.tagline).toBe(PLAN_TAGLINES[card.tier]);
      expect(card.tagline.length).toBeGreaterThan(0);
      expect(card.features).toEqual(planFeatures(card.tier));
    }
  });
});

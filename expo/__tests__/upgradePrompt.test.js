import { planRedirect, upgradeFromError } from '../lib/upgradePrompt';

const limitError = (details, code = 'functions/resource-exhausted') => Object.assign(new Error('limit'), { code, details: { reason: 'ai_limit', ...details } });
const planError = (details, code = 'functions/permission-denied') => Object.assign(new Error('plan'), { code, details: { reason: 'plan_required', ...details } });

describe('a daily AI limit', () => {
  it('tells a free person how many they had, when they come back, and what Pro gives', () => {
    expect(upgradeFromError(limitError({ bucket: 'coach', limit: 5, tier: 'free' }))).toEqual({
      kind: 'ai_limit',
      message: 'You have used your 5 free Coach messages for today. Upgrade to Pro for 100 a day, or they come back at midnight Eastern.',
      needs: 'pro',
    });
  });

  it('offers Legend to a Pro person who has used them all', () => {
    expect(upgradeFromError(limitError({ bucket: 'coach', limit: 100, tier: 'pro' }))).toEqual({
      kind: 'ai_limit',
      message: 'You have used all 100 of today\'s Coach messages. Upgrade to Legend for 300 a day, or they come back at midnight Eastern.',
      needs: 'legend',
    });
  });

  it('offers nothing to a Legend person: there is no higher plan, so they are told when they come back', () => {
    expect(upgradeFromError(limitError({ bucket: 'coach', limit: 300, tier: 'legend' }))).toEqual({
      kind: 'ai_limit',
      message: 'You have used all 300 of today\'s Coach messages. They come back at midnight Eastern.',
      needs: null,
    });
  });

  it('names the other helpers\' allowance as AI requests, and quotes the plan\'s own number', () => {
    const prompt = upgradeFromError(limitError({ bucket: 'assist', limit: 5, tier: 'free' }));
    expect(prompt.message).toBe('You have used your 5 free AI requests for today. Upgrade to Pro for 100 a day, or they come back at midnight Eastern.');
  });

  it('names the Health screen\'s own comments as daily insights', () => {
    const prompt = upgradeFromError(limitError({ bucket: 'insight', limit: 9, tier: 'free' }));
    expect(prompt.message).toContain('9 free daily insights');
    expect(prompt.message).toContain('Upgrade to Pro for 60 a day');
  });

  it('works whether or not the error code has the functions/ prefix the app\'s Firebase adds', () => {
    expect(upgradeFromError(limitError({ bucket: 'coach', limit: 5, tier: 'free' }, 'resource-exhausted')).kind).toBe('ai_limit');
  });

  it('falls back to the Coach and the free plan, and to the plan\'s own number, for details it cannot read', () => {
    const prompt = upgradeFromError(limitError({ bucket: 'nonsense', tier: 'platinum' }));
    expect(prompt.message).toBe('You have used your 5 free Coach messages for today. Upgrade to Pro for 100 a day, or they come back at midnight Eastern.');
    expect(upgradeFromError(limitError({ bucket: 'coach', limit: 'five', tier: 'free' })).message).toContain('your 5 free');
  });
});

describe('a feature on a higher plan', () => {
  it('says which feature and which plan', () => {
    expect(upgradeFromError(planError({ feature: 'aiWorkoutPlan', needs: 'pro', tier: 'free' }))).toEqual({
      kind: 'plan_required', message: 'AI workout plans is part of Pro. Upgrade to unlock it.', needs: 'pro', feature: 'aiWorkoutPlan',
    });
    expect(upgradeFromError(planError({ feature: 'bodyScan', needs: 'legend', tier: 'pro' }))).toEqual({
      kind: 'plan_required', message: 'Body scan and 3D body is part of Legend. Upgrade to unlock it.', needs: 'legend', feature: 'bodyScan',
    });
  });

  it('offers Pro, and speaks of this feature, when the details do not say', () => {
    expect(upgradeFromError(planError({ feature: 'nothing', needs: 'platinum' }))).toEqual({
      kind: 'plan_required', message: 'This feature is part of Pro. Upgrade to unlock it.', needs: 'pro', feature: null,
    });
    expect(upgradeFromError(planError({}))).toMatchObject({ needs: 'pro', feature: null });
  });
});

describe('any other error', () => {
  it('is not an upgrade prompt, so the screen shows it the way it always did', () => {
    expect(upgradeFromError(new Error('network'))).toBeNull();
    expect(upgradeFromError(Object.assign(new Error('x'), { code: 'functions/unavailable' }))).toBeNull();
    expect(upgradeFromError(Object.assign(new Error('x'), { code: 'functions/internal', details: { reason: 'ai_limit' } }))).toBeNull();
    expect(upgradeFromError(Object.assign(new Error('x'), { code: 'functions/permission-denied', details: { reason: 'something_else' } }))).toBeNull();
    expect(upgradeFromError(Object.assign(new Error('x'), { code: 'functions/resource-exhausted', details: { reason: 'plan_required' } }))).toBeNull();
  });

  it('is not one when there are no details, or the error is not an error at all', () => {
    expect(upgradeFromError(Object.assign(new Error('x'), { code: 'functions/resource-exhausted' }))).toBeNull();
    expect(upgradeFromError(Object.assign(new Error('x'), { code: 'functions/resource-exhausted', details: 'text' }))).toBeNull();
    for (const bad of [null, undefined, 'limit', 7, {}]) expect(upgradeFromError(bad)).toBeNull();
  });
});

describe('planRedirect: where to send a person turned away from a feature', () => {
  it('is the plans screen, with the feature they wanted', () => {
    expect(planRedirect(planError({ feature: 'aiWorkoutPlan', needs: 'pro', tier: 'free' }))).toEqual({ pathname: '/paywall', params: { feature: 'aiWorkoutPlan' } });
  });

  it('is the plans screen with no feature when the server did not say which', () => {
    expect(planRedirect(planError({ needs: 'pro' }))).toEqual({ pathname: '/paywall', params: {} });
    expect(planRedirect(planError({ feature: 'nothing' }))).toEqual({ pathname: '/paywall', params: {} });
  });

  it('is nothing for a daily limit, which the screen words itself, or for any other error', () => {
    expect(planRedirect(limitError({ bucket: 'coach', limit: 5, tier: 'free' }))).toBeNull();
    expect(planRedirect(new Error('network'))).toBeNull();
    expect(planRedirect(null)).toBeNull();
  });
});

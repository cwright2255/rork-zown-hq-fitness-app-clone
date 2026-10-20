// lib/upgradePrompt.js
//
// What to tell a person when the server turns an AI request away because of their plan (functions/src/index.js, functions/src/aiQuota.js).
// A callable that is refused throws an error whose `details` say why, and these are the two reasons:
//
//   resource-exhausted + reason 'ai_limit'       today's AI messages are used up   { bucket, limit, tier }
//   permission-denied  + reason 'plan_required'  the feature is on a higher plan   { feature, needs, tier }
//
// upgradeFromError(error) turns one of those into words and the plan to offer, or null for any other error (a dropped connection, a
// timeout), which is shown the way it always was.
import {
  AI_DAILY_LIMITS, FEATURE_NAMES, TIERS, TIER_NAMES,
} from '@/lib/entitlements';

const NEXT = { free: 'pro', pro: 'legend' };
const WHAT = { coach: 'Coach messages', assist: 'AI requests', insight: 'daily insights' };

const codeOf = (error) => String((error && error.code) || '').replace(/^functions\//, '');

/**
 * @returns {null | { kind: 'ai_limit' | 'plan_required', message: string, needs: ('pro'|'legend'|null), feature?: string }}
 *   `needs` is the plan to offer (null when there is none higher, as for Legend at its limit).
 */
export function upgradeFromError(error) {
  const details = error && error.details;
  if (!details || typeof details !== 'object') return null;
  const code = codeOf(error);

  if (code === 'resource-exhausted' && details.reason === 'ai_limit') {
    const bucket = AI_DAILY_LIMITS[details.bucket] ? details.bucket : 'coach';
    const tier = TIERS.includes(details.tier) ? details.tier : 'free';
    const limit = Number.isFinite(details.limit) ? details.limit : AI_DAILY_LIMITS[bucket][tier];
    const what = WHAT[bucket];
    const next = NEXT[tier] || null;
    const used = tier === 'free' ? `You have used your ${limit} free ${what} for today.` : `You have used all ${limit} of today's ${what}.`;
    const more = next
      ? ` Upgrade to ${TIER_NAMES[next]} for ${AI_DAILY_LIMITS[bucket][next]} a day, or they come back at midnight Eastern.`
      : ' They come back at midnight Eastern.';
    return { kind: 'ai_limit', message: used + more, needs: next };
  }

  if (code === 'permission-denied' && details.reason === 'plan_required') {
    const needs = details.needs === 'legend' ? 'legend' : 'pro';
    const feature = typeof details.feature === 'string' && FEATURE_NAMES[details.feature] ? details.feature : null;
    const name = feature ? FEATURE_NAMES[feature] : 'This feature';
    return { kind: 'plan_required', message: `${name} is part of ${TIER_NAMES[needs]}. Upgrade to unlock it.`, needs, feature };
  }

  return null;
}

/**
 * Where to send a person whose request was refused because the feature is on a higher plan: the plans screen, with the feature they wanted.
 * null for any other error, including a daily limit (which the screen words itself).
 */
export function planRedirect(error) {
  const prompt = upgradeFromError(error);
  if (!prompt || prompt.kind !== 'plan_required') return null;
  return { pathname: '/paywall', params: prompt.feature ? { feature: prompt.feature } : {} };
}

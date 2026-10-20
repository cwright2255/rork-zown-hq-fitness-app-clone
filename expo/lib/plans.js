// lib/plans.js
//
// What the plans screen (app/paywall.jsx) says about each plan. Nothing here is a rule: what each plan really includes, and the daily
// AI limits, are in lib/entitlements.js, and the lists below are built from them, so the screen cannot promise what the server does
// not give. A feature is listed under the plan that first includes it (FEATURES), and a plan starts with what the one below it has.
import {
  AI_DAILY_LIMITS, FEATURES, FEATURE_NAMES, TIERS, TIER_NAMES,
} from '@/lib/entitlements';

export const PLAN_TAGLINES = {
  free: 'Track everything you do',
  pro: 'Train with your AI coach',
  legend: 'The whole of ZOWN HQ',
};

const BELOW = { pro: 'free', legend: 'pro' };
const FREE_BASICS = ['Log workouts, runs, hikes and meals', 'Calendar, friends and leaderboards'];

/** The lines to show for a plan, in order. */
export function planFeatures(tier) {
  const start = BELOW[tier] ? [`Everything in ${TIER_NAMES[BELOW[tier]]}`] : FREE_BASICS;
  const messages = `${AI_DAILY_LIMITS.coach[tier]} Coach messages a day`;
  const unlocked = Object.keys(FEATURES).filter((feature) => FEATURES[feature] === tier).map((feature) => FEATURE_NAMES[feature]);
  return [...start, messages, ...unlocked];
}

/** The plans to show, lowest first. */
export const planCards = () => TIERS.map((tier) => ({
  tier, name: TIER_NAMES[tier], tagline: PLAN_TAGLINES[tier], features: planFeatures(tier),
}));

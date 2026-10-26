// lib/entitlements.js
//
// The three plans (Free, Pro, Legend), which features each one includes, and how many AI messages a day each one gets.
//
// This file is used by the app AND by the Cloud Functions that enforce the plans (functions/src/entitlements.js is an exact copy:
// a deployed function cannot import from the app, and __tests__/entitlementsParity.test.js makes sure the two never differ).
// So it must stay free of imports.
//
// What a person's plan is comes only from their entitlement document, entitlements/{uid}, which nobody can write from the phone
// (see firestore.rules): the RevenueCat webhook writes it once purchases are connected, and until then it is edited by hand in the
// Firebase console. Everything here only READS that document.
//
//   { tier: 'free' | 'pro' | 'legend',
//     status: 'active' | 'trialing' | 'grace' | 'cancelled' | 'expired' | 'revoked'   (missing counts as 'active'),
//     expiresAt: ISO text | null                                                      (null: no end date),
//     source: 'manual' | 'revenuecat', updatedAt: ISO text }
// 'cancelled' means the person switched renewal off: they keep the plan until expiresAt.

export const TIERS = ['free', 'pro', 'legend'];
const RANK = { free: 0, pro: 1, legend: 2 };
export const TIER_NAMES = { free: 'Free', pro: 'Pro', legend: 'Legend' };

/** Statuses that still carry the plan (until expiresAt, when there is one). */
export const ENTITLED_STATUSES = ['active', 'trialing', 'grace', 'cancelled'];

/** The plan a feature needs. A feature that is not listed is free for everyone. */
export const FEATURES = {
  aiWorkoutPlan: 'pro',
  analytics: 'pro',
  bodyScan: 'legend',
};
export const FEATURE_NAMES = {
  aiWorkoutPlan: 'AI workout plans',
  analytics: 'Analytics',
  bodyScan: 'Body scan and 3D body',
};

/**
 * AI messages are counted in three buckets per day, each with its own allowance. 'coach' is the Coach chat. 'assist' is the AI helpers
 * a person asks for that share the same server function (the help chat, the meal photo scanner, recipe import). 'insight' is the short
 * comment the Health screen asks for by itself when it opens, so it cannot use up the messages a person chooses to send. A request that
 * does not say which it is counts as 'coach', the strictest.
 */
export const AI_BUCKETS = ['coach', 'assist', 'insight'];
export const AI_DAILY_LIMITS = {
  coach: { free: 5, pro: 100, legend: 300 },
  assist: { free: 5, pro: 100, legend: 300 },
  insight: { free: 9, pro: 60, legend: 120 },
};

export const bucketOf = (kind) => (AI_BUCKETS.includes(kind) ? kind : 'coach');
export const dailyLimit = (tier, bucket) => {
  const limits = AI_DAILY_LIMITS[bucketOf(bucket)];
  return limits[TIERS.includes(tier) ? tier : 'free'];
};

export const tierAtLeast = (tier, needed) => (RANK[tier] ?? 0) >= (RANK[needed] ?? 0);
/** The plan a feature needs ('free' for a feature that is not locked). */
export const featureTier = (feature) => FEATURES[feature] || 'free';
export const canUseFeature = (tier, feature) => tierAtLeast(tier, featureTier(feature));

// A time as milliseconds: ISO text, a Date, a number, or a Firestore Timestamp (typed in by hand in the console, or read by the server).
const millisOf = (v) => {
  if (typeof v === 'string') return Date.parse(v);
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && typeof v.seconds === 'number') return v.seconds * 1000;
  return Number.NaN;
};

/** The entitlement document as plain data (times as ISO text), or null when it is not one. Safe to keep on the phone. */
export function plainEntitlement(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const expires = raw.expiresAt == null ? null : millisOf(raw.expiresAt);
  // Typed by hand in the console, so capital letters and stray spaces are forgiven ("Pro " is Pro). A plan that is not one of the three
  // is Free, and a status that is present but not one of the known ones carries no plan.
  const tier = typeof raw.tier === 'string' ? raw.tier.trim().toLowerCase() : '';
  return {
    tier: TIERS.includes(tier) ? tier : 'free',
    status: raw.status == null ? 'active' : String(raw.status).trim().toLowerCase(),
    // A time that cannot be read is kept as already passed, so a damaged document never grants a plan.
    expiresAt: raw.expiresAt == null ? null : new Date(Number.isNaN(expires) ? 0 : expires).toISOString(),
    source: typeof raw.source === 'string' ? raw.source : 'manual',
  };
}

/**
 * The plan a person has right now: their document's plan while it is still in force, Free otherwise (no document, an unknown
 * plan, an ended status, a passed end date).
 */
export function effectiveTier(raw, now = new Date()) {
  const doc = plainEntitlement(raw);
  if (!doc || doc.tier === 'free') return 'free';
  if (!ENTITLED_STATUSES.includes(doc.status)) return 'free';
  if (doc.expiresAt !== null && Date.parse(doc.expiresAt) <= now.getTime()) return 'free';
  return doc.tier;
}

/**
 * The day AI messages are counted in: the calendar day in New York, so the count starts over at midnight Eastern, not in the
 * evening as it would in UTC. Falls back to UTC where the runtime has no time zone data.
 */
export function aiDayKey(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

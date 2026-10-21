// What a person's plan lets them do on the server: which plan they have, whether a feature is open to it, and how many AI messages
// they have left today. Firestore is passed in, so it is tested without Firebase, and index.js stays the one place that touches the
// real service. The plans themselves (and their limits) are in entitlements.js, the same file the app uses.
//
//   entitlements/{uid}       the person's plan. Nobody can write it from the app (firestore.rules).
//   aiUsage/{uid}_{day}      { uid, day, coach: n, assist: n }, the messages used that day. Only these functions touch it.
import { effectiveTier, dailyLimit, bucketOf, aiDayKey, canUseFeature, featureTier } from './entitlements.js';

const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** The plan the person has right now ('free' when they have no entitlement document). */
export async function tierOf(db, uid, now = new Date()) {
  const snap = await db.doc(`entitlements/${uid}`).get();
  return effectiveTier(snap.exists ? snap.data() : null, now);
}

/** Whether the person's plan includes a feature: { ok, tier, needs }. */
export async function checkFeature({ db, uid, feature, now = new Date() }) {
  const tier = await tierOf(db, uid, now);
  return { ok: canUseFeature(tier, feature), tier, needs: featureTier(feature) };
}

/**
 * What a postLLM request of this `kind` needs: the allowance it is counted in, and the feature the person's plan must include (null when
 * none). The daily Today brief ('brief') is a Pro feature and is counted with the comments the app asks for by itself ('insight'), so it
 * cannot use up the messages a person chooses to send. Any other kind is counted as bucketOf() says and needs no feature.
 */
export function aiRequestPlan(kind) {
  if (kind === 'brief') return { bucket: 'insight', feature: 'todayBrief' };
  return { bucket: bucketOf(kind), feature: null };
}

/**
 * Uses up one AI message from today's allowance, in a transaction so two messages sent at once cannot both take the last one.
 * Resolves to { ok, tier, bucket, limit, used, day }; when ok is false the allowance was already spent and nothing was changed.
 */
export async function takeAiQuota({ db, uid, kind, now = new Date() }) {
  const bucket = bucketOf(kind);
  const tier = await tierOf(db, uid, now);
  const limit = dailyLimit(tier, bucket);
  const day = aiDayKey(now);
  const ref = db.doc(`aiUsage/${uid}_${day}`);
  const taken = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? count(snap.data()[bucket]) : 0;
    if (used >= limit) return { ok: false, used };
    tx.set(ref, { uid, day, [bucket]: used + 1 }, { merge: true });
    return { ok: true, used: used + 1 };
  });
  return { ...taken, tier, bucket, limit, day };
}

/** Gives back one message taken by takeAiQuota, for a request that failed before the person got anything. Never goes below zero. */
export async function giveBackAiQuota({ db, uid, bucket, day }) {
  const ref = db.doc(`aiUsage/${uid}_${day}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? count(snap.data()[bucket]) : 0;
    if (used > 0) tx.set(ref, { [bucket]: used - 1 }, { merge: true });
  });
}

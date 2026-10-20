// services/purchases.js
//
// Buying a plan. Stage 1 of Free / Pro / Legend has no store connection yet: the plans, the limits and the plans screen all work, a
// plan is set by hand on the person's entitlements document (see docs/DEVICE_CHECKS.md), and this says so. Stage 2 connects RevenueCat
// and the App Store here, turns PURCHASES_ENABLED on, and lets purchasePlan start a real purchase; the plans screen needs no change.
// A purchase never sets the plan on the phone: it is the server that writes entitlements/{uid} once the store confirms it.
export const PURCHASES_ENABLED = false;

/** Starts buying a plan ('pro' or 'legend'). Resolves to { ok: true } or { ok: false, error }. */
export async function purchasePlan() {
  return { ok: false, error: 'Subscriptions are not open yet.' };
}

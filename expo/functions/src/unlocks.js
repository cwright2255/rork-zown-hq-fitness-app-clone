// Achievements, badges and Battle Pass tiers, decided on the server.
//
// The phone used to decide each of these and write the answer to the person's own record, so anyone could unlock anything. Now
// users/{uid}/data/achievements, users/{uid}/data/badges and users/{uid}/data/battlePass can only be written by a function (see
// firestore.rules), and the phone follows them. The rules that say what earns what are in unlockRules.js; this file gathers the facts
// from records the server holds and writes what is newly earned.
//
// Where each fact comes from:
//   finished workouts, best calories   the workout totals (lifetimeTotals.js), counted from the person's workout records
//   XP, level, streak                  the XP ledger (xpLedger.js), which only the server writes
//   hikes                              the hikes the person recorded (users/{uid}/data/hikes), and the XP claims for hikes the server
//                                      accepted; whichever shows more counts, so hikes from before XP claims existed still count
//   races, journeys finished           the XP claims for them that the server accepted
//   Battle Pass tiers                  the level in the ledger: a tier can be claimed once the level has reached it
//
// What the server cannot know is whether a workout, hike or run really happened: a person can still record one that did not. The
// XP claims are held to limits (xpRules.js); the workout and hike records are the person's own, as they have always been.
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.
import { ensureTotals } from './lifetimeTotals.js';
import { evaluateUnlocks, MILES_PER_KM, STRENUOUS_MULTIPLIER, STRENUOUS_TIERS } from './unlockRules.js';
import { normalizeLedger } from './xpRules.js';

/** Tiers 1 to 20 (app/battlepass.jsx lists the same twenty); a tier is claimed once the level has reached its number. */
export const BATTLE_PASS_TIERS = 20;

const ACHIEVEMENTS_DOC = (uid) => `users/${uid}/data/achievements`;
const BADGES_DOC = (uid) => `users/${uid}/data/badges`;
const BATTLE_PASS_DOC = (uid) => `users/${uid}/data/battlePass`;
const HIKES_DOC = (uid) => `users/${uid}/data/hikes`;
const LEDGER_DOC = (uid) => `users/${uid}/stats/xp`;

const number = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

// A claim the server dealt with and did not turn away as wrong: paid, or valid but paid nothing because that day was already full.
const COUNTED_REASONS = ['daily-cap', 'too-many'];
export const claimWasAccepted = (claim) => !!claim && (claim.result === 'awarded' || (claim.result === 'rejected' && COUNTED_REASONS.includes(claim.reason)));

/** The hike facts from the hikes document: { count, km, strenuous }. */
export function hikeFactsFromRecord(stored) {
  const hikes = stored && Array.isArray(stored.hikes) ? stored.hikes.filter((h) => h && typeof h === 'object') : [];
  return {
    count: hikes.length,
    km: hikes.reduce((sum, h) => sum + number(h.distanceKm), 0),
    strenuous: hikes.filter((h) => STRENUOUS_TIERS.includes(h.difficultyTier)).length,
  };
}

/** The same, from the XP claims for hikes that the server accepted. */
export function hikeFactsFromClaims(claims) {
  const accepted = (claims || []).filter((c) => c && c.kind === 'hike' && claimWasAccepted(c));
  return {
    count: accepted.length,
    km: accepted.reduce((sum, c) => sum + number(c.distanceKm), 0),
    strenuous: accepted.filter((c) => number(c.multiplier) >= STRENUOUS_MULTIPLIER).length,
  };
}

/**
 * Every fact the unlock rules ask about, for one person.
 * @returns {Promise<{ facts: object, totals: object }>}
 */
export async function gatherFacts({ db, uid, stamp }) {
  const totals = await ensureTotals({ db, uid, stamp });
  const [ledgerSnap, hikesSnap, claimsSnap] = await Promise.all([
    db.doc(LEDGER_DOC(uid)).get(),
    db.doc(HIKES_DOC(uid)).get(),
    db.collection(`users/${uid}/xpClaims`).where('kind', 'in', ['hike', 'race', 'journey']).get(),
  ]);
  const ledger = normalizeLedger(ledgerSnap.exists ? ledgerSnap.data() : null);
  const claims = claimsSnap.docs.map((d) => d.data());
  const fromRecord = hikeFactsFromRecord(hikesSnap.exists ? hikesSnap.data() : null);
  const fromClaims = hikeFactsFromClaims(claims);
  const accepted = (kind) => claims.filter((c) => c && c.kind === kind && claimWasAccepted(c)).length;

  return {
    totals,
    facts: {
      finishedWorkouts: number(totals.finishedWorkouts),
      bestCalories: number(totals.bestCalories),
      streak: ledger.streak,
      level: ledger.level,
      xp: ledger.total,
      hikeCount: Math.max(fromRecord.count, fromClaims.count),
      hikeMiles: Math.max(fromRecord.km, fromClaims.km) * MILES_PER_KM,
      strenuousHikes: Math.max(fromRecord.strenuous, fromClaims.strenuous),
      raceFinishes: accepted('race'),
      journeyFinishes: accepted('journey'),
    },
  };
}

/**
 * Works out what the person has newly earned and writes it. Safe to run any number of times, at the same time: what is already
 * unlocked keeps its time, and nothing is ever taken away.
 * @returns {Promise<{ achievements: string[], badges: string[], facts: object, totals: object }>} the ids newly unlocked, and what they were worked out from
 */
export async function runUnlocks({ db, uid, stamp = new Date().toISOString() }) {
  const { facts, totals } = await gatherFacts({ db, uid, stamp });
  const achievementsRef = db.doc(ACHIEVEMENTS_DOC(uid));
  const badgesRef = db.doc(BADGES_DOC(uid));

  const earned = await db.runTransaction(async (tx) => {
    const achievementsSnap = await tx.get(achievementsRef);
    const badgesSnap = await tx.get(badgesRef);
    const haveAchievements = (achievementsSnap.exists && achievementsSnap.data() && achievementsSnap.data().unlocked) || {};
    const haveBadges = (badgesSnap.exists && badgesSnap.data() && badgesSnap.data().unlocked) || {};
    const next = evaluateUnlocks({ facts, unlockedAchievements: Object.keys(haveAchievements), unlockedBadges: Object.keys(haveBadges) });
    const stampAll = (ids) => Object.fromEntries(ids.map((id) => [id, stamp]));
    if (next.achievements.length > 0) tx.set(achievementsRef, { unlocked: stampAll(next.achievements) }, { merge: true });
    if (next.badges.length > 0) tx.set(badgesRef, { unlocked: stampAll(next.badges) }, { merge: true });
    return next;
  });
  return { ...earned, facts, totals };
}

const wholeTiers = (list) => Array.from(new Set((Array.isArray(list) ? list : [])
  .filter((t) => Number.isInteger(t) && t >= 1 && t <= BATTLE_PASS_TIERS))).sort((a, b) => a - b);

/**
 * Records that the person claimed a Battle Pass tier, once their level has reached it.
 * @returns {Promise<{ status: 'claimed'|'already'|'locked'|'invalid', claimedTiers?: number[], level?: number }>}
 *   'locked': the level in the XP ledger has not reached the tier yet (the phone can show a level a little ahead of the server's)
 */
export async function claimTier({ db, uid, tier, stamp = new Date().toISOString() }) {
  if (!Number.isInteger(tier) || tier < 1 || tier > BATTLE_PASS_TIERS) return { status: 'invalid' };
  const ledgerRef = db.doc(LEDGER_DOC(uid));
  const passRef = db.doc(BATTLE_PASS_DOC(uid));
  return db.runTransaction(async (tx) => {
    const ledgerSnap = await tx.get(ledgerRef);
    const passSnap = await tx.get(passRef);
    const level = normalizeLedger(ledgerSnap.exists ? ledgerSnap.data() : null).level;
    const claimed = wholeTiers(passSnap.exists && passSnap.data() ? passSnap.data().claimedTiers : []);
    if (claimed.includes(tier)) return { status: 'already', claimedTiers: claimed, level };
    if (level < tier) return { status: 'locked', claimedTiers: claimed, level };
    const next = wholeTiers([...claimed, tier]);
    tx.set(passRef, { claimedTiers: next, updatedAt: stamp }, { merge: true });
    return { status: 'claimed', claimedTiers: next, level };
  });
}

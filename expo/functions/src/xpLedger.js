// The XP record: the one place a person's XP, level, streak and distance are kept and added to.
//
// These used to be worked out on the phone, which wrote them to the public leaderboard itself, so the rules had to let any
// signed-in person write any score. Now the phone files a CLAIM ("a 5.2 km run today") as users/{uid}/xpClaims/{claimId}, which
// it can create once and never change, and onXpClaim in index.js hands each new claim to processClaim below. That checks it with
// the rules in xpRules.js (the same file the app uses to show XP as it is earned), adds it to the ledger users/{uid}/stats/xp
// (which the rules let only a function write), marks the claim as dealt with, and puts the XP, level, streak and distance on
// the person's leaderboard entry. The rules let the phone write only the name and picture there.
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.
//
// - Each claim is applied once. Firebase can deliver the same event twice and a failed run is retried; the claim document is
//   marked in the same transaction as the ledger change, so a second delivery finds the mark and changes nothing.
// - A claim whose document is gone (the account was erased while it waited) is left alone, so erasing an account is not undone.
// - Nobody who has chosen to be hidden from the leaderboards (Settings) is put on it by a claim. (An entry the person's own phone
//   creates is taken as their word that they want to be shown: the phone only makes one when the setting is on, and the setting
//   may not have been saved yet.)
import { applyClaim, boardChanged, leaderboardFields, normalizeLedger } from './xpRules.js';

const DAY_MS = 86400000;

/**
 * Checks one claim and adds it to the ledger.
 * @param {object} args
 *   db                 Firestore (firebase-admin)
 *   uid, claimId       whose claim, and which
 *   now                the time in milliseconds
 *   stamp              the time as text, recorded on the claim and the ledger
 *   accountCreatedMs   async () => when the account was made, in milliseconds (or null); only asked for by the one-off import
 * @returns {Promise<{status: 'applied'|'duplicate'|'gone'|'ignored', ledger?: object, before?: object, outcome?: object}>}
 */
export async function processClaim({ db, uid, claimId, now = Date.now(), stamp = new Date(now).toISOString(), accountCreatedMs = async () => null }) {
  if (!uid || !claimId) return { status: 'ignored' };
  const claimRef = db.doc(`users/${uid}/xpClaims/${claimId}`);
  const ledgerRef = db.doc(`users/${uid}/stats/xp`);

  return db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!claimSnap.exists) return { status: 'gone' };
    const claim = claimSnap.data() || {};
    const before = normalizeLedger(ledgerSnap.exists ? ledgerSnap.data() : null);
    if (claim.processedAt) return { status: 'duplicate', ledger: before };

    let ageDays = 0;
    if (claim.kind === 'import') {
      const created = await accountCreatedMs();
      ageDays = Number.isFinite(created) && created > 0 ? Math.max(0, Math.floor((now - created) / DAY_MS)) : 0;
    }
    const { ledger, outcome } = applyClaim({ ledger: before, id: claimId, claim, now, ageDays });

    tx.set(ledgerRef, { ...ledger, updatedAt: stamp });
    tx.update(claimRef, { processedAt: stamp, result: outcome.status, amount: outcome.amount, reason: outcome.reason });
    return { status: 'applied', ledger, before, outcome };
  });
}

/** Whether the person is to be shown on the leaderboards: on unless they turned it off in Settings. */
async function isShown(db, uid) {
  const settings = await db.doc(`users/${uid}/data/settings`).get();
  return !(settings.exists && settings.data() && settings.data().showInLeaderboards === false);
}

// Writes the ledger's XP, level, streak and distance onto the entry. Only those fields are touched (the name and picture are the
// phone's), and the distance map is replaced as a whole so a week that is over drops off by itself.
async function writeLeaderboard({ db, uid, ledger, stamp }) {
  await db.doc(`leaderboard/${uid}`).set(
    { ...leaderboardFields(ledger), updatedAt: stamp },
    { mergeFields: ['xp', 'level', 'streak', 'distance', 'updatedAt'] }
  );
}

/**
 * Puts the ledger on the person's leaderboard entry, unless they chose not to be shown.
 * @returns {Promise<'published'|'hidden'>}
 */
export async function publishLeaderboard({ db, uid, ledger, stamp = new Date().toISOString() }) {
  if (!(await isShown(db, uid))) return 'hidden';
  await writeLeaderboard({ db, uid, ledger, stamp });
  return 'published';
}

/**
 * The work for one new claim: process it, then publish what changed. A claim that was already dealt with is published again,
 * because the first run may have stopped between the two.
 * @returns {Promise<string>} what happened: 'published', 'hidden', 'unchanged', 'duplicate' (published again), 'gone' or 'ignored'
 */
export async function handleClaim(args) {
  const result = await processClaim(args);
  if (result.status === 'gone' || result.status === 'ignored') return result.status;
  if (result.status === 'applied' && !boardChanged(result.before, result.ledger)) return 'unchanged';
  return publishLeaderboard({ db: args.db, uid: args.uid, ledger: result.ledger, stamp: args.stamp });
}

/**
 * A leaderboard entry has just been created, by the person's phone (a first entry, or one put back after they showed themselves
 * again): the phone cannot write XP, so this fills it in from the ledger. An entry that already has XP, or a person with no
 * ledger yet, is left alone.
 * @returns {Promise<'published'|'has-xp'|'no-ledger'|'ignored'>}
 */
export async function fillLeaderboardEntry({ db, uid, entry, stamp = new Date().toISOString() }) {
  if (!uid) return 'ignored';
  if (entry && Object.prototype.hasOwnProperty.call(entry, 'xp')) return 'has-xp';
  const ledgerSnap = await db.doc(`users/${uid}/stats/xp`).get();
  if (!ledgerSnap.exists) return 'no-ledger';
  await writeLeaderboard({ db, uid, ledger: ledgerSnap.data(), stamp });
  return 'published';
}

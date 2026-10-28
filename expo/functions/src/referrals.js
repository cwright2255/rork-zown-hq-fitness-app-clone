// Invite codes, and the reward for a friend who joins with one.
//
// Every person has one invite code (8 letters and digits, shown as XXXX-XXXX). A new friend types it in the app (app/invite.jsx); the server
// checks it and, if it holds, gives both of them free Pro days. Nothing here is decided on the phone: the phone can only ask.
//
//   inviteCodes/{CODE}              { uid, createdAt }   whose code it is. Only these functions touch it (no rule names it, so it is closed).
//   users/{uid}/stats/invite        the person's own side: { code, joined, rewarded, daysEarned } as an inviter, and { redeemedAt, redeemedCode,
//                                   friendDays } as a friend who joined with a code, and { badTries } for codes that were not real. The rules let
//                                   the person read it and never write it (users/{uid}/stats).
//   entitlements/{uid}              the reward itself: a Pro plan that ends on a date (source 'referral'), written the way a plan is
//                                   everywhere else (lib/entitlements.js), so every Pro check on the phone and in the other functions works on it.
//
// What stops it being farmed (it cannot be made impossible: a person can make more accounts):
//   one reward per account       an account can join with a code once.
//   new accounts only            the friend's account must be no older than REFERRAL_RULES.accountWindowDays, by the sign-in account's own date.
//   a limit per inviter          a code stops paying out after REFERRAL_RULES.maxRewardedInvites friends, for the inviter and the friend alike.
//   no guessing                  after REFERRAL_RULES.maxBadTries codes that are not real, the account is turned away.
//   nobody's plan is replaced    days are only given to a person on Free, or added to a referral plan they already have. A person who has bought
//                                a plan, or been given one by hand, keeps it untouched (they still count as having brought the friend in).
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.
import { randomInt } from 'node:crypto';
import { effectiveTier, plainEntitlement } from './entitlements.js';

/** Every number the reward uses. Change them here; nothing else holds a copy (the phone is told them by getInviteStatus). */
export const REFERRAL_RULES = Object.freeze({
  /** Pro days for the friend who joins, and for the person whose code it was. */
  friendDays: 7,
  inviterDays: 7,
  /** Friends one code pays out for. */
  maxRewardedInvites: 5,
  /** How old the friend's account may be, in days. */
  accountWindowDays: 14,
  /** Codes that are not real, tried by one account, before it is turned away. */
  maxBadTries: 10,
});

const DAY_MS = 86400000;
const CODE_LENGTH = 8;
// No I, L, O, 0 or 1: they are read and typed wrong.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** What was typed, as a code: capitals, with spaces and dashes gone. */
export const normalizeCode = (input) => (typeof input === 'string' ? input.toUpperCase().replace(/[^A-Z0-9]/g, '') : '');
export const isValidCode = (code) => typeof code === 'string' && CODE_PATTERN.test(code);
/** 'K7P2QX4M' as 'K7P2-QX4M'. */
export const formatCode = (code) => (isValidCode(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : '');

/** A new random code. `random(n)` is a whole number from 0 to n - 1. */
export function makeCode(random = randomInt) {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

/**
 * The plan document that gives `days` of Pro to a person, or null when nothing should change for them.
 * A person on Free gets a Pro plan that ends `days` from now; a person already on a referral plan has it made longer; a person on any other plan
 * (bought, given by hand, Legend) keeps it as it is.
 */
export function planGrant({ raw, days, now = new Date() }) {
  if (!(days > 0)) return null;
  const tier = effectiveTier(raw, now);
  const current = plainEntitlement(raw);
  const stamp = now.toISOString();
  if (tier === 'free') {
    return { tier: 'pro', status: 'trialing', expiresAt: new Date(now.getTime() + days * DAY_MS).toISOString(), source: 'referral', updatedAt: stamp };
  }
  if (tier === 'pro' && current && current.source === 'referral' && current.expiresAt) {
    // A referral plan that has run out is Free above, so this one ends in the future: the new days go on the end of it.
    const from = Date.parse(current.expiresAt);
    return { tier: 'pro', status: 'trialing', expiresAt: new Date(from + days * DAY_MS).toISOString(), source: 'referral', updatedAt: stamp };
  }
  return null;
}

/** What the phone is told about a person's invites. */
export function statusOf(stats) {
  const s = stats && typeof stats === 'object' ? stats : {};
  return {
    code: isValidCode(s.code) ? s.code : null,
    display: formatCode(s.code),
    joined: count(s.joined),
    rewarded: count(s.rewarded),
    daysEarned: count(s.daysEarned),
    redeemed: typeof s.redeemedAt === 'string' && s.redeemedAt !== '',
    friendDaysGiven: count(s.friendDays),
    rules: {
      friendDays: REFERRAL_RULES.friendDays,
      inviterDays: REFERRAL_RULES.inviterDays,
      maxRewardedInvites: REFERRAL_RULES.maxRewardedInvites,
      accountWindowDays: REFERRAL_RULES.accountWindowDays,
    },
  };
}

const statsPath = (uid) => `users/${uid}/stats/invite`;

/**
 * The person's invite code (made the first time it is asked for) and how their invites are going.
 * @returns {Promise<ReturnType<typeof statusOf>>}
 */
export async function getInviteStatus({ db, uid, random = randomInt, stamp = new Date().toISOString() }) {
  if (!uid || typeof uid !== 'string') throw new Error('uid is required');
  const ref = db.doc(statsPath(uid));
  // A code another person already has is tried again with a new one; with 31^8 of them that is all but never needed.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stats = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const have = snap.exists ? snap.data() || {} : {};
      if (isValidCode(have.code)) return have;
      const code = makeCode(random);
      const codeRef = db.doc(`inviteCodes/${code}`);
      const taken = await tx.get(codeRef);
      if (taken.exists) return null;
      tx.set(codeRef, { uid, createdAt: stamp });
      tx.set(ref, { code, createdAt: stamp }, { merge: true });
      return { ...have, code };
    });
    if (stats) return statusOf(stats);
  }
  throw new Error('could not make an invite code');
}

/**
 * A person joins with a friend's code.
 * @param {object} args
 *   db, uid, code        the person redeeming, and what they typed
 *   accountCreatedMs     async () => when the sign-in account was made, in milliseconds (or null when it is not known)
 * @returns {Promise<{ ok: true, friendDays: number, inviterDays: number } | { ok: false, reason: string }>}
 *   reason: 'invalid-code', 'own-code', 'already-redeemed', 'too-old', 'code-full', 'too-many-tries'
 *   friendDays / inviterDays are the days that were really added (0 for a person who already has a plan of their own).
 */
export async function redeemInvite({
  db, uid, code, accountCreatedMs = async () => null, now = new Date(), stamp = now.toISOString(),
}) {
  if (!uid || typeof uid !== 'string') throw new Error('uid is required');
  const clean = normalizeCode(code);
  const mineRef = db.doc(statsPath(uid));

  const created = await accountCreatedMs();
  const tooOld = !Number.isFinite(created) || now.getTime() - created > REFERRAL_RULES.accountWindowDays * DAY_MS;

  return db.runTransaction(async (tx) => {
    const mineSnap = await tx.get(mineRef);
    const mine = mineSnap.exists ? mineSnap.data() || {} : {};
    if (count(mine.badTries) >= REFERRAL_RULES.maxBadTries) return { ok: false, reason: 'too-many-tries' };
    if (typeof mine.redeemedAt === 'string' && mine.redeemedAt) return { ok: false, reason: 'already-redeemed' };
    if (tooOld) return { ok: false, reason: 'too-old' };

    const codeSnap = isValidCode(clean) ? await tx.get(db.doc(`inviteCodes/${clean}`)) : null;
    const inviterUid = codeSnap && codeSnap.exists && codeSnap.data() ? codeSnap.data().uid : null;
    if (typeof inviterUid !== 'string' || inviterUid === '') {
      tx.set(mineRef, { badTries: count(mine.badTries) + 1 }, { merge: true });
      return { ok: false, reason: 'invalid-code' };
    }
    if (inviterUid === uid) return { ok: false, reason: 'own-code' };

    const inviterRef = db.doc(statsPath(inviterUid));
    const inviterSnap = await tx.get(inviterRef);
    const inviter = inviterSnap.exists ? inviterSnap.data() || {} : {};
    if (count(inviter.rewarded) >= REFERRAL_RULES.maxRewardedInvites) return { ok: false, reason: 'code-full' };

    const myPlanRef = db.doc(`entitlements/${uid}`);
    const inviterPlanRef = db.doc(`entitlements/${inviterUid}`);
    const [myPlan, inviterPlan] = await Promise.all([tx.get(myPlanRef), tx.get(inviterPlanRef)]);
    const forFriend = planGrant({ raw: myPlan.exists ? myPlan.data() : null, days: REFERRAL_RULES.friendDays, now });
    const forInviter = planGrant({ raw: inviterPlan.exists ? inviterPlan.data() : null, days: REFERRAL_RULES.inviterDays, now });

    if (forFriend) tx.set(myPlanRef, forFriend);
    if (forInviter) tx.set(inviterPlanRef, forInviter);
    const friendDays = forFriend ? REFERRAL_RULES.friendDays : 0;
    const inviterDays = forInviter ? REFERRAL_RULES.inviterDays : 0;
    tx.set(mineRef, { redeemedAt: stamp, redeemedCode: clean, friendDays }, { merge: true });
    tx.set(inviterRef, {
      joined: count(inviter.joined) + 1,
      rewarded: count(inviter.rewarded) + 1,
      daysEarned: count(inviter.daysEarned) + inviterDays,
      lastJoinedAt: stamp,
    }, { merge: true });
    return { ok: true, friendDays, inviterDays };
  });
}

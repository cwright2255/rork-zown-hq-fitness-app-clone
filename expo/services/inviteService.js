// services/inviteService.js
//
// Asks the server about the person's invites. The code, the count of friends who joined and the reward are all the server's
// (functions/src/referrals.js getInviteStatus and redeemInviteCode); the phone cannot make a code, join with one or give a plan.
// A failure is thrown: the screen decides what to say.
import { callProxy } from './callProxy';

/** { code, display, joined, rewarded, daysEarned, redeemed, friendDaysGiven, rules }; the person's code is made the first time. */
export const fetchInviteStatus = () => callProxy('getInviteStatus', {});

/** { ok: true, friendDays, inviterDays } or { ok: false, reason }. */
export const redeemInviteCode = (code) => callProxy('redeemInviteCode', { code });

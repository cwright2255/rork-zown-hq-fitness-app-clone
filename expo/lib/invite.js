// lib/invite.js
//
// What the Invite your friends screen (app/invite.jsx) says and shares. The code, who joined and the reward are the server's
// (functions/src/referrals.js): this only words them. The numbers (days, friends, how new an account must be) come from the server with the
// status, so changing the reward there changes what is said here.

/** Where a friend gets the app. This is the App Store page, which works once the app is on the App Store (the id is eas.json's ascAppId). */
export const APP_STORE_LINK = 'https://apps.apple.com/app/id6815233553';

const CODE_LENGTH = 8;
/** The letters and digits a code is made of: the server's own list (functions/src/referrals.js CODE_ALPHABET), which __tests__/inviteParity.test.js keeps the same. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * What a person has typed in the code box, tidied as they type: capitals, only the letters and digits a code has, and a dash in the middle
 * ("k7p2qx" gives "K7P2-QX"). It is not checked against the server until they press the button.
 */
export function typedCode(text) {
  const allowed = new Set(CODE_ALPHABET);
  const clean = (typeof text === 'string' ? text.toUpperCase() : '').split('').filter((c) => allowed.has(c)).slice(0, CODE_LENGTH).join('');
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** Whether the code box holds a whole code. */
export const codeIsComplete = (text) => typedCode(text).replace('-', '').length === CODE_LENGTH;

const pluralDays = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Whether the person's code has paid for all the friends it may. */
export function codeIsFull(status) {
  return !!(status && status.rules && status.rewarded >= status.rules.maxRewardedInvites);
}

/**
 * The message that goes in the share sheet. With a code it tells the friend where to get the app, where to type the code and what they get;
 * with no code (the server could not be reached), or a code that has paid for all it may, it is only an invitation to the app.
 */
export function inviteMessage(status) {
  const plain = `Train with me on ZOWN HQ: ${APP_STORE_LINK}`;
  if (!status || !status.display || codeIsFull(status)) return plain;
  const days = status.rules && status.rules.friendDays > 0 ? ` We both get ${pluralDays(status.rules.friendDays)} of Pro free.` : '';
  return `Train with me on ZOWN HQ! Get the app: ${APP_STORE_LINK}\nAfter you sign up, tap "Invite your friends" on the Home screen and enter my code ${status.display}.${days}`;
}

export const SERVER_UNREACHABLE = "Couldn't reach the server. Check your connection and try again.";

/** What to tell a person after they pressed Use code. `rules` is the status' rules (for the numbers), when they are known. */
export function redeemMessage(result, rules) {
  if (!result || typeof result !== 'object') return SERVER_UNREACHABLE;
  if (result.ok) {
    if (result.friendDays > 0) return `You're in! You now have ${pluralDays(result.friendDays)} of Pro. Your friend got days too.`;
    return "You joined with your friend's code. You already have a plan of your own, so no days were added.";
  }
  switch (result.reason) {
    case 'invalid-code': return "That code isn't right. Check it and try again.";
    case 'own-code': return "That's your own code. Send it to a friend instead.";
    case 'already-redeemed': return "You've already joined with a friend's code.";
    case 'too-old': return rules && rules.accountWindowDays > 0
      ? `Codes only work for accounts made in the last ${pluralDays(rules.accountWindowDays)}.`
      : 'Codes only work for accounts that were made recently.';
    case 'code-full': return rules && rules.maxRewardedInvites > 0
      ? `That code has already reached its limit of ${rules.maxRewardedInvites} friends.`
      : 'That code has already reached its limit of friends.';
    case 'too-many-tries': return "Too many codes that didn't work. If you think this is a mistake, contact support.";
    default: return SERVER_UNREACHABLE;
  }
}

// What the Invite your friends screen says and shares (lib/invite.js).
import {
  APP_STORE_LINK, typedCode, codeIsComplete, codeIsFull, inviteMessage, redeemMessage, SERVER_UNREACHABLE,
} from '../lib/invite';

const rules = { friendDays: 7, inviterDays: 7, maxRewardedInvites: 5, accountWindowDays: 14 };
const status = (over = {}) => ({ code: 'K7P2QX4M', display: 'K7P2-QX4M', joined: 0, rewarded: 0, daysEarned: 0, redeemed: false, friendDaysGiven: 0, rules, ...over });

describe('the link', () => {
  it('is the App Store page of the app in App Store Connect', () => {
    expect(APP_STORE_LINK).toBe('https://apps.apple.com/app/id6815233553');
    expect(require('../eas.json').submit.production.ios.ascAppId).toBe('6815233553');
  });
});

describe('typing a code', () => {
  it('shows capitals and puts a dash in the middle as the fifth letter is typed', () => {
    expect(typedCode('k')).toBe('K');
    expect(typedCode('k7p2')).toBe('K7P2');
    expect(typedCode('k7p2q')).toBe('K7P2-Q');
    expect(typedCode('k7p2qx4m')).toBe('K7P2-QX4M');
  });

  it('keeps a pasted code whole, with its dash or spaces', () => {
    expect(typedCode('K7P2-QX4M')).toBe('K7P2-QX4M');
    expect(typedCode(' k7p2 qx4m ')).toBe('K7P2-QX4M');
  });

  it('leaves out what a code cannot have, and anything past the eighth letter', () => {
    expect(typedCode('K7P2-QX4M99')).toBe('K7P2-QX4M');
    expect(typedCode('ILO01!?')).toBe('');
    expect(typedCode('k7*p2')).toBe('K7P2');
  });

  it('is empty for what is not text', () => {
    [undefined, null, 5, {}, []].forEach((v) => expect(typedCode(v)).toBe(''));
  });

  it('is complete only with all eight', () => {
    expect(codeIsComplete('K7P2-QX4')).toBe(false);
    expect(codeIsComplete('K7P2-QX4M')).toBe(true);
    expect(codeIsComplete('k7p2qx4m')).toBe(true);
    expect(codeIsComplete('')).toBe(false);
    expect(codeIsComplete(undefined)).toBe(false);
  });
});

describe('the message that is shared', () => {
  it('says where to get the app, where to type the code, the code, and what both get', () => {
    const text = inviteMessage(status());
    expect(text).toContain(APP_STORE_LINK);
    expect(text).toContain('K7P2-QX4M');
    expect(text).toContain('Invite your friends');
    expect(text).toContain('We both get 7 days of Pro free.');
  });

  it('uses the days the server says, not a number of its own', () => {
    expect(inviteMessage(status({ rules: { ...rules, friendDays: 3 } }))).toContain('We both get 3 days of Pro free.');
    expect(inviteMessage(status({ rules: { ...rules, friendDays: 1 } }))).toContain('We both get 1 day of Pro free.');
    expect(inviteMessage(status({ rules: { ...rules, friendDays: 0 } }))).not.toMatch(/Pro free/);
  });

  it('is only an invitation to the app when there is no code, or the code has paid for all it can', () => {
    const plain = `Train with me on ZOWN HQ: ${APP_STORE_LINK}`;
    expect(inviteMessage(null)).toBe(plain);
    expect(inviteMessage(undefined)).toBe(plain);
    expect(inviteMessage(status({ display: '' }))).toBe(plain);
    expect(inviteMessage(status({ rewarded: 5 }))).toBe(plain);
    expect(inviteMessage(status({ rewarded: 4 }))).toContain('K7P2-QX4M');
  });

  it('knows a code is full only when the server has said how many friends it may pay for', () => {
    expect(codeIsFull(status({ rewarded: 5 }))).toBe(true);
    expect(codeIsFull(status({ rewarded: 6 }))).toBe(true);
    expect(codeIsFull(status({ rewarded: 4 }))).toBe(false);
    expect(codeIsFull(status({ rewarded: 9, rules: undefined }))).toBe(false);
    expect(codeIsFull(null)).toBe(false);
  });
});

describe('what a person is told after Use code', () => {
  it('says the days they got when they joined', () => {
    expect(redeemMessage({ ok: true, friendDays: 7, inviterDays: 7 })).toBe("You're in! You now have 7 days of Pro. Your friend got days too.");
    expect(redeemMessage({ ok: true, friendDays: 1, inviterDays: 0 })).toBe("You're in! You now have 1 day of Pro. Your friend got days too.");
  });

  it('says so, and does not promise days, to a person who already has a plan', () => {
    const text = redeemMessage({ ok: true, friendDays: 0, inviterDays: 7 });
    expect(text).toMatch(/already have a plan of your own/);
    expect(text).not.toMatch(/You now have/);
  });

  it('has its own words for every reason a code is turned away', () => {
    const reasons = ['invalid-code', 'own-code', 'already-redeemed', 'too-old', 'code-full', 'too-many-tries'];
    const texts = reasons.map((reason) => redeemMessage({ ok: false, reason }, rules));
    expect(new Set(texts).size).toBe(reasons.length);
    expect(texts[0]).toMatch(/isn't right/);
    expect(texts[1]).toMatch(/your own code/);
    expect(texts[2]).toMatch(/already joined/);
    expect(texts[3]).toBe('Codes only work for accounts made in the last 14 days.');
    expect(texts[4]).toBe('That code has already reached its limit of 5 friends.');
    expect(texts[5]).toMatch(/contact support/);
  });

  it('does not make up a number it was not given', () => {
    expect(redeemMessage({ ok: false, reason: 'too-old' })).toBe('Codes only work for accounts that were made recently.');
    expect(redeemMessage({ ok: false, reason: 'code-full' }, {})).toBe('That code has already reached its limit of friends.');
  });

  it('says the server could not be reached for an answer it cannot read', () => {
    [null, undefined, 'x', {}, { ok: false }, { ok: false, reason: 'something-new' }].forEach((v) => expect(redeemMessage(v, rules)).toBe(SERVER_UNREACHABLE));
  });
});

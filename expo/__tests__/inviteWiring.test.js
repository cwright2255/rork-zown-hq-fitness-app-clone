// The invite code and its reward are wired through: the two callable functions are exported and call the referral logic, the app asks for
// them by those names, an account's erasure removes the code, and the docs tell how to deploy and check it.
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const index = read('functions/src/index.js');

describe('the functions', () => {
  it('export getInviteStatus and redeemInviteCode as callables that need a signed-in person', () => {
    expect(index).toMatch(/export const getInviteStatus = onCall\(/);
    expect(index).toMatch(/export const redeemInviteCode = onCall\(/);
    const status = index.slice(index.indexOf('export const getInviteStatus'), index.indexOf('export const redeemInviteCode'));
    const redeem = index.slice(index.indexOf('export const redeemInviteCode'), index.indexOf('export const settleDuels'));
    expect(status).toMatch(/const uid = requireAuth\(req\.auth\);/);
    expect(redeem).toMatch(/const uid = requireAuth\(req\.auth\);/);
  });

  it('give the person\'s own uid to the logic, never one sent from the phone', () => {
    expect(index).toMatch(/inviteStatusFor\(\{ db: getFirestore\(\), uid \}\)/);
    expect(index).toMatch(/redeemInvite\(\{ db: getFirestore\(\), uid, code, accountCreatedMs: \(\) => accountCreatedMs\(uid\) \}\)/);
    expect(index).not.toMatch(/req\.data\.uid|req\.data\?\.uid/);
  });

  it('check how old the account is from the sign-in account\'s own date', () => {
    expect(index).toMatch(/async function accountCreatedMs\(uid\)[\s\S]*?creationTime/);
  });
});

describe('the app', () => {
  it('asks for them by the names the functions export', () => {
    const service = read('services/inviteService.js');
    expect(service).toMatch(/callProxy\('getInviteStatus', \{\}\)/);
    expect(service).toMatch(/callProxy\('redeemInviteCode', \{ code \}\)/);
  });

  it('opens the invite screen from the Home banner', () => {
    expect(read('app/hq.jsx')).toMatch(/onPress=\{\(\) => router\.push\('\/invite'\)\}/);
    expect(fs.existsSync(path.join(__dirname, '..', 'app/invite.jsx'))).toBe(true);
  });
});

describe('erasing an account', () => {
  it('removes the invite code, so nobody can join with it afterwards', () => {
    expect(read('functions/src/accountErasure.js')).toMatch(/run\('inviteCode', \(\) => deleteQuery\(db, \(\) => db\.collection\('inviteCodes'\)\.where\('uid', '==', uid\)\)\)/);
  });
});

describe('the docs', () => {
  const doc = read('docs/DEVICE_CHECKS.md');
  it('say how to deploy the functions and how to check an invite on two phones', () => {
    expect(doc).toMatch(/Invite your friends/);
    expect(doc).toMatch(/firebase deploy --only functions:getInviteStatus,functions:redeemInviteCode/);
  });
});

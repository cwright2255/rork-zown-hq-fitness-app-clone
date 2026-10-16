// Content the admin console manages (running programs, app settings, community groups) and the list of who the admins
// are. Being an admin means having a document at admins/{uid}; nothing a signed-in phone can write can create one, and
// saying "I am an admin" in the sign-in token does not count.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

const ADMIN = { 'admins/root': { since: '2026-10-01' } };

describe('/admins/{uid}', () => {
  it('can be read by anyone signed in (the admin console asks "is this person an admin")', async () => {
    await env.seed(ADMIN);
    await ok(env.as('alice').doc('admins/root').get());
    await ok(env.as('alice').doc('admins/alice').get()); // not an admin: reads as "no such document"
  });

  it('cannot be read by a visitor who is not signed in', async () => {
    await env.seed(ADMIN);
    await no(env.anon().doc('admins/root').get());
  });

  it('cannot be written from the app by anyone, so no one can make themselves an admin', async () => {
    await env.seed(ADMIN);
    await no(env.as('alice').doc('admins/alice').set({ since: '2026-10-16' }));
    await no(env.as('alice', { admin: true }).doc('admins/alice').set({ since: '2026-10-16' }));
    await no(env.as('root').doc('admins/bob').set({ since: '2026-10-16' }));
    await no(env.as('root').doc('admins/root').update({ since: '2020-01-01' }));
    await no(env.as('root').doc('admins/root').delete());
    await no(env.anon().doc('admins/mallory').set({ since: '2026-10-16' }));
  });
});

describe.each([
  ['/runningPrograms/{programId}', 'runningPrograms/p1'],
  ['/config/{docId}', 'config/app'],
])('%s', (rulePath, docPath) => {
  it('can be read by anyone signed in, not by a visitor', async () => {
    await env.seed({ [docPath]: { title: 'x' } });
    await ok(env.as('alice').doc(docPath).get());
    await no(env.anon().doc(docPath).get());
  });

  it('can be created, changed and deleted by an admin', async () => {
    await env.seed(ADMIN);
    const asAdmin = env.as('root').doc(docPath);
    await ok(asAdmin.set({ title: 'one' }));
    await ok(asAdmin.update({ title: 'two' }));
    await ok(asAdmin.delete());
  });

  it('cannot be created, changed or deleted by anyone else', async () => {
    await env.seed({ ...ADMIN, [docPath]: { title: 'x' } });
    const asAlice = env.as('alice').doc(docPath);
    await no(asAlice.set({ title: 'mine' }));
    await no(asAlice.update({ title: 'mine' }));
    await no(asAlice.delete());
    await no(env.as('alice').doc(`${docPath}-new`).set({ title: 'mine' }));
    await no(env.anon().doc(docPath).update({ title: 'mine' }));
  });

  it('is not opened by a sign-in token that says its owner is an admin', async () => {
    await env.seed({ [docPath]: { title: 'x' } });
    const claimsAdmin = env.as('mallory', { admin: true });
    await no(claimsAdmin.doc(docPath).update({ title: 'mine' }));
    await no(claimsAdmin.doc(docPath).delete());
  });
});

describe('/communityGroups/{groupId}', () => {
  const group = { name: 'Morning Runners', memberCount: 3 };

  it('can be read by anyone signed in, not by a visitor', async () => {
    await env.seed({ 'communityGroups/g1': group });
    await ok(env.as('alice').doc('communityGroups/g1').get());
    await ok(env.as('alice').collection('communityGroups').get());
    await no(env.anon().doc('communityGroups/g1').get());
  });

  it('can be created and deleted by an admin only', async () => {
    await env.seed({ ...ADMIN, 'communityGroups/g2': group });
    await ok(env.as('root').doc('communityGroups/g1').set(group));
    await ok(env.as('root').doc('communityGroups/g1').delete());
    await no(env.as('alice').doc('communityGroups/g3').set(group));
    await no(env.as('alice').doc('communityGroups/g2').delete());
    await no(env.anon().doc('communityGroups/g3').set(group));
  });

  it('can be changed in any way by an admin', async () => {
    await env.seed({ ...ADMIN, 'communityGroups/g1': group });
    await ok(env.as('root').doc('communityGroups/g1').update({ name: 'Evening Runners', memberCount: 4 }));
  });

  it('lets anyone else change only the member count (joining or leaving)', async () => {
    await env.seed({ 'communityGroups/g1': group });
    await ok(env.as('alice').doc('communityGroups/g1').update({ memberCount: 4 }));
    await no(env.as('alice').doc('communityGroups/g1').update({ name: "Alice's group now" }));
    await no(env.as('alice').doc('communityGroups/g1').update({ memberCount: 5, name: 'and renamed' }));
    await no(env.anon().doc('communityGroups/g1').update({ memberCount: 5 }));
  });
});

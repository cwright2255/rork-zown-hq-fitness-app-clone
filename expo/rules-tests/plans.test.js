// Plans (lib/entitlements.js): the plan a person has is read from entitlements/{uid}, which only the Firebase console and the
// server can write, and the day's AI message count in aiUsage is for the server alone. If either of these let a phone write, anyone
// could give themselves Pro or Legend, or reset their daily limit.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

const plan = (over = {}) => ({ tier: 'pro', status: 'active', expiresAt: null, source: 'manual', ...over });

describe('/entitlements/{uid}', () => {
  it('can be read by the person it belongs to, not by anyone else', async () => {
    await env.seed({ 'entitlements/alice': plan() });
    await ok(env.as('alice').doc('entitlements/alice').get());
    await no(env.as('bob').doc('entitlements/alice').get());
    await no(env.anon().doc('entitlements/alice').get());
  });

  it('can be read by its owner even when there is no plan yet', async () => {
    await ok(env.as('alice').doc('entitlements/alice').get());
  });

  it('cannot be listed', async () => {
    await env.seed({ 'entitlements/alice': plan(), 'entitlements/bob': plan({ tier: 'legend' }) });
    await no(env.as('alice').collection('entitlements').get());
  });

  it('cannot be created, changed or removed from the app, by its owner or anyone else', async () => {
    await env.seed({ 'entitlements/alice': plan({ tier: 'free' }), 'admins/root': { since: '2026-10-01' } });
    for (const db of [env.as('alice'), env.as('bob'), env.as('root'), env.anon()]) {
      await no(db.doc('entitlements/alice').set(plan({ tier: 'legend' })));
      await no(db.doc('entitlements/alice').update({ tier: 'legend' }));
      await no(db.doc('entitlements/alice').delete());
    }
    await no(env.as('alice').doc('entitlements/new').set(plan()));
    await no(env.as('bob').doc('entitlements/bob').set(plan()));
  });
});

describe('/aiUsage/{usageId}', () => {
  it('cannot be read by anyone, the person it counts included', async () => {
    await env.seed({ 'aiUsage/alice_2026-10-20': { uid: 'alice', day: '2026-10-20', coach: 3 } });
    for (const db of [env.as('alice'), env.as('bob'), env.anon()]) {
      await no(db.doc('aiUsage/alice_2026-10-20').get());
    }
    await no(env.as('alice').collection('aiUsage').where('uid', '==', 'alice').get());
  });

  it('cannot be written, so the count cannot be lowered or reset', async () => {
    await env.seed({ 'aiUsage/alice_2026-10-20': { uid: 'alice', day: '2026-10-20', coach: 5 }, 'admins/root': { since: '2026-10-01' } });
    for (const db of [env.as('alice'), env.as('bob'), env.as('root'), env.anon()]) {
      await no(db.doc('aiUsage/alice_2026-10-20').set({ uid: 'alice', day: '2026-10-20', coach: 0 }));
      await no(db.doc('aiUsage/alice_2026-10-20').update({ coach: 0 }));
      await no(db.doc('aiUsage/alice_2026-10-20').delete());
    }
    await no(env.as('alice').doc('aiUsage/alice_2026-10-21').set({ uid: 'alice', day: '2026-10-21', coach: 0 }));
  });
});

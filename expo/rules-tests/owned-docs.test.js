// Collections at the top level whose documents carry the id of the person they belong to in a userId field (workouts,
// logged sets, goals, coach messages, AI recommendations). Being signed in is not enough: the userId has to be yours.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

describe.each([
  ['/workouts/{workoutId}', 'workouts'],
  ['/loggedSets/{setId}', 'loggedSets'],
  ['/goals/{goalId}', 'goals'],
])('%s', (rulePath, collection) => {
  const docPath = `${collection}/d1`;
  const mine = { userId: 'alice', note: 'mine' };

  it('lets the person it belongs to create, read, change and delete it', async () => {
    const doc = env.as('alice').doc(docPath);
    await ok(doc.set(mine));
    await ok(doc.get());
    await ok(doc.update({ note: 'changed' }));
    await ok(doc.delete());
  });

  it('refuses to create one in someone else\'s name', async () => {
    await no(env.as('alice').doc(docPath).set({ userId: 'bob', note: 'not mine' }));
  });

  it('refuses to create one that says no one owns it', async () => {
    await no(env.as('alice').doc(docPath).set({ note: 'no owner' }));
  });

  it('turns away another signed-in person from reading, changing or deleting it', async () => {
    await env.seed({ [docPath]: mine });
    const notBobs = env.as('bob').doc(docPath);
    await no(notBobs.get());
    await no(notBobs.update({ note: 'changed by bob' }));
    await no(notBobs.delete());
  });

  it('lists only what the person asks for under their own id', async () => {
    await env.seed({ [docPath]: mine });
    await ok(env.as('alice').collection(collection).where('userId', '==', 'alice').get());
    await no(env.as('bob').collection(collection).where('userId', '==', 'alice').get());
    // Asking for everyone's is refused outright: the rules do not filter, they only allow or refuse the whole request.
    await no(env.as('alice').collection(collection).get());
  });

  it('turns away a visitor who is not signed in', async () => {
    await env.seed({ [docPath]: mine });
    const doc = env.anon().doc(docPath);
    await no(doc.get());
    await no(doc.set(mine));
    await no(doc.update({ note: 'x' }));
    await no(doc.delete());
  });
});

describe('/coachMessages/{messageId}', () => {
  const docPath = 'coachMessages/m1';
  const mine = { userId: 'alice', role: 'user', content: 'How many sets today?' };

  it('can be added and read by the person it belongs to', async () => {
    const doc = env.as('alice').doc(docPath);
    await ok(doc.set(mine));
    await ok(doc.get());
    await ok(env.as('alice').collection('coachMessages').where('userId', '==', 'alice').get());
  });

  it('can never be changed or deleted afterwards, not even by its owner (it is a log)', async () => {
    await env.seed({ [docPath]: mine });
    const doc = env.as('alice').doc(docPath);
    await no(doc.update({ content: 'rewritten' }));
    await no(doc.set({ ...mine, content: 'rewritten' }));
    await no(doc.delete());
  });

  it('cannot be added in someone else\'s name', async () => {
    await no(env.as('alice').doc(docPath).set({ ...mine, userId: 'bob' }));
  });

  it('cannot be read by another person or a visitor', async () => {
    await env.seed({ [docPath]: mine });
    await no(env.as('bob').doc(docPath).get());
    await no(env.as('bob').collection('coachMessages').where('userId', '==', 'alice').get());
    await no(env.anon().doc(docPath).get());
    await no(env.anon().doc('coachMessages/m2').set(mine));
  });
});

describe('/aiRecommendations/{recId}', () => {
  const docPath = 'aiRecommendations/r1';
  const mine = { userId: 'alice', text: 'Rest day tomorrow' };

  it('can be read by the person it is for', async () => {
    await env.seed({ [docPath]: mine });
    await ok(env.as('alice').doc(docPath).get());
    await ok(env.as('alice').collection('aiRecommendations').where('userId', '==', 'alice').get());
  });

  it('can be written by no one from the app, not even the person it is for (the server writes them)', async () => {
    await env.seed({ [docPath]: mine });
    const doc = env.as('alice').doc(docPath);
    await no(doc.update({ text: 'changed' }));
    await no(doc.delete());
    await no(env.as('alice').doc('aiRecommendations/r2').set(mine));
  });

  it('cannot be read by another person or a visitor', async () => {
    await env.seed({ [docPath]: mine });
    await no(env.as('bob').doc(docPath).get());
    await no(env.anon().doc(docPath).get());
  });
});

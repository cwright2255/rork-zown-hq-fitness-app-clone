// Everything stored under a person's own users/{uid} folder: their profile, devices, settings, recipes, history and so on.
// The rule for all of it is the same: the person it belongs to, and nobody else, not even someone who is signed in.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

// Each row: the path as written in firestore.rules, and one real document at that path that belongs to alice.
const OWNER_ONLY = [
  ['/users/{userId}', 'users/alice'],
  ['/users/{userId}/devices/{deviceId}', 'users/alice/devices/watch-1'],
  ['/users/{userId}/data/{docId}', 'users/alice/data/settings'],
  ['/users/{userId}/recipes/{recipeId}', 'users/alice/recipes/r1'],
  ['/users/{userId}/fastingHistory/{fastId}', 'users/alice/fastingHistory/2026-10-14'],
  ['/users/{userId}/workoutTemplates/{templateId}', 'users/alice/workoutTemplates/t1'],
  ['/users/{userId}/following/{otherUid}', 'users/alice/following/bob'],
];

// History that can be added and removed but never edited, so it cannot be rewritten afterwards.
const ADD_AND_REMOVE_ONLY = [
  ['/users/{userId}/formSessions/{sessionId}', 'users/alice/formSessions/s1'],
  ['/users/{userId}/bodyScans/{scanId}', 'users/alice/bodyScans/b1'],
  ['/users/{userId}/weightLogs/{logId}', 'users/alice/weightLogs/w1'],
  ['/users/{userId}/challengeJoins/{challengeId}', 'users/alice/challengeJoins/c1'],
  ['/users/{userId}/groupMemberships/{groupId}', 'users/alice/groupMemberships/g1'],
];

const theirs = (docPath) => docPath.replace('users/alice', 'users/bob');

describe.each(OWNER_ONLY)('%s', (rulePath, docPath) => {
  it('lets its owner create, read, change and delete it', async () => {
    const mine = env.as('alice').doc(docPath);
    await ok(mine.set({ n: 1 }));
    await ok(mine.get());
    await ok(mine.update({ n: 2 }));
    await ok(mine.delete());
  });

  it('turns away another signed-in person from reading, changing or deleting it', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const notBobs = env.as('bob').doc(docPath);
    await no(notBobs.get());
    await no(notBobs.set({ n: 9 }));
    await no(notBobs.update({ n: 9 }));
    await no(notBobs.delete());
  });

  it('does not let one person write into, or read from, another person\'s', async () => {
    await env.seed({ [theirs(docPath)]: { n: 1 } });
    await no(env.as('alice').doc(theirs(docPath)).get());
    await no(env.as('alice').doc(theirs(docPath)).set({ n: 9 }));
  });

  it('turns away a visitor who is not signed in', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const doc = env.anon().doc(docPath);
    await no(doc.get());
    await no(doc.set({ n: 9 }));
    await no(doc.update({ n: 9 }));
    await no(doc.delete());
  });
});

describe.each(ADD_AND_REMOVE_ONLY)('%s', (rulePath, docPath) => {
  it('lets its owner add, read and delete one, but never change it', async () => {
    const mine = env.as('alice').doc(docPath);
    await ok(mine.set({ n: 1 }));
    await ok(mine.get());
    await no(mine.update({ n: 2 }));
    await no(mine.set({ n: 3 })); // writing over one that is there is a change too
    await ok(mine.delete());
  });

  it('turns away another signed-in person from reading, adding to, or deleting it', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const notBobs = env.as('bob').doc(docPath);
    await no(notBobs.get());
    await no(notBobs.delete());
    await no(env.as('bob').doc(`${docPath}-by-bob`).set({ n: 1 }));
  });

  it('does not let one person add to another person\'s', async () => {
    await no(env.as('alice').doc(theirs(docPath)).set({ n: 1 }));
  });

  it('turns away a visitor who is not signed in', async () => {
    await env.seed({ [docPath]: { n: 1 } });
    const doc = env.anon().doc(docPath);
    await no(doc.get());
    await no(doc.set({ n: 9 }));
    await no(doc.delete());
  });
});

describe('/users/{userId}/stats/{docId}', () => {
  const stats = 'users/alice/stats/summary';

  it('can be read by its owner and written by no one, not even the owner', async () => {
    await env.seed({ [stats]: { workouts: 3 } });
    const mine = env.as('alice').doc(stats);
    await ok(mine.get());
    await no(mine.set({ workouts: 99 }));
    await no(mine.update({ workouts: 99 }));
    await no(mine.delete());
    await no(env.as('alice').doc('users/alice/stats/another').set({ workouts: 1 }));
  });

  it('cannot be read by another person or a visitor', async () => {
    await env.seed({ [stats]: { workouts: 3 } });
    await no(env.as('bob').doc(stats).get());
    await no(env.anon().doc(stats).get());
  });

  // The invite record (functions/src/referrals.js) says how many friends joined and how many Pro days were earned: the person can read it and
  // nothing they send can change it, or they could give themselves days or reset the limit on their code.
  it('holds the invite record, which its owner can read and nobody can write', async () => {
    const invite = 'users/alice/stats/invite';
    await env.seed({ [invite]: { code: 'K7P2QX4M', joined: 1, rewarded: 1, daysEarned: 7 } });
    await ok(env.as('alice').doc(invite).get());
    await no(env.as('bob').doc(invite).get());
    for (const db of [env.as('alice'), env.as('bob'), env.anon()]) {
      await no(db.doc(invite).set({ code: 'K7P2QX4M', joined: 0, rewarded: 0, daysEarned: 700 }));
      await no(db.doc(invite).update({ rewarded: 0 }));
      await no(db.doc(invite).delete());
    }
  });
});

// Which achievements and badges are unlocked and which Battle Pass tiers are claimed are written by Cloud Functions only
// (functions/src/unlocks.js). The person can read them; nothing they send can change them. The other documents in the same folder stay theirs.
describe.each(['achievements', 'badges', 'battlePass'])('/users/{userId}/data/%s, written only by the server', (name) => {
  const docPath = `users/alice/data/${name}`;
  const seeded = name === 'battlePass' ? { claimedTiers: [1] } : { unlocked: { x: '2026-10-21T12:00:00.000Z' } };

  it('can be read by its owner', async () => {
    await env.seed({ [docPath]: seeded });
    await ok(env.as('alice').doc(docPath).get());
  });

  it('cannot be created, changed, merged into or deleted by its owner', async () => {
    const mine = env.as('alice').doc(docPath);
    await no(mine.set(seeded));
    await no(mine.set(seeded, { merge: true }));
    await env.seed({ [docPath]: seeded });
    await no(mine.set({ claimedTiers: [1, 2, 3, 4, 5], unlocked: { y: 'now' } }));
    await no(mine.set({ claimedTiers: [1, 2, 3, 4, 5], unlocked: { y: 'now' } }, { merge: true }));
    await no(mine.update({ claimedTiers: [1, 2, 3, 4, 5] }));
    await no(mine.delete());
  });

  it('cannot be read by another person or a visitor, or written by them', async () => {
    await env.seed({ [docPath]: seeded });
    await no(env.as('bob').doc(docPath).get());
    await no(env.anon().doc(docPath).get());
    await no(env.as('bob').doc(docPath).set(seeded));
    await no(env.anon().doc(docPath).set(seeded));
  });

  it('leaves the owner free to write their other documents in the same folder', async () => {
    await ok(env.as('alice').doc('users/alice/data/settings').set({ n: 1 }));
    await ok(env.as('alice').doc('users/alice/data/hikes').set({ hikes: [] }));
    await ok(env.as('alice').doc(`users/alice/data/${name}s`).set({ n: 1 })); // a name that only starts like it
  });
});

describe('who can list people', () => {
  it('nobody can list every profile, only open their own', async () => {
    await env.seed({ 'users/alice': { name: 'Alice' }, 'users/bob': { name: 'Bob' } });
    await no(env.as('alice').collection('users').get());
    await no(env.anon().collection('users').get());
  });

  it('nobody can list another person\'s folder', async () => {
    await env.seed({ 'users/alice/recipes/r1': { name: 'Soup' } });
    await ok(env.as('alice').collection('users/alice/recipes').get());
    await no(env.as('bob').collection('users/alice/recipes').get());
  });
});

// A path with no rule is closed to everyone. Firestore does not carry a rule down into folders inside the one it is written
// for, so a folder nobody wrote a rule for (a new feature's, a misspelt one) is simply locked, whoever asks. Every test here
// names something that has no rule on purpose; if one of them starts to pass, a rule was added that lets people in.
const { rulesEnv, no } = require('./helpers');

const env = rulesEnv();

describe('a path that no rule names', () => {
  const closed = [
    'notes/n1', // a collection that has no rule at all
    'inviteCodes/K7P2QX4M', // which invite code belongs to whom: only the functions read it (functions/src/referrals.js)
    'users/alice/unlisted/x', // a folder in alice's own space that no rule names
    'users/alice/data/settings/nested/x', // a folder inside data/{docId}: that rule does not reach this far down
    'communityPosts/p1/reports/r1', // a folder inside a post that no rule names
    'conversations/alice_bob/typing/alice',
  ];

  it.each(closed)('%s is closed to its own person, to others, to an admin and to visitors', async (docPath) => {
    await env.seed({ [docPath]: { n: 1 }, 'admins/root': { since: '2026-10-01' } });
    for (const db of [env.as('alice'), env.as('bob'), env.as('root'), env.anon()]) {
      const doc = db.doc(docPath);
      await no(doc.get());
      await no(doc.set({ n: 2 }));
      await no(doc.update({ n: 2 }));
      await no(doc.delete());
    }
  });

  it('cannot be listed either', async () => {
    await env.seed({ 'notes/n1': { n: 1 }, 'users/alice/unlisted/x': { n: 1 } });
    await no(env.as('alice').collection('notes').get());
    await no(env.as('alice').collection('users/alice/unlisted').get());
  });
});

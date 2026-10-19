// The parts of the app people share: the leaderboard, the community feed with its likes and comments, and private
// conversations between two people.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

describe('/leaderboard/{uid}', () => {
  // What store/leaderboardStore.js publishes: who the person is. The scores (XP, level, streak and the distance map) are written
  // by the XP ledger function, which is not held to the rules, so a score here is put in without them.
  const entry = (over = {}) => ({ name: 'Alice', avatar: null, updatedAt: '2026-10-19T12:00:00.000Z', ...over });
  const scored = (over = {}) => entry({ xp: 1200, level: 4, streak: 3, distance: { w20261019: 5, m202610: 9 }, ...over });

  it('can be read by anyone signed in, whoever it is about', async () => {
    await env.seed({ 'leaderboard/alice': scored() });
    await ok(env.as('bob').doc('leaderboard/alice').get());
    await ok(env.as('bob').collection('leaderboard').get());
  });

  it('can only be written by the person it is about', async () => {
    const mine = env.as('alice').doc('leaderboard/alice');
    await ok(mine.set(entry()));
    await ok(mine.update({ name: 'Alice W.' }));
    await ok(mine.delete());
    await no(env.as('alice').doc('leaderboard/bob').set(entry()));
  });

  it('cannot be changed by someone else, even to a lower score', async () => {
    await env.seed({ 'leaderboard/alice': scored() });
    await no(env.as('bob').doc('leaderboard/alice').update({ xp: 0 }));
    await no(env.as('bob').doc('leaderboard/alice').update({ name: 'Not Alice' }));
    await no(env.as('bob').doc('leaderboard/alice').delete());
  });

  it('is closed to a visitor who is not signed in', async () => {
    await env.seed({ 'leaderboard/alice': scored() });
    await no(env.anon().doc('leaderboard/alice').get());
    await no(env.anon().doc('leaderboard/alice').set(entry()));
  });

  describe('what the person may write: who they are, and nothing about their score', () => {
    const write = (data, options) => env.as('alice').doc('leaderboard/alice').set(data, options);

    it('accepts a name and a picture, and a merge of them into what is already there, as the app writes them', async () => {
      await ok(write(entry()));
      await ok(write(entry({ avatar: 'https://example.com/a.jpg' })));
      await ok(write({ name: 'Alice' }));
      await env.seed({ 'leaderboard/alice': scored() });
      await ok(write({ name: 'Alice Wright', avatar: 'https://example.com/b.jpg', updatedAt: '2026-10-19T13:00:00.000Z' }, { merge: true }));
    });

    it('refuses XP on a new entry, whatever the number', async () => {
      await no(write(entry({ xp: 1200 })));
      await no(write(entry({ xp: 0 })));
      await no(write(entry({ xp: 5000000 })));
    });

    it('refuses a level, a streak or a distance on a new entry', async () => {
      await no(write(entry({ level: 4 })));
      await no(write(entry({ streak: 3 })));
      await no(write(entry({ distance: { w20261019: 5000 } })));
      await no(write(entry({ distance: {} })));
      await no(write(scored()));
    });

    it('refuses to change the score of an entry that has one, by any way of writing it', async () => {
      await env.seed({ 'leaderboard/alice': scored() });
      const mine = env.as('alice').doc('leaderboard/alice');
      await no(mine.update({ xp: 5000000 }));
      await no(mine.update({ xp: 0 }));
      await no(mine.update({ level: 100 }));
      await no(mine.update({ streak: 5000 }));
      await no(mine.update({ distance: { w20261019: 5000 } }));
      await no(mine.update({ 'distance.w20261019': 5000 }));
      await no(write({ xp: 5000000 }, { merge: true }));
      await no(write({ distance: { w20261019: 5000 } }, { merge: true }));
      await no(write(scored({ xp: 5000000 })));
      await no(write(scored({ xp: 5000000, name: 'Alice' }), { merge: true }));
    });

    it('refuses a change to the score even when it comes with a change to the name', async () => {
      await env.seed({ 'leaderboard/alice': scored() });
      await no(env.as('alice').doc('leaderboard/alice').update({ name: 'Alice W.', xp: 5000000 }));
    });

    it('cannot get a score on by deleting the entry and making it again', async () => {
      await env.seed({ 'leaderboard/alice': scored() });
      const mine = env.as('alice').doc('leaderboard/alice');
      await ok(mine.delete());
      await no(mine.set(scored({ xp: 5000000 })));
      await ok(mine.set(entry()));
    });

    it('refuses a name or picture that is the wrong kind or far too long', async () => {
      await no(write(entry({ name: 42 })));
      await no(write(entry({ name: 'x'.repeat(101) })));
      await no(write(entry({ avatar: 42 })));
      await no(write(entry({ avatar: 'x'.repeat(2001) })));
      await no(write(entry({ updatedAt: 5 })));
      await no(write(entry({ updatedAt: 'x'.repeat(41) })));
    });

    it('refuses fields the app never writes', async () => {
      await no(write(entry({ points: 9999 })));
      await no(write(entry({ admin: true })));
      await no(write(entry({ rank: 1 })));
    });

    it('still lets an entry written by an older version of the app, with scores on it, be updated for the name, and removed', async () => {
      await env.seed({ 'leaderboard/alice': scored({ points: 120 }) });
      const mine = env.as('alice').doc('leaderboard/alice');
      await ok(mine.update({ name: 'Alice W.' }));
      await no(mine.update({ points: 5000 }));
      await no(mine.update({ xp: 1300 }));
      await ok(mine.delete());
    });
  });
});

describe('/communityPosts/{postId}', () => {
  const post = { authorId: 'alice', text: 'First run done', likeCount: 0, commentCount: 0, shareCount: 0 };

  it('can be read by anyone signed in, not by a visitor', async () => {
    await env.seed({ 'communityPosts/p1': post });
    await ok(env.as('bob').doc('communityPosts/p1').get());
    await ok(env.as('bob').collection('communityPosts').get());
    await no(env.anon().doc('communityPosts/p1').get());
  });

  it('can be created by anyone signed in, but only as themselves', async () => {
    await ok(env.as('alice').doc('communityPosts/p1').set(post));
    await no(env.as('bob').doc('communityPosts/p2').set(post)); // says alice wrote it
    await no(env.anon().doc('communityPosts/p3').set(post));
  });

  it('can be edited in any way by its author', async () => {
    await env.seed({ 'communityPosts/p1': post });
    await ok(env.as('alice').doc('communityPosts/p1').update({ text: 'Edited', likeCount: 3 }));
  });

  it('lets someone else change only the like, comment and share counts', async () => {
    await env.seed({ 'communityPosts/p1': post });
    const asBob = env.as('bob').doc('communityPosts/p1');
    await ok(asBob.update({ likeCount: 1 }));
    await ok(asBob.update({ commentCount: 1 }));
    await ok(asBob.update({ shareCount: 1 }));
    await ok(asBob.update({ likeCount: 2, commentCount: 2, shareCount: 2 }));
  });

  it('does not let someone else change anything else about it', async () => {
    await env.seed({ 'communityPosts/p1': post });
    const asBob = env.as('bob').doc('communityPosts/p1');
    await no(asBob.update({ text: 'Bob rewrote this' }));
    await no(asBob.update({ authorId: 'bob' }));
    await no(asBob.update({ likeCount: 1, text: 'and rewrote this' }));
    await no(asBob.update({ commentsDisabled: true }));
  });

  it('does not let a visitor change it', async () => {
    await env.seed({ 'communityPosts/p1': post });
    await no(env.anon().doc('communityPosts/p1').update({ likeCount: 1 }));
  });

  it('can be deleted by its author or by an admin, not by anyone else', async () => {
    await env.seed({ 'communityPosts/p1': post, 'communityPosts/p2': post, 'communityPosts/p3': post, 'admins/root': { since: '2026-10-01' } });
    await no(env.as('bob').doc('communityPosts/p1').delete());
    await no(env.anon().doc('communityPosts/p1').delete());
    await ok(env.as('alice').doc('communityPosts/p1').delete());
    await ok(env.as('root').doc('communityPosts/p2').delete());
    // Saying you are an admin is not enough; there has to be an admins/{uid} document for you.
    await no(env.as('mallory', { admin: true }).doc('communityPosts/p3').delete());
  });
});

describe('/communityPosts/{postId}/likes/{uid}', () => {
  beforeEach(() => env.seed({ 'communityPosts/p1': { authorId: 'alice', likeCount: 0 } }));

  it('can be read by anyone signed in', async () => {
    await env.seed({ 'communityPosts/p1/likes/alice': { at: 1 } });
    await ok(env.as('bob').doc('communityPosts/p1/likes/alice').get());
    await no(env.anon().doc('communityPosts/p1/likes/alice').get());
  });

  it('can be added and removed only by the person whose like it is', async () => {
    await ok(env.as('bob').doc('communityPosts/p1/likes/bob').set({ at: 1 }));
    await no(env.as('bob').doc('communityPosts/p1/likes/carol').set({ at: 1 }));
    await env.seed({ 'communityPosts/p1/likes/carol': { at: 1 } });
    await no(env.as('bob').doc('communityPosts/p1/likes/carol').delete());
    await ok(env.as('bob').doc('communityPosts/p1/likes/bob').delete());
  });

  it('cannot be edited', async () => {
    await env.seed({ 'communityPosts/p1/likes/bob': { at: 1 } });
    await no(env.as('bob').doc('communityPosts/p1/likes/bob').update({ at: 2 }));
  });
});

describe('/communityPosts/{postId}/comments/{commentId}', () => {
  const comment = { authorId: 'bob', text: 'Nice one' };

  it('can be read by anyone signed in, not by a visitor', async () => {
    await env.seed({ 'communityPosts/p1': { authorId: 'alice' }, 'communityPosts/p1/comments/c1': comment });
    await ok(env.as('carol').doc('communityPosts/p1/comments/c1').get());
    await no(env.anon().doc('communityPosts/p1/comments/c1').get());
  });

  it('can be added by anyone signed in, but only as themselves', async () => {
    await env.seed({ 'communityPosts/p1': { authorId: 'alice' } });
    await ok(env.as('bob').doc('communityPosts/p1/comments/c1').set(comment));
    await no(env.as('carol').doc('communityPosts/p1/comments/c2').set(comment)); // says bob wrote it
    await no(env.anon().doc('communityPosts/p1/comments/c3').set(comment));
  });

  it('cannot be added where the author turned comments off', async () => {
    await env.seed({
      'communityPosts/off': { authorId: 'alice', commentsDisabled: true },
      'communityPosts/on': { authorId: 'alice', commentsDisabled: false },
    });
    await no(env.as('bob').doc('communityPosts/off/comments/c1').set(comment));
    await ok(env.as('bob').doc('communityPosts/on/comments/c1').set(comment));
  });

  it('cannot be added to a post that does not exist', async () => {
    await no(env.as('bob').doc('communityPosts/nothing-here/comments/c1').set(comment));
  });

  it('can be deleted by its author only, and never edited', async () => {
    await env.seed({ 'communityPosts/p1': { authorId: 'alice' }, 'communityPosts/p1/comments/c1': comment });
    await no(env.as('carol').doc('communityPosts/p1/comments/c1').delete());
    await no(env.as('alice').doc('communityPosts/p1/comments/c1').delete()); // the post's author cannot remove it
    await no(env.as('bob').doc('communityPosts/p1/comments/c1').update({ text: 'edited' }));
    await ok(env.as('bob').doc('communityPosts/p1/comments/c1').delete());
  });
});

describe('/conversations/{conversationId}', () => {
  const chat = { participantIds: ['alice', 'bob'], lastMessage: 'hi' };

  it('can be read by the two people in it, not by anyone else', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await ok(env.as('alice').doc('conversations/alice_bob').get());
    await ok(env.as('bob').doc('conversations/alice_bob').get());
    await no(env.as('carol').doc('conversations/alice_bob').get());
    await no(env.anon().doc('conversations/alice_bob').get());
  });

  it('lists only the conversations the person is in', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await ok(env.as('alice').collection('conversations').where('participantIds', 'array-contains', 'alice').get());
    await no(env.as('carol').collection('conversations').where('participantIds', 'array-contains', 'alice').get());
    await no(env.as('alice').collection('conversations').get());
  });

  it('can be started by someone who is one of the two people in it', async () => {
    await ok(env.as('alice').doc('conversations/alice_bob').set(chat));
    await ok(env.as('bob').doc('conversations/alice_bob').set(chat));
    await no(env.as('carol').doc('conversations/alice_bob').set(chat));
    await no(env.anon().doc('conversations/alice_bob').set(chat));
  });

  describe('starting one', () => {
    it('needs exactly two people, in order, under the id those two make', async () => {
      await no(env.as('alice').doc('conversations/alice').set({ ...chat, participantIds: ['alice'] }));
      await no(env.as('alice').doc('conversations/alice_bob_carol').set({ ...chat, participantIds: ['alice', 'bob', 'carol'] }));
      await no(env.as('alice').doc('conversations/alice_alice').set({ ...chat, participantIds: ['alice', 'alice'] }));
      await no(env.as('alice').doc('conversations/bob_alice').set({ ...chat, participantIds: ['bob', 'alice'] })); // not in order
      await no(env.as('alice').doc('conversations/carol_dave').set(chat)); // the id of some other pair
      await no(env.as('alice').doc('conversations/alice_bob').set({ ...chat, participantIds: 'alice_bob' }));
    });

    it('cannot take over the id of two other people by naming yourself in it', async () => {
      await no(env.as('carol').doc('conversations/alice_bob').set({ ...chat, participantIds: ['alice', 'carol'] }));
      await no(env.as('carol').doc('conversations/alice_bob').set({ ...chat, participantIds: ['bob', 'carol'] }));
      await ok(env.as('carol').doc('conversations/alice_carol').set({ ...chat, participantIds: ['alice', 'carol'] }));
    });
  });

  it('can be updated by the two people in it, not by anyone else', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await ok(env.as('bob').doc('conversations/alice_bob').update({ lastMessage: 'hello' }));
    await no(env.as('carol').doc('conversations/alice_bob').update({ lastMessage: 'hello' }));
  });

  it('can be updated by merging, as the app does for each new message', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await ok(env.as('alice').doc('conversations/alice_bob').set({ lastMessage: 'hello', updatedAt: '2026-10-19T12:00:00.000Z' }, { merge: true }));
  });

  it('cannot have its list of people changed, by either of them', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await no(env.as('alice').doc('conversations/alice_bob').update({ participantIds: ['alice', 'bob', 'carol'] }));
    await no(env.as('alice').doc('conversations/alice_bob').update({ participantIds: ['alice', 'carol'] }));
    await no(env.as('bob').doc('conversations/alice_bob').update({ participantIds: ['bob'] }));
    await no(env.as('bob').doc('conversations/alice_bob').update({ participantIds: ['bob', 'alice'] })); // same people, different order
    await no(env.as('alice').doc('conversations/alice_bob').set({ lastMessage: 'hi' })); // a full replace drops the list
  });

  it('cannot be deleted by anyone', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await no(env.as('alice').doc('conversations/alice_bob').delete());
  });
});

describe('/conversations/{conversationId}/messages/{messageId}', () => {
  const chat = { participantIds: ['alice', 'bob'] };
  const message = { senderId: 'alice', text: 'Run tomorrow?' };

  beforeEach(() => env.seed({ 'conversations/alice_bob': chat }));

  it('can be read by the two people in the conversation, not by anyone else', async () => {
    await env.seed({ 'conversations/alice_bob/messages/m1': message });
    await ok(env.as('alice').doc('conversations/alice_bob/messages/m1').get());
    await ok(env.as('bob').doc('conversations/alice_bob/messages/m1').get());
    await no(env.as('carol').doc('conversations/alice_bob/messages/m1').get());
    await no(env.anon().doc('conversations/alice_bob/messages/m1').get());
  });

  it('can be sent by someone in the conversation, but only as themselves', async () => {
    await ok(env.as('alice').doc('conversations/alice_bob/messages/m1').set(message));
    await ok(env.as('bob').doc('conversations/alice_bob/messages/m2').set({ senderId: 'bob', text: 'Yes' }));
    await no(env.as('bob').doc('conversations/alice_bob/messages/m3').set(message)); // says alice sent it
  });

  it('cannot be sent by someone who is not in the conversation', async () => {
    await no(env.as('carol').doc('conversations/alice_bob/messages/m1').set({ senderId: 'carol', text: 'hi' }));
    await no(env.anon().doc('conversations/alice_bob/messages/m1').set(message));
  });

  it('cannot be edited or deleted, not even by the person who sent it', async () => {
    await env.seed({ 'conversations/alice_bob/messages/m1': message });
    await no(env.as('alice').doc('conversations/alice_bob/messages/m1').update({ text: 'edited' }));
    await no(env.as('alice').doc('conversations/alice_bob/messages/m1').delete());
  });

  it('cannot be sent into a conversation that does not exist', async () => {
    await no(env.as('alice').doc('conversations/nobody/messages/m1').set(message));
  });
});

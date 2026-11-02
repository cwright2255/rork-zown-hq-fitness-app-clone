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

  it('can be deleted by its author, by the owner of the post it is on, and by an admin, and never edited', async () => {
    await env.seed({
      'communityPosts/p1': { authorId: 'alice' },
      'communityPosts/p1/comments/c1': comment,
      'communityPosts/p1/comments/c2': comment,
      'communityPosts/p1/comments/c3': comment,
      'communityPosts/p1/comments/c4': comment,
      'admins/root': { since: '2026-10-01' },
    });
    await no(env.as('carol').doc('communityPosts/p1/comments/c1').delete());
    await no(env.anon().doc('communityPosts/p1/comments/c1').delete());
    await no(env.as('bob').doc('communityPosts/p1/comments/c1').update({ text: 'edited' }));
    await no(env.as('alice').doc('communityPosts/p1/comments/c1').update({ text: 'edited' })); // the post's owner can remove it, not rewrite it
    await ok(env.as('bob').doc('communityPosts/p1/comments/c1').delete()); // the comment's author
    await ok(env.as('alice').doc('communityPosts/p1/comments/c2').delete()); // the owner of the post
    await ok(env.as('root').doc('communityPosts/p1/comments/c3').delete()); // an admin
    // Saying you are an admin is not enough; there has to be an admins/{uid} document for you.
    await no(env.as('mallory', { admin: true }).doc('communityPosts/p1/comments/c4').delete());
  });

  it('cannot be deleted by the owner of some other post', async () => {
    await env.seed({
      'communityPosts/p1': { authorId: 'alice' },
      'communityPosts/p2': { authorId: 'carol' },
      'communityPosts/p1/comments/c1': comment,
    });
    await no(env.as('carol').doc('communityPosts/p1/comments/c1').delete());
    await ok(env.as('alice').doc('communityPosts/p1/comments/c1').delete());
  });
});

// People you have blocked (store/blockStore.js).
describe('/users/{userId}/blocks/{blockedUid}', () => {
  const block = (over = {}) => ({ name: 'Bob', avatar: null, blockedAt: '2026-10-29T12:00:00.000Z', ...over });

  it('can be made, read, listed, changed and removed by the person who blocks', async () => {
    const mine = env.as('alice').doc('users/alice/blocks/bob');
    await ok(mine.set(block()));
    await ok(mine.get());
    await ok(env.as('alice').collection('users/alice/blocks').get());
    await ok(mine.set(block({ name: 'Bob W.' }))); // blocking someone again is an update
    await ok(mine.delete());
  });

  it('belongs to the person who blocks: nobody else can read, make, change or remove it, the person who was blocked included', async () => {
    await env.seed({ 'users/alice/blocks/bob': block(), 'admins/root': { since: '2026-10-01' } });
    for (const db of [env.as('bob'), env.as('carol'), env.as('root'), env.anon()]) {
      await no(db.doc('users/alice/blocks/bob').get());
      await no(db.collection('users/alice/blocks').get());
      await no(db.doc('users/alice/blocks/carol').set(block()));
      await no(db.doc('users/alice/blocks/bob').update({ name: 'Not Bob' }));
      await no(db.doc('users/alice/blocks/bob').delete());
    }
  });

  it('cannot be made in someone else\'s name, even for yourself', async () => {
    await no(env.as('bob').doc('users/alice/blocks/bob').set(block())); // bob blocking himself on alice's list
    await no(env.as('bob').doc('users/alice/blocks/carol').set(block()));
  });

  it('cannot be a block of yourself', async () => {
    await no(env.as('alice').doc('users/alice/blocks/alice').set(block({ name: 'Alice' })));
  });

  it('holds a name, a picture and when, and nothing else', async () => {
    const make = (data) => env.as('alice').doc('users/alice/blocks/bob').set(data);
    await ok(make({ blockedAt: '2026-10-29T12:00:00.000Z' })); // a person with no name or picture to show
    await ok(make(block({ avatar: 'https://example.com/b.jpg' })));
    await no(make({ name: 'Bob' })); // no date
    await no(make(block({ reason: 'rude' })));
    await no(make(block({ admin: true })));
    await no(make(block({ name: 42 })));
    await no(make(block({ name: 'x'.repeat(101) })));
    await no(make(block({ avatar: 42 })));
    await no(make(block({ avatar: 'x'.repeat(2001) })));
    await no(make(block({ blockedAt: 5 })));
    await no(make(block({ blockedAt: 'x'.repeat(41) })));
  });
});

// Reports of a post, a comment or a message (services/reportService.js). Filing one is all a phone can do with them.
describe('/reports/{reportId}', () => {
  const report = (over = {}) => ({
    reporterId: 'alice',
    kind: 'post',
    targetId: 'p1',
    targetPath: 'communityPosts/p1',
    targetAuthorId: 'bob',
    reason: 'spam',
    text: 'Buy my shake',
    createdAt: '2026-10-29T12:00:00.000Z',
    ...over,
  });
  const without = (data, key) => Object.fromEntries(Object.entries(data).filter(([name]) => name !== key));

  it('can be filed by anyone signed in, as themselves, for a post, a comment or a message', async () => {
    await ok(env.as('alice').doc('reports/alice_post_p1').set(report()));
    await ok(env.as('alice').doc('reports/alice_comment_c1').set(
      report({ kind: 'comment', targetId: 'c1', targetPath: 'communityPosts/p1/comments/c1', reason: 'harassment' }),
    ));
    await ok(env.as('alice').doc('reports/alice_message_m1').set(
      report({ kind: 'message', targetId: 'm1', targetPath: 'conversations/alice_bob/messages/m1', reason: 'hate' }),
    ));
    await ok(env.as('carol').doc('reports/carol_post_p1').set(report({ reporterId: 'carol' })));
  });

  it('can be filed without a copy of the text, for a post that is only a photo', async () => {
    await ok(env.as('alice').doc('reports/alice_post_p1').set(without(report(), 'text')));
  });

  it('cannot be filed as someone else, or by a visitor', async () => {
    await no(env.as('bob').doc('reports/alice_post_p1').set(report())); // says alice reported it
    await no(env.as('bob').doc('reports/bob_post_p1').set(report())); // bob's id, but alice\'s name in it
    await no(env.anon().doc('reports/alice_post_p1').set(report()));
  });

  it('has to be named for who reported what, so nobody can take another report\'s name', async () => {
    await no(env.as('alice').doc('reports/anything').set(report()));
    await no(env.as('alice').doc('reports/alice_post_p2').set(report())); // names p2, says p1
    await no(env.as('alice').doc('reports/alice_comment_p1').set(report())); // names a comment, says post
    await no(env.as('alice').doc('reports/bob_post_p1').set(report())); // names bob as the reporter
    await no(env.as('alice').doc('reports/alice_post_').set(report({ targetId: '' })));
  });

  it('can be filed once: the same person reporting the same thing again is refused, whatever the reason', async () => {
    await ok(env.as('alice').doc('reports/alice_post_p1').set(report()));
    await no(env.as('alice').doc('reports/alice_post_p1').set(report({ reason: 'hate' })));
    await no(env.as('alice').doc('reports/alice_post_p1').set(report(), { merge: true }));
    await ok(env.as('carol').doc('reports/carol_post_p1').set(report({ reporterId: 'carol' }))); // someone else can report it too
  });

  it('cannot be read or listed by anyone: not by who filed it, who it is about, an admin or a visitor', async () => {
    await env.seed({ 'reports/alice_post_p1': report(), 'admins/root': { since: '2026-10-01' } });
    for (const db of [env.as('alice'), env.as('bob'), env.as('root'), env.anon()]) {
      await no(db.doc('reports/alice_post_p1').get());
      await no(db.collection('reports').get());
      await no(db.collection('reports').where('reporterId', '==', 'alice').get());
    }
  });

  it('cannot be changed or removed by anyone, who filed it and an admin included', async () => {
    await env.seed({ 'reports/alice_post_p1': report(), 'admins/root': { since: '2026-10-01' } });
    for (const db of [env.as('alice'), env.as('bob'), env.as('root'), env.anon()]) {
      await no(db.doc('reports/alice_post_p1').update({ reason: 'other' }));
      await no(db.doc('reports/alice_post_p1').delete());
    }
  });

  it('takes only the kinds of thing and the reasons the app offers', async () => {
    const file = (over) => env.as('alice').doc(`reports/alice_${over.kind || 'post'}_p1`).set(report(over));
    for (const reason of ['spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'other']) {
      await ok(env.as('alice').doc(`reports/alice_post_${reason}`).set(report({ reason, targetId: reason })));
    }
    await no(file({ reason: 'rude' }));
    await no(file({ reason: '' }));
    await no(file({ kind: 'user' }));
    await no(file({ kind: 'conversation' }));
  });

  it('holds only the fields the app sends, all of them the right kind and not too long', async () => {
    const file = (data) => env.as('alice').doc('reports/alice_post_p1').set(data);
    await no(file(report({ status: 'open' })));
    await no(file(report({ admin: true })));
    for (const key of ['reporterId', 'kind', 'targetId', 'targetPath', 'targetAuthorId', 'reason', 'createdAt']) {
      await no(file(without(report(), key)));
    }
    await no(file(report({ targetPath: 42 })));
    await no(file(report({ targetPath: 'x'.repeat(301) })));
    await no(file(report({ targetAuthorId: 42 })));
    await no(file(report({ targetAuthorId: 'x'.repeat(129) })));
    await no(file(report({ text: 42 })));
    await no(file(report({ text: 'x'.repeat(1001) })));
    await no(file(report({ createdAt: 5 })));
    await no(file(report({ createdAt: 'x'.repeat(41) })));
    await ok(file(report({ text: 'x'.repeat(1000) })));
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

  // store/messagingStore.js sendMessage: the first message to someone new is one merging write that carries both ids, then the
  // message. It used to read the conversation first, and a conversation that does not exist cannot be read (the rule looks inside
  // it), so that first message was refused. These pin both halves: what is refused, and what the app does instead.
  describe('the first message to someone new', () => {
    const first = {
      participantIds: ['alice', 'bob'],
      participantInfo: { alice: { name: 'Alice' } },
      lastMessage: { text: 'Run tomorrow?', senderId: 'alice' },
      updatedAt: '2026-10-29T12:00:00.000Z',
    };

    it('cannot be read before it exists, by anyone, which is why the app does not read it first', async () => {
      await no(env.as('alice').doc('conversations/alice_bob').get());
      await no(env.as('bob').doc('conversations/alice_bob').get());
      await no(env.as('carol').doc('conversations/alice_bob').get());
    });

    it('cannot have its messages listed before it exists, so a thread opened first has to listen again after the first message', async () => {
      await no(env.as('alice').collection('conversations/alice_bob/messages').get());
      await no(env.as('bob').collection('conversations/alice_bob/messages').get());
    });

    it('is sent the way the app sends it: one merging write with both ids, then the message, which both can then read', async () => {
      await ok(env.as('alice').doc('conversations/alice_bob').set(first, { merge: true }));
      await ok(env.as('alice').doc('conversations/alice_bob/messages/m1').set({ senderId: 'alice', text: 'Run tomorrow?' }));
      await ok(env.as('alice').collection('conversations/alice_bob/messages').get());
      await ok(env.as('bob').collection('conversations/alice_bob/messages').get());
      await ok(env.as('bob').doc('conversations/alice_bob').get());
    });

    it('cannot be sent by someone who is not one of the two, nor under the id of another pair, nor without the ids', async () => {
      await no(env.as('carol').doc('conversations/alice_bob').set(first, { merge: true }));
      await no(env.anon().doc('conversations/alice_bob').set(first, { merge: true }));
      await no(env.as('alice').doc('conversations/alice_bob').set({ ...first, participantIds: ['alice', 'carol'] }, { merge: true }));
      await no(env.as('alice').doc('conversations/alice_bob').set({ lastMessage: first.lastMessage }, { merge: true }));
    });

    it('goes through again for every later message, from either of them, because the same two ids are sent each time', async () => {
      await env.seed({ 'conversations/alice_bob': chat });
      await ok(env.as('alice').doc('conversations/alice_bob').set(first, { merge: true }));
      await ok(env.as('bob').doc('conversations/alice_bob').set({ ...first, participantInfo: { bob: { name: 'Bob' } } }, { merge: true }));
    });

    it('still cannot change who is in the conversation, nor be added to by someone outside it', async () => {
      await env.seed({ 'conversations/alice_bob': chat });
      await no(env.as('alice').doc('conversations/alice_bob').set({ ...first, participantIds: ['alice', 'carol'] }, { merge: true }));
      await no(env.as('carol').doc('conversations/alice_bob').set(first, { merge: true }));
    });
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

// Blocking (users/{uid}/blocks): once either of two people has blocked the other, they cannot start a conversation or send each other a
// message. What was already said stays readable; the app hides it.
describe('two people when one has blocked the other', () => {
  const chat = { participantIds: ['alice', 'bob'], lastMessage: 'hi' };
  const first = {
    participantIds: ['alice', 'bob'],
    participantInfo: { alice: { name: 'Alice' } },
    lastMessage: { text: 'Run tomorrow?', senderId: 'alice' },
    updatedAt: '2026-10-29T12:00:00.000Z',
  };
  const block = { name: 'x', blockedAt: '2026-10-29T12:00:00.000Z' };
  const message = (sender) => ({ senderId: sender, text: 'Run tomorrow?' });

  // The same checks whichever of the two did the blocking.
  describe.each([
    ['alice', 'bob'],
    ['bob', 'alice'],
  ])('%s has blocked %s', (blocker) => {
    const blockDoc = `users/${blocker}/blocks/${blocker === 'alice' ? 'bob' : 'alice'}`;

    it('stops either of them starting a conversation, in either way of writing it', async () => {
      await env.seed({ [blockDoc]: block });
      await no(env.as('alice').doc('conversations/alice_bob').set(chat));
      await no(env.as('bob').doc('conversations/alice_bob').set(chat));
      await no(env.as('alice').doc('conversations/alice_bob').set(first, { merge: true }));
      await no(env.as('bob').doc('conversations/alice_bob').set(first, { merge: true }));
    });

    it('stops either of them writing to a conversation they already had', async () => {
      await env.seed({ [blockDoc]: block, 'conversations/alice_bob': chat });
      await no(env.as('alice').doc('conversations/alice_bob').update({ lastMessage: 'hello' }));
      await no(env.as('bob').doc('conversations/alice_bob').update({ lastMessage: 'hello' }));
      await no(env.as('alice').doc('conversations/alice_bob').set(first, { merge: true }));
      await no(env.as('bob').doc('conversations/alice_bob').set(first, { merge: true }));
    });

    it('stops either of them sending a message in it', async () => {
      await env.seed({ [blockDoc]: block, 'conversations/alice_bob': chat });
      await no(env.as('alice').doc('conversations/alice_bob/messages/m1').set(message('alice')));
      await no(env.as('bob').doc('conversations/alice_bob/messages/m2').set(message('bob')));
    });

    it('leaves what was already said readable by both of them', async () => {
      await env.seed({ [blockDoc]: block, 'conversations/alice_bob': chat, 'conversations/alice_bob/messages/m1': message('alice') });
      await ok(env.as('alice').doc('conversations/alice_bob').get());
      await ok(env.as('bob').doc('conversations/alice_bob').get());
      await ok(env.as('alice').collection('conversations/alice_bob/messages').get());
      await ok(env.as('bob').doc('conversations/alice_bob/messages/m1').get());
    });

    it('lets them talk again once the block is removed', async () => {
      await env.seed({ [blockDoc]: block, 'conversations/alice_bob': chat });
      await no(env.as('alice').doc('conversations/alice_bob/messages/m1').set(message('alice')));
      await ok(env.as(blocker).doc(blockDoc).delete());
      await ok(env.as('alice').doc('conversations/alice_bob').set(first, { merge: true }));
      await ok(env.as('alice').doc('conversations/alice_bob/messages/m1').set(message('alice')));
      await ok(env.as('bob').doc('conversations/alice_bob/messages/m2').set(message('bob')));
    });

    it('still lets each of them talk to other people', async () => {
      await env.seed({ [blockDoc]: block });
      await ok(env.as('alice').doc('conversations/alice_carol').set({ ...chat, participantIds: ['alice', 'carol'] }));
      await ok(env.as('bob').doc('conversations/bob_carol').set({ ...chat, participantIds: ['bob', 'carol'] }));
      await ok(env.as('carol').doc('conversations/alice_carol/messages/m1').set(message('carol')));
    });
  });

  it('is not stopped by someone else\'s block', async () => {
    await env.seed({ 'users/carol/blocks/bob': block, 'users/dave/blocks/alice': block });
    await ok(env.as('alice').doc('conversations/alice_bob').set(first, { merge: true }));
    await ok(env.as('alice').doc('conversations/alice_bob/messages/m1').set(message('alice')));
    await ok(env.as('bob').doc('conversations/alice_bob/messages/m2').set(message('bob')));
  });

  it('is still refused for someone who is not in the conversation, blocked or not', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await no(env.as('carol').doc('conversations/alice_bob/messages/m1').set(message('carol')));
  });
});

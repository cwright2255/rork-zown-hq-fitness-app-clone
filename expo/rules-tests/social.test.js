// The parts of the app people share: the leaderboard, the community feed with its likes and comments, and private
// conversations between two people.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

describe('/leaderboard/{uid}', () => {
  it('can be read by anyone signed in, whoever it is about', async () => {
    await env.seed({ 'leaderboard/alice': { points: 120 } });
    await ok(env.as('bob').doc('leaderboard/alice').get());
    await ok(env.as('bob').collection('leaderboard').get());
  });

  it('can only be written by the person it is about', async () => {
    const mine = env.as('alice').doc('leaderboard/alice');
    await ok(mine.set({ points: 10 }));
    await ok(mine.update({ points: 20 }));
    await ok(mine.delete());
    await no(env.as('alice').doc('leaderboard/bob').set({ points: 10 }));
  });

  it('cannot be changed by someone else, even to a lower score', async () => {
    await env.seed({ 'leaderboard/alice': { points: 120 } });
    await no(env.as('bob').doc('leaderboard/alice').update({ points: 0 }));
    await no(env.as('bob').doc('leaderboard/alice').delete());
  });

  it('is closed to a visitor who is not signed in', async () => {
    await env.seed({ 'leaderboard/alice': { points: 120 } });
    await no(env.anon().doc('leaderboard/alice').get());
    await no(env.anon().doc('leaderboard/alice').set({ points: 1 }));
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
    await no(env.as('carol').doc('conversations/alice_bob').set(chat));
    await no(env.anon().doc('conversations/alice_bob').set(chat));
  });

  it('can be updated by the two people in it, not by anyone else', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await ok(env.as('bob').doc('conversations/alice_bob').update({ lastMessage: 'hello' }));
    await no(env.as('carol').doc('conversations/alice_bob').update({ lastMessage: 'hello' }));
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

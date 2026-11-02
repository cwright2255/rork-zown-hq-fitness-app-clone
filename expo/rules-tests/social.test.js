// The parts of the app people share: the leaderboard, the community feed with its likes and comments, and private
// conversations between two people.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

// Posts, comments and conversations carry the name and picture on the author's profile (users/{uid}: name, profileImage; the app
// brings that up to date just before it writes one, services/publicProfile.js). carol has a name and no picture; dave has no
// profile document at all.
const ALICE_PIC = 'https://img.example/alice.jpg';
const BOB_PIC = 'https://img.example/bob.jpg';
const profiles = {
  'users/alice': { name: 'Alice', profileImage: ALICE_PIC },
  'users/bob': { name: 'Bob', profileImage: BOB_PIC },
  'users/carol': { name: 'Carol' },
};
const text = (n) => 'x'.repeat(n);
const picture = (n) => 'https://i.example/' + text(n - 'https://i.example/'.length); // a picture address exactly n characters long

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
  const post = {
    authorId: 'alice', authorName: 'Alice', authorAvatar: ALICE_PIC, text: 'First run done', likeCount: 0, commentCount: 0, shareCount: 0,
  };

  beforeEach(() => env.seed(profiles));

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

  it('is created the way the app creates it: the settings off, the media and the time as well', async () => {
    await ok(env.as('alice').doc('communityPosts/p1').set({
      ...post, imageUrl: null, media: [], type: 'general', likesHidden: false, shareCountHidden: false, commentsDisabled: false,
      createdAt: new Date(),
    }));
    await ok(env.as('alice').doc('communityPosts/p2').set({ ...post, text: '', run: { distanceKm: 5 } })); // a shared run needs no text
  });

  describe('the name and picture on it', () => {
    it('have to be the ones on the author\'s profile', async () => {
      await ok(env.as('bob').doc('communityPosts/p1').set({ ...post, authorId: 'bob', authorName: 'Bob', authorAvatar: BOB_PIC }));
      await no(env.as('bob').doc('communityPosts/p2').set({ ...post, authorId: 'bob', authorName: 'Alice', authorAvatar: BOB_PIC })); // someone else's name
      await no(env.as('bob').doc('communityPosts/p3').set({ ...post, authorId: 'bob', authorName: 'Bob', authorAvatar: ALICE_PIC })); // someone else's picture
      await no(env.as('bob').doc('communityPosts/p4').set({ ...post, authorId: 'bob', authorName: 'Robert', authorAvatar: BOB_PIC })); // a name made up for the post
      await no(env.as('bob').doc('communityPosts/p5').set({ ...post, authorId: 'bob', authorName: 'Bob', authorAvatar: null })); // a picture left off
    });

    it('cannot be left off', async () => {
      const noName = { ...post };
      delete noName.authorName;
      await no(env.as('alice').doc('communityPosts/p1').set(noName));
      await no(env.as('alice').doc('communityPosts/p2').set({ ...post, authorName: 7 }));
    });

    it('are Zown User and no picture for someone whose profile has neither', async () => {
      await ok(env.as('carol').doc('communityPosts/p1').set({ ...post, authorId: 'carol', authorName: 'Carol', authorAvatar: null }));
      await no(env.as('carol').doc('communityPosts/p2').set({ ...post, authorId: 'carol', authorName: 'Carol', authorAvatar: ALICE_PIC }));
      // dave has no profile document at all
      await ok(env.as('dave').doc('communityPosts/p3').set({ ...post, authorId: 'dave', authorName: 'Zown User', authorAvatar: null }));
      await no(env.as('dave').doc('communityPosts/p4').set({ ...post, authorId: 'dave', authorName: 'Dave', authorAvatar: null }));
    });

    it('follow the profile when it changes', async () => {
      await env.seed({ 'users/alice': { name: 'Alice Smith', profileImage: BOB_PIC } });
      await no(env.as('alice').doc('communityPosts/p1').set(post));
      await ok(env.as('alice').doc('communityPosts/p2').set({ ...post, authorName: 'Alice Smith', authorAvatar: BOB_PIC }));
    });

    it('are held to 100 characters for the name and 2000 for the picture address', async () => {
      await env.seed({ 'users/alice': { name: text(100), profileImage: picture(2000) } });
      await ok(env.as('alice').doc('communityPosts/p1').set({ ...post, authorName: text(100), authorAvatar: picture(2000) }));
      await env.seed({ 'users/alice': { name: text(101), profileImage: ALICE_PIC } });
      await no(env.as('alice').doc('communityPosts/p2').set({ ...post, authorName: text(101) }));
      await env.seed({ 'users/alice': { name: 'Alice', profileImage: picture(2001) } });
      await no(env.as('alice').doc('communityPosts/p3').set({ ...post, authorAvatar: picture(2001) }));
    });
  });

  describe('its text', () => {
    it('can be 2000 characters, not 2001, and can be empty (a photo or a shared run needs none)', async () => {
      await ok(env.as('alice').doc('communityPosts/p1').set({ ...post, text: text(2000) }));
      await no(env.as('alice').doc('communityPosts/p2').set({ ...post, text: text(2001) }));
      await ok(env.as('alice').doc('communityPosts/p3').set({ ...post, text: '' }));
    });

    it('has to be text', async () => {
      await no(env.as('alice').doc('communityPosts/p1').set({ ...post, text: 12 }));
      await no(env.as('alice').doc('communityPosts/p2').set({ ...post, text: ['a'] }));
    });
  });

  describe('its like, comment and share counts', () => {
    it('start at zero', async () => {
      await no(env.as('alice').doc('communityPosts/p1').set({ ...post, likeCount: 1 }));
      await no(env.as('alice').doc('communityPosts/p2').set({ ...post, commentCount: 1 }));
      await no(env.as('alice').doc('communityPosts/p3').set({ ...post, shareCount: 1 }));
      await no(env.as('alice').doc('communityPosts/p4').set({ ...post, likeCount: 1000000 }));
      await no(env.as('alice').doc('communityPosts/p5').set({ ...post, likeCount: -1 }));
    });

    it('have to be there', async () => {
      const noLikes = { ...post };
      delete noLikes.likeCount;
      await no(env.as('alice').doc('communityPosts/p1').set(noLikes));
    });

    it('cannot be changed from the app by anyone, the author and a person who liked the post included', async () => {
      await env.seed({ 'communityPosts/p1': { ...post, likeCount: 2, commentCount: 2, shareCount: 2 } });
      for (const who of ['alice', 'bob']) {
        const asWho = env.as(who).doc('communityPosts/p1');
        await no(asWho.update({ likeCount: 3 }));
        await no(asWho.update({ likeCount: 1 }));
        await no(asWho.update({ commentCount: 3 }));
        await no(asWho.update({ shareCount: 3 }));
        await no(asWho.update({ likeCount: 3, commentCount: 3, shareCount: 3 }));
        await no(asWho.update({ likeCount: 0 }));
      }
    });

    it('cannot be changed along with something the author may change', async () => {
      await env.seed({ 'communityPosts/p1': post });
      await no(env.as('alice').doc('communityPosts/p1').update({ text: 'Edited', likeCount: 3 }));
      await no(env.as('alice').doc('communityPosts/p1').update({ commentsDisabled: true, shareCount: 3 }));
    });
  });

  describe('editing it', () => {
    beforeEach(() => env.seed({ 'communityPosts/p1': { ...post, likesHidden: false, shareCountHidden: false, commentsDisabled: false } }));

    it('is for its author: the text and when it was edited', async () => {
      await ok(env.as('alice').doc('communityPosts/p1').update({ text: 'Edited', editedAt: new Date() }));
    });

    it('is for its author: the three settings (hide likes, hide shares, turn comments off)', async () => {
      const asAlice = env.as('alice').doc('communityPosts/p1');
      await ok(asAlice.update({ likesHidden: true }));
      await ok(asAlice.update({ shareCountHidden: true }));
      await ok(asAlice.update({ commentsDisabled: true }));
      await ok(asAlice.update({ commentsDisabled: false, likesHidden: false }));
    });

    it('cannot change who wrote it, or the name or picture on it, or when it was posted', async () => {
      const asAlice = env.as('alice').doc('communityPosts/p1');
      await no(asAlice.update({ authorId: 'bob' }));
      await no(asAlice.update({ authorName: 'Someone Else' }));
      await no(asAlice.update({ authorAvatar: BOB_PIC }));
      await no(asAlice.update({ createdAt: new Date() }));
      await no(asAlice.update({ text: 'Edited', authorName: 'Someone Else' }));
    });

    it('keeps the text to 2000 characters', async () => {
      const asAlice = env.as('alice').doc('communityPosts/p1');
      await ok(asAlice.update({ text: text(2000) }));
      await no(asAlice.update({ text: text(2001) }));
      await no(asAlice.update({ text: 5 }));
    });

    it('lets the author change a setting on an older post whose text is longer than the limit now is', async () => {
      await env.seed({ 'communityPosts/old': { ...post, text: text(5000) } });
      await ok(env.as('alice').doc('communityPosts/old').update({ commentsDisabled: true }));
      await no(env.as('alice').doc('communityPosts/old').update({ text: text(4999) })); // but a new text has to fit
    });

    it('is not for anyone else: not the text, not the settings, not the counts', async () => {
      const asBob = env.as('bob').doc('communityPosts/p1');
      await no(asBob.update({ text: 'Bob rewrote this' }));
      await no(asBob.update({ authorId: 'bob' }));
      await no(asBob.update({ likeCount: 1, text: 'and rewrote this' }));
      await no(asBob.update({ commentsDisabled: true }));
      await no(asBob.update({ likesHidden: true }));
      await no(asBob.update({ likeCount: 1 }));
    });

    it('is not for an admin either', async () => {
      await env.seed({ 'admins/root': { since: '2026-10-01' } });
      await no(env.as('root').doc('communityPosts/p1').update({ text: 'Removed' }));
    });

    it('is not for a visitor', async () => {
      await no(env.anon().doc('communityPosts/p1').update({ likeCount: 1 }));
      await no(env.anon().doc('communityPosts/p1').update({ text: 'x' }));
    });
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

// The mark that a person shared a post (store/communityStore.js recordShare). The share count on the post is the number of these.
describe('/communityPosts/{postId}/shares/{uid}', () => {
  beforeEach(() => env.seed({ 'communityPosts/p1': { authorId: 'alice', likeCount: 0 } }));

  it('can be made by the person it is for, once', async () => {
    await ok(env.as('bob').doc('communityPosts/p1/shares/bob').set({ sharedAt: new Date() }));
    await no(env.as('bob').doc('communityPosts/p1/shares/bob').set({ sharedAt: new Date() })); // a second share is a rewrite, which is refused
  });

  it('cannot be made for someone else, or by a visitor', async () => {
    await no(env.as('bob').doc('communityPosts/p1/shares/carol').set({ sharedAt: new Date() }));
    await no(env.anon().doc('communityPosts/p1/shares/bob').set({ sharedAt: new Date() }));
  });

  it('holds when it happened and nothing else', async () => {
    await ok(env.as('bob').doc('communityPosts/p1/shares/bob').set({ sharedAt: 1 }));
    await no(env.as('carol').doc('communityPosts/p1/shares/carol').set({ sharedAt: 1, note: 'x' }));
    await no(env.as('carol').doc('communityPosts/p1/shares/carol').set({ count: 50 }));
  });

  it('cannot be changed or taken back, by the person who made it or by anyone else', async () => {
    await env.seed({ 'communityPosts/p1/shares/bob': { sharedAt: 1 } });
    await no(env.as('bob').doc('communityPosts/p1/shares/bob').update({ sharedAt: 2 }));
    await no(env.as('bob').doc('communityPosts/p1/shares/bob').delete());
    await no(env.as('alice').doc('communityPosts/p1/shares/bob').delete());
  });

  it('can be read by the person it is for, not by anyone else', async () => {
    await env.seed({ 'communityPosts/p1/shares/bob': { sharedAt: 1 } });
    await ok(env.as('bob').doc('communityPosts/p1/shares/bob').get());
    await no(env.as('alice').doc('communityPosts/p1/shares/bob').get());
    await no(env.anon().doc('communityPosts/p1/shares/bob').get());
  });
});

describe('/communityPosts/{postId}/comments/{commentId}', () => {
  const comment = { authorId: 'bob', authorName: 'Bob', text: 'Nice one' };

  beforeEach(() => env.seed(profiles));

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

  it('is added the way the app adds it, with the time', async () => {
    await env.seed({ 'communityPosts/p1': { authorId: 'alice' } });
    await ok(env.as('bob').doc('communityPosts/p1/comments/c1').set({ ...comment, createdAt: new Date() }));
  });

  describe('the name on it', () => {
    beforeEach(() => env.seed({ 'communityPosts/p1': { authorId: 'alice' } }));

    it('has to be the one on the author\'s profile', async () => {
      await ok(env.as('bob').doc('communityPosts/p1/comments/c1').set(comment));
      await no(env.as('bob').doc('communityPosts/p1/comments/c2').set({ ...comment, authorName: 'Alice' })); // someone else's name
      await no(env.as('bob').doc('communityPosts/p1/comments/c3').set({ ...comment, authorName: 'Robert' })); // a name made up for the comment
    });

    it('cannot be left off, or be something other than text', async () => {
      await no(env.as('bob').doc('communityPosts/p1/comments/c1').set({ authorId: 'bob', text: 'Nice one' }));
      await no(env.as('bob').doc('communityPosts/p1/comments/c2').set({ ...comment, authorName: 5 }));
    });

    it('is Zown User for someone whose profile has no name', async () => {
      await ok(env.as('dave').doc('communityPosts/p1/comments/c1').set({ authorId: 'dave', authorName: 'Zown User', text: 'Hi' }));
      await no(env.as('dave').doc('communityPosts/p1/comments/c2').set({ authorId: 'dave', authorName: 'Dave', text: 'Hi' }));
    });

    it('is held to 100 characters', async () => {
      await env.seed({ 'users/bob': { name: text(100) } });
      await ok(env.as('bob').doc('communityPosts/p1/comments/c1').set({ ...comment, authorName: text(100) }));
      await env.seed({ 'users/bob': { name: text(101) } });
      await no(env.as('bob').doc('communityPosts/p1/comments/c2').set({ ...comment, authorName: text(101) }));
    });
  });

  describe('its text', () => {
    beforeEach(() => env.seed({ 'communityPosts/p1': { authorId: 'alice' } }));

    it('can be 1000 characters, not 1001', async () => {
      await ok(env.as('bob').doc('communityPosts/p1/comments/c1').set({ ...comment, text: text(1000) }));
      await no(env.as('bob').doc('communityPosts/p1/comments/c2').set({ ...comment, text: text(1001) }));
    });

    it('has to be text', async () => {
      await no(env.as('bob').doc('communityPosts/p1/comments/c1').set({ ...comment, text: 5 }));
      await no(env.as('bob').doc('communityPosts/p1/comments/c2').set({ authorId: 'bob', authorName: 'Bob' }));
    });
  });

  it('holds the author, the name, the text and the time, and nothing else', async () => {
    await env.seed({ 'communityPosts/p1': { authorId: 'alice' } });
    await no(env.as('bob').doc('communityPosts/p1/comments/c1').set({ ...comment, likeCount: 99 }));
    await no(env.as('bob').doc('communityPosts/p1/comments/c2').set({ ...comment, pinned: true }));
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
  const chat = { participantIds: ['alice', 'bob'], lastMessage: { text: 'hi', senderId: 'alice' } };
  const aliceInfo = { name: 'Alice', avatar: ALICE_PIC };
  const bobInfo = { name: 'Bob', avatar: BOB_PIC };

  beforeEach(() => env.seed(profiles));

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
    await ok(env.as('bob').doc('conversations/alice_bob').update({ lastMessage: { text: 'hello', senderId: 'bob' } }));
    await no(env.as('carol').doc('conversations/alice_bob').update({ lastMessage: { text: 'hello', senderId: 'carol' } }));
  });

  it('can be updated by merging, as the app does for each new message', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await ok(env.as('alice').doc('conversations/alice_bob').set({ lastMessage: { text: 'hello', senderId: 'alice' }, updatedAt: '2026-10-19T12:00:00.000Z' }, { merge: true }));
  });

  // store/messagingStore.js sendMessage: the first message to someone new is one merging write that carries both ids, then the
  // message. It used to read the conversation first, and a conversation that does not exist cannot be read (the rule looks inside
  // it), so that first message was refused. These pin both halves: what is refused, and what the app does instead.
  describe('the first message to someone new', () => {
    const first = {
      participantIds: ['alice', 'bob'],
      participantInfo: { alice: aliceInfo },
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
      await ok(env.as('bob').doc('conversations/alice_bob').set({ ...first, participantInfo: { bob: bobInfo } }, { merge: true }));
    });

    it('still cannot change who is in the conversation, nor be added to by someone outside it', async () => {
      await env.seed({ 'conversations/alice_bob': chat });
      await no(env.as('alice').doc('conversations/alice_bob').set({ ...first, participantIds: ['alice', 'carol'] }, { merge: true }));
      await no(env.as('carol').doc('conversations/alice_bob').set(first, { merge: true }));
    });
  });

  // The name and picture a person writes for themselves in participantInfo are shown to the other person in their list of
  // conversations, so they have to be the ones on the profile (publicName and publicImage in the rules). The entry for the other
  // person is not checked: it is only ever shown back to the person who wrote it.
  describe('the name and picture a person puts for themselves', () => {
    const start = (participantInfo) => ({
      participantIds: ['alice', 'bob'], participantInfo, lastMessage: { text: 'Run tomorrow?', senderId: 'alice' }, updatedAt: '2026-10-29T12:00:00.000Z',
    });
    const asAlice = () => env.as('alice').doc('conversations/alice_bob');

    it('have to be the ones on their profile, when a conversation is started', async () => {
      await no(asAlice().set(start({ alice: { name: 'Robert', avatar: ALICE_PIC } }), { merge: true })); // a name made up for the occasion
      await no(asAlice().set(start({ alice: { name: 'Bob', avatar: ALICE_PIC } }), { merge: true })); // someone else's name
      await no(asAlice().set(start({ alice: { name: 'Alice', avatar: BOB_PIC } }), { merge: true })); // someone else's picture
      await no(asAlice().set(start({ alice: { name: 'Alice' } }), { merge: true })); // a picture left off, when the profile has one
      await no(asAlice().set(start({ alice: { name: 'Alice', avatar: null } }), { merge: true }));
      await ok(asAlice().set(start({ alice: aliceInfo }), { merge: true }));
    });

    it('have to be the ones on their profile, for each later message', async () => {
      await env.seed({ 'conversations/alice_bob': { ...chat, participantInfo: { alice: aliceInfo } } });
      await no(env.as('alice').doc('conversations/alice_bob').update({ participantInfo: { alice: { name: 'Robert', avatar: ALICE_PIC } } }));
      await no(env.as('alice').doc('conversations/alice_bob').set(start({ alice: { name: 'Alice', avatar: BOB_PIC } }), { merge: true }));
      await ok(env.as('alice').doc('conversations/alice_bob').set(start({ alice: aliceInfo }), { merge: true }));
    });

    it('follow the profile when it changes: the old ones are refused, the new ones are not', async () => {
      await env.seed({ 'users/alice': { name: 'Alice Smith', profileImage: BOB_PIC } });
      await no(asAlice().set(start({ alice: aliceInfo }), { merge: true }));
      await ok(asAlice().set(start({ alice: { name: 'Alice Smith', avatar: BOB_PIC } }), { merge: true }));
    });

    it('are Zown User and no picture for someone whose profile has neither', async () => {
      const carolDave = (info) => ({ participantIds: ['carol', 'dave'], participantInfo: info, lastMessage: { text: 'hi', senderId: 'carol' } });
      await no(env.as('carol').doc('conversations/carol_dave').set(carolDave({ carol: { name: 'Carol', avatar: ALICE_PIC } }), { merge: true }));
      await ok(env.as('carol').doc('conversations/carol_dave').set(carolDave({ carol: { name: 'Carol', avatar: null } }), { merge: true }));
      await ok(env.as('carol').doc('conversations/carol_dave').set(carolDave({ carol: { name: 'Carol' } }), { merge: true })); // no picture to leave off
      // dave has no profile document at all
      await no(env.as('dave').doc('conversations/carol_dave').set(carolDave({ dave: { name: 'Dave' } }), { merge: true }));
      await ok(env.as('dave').doc('conversations/carol_dave').set(carolDave({ dave: { name: 'Zown User', avatar: null } }), { merge: true }));
    });

    it('are not checked for the other person, whose entry is only shown back to the person who wrote it', async () => {
      await ok(asAlice().set(start({ alice: aliceInfo, bob: { name: 'Whatever Alice calls him', avatar: 'https://img.example/x.jpg' } }), { merge: true }));
      await ok(env.as('bob').doc('conversations/alice_bob').set(start({ bob: bobInfo }), { merge: true })); // and bob's write leaves alice's entry alone
    });

    it('are not looked at when a write does not touch participantInfo, whatever the stored one says', async () => {
      await env.seed({ 'conversations/alice_bob': { ...chat, participantInfo: { alice: { name: 'Old Alice', avatar: ALICE_PIC }, bob: bobInfo } } });
      await ok(env.as('alice').doc('conversations/alice_bob').update({ updatedAt: '2026-10-30T12:00:00.000Z' }));
      await ok(env.as('bob').doc('conversations/alice_bob').update({ lastMessage: { text: 'hello', senderId: 'bob' } }));
      await no(env.as('alice').doc('conversations/alice_bob').update({ participantInfo: { alice: { name: 'Old Alice', avatar: ALICE_PIC } } }));
    });

    it('are optional: a conversation can be started without participantInfo', async () => {
      await ok(asAlice().set(chat));
    });
  });

  describe('the last message kept on it', () => {
    const start = (lastMessage) => ({ participantIds: ['alice', 'bob'], lastMessage });

    it('can be 2000 characters, not 2001, when a conversation is started', async () => {
      await no(env.as('alice').doc('conversations/alice_bob').set(start({ text: text(2001), senderId: 'alice' })));
      await ok(env.as('alice').doc('conversations/alice_bob').set(start({ text: text(2000), senderId: 'alice' })));
    });

    it('can be 2000 characters, not 2001, when a conversation is updated', async () => {
      await env.seed({ 'conversations/alice_bob': chat });
      await no(env.as('alice').doc('conversations/alice_bob').update({ lastMessage: { text: text(2001), senderId: 'alice' } }));
      await no(env.as('alice').doc('conversations/alice_bob').set(start({ text: text(2001), senderId: 'alice' }), { merge: true }));
      await ok(env.as('alice').doc('conversations/alice_bob').update({ lastMessage: { text: text(2000), senderId: 'alice' } }));
    });

    it('has to be a map holding text', async () => {
      await no(env.as('alice').doc('conversations/alice_bob').set(start('hi')));
      await no(env.as('alice').doc('conversations/alice_bob').set(start({ text: 7, senderId: 'alice' })));
    });

    it('is not looked at when a write does not touch it, so a long one from before the limit does not block the conversation', async () => {
      await env.seed({ 'conversations/alice_bob': { ...chat, lastMessage: { text: text(5000), senderId: 'alice' } } });
      await ok(env.as('bob').doc('conversations/alice_bob').update({ updatedAt: '2026-10-30T12:00:00.000Z' }));
    });
  });

  it('cannot have its list of people changed, by either of them', async () => {
    await env.seed({ 'conversations/alice_bob': chat });
    await no(env.as('alice').doc('conversations/alice_bob').update({ participantIds: ['alice', 'bob', 'carol'] }));
    await no(env.as('alice').doc('conversations/alice_bob').update({ participantIds: ['alice', 'carol'] }));
    await no(env.as('bob').doc('conversations/alice_bob').update({ participantIds: ['bob'] }));
    await no(env.as('bob').doc('conversations/alice_bob').update({ participantIds: ['bob', 'alice'] })); // same people, different order
    await no(env.as('alice').doc('conversations/alice_bob').set({ lastMessage: { text: 'hi', senderId: 'alice' } })); // a full replace drops the list
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

  it('is sent the way the app sends it, with the time', async () => {
    await ok(env.as('alice').doc('conversations/alice_bob/messages/m1').set({ ...message, createdAt: new Date() }));
  });

  it('can be 2000 characters, not 2001', async () => {
    await ok(env.as('alice').doc('conversations/alice_bob/messages/m1').set({ ...message, text: text(2000) }));
    await no(env.as('alice').doc('conversations/alice_bob/messages/m2').set({ ...message, text: text(2001) }));
  });

  it('has to be text', async () => {
    await no(env.as('alice').doc('conversations/alice_bob/messages/m1').set({ ...message, text: 5 }));
    await no(env.as('alice').doc('conversations/alice_bob/messages/m2').set({ senderId: 'alice' }));
  });

  it('holds who sent it, what it says and when, and nothing else', async () => {
    await no(env.as('alice').doc('conversations/alice_bob/messages/m1').set({ ...message, read: true }));
    await no(env.as('alice').doc('conversations/alice_bob/messages/m2').set({ ...message, senderName: 'Bob' }));
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
  const chat = { participantIds: ['alice', 'bob'], lastMessage: { text: 'hi', senderId: 'alice' } };
  const first = {
    participantIds: ['alice', 'bob'],
    participantInfo: { alice: { name: 'Alice', avatar: ALICE_PIC } },
    lastMessage: { text: 'Run tomorrow?', senderId: 'alice' },
    updatedAt: '2026-10-29T12:00:00.000Z',
  };
  const block = { name: 'x', blockedAt: '2026-10-29T12:00:00.000Z' };
  const message = (sender) => ({ senderId: sender, text: 'Run tomorrow?' });

  beforeEach(() => env.seed(profiles));

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
      await no(env.as('alice').doc('conversations/alice_bob').update({ lastMessage: { text: 'hello', senderId: 'alice' } }));
      await no(env.as('bob').doc('conversations/alice_bob').update({ lastMessage: { text: 'hello', senderId: 'bob' } }));
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

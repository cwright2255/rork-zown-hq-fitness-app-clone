import { changePostCount, COUNT_FIELDS } from '../functions/src/postCounters';

// A small in-memory stand-in for the Firestore pieces changePostCount uses: db.doc(path) and db.runTransaction, whose transaction
// has get(ref), update(ref, data) and set(ref, data). Writes are applied when the transaction function returns, and a transaction
// that reads after writing (which Firestore refuses) throws, so the real order is enforced here too. Transactions run one after the
// other, as Firestore's do when they touch the same document (the later one reads again once the earlier one has committed).
function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let transactions = 0;
  let queue = Promise.resolve();

  const runOne = async (fn) => {
    transactions += 1;
    const writes = [];
    let wrote = false;
    const tx = {
      get: async (ref) => {
        if (wrote) throw new Error('reads must come before writes in a transaction');
        return { exists: docs.has(ref.path), data: () => docs.get(ref.path) };
      },
      update: (ref, data) => {
        wrote = true;
        if (!docs.has(ref.path)) throw new Error('NOT_FOUND: ' + ref.path);
        writes.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...data }));
      },
      set: (ref, data) => {
        wrote = true;
        writes.push(() => docs.set(ref.path, data));
      },
    };
    const result = await fn(tx);
    writes.forEach((w) => w());
    return result;
  };

  return {
    docs,
    transactions: () => transactions,
    doc: (path) => ({ path }),
    runTransaction: (fn) => {
      const run = queue.then(() => runOne(fn));
      queue = run.catch(() => {});
      return run;
    },
  };
}

const post = (db, id = 'p1') => db.docs.get(`communityPosts/${id}`);
const seedPost = (over = {}) => ({ 'communityPosts/p1': { authorId: 'alice', text: 'Run done', likeCount: 3, commentCount: 2, shareCount: 1, ...over } });

describe('changePostCount', () => {
  it('names the count each kind of document moves', () => {
    expect(COUNT_FIELDS).toEqual({ likes: 'likeCount', comments: 'commentCount', shares: 'shareCount' });
  });

  it('adds one when a like, comment or share appears and takes one off when it goes, on its own count', async () => {
    const db = makeDb(seedPost());
    expect(await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'e1' })).toBe('changed');
    expect(post(db)).toMatchObject({ likeCount: 4, commentCount: 2, shareCount: 1 });
    expect(await changePostCount({ db, postId: 'p1', kind: 'comments', delta: 1, eventId: 'e2' })).toBe('changed');
    expect(post(db)).toMatchObject({ likeCount: 4, commentCount: 3, shareCount: 1 });
    expect(await changePostCount({ db, postId: 'p1', kind: 'shares', delta: 1, eventId: 'e3' })).toBe('changed');
    expect(post(db)).toMatchObject({ likeCount: 4, commentCount: 3, shareCount: 2 });
    await changePostCount({ db, postId: 'p1', kind: 'likes', delta: -1, eventId: 'e4' });
    await changePostCount({ db, postId: 'p1', kind: 'comments', delta: -1, eventId: 'e5' });
    await changePostCount({ db, postId: 'p1', kind: 'shares', delta: -1, eventId: 'e6' });
    expect(post(db)).toMatchObject({ likeCount: 3, commentCount: 2, shareCount: 1 });
  });

  it('changes only the count, not the rest of the post', async () => {
    const db = makeDb(seedPost());
    await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'e1' });
    expect(post(db)).toEqual({ authorId: 'alice', text: 'Run done', likeCount: 4, commentCount: 2, shareCount: 1 });
  });

  it('applies a repeated delivery of the same event only once', async () => {
    const db = makeDb(seedPost());
    expect(await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'same' })).toBe('changed');
    expect(await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'same' })).toBe('duplicate');
    expect(post(db).likeCount).toBe(4);
  });

  it('counts two different events separately, even for the same post', async () => {
    const db = makeDb(seedPost({ likeCount: 0 }));
    await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'a' });
    await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'b' });
    expect(post(db).likeCount).toBe(2);
  });

  it('counts two events that arrive at the same moment as two', async () => {
    const db = makeDb(seedPost({ likeCount: 0 }));
    await Promise.all([
      changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'a' }),
      changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'b' }),
    ]);
    expect(post(db).likeCount).toBe(2);
  });

  it('never goes below zero', async () => {
    const db = makeDb(seedPost({ likeCount: 0, commentCount: 0, shareCount: 0 }));
    await changePostCount({ db, postId: 'p1', kind: 'likes', delta: -1, eventId: 'e1' });
    await changePostCount({ db, postId: 'p1', kind: 'comments', delta: -1, eventId: 'e2' });
    await changePostCount({ db, postId: 'p1', kind: 'shares', delta: -1, eventId: 'e3' });
    expect(post(db)).toMatchObject({ likeCount: 0, commentCount: 0, shareCount: 0 });
  });

  it('starts from zero when the post has no count yet, or one that is not a number', async () => {
    const db = makeDb({ 'communityPosts/p1': { authorId: 'alice' }, 'communityPosts/p2': { authorId: 'alice', likeCount: 'lots' } });
    await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: 'e1' });
    await changePostCount({ db, postId: 'p2', kind: 'likes', delta: 1, eventId: 'e2' });
    expect(post(db, 'p1').likeCount).toBe(1);
    expect(post(db, 'p2').likeCount).toBe(1);
  });

  it('leaves a post that has no document alone, rather than creating one', async () => {
    const db = makeDb({});
    expect(await changePostCount({ db, postId: 'gone', kind: 'likes', delta: -1, eventId: 'e1' })).toBe('no-post');
    expect([...db.docs.keys()]).toEqual([]);
  });

  it('records each applied event, with its kind and the time it was given', async () => {
    const db = makeDb(seedPost());
    await changePostCount({ db, postId: 'p1', kind: 'shares', delta: 1, eventId: 'e1', stamp: 'NOW' });
    expect(db.docs.get('communityPosts/p1/counterEvents/e1')).toEqual({ kind: 'shares', delta: 1, at: 'NOW' });
  });

  it('does nothing for a missing post or event id, a kind it does not know, or a change that is not one up or one down', async () => {
    const db = makeDb(seedPost());
    expect(await changePostCount({ db, postId: '', kind: 'likes', delta: 1, eventId: 'e1' })).toBe('ignored');
    expect(await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 1, eventId: '' })).toBe('ignored');
    expect(await changePostCount({ db, postId: 'p1', kind: 'views', delta: 1, eventId: 'e1' })).toBe('ignored');
    expect(await changePostCount({ db, postId: 'p1', kind: 'likeCount', delta: 1, eventId: 'e1' })).toBe('ignored');
    expect(await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 5, eventId: 'e1' })).toBe('ignored');
    expect(await changePostCount({ db, postId: 'p1', kind: 'likes', delta: 0, eventId: 'e1' })).toBe('ignored');
    expect(post(db)).toMatchObject({ likeCount: 3, commentCount: 2, shareCount: 1 });
    expect(db.transactions()).toBe(0);
  });
});

// Erases everything ZOWN HQ stores about one person, then their sign-in account.
//
// This file holds only the logic. Firestore, Storage, Auth and the ROOK call are
// passed in, so it can be tested without Firebase and so index.js stays the
// one place that touches the real services.
//
// Where a person's data lives (see firestore.rules and storage.rules):
//   users/{uid} and everything under it    profile, email, body scans, weight, recipes,
//                                          meal plan, device tokens, follows, music tokens...
//   workouts, loggedSets, coachMessages,
//   goals, aiRecommendations               one document each, with `userId`
//   leaderboard/{uid}, admins/{uid}        public entry, admin flag
//   communityPosts (authorId)              their posts, with the likes and comments on them
//   communityPosts/*/likes/{uid}           their likes on other people's posts
//   communityPosts/*/comments (authorId)   their comments on other people's posts
//   users/*/following/{uid}                other people's follow of them (holds their name and avatar)
//   conversations, duels (participantIds)  threads and duels they were in, removed for both people
//   calendarInvites (participantIds)       calendar invites they sent or were sent, removed for both people (they hold both names)
//   challengeEntries (uid)                 their progress on challenges
//   raceEntries (uid)                      their times on the virtual race boards
//   users/*/groupMemberships               their group memberships (the onGroupLeft function lowers each group's member count)
//   Storage users/{uid}/ and posts/{uid}/  profile picture, uploads, post media
//   ROOK                                   connected wearable sources are revoked
//
// Order matters: the sign-in account goes last, and only if every other step
// worked. If a step fails the person can simply try again; every step is safe to
// run twice. Nothing here records who was deleted, except a failed run, which
// keeps the uid so the leftovers can be cleared by hand.

const PAGE = 300;
const MAX_PAGES = 2000; // a safety stop, far above anything real

const isNotFound = (e) => e?.code === 5 || /NOT_FOUND/.test(String(e?.message || e));

// Runs a group of writes through a BulkWriter and throws if any of them failed.
async function writeAll(db, build) {
  const writer = db.bulkWriter();
  const pending = [];
  build({
    delete: (ref) => pending.push(writer.delete(ref)),
    update: (ref, data) => pending.push(writer.update(ref, data)),
  });
  await writer.close();
  const results = await Promise.allSettled(pending);
  const failed = results.find((r) => r.status === 'rejected' && !isNotFound(r.reason));
  if (failed) throw failed.reason;
}

// Deletes every document a query returns, a page at a time, until none are left.
// With `recursive`, each document's subcollections go too.
async function deleteQuery(db, makeQuery, { recursive = false } = {}) {
  let removed = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const snap = await makeQuery().limit(PAGE).get();
    if (snap.empty) return removed;
    if (recursive) {
      for (const d of snap.docs) await db.recursiveDelete(d.ref);
    } else {
      await writeAll(db, (w) => snap.docs.forEach((d) => w.delete(d.ref)));
    }
    removed += snap.size;
  }
  throw new Error('too many pages while deleting');
}

// Calls fn with each page of a collection's documents (references only, no fields).
async function forEachPage(db, collectionName, fn) {
  let last = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = db.collection(collectionName).select().orderBy('__name__').limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return;
    await fn(snap.docs);
    if (snap.size < PAGE) return;
    last = snap.docs[snap.docs.length - 1];
  }
  throw new Error('too many pages while scanning ' + collectionName);
}

export const USER_KEYED_COLLECTIONS = ['workouts', 'loggedSets', 'coachMessages', 'goals', 'aiRecommendations'];
export const STORAGE_PREFIXES = (uid) => [`users/${uid}/`, `posts/${uid}/`];

/**
 * @param {object} deps
 * @param {string} deps.uid
 * @param {object} deps.db                 Firestore (admin)
 * @param {object} deps.bucket             Storage bucket (admin)
 * @param {object} deps.auth               Auth (admin)
 * @param {Function} deps.increment        FieldValue.increment
 * @param {Function} [deps.revokeIntegrations]  async (uid) => void, best effort
 * @param {Function} [deps.now]
 * @param {object} [deps.log]
 * @returns {Promise<{ok: boolean, steps: {name: string, ok: boolean, error?: string}[]}>}
 */
export async function eraseUserAccount({ uid, db, bucket, auth, increment, revokeIntegrations, now = () => new Date(), log = console }) {
  if (!uid || typeof uid !== 'string') throw new Error('uid is required');

  const steps = [];
  const run = async (name, fn, { required = true } = {}) => {
    try {
      await fn();
      steps.push({ name, ok: true });
    } catch (e) {
      log.error(`[accountErasure] step "${name}" failed:`, e?.message || e);
      steps.push({ name, ok: false, required, error: String(e?.message || e) });
    }
  };

  // Stops wearable data flowing in from ROOK. A ROOK outage must not stop someone
  // deleting their account, so this one is allowed to fail.
  await run('integrations', async () => {
    if (revokeIntegrations) await revokeIntegrations(uid);
  }, { required: false });

  // Group memberships. The member count of each group is not touched here: removing a membership document is what makes the
  // onGroupLeft function lower the count (functions/src/groupMemberCount.js), once per membership, so running this twice never
  // lowers a count twice.
  await run('groups', async () => {
    const memberships = await db.collection(`users/${uid}/groupMemberships`).get();
    if (memberships.empty) return;
    await writeAll(db, (w) => {
      memberships.docs.forEach((m) => w.delete(m.ref));
    });
  });

  // Their own posts, with all the likes and comments on them.
  await run('posts', () => deleteQuery(db, () => db.collection('communityPosts').where('authorId', '==', uid), { recursive: true }));

  // Their likes and comments on other people's posts, with the counters corrected.
  await run('likesAndComments', () => forEachPage(db, 'communityPosts', async (posts) => {
    const likeRefs = posts.map((p) => db.doc(`communityPosts/${p.id}/likes/${uid}`));
    const [likeSnaps, commentSnaps] = await Promise.all([
      db.getAll(...likeRefs),
      Promise.all(posts.map((p) => db.collection(`communityPosts/${p.id}/comments`).where('authorId', '==', uid).get())),
    ]);
    await writeAll(db, (w) => {
      posts.forEach((p, i) => {
        const counters = {};
        if (likeSnaps[i].exists) {
          w.delete(likeRefs[i]);
          counters.likeCount = increment(-1);
        }
        if (!commentSnaps[i].empty) {
          commentSnaps[i].docs.forEach((c) => w.delete(c.ref));
          counters.commentCount = increment(-commentSnaps[i].size);
        }
        if (Object.keys(counters).length) w.update(p.ref, counters);
      });
    });
  }));

  // People who follow them: those follow documents hold the person's name and avatar.
  await run('followers', () => forEachPage(db, 'users', async (users) => {
    const others = users.filter((u) => u.id !== uid);
    if (!others.length) return;
    const refs = others.map((u) => db.doc(`users/${u.id}/following/${uid}`));
    const snaps = await db.getAll(...refs);
    await writeAll(db, (w) => snaps.forEach((s, i) => { if (s.exists) w.delete(refs[i]); }));
  }));

  await run('conversations', () => deleteQuery(db, () => db.collection('conversations').where('participantIds', 'array-contains', uid), { recursive: true }));
  await run('duels', () => deleteQuery(db, () => db.collection('duels').where('participantIds', 'array-contains', uid), { recursive: true }));
  await run('calendarInvites', () => deleteQuery(db, () => db.collection('calendarInvites').where('participantIds', 'array-contains', uid)));
  await run('challengeEntries', () => deleteQuery(db, () => db.collection('challengeEntries').where('uid', '==', uid)));
  await run('raceEntries', () => deleteQuery(db, () => db.collection('raceEntries').where('uid', '==', uid)));

  for (const name of USER_KEYED_COLLECTIONS) {
    await run(name, () => deleteQuery(db, () => db.collection(name).where('userId', '==', uid)));
  }

  await run('publicProfile', () => writeAll(db, (w) => {
    w.delete(db.doc(`leaderboard/${uid}`));
    w.delete(db.doc(`admins/${uid}`));
  }));

  await run('files', async () => {
    for (const prefix of STORAGE_PREFIXES(uid)) await bucket.deleteFiles({ prefix, force: true });
  });

  // The profile and everything under it (email, measurements, tokens, follows...).
  await run('userData', () => db.recursiveDelete(db.doc(`users/${uid}`)));

  const failed = steps.filter((s) => !s.ok && s.required !== false);

  if (failed.length) {
    // Keep the uid on a failed run only, so the leftovers can be cleared by hand.
    await db.collection('accountDeletions').add({
      at: now().toISOString(),
      ok: false,
      uid,
      failedSteps: failed.map((s) => s.name),
    }).catch((e) => log.error('[accountErasure] could not write the failure record:', e?.message || e));
    return { ok: false, steps };
  }

  // Last: the sign-in account, which holds the email address.
  try {
    await auth.deleteUser(uid);
    steps.push({ name: 'signIn', ok: true });
  } catch (e) {
    if (e?.code === 'auth/user-not-found') {
      steps.push({ name: 'signIn', ok: true });
    } else {
      log.error('[accountErasure] could not delete the sign-in account:', e?.message || e);
      steps.push({ name: 'signIn', ok: false, required: true, error: String(e?.message || e) });
      await db.collection('accountDeletions').add({
        at: now().toISOString(), ok: false, uid, failedSteps: ['signIn'],
      }).catch(() => {});
      return { ok: false, steps };
    }
  }

  // A success record with no uid and nothing else about the person.
  await db.collection('accountDeletions').add({ at: now().toISOString(), ok: true }).catch(() => {});
  return { ok: true, steps };
}

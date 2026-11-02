// Keeps the like, comment and share counts on a community post equal to the documents that make them.
//
// The app used to write these counts itself, so the rules had to let any signed-in person set any post's count to anything, and a
// double tap on a like added two. Now the app writes only the document that is the thing itself, and these functions (the triggers
// in index.js) move the count when that document appears or goes:
//
//   communityPosts/{postId}/likes/{uid}       likeCount      one per person, so a double tap is one like
//   communityPosts/{postId}/comments/{id}     commentCount
//   communityPosts/{postId}/shares/{uid}      shareCount     one per person: the number is people who shared, not times shared
//
// The rules refuse any client write to the three counts.
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.
//
// - A post that has no document (it was deleted, or its comments were left behind when it went) is left alone. Creating one here
//   would turn a stray like into a half-empty post.
// - A count never goes below 0.
// - Each event is applied once. Firebase can deliver the same event twice, and the functions are set to be tried again after a
//   failure; a small marker document named after the event id is written in the same transaction as the change, so a second
//   delivery finds it and does nothing. (Same method as groupMemberCount.js.)

export const COUNT_FIELDS = { likes: 'likeCount', comments: 'commentCount', shares: 'shareCount' };

/**
 * @param {object} args
 *   db        Firestore (firebase-admin)
 *   postId    the post whose count moves
 *   kind      'likes', 'comments' or 'shares'
 *   delta     1 when one appeared, -1 when one went
 *   eventId   the id of the Firestore event (the same for a repeated delivery)
 *   stamp     the value to record as the time of the change (FieldValue.serverTimestamp() in the real function)
 * @returns {Promise<'changed'|'duplicate'|'no-post'|'ignored'>}
 */
export async function changePostCount({ db, postId, kind, delta, eventId, stamp = null }) {
  const field = COUNT_FIELDS[kind];
  if (!postId || !eventId || !field || (delta !== 1 && delta !== -1)) return 'ignored';

  const postRef = db.doc(`communityPosts/${postId}`);
  const markerRef = db.doc(`communityPosts/${postId}/counterEvents/${eventId}`);

  return db.runTransaction(async (tx) => {
    const marker = await tx.get(markerRef);
    if (marker.exists) return 'duplicate';
    const post = await tx.get(postRef);
    if (!post.exists) return 'no-post';

    const current = Number(post.data()?.[field]);
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + delta);
    tx.update(postRef, { [field]: next });
    tx.set(markerRef, { kind, delta, at: stamp });
    return 'changed';
  });
}

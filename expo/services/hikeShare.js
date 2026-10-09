// services/hikeShare.js
//
// Shares a saved hike to the community feed as a hike card (distance, time,
// pace, climb, difficulty and a route with its ends hidden, see
// lib/hikeShare.js), and remembers on the hike which post it became so it is
// not posted twice. The screens only show the button and its result.
// Everything it depends on is passed in.
import { buildHikePost } from '../lib/hikeShare';

/**
 * @param {object} options
 *   hike        the saved hike to share
 *   user        the signed-in user ({ uid, displayName?, name?, profileImage? })
 *   createPost  store/communityStore.js createPost
 *   markShared  (uid, hikeId, postId) => void, remembers the post on the hike
 * @returns {Promise<{ok:true, postId:string}
 *   | {ok:false, reason:'no-hike'|'signed-out'|'too-short'|'already-shared'|'error', postId?:string}>}
 */
export async function shareHikeToFeed({ hike, user, createPost, markShared } = {}) {
  if (!hike) return { ok: false, reason: 'no-hike' };
  if (hike.sharedPostId) return { ok: false, reason: 'already-shared', postId: String(hike.sharedPostId) };
  const uid = user && user.uid;
  if (!uid) return { ok: false, reason: 'signed-out' };
  const payload = buildHikePost(hike);
  if (!payload) return { ok: false, reason: 'too-short' };

  try {
    const postId = await createPost({
      uid,
      authorName: user.displayName || user.name || 'Zown User',
      authorAvatar: user.profileImage,
      text: payload.text,
      type: 'hike',
      run: payload.run,
    });
    if (!postId) return { ok: false, reason: 'error' };
    if (typeof markShared === 'function') {
      try {
        markShared(uid, hike.id, postId);
      } catch (e) {
        // The post is up; failing to remember it only means the button could be pressed again.
        console.warn('[hikeShare] could not remember the post:', e?.message);
      }
    }
    return { ok: true, postId: String(postId) };
  } catch (e) {
    console.warn('[hikeShare] share failed:', e?.message);
    return { ok: false, reason: 'error' };
  }
}

/** What to tell the person when sharing did not work. */
export function hikeShareErrorText(reason) {
  if (reason === 'signed-out') return 'Sign in to share your hike.';
  if (reason === 'too-short') return 'This hike is too short to share.';
  return 'Could not share your hike. Try again in a moment.';
}

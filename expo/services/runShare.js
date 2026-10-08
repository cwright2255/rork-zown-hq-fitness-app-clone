// services/runShare.js
//
// Shares a saved run to the community feed as a run card (distance, time, pace
// and a route with its ends hidden, see lib/runShare.js), and remembers on the
// run which post it became so it is not posted twice. The screens only show
// the button and its result. Everything it depends on is passed in.
import { buildRunPost } from '../lib/runShare';

/**
 * @param {object} options
 *   run         the saved run to share
 *   user        the signed-in user ({ uid, displayName?, name?, profileImage? })
 *   createPost  store/communityStore.js createPost
 *   markShared  (uid, runId, postId) => void, remembers the post on the run
 * @returns {Promise<{ok:true, postId:string}
 *   | {ok:false, reason:'no-run'|'signed-out'|'too-short'|'already-shared'|'error', postId?:string}>}
 */
export async function shareRunToFeed({ run, user, createPost, markShared } = {}) {
  if (!run) return { ok: false, reason: 'no-run' };
  if (run.sharedPostId) return { ok: false, reason: 'already-shared', postId: String(run.sharedPostId) };
  const uid = user && user.uid;
  if (!uid) return { ok: false, reason: 'signed-out' };
  const payload = buildRunPost(run);
  if (!payload) return { ok: false, reason: 'too-short' };

  try {
    const postId = await createPost({
      uid,
      authorName: user.displayName || user.name || 'Zown User',
      authorAvatar: user.profileImage,
      text: payload.text,
      type: 'run',
      run: payload.run,
    });
    if (!postId) return { ok: false, reason: 'error' };
    if (typeof markShared === 'function') {
      try {
        markShared(uid, run.id, postId);
      } catch (e) {
        // The post is up; failing to remember it only means the button could be pressed again.
        console.warn('[runShare] could not remember the post:', e?.message);
      }
    }
    return { ok: true, postId: String(postId) };
  } catch (e) {
    console.warn('[runShare] share failed:', e?.message);
    return { ok: false, reason: 'error' };
  }
}

/** What to tell the person when sharing did not work. */
export function shareErrorText(reason) {
  if (reason === 'signed-out') return 'Sign in to share your run.';
  if (reason === 'too-short') return 'This run is too short to share.';
  return 'Could not share your run. Try again in a moment.';
}

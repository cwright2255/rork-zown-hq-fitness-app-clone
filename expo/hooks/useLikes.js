// hooks/useLikes.js
//
// The heart on a post, for the feed screens (app/social.jsx, app/community.jsx).
//
// - The heart flips the moment it is tapped, and is put back if the like could not be written.
// - A tap while the same post's last tap is still being written is ignored, so a double tap is one like, not a like followed by an
//   unlike. (store/communityStore.js toggleLike does the same for any other caller.)
// - The number next to the heart. The app does not write the like count: a Cloud Function moves it a moment after the like
//   document appears (functions/src/postCounters.js). So that the number does not lag behind the heart, this phone adds its own
//   like or unlike to the count it was showing, until the real count comes in (it changes) or a few seconds pass.
import { useCallback, useEffect, useRef, useState } from 'react';

// How long this phone keeps adding its own like to the count it saw, if the real count has not moved.
export const OWN_CHANGE_MS = 8000;

/**
 * The like count to show for a post.
 * @param {number} serverCount  the post's likeCount as the feed has it now
 * @param {{base: number, change: number}|undefined} own  this phone's own change, made when the count was `base`
 */
export function shownLikeCount(serverCount, own) {
  const server = Number(serverCount) || 0;
  if (!own || own.base !== server) return server;
  return Math.max(0, server + own.change);
}

/**
 * @param {object} args
 *   uid         the signed-in person
 *   toggleLike  (postId, uid) => Promise<true|false|null>  the new liked state, or null when it could not be written
 */
export function useLikes({ uid, toggleLike }) {
  const [likedByMe, setLikedByMe] = useState({});
  const [own, setOwn] = useState({});
  const likedRef = useRef({});
  const busy = useRef(new Set());
  const timers = useRef({});
  const mounted = useRef(true);

  likedRef.current = likedByMe;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, []);

  const setLiked = useCallback((postId, value) => {
    if (mounted.current) setLikedByMe((prev) => ({ ...prev, [postId]: value }));
  }, []);

  const setOwnChange = useCallback((postId, next) => {
    // A like that finishes after the screen has closed has nothing to show and must not leave a timer behind.
    if (!mounted.current) return;
    clearTimeout(timers.current[postId]);
    if (!next) {
      setOwn((prev) => {
        const { [postId]: dropped, ...rest } = prev;
        return rest;
      });
      return;
    }
    setOwn((prev) => ({ ...prev, [postId]: next }));
    timers.current[postId] = setTimeout(() => {
      setOwn((prev) => {
        const { [postId]: dropped, ...rest } = prev;
        return rest;
      });
    }, OWN_CHANGE_MS);
  }, []);

  const handleLike = useCallback(async (post) => {
    const postId = post && post.id;
    if (!uid || !postId || busy.current.has(postId)) return;
    busy.current.add(postId);
    try {
      const wasLiked = !!likedRef.current[postId];
      const base = Number(post.likeCount) || 0;
      const step = wasLiked ? -1 : 1;
      const before = own[postId];
      setLiked(postId, !wasLiked);
      setOwnChange(postId, { base, change: (before && before.base === base ? before.change : 0) + step });

      const result = await toggleLike(postId, uid);

      if (result === null) {
        // Not written: put the heart and the number back.
        setLiked(postId, wasLiked);
        setOwnChange(postId, before && before.base === base ? before : null);
      } else if (result !== !wasLiked) {
        // The post was in the other state than this phone thought (the heart had not loaded yet): show what really happened.
        setLiked(postId, result);
        setOwnChange(postId, { base, change: result ? 1 : -1 });
      }
    } finally {
      busy.current.delete(postId);
    }
  }, [uid, toggleLike, own, setLiked, setOwnChange]);

  const likeCountOf = useCallback((post) => shownLikeCount(post && post.likeCount, own[post && post.id]), [own]);

  return { likedByMe, setLikedByMe, handleLike, likeCountOf };
}

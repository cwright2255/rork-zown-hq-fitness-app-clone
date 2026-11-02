// store/communityStore.js
//
// Real public community feed — replaces the previous version's five
// entirely fabricated people (Sarah Johnson, Mike Chen, etc. with stock
// photos and fake engagement numbers) and confirmed-dead-code status (zero
// real usage anywhere in the app — app/community.jsx had its own
// separate, independently hardcoded feed and didn't import this store at
// all).
//
// Like store/leaderboardStore.js, this is a genuinely different Firestore
// pattern than the private `users/{uid}/...` collections everywhere else
// in this app: posts need to be readable by every authenticated user, but
// only the author can create/edit/delete their own.
//
// The like, comment and share counts on a post are NOT written by the app
// (and the rules refuse anyone who tries). A like is one document named by
// the person's uid under the post, so a double tap is one like; a comment
// is a document; a share is one document per person. The Cloud Functions
// in functions/src/postCounters.js keep likeCount, commentCount and
// shareCount equal to those documents, a moment after each one appears or
// goes. The name and picture on a post or comment are the ones on the
// author's profile (services/publicProfile.js, checked by the rules).

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, doc, addDoc, deleteDoc, setDoc, getDoc, getDocs,
  query, orderBy, limit, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { uploadPostMedia, deletePostMedia } from '../services/postMediaService';
import { describeSharedRun } from '../lib/runShare';
import { isTextAllowed, contentNotAllowedError } from '../lib/wordFilter';
import { useRunningStore } from './runningStore';
import { ensurePublicProfile } from '../services/publicProfile';
// How long a post and a comment can be: the rules refuse anything longer, and the screens stop typing at the same number.
import { MAX_POST_LENGTH, MAX_COMMENT_LENGTH } from '../lib/communityLimits';

// A like or unlike that is still being written, by post and person: asking again meanwhile gives the answer to the first, so a
// double tap is one like and not a like followed by an unlike.
const likesInFlight = new Map();

export const useCommunityStore = create((set, get) => ({
  posts: [],
  isLoading: false,
  error: null,
  _unsubscribe: null,

  subscribeFeed: (max = 50) => {
    get()._unsubscribe?.();
    const q = query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'), limit(max));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ posts, isLoading: false });
      },
      (e) => {
        console.warn('[communityStore] subscribeFeed error:', e?.message);
        set({ error: e?.message, isLoading: false });
      }
    );
    set({ _unsubscribe: unsubscribe, isLoading: true });
    return unsubscribe;
  },

  unsubscribeFeed: () => {
    get()._unsubscribe?.();
    set({ _unsubscribe: null });
  },

  // A post needs some text or at least one photo or video. Photos and videos
  // (`mediaItems`, picked in components/PostComposer) are uploaded to
  // Firebase Storage first; the post is only saved once every upload worked,
  // so a failed upload never leaves a half-finished post. The post id is made
  // up front so the files can live under posts/{uid}/{postId}/.
  // `imageUrl` still holds the first photo so older screens keep working.
  // `run` is a shared run card (lib/runShare.js buildRunPost), kept on the post
  // as it is; a post with a run needs no text or photo of its own.
  createPost: async ({ uid, authorName, authorAvatar, text, imageUrl, type, mediaItems, run, onProgress }) => {
    const clean = (text || '').trim();
    const items = Array.isArray(mediaItems) ? mediaItems : [];
    const sharedRun = run && typeof run === 'object' && describeSharedRun(run) ? run : null;
    if (!uid || (!clean && items.length === 0 && !sharedRun)) return null;
    // The word list (lib/wordFilter.js) is checked before anything is uploaded or saved.
    if (!isTextAllowed(clean)) throw contentNotAllowedError();
    if (clean.length > MAX_POST_LENGTH) throw new Error(`A post can be at most ${MAX_POST_LENGTH} characters.`);
    try {
      // The name and picture on the post are the ones on the person's profile; the rules check that they are.
      const profile = await ensurePublicProfile(uid, { name: authorName, avatar: authorAvatar });
      const postRef = doc(collection(db, 'communityPosts'));
      const media = items.length > 0
        ? await uploadPostMedia({ uid, postId: postRef.id, items, onProgress })
        : [];
      const firstImage = media.find((m) => m.type === 'image');
      try {
        await setDoc(postRef, {
          authorId: uid,
          authorName: profile.name,
          authorAvatar: profile.avatar,
          text: clean,
          imageUrl: firstImage ? firstImage.url : (imageUrl || null),
          media,
          type: type || 'general',
          ...(sharedRun ? { run: sharedRun } : {}),
          // The counts start at 0 and are moved by the Cloud Functions; the rules refuse a post that starts anywhere else.
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          likesHidden: false,
          shareCountHidden: false,
          commentsDisabled: false,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        await deletePostMedia(media);
        throw e;
      }
      return postRef.id;
    } catch (e) {
      console.warn('[communityStore] createPost error:', e?.message);
      throw e;
    }
  },

  // Real edit — firestore.rules let an author change the text, the edited
  // time and the three settings of their own post, and nothing else. Only
  // ever touches text and the edited time; every other field (the counts,
  // authorId, createdAt, etc.) is left exactly as it was.
  updatePost: async (postId, uid, text) => {
    if (!uid || !text?.trim()) return false;
    if (!isTextAllowed(text)) return false; // the screen checks first, to say why (lib/wordFilter.js)
    if (text.trim().length > MAX_POST_LENGTH) return false;
    try {
      await updateDoc(doc(db, 'communityPosts', postId), {
        text: text.trim(),
        editedAt: serverTimestamp(),
      });
      return true;
    } catch (e) {
      console.warn('[communityStore] updatePost error:', e?.message);
      return false;
    }
  },

  // Also removes the post's photos and video from Storage (best effort; only
  // the author can delete those files, so an admin removing someone else's
  // post removes the post itself and leaves the files).
  deletePost: async (postId, uid) => {
    try {
      const postRef = doc(db, 'communityPosts', postId);
      let media = [];
      let wasRun = false;
      let wasHike = false;
      try {
        const snap = await getDoc(postRef);
        media = snap.exists() ? (snap.data().media || []) : [];
        // A hike card is a run card with type 'hike' (lib/hikeShare.js).
        const hasCard = snap.exists() && !!snap.data().run;
        wasHike = hasCard && snap.data().type === 'hike';
        wasRun = hasCard && !wasHike;
      } catch (e) {
        media = [];
      }
      await deleteDoc(postRef);
      await deletePostMedia(media);
      // A deleted run card frees the run to be shared again. (The saved runs are
      // loaded first if this phone has not got them yet, or the run would keep
      // pointing at a post that no longer exists.)
      if (wasRun && uid) {
        try {
          const running = useRunningStore.getState();
          if (!running.runs?.length && typeof running.loadRuns === 'function') await running.loadRuns(uid);
          useRunningStore.getState().forgetSharedPost?.(uid, postId);
        } catch (e) {
          console.warn('[communityStore] could not free the run for sharing:', e?.message);
        }
      }
      // The same for a deleted hike card: the hike can be shared again. (Loaded
      // lazily: only this path needs the hiking store.)
      if (wasHike && uid) {
        try {
          // eslint-disable-next-line global-require
          const { useHikingStore } = require('./hikingStore');
          const hiking = useHikingStore.getState();
          if (!hiking.completedHikes?.length && typeof hiking.loadCompletedHikes === 'function') await hiking.loadCompletedHikes(uid);
          useHikingStore.getState().forgetSharedPost?.(uid, postId);
        } catch (e) {
          console.warn('[communityStore] could not free the hike for sharing:', e?.message);
        }
      }
    } catch (e) {
      console.warn('[communityStore] deletePost error:', e?.message);
    }
  },

  // Real per-post visibility settings — only ever touches the specific
  // boolean fields passed in (likesHidden, shareCountHidden, commentsDisabled:
  // the only ones the rules let anyone change), same author-only path
  // updatePost uses.
  // commentsDisabled is also enforced server-side (see firestore.rules'
  // comments subcollection create rule) so turning it off actually
  // blocks new comments, not just hides the UI for it.
  updatePostSettings: async (postId, settings) => {
    try {
      await updateDoc(doc(db, 'communityPosts', postId), settings);
      return true;
    } catch (e) {
      console.warn('[communityStore] updatePostSettings error:', e?.message);
      return false;
    }
  },

  // Returns the new liked state (true/false) so the caller can update its
  // own optimistic UI without waiting for the feed subscription to catch up,
  // or null when it could not be written. A like is one document named by the
  // person's uid, so liking twice is still one like; the Cloud Function that
  // sees the document appear adds one to the post's likeCount (the app never
  // writes the count). A second call while the first is still being written
  // is not a second toggle: it waits for, and returns, the first one's answer.
  toggleLike: (postId, uid) => {
    if (!uid || !postId) return Promise.resolve(false);
    const key = `${postId}/${uid}`;
    if (likesInFlight.has(key)) return likesInFlight.get(key);
    const run = (async () => {
      const likeRef = doc(db, 'communityPosts', postId, 'likes', uid);
      try {
        const existing = await getDoc(likeRef);
        if (existing.exists()) {
          await deleteDoc(likeRef);
          return false;
        }
        await setDoc(likeRef, { likedAt: serverTimestamp() });
        return true;
      } catch (e) {
        console.warn('[communityStore] toggleLike error:', e?.message);
        return null;
      }
    })().finally(() => likesInFlight.delete(key));
    likesInFlight.set(key, run);
    return run;
  },

  hasLiked: async (postId, uid) => {
    if (!uid) return false;
    try {
      const snap = await getDoc(doc(db, 'communityPosts', postId, 'likes', uid));
      return snap.exists();
    } catch (e) {
      return false;
    }
  },

  addComment: async (postId, { uid, authorName, text }) => {
    if (!uid || !text?.trim()) return null;
    if (!isTextAllowed(text)) throw contentNotAllowedError();
    if (text.trim().length > MAX_COMMENT_LENGTH) throw new Error(`A comment can be at most ${MAX_COMMENT_LENGTH} characters.`);
    try {
      // The name on the comment is the one on the person's profile; the rules check that it is. The post's commentCount is moved
      // by the Cloud Function that sees the comment appear, not written here.
      const profile = await ensurePublicProfile(uid, { name: authorName });
      const ref = await addDoc(collection(db, 'communityPosts', postId, 'comments'), {
        authorId: uid,
        authorName: profile.name,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      return ref.id;
    } catch (e) {
      console.warn('[communityStore] addComment error:', e?.message);
      throw e;
    }
  },

  // Removes a comment. The rules let its author, the owner of the post and an admin do this (firestore.rules). The post's comment count
  // is brought down by the Cloud Function that sees the comment go, not written here.
  deleteComment: async (postId, commentId) => {
    if (!postId || !commentId) return false;
    try {
      await deleteDoc(doc(db, 'communityPosts', postId, 'comments', commentId));
    } catch (e) {
      console.warn('[communityStore] deleteComment error:', e?.message);
      return false;
    }
    return true;
  },

  // Records a real completed OS share (see app/community.jsx's handleShare
  // — only called after the native share sheet reports the share actually
  // went through, not just on tapping the button). The mark is one document
  // named by the person's uid under the post, so the post's shareCount (moved
  // by the Cloud Function that sees the document appear) is the number of
  // people who shared it, not the number of times. Sharing again is a
  // rewrite of that document, which the rules refuse; that is not an error.
  recordShare: async (postId, uid) => {
    if (!postId || !uid) return;
    try {
      await setDoc(doc(db, 'communityPosts', postId, 'shares', uid), { sharedAt: serverTimestamp() });
    } catch (e) {
      if (e?.code === 'permission-denied') return; // this person's share is already on the post
      console.warn('[communityStore] recordShare error:', e?.message);
    }
  },

  loadComments: async (postId) => {
    try {
      const q = query(collection(db, 'communityPosts', postId, 'comments'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[communityStore] loadComments error:', e?.message);
      return [];
    }
  },
}));

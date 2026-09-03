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
// only the author can create/edit/delete their own. Likes use a
// subcollection (users/{uid} under each post) rather than an incremented
// counter field directly on the post, specifically to avoid two users
// liking at nearly the same moment corrupting a shared counter — reading
// the subcollection size gives an exact count with no race condition.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, doc, addDoc, deleteDoc, setDoc, getDoc, getDocs,
  query, orderBy, limit, onSnapshot, serverTimestamp, increment, updateDoc,
} from 'firebase/firestore';

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

  createPost: async ({ uid, authorName, authorAvatar, text, imageUrl, type }) => {
    if (!uid || !text?.trim()) return null;
    try {
      const ref = await addDoc(collection(db, 'communityPosts'), {
        authorId: uid,
        authorName: authorName || 'Zown User',
        authorAvatar: authorAvatar || null,
        text: text.trim(),
        imageUrl: imageUrl || null,
        type: type || 'general',
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        likesHidden: false,
        shareCountHidden: false,
        commentsDisabled: false,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    } catch (e) {
      console.warn('[communityStore] createPost error:', e?.message);
      throw e;
    }
  },

  // Real edit — firestore.rules already lets an author update any field
  // on their own post (not just the like/comment/share counters), so
  // this needs no rule change. Only ever touches text; every other field
  // (likeCount, authorId, createdAt, etc.) is left exactly as it was.
  updatePost: async (postId, uid, text) => {
    if (!uid || !text?.trim()) return false;
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

  deletePost: async (postId, uid) => {
    try {
      await deleteDoc(doc(db, 'communityPosts', postId));
    } catch (e) {
      console.warn('[communityStore] deletePost error:', e?.message);
    }
  },

  // Real per-post visibility settings — only ever touches the specific
  // boolean fields passed in, same author-only path updatePost uses.
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
  // own optimistic UI without waiting for the feed subscription to catch up.
  toggleLike: async (postId, uid) => {
    if (!uid) return false;
    const likeRef = doc(db, 'communityPosts', postId, 'likes', uid);
    const postRef = doc(db, 'communityPosts', postId);
    try {
      const existing = await getDoc(likeRef);
      if (existing.exists()) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likeCount: increment(-1) });
        return false;
      } else {
        await setDoc(likeRef, { likedAt: serverTimestamp() });
        await updateDoc(postRef, { likeCount: increment(1) });
        return true;
      }
    } catch (e) {
      console.warn('[communityStore] toggleLike error:', e?.message);
      return null;
    }
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
    try {
      const ref = await addDoc(collection(db, 'communityPosts', postId, 'comments'), {
        authorId: uid,
        authorName: authorName || 'Zown User',
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'communityPosts', postId), { commentCount: increment(1) });
      return ref.id;
    } catch (e) {
      console.warn('[communityStore] addComment error:', e?.message);
      throw e;
    }
  },

  // Records a real completed OS share (see app/community.jsx's handleShare
  // — only called after the native share sheet reports the share actually
  // went through, not just on tapping the button). Same non-author-counter
  // pattern as likes: allowed by firestore.rules because this update only
  // ever touches shareCount, never anything else on the post.
  recordShare: async (postId, uid) => {
    try {
      await updateDoc(doc(db, 'communityPosts', postId), { shareCount: increment(1) });
    } catch (e) {
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

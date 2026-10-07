// store/socialGraphStore.js
//
// Who you follow, and which of them are Close Friends. Both lists are
// private to you: users/{uid}/following/{otherUid} (see firestore.rules).
// Following is one-way, like Instagram: you do not need their approval and
// they are not told. Close Friends is a private star you put on someone you
// follow; it only changes what YOU see when you pick the Close Friends
// filter. Also remembers the Everyone / Following / Close Friends choice for
// each screen that has the filter.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { DEFAULT_AUDIENCE, isAudience, nextFollowState } from '../lib/audience';

export const useSocialGraphStore = create(
  persist(
    (set, get) => ({
      following: [], // [{ uid, name, avatar, close, followedAt }]
      isLoaded: false,
      isLoading: false,
      audience: { leaderboard: DEFAULT_AUDIENCE, challenges: DEFAULT_AUDIENCE, duels: DEFAULT_AUDIENCE },

      setAudience: (surface, value) => {
        if (!isAudience(value)) return;
        set((s) => ({ audience: { ...s.audience, [surface]: value } }));
      },

      loadFollowing: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDocs(collection(db, 'users', uid, 'following'));
          const following = snap.docs.map((d) => {
            const data = d.data() || {};
            return {
              uid: d.id,
              name: data.name || 'Zown User',
              avatar: data.avatar || null,
              close: data.close === true,
              followedAt: data.followedAt || null,
            };
          });
          set({ following, isLoaded: true });
        } catch (e) {
          console.warn('[socialGraphStore] loadFollowing error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      isFollowing: (uid) => get().following.some((f) => f.uid === uid),
      isClose: (uid) => get().following.some((f) => f.uid === uid && f.close),
      getRecord: (uid) => get().following.find((f) => f.uid === uid) || null,

      // action: 'follow' | 'unfollow' | 'addClose' | 'removeClose'
      // person: { uid, name, avatar }
      updateRelationship: async (myUid, person, action) => {
        if (!myUid || !person?.uid || person.uid === myUid) return false;
        const before = get().following;
        const existing = before.find((f) => f.uid === person.uid) || null;
        const next = nextFollowState(existing, action);
        const record = {
          uid: person.uid,
          name: person.name || existing?.name || 'Zown User',
          avatar: person.avatar || existing?.avatar || null,
          close: next.close,
          followedAt: existing?.followedAt || new Date().toISOString(),
        };
        // Optimistic: update the list now, put it back if the save fails.
        set({
          following: next.following
            ? [...before.filter((f) => f.uid !== person.uid), record]
            : before.filter((f) => f.uid !== person.uid),
        });
        try {
          const ref = doc(db, 'users', myUid, 'following', person.uid);
          if (next.following) {
            await setDoc(ref, {
              name: record.name,
              avatar: record.avatar,
              close: record.close,
              followedAt: record.followedAt,
            });
          } else {
            await deleteDoc(ref);
          }
          return true;
        } catch (e) {
          console.warn('[socialGraphStore] updateRelationship error:', e?.message);
          set({ following: before });
          return false;
        }
      },

      clear: () => set({ following: [], isLoaded: false }),
    }),
    {
      name: 'zown-social-graph',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the filter choices are remembered on the phone. The follow list
      // always comes fresh from Firestore.
      partialize: (state) => ({ audience: state.audience }),
    }
  )
);

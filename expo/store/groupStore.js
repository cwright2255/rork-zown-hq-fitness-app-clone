// store/groupStore.js
//
// Real community groups — same real pattern store/runningStore.js
// already uses for its program catalog: a Firestore-backed, admin-
// editable list (data/communityGroups.js is the static fallback if
// that collection is empty or unreachable), with real per-user
// join/leave state.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, doc, getDocs, setDoc, deleteDoc, updateDoc, increment,
} from 'firebase/firestore';
import { COMMUNITY_GROUPS as STATIC_COMMUNITY_GROUPS } from '@/data/communityGroups';

export const useGroupStore = create((set, get) => ({
  groups: STATIC_COMMUNITY_GROUPS,
  groupsLoaded: false,
  joinedGroupIds: new Set(),
  isLoading: false,

  loadGroups: async (uid) => {
    set({ isLoading: true });
    try {
      const snap = await getDocs(collection(db, 'communityGroups'));
      if (!snap.empty) {
        const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ groups, groupsLoaded: true });
      } else {
        set({ groupsLoaded: true }); // stays on the static fallback already in state
      }

      if (uid) {
        const membershipsSnap = await getDocs(collection(db, 'users', uid, 'groupMemberships'));
        set({ joinedGroupIds: new Set(membershipsSnap.docs.map((d) => d.id)) });
      }
    } catch (e) {
      console.warn('[groupStore] loadGroups error, using static fallback:', e?.message);
      set({ groupsLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  joinGroup: async (groupId, uid) => {
    if (!uid) return;
    set((s) => ({
      joinedGroupIds: new Set(s.joinedGroupIds).add(groupId),
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, memberCount: (g.memberCount || 0) + 1 } : g)),
    }));
    try {
      await setDoc(doc(db, 'users', uid, 'groupMemberships', groupId), {
        joinedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'communityGroups', groupId), { memberCount: increment(1) });
    } catch (e) {
      console.warn('[groupStore] joinGroup error:', e?.message);
    }
  },

  leaveGroup: async (groupId, uid) => {
    if (!uid) return;
    set((s) => {
      const next = new Set(s.joinedGroupIds);
      next.delete(groupId);
      return {
        joinedGroupIds: next,
        groups: s.groups.map((g) => (g.id === groupId ? { ...g, memberCount: Math.max(0, (g.memberCount || 0) - 1) } : g)),
      };
    });
    try {
      await deleteDoc(doc(db, 'users', uid, 'groupMemberships', groupId));
      await updateDoc(doc(db, 'communityGroups', groupId), { memberCount: increment(-1) });
    } catch (e) {
      console.warn('[groupStore] leaveGroup error:', e?.message);
    }
  },
}));

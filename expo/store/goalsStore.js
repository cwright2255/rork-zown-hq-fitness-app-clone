// store/goalsStore.js
//
// Real goal tracking, persisted per logged-in user in Firestore. Unlike
// bodyCompositionStore's users/{uid}/bodyScans (nested), goals is a
// top-level collection filtered by a userId field - matching the actual
// shape defined in firestore.rules (match /goals/{goalId} { ... uid ==
// resource.data.userId }), not the nested convention used elsewhere.
//
// A working, correctly-built version of this already existed at
// src/hooks/useGoals.js + src/stores/goalStore.js, but it depends on
// src/stores/authStore.js, which app/_layout.jsx never populates (no
// useAuth() call anywhere in the real app) - so that version's Firestore
// listener never actually attaches. This rebuilds the same, correct
// query logic against useUserStore instead, which is the store real
// screens actually use.
import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy,
  serverTimestamp,
} from 'firebase/firestore';

export const useGoalsStore = create((set, get) => ({
  goals: [],
  isLoading: false,
  error: null,

  loadGoals: async (uid) => {
    if (!uid) return;
    set({ isLoading: true, error: null });
    try {
      const q = query(
        collection(db, 'goals'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      set({ goals });
    } catch (e) {
      console.error('[goalsStore] loadGoals error:', e?.message);
      set({ error: e?.message });
    } finally {
      set({ isLoading: false });
    }
  },

  addGoal: async ({ uid, title, current, target, unit, deadline }) => {
    if (!uid) throw new Error('Not authenticated');
    const ref = await addDoc(collection(db, 'goals'), {
      userId: uid,
      title,
      current: current ?? 0,
      target,
      unit: unit ?? '',
      deadline: deadline ?? null,
      completed: false,
      createdAt: serverTimestamp(),
    });
    const newGoal = {
      id: ref.id, userId: uid, title, current: current ?? 0, target,
      unit: unit ?? '', deadline: deadline ?? null, completed: false,
    };
    set((state) => ({ goals: [newGoal, ...state.goals] }));
    return ref.id;
  },

  updateGoalProgress: async (goalId, current) => {
    await updateDoc(doc(db, 'goals', goalId), { current });
    set((state) => ({
      goals: state.goals.map((g) => (g.id === goalId ? { ...g, current } : g)),
    }));
  },

  deleteGoal: async (goalId) => {
    await deleteDoc(doc(db, 'goals', goalId));
    set((state) => ({ goals: state.goals.filter((g) => g.id !== goalId) }));
  },
}));

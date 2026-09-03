// store/homeWidgetsStore.js
//
// Syncs which home-screen widgets (lib/homeWidgets.js's WIDGET_REGISTRY)
// are enabled and in what order - not the widget definitions themselves
// (label/icon/kind are fixed, local, and never synced), same split
// badgeStore.js already uses for its badge catalog vs. unlock state.
// Same collection convention: users/{uid}/data/homeWidgets.
import { create } from 'zustand';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDefaultWidgetLayout } from '@/lib/homeWidgets';

export const useHomeWidgetsStore = create((set, get) => ({
  layout: getDefaultWidgetLayout(), // [{ id, enabled }], in display order
  isLoading: false,
  isEditing: false,

  loadLayout: async (uid) => {
    if (!uid) return;
    set({ isLoading: true });
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'data', 'homeWidgets'));
      if (snap.exists() && Array.isArray(snap.data().layout)) {
        set({ layout: snap.data().layout });
      }
      // No document yet - keep the default layout already in state
      // (every widget enabled, registry order) rather than an empty grid.
    } catch (e) {
      console.warn('[homeWidgetsStore] loadLayout error:', e?.message);
    } finally {
      set({ isLoading: false });
    }
  },

  saveLayout: async (uid, layout) => {
    set({ layout });
    if (!uid) return;
    try {
      await setDoc(doc(db, 'users', uid, 'data', 'homeWidgets'), { layout }, { merge: true });
    } catch (e) {
      console.warn('[homeWidgetsStore] saveLayout error:', e?.message);
    }
  },

  setEditing: (isEditing) => set({ isEditing }),

  toggleWidget: (id) => {
    const { layout } = get();
    set({
      layout: layout.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
    });
  },

  reorderWidget: (fromIndex, toIndex) => {
    const { layout } = get();
    const next = [...layout];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    set({ layout: next });
  },
}));

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const useRecipesStore = create(
  persist(
    (set, get) => ({
      savedRecipes: [],
      isLoading: false,

      /* ── Firestore sync ── */
      loadRecipes: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'recipes'));
          if (snap.exists()) {
            set({ savedRecipes: snap.data().savedRecipes || [] });
          }
        } catch (e) {
          console.warn('[recipesStore] loadRecipes error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      _persist: async (uid) => {
        if (!uid) return;
        try {
          await setDoc(doc(db, 'users', uid, 'data', 'recipes'), {
            savedRecipes: get().savedRecipes,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[recipesStore] _persist error:', e?.message);
        }
      },

      /* ── Actions ── */
      addRecipe: (recipe, uid) => {
        const newRecipe = {
          id: Date.now().toString(),
          ...recipe,
          savedAt: new Date().toISOString(),
        };
        set((state) => ({ savedRecipes: [newRecipe, ...state.savedRecipes] }));
        get()._persist(uid);
      },

      removeRecipe: (recipeId, uid) => {
        set((state) => ({
          savedRecipes: state.savedRecipes.filter((r) => r.id !== recipeId),
        }));
        get()._persist(uid);
      },

      clearRecipes: (uid) => {
        set({ savedRecipes: [] });
        get()._persist(uid);
      },
    }),
    {
      name: 'recipes-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        savedRecipes: s.savedRecipes,
      }),
    }
  )
);

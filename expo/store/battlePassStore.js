import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Real, persisted record of which tiers the user has actually claimed -
// distinct from "eligible to claim" (real level reached that tier's
// threshold, see app/battlepass.jsx), since claiming is a genuine user
// action, not something that should happen automatically the instant
// XP crosses a threshold. Previously app/battlepass.jsx had no claim
// tracking at all - every tier's status ('claimed'/'current'/'locked')
// was a hardcoded string in a static array, and the CLAIM button had no
// onPress handler whatsoever.
export const useBattlePassStore = create(
  persist(
    (set, get) => ({
      claimedTiers: [],
      isLoading: false,

      loadBattlePass: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'battlePass'));
          if (snap.exists()) {
            const d = snap.data();
            set({ claimedTiers: d.claimedTiers || [] });
          }
        } catch (e) {
          console.warn('[battlePassStore] loadBattlePass error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      _persist: async (uid) => {
        if (!uid) return;
        try {
          await setDoc(doc(db, 'users', uid, 'data', 'battlePass'), {
            claimedTiers: get().claimedTiers,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[battlePassStore] _persist error:', e?.message);
        }
      },

      // Real claim action - a no-op if already claimed (never double-
      // claims), and the caller (app/battlepass.jsx) is responsible for
      // only allowing this when the user's real level has actually
      // reached that tier, since this store has no independent way to
      // verify XP/level on its own.
      claimTier: (tierNum, uid) => {
        const { claimedTiers } = get();
        if (claimedTiers.includes(tierNum)) return;
        set({ claimedTiers: [...claimedTiers, tierNum] });
        get()._persist(uid);
      },
    }),
    {
      name: 'zown-battlepass-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        claimedTiers: state.claimedTiers,
      }),
    }
  )
);

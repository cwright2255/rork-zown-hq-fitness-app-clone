import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { callProxy } from '../services/callProxy';

// Which Battle Pass tiers the person has claimed - distinct from "eligible to claim" (their level has reached that tier, see
// app/battlepass.jsx), since claiming is a genuine action, not something that happens the instant XP crosses a threshold.
//
// A tier is claimed on the server (the claimBattlePassTier function, functions/src/unlocks.js): it records the claim at
// users/{uid}/data/battlePass, which the phone can read and never write, and only when the level in the person's XP ledger has reached
// the tier. This store asks it to, and shows what it says: services/progressSync.js hands it each change to that document, and
// loadBattlePass fetches it once.
export const useBattlePassStore = create(
  persist(
    (set, get) => ({
      claimedTiers: [],
      isLoading: false,
      // The tier whose claim is on its way to the server, or null. A second tap on the same tier while it is waits for the first.
      claiming: null,

      // `tiers` is the `claimedTiers` list of the server's document. What the server says replaces what the phone held.
      applyServerClaims: (tiers) => {
        const list = Array.isArray(tiers) ? tiers.filter((t) => Number.isInteger(t)) : [];
        set({ claimedTiers: [...new Set(list)].sort((a, b) => a - b) });
      },

      // Back to nothing claimed, when the person signs out.
      clearServerClaims: () => set({ claimedTiers: [], claiming: null }),

      loadBattlePass: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'battlePass'));
          if (snap.exists()) get().applyServerClaims(snap.data().claimedTiers);
        } catch (e) {
          console.warn('[battlePassStore] loadBattlePass error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      // Asks the server to claim a tier. Resolves to what came of it:
      //   'claimed'  it is claimed now
      //   'already'  it was claimed before (the list is brought up to date)
      //   'locked'   the person's level has not reached the tier yet
      //   'busy'     this tier's claim is already on its way
      //   'failed'   the server could not be reached or turned the request away; nothing is changed
      claimTier: async (tierNum) => {
        if (get().claiming === tierNum) return 'busy';
        set({ claiming: tierNum });
        try {
          const result = await callProxy('claimBattlePassTier', { tier: tierNum });
          if (result && Array.isArray(result.claimedTiers)) get().applyServerClaims(result.claimedTiers);
          if (result && (result.status === 'claimed' || result.status === 'already' || result.status === 'locked')) return result.status;
          return 'failed';
        } catch (e) {
          console.warn('[battlePassStore] claimTier error:', e?.message);
          return 'failed';
        } finally {
          if (get().claiming === tierNum) set({ claiming: null });
        }
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

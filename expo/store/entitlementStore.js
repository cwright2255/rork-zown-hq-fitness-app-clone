// store/entitlementStore.js
//
// The person's plan (lib/entitlements.js says what the plans are). It is one document, entitlements/{uid}, that the app can read and
// never write: it is set from the Firebase console now, and by the function that hears from RevenueCat once purchases are connected.
// This store follows it live, so a plan that changes (bought, cancelled, edited by hand) shows up without restarting the app.
//
// The plan is also kept on the phone, with whose it is, so a person who is offline when the app opens still sees what they have, and
// another person signing in here never sees it. What the phone shows is only a convenience: the server decides what a plan allows
// (functions/src/aiQuota.js), reading its own copy of the document.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { plainEntitlement } from '@/lib/entitlements';

let unsubscribeNow = null;

export const useEntitlementStore = create(
  persist(
    (set, get) => ({
      // The plan document as plain data (null: the person has none, which is Free), and whose it is.
      plan: null,
      ownerUid: null,
      // Whose document is being followed right now, and whether the cloud has answered since the app opened.
      uid: null,
      isLoaded: false,
      error: null,

      /** Starts following the person's plan. Safe to call again for the same person. */
      startListening: (uid) => {
        if (!uid) return;
        if (get().uid === uid && unsubscribeNow) return;
        if (unsubscribeNow) unsubscribeNow();
        unsubscribeNow = null;
        // A plan kept for somebody else is not this person's.
        set({ uid, plan: get().ownerUid === uid ? get().plan : null, ownerUid: uid, isLoaded: false, error: null });
        try {
          unsubscribeNow = onSnapshot(
            doc(db, 'entitlements', uid),
            (snap) => {
              // The person may have signed out, or someone else in, while this was on its way.
              if (get().uid !== uid) return;
              set({ plan: snap.exists() ? plainEntitlement(snap.data()) : null, isLoaded: true, error: null });
            },
            (e) => {
              console.warn('[entitlementStore] listen error:', e?.message);
              // Keep the plan the phone has; there is nothing newer to show.
              if (get().uid === uid) set({ isLoaded: true, error: e?.message || 'Could not load your plan.' });
            }
          );
        } catch (e) {
          console.warn('[entitlementStore] startListening error:', e?.message);
          set({ isLoaded: true });
        }
      },

      /** Stops following and forgets the plan (signing out: the next person must not get it). */
      stopListening: () => {
        if (unsubscribeNow) unsubscribeNow();
        unsubscribeNow = null;
        set({ plan: null, ownerUid: null, uid: null, isLoaded: false, error: null });
      },
    }),
    {
      name: 'zown-entitlement-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ plan: state.plan, ownerUid: state.ownerUid }),
      merge: (persisted, current) => {
        // Following has already started: what the cloud (or signing out) said is newer than the copy on the phone.
        if (current.uid) return current;
        return {
          ...current,
          plan: plainEntitlement(persisted && persisted.plan),
          ownerUid: persisted && typeof persisted.ownerUid === 'string' ? persisted.ownerUid : null,
        };
      },
    }
  )
);

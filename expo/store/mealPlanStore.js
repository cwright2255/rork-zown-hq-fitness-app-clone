import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { MEAL_SLOTS } from '@/lib/foodLog';
import {
  MAX_ENTRIES, MAX_PER_SLOT, clampPlanServings, recipeEntry, foodEntry, isValidPlace, slotIsFull,
  newEntryId, pruneEntries, sanitizeEntries, mergeEntries,
} from '@/lib/mealPlan';

// The meal plan: recipes and foods planned for days and meal slots (see
// lib/mealPlan.js). It is kept on the phone and in the cloud (users/{uid}/data/mealPlan),
// like the food diary. Entries from more than 30 days ago are dropped when it is saved.
//
// The actions that add or move an entry return { ok: true, entry } or
// { ok: false, error } so the screen can say what is wrong.

const stamp = () => new Date().toISOString();
const slotName = (id) => MEAL_SLOTS.find((s) => s.id === id).name;

const failure = (error) => ({ ok: false, error });
const NOT_FOUND = 'This item is no longer in your plan.';

// ---- the cloud copy --------------------------------------------------------

let lastSynced = null;
let chain = Promise.resolve();

// Writes the plan as it is NOW; a write that has nothing new to say is skipped.
async function pushPlan(uid) {
  // Sync may have moved on to someone else since this write was queued; it must not touch their plan.
  if (useMealPlanStore.getState().syncUid !== uid) return;
  try {
    const entries = pruneEntries(useMealPlanStore.getState().entries);
    // Firestore refuses `undefined` anywhere in a document, so the copy that is sent has those left out.
    const snapshot = JSON.stringify(entries);
    // A plan that has never had anything in it does not need a document in the cloud.
    if (snapshot === lastSynced || (lastSynced === null && !entries.length)) return;
    await setDoc(doc(db, 'users', uid, 'data', 'mealPlan'), { entries: JSON.parse(snapshot), updatedAt: stamp() });
    lastSynced = snapshot;
  } catch (e) {
    console.warn('[mealPlanStore] sync error:', e?.message);
  }
}

export const useMealPlanStore = create(
  persist(
    (set, get) => {
      const add = (entry) => {
        if (!entry) return failure('Pick a real day and meal.');
        const { entries } = get();
        if (entries.length >= MAX_ENTRIES) return failure('Your meal plan is full. Remove some items to add more.');
        if (slotIsFull(entries, entry.date, entry.slot)) {
          return failure(`${slotName(entry.slot)} already has ${MAX_PER_SLOT} items on that day.`);
        }
        set({ entries: [...entries, entry] });
        return { ok: true, entry };
      };

      const change = (id, update) => {
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...update(e), updatedAt: stamp() } : e)),
        }));
      };

      return {
        entries: [],
        syncUid: null,

        // Merges the plan saved in the cloud into this phone's, then keeps the cloud copy up to date.
        startSync: async (uid) => {
          if (!uid) return;
          // Another person signing in on this phone starts from their own plan, not the last person's.
          if (get().syncUid && get().syncUid !== uid) {
            lastSynced = null;
            set({ entries: [], syncUid: null });
          }
          try {
            const snap = await getDoc(doc(db, 'users', uid, 'data', 'mealPlan'));
            if (snap.exists()) set((state) => ({ entries: mergeEntries(state.entries, snap.data().entries) }));
          } catch (e) {
            console.warn('[mealPlanStore] load error:', e?.message);
          }
          set({ syncUid: uid });
        },

        addRecipe: (recipe, options) => add(recipeEntry(recipe, options)),
        addFood: (food, options) => add(foodEntry(food, options)),

        setServings: (id, servings) => {
          change(id, (e) => ({ ...e, servings: clampPlanServings(servings) }));
        },

        removeEntry: (id) => {
          set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
        },

        // Moves an item to another day and/or meal slot. A logged item stays where it was eaten.
        moveEntry: (id, { date, slot } = {}) => {
          const entry = get().entries.find((e) => e.id === id);
          if (!entry) return failure(NOT_FOUND);
          if (entry.loggedAt) return failure('This one is already logged.');
          if (!isValidPlace(date, slot)) return failure('Pick a real day and meal.');
          if (slotIsFull(get().entries, date, slot, id)) {
            return failure(`${slotName(slot)} already has ${MAX_PER_SLOT} items on that day.`);
          }
          change(id, (e) => ({ ...e, date, slot }));
          return { ok: true, entry: get().entries.find((e) => e.id === id) };
        },

        // A copy of an item on another day and/or meal slot (not logged, even if the original is).
        copyEntry: (id, { date, slot } = {}) => {
          const entry = get().entries.find((e) => e.id === id);
          if (!entry) return failure(NOT_FOUND);
          if (!isValidPlace(date, slot)) return failure('Pick a real day and meal.');
          const { loggedAt, ...rest } = entry;
          return add({ ...rest, id: newEntryId(), date, slot, updatedAt: stamp() });
        },

        // Records that an item has been put in the diary.
        markLogged: (id) => {
          change(id, (e) => ({ ...e, loggedAt: stamp() }));
        },
      };
    },
    {
      name: 'zown-meal-plan-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: pruneEntries(state.entries) }),
      merge: (persisted, current) => ({ ...current, entries: sanitizeEntries(persisted && persisted.entries) }),
    }
  )
);

// Once sync is on, every change to the plan is written to the cloud (one write at a time, in order).
useMealPlanStore.subscribe((state) => {
  if (!state.syncUid) return;
  const uid = state.syncUid;
  chain = chain.then(() => pushPlan(uid));
});

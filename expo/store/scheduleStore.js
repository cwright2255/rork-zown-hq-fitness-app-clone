// store/scheduleStore.js
//
// The calendar: workouts, runs, meals and reminders the person put on their schedule, or the AI coach did after they said yes
// (see lib/calendarEvents.js for what an event is, and how repeats and reminders work). app/calendar.jsx reads it.
//
// It is kept on the phone and in the cloud (users/{uid}/data/calendar), like the meal plan, so a new phone or a reinstall gets
// the calendar back. Events from more than 60 days ago are dropped when it is saved. Reminders are not kept here:
// services/calendarReminders.js sets them from the events, after any change.
//
// The actions that add or change an event return { ok: true, event } or { ok: false, error } so the screen can say what is wrong.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  MAX_EVENTS, buildEvent, mergeEvents, occursOn, pruneEvents, sanitizeEvents, withDone, withoutOccurrence,
} from '@/lib/calendarEvents';
import { localDateKey } from '@/lib/localDate';

const stamp = () => new Date().toISOString();
const failure = (error) => ({ ok: false, error });
const NOT_FOUND = 'This event is no longer on your calendar.';

// ---- the cloud copy --------------------------------------------------------

let lastSynced = null;
let chain = Promise.resolve();

// Writes the calendar as it is NOW; a write that has nothing new to say is skipped.
async function pushCalendar(uid) {
  // Sync may have moved on to someone else since this write was queued; it must not touch their calendar.
  if (useScheduleStore.getState().syncUid !== uid) return;
  try {
    const events = pruneEvents(useScheduleStore.getState().events);
    // Firestore refuses `undefined` anywhere in a document, so the copy that is sent has those left out.
    const snapshot = JSON.stringify(events);
    // A calendar that has never had anything in it does not need a document in the cloud.
    if (snapshot === lastSynced || (lastSynced === null && !events.length)) return;
    await setDoc(doc(db, 'users', uid, 'data', 'calendar'), { events: JSON.parse(snapshot), updatedAt: stamp() });
    lastSynced = snapshot;
  } catch (e) {
    console.warn('[scheduleStore] sync error:', e?.message);
  }
}

export const useScheduleStore = create(
  persist(
    (set, get) => {
      const replace = (id, update) => {
        set((state) => ({ events: state.events.map((e) => (e.id === id ? update(e) : e)) }));
      };

      return {
        events: [],
        // Whose calendar the events on this phone are (kept, so another person signing in here never gets them), and the
        // person the cloud copy is being kept for right now (not kept: sync starts again each time the app opens).
        ownerUid: null,
        syncUid: null,

        // Merges the calendar saved in the cloud into this phone's, then keeps the cloud copy up to date.
        startSync: async (uid) => {
          if (!uid) return;
          // Another person signing in on this phone starts from their own calendar, not the last person's.
          if (get().ownerUid && get().ownerUid !== uid) {
            lastSynced = null;
            set({ events: [], ownerUid: null, syncUid: null });
          }
          try {
            const snap = await getDoc(doc(db, 'users', uid, 'data', 'calendar'));
            if (snap.exists()) set((state) => ({ events: mergeEvents(state.events, snap.data().events) }));
          } catch (e) {
            console.warn('[scheduleStore] load error:', e?.message);
          }
          set({ syncUid: uid, ownerUid: uid });
        },

        // Events the AI coach was allowed to add. Returns the ones that were kept.
        addEvents: (incoming) => {
          const now = stamp();
          const have = new Set(get().events.map((e) => e.id));
          const fresh = sanitizeEvents(
            (incoming || []).map((e) => (e && typeof e === 'object' ? { ...e, updatedAt: e.updatedAt || now } : e))
          ).filter((e) => !have.has(e.id));
          if (fresh.length === 0) return [];
          const next = pruneEvents([...get().events, ...fresh]);
          set({ events: next });
          const kept = new Set(next.map((e) => e.id));
          return fresh.filter((e) => kept.has(e.id));
        },

        // A new event from the form.
        addEvent: (form) => {
          if (get().events.length >= MAX_EVENTS) return failure('Your calendar is full. Remove some events to add more.');
          const result = buildEvent(form);
          if (!result.ok) return result;
          set({ events: [...get().events, result.event] });
          return result;
        },

        // The form's changes to an event. A repeat keeps its first day.
        updateEvent: (id, form) => {
          const previous = get().events.find((e) => e.id === id);
          if (!previous) return failure(NOT_FOUND);
          const wanted = previous.repeat ? { ...form, date: localDateKey(new Date(previous.start)) } : form;
          const result = buildEvent(wanted, { previous });
          if (!result.ok) return result;
          replace(id, () => result.event);
          return result;
        },

        removeEvent: (id) => {
          set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
        },

        // Removes one day of a repeat, or all of an event that is not one.
        skipOccurrence: (id, key) => {
          const event = get().events.find((e) => e.id === id);
          if (!event) return failure(NOT_FOUND);
          const next = withoutOccurrence(event, key, new Date());
          if (next === null) get().removeEvent(id);
          else replace(id, () => next);
          return { ok: true };
        },

        // Ticks a day of an event off, or takes the tick back.
        setOccurrenceDone: (id, key, done) => {
          const event = get().events.find((e) => e.id === id);
          if (!event) return failure(NOT_FOUND);
          if (!occursOn(event, key)) return failure('That day is not on this event.');
          replace(id, (e) => withDone(e, key, !!done, new Date()));
          return { ok: true };
        },
      };
    },
    {
      name: 'zown-schedule-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ events: pruneEvents(state.events), ownerUid: state.ownerUid }),
      // Events saved by earlier versions (no repeat or reminder time) are brought up to the current shape.
      merge: (persisted, current) => ({
        ...current,
        events: sanitizeEvents(persisted && persisted.events),
        ownerUid: persisted && typeof persisted.ownerUid === 'string' ? persisted.ownerUid : null,
      }),
    }
  )
);

// Once sync is on, every change to the calendar is written to the cloud (one write at a time, in order).
useScheduleStore.subscribe((state) => {
  if (!state.syncUid) return;
  const uid = state.syncUid;
  chain = chain.then(() => pushCalendar(uid));
});

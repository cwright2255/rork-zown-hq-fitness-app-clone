// store/scheduleStore.js
//
// The user's calendar events: workouts, runs, meals and reminders they (or
// the AI coach, after the user said yes) put on their schedule. Kept on the
// device with AsyncStorage like store/nutritionStore.js; app/calendar.jsx
// reads it.
//
// Each event: { id, title, kind: 'workout'|'run'|'nutrition'|'other',
//   start (ISO string), notes, workoutId|null, notificationId|null, source }
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEEP_DAYS = 60;

export const useScheduleStore = create(
  persist(
    (set) => ({
      events: [],

      addEvents: (newEvents) => {
        const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
        set((state) => ({
          events: [...state.events, ...(newEvents || [])].filter((e) => {
            const t = new Date(e.start).getTime();
            return !Number.isNaN(t) && t >= cutoff;
          }),
        }));
      },

      removeEvent: (id) => {
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
      },
    }),
    {
      name: 'zown-schedule-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ events: state.events }),
    }
  )
);

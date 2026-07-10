import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useHealthStore = create(
  persist(
    (set, get) => ({
      weight: [],
      measurements: {},
      goals: [],
      hydration: { glasses: 0, target: 8, date: todayStr() },
      meals: [],
      bodyScan: null,
      sleep: { hours: 0, quality: null, date: todayStr() },
      steps: 0,
      isLoading: false,

      /* ── Firestore sync ── */
      loadAllHealth: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'health'));
          if (snap.exists()) {
            const d = snap.data();
            set({
              weight:       d.weight       || [],
              measurements: d.measurements || {},
              goals:        d.goals        || [],
              hydration:    d.hydration    || { glasses: 0, target: 8, date: todayStr() },
              meals:        d.meals        || [],
              bodyScan:     d.bodyScan     || null,
              sleep:        d.sleep        || { hours: 0, quality: null, date: todayStr() },
              steps:        d.steps        || 0,
            });
          }
        } catch (e) {
          console.warn('[healthStore] loadAllHealth error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      _persist: async (uid) => {
        if (!uid) return;
        const s = get();
        try {
          await setDoc(doc(db, 'users', uid, 'data', 'health'), {
            weight: s.weight,
            measurements: s.measurements,
            goals: s.goals,
            hydration: s.hydration,
            meals: s.meals,
            bodyScan: s.bodyScan,
            sleep: s.sleep,
            steps: s.steps,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[healthStore] _persist error:', e?.message);
        }
      },

      /* ── Weight ── */
      logWeight: (value, unit, uid) => {
        const entry = { value, unit: unit || 'lbs', date: new Date().toISOString() };
        set((s) => ({ weight: [...s.weight, entry] }));
        get()._persist(uid);
      },

      /* ── Measurements ── */
      updateMeasurements: (data, uid) => {
        set({ measurements: { ...data, date: new Date().toISOString() } });
        get()._persist(uid);
      },

      /* ── Goals ── */
      addGoal: (goal, uid) => {
        const id = Date.now().toString(36);
        set((s) => ({ goals: [...s.goals, { ...goal, id, startDate: new Date().toISOString() }] }));
        get()._persist(uid);
      },
      updateGoalProgress: (id, current, uid) => {
        set((s) => ({
          goals: s.goals.map(g => g.id === id ? { ...g, current } : g)
        }));
        get()._persist(uid);
      },
      removeGoal: (id, uid) => {
        set((s) => ({ goals: s.goals.filter(g => g.id !== id) }));
        get()._persist(uid);
      },

      /* ── Hydration ── */
      addGlass: (uid) => {
        const today = todayStr();
        set((s) => {
          const h = s.hydration.date === today ? s.hydration : { glasses: 0, target: 8, date: today };
          return { hydration: { ...h, glasses: h.glasses + 1 } };
        });
        get()._persist(uid);
      },
      resetHydration: (uid) => {
        set({ hydration: { glasses: 0, target: 8, date: todayStr() } });
        get()._persist(uid);
      },

      /* ── Meals ── */
      logMeal: (meal, uid) => {
        const entry = { ...meal, id: Date.now().toString(36), timestamp: new Date().toISOString() };
        set((s) => ({ meals: [...s.meals, entry] }));
        get()._persist(uid);
      },

      /* ── Body Scan ── */
      saveBodyScan: (results, uid) => {
        set({ bodyScan: { ...results, date: new Date().toISOString() } });
        get()._persist(uid);
      },

      /* ── Sleep ── */
      logSleep: (hours, quality, uid) => {
        set({ sleep: { hours, quality, date: todayStr() } });
        get()._persist(uid);
      },

      /* ── Steps ── */
      setSteps: (count, uid) => {
        set({ steps: count });
        get()._persist(uid);
      },

      /* ── Computed helpers ── */
      getTodayCalories: () => {
        const today = todayStr();
        return get().meals
          .filter(m => m.timestamp && m.timestamp.startsWith(today))
          .reduce((sum, m) => sum + (m.calories || 0), 0);
      },
      getTodayMacros: () => {
        const today = todayStr();
        const todayMeals = get().meals.filter(m => m.timestamp && m.timestamp.startsWith(today));
        return {
          protein: todayMeals.reduce((s, m) => s + (m.protein || 0), 0),
          carbs:   todayMeals.reduce((s, m) => s + (m.carbs || 0), 0),
          fat:     todayMeals.reduce((s, m) => s + (m.fat || 0), 0),
        };
      },
      getLatestWeight: () => {
        const w = get().weight;
        return w.length > 0 ? w[w.length - 1] : null;
      },
    }),
    {
      name: 'health-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        weight: s.weight,
        measurements: s.measurements,
        goals: s.goals,
        hydration: s.hydration,
        meals: s.meals.slice(-200),
        bodyScan: s.bodyScan,
        sleep: s.sleep,
        steps: s.steps,
      }),
    }
  )
);

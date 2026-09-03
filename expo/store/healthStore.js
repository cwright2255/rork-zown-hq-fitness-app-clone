import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useExpStore } from './expStore';
import { gradeToMealStars } from '@/services/passioService';
import { rookService } from '@/services/rookService';
import { appleHealthService } from '@/services/appleHealthService';

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

      // rookRecovery/stepsHistory/flightsClimbed: destructured by
      // app/hq.jsx. loadRookRecovery/loadAppleHealthActivity below are
      // real implementations against services/rookService.js and
      // services/appleHealthService.js, both of which already existed
      // and worked - stepsHistory itself isn't populated by either
      // function (neither service exposes a historical series, only
      // "today"), so it stays an empty array until something explicitly
      // needs it.
      rookRecovery: null,
      stepsHistory: [],
      flightsClimbed: 0,

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

      // Real, live recovery data. Tries appleHealthService first
      // (faster, on-device, no Cloud Function round trip) - this exact
      // order is what appleHealthService.js's own header comment
      // documents as the intended design ("store/healthStore.js's
      // loadRookRecovery(), which now tries this service first"), not
      // a guess. Falls back to rookService (covers Android, or an iOS
      // user who hasn't granted HealthKit permission but has connected
      // a Rook-supported wearable instead, e.g. Whoop/Oura/Garmin).
      // Both are confirmed to return the same shape (restingHeartRate,
      // hrv, sleepHours, source), so no re-shaping happens here.
      loadRookRecovery: async () => {
        try {
          const appleData = await appleHealthService.getTodayRecovery();
          if (appleData) {
            set({ rookRecovery: appleData });
            return appleData;
          }
        } catch (e) {
          console.warn('[healthStore] appleHealthService.getTodayRecovery failed:', e?.message);
        }

        try {
          const rookData = await rookService.getTodayRecovery();
          set({ rookRecovery: rookData || null });
          return rookData || null;
        } catch (e) {
          console.warn('[healthStore] rookService.getTodayRecovery failed:', e?.message);
          set({ rookRecovery: null });
          return null;
        }
      },

      // Real, live Apple Health activity sync (steps, flights climbed).
      // requestAuthorization is called and awaited before any
      // get/query call - appleHealthService's own docs are explicit
      // that skipping this exact ordering is what crashes this
      // library. uid is optional (hq.jsx's current call site doesn't
      // pass one) - setSteps/awardStepsXp already handle a missing uid
      // safely (no Firestore sync, no crash), so this works either
      // way, but passing the real uid lets Apple-Health-sourced steps
      // sync and award XP through the same path manually-set steps do.
      loadAppleHealthActivity: async (uid) => {
        try {
          const available = await appleHealthService.isAvailable();
          if (!available) return null;

          await appleHealthService.requestAuthorization();
          const activity = await appleHealthService.getTodayActivity();
          if (!activity) return null;

          set({ flightsClimbed: activity.flightsClimbed ?? 0 });
          if (activity.steps != null) {
            get().setSteps(activity.steps, uid);
          }
          return activity;
        } catch (e) {
          console.warn('[healthStore] loadAppleHealthActivity failed:', e?.message);
          return null;
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
        // Real, restored XP award - tier-based, top-up logic lives in
        // expStore.js so it isn't re-implemented here.
        const { hydration } = get();
        useExpStore.getState().awardHydrationXp(hydration.glasses, hydration.target, uid);
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
        // Real XP award, now based on actual nutrient quality where
        // it's known. If this entry carries a real nutritionalScore
        // (set when it came from a food search result - see
        // services/passioService.js's calculateNutritionalScore, which
        // grades A-E using real FDA Daily Value percentages, not
        // arbitrary cutoffs), that grade decides the stars via
        // gradeToMealStars. For entries with no computed grade (manual
        // entries, or a barcode scan that didn't run through scoring),
        // falls back to how complete the entry's real nutrition data is
        // - logging just calories is 3-star, adding any one macro is
        // 4-star, logging all three (protein/carbs/fat) is 5-star. No
        // calories logged at all earns nothing - there's no real
        // nutrition data to reward yet either way. Routed through
        // addExpActivity (type: 'meal') so it correctly feeds
        // expSources.nutrition, the same breakdown workouts already
        // feed via type: 'workout'. Star XP values (33/44/55) are
        // expStore.js's existing mealThreeStar/FourStar/FiveStar,
        // unchanged.
        const hasCalories = entry.calories != null && entry.calories > 0;
        if (hasCalories) {
          let stars;
          if (entry.nutritionalScore?.score) {
            stars = gradeToMealStars(entry.nutritionalScore.score);
          } else {
            const macroCount = [entry.protein, entry.carbs, entry.fat].filter((v) => v != null && v > 0).length;
            stars = macroCount >= 3 ? 5 : macroCount >= 1 ? 4 : 3;
          }
          const baseExp = stars === 5 ? 55 : stars === 4 ? 44 : 33;
          useExpStore.getState().addExpActivity({
            id: entry.id,
            type: 'meal',
            baseExp,
            multiplier: 1.0,
            date: todayStr(),
            description: `Logged ${entry.name || 'a meal'} (${stars}-star)`,
            completed: true,
          }, uid);
        }
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
        // Real, restored XP award - linear, top-up logic lives in
        // expStore.js so it isn't re-implemented here.
        useExpStore.getState().awardStepsXp(count, uid);
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

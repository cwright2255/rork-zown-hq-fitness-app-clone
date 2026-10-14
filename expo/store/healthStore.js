import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useExpStore } from './expStore';
import { rookService } from '@/services/rookService';
import { appleHealthService } from '@/services/appleHealthService';
import { localDateKey, parseDateKey } from '../lib/localDate';

// Today as the person lives it (their own calendar day), not the UTC date, which turns over at 8 PM in New Jersey.
const todayStr = () => localDateKey();

// The step count of each day, {"YYYY-MM-DD": count}, which the Steps card on Home reads its streak, averages and totals
// from (lib/stepsMetrics.js). Nothing used to write it, so the card never had anything to show. A little over a year is kept.
export const STEPS_HISTORY_DAYS = 400;

/** A steps history as it should be held: only real days with a count of 0 or more, the newest STEPS_HISTORY_DAYS of them. Anything else (the empty list this started as, null) is {}. */
export function normalizeStepsHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const days = Object.keys(value)
    .filter((day) => parseDateKey(day) && Number.isFinite(value[day]) && value[day] >= 0)
    .sort()
    .slice(-STEPS_HISTORY_DAYS);
  const out = {};
  for (const day of days) out[day] = value[day];
  return out;
}

/** Two histories as one. For a day in both the larger count wins: a day's steps only add up, so the smaller is the older reading. */
export function mergeStepsHistory(a, b) {
  const left = normalizeStepsHistory(a);
  const right = normalizeStepsHistory(b);
  const out = { ...left };
  for (const day of Object.keys(right)) out[day] = Math.max(out[day] ?? 0, right[day]);
  return normalizeStepsHistory(out);
}

/** The history with one day's count put in, replacing what was there. A count that is not 0 or more leaves it as it was. */
export function withStepsOn(history, day, count) {
  const base = normalizeStepsHistory(history);
  if (!parseDateKey(day) || !Number.isFinite(count) || count < 0) return base;
  return normalizeStepsHistory({ ...base, [day]: count });
}

export const useHealthStore = create(
  persist(
    (set, get) => ({
      // Real fix: weight[]/logWeight/getLatestWeight (previously here)
      // confirmed never called from anywhere reachable - the app's real
      // weight tracking is store/weightLogStore.js (used by
      // app/progress.jsx's own weight history/chart and its "log
      // weight" action), with store/bodyCompositionStore.js's weightKg
      // serving a separate, genuinely different purpose (one input used
      // to derive lean mass from the latest body scan, not a competing
      // weight-history data point). This dead trio, tracking the same
      // metric under a third, unreachable path, was the real source of
      // "which number is real" risk - not the two genuinely different,
      // reachable systems above, which the Firestore rules' own
      // comments already correctly treat as intentional.
      measurements: {},
      goals: [],
      hydration: { glasses: 0, target: 8, date: todayStr() },
      bodyScan: null,
      sleep: { hours: 0, quality: null, date: todayStr() },
      steps: 0,
      // The day (YYYY-MM-DD, the person's own) that `steps` was last set. The count is saved on the phone, so
      // without this a count from another day looks like today's. null for a count saved before this existed.
      stepsDate: null,
      isLoading: false,

      // rookRecovery/stepsHistory/flightsClimbed: destructured by
      // app/hq.jsx. loadRookRecovery/loadAppleHealthActivity below are
      // real implementations against services/rookService.js and
      // services/appleHealthService.js, both of which already existed
      // and worked. Neither service exposes a historical series, only
      // "today", so stepsHistory is built up one day at a time: setSteps
      // files each count under its day ({"YYYY-MM-DD": count}).
      rookRecovery: null,
      stepsHistory: {},
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
              measurements: d.measurements || {},
              goals:        d.goals        || [],
              // Real fix: previously loaded d.hydration as-is with no
              // date check at all, unlike addGlass below (which already
              // resets to 0 when s.hydration.date isn't today) - so
              // yesterday's glass count kept displaying on load until
              // the user happened to tap Add Glass again, which was the
              // only code path that ever checked the date. Same check,
              // applied here too.
              hydration:    (d.hydration && d.hydration.date === todayStr()) ? d.hydration : { glasses: 0, target: 8, date: todayStr() },
              bodyScan:     d.bodyScan     || null,
              sleep:        d.sleep        || { hours: 0, quality: null, date: todayStr() },
              steps:        d.steps        || 0,
              stepsDate:    d.stepsDate    || null,
              // What is saved and what is on this phone, together, plus the last count that was saved with its day.
              stepsHistory: mergeStepsHistory(
                mergeStepsHistory(get().stepsHistory, d.stepsHistory),
                d.stepsDate ? { [d.stepsDate]: d.steps } : {},
              ),
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
            measurements: s.measurements,
            goals: s.goals,
            hydration: s.hydration,
            bodyScan: s.bodyScan,
            sleep: s.sleep,
            steps: s.steps,
            stepsDate: s.stepsDate,
            stepsHistory: s.stepsHistory,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[healthStore] _persist error:', e?.message);
        }
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
        const today = todayStr();
        set((s) => ({ steps: count, stepsDate: today, stepsHistory: withStepsOn(s.stepsHistory, today, count) }));
        // Real, restored XP award - linear, top-up logic lives in
        // expStore.js so it isn't re-implemented here.
        useExpStore.getState().awardStepsXp(count, uid);
        get()._persist(uid);
      },

      /* ── Computed helpers ── */
      // Today's step count, or null when the saved count is from another day (or from before the day was recorded).
      getTodaySteps: () => {
        const { steps, stepsDate } = get();
        return stepsDate === todayStr() && Number.isFinite(steps) ? steps : null;
      },
    }),
    {
      name: 'health-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        measurements: s.measurements,
        goals: s.goals,
        hydration: s.hydration,
        bodyScan: s.bodyScan,
        sleep: s.sleep,
        steps: s.steps,
        stepsDate: s.stepsDate,
        stepsHistory: s.stepsHistory,
      }),
      // The saved days and any already counted in memory go together. A phone that saved its steps before the history
      // existed gets that count, with its day, as the first entry.
      merge: (persisted, current) => {
        const saved = persisted || {};
        return {
          ...current,
          ...saved,
          stepsHistory: mergeStepsHistory(
            mergeStepsHistory(current.stepsHistory, saved.stepsHistory),
            saved.stepsDate ? { [saved.stepsDate]: saved.steps } : {},
          ),
        };
      },
    }
  )
);

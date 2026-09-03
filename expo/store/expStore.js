import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Real, re-tuned leveling curve: 1.03 per level, not 1.3299. The
// original 1.3299 rate, confirmed from an earlier design spreadsheet,
// compounds to an astronomically unreachable Level 100 requirement
// (~5.5 quadrillion XP - verified directly by computing it) at any
// realistic earning rate, so it functions as a cap nobody could ever
// hit. 1.03 was chosen by working backward from a realistic, sustained
// daily XP estimate for an engaged user, built only from sources that
// genuinely, currently award XP (confirmed directly in the codebase -
// workouts via calculateXpReward in app/workout/create.jsx, restored
// hydration and steps XP below): roughly workouts ~171/day averaged
// across a 6-day/week routine, hydration ~100/day, steps ~700/day at a
// realistic 7,000 steps/day, for about 971 XP/day. At that rate, this
// curve puts Level 100 at ~588,000 XP, roughly 20 months of consistent,
// daily engagement - ambitious but genuinely reachable, not a
// mathematical impossibility, while early levels (5 in ~4 days, 10 in
// ~10 days) stay quick and rewarding. Note: meal logging and challenges
// have baseExpValues defined below but nothing in the app currently
// calls them, so they weren't counted toward this estimate - see the
// note where they're defined.
const BASE_LEVEL_XP = 1000;
const GROWTH_RATE = 1.03;
const LEVEL_CAP = 100;

const xpRequiredForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.round(BASE_LEVEL_XP * (Math.pow(GROWTH_RATE, level - 1) - 1) / (GROWTH_RATE - 1));
};

const calculateLevelFromExp = (exp) => {
  let level = 1;
  for (let n = 2; n <= LEVEL_CAP; n++) {
    if (exp >= xpRequiredForLevel(n)) {
      level = n;
    } else {
      break;
    }
  }
  return level;
};

// Generate level requirements using the real curve above, not a flat
// level*1000 line.
const generateLevelRequirements = () => {
  const requirements = {};
  for (let level = 1; level <= LEVEL_CAP; level++) {
    requirements[level] = xpRequiredForLevel(level);
  }
  return requirements;
};

// Default EXP system
const defaultExpSystem = {
  totalExp: 0,
  level: 1,
  expToNextLevel: xpRequiredForLevel(2),
  expSources: {
    workouts: 0,
    nutrition: 0,
    social: 0
  },
  levelRequirements: generateLevelRequirements()
};

// Base EXP values for different activity types.
// Confirmed directly (repo-wide search): mainMission, sideMission,
// sideMissionHike, mealFiveStar/FourStar/ThreeStar, workoutHIIT/MIE/
// LISS, eventWin/Lose, dailyChallenge, weeklyChallenge, and the running
// values below are currently unused - nothing in the app calls
// addExpActivity with these types. Workouts actually award XP via a
// separate, real formula in app/workout/create.jsx
// (calculateXpReward), not these constants. Hydration and steps are
// genuinely wired (awardHydrationXp/awardStepsXp below). Achievements
// award XP via their own xpReward field in store/achievementStore.js,
// also not these constants. Left in place as the values to wire real
// meal/challenge/mission XP awarding to, if that gets built - not
// removed, since the numbers themselves may still be the intended
// design targets.
const baseExpValues = {
  // Updated values based on the provided table
  mainMission: 1125,
  sideMission: 375,
  sideMissionHike: 250,
  mealFiveStar: 55,
  mealFourStar: 44,
  mealThreeStar: 33,
  workoutHIIT: 750,
  workoutMIE: 500,
  workoutLISS: 250,
  eventWin: 500, // Updated from 250 to 500
  eventLose: 100,
  dailyChallenge: 150,
  weeklyChallenge: 250,
  // Running activities
  runningSession: 200,
  runningProgram: 500,
  runningChallenge: 300,
  virtualRace: 750,
  personalBest: 1000,
  // Hydration tiers
  hydrationTier1: 11,
  hydrationTier2: 22,
  hydrationTier3: 33,
  hydrationTier4: 44,
  hydrationTier5: 55,
  // Steps: a real, stated, linear rate (0.10 XP per step) rather than a
  // tiered model - each step is worth this amount directly.
  stepsXpPerStep: 0.10
};

// Calculate multiplier based on level
const calculateMultiplier = (level) => {
  // 43% increase per level, 7% decline per level
  const baseIncrease = 0.43;
  const baseDecline = 0.07;

  // Start with a multiplier of 1 for level 1
  let multiplier = 1.0;

  // Apply the increase and decline for each level
  for (let i = 2; i <= level; i++) {
    multiplier *= 1 + baseIncrease - baseDecline;
  }

  return multiplier;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useExpStore = create(
  persist(
    (set, get) => ({
      expSystem: defaultExpSystem,
      isLoading: false,

      // Real, restored top-up tracking for hydration/steps XP - what
      // tier of hydration, and how many steps' worth of XP, have
      // already been awarded today. Without this, calling
      // awardHydrationXp/awardStepsXp again later the same day (as
      // setSteps/addGlass naturally do, repeatedly, throughout a day)
      // would re-award XP for progress already paid for.
      hydrationXpDate: null,
      hydrationXpTier: 0,
      stepsXpDate: null,
      stepsXpAwardedFor: 0,

      initializeExpSystem: () => {
        set({ expSystem: defaultExpSystem });
      },

      /* ── Firestore sync ── */
      // Real fix: takes the max of remote and local totalExp rather
      // than trusting remote unconditionally - a stale remote read
      // (e.g. right after a local-only award, before the next save
      // completes) must never regress the user's real, current XP
      // backward. level/expToNextLevel are re-derived from the
      // resolved total rather than trusted independently from remote,
      // so they can never end up inconsistent with the actual total.
      loadXP: async (uid) => {
        if (!uid) return;
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'xp'));
          if (snap.exists()) {
            const data = snap.data();
            const { expSystem: localExpSystem } = get();
            const resolvedTotal = Math.max(data.totalExp || 0, localExpSystem?.totalExp || 0);
            const resolvedLevel = calculateLevelFromExp(resolvedTotal);
            set({
              expSystem: {
                ...localExpSystem,
                totalExp: resolvedTotal,
                level: resolvedLevel,
                expToNextLevel: xpRequiredForLevel(resolvedLevel + 1) - resolvedTotal,
                expSources: data.expSources || localExpSystem?.expSources || { workouts: 0, nutrition: 0, social: 0 },
              },
              hydrationXpDate: data.hydrationXpDate || get().hydrationXpDate,
              hydrationXpTier: data.hydrationXpDate === todayStr() ? (data.hydrationXpTier || 0) : get().hydrationXpTier,
              stepsXpDate: data.stepsXpDate || get().stepsXpDate,
              stepsXpAwardedFor: data.stepsXpDate === todayStr() ? (data.stepsXpAwardedFor || 0) : get().stepsXpAwardedFor,
            });
          }
        } catch (e) {
          console.warn('[expStore] loadXP error:', e?.message);
        }
      },

      saveXP: async (uid) => {
        if (!uid) return;
        const s = get();
        try {
          await setDoc(doc(db, 'users', uid, 'data', 'xp'), {
            totalExp: s.expSystem.totalExp,
            level: s.expSystem.level,
            expToNextLevel: s.expSystem.expToNextLevel,
            expSources: s.expSystem.expSources,
            hydrationXpDate: s.hydrationXpDate,
            hydrationXpTier: s.hydrationXpTier,
            stepsXpDate: s.stepsXpDate,
            stepsXpAwardedFor: s.stepsXpAwardedFor,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[expStore] saveXP error:', e?.message);
        }
      },

      // Real fix: fully synchronous now - the requestAnimationFrame
      // deferral this had regressed back to is exactly what caused
      // totalExp/expToNextLevel to desync (a second addExp call could
      // read stale state before the first call's deferred update had
      // actually applied). uid, when provided, triggers a real
      // Firestore sync via saveXP so XP awarded here isn't local-only.
      addExp: (amount, uid) => {
        const { expSystem } = get();
        const newTotalExp = expSystem.totalExp + amount;
        const newLevel = calculateLevelFromExp(newTotalExp);
        const expToNextLevel = xpRequiredForLevel(newLevel + 1) - newTotalExp;

        set({
          expSystem: {
            ...expSystem,
            totalExp: newTotalExp,
            level: newLevel,
            expToNextLevel
          }
        });

        if (uid) get().saveXP(uid);
      },

      addExpActivity: (activity, uid) => {
        const { expSystem } = get();
        const { level } = expSystem;

        // Calculate the multiplier based on the current level
        const levelMultiplier = calculateMultiplier(level);

        // Apply the multiplier to the base EXP
        let expAmount = activity.baseExp * levelMultiplier * activity.multiplier;

        // Round to the nearest integer
        expAmount = Math.round(expAmount);

        // Update the EXP sources
        const updatedExpSources = { ...expSystem.expSources };

        switch (activity.type) {
          case 'workout':
          case 'running':
            updatedExpSources.workouts += expAmount;
            break;
          case 'meal':
            updatedExpSources.nutrition += expAmount;
            break;
          case 'event':
            updatedExpSources.social += expAmount;
            break;
        }

        // Update the EXP system
        set({
          expSystem: {
            ...expSystem,
            expSources: updatedExpSources
          }
        });

        // Add the EXP to the total
        get().addExp(expAmount, uid);
      },

      // Real, restored hydration XP - tier-based (5 tiers across the
      // day's target), top-up logic so re-calling this later the same
      // day (addGlass calls it on every glass) only ever pays for
      // newly-reached tiers, never re-pays for progress already
      // awarded. If a jump skips more than one tier at once (e.g. a
      // big Apple Health sync), every newly-crossed tier's XP is
      // awarded, not just the final one landed on.
      awardHydrationXp: (glasses, target, uid) => {
        const state = get();
        const today = todayStr();
        const alreadyTier = state.hydrationXpDate === today ? (state.hydrationXpTier || 0) : 0;

        const TIER_XP = [0, baseExpValues.hydrationTier1, baseExpValues.hydrationTier2, baseExpValues.hydrationTier3, baseExpValues.hydrationTier4, baseExpValues.hydrationTier5];
        const pct = target > 0 ? glasses / target : 0;
        const currentTier = Math.min(5, Math.floor(pct * 5));

        if (currentTier > alreadyTier) {
          let xpToAward = 0;
          for (let t = alreadyTier + 1; t <= currentTier; t++) xpToAward += TIER_XP[t];
          get().addExp(xpToAward, uid);
        }
        set({ hydrationXpDate: today, hydrationXpTier: Math.max(alreadyTier, currentTier) });
      },

      // Real, live steps XP - each step is worth 0.10 XP (a real,
      // stated design value), a linear model rather than the tiered one
      // hydration uses. Top-up logic here works the same way: tracks
      // how many steps' worth of XP have already been paid out today,
      // so setSteps/health-sync calling this repeatedly throughout the
      // day (as the device's real step count naturally rises) only
      // ever pays for the genuinely new steps since the last award.
      awardStepsXp: (steps, uid) => {
        const state = get();
        const today = todayStr();
        const alreadyAwardedFor = state.stepsXpDate === today ? (state.stepsXpAwardedFor || 0) : 0;

        const newSteps = Math.max(0, steps - alreadyAwardedFor);
        if (newSteps > 0) {
          const xpToAward = Math.round(newSteps * baseExpValues.stepsXpPerStep * 100) / 100;
          get().addExp(xpToAward, uid);
        }
        set({ stepsXpDate: today, stepsXpAwardedFor: Math.max(alreadyAwardedFor, steps) });
      },

      // Real getter, matching the getLevel()/getExpToNextLevel()
      // pattern below - screens should read XP through this, not by
      // destructuring totalExp directly (it doesn't exist at the store's
      // top level, only nested under expSystem.totalExp; a direct
      // destructure is always undefined).
      getTotalExp: () => {
        const { expSystem } = get();
        return (expSystem || defaultExpSystem).totalExp;
      },

      getExpBreakdown: () => {
        const { expSystem } = get();
        const safeExpSystem = expSystem || defaultExpSystem;
        return {
          mainMissions: 0,
          sideMissions: 0,
          meals: safeExpSystem.expSources.nutrition,
          workouts: safeExpSystem.expSources.workouts,
          running: 0, // Will be calculated from workout activities
          events: safeExpSystem.expSources.social,
          total: safeExpSystem.totalExp
        };
      },

      getExpForLevel: (level) => {
        return xpRequiredForLevel(level);
      },

      getExpToNextLevel: () => {
        const { expSystem } = get();
        const safeExpSystem = expSystem || defaultExpSystem;
        return safeExpSystem.expToNextLevel;
      },

      getLevel: () => {
        const { expSystem } = get();
        const safeExpSystem = expSystem || defaultExpSystem;
        return safeExpSystem.level;
      },

      getRecentActivities: (count = 10) => {
        // Return empty array for now - would be implemented with activity tracking
        return [];
      },

      calculateLevelFromExp: (exp) => calculateLevelFromExp(exp)
    }),
    {
      name: 'zown-exp-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        expSystem: state.expSystem,
        hydrationXpDate: state.hydrationXpDate,
        hydrationXpTier: state.hydrationXpTier,
        stepsXpDate: state.stepsXpDate,
        stepsXpAwardedFor: state.stepsXpAwardedFor
      }),
      onRehydrateStorage: () => (state) => {
        // When storage is rehydrated, initialize the EXP system if needed
        if (state && (!state.expSystem || !state.expSystem.levelRequirements)) {
          useExpStore.getState().initializeExpSystem();
        }
      }
    }
  )
);

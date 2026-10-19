import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { localDateKey } from '../lib/localDate';
import {
  LEVEL_CAP, MAX_STEPS_PER_DAY, applyClaim, emptyLedger, levelFromXp, levelMultiplier, normalizeLedger, xpRequiredForLevel,
} from '../lib/xpRules';
import { claimFromActivity, hydrationClaim, importClaim, stepsClaim } from '../lib/xpClaims';

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
// The curve itself (1.03 per level, 1,000 XP for level 2, level 100 the cap) and the level multiplier live in lib/xpRules.js, which
// the server uses too: XP is worked out there now, and this store follows it. Same numbers, same names here as before.
const calculateLevelFromExp = levelFromXp;

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
export const baseExpValues = {
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

// The level multiplier (3.6% more for each level, never above x5) is lib/xpRules.js's levelMultiplier. Its history: the rates were
// once 0.43/0.07, a 10x decimal-place slip that made one ~200 XP workout pay ~37,000 XP by level 18; they were fixed to 0.043/0.007
// and capped, and nothing about that has changed.
const calculateMultiplier = levelMultiplier;

// Today as the person lives it (their own calendar day), not the UTC date.
const todayStr = () => localDateKey();

// ---- the server's record of XP ----
// XP is worked out by the server now (functions/src/xpLedger.js, rules in lib/xpRules.js). When something earns XP this store files
// a claim (lib/xpClaims.js) under the person's account, and follows the ledger the server keeps (users/{uid}/stats/xp, heard
// through services/xpSync.js). What is shown is the ledger as the server last said it, plus every claim still on its way, worked out
// with the same rules (applyClaim), so the XP counts up the moment it is earned and settles on the server's number.
const STEPS_CLAIM_CHUNK = 500; // steps XP is claimed in steps of this many, not on every step
const PENDING_MAX_AGE_MS = 14 * 86400000; // a claim the server has not dealt with in two weeks is given up on (once it has been heard from)
const OWN_IMPORT_AGE_DAYS = 100000; // the phone takes its own word for how much XP it had before the server kept the record
const sending = new Set(); // ids of the claims being sent right now

// A ledger with one more claim added, the way the server will add it.
const replay = (ledger, claim, now) => applyClaim({
  ledger,
  id: claim.id,
  claim: claim.body,
  now,
  ageDays: claim.body.kind === 'import' ? OWN_IMPORT_AGE_DAYS : 0,
});

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
      // Real, new: tracks which specific foods (by name) have already
      // earned meal XP today. Deliberately not the same "high-water
      // mark, award only the delta" shape hydration/steps use above -
      // those are cumulative daily totals where that fits, but meals
      // are discrete events where logging breakfast, lunch, and dinner
      // should each earn XP independently. What needed guarding was
      // specifically the same food being logged repeatedly to farm XP
      // - this lets every genuinely different food still earn XP
      // normally, while a repeat of the same food today earns nothing
      // after the first time.
      mealXpDate: null,
      mealXpFoodKeys: [],

      // Real, new: tracks XP earned specifically today, separate from
      // expSystem.totalExp's lifetime cumulative value. Accumulated
      // inside addExp itself (below) rather than duplicated at each of
      // its individual callers (addExpActivity, awardHydrationXp,
      // awardStepsXp, awardMealXp all route through it eventually), so
      // this captures every XP source in one place. Resets when the
      // date changes, same top-up-protected shape as the other
      // per-day XP fields above.
      dailyXp: 0,
      dailyXpDate: null,

      // Real, new: per-day XP totals ({date: amount}), accumulated
      // alongside dailyXp in addExp below but never reset - this is
      // what powers the Total XP widget's real "7-Day XP Earnings"
      // chart (lib/xpMetrics.js), previously hardcoded fake data.
      // Mirrors store/healthStore.js's stepsHistory shape. Local-only
      // (AsyncStorage via this store's own persist middleware below) -
      // deliberately not synced to Firestore like dailyXp/dailyXpDate
      // are, to keep this fix scoped; worth revisiting if XP history
      // ever needs to be consistent across multiple devices for the
      // same account.
      xpHistory: {},

      // The server's ledger as it last said it (null until it has), and the claims filed or waiting to be filed that it does not
      // include yet: [{ id, uid, body, at, sent }]. What is on screen is the first with the second added (_show below).
      serverLedger: null,
      pendingClaims: [],
      // Whose XP this phone holds (kept, so another person signing in here starts clean), and whose ledger is being followed right
      // now (not kept: it starts again each time the app opens).
      ownerUid: null,
      syncUid: null,
      // The one-off claim that brings in the XP this phone had before the server kept the record has been made.
      importQueued: false,

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
        // Once the server's ledger is being followed it is the record; what was saved in the old per-user document is not.
        if (get().syncUid === uid) return;
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
              mealXpDate: data.mealXpDate || get().mealXpDate,
              mealXpFoodKeys: data.mealXpDate === todayStr() ? (data.mealXpFoodKeys || []) : get().mealXpFoodKeys,
              dailyXpDate: data.dailyXpDate || get().dailyXpDate,
              dailyXp: data.dailyXpDate === todayStr() ? (data.dailyXp || 0) : get().dailyXp,
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
            mealXpDate: s.mealXpDate,
            mealXpFoodKeys: s.mealXpFoodKeys,
            dailyXpDate: s.dailyXpDate,
            dailyXp: s.dailyXp,
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

        const today = todayStr();
        const state = get();
        const currentDailyXp = state.dailyXpDate === today ? state.dailyXp : 0;
        const updatedXpHistory = {
          ...state.xpHistory,
          [today]: (state.xpHistory?.[today] || 0) + amount,
        };

        set({
          expSystem: {
            ...expSystem,
            totalExp: newTotalExp,
            level: newLevel,
            expToNextLevel
          },
          dailyXp: currentDailyXp + amount,
          dailyXpDate: today,
          xpHistory: updatedXpHistory,
        });

        if (uid) get().saveXP(uid);
      },

      /* ── The server's record (see the note at the top of this file) ── */

      // The ledger as it will be once every claim still waiting has been added: what to show.
      _predicted: () => {
        const { serverLedger, pendingClaims, syncUid } = get();
        const now = Date.now();
        let ledger = serverLedger;
        for (const claim of pendingClaims) {
          if (claim.uid === syncUid) ledger = replay(ledger, claim, now).ledger;
        }
        return ledger ? normalizeLedger(ledger) : emptyLedger();
      },

      // Puts that on screen: the total, level, today's XP and the per-day history.
      _show: () => {
        const state = get();
        if (!state.syncUid) return;
        const predicted = state._predicted();
        const today = todayStr();
        const total = predicted.total;
        const level = calculateLevelFromExp(total);
        const history = { ...state.xpHistory };
        Object.keys(predicted.days).forEach((day) => {
          const entry = predicted.days[day];
          history[day] = entry && Number.isFinite(entry.xp) ? entry.xp : 0;
        });
        const todayEntry = predicted.days[today];
        set({
          expSystem: {
            ...state.expSystem,
            totalExp: total,
            level,
            expToNextLevel: xpRequiredForLevel(level + 1) - total,
          },
          dailyXp: todayEntry && Number.isFinite(todayEntry.xp) ? todayEntry.xp : 0,
          dailyXpDate: today,
          xpHistory: history,
        });
      },

      // Files a claim for XP. Returns { queued, amount }: whether it was kept to be sent (the server would refuse one the ledger
      // already shows, such as the same food twice in a day, so that is not), and what it will be worth.
      _file: (uid, claim) => {
        if (!uid || !claim) return { queued: false, amount: 0 };
        const state = get();
        if (state.pendingClaims.some((c) => c.id === claim.id)) return { queued: false, amount: 0 };
        if (state.serverLedger && state.serverLedger.ids && state.serverLedger.ids.includes(claim.id)) return { queued: false, amount: 0 };
        let amount = 0;
        if (state.syncUid === uid) {
          const { outcome } = replay(state._predicted(), claim, Date.now());
          if (outcome.status !== 'awarded') return { queued: false, amount: 0 };
          amount = outcome.amount;
        }
        set({ pendingClaims: [...state.pendingClaims, { id: claim.id, uid, body: claim.body, at: Date.now(), sent: false }] });
        get()._show();
        get().flushClaims(uid).catch(() => undefined);
        return { queued: true, amount };
      },

      // Sends the claims that have not been sent. A claim is created once and never changed (the rules), so one that is already
      // there (sent before, and the answer was lost) is found and not sent again. A failure is tried again at the next chance.
      flushClaims: async (uid) => {
        if (!uid) return;
        const waiting = get().pendingClaims.filter((c) => c.uid === uid && !c.sent && !sending.has(c.id));
        for (const claim of waiting) {
          sending.add(claim.id);
          try {
            const ref = doc(db, 'users', uid, 'xpClaims', claim.id);
            try {
              await setDoc(ref, claim.body);
              set((state) => ({ pendingClaims: state.pendingClaims.map((c) => (c.id === claim.id ? { ...c, sent: true } : c)) }));
            } catch (e) {
              const snap = await getDoc(ref);
              if (!snap.exists()) throw e;
              if (snap.data() && snap.data().processedAt) {
                // Counted already: the ledger has it.
                set((state) => ({ pendingClaims: state.pendingClaims.filter((c) => c.id !== claim.id) }));
              } else {
                set((state) => ({ pendingClaims: state.pendingClaims.map((c) => (c.id === claim.id ? { ...c, sent: true } : c)) }));
              }
              get()._show();
            }
          } catch (e) {
            console.warn('[expStore] claim not sent yet:', e?.message);
          } finally {
            sending.delete(claim.id);
          }
        }
      },

      // Starts following this person's XP: keeps what is on the phone only if it is theirs, brings in the XP the phone had from before
      // the server kept the record (once), and sends what is waiting. activeDays are the days with a workout, a run or a hike, so the
      // streak carries over with it.
      beginXpSync: (uid, { activeDays = [] } = {}) => {
        if (!uid) return;
        const state = get();
        if (state.ownerUid && state.ownerUid !== uid) {
          // Another person signing in on this phone starts from their own XP, not the last person's.
          set({
            expSystem: defaultExpSystem,
            serverLedger: null,
            importQueued: false,
            hydrationXpDate: null, hydrationXpTier: 0, stepsXpDate: null, stepsXpAwardedFor: 0, mealXpDate: null, mealXpFoodKeys: [],
            dailyXp: 0, dailyXpDate: null, xpHistory: {},
          });
        }
        set({ ownerUid: uid, syncUid: uid });
        if (!get().importQueued) {
          const total = get().expSystem.totalExp;
          set({ importQueued: true });
          if (total > 0) get()._file(uid, importClaim({ day: todayStr(), total, activeDays }));
        }
        get()._show();
        get().flushClaims(uid).catch(() => undefined);
      },

      endXpSync: () => {
        set({ syncUid: null });
      },

      // The server's ledger changed (data is null when it has none yet): follow it, and stop waiting for the claims it has dealt with.
      applyLedger: (uid, data) => {
        const state = get();
        if (!uid || state.syncUid !== uid) return;
        const ledger = data ? normalizeLedger(data) : null;
        const dealtWith = new Set((ledger && ledger.ids) || []);
        const now = Date.now();
        const pendingClaims = state.pendingClaims.filter((c) => {
          if (c.uid !== uid) return true;
          if (dealtWith.has(c.id)) return false;
          return !(ledger && now - c.at > PENDING_MAX_AGE_MS);
        });
        set({ serverLedger: ledger, pendingClaims });
        get()._show();
        get().flushClaims(uid).catch(() => undefined);
      },

      addExpActivity: (activity, uid) => {
        // With a person signed in the XP is the server's: the activity becomes a claim, and what it is worth comes from the ledger.
        if (uid) {
          get()._file(uid, claimFromActivity(activity));
          return;
        }

        // Nobody signed in: counted on the phone alone, as it always was.
        const { expSystem } = get();
        const { level } = expSystem;

        // Calculate the multiplier based on the current level
        const multiplierForLevel = calculateMultiplier(level);

        // Apply the multiplier to the base EXP
        let expAmount = activity.baseExp * multiplierForLevel * activity.multiplier;

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

        // With a person signed in, reaching a tier is a claim; the ledger knows which tiers today have been paid.
        if (uid) {
          const reached = target > 0 ? Math.min(5, Math.floor((glasses / target) * 5)) : 0;
          if (reached >= 1) get()._file(uid, hydrationClaim(today, reached));
          return;
        }

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

        // With a person signed in, the steps counted so far are a claim, made each time they have gone up by a chunk; the ledger
        // knows how many of today's steps have been paid.
        if (uid) {
          const counted = Math.min(MAX_STEPS_PER_DAY, Math.floor(Number(steps)));
          if (!(counted >= 1)) return;
          const paid = state.syncUid === uid ? ((state._predicted().days[today] || {}).steps || 0) : 0;
          if (counted - paid >= STEPS_CLAIM_CHUNK) get()._file(uid, stepsClaim(today, counted));
          return;
        }

        const alreadyAwardedFor = state.stepsXpDate === today ? (state.stepsXpAwardedFor || 0) : 0;

        const newSteps = Math.max(0, steps - alreadyAwardedFor);
        if (newSteps > 0) {
          const xpToAward = Math.round(newSteps * baseExpValues.stepsXpPerStep * 100) / 100;
          get().addExp(xpToAward, uid);
        }
        set({ stepsXpDate: today, stepsXpAwardedFor: Math.max(alreadyAwardedFor, steps) });
      },

      // Real, new: guards against logging the same food repeatedly to
      // farm XP (previously nutritionStore.js's addFoodToMeal awarded
      // baseExp unconditionally on every call, with no protection at
      // all - 50 logs of the same food meant 50x the XP). foodKey is
      // the food's name, normalized (lowercased, trimmed) so trivial
      // casing/whitespace differences can't bypass this. Only the
      // first time a given food is logged each day earns XP - logging
      // it again today (or logging any other, different food) still
      // works normally, since the point is stopping repeat-farming of
      // one food, not capping how many distinct meals can earn XP in a
      // day. Returns whether XP was actually awarded, so the caller
      // can show accurate feedback either way.
      awardMealXp: (foodKey, activity, uid) => {
        const state = get();
        const today = todayStr();

        // With a person signed in, a food logged is a claim; the ledger knows which foods today have been paid.
        if (uid) {
          return get()._file(uid, claimFromActivity({ ...activity, kind: 'meal', foodKey })).queued;
        }

        const alreadyAwarded = state.mealXpDate === today ? (state.mealXpFoodKeys || []) : [];

        if (alreadyAwarded.includes(foodKey)) {
          return false;
        }
        // Passes the same activity object nutritionStore.js already
        // builds straight through to addExpActivity unchanged - this
        // only gates whether that existing call happens, it doesn't
        // change how much XP it awards or the level multiplier/activity
        // description it already applies.
        get().addExpActivity(activity, uid);
        set({ mealXpDate: today, mealXpFoodKeys: [...alreadyAwarded, foodKey] });
        return true;
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

      // Real, new: date-aware like the load logic above - returns 0
      // rather than a stale, leftover value if dailyXpDate isn't today
      // (nothing awarded yet today, so the raw dailyXp field could still
      // hold yesterday's number until the next award resets it).
      getDailyExp: () => {
        const state = get();
        return state.dailyXpDate === todayStr() ? state.dailyXp : 0;
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
        stepsXpAwardedFor: state.stepsXpAwardedFor,
        mealXpDate: state.mealXpDate,
        mealXpFoodKeys: state.mealXpFoodKeys,
        dailyXpDate: state.dailyXpDate,
        dailyXp: state.dailyXp,
        xpHistory: state.xpHistory,
        serverLedger: state.serverLedger,
        pendingClaims: state.pendingClaims,
        ownerUid: state.ownerUid,
        importQueued: state.importQueued
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

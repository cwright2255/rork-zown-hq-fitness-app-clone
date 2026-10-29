// lib/logOut.js
//
// What "Log Out" does. Both Log Out buttons (the Profile page and Settings) call this one function, so the two cannot drift apart.
// When it has finished, nothing of the person is left on the phone, in memory or in storage, and nothing has been sent to the cloud:
//
//   1. Sign out: remove the saved sign-in (services/authService.js) and sign out of Firebase.
//   2. Disconnect Spotify and Apple Music.
//   3. Reset every store in memory to its starting state (LOG_OUT_STORES), stopping the live listeners a store holds first.
//   4. Write out what the hike store was still waiting to save, so it cannot reappear later.
//   5. Remove every key the app saved on the phone (LOG_OUT_KEYS, and the keys that start with LOG_OUT_KEY_PREFIXES).
//
// The order matters. Several stores write the whole of what the phone holds to the cloud document of whoever is signed in (the run
// store does this for every run on the phone, store/runningStore.js). If a store were reset while someone was still signed in, the
// empty state could be written over their real data. So the reset comes after sign-out, and a reset puts back the starting state in
// one step, which also sets each store's "keep this account in sync" id back to nothing; the stores that save on every change stop
// there. Nothing in here writes to Firestore, and __tests__/logOut.test.js fails if anything does.
//
// Resetting a store also saves the (empty) result to the phone, so the keys are removed last, or they would come back.
//
// It finishes before the screen changes, so closing the app a moment after logging out cannot catch it half done. It never throws:
// each part is tried on its own, so one that fails does not stop the others.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/authService';
import { CACHE_KEY_PREFIX } from '@/lib/recipeCache';
import { HISTORY_KEY_PREFIX } from '@/lib/recipeHistory';
import { useAchievementStore } from '@/store/achievementStore';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { useAppleMusicStore } from '@/store/appleMusicStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useBattlePassStore } from '@/store/battlePassStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { useCalendarInviteStore } from '@/store/calendarInviteStore';
import { useChallengeStore } from '@/store/challengeStore';
import { useCommunityStore } from '@/store/communityStore';
import { useDuelStore } from '@/store/duelStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { useExerciseStore } from '@/store/exerciseStore';
import { useExpStore } from '@/store/expStore';
import { useGoalsStore } from '@/store/goalsStore';
import { useGroupStore } from '@/store/groupStore';
import { useHealthStore } from '@/store/healthStore';
import { useHikingStore } from '@/store/hikingStore';
import { useHomeWidgetsStore } from '@/store/homeWidgetsStore';
import { useLeaderboardStore } from '@/store/leaderboardStore';
import { useLifetimeStore } from '@/store/lifetimeStore';
import { useMealPlanStore } from '@/store/mealPlanStore';
import { useMessagingStore } from '@/store/messagingStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useOfflineTrailStore } from '@/store/offlineTrailStore';
import { useRecipeStore, STORAGE_KEYS as RECIPE_KEYS } from '@/store/recipeStore';
import { useRunTrackerStore, flushRunTracker } from '@/store/runTrackerStore';
import { useRunningStore } from '@/store/runningStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useShopStore } from '@/store/shopStore';
import { useSocialGraphStore } from '@/store/socialGraphStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { useTrainingFeedbackStore } from '@/store/trainingFeedbackStore';
import { useUserStore } from '@/store/userStore';
import { useVirtualChallengeStore } from '@/store/virtualChallengeStore';
import { useVirtualRaceStore } from '@/store/virtualRaceStore';
import { useWeightLogStore } from '@/store/weightLogStore';
import { useWorkoutStore } from '@/store/workoutStore';

/**
 * Every store in memory, by its file name in store/. A store added to store/ has to be added here too:
 * __tests__/logOut.test.js fails until it is.
 */
export const LOG_OUT_STORES = {
  achievementStore: useAchievementStore,
  analyticsStore: useAnalyticsStore,
  appleMusicStore: useAppleMusicStore,
  badgeStore: useBadgeStore,
  battlePassStore: useBattlePassStore,
  bodyCompositionStore: useBodyCompositionStore,
  calendarInviteStore: useCalendarInviteStore,
  challengeStore: useChallengeStore,
  communityStore: useCommunityStore,
  duelStore: useDuelStore,
  entitlementStore: useEntitlementStore,
  exerciseStore: useExerciseStore,
  expStore: useExpStore,
  goalsStore: useGoalsStore,
  groupStore: useGroupStore,
  healthStore: useHealthStore,
  hikingStore: useHikingStore,
  homeWidgetsStore: useHomeWidgetsStore,
  leaderboardStore: useLeaderboardStore,
  lifetimeStore: useLifetimeStore,
  mealPlanStore: useMealPlanStore,
  messagingStore: useMessagingStore,
  nutritionStore: useNutritionStore,
  offlineTrailStore: useOfflineTrailStore,
  recipeStore: useRecipeStore,
  runTrackerStore: useRunTrackerStore,
  runningStore: useRunningStore,
  scheduleStore: useScheduleStore,
  settingsStore: useSettingsStore,
  shopStore: useShopStore,
  socialGraphStore: useSocialGraphStore,
  spotifyStore: useSpotifyStore,
  trainingFeedbackStore: useTrainingFeedbackStore,
  userStore: useUserStore,
  virtualChallengeStore: useVirtualChallengeStore,
  virtualRaceStore: useVirtualRaceStore,
  weightLogStore: useWeightLogStore,
  workoutStore: useWorkoutStore,
};

/**
 * Every key the app saves on the phone, each removed on log out. This list replaces the filter that used to be in store/userStore.js
 * (it matched on "zown-", "user" and "auth" in a key's name, which missed most of these). __tests__/logOut.test.js fails when a store
 * saves under a name that is not here.
 */
export const LOG_OUT_KEYS = [
  // The sign-in (services/authService.js)
  'auth_token',
  'auth_token_issued_at',
  // The saved copy of each store (the name each one gives zustand's persist)
  'running-storage',
  'health-storage',
  'workout-storage',
  'hiking-storage',
  'settings-storage',
  'apple-music-storage',
  'spotify-storage',
  'offline-trails',
  'zown-user-storage',
  'zown-achievement-storage',
  'zown-badge-storage',
  'zown-battlepass-storage',
  'zown-entitlement-storage',
  'zown-exp-storage',
  'zown-lifetime-storage',
  'zown-meal-plan-storage',
  'zown-nutrition-storage',
  'zown-run-tracker',
  'zown-schedule-storage',
  'zown-shop-storage',
  'zown-social-graph',
  'zown-training-feedback-storage',
  'zown-virtual-journeys',
  'zown-virtual-races',
  // Saved recipes and the grocery list (store/recipeStore.js)
  RECIPE_KEYS.RECIPES,
  RECIPE_KEYS.GROCERY_LIST,
  // Spotify's tokens, and what it keeps while connecting (services/spotifyService.js)
  'spotify_access_token',
  'spotify_refresh_token',
  'spotify_token_expires_at',
  'spotify_is_client_credentials',
  'spotify_last_device_id',
  'spotify_code_verifier',
  'spotify_auth_state',
  'spotify_auth_redirect_uri',
  // Apple Music (services/appleMusicService.ios.js)
  'apple_music_authorized',
  // What the AI wrote for this person (lib/todayBrief.js, services/insightService.js)
  'zown-brief-cache',
  'zown-insight-cache',
  // The body scan's spoken-prompts switch (services/voiceGuidanceService.js)
  'zown:bodyScan:voiceGuidanceEnabled',
];

/** Keys that are one per account, so the key itself ends with the account's id: all of them are removed. */
export const LOG_OUT_KEY_PREFIXES = [CACHE_KEY_PREFIX, HISTORY_KEY_PREFIX];

const warn = (what, e) => console.warn(`[logOut] ${what}:`, e?.message);

// The stores that follow the cloud hold the handle that stops each listener in their state. A reset would drop the handle and leave
// the listener running, so they are stopped first.
function stopListeners(store) {
  const state = store.getState();
  Object.keys(state).forEach((key) => {
    if (!/^_.*unsubscribe$/i.test(key) || typeof state[key] !== 'function') return;
    try {
      state[key]();
    } catch (e) {
      warn(`could not stop ${key}`, e);
    }
  });
}

// Puts a store back to the state it was created with, in one step (the state is replaced, not merged, so nothing is left over).
function resetStore(store) {
  stopListeners(store);
  store.setState(store.getInitialState(), true);
}

async function removeSavedKeys() {
  let keys = [...LOG_OUT_KEYS];
  try {
    const all = await AsyncStorage.getAllKeys();
    keys = keys.concat((all || []).filter((k) => LOG_OUT_KEY_PREFIXES.some((p) => typeof k === 'string' && k.startsWith(p))));
  } catch (e) {
    warn('could not look for the keys saved per account', e);
  }
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (e) {
    warn('could not remove the saved keys together, removing them one by one', e);
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k).catch((err) => warn(`could not remove ${k}`, err))));
  }
}

export async function logOut() {
  // 1. Sign out first: from here on, no store has an account to write to.
  try {
    await authService.logout();
  } catch (e) {
    warn('could not clear the saved sign-in', e);
  }

  // 2. Spotify and Apple Music stop their own listeners, timers and tokens.
  try {
    await useSpotifyStore.getState().disconnectSpotify();
  } catch (e) {
    warn('could not disconnect Spotify', e);
  }
  try {
    await useAppleMusicStore.getState().disconnectAppleMusic();
  } catch (e) {
    warn('could not disconnect Apple Music', e);
  }

  // 3. Every store back to its starting state.
  Object.entries(LOG_OUT_STORES).forEach(([name, store]) => {
    try {
      resetStore(store);
    } catch (e) {
      warn(`could not reset ${name}`, e);
    }
  });

  // 4. The hike store saves a few seconds after a change, not at once: write what is waiting now, so it cannot appear after the keys are gone.
  try {
    flushRunTracker();
  } catch (e) {
    warn('could not finish saving the hike store', e);
  }

  // 5. Last, the saved keys.
  try {
    await removeSavedKeys();
  } catch (e) {
    warn('could not remove the saved keys', e);
  }
}

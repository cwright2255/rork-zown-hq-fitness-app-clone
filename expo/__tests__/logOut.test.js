// lib/logOut.js: what Log Out does. When it has finished, nothing of the person is left on the phone (in memory or in storage) and nothing
// has been sent to the cloud. These use the real authService and the real stores, with a phone's storage held in memory and a small
// stand-in for Firestore that remembers every write.
const mockStorage = {};
const mockStorageLog = [];
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k) => (k in mockStorage ? mockStorage[k] : null)),
    setItem: jest.fn(async (k, v) => { mockStorageLog.push(['set', k]); mockStorage[k] = String(v); }),
    removeItem: jest.fn(async (k) => { mockStorageLog.push(['remove', k]); delete mockStorage[k]; }),
    getAllKeys: jest.fn(async () => Object.keys(mockStorage)),
    multiRemove: jest.fn(async (keys) => { keys.forEach((k) => { mockStorageLog.push(['remove', k]); delete mockStorage[k]; }); }),
    clear: jest.fn(async () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); }),
  },
}));
const mockAuth = { currentUser: { uid: 'uidA' } };
jest.mock('../src/config/firebase', () => ({
  __esModule: true,
  auth: mockAuth,
  db: {},
  storage: {},
  functions: {},
  isFirebaseConfigured: true,
  default: {},
}));

// A stand-in for Firestore. `mockCloud` holds documents by path, `mockCollections` holds the documents of a collection, and every
// write (of any kind) is remembered in `mockWrites`, so a test can say "nothing was sent".
const mockCloud = {};
const mockCollections = {};
const mockWrites = [];
jest.mock('firebase/firestore', () => {
  const remember = (kind) => (...args) => { mockWrites.push({ kind, args }); };
  return {
    getFirestore: jest.fn(() => ({})),
    doc: jest.fn((_db, ...segments) => segments.join('/')),
    collection: jest.fn((_db, ...segments) => segments.join('/')),
    query: jest.fn((ref) => ref),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    serverTimestamp: jest.fn(() => 'now'),
    onSnapshot: jest.fn(() => () => undefined),
    getDoc: jest.fn(async (ref) => ({ exists: () => ref in mockCloud, data: () => mockCloud[ref] })),
    getDocs: jest.fn(async (ref) => {
      const docs = (mockCollections[ref] || []).map((d) => ({ id: d.id, data: () => d }));
      return { empty: docs.length === 0, docs, forEach: (fn) => docs.forEach(fn) };
    }),
    setDoc: jest.fn(async (ref, data) => {
      mockWrites.push({ kind: 'setDoc', args: [ref, data] });
      mockCloud[ref] = { ...(mockCloud[ref] || {}), ...JSON.parse(JSON.stringify(data)) };
    }),
    updateDoc: jest.fn(async (...args) => { mockWrites.push({ kind: 'updateDoc', args }); }),
    deleteDoc: jest.fn(async (...args) => { mockWrites.push({ kind: 'deleteDoc', args }); }),
    addDoc: jest.fn(async (ref, data) => {
      mockWrites.push({ kind: 'addDoc', args: [ref, data] });
      const id = `doc${mockWrites.length}`;
      mockCollections[ref] = [...(mockCollections[ref] || []), { id, ...JSON.parse(JSON.stringify(data)) }];
      return { id };
    }),
    writeBatch: jest.fn(() => ({ set: remember('batch.set'), update: remember('batch.update'), delete: remember('batch.delete'), commit: remember('batch.commit') })),
    runTransaction: jest.fn(async (...args) => { mockWrites.push({ kind: 'runTransaction', args }); }),
  };
}, { virtual: true });

// The native modules these stores reach for. None of them is used here.
jest.mock('@lomray/react-native-apple-music', () => ({
  Auth: {}, MusicKit: {}, Player: {}, isMusicSubscriptionError: () => false,
}), { virtual: true });

const fs = require('fs');
const path = require('path');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { signOut } = require('firebase/auth');
const {
  logOut, LOG_OUT_KEYS, LOG_OUT_KEY_PREFIXES, LOG_OUT_STORES,
} = require('../lib/logOut');
const { authService } = require('../services/authService');
const { CACHE_KEY_PREFIX } = require('../lib/recipeCache');
const { HISTORY_KEY_PREFIX } = require('../lib/recipeHistory');
const { spotifyService } = require('../services/spotifyService');
const { appleMusicService } = require('../services/appleMusicService');
const { useUserStore } = require('../store/userStore');
const { useRunningStore } = require('../store/runningStore');
const { useHealthStore } = require('../store/healthStore');
const { useRecipeStore } = require('../store/recipeStore');
const { useWorkoutStore } = require('../store/workoutStore');
const { useHikingStore } = require('../store/hikingStore');
const { useSettingsStore } = require('../store/settingsStore');
const { useShopStore } = require('../store/shopStore');
const { useSpotifyStore } = require('../store/spotifyStore');
const { useNutritionStore } = require('../store/nutritionStore');
const { useMealPlanStore } = require('../store/mealPlanStore');
const { useScheduleStore } = require('../store/scheduleStore');
const { useTrainingFeedbackStore } = require('../store/trainingFeedbackStore');
const { useExpStore } = require('../store/expStore');
const { useCommunityStore } = require('../store/communityStore');
const { useRunTrackerStore } = require('../store/runTrackerStore');

const ROOT = path.resolve(__dirname, '..');
const settle = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

const signedIn = (uid = 'uidA') => {
  mockAuth.currentUser = { uid };
  mockStorage.auth_token = 'id-token';
  mockStorage.auth_token_issued_at = '2026-10-28T10:00:00.000Z';
  useUserStore.setState({ user: { uid, name: 'Cj' }, isOnboarded: true });
};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await settle();
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.keys(mockCloud).forEach((k) => delete mockCloud[k]);
  Object.keys(mockCollections).forEach((k) => delete mockCollections[k]);
  mockWrites.length = 0;
  mockStorageLog.length = 0;
  signOut.mockResolvedValue(undefined);
  signedIn();
  mockStorage.some_unrelated_setting = 'keep';
});
// The user store schedules a screen frame when it loads (its saved copy is read back), and the Spotify service looks for its public-data
// token 300 ms after it loads; let both finish before the file ends.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 600)));

describe('logging out: the sign-in', () => {
  it('starts from a phone that opens signed in (so the checks below mean something)', async () => {
    expect(await authService.isAuthenticated()).toBe(true);
    expect(useUserStore.getState().isOnboarded).toBe(true);
  });

  it('removes the saved sign-in, so the app no longer opens signed in', async () => {
    await logOut();
    expect(mockStorage.auth_token).toBeUndefined();
    expect(mockStorage.auth_token_issued_at).toBeUndefined();
    expect(await authService.isAuthenticated()).toBe(false);
  });

  it('signs out of Firebase', async () => {
    await logOut();
    expect(signOut).toHaveBeenCalledWith(mockAuth);
  });

  it('clears the profile and the set-up flag, in memory and on the phone', async () => {
    await logOut();
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().isOnboarded).toBe(false);
    expect(mockStorage['zown-user-storage']).toBeUndefined();
  });

  it('is finished when it resolves: nothing is left to happen after the screen changes', async () => {
    let finished = false;
    const done = logOut().then(() => { finished = true; });
    expect(finished).toBe(false);
    await done;
    expect(mockStorage.auth_token).toBeUndefined();
    expect(useUserStore.getState().isOnboarded).toBe(false);
  });

  it('does nothing harmful when nobody is signed in', async () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    mockAuth.currentUser = null;
    try {
      await expect(logOut()).resolves.toBeUndefined();
      expect(signOut).not.toHaveBeenCalled();
      expect(await authService.isAuthenticated()).toBe(false);
    } finally {
      mockAuth.currentUser = { uid: 'uidA' };
    }
  });
});

// Written out here on purpose, apart from the list in lib/logOut.js: taking a key off that list by mistake has to fail a test, and a
// check that loops over the list itself would lose the key from the check at the same moment.
const EVERY_KEY_THE_APP_SAVES = [
  'auth_token', 'auth_token_issued_at',
  'running-storage', 'health-storage', 'workout-storage', 'hiking-storage', 'settings-storage', 'apple-music-storage', 'spotify-storage',
  'offline-trails', 'zown-user-storage', 'zown-achievement-storage', 'zown-badge-storage', 'zown-battlepass-storage',
  'zown-entitlement-storage', 'zown-exp-storage', 'zown-lifetime-storage', 'zown-meal-plan-storage', 'zown-nutrition-storage',
  'zown-run-tracker', 'zown-schedule-storage', 'zown-shop-storage', 'zown-social-graph', 'zown-training-feedback-storage',
  'zown-virtual-journeys', 'zown-virtual-races',
  '@recipes_saved', '@grocery_list',
  'spotify_access_token', 'spotify_refresh_token', 'spotify_token_expires_at', 'spotify_is_client_credentials', 'spotify_last_device_id',
  'spotify_code_verifier', 'spotify_auth_state', 'spotify_auth_redirect_uri',
  'apple_music_authorized',
  'zown-brief-cache', 'zown-insight-cache',
  'zown:bodyScan:voiceGuidanceEnabled',
];

describe('logging out: every saved key', () => {
  it('has all of them on its list', () => {
    expect([...LOG_OUT_KEYS].sort()).toEqual([...EVERY_KEY_THE_APP_SAVES].sort());
    expect(LOG_OUT_KEY_PREFIXES.sort()).toEqual(['@recipes_browse_cache_v1:', '@recipes_recent_picks_v1:']);
  });

  it.each(EVERY_KEY_THE_APP_SAVES)('removes %s', async (key) => {
    mockStorage[key] = JSON.stringify({ state: { something: 'of the last person' }, version: 0 });
    await logOut();
    expect(mockStorage[key]).toBeUndefined();
  });

  it('removes the recipe cache and the recent picks kept for each account, whoever they belong to', async () => {
    mockStorage[`${CACHE_KEY_PREFIX}uidA`] = '{"v":1}';
    mockStorage[`${CACHE_KEY_PREFIX}anon`] = '{"v":1}';
    mockStorage[`${HISTORY_KEY_PREFIX}uidA`] = '[1]';
    mockStorage[`${HISTORY_KEY_PREFIX}uidB`] = '[2]';
    await logOut();
    expect(Object.keys(mockStorage).filter((k) => LOG_OUT_KEY_PREFIXES.some((p) => k.startsWith(p)))).toEqual([]);
  });

  it('leaves a key that is not on the list, and a key that only looks like one', async () => {
    mockStorage['firebase:authUser:key:[DEFAULT]'] = 'firebase signs this one out itself';
    mockStorage.user_theme_choice = 'dark';
    await logOut();
    expect(mockStorage.some_unrelated_setting).toBe('keep');
    expect(mockStorage.user_theme_choice).toBe('dark');
    expect(mockStorage['firebase:authUser:key:[DEFAULT]']).toBeDefined();
  });

  it('does not leave a key behind that a store saved while it was being reset', async () => {
    // Resetting a store saves its (empty) state to the phone, so the keys have to be removed after the stores are reset.
    useRunningStore.setState({ runs: [{ id: 'r1', uid: 'uidA', distance: 5 }] });
    useHealthStore.setState({ steps: 4321 });
    await settle();
    expect(mockStorage['running-storage']).toBeDefined();
    await logOut();
    ['running-storage', 'health-storage', 'workout-storage', 'hiking-storage', 'settings-storage', 'zown-run-tracker']
      .forEach((key) => expect(mockStorage[key]).toBeUndefined());
    expect(Object.keys(mockStorage)).toEqual(['some_unrelated_setting']);
  });

  it('still removes the other keys when removing them together fails', async () => {
    AsyncStorage.multiRemove.mockRejectedValueOnce(new Error('disk busy'));
    mockStorage['running-storage'] = '{}';
    mockStorage.spotify_refresh_token = 'tok';
    await expect(logOut()).resolves.toBeUndefined();
    expect(mockStorage['running-storage']).toBeUndefined();
    expect(mockStorage.spotify_refresh_token).toBeUndefined();
    expect(mockStorage.some_unrelated_setting).toBe('keep');
  });

  it('still clears the stores and the sign-in when removing the saved sign-in fails once', async () => {
    AsyncStorage.removeItem.mockRejectedValueOnce(new Error('disk busy'));
    useRunningStore.setState({ runs: [{ id: 'r1', uid: 'uidA' }] });
    await expect(logOut()).resolves.toBeUndefined();
    expect(useRunningStore.getState().runs).toEqual([]);
    expect(await authService.isAuthenticated()).toBe(false);
  });

  it('still resets the stores when signing out fails', async () => {
    signOut.mockRejectedValueOnce(new Error('offline'));
    useRunningStore.setState({ runs: [{ id: 'r1', uid: 'uidA' }] });
    await expect(logOut()).resolves.toBeUndefined();
    expect(useRunningStore.getState().runs).toEqual([]);
  });
});

describe('logging out: every store in memory', () => {
  it.each(Object.keys(LOG_OUT_STORES))('puts %s back to the state it started with', async (name) => {
    const store = LOG_OUT_STORES[name];
    store.setState({ leftoverFromTheLastPerson: true, user: { uid: 'uidA' } });
    await logOut();
    expect(store.getState().leftoverFromTheLastPerson).toBeUndefined();
    expect(Object.keys(store.getState()).sort()).toEqual(Object.keys(store.getInitialState()).sort());
  });

  it('stops the live listeners a store holds before resetting it, or the reset would lose the way to stop them', async () => {
    const stopFeed = jest.fn();
    useCommunityStore.setState({ _unsubscribe: stopFeed });
    await logOut();
    expect(stopFeed).toHaveBeenCalledTimes(1);
    expect(useCommunityStore.getState()._unsubscribe).toBeNull();
  });

  it('still resets the other stores when one listener will not stop', async () => {
    useCommunityStore.setState({ _unsubscribe: () => { throw new Error('already closed'); } });
    useRunningStore.setState({ runs: [{ id: 'r1', uid: 'uidA' }] });
    await expect(logOut()).resolves.toBeUndefined();
    expect(useRunningStore.getState().runs).toEqual([]);
    expect(useCommunityStore.getState()._unsubscribe).toBeNull(); // the store with the stuck listener is reset as well
  });

  it('still resets the other stores when one store will not reset', async () => {
    const stuck = jest.spyOn(useShopStore, 'setState').mockImplementation(() => { throw new Error('stuck'); });
    useRunningStore.setState({ runs: [{ id: 'r1', uid: 'uidA' }] });
    useWorkoutStore.setState({ completedWorkouts: [{ id: 'w1', uid: 'uidA' }] });
    try {
      await expect(logOut()).resolves.toBeUndefined();
      expect(useRunningStore.getState().runs).toEqual([]);
      expect(useWorkoutStore.getState().completedWorkouts).toEqual([]);
      expect(mockStorage.auth_token).toBeUndefined(); // and the keys are still removed after it
    } finally {
      stuck.mockRestore();
    }
  });

  it('disconnects Spotify: its connection, its tokens in memory and the ones it saved', async () => {
    useSpotifyStore.setState({ isConnected: true, user: { id: 'spotify-a' }, topTracks: [{ id: 't1' }] });
    spotifyService.token = 'access';
    spotifyService.refreshToken = 'refresh';
    mockStorage.spotify_access_token = 'access';
    mockStorage.spotify_refresh_token = 'refresh';
    await logOut();
    expect(useSpotifyStore.getState().isConnected).toBe(false);
    expect(useSpotifyStore.getState().user).toBeNull();
    expect(spotifyService.token).toBeNull();
    expect(spotifyService.refreshToken).toBeNull();
    expect(mockStorage.spotify_access_token).toBeUndefined();
    expect(mockStorage.spotify_refresh_token).toBeUndefined();
  });

  it('disconnects Apple Music: its connection and the access it was given', async () => {
    appleMusicService.isAuthorized = true;
    mockStorage.apple_music_authorized = 'true';
    await logOut();
    expect(appleMusicService.isAuthorized).toBe(false);
    expect(mockStorage.apple_music_authorized).toBeUndefined();
  });

  it('still resets the stores when Spotify will not disconnect', async () => {
    const spotify = useSpotifyStore.getState().disconnectSpotify;
    useSpotifyStore.setState({ disconnectSpotify: async () => { throw new Error('no network'); } });
    useRunningStore.setState({ runs: [{ id: 'r1', uid: 'uidA' }] });
    try {
      await expect(logOut()).resolves.toBeUndefined();
      expect(useRunningStore.getState().runs).toEqual([]);
    } finally {
      useSpotifyStore.setState({ disconnectSpotify: spotify });
    }
  });

  it('writes out what the hike store was still waiting to save before the keys go, so it cannot come back', async () => {
    // The hike store saves a few seconds after a change, not at once. Resetting it leaves its empty state waiting to be saved; if that is
    // not written out first, it is written after the keys are gone and the key comes back.
    useRunTrackerStore.getState().begin({ kind: 'hike:ridge', context: { pathName: 'Ridge loop' } }); // a hike is saved at once, so the next change has to wait
    mockStorageLog.length = 0;
    await logOut();
    const operations = mockStorageLog.filter(([, key]) => key === 'zown-run-tracker').map(([operation]) => operation);
    expect(operations).toContain('set');
    expect(operations[operations.length - 1]).toBe('remove');
    expect(mockStorage['zown-run-tracker']).toBeUndefined();
  });
});

describe('logging out sends nothing to the cloud', () => {
  const writesNow = () => mockWrites.map((w) => w.kind);

  it('signs out before it resets the first store, so no store still has an account to write to', async () => {
    const events = [];
    signOut.mockImplementation(async () => { events.push('signOut'); });
    const unsubscribers = Object.entries(LOG_OUT_STORES).map(([name, store]) => store.subscribe(() => events.push(`reset ${name}`)));
    try {
      await logOut();
    } finally {
      unsubscribers.forEach((stop) => stop());
    }
    expect(events[0]).toBe('signOut');
    expect(events.length).toBeGreaterThan(1);
  });

  it('writes nothing to Firestore, even from the stores that save to the account on every change', async () => {
    jest.useFakeTimers();
    try {
      // Someone is signed in and every kind of syncing store is following their account.
      useNutritionStore.getState().setSyncUid('uidA');
      useMealPlanStore.setState({ syncUid: 'uidA', entries: [{ id: 'e1', date: '2026-10-28', slot: 'dinner', recipeId: 'x' }] });
      useScheduleStore.setState({ syncUid: 'uidA', ownerUid: 'uidA', events: [] });
      useTrainingFeedbackStore.setState({ syncUid: 'uidA' });
      useExpStore.setState({ syncUid: 'uidA' });
      useRunningStore.setState({ runs: [{ id: 'r1', uid: 'uidA', distance: 5 }] });
      await jest.advanceTimersByTimeAsync(60000);
      mockWrites.length = 0; // whatever setting this up wrote is not what is being looked at

      await logOut();
      await jest.advanceTimersByTimeAsync(60000); // past every delay a store waits before it saves

      expect(writesNow()).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('writes nothing when a change was still waiting to be saved at the moment of log out', async () => {
    jest.useFakeTimers();
    try {
      useTrainingFeedbackStore.setState({ syncUid: 'uidA' });
      await jest.advanceTimersByTimeAsync(60000);
      mockWrites.length = 0;
      useTrainingFeedbackStore.setState({ updatedAt: 'a change a moment before log out' }); // its save is now waiting on a timer
      await logOut();
      await jest.advanceTimersByTimeAsync(60000);
      expect(writesNow()).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops each syncing store following the account', async () => {
    useNutritionStore.getState().setSyncUid('uidA');
    useMealPlanStore.setState({ syncUid: 'uidA' });
    useScheduleStore.setState({ syncUid: 'uidA', ownerUid: 'uidA' });
    useTrainingFeedbackStore.setState({ syncUid: 'uidA' });
    await logOut();
    expect(useNutritionStore.getState().syncUid).toBeNull();
    expect(useMealPlanStore.getState().syncUid).toBeNull();
    expect(useScheduleStore.getState().syncUid).toBeNull();
    expect(useTrainingFeedbackStore.getState().syncUid).toBeNull();
  });
});

describe('two accounts on one phone', () => {
  const RUN = { distance: 5, duration: 1800, calories: 320, coords: [] };
  const today = new Date().toISOString().slice(0, 10);

  // What account A did on this phone, as the app records it: some of it reached the cloud, some did not.
  const accountAUsesThePhone = async () => {
    useRunningStore.getState().endRun('uidA', RUN);
    await settle();
    useHealthStore.setState({ steps: 4321, stepsDate: today });
    await useHealthStore.getState()._persist('uidA');
    useRecipeStore.setState({ savedRecipes: [{ id: 'recipe-a', name: 'A overnight oats', title: 'A overnight oats' }], groceryList: [{ id: 'g1', name: 'oats' }] });
    await useRecipeStore.getState().saveData();
    useWorkoutStore.setState({ completedWorkouts: [{ id: 'workout-a', uid: 'uidA', name: 'A leg day', completedAt: '2026-10-20T10:00:00Z' }] });
    useHikingStore.setState({ completedHikes: [{ id: 'hike-a', uid: 'uidA' }] });
    useSettingsStore.setState({ units: 'imperial' });
    // And a run that never reached the cloud (no signal): it is only on the phone.
    useRunningStore.setState((s) => ({ runs: [{ id: 'run-offline-a', uid: 'uidA', distance: 3, date: '2026-10-27T08:00:00Z' }, ...s.runs] }));
    await settle();
    mockCollections['users/uidA/recipes'] = [{ id: 'recipe-a', name: 'A overnight oats', title: 'A overnight oats', dateAdded: '2026-10-20T00:00:00Z' }];
  };

  // What the app does when an account signs in (app/_layout.jsx).
  const theAppLoads = async (uid) => {
    await useRunningStore.getState().loadRuns(uid);
    await useHealthStore.getState().loadAllHealth(uid);
    await useRecipeStore.getState().loadRecipes(uid);
    await useWorkoutStore.getState().loadWorkouts(uid);
    await settle();
  };

  it('starts with account A really holding data (so the checks below mean something)', async () => {
    await accountAUsesThePhone();
    expect(useRunningStore.getState().runs.length).toBeGreaterThan(1);
    expect(useHealthStore.getState().steps).toBe(4321);
    expect(useRecipeStore.getState().savedRecipes).toHaveLength(1);
    expect(mockStorage['running-storage']).toBeDefined();
    expect(mockStorage['@recipes_saved']).toBeDefined();
  });

  it('A logs out, B signs up on the same phone, and B sees nothing of A', async () => {
    await accountAUsesThePhone();
    await logOut();

    signedIn('uidB'); // B signs up: a brand-new account has no cloud data at all
    await theAppLoads('uidB');

    expect(useRunningStore.getState().runs).toEqual([]);
    expect(useHealthStore.getState().steps).toBe(0);
    expect(useHealthStore.getState().stepsHistory).toEqual(useHealthStore.getInitialState().stepsHistory);
    expect(useRecipeStore.getState().savedRecipes).toEqual([]);
    expect(useRecipeStore.getState().groceryList).toEqual([]);
    expect(useWorkoutStore.getState().completedWorkouts).toEqual([]);
    expect(useHikingStore.getState().completedHikes).toEqual([]);
    expect(useSettingsStore.getState().units).toBe(useSettingsStore.getInitialState().units);
  });

  it('the app is closed and opened again before B signs in, and B still sees nothing of A', async () => {
    await accountAUsesThePhone();
    useRunTrackerStore.getState().begin({ kind: 'hike:ridge', context: { pathName: 'Ridge loop' } }); // A was in the middle of a hike
    expect(useRunTrackerStore.getState().tracker.status).not.toBe('idle');
    await logOut();

    // Opening the app again: every store reads back what the phone saved, and the Recipes screen reads its saved recipes.
    await Promise.all(Object.values(LOG_OUT_STORES).map((store) => (store.persist ? store.persist.rehydrate() : null)));
    await useRecipeStore.getState().loadData();
    signedIn('uidB');
    await theAppLoads('uidB');

    expect(useRunningStore.getState().runs).toEqual([]);
    expect(useHealthStore.getState().steps).toBe(0);
    expect(useRecipeStore.getState().savedRecipes).toEqual([]);
    expect(useRecipeStore.getState().groceryList).toEqual([]);
    expect(useWorkoutStore.getState().completedWorkouts).toEqual([]);
    expect(useHikingStore.getState().completedHikes).toEqual([]);
    expect(useSettingsStore.getState().units).toBe(useSettingsStore.getInitialState().units);
    // A's unfinished hike is not offered to B to pick up.
    expect(useRunTrackerStore.getState().tracker.status).toBe('idle');
    expect(useRunTrackerStore.getState().recovered).toBe(false);
  });

  it('B then records a run, and the copy saved to B\'s account holds only B\'s run', async () => {
    await accountAUsesThePhone();
    await logOut();
    signedIn('uidB');
    await theAppLoads('uidB');

    mockWrites.length = 0;
    useRunningStore.getState().endRun('uidB', RUN);
    await settle();

    const saved = mockCloud['users/uidB/data/running'];
    expect(saved).toBeDefined();
    expect(saved.runs).toHaveLength(1);
    expect(saved.runs.every((r) => r.uid === 'uidB')).toBe(true);
    // Nothing in what was sent to B's account is A's: not a run, not a recipe.
    expect(JSON.stringify(mockWrites)).not.toContain('run-offline-a');
    expect(JSON.stringify(mockWrites)).not.toContain('uidA');
  });

  it('B saving a recipe does not send A\'s recipes to B\'s account', async () => {
    await accountAUsesThePhone();
    await logOut();
    signedIn('uidB');
    await theAppLoads('uidB');

    await useRecipeStore.getState().addRecipe({ name: 'B pancakes', description: 'x', ingredients: [], instructions: [] }, 'uidB');
    const saved = useRecipeStore.getState().savedRecipes;
    expect(saved.map((r) => r.name)).toEqual(['B pancakes']);
    expect(mockCollections['users/uidB/recipes'].map((r) => r.name)).toEqual(['B pancakes']);
  });

  it('logging out writes nothing to A\'s account: what A had in the cloud is exactly as it was', async () => {
    await accountAUsesThePhone();
    const before = JSON.stringify({ cloud: mockCloud, collections: mockCollections });
    mockWrites.length = 0;
    await logOut();
    await settle();
    expect(mockWrites).toEqual([]);
    expect(JSON.stringify({ cloud: mockCloud, collections: mockCollections })).toBe(before);
  });

  it('A logs back in and their data is still there', async () => {
    await accountAUsesThePhone();
    const cloudRuns = mockCloud['users/uidA/data/running'].runs.map((r) => r.id);
    await logOut();

    signedIn('uidB');
    await theAppLoads('uidB');
    await logOut();

    signedIn('uidA');
    await theAppLoads('uidA');

    expect(useRunningStore.getState().runs.map((r) => r.id)).toEqual(expect.arrayContaining(cloudRuns));
    expect(useHealthStore.getState().steps).toBe(4321);
    expect(useRecipeStore.getState().savedRecipes.map((r) => r.id)).toContain('recipe-a');
  });
});

// Not tests of behavior but guards: a new store, or a new key the app saves, has to be accounted for here or these fail.
describe('nothing the app saves is missing from the log-out list', () => {
  const stores = Object.entries(LOG_OUT_STORES);

  it('lists every store in store/', () => {
    const files = fs.readdirSync(path.join(ROOT, 'store')).filter((f) => f.endsWith('.js'));
    const creating = files
      .filter((f) => /\bcreate\s*\(/.test(fs.readFileSync(path.join(ROOT, 'store', f), 'utf8')))
      .map((f) => f.replace(/\.js$/, ''));
    expect(creating.length).toBeGreaterThan(30);
    expect(Object.keys(LOG_OUT_STORES).sort()).toEqual(creating.sort());
  });

  it.each(stores)('%s: the name it saves under, if it saves, is on the list of keys', (name, store) => {
    const saved = store.persist && store.persist.getOptions().name;
    if (saved) expect(LOG_OUT_KEYS).toContain(saved);
  });

  it('lists each key only once', () => {
    expect(new Set(LOG_OUT_KEYS).size).toBe(LOG_OUT_KEYS.length);
  });

  // Every file that reads or writes the phone's storage. A file added to this list has to say where its keys are on the list of keys
  // (or why they are not there); a file that is not in this list fails the test, so a new place that saves is looked at.
  const SAVES_TO_THE_PHONE = {
    'app/profile/settings.jsx': 'Delete Account clears the whole of storage itself, then reloads',
    'lib/logOut.js': 'this list',
    'lib/recipeCache.js': 'CACHE_KEY_PREFIX',
    'lib/recipeHistory.js': 'HISTORY_KEY_PREFIX',
    'lib/throttledStorage.js': 'the hike store, zown-run-tracker; writes nothing of its own',
    'services/appleMusicService.ios.js': 'apple_music_authorized',
    'services/authService.js': 'auth_token, auth_token_issued_at',
    'services/briefService.js': 'zown-brief-cache',
    'services/insightService.js': 'zown-insight-cache',
    'services/spotifyService.js': 'the eight spotify_ keys',
    'services/voiceGuidanceService.js': 'zown:bodyScan:voiceGuidanceEnabled',
    'src/config/firebase.js': "Firebase's own sign-in record: signing out removes it",
    'src/services/spotify.js': 'not used by the app: nothing imports src/hooks/useSpotify.js',
    'src/stores/spotifyStore.js': 'not used by the app: nothing imports src/hooks/useSpotify.js',
  };
  for (const f of fs.readdirSync(path.join(ROOT, 'store')).filter((x) => x.endsWith('.js'))) {
    if (/AsyncStorage/.test(fs.readFileSync(path.join(ROOT, 'store', f), 'utf8'))) SAVES_TO_THE_PHONE[`store/${f}`] = 'its persist name, checked above';
  }

  const SKIP = new Set(['node_modules', '__tests__', 'ios', 'android', 'functions', 'rules-tests', '.expo', '.git', 'coverage', 'dist', 'docs', 'admin']);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : walk(path.join(dir, e.name));
    return /\.(js|jsx|ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [];
  });

  it('knows every file that reads or writes the phone\'s storage', () => {
    const found = walk(ROOT)
      .filter((file) => /AsyncStorage|SecureStore/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
      .sort();
    expect(found).toEqual(Object.keys(SAVES_TO_THE_PHONE).sort());
  });
});

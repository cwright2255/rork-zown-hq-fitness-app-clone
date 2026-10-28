// lib/logOut.js: what Log Out does. The app opens by looking for the sign-in this phone kept (app/index.jsx asks authService.isAuthenticated()),
// so a log out has to remove it, sign out of Firebase, and clear the saved profile and the "set up" flag. These use the real authService and
// the real user store, with a phone's storage held in memory.
const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k) => (k in mockStorage ? mockStorage[k] : null)),
    setItem: jest.fn(async (k, v) => { mockStorage[k] = String(v); }),
    removeItem: jest.fn(async (k) => { delete mockStorage[k]; }),
    getAllKeys: jest.fn(async () => Object.keys(mockStorage)),
    multiRemove: jest.fn(async (keys) => { keys.forEach((k) => { delete mockStorage[k]; }); }),
  },
}));
const mockAuth = { currentUser: { uid: 'u1' } };
jest.mock('../src/config/firebase', () => ({
  __esModule: true,
  auth: mockAuth,
  db: {},
  storage: {},
  functions: {},
  isFirebaseConfigured: true,
  default: {},
}));

const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { signOut } = require('firebase/auth');
const { logOut } = require('../lib/logOut');
const { authService } = require('../services/authService');
const { useUserStore } = require('../store/userStore');

const signedIn = () => {
  mockStorage.auth_token = 'id-token';
  mockStorage.auth_token_issued_at = '2026-10-28T10:00:00.000Z';
  mockStorage['zown-user-storage'] = JSON.stringify({ state: { user: { uid: 'u1', name: 'Cj' }, isOnboarded: true }, version: 0 });
  mockStorage.some_unrelated_setting = 'keep';
  useUserStore.setState({ user: { uid: 'u1', name: 'Cj' }, isOnboarded: true });
};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  jest.clearAllMocks();
  signOut.mockResolvedValue(undefined);
  signedIn();
});
// The user store schedules a screen frame when it loads (its saved copy is read back); let that finish before the file ends.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 50)));

describe('logging out', () => {
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

  it('clears the saved profile and the set-up flag, in memory and on the phone', async () => {
    await logOut();
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().isOnboarded).toBe(false);
    const saved = mockStorage['zown-user-storage'];
    if (saved !== undefined) expect(JSON.parse(saved).state).toMatchObject({ user: null, isOnboarded: false });
  });

  it('leaves settings that are not about the person alone', async () => {
    await logOut();
    expect(mockStorage.some_unrelated_setting).toBe('keep');
  });

  it('is finished when it resolves: nothing is left to happen after the screen changes', async () => {
    let finished = false;
    const done = logOut().then(() => { finished = true; });
    expect(finished).toBe(false);
    await done;
    expect(mockStorage.auth_token).toBeUndefined();
    expect(useUserStore.getState().isOnboarded).toBe(false);
  });

  it('still clears the profile, and the sign-in, when removing the saved sign-in fails once', async () => {
    AsyncStorage.removeItem.mockRejectedValueOnce(new Error('disk busy'));
    await expect(logOut()).resolves.toBeUndefined();
    expect(useUserStore.getState().user).toBeNull();
    expect(await authService.isAuthenticated()).toBe(false);
  });

  it('still removes the saved sign-in when clearing the saved profile fails', async () => {
    useUserStore.setState({ logout: jest.fn(async () => { throw new Error('boom'); }) });
    await expect(logOut()).resolves.toBeUndefined();
    expect(await authService.isAuthenticated()).toBe(false);
    expect(signOut).toHaveBeenCalled();
  });

  it('does nothing harmful when nobody is signed in', async () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    mockAuth.currentUser = null;
    try {
      await expect(logOut()).resolves.toBeUndefined();
      expect(signOut).not.toHaveBeenCalled();
      expect(await authService.isAuthenticated()).toBe(false);
    } finally {
      mockAuth.currentUser = { uid: 'u1' };
    }
  });
});

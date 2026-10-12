import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }), { virtual: true });
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'zownhq://spotify-callback', useAuthRequest: () => [null, null, jest.fn()], ResponseType: {} }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: () => ({ units: 'metric', privacy: {}, showInLeaderboards: true, updateSetting: jest.fn(), updatePrivacy: jest.fn() }),
}));
jest.mock('@/store/userStore', () => ({
  useUserStore: () => ({ user: { uid: 'u1' }, logout: (...a) => global.__logout(...a) }),
}));
jest.mock('@/store/spotifyStore', () => ({ useSpotifyStore: () => ({ isConnected: false, disconnectSpotify: jest.fn() }) }));
jest.mock('@/store/appleMusicStore', () => ({
  useAppleMusicStore: () => ({ isConnected: false, connectAppleMusic: jest.fn(), disconnectAppleMusic: jest.fn() }),
}));
jest.mock('@/services/spotifyService', () => ({ spotifyService: {} }));
jest.mock('@/services/leaderboardVisibility', () => ({ setShowInLeaderboards: jest.fn() }));
jest.mock('../src/config/firebase', () => ({ auth: { currentUser: { uid: 'u1', email: 'cj@example.com' } }, functions: { fake: true } }));
// firebase/auth and firebase/functions get the same fake, so this test does not
// depend on how the module resolver maps the two (some setups point both at one stub).
jest.mock('firebase/functions', () => ({
  sendPasswordResetEmail: jest.fn(),
  signOut: (...a) => global.__signOut(...a),
  httpsCallable: (...a) => global.__httpsCallable(...a),
}), { virtual: true });
jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: jest.fn(),
  signOut: (...a) => global.__signOut(...a),
  httpsCallable: (...a) => global.__httpsCallable(...a),
}), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { clear: jest.fn(), getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo-image', () => ({
  Image: { clearDiskCache: (...a) => global.__clearDisk(...a), clearMemoryCache: (...a) => global.__clearMemory(...a) },
}), { virtual: true });
jest.mock('@/lib/meshCache', () => ({ meshCache: { clear: (...a) => global.__clearMesh(...a) } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }), { virtual: true });
jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'standalone', expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-updates', () => ({
  useUpdates: () => ({ isUpdatePending: false }),
  reloadAsync: (...a) => global.__reload(...a),
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  updateId: 'abc',
  channel: 'production',
  runtimeVersion: '1.0.0',
}), { virtual: true });
jest.mock('@/lib/crashReporting', () => ({
  sendTestReport: jest.fn(), forceTestCrash: jest.fn(), isCrashReportingAvailable: () => false,
}));

import SettingsScreen from '../app/profile/settings';

const { router } = require('expo-router');
const { auth } = require('../src/config/firebase');

let alertSpy;
beforeEach(() => {
  global.__logout = jest.fn();
  global.__deleteCall = jest.fn(async () => ({ data: { deleted: true } }));
  global.__httpsCallable = jest.fn(() => global.__deleteCall);
  global.__signOut = jest.fn(async () => {});
  global.__reload = jest.fn(async () => {});
  require('@react-native-async-storage/async-storage').default.clear.mockClear();
  global.__clearDisk = jest.fn(async () => true);
  global.__clearMemory = jest.fn(async () => true);
  global.__clearMesh = jest.fn(async () => {});
  router.push.mockClear();
  router.replace.mockClear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('Settings: About and Data rows', () => {
  it('lists Terms, Privacy Policy and Open Source Licenses, and they open their screens', () => {
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Terms of Service'));
    expect(router.push).toHaveBeenLastCalledWith('/profile/terms');
    fireEvent.press(utils.getByText('Privacy Policy'));
    expect(router.push).toHaveBeenLastCalledWith('/profile/privacy-policy');
    fireEvent.press(utils.getByText('Open Source Licenses'));
    expect(router.push).toHaveBeenLastCalledWith('/profile/licenses');
  });

  it('has no Rate App row until the app has a store page to send people to', () => {
    const utils = render(<SettingsScreen />);
    expect(utils.queryByText('Rate App')).toBeNull();
  });

  it('has no Export Data row, because there is no export to run', () => {
    const utils = render(<SettingsScreen />);
    expect(utils.queryByText('Export Data')).toBeNull();
    expect(utils.queryByText(/Download all personal records/)).toBeNull();
  });
});

describe('Settings: Delete Account', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const confirmTwice = async (utils) => {
    fireEvent.press(utils.getByText('Delete Account'));
    const [title1, message1, buttons1] = alertSpy.mock.calls[0];
    buttons1.find((b) => b.text === 'Delete Permanently').onPress();
    const [title2, message2, buttons2] = alertSpy.mock.calls[1];
    await act(async () => { await buttons2.find((b) => b.text === 'Yes, Delete').onPress(); });
    return { title1, message1, title2, message2 };
  };
  const lastAlert = () => alertSpy.mock.calls.at(-1);

  it('tells the person what will be erased, and that it cannot be undone', async () => {
    const utils = render(<SettingsScreen />);
    const { title1, message1, title2, message2 } = await confirmTwice(utils);
    expect(title1).toBe('Delete Account');
    expect(message1).toMatch(/permanently deletes your ZOWN HQ account and erases your email, profile, workouts/);
    expect(message1).toMatch(/from our servers/);
    expect(message1).toMatch(/cannot be undone/);
    expect(message1).not.toMatch(/not erased automatically|may remain|will remain|stay on|still stored/i);
    expect(title2).toBe('Final Confirmation');
    expect(message2).toMatch(/Everything will be erased/);
  });

  it('asks the server to erase the account (with time to finish), then signs out, wipes this phone and restarts', async () => {
    const utils = render(<SettingsScreen />);
    await confirmTwice(utils);
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'deleteMyAccount', { timeout: 540000 });
    expect(global.__deleteCall).toHaveBeenCalledTimes(1);
    expect(global.__signOut).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.clear).toHaveBeenCalledTimes(1);
    expect(global.__clearMesh).toHaveBeenCalledTimes(1);
    expect(global.__clearDisk).toHaveBeenCalledTimes(1);
    expect(global.__logout).toHaveBeenCalledTimes(1);
    expect(global.__reload).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/auth/login');
  });

  it('wipes this phone only after the server has finished', async () => {
    const order = [];
    global.__deleteCall = jest.fn(async () => { order.push('server'); return { data: { deleted: true } }; });
    global.__httpsCallable = jest.fn(() => global.__deleteCall);
    AsyncStorage.clear.mockImplementation(async () => { order.push('wipe'); });
    global.__logout = jest.fn(() => order.push('logout'));
    const utils = render(<SettingsScreen />);
    await confirmTwice(utils);
    expect(order).toEqual(['server', 'wipe', 'logout']);
    AsyncStorage.clear.mockReset();
  });

  it('still lands on the login screen if the app cannot restart itself (for example in development)', async () => {
    global.__reload = jest.fn(async () => { throw new Error('not available'); });
    const utils = render(<SettingsScreen />);
    await confirmTwice(utils);
    expect(router.replace).toHaveBeenCalledWith('/auth/login');
  });

  it('shows "Erasing your data..." while the server works, and not before', async () => {
    let release;
    global.__deleteCall = jest.fn(() => new Promise((resolve) => { release = () => resolve({ data: { deleted: true } }); }));
    global.__httpsCallable = jest.fn(() => global.__deleteCall);
    const utils = render(<SettingsScreen />);
    expect(utils.queryByText('Erasing your data...')).toBeNull();
    fireEvent.press(utils.getByText('Delete Account'));
    alertSpy.mock.calls[0][2].find((b) => b.text === 'Delete Permanently').onPress();
    await act(async () => { alertSpy.mock.calls[1][2].find((b) => b.text === 'Yes, Delete').onPress(); });
    expect(utils.getByText('Erasing your data...')).toBeTruthy();
    await act(async () => { release(); });
    expect(utils.queryByText('Erasing your data...')).toBeNull();
  });

  it('ignores a second tap while one deletion is running', async () => {
    global.__deleteCall = jest.fn(() => new Promise(() => {}));
    global.__httpsCallable = jest.fn(() => global.__deleteCall);
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Delete Account'));
    alertSpy.mock.calls[0][2].find((b) => b.text === 'Delete Permanently').onPress();
    await act(async () => { alertSpy.mock.calls[1][2].find((b) => b.text === 'Yes, Delete').onPress(); });
    const before = alertSpy.mock.calls.length;
    fireEvent.press(utils.getByText('Delete Account'));
    expect(alertSpy.mock.calls.length).toBe(before);
  });

  it('does nothing until the second confirmation, and cancel leaves the account alone', () => {
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Delete Account'));
    expect(global.__deleteCall).not.toHaveBeenCalled();
    alertSpy.mock.calls[0][2].find((b) => b.text === 'Delete Permanently').onPress();
    expect(global.__deleteCall).not.toHaveBeenCalled();
    alertSpy.mock.calls[1][2].find((b) => b.text === 'Cancel').onPress?.();
    expect(global.__deleteCall).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  describe('when the server says no', () => {
    const failWith = (error) => { global.__deleteCall = jest.fn(async () => { throw error; }); global.__httpsCallable = jest.fn(() => global.__deleteCall); };
    const nothingWiped = () => {
      expect(global.__signOut).not.toHaveBeenCalled();
      expect(AsyncStorage.clear).not.toHaveBeenCalled();
      expect(global.__logout).not.toHaveBeenCalled();
      expect(global.__reload).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    };

    it('asks them to sign in again when their sign-in is too old, and keeps everything', async () => {
      failWith(Object.assign(new Error('recent-login-required'), { code: 'functions/failed-precondition' }));
      const utils = render(<SettingsScreen />);
      await confirmTwice(utils);
      expect(lastAlert()[0]).toBe('Sign in again first');
      expect(lastAlert()[1]).toMatch(/log out, sign back in, then delete/);
      nothingWiped();
      expect(utils.queryByText('Erasing your data...')).toBeNull();
    });

    it('says nothing was lost when the erase could not finish, and keeps everything', async () => {
      failWith(Object.assign(new Error('delete-incomplete'), { code: 'functions/internal' }));
      const utils = render(<SettingsScreen />);
      await confirmTwice(utils);
      expect(lastAlert()[0]).toBe('Not finished');
      expect(lastAlert()[1]).toMatch(/Nothing was lost/);
      expect(lastAlert()[1]).toMatch(/privacy@zownhq\.com/);
      nothingWiped();
    });

    it('says so when the server cannot be reached, and keeps everything', async () => {
      failWith(Object.assign(new Error('network'), { code: 'functions/unavailable' }));
      const utils = render(<SettingsScreen />);
      await confirmTwice(utils);
      expect(lastAlert()[0]).toBe('Could not delete');
      expect(lastAlert()[1]).toMatch(/Check your connection/);
      nothingWiped();
    });

    it('lets them try again afterwards', async () => {
      failWith(Object.assign(new Error('network'), { code: 'functions/unavailable' }));
      const utils = render(<SettingsScreen />);
      await confirmTwice(utils);
      global.__deleteCall = jest.fn(async () => ({ data: { deleted: true } }));
      global.__httpsCallable = jest.fn(() => global.__deleteCall);
      alertSpy.mockClear();
      await confirmTwice(utils);
      expect(global.__deleteCall).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/auth/login');
    });
  });
});

describe('Settings: Clear Cache', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const openClear = (utils) => {
    fireEvent.press(utils.getByText('Clear Cache'));
    const [title, message, buttons] = alertSpy.mock.calls[0];
    return { title, message, clear: buttons.find((b) => b.text === 'Clear'), cancel: buttons.find((b) => b.text === 'Cancel') };
  };

  it('clears downloaded images and saved 3D body models, and nothing else', async () => {
    const utils = render(<SettingsScreen />);
    const { clear } = openClear(utils);
    await act(async () => { await clear.onPress(); });
    expect(global.__clearDisk).toHaveBeenCalledTimes(1);
    expect(global.__clearMemory).toHaveBeenCalledTimes(1);
    expect(global.__clearMesh).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.clear).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenLastCalledWith('Success', 'Cache cleared successfully.');
  });

  it('tells the person their workouts, logs, settings and sign-in are safe', () => {
    const utils = render(<SettingsScreen />);
    const { title, message } = openClear(utils);
    expect(title).toBe('Clear Cache');
    expect(message).toMatch(/images/);
    expect(message).toMatch(/3D body models/);
    expect(message).toMatch(/workouts, logs, settings and sign-in are not affected/);
  });

  it('does nothing when cancelled', () => {
    const utils = render(<SettingsScreen />);
    const { cancel } = openClear(utils);
    cancel.onPress?.();
    expect(global.__clearDisk).not.toHaveBeenCalled();
    expect(global.__clearMesh).not.toHaveBeenCalled();
  });

  it('says so when clearing fails', async () => {
    global.__clearDisk = jest.fn(async () => { throw new Error('nope'); });
    const utils = render(<SettingsScreen />);
    const { clear } = openClear(utils);
    await act(async () => { await clear.onPress(); });
    expect(alertSpy).toHaveBeenLastCalledWith('Error', 'Failed to clear cache.');
  });

  it('does not show a made-up storage figure', () => {
    const utils = render(<SettingsScreen />);
    expect(utils.queryByText('Storage Used')).toBeNull();
    expect(utils.queryByText('14.2 MB')).toBeNull();
  });
});

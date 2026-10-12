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
jest.mock('../src/config/firebase', () => ({ auth: { currentUser: { uid: 'u1', email: 'cj@example.com' } } }));
jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: jest.fn(),
  deleteUser: (...a) => global.__deleteUser(...a),
  signOut: jest.fn(async () => {}),
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
  reloadAsync: jest.fn(),
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
  global.__deleteUser = jest.fn(async () => {});
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
  const confirmTwice = async (utils) => {
    fireEvent.press(utils.getByText('Delete Account'));
    const [title1, message1, buttons1] = alertSpy.mock.calls[0];
    buttons1.find((b) => b.text === 'Delete Permanently').onPress();
    const [title2, message2, buttons2] = alertSpy.mock.calls[1];
    await act(async () => { await buttons2.find((b) => b.text === 'Yes, Delete').onPress(); });
    return { title1, message1, title2, message2 };
  };

  it('says what it really does: removes the sign-in, and stored records are removed on request', async () => {
    const utils = render(<SettingsScreen />);
    const { title1, message1, title2, message2 } = await confirmTwice(utils);
    expect(title1).toBe('Delete Account');
    expect(message1).toMatch(/permanently deletes your ZOWN HQ account/);
    expect(message1).toMatch(/not erased automatically yet/);
    expect(message1).toMatch(/privacy@zownhq\.com/);
    expect(message1).not.toMatch(/all records/i);
    expect(title2).toBe('Final Confirmation');
    expect(message2).not.toMatch(/All data will be lost/);
  });

  it('deletes the signed-in user, logs out and goes to the login screen', async () => {
    const utils = render(<SettingsScreen />);
    await confirmTwice(utils);
    expect(global.__deleteUser).toHaveBeenCalledWith(auth.currentUser);
    expect(global.__logout).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/auth/login');
  });

  it('does nothing until the second confirmation, and cancel leaves the account alone', () => {
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Delete Account'));
    expect(global.__deleteUser).not.toHaveBeenCalled();
    alertSpy.mock.calls[0][2].find((b) => b.text === 'Delete Permanently').onPress();
    expect(global.__deleteUser).not.toHaveBeenCalled();
    alertSpy.mock.calls[1][2].find((b) => b.text === 'Cancel').onPress?.();
    expect(global.__deleteUser).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the reason and stays signed in when Firebase refuses (for example, a stale login)', async () => {
    global.__deleteUser = jest.fn(async () => { throw new Error('This operation is sensitive and requires recent authentication.'); });
    const utils = render(<SettingsScreen />);
    await confirmTwice(utils);
    expect(alertSpy).toHaveBeenLastCalledWith('Error', expect.stringMatching(/requires recent authentication/));
    expect(global.__logout).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
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

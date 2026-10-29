// The Log Out row in Settings. It used to do its own, shorter log out (sign out of Firebase and clear the profile), so a phone logged out
// from Settings kept the last person's runs, health data and recipes, while one logged out from the Profile page did not. Both rows now call
// the one function, lib/logOut.js, which is what the Profile page's own test (ProfileLogOut.test.jsx) and logOut.test.js look at in detail.
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
const mockUserLogout = jest.fn();
jest.mock('@/store/userStore', () => ({
  useUserStore: () => ({ user: { uid: 'u1' }, logout: mockUserLogout }),
}));
jest.mock('@/store/spotifyStore', () => ({ useSpotifyStore: () => ({ isConnected: false, disconnectSpotify: jest.fn() }) }));
jest.mock('@/store/appleMusicStore', () => ({
  useAppleMusicStore: () => ({ isConnected: false, connectAppleMusic: jest.fn(), disconnectAppleMusic: jest.fn() }),
}));
jest.mock('@/services/spotifyService', () => ({ spotifyService: {} }));
jest.mock('@/services/leaderboardVisibility', () => ({ setShowInLeaderboards: jest.fn() }));
jest.mock('@/services/socialAuth', () => ({ requestAppleAuthorizationCode: jest.fn() }));
jest.mock('../src/config/firebase', () => ({ auth: { currentUser: { uid: 'u1', email: 'cj@example.com', providerData: [] } }, functions: { fake: true } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }), { virtual: true });
jest.mock('firebase/auth', () => ({ sendPasswordResetEmail: jest.fn(), signOut: jest.fn() }), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { clear: jest.fn(), getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: { clearDiskCache: jest.fn(), clearMemoryCache: jest.fn() } }), { virtual: true });
jest.mock('@/lib/meshCache', () => ({ meshCache: { clear: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }), { virtual: true });
jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'standalone', expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-updates', () => ({
  useUpdates: () => ({ isUpdatePending: false }),
  isEnabled: true,
  reloadAsync: jest.fn(),
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(),
  updateId: 'abc',
  channel: 'production',
  runtimeVersion: '1.0.0',
}), { virtual: true });
jest.mock('@/lib/crashReporting', () => ({
  sendTestReport: jest.fn(), forceTestCrash: jest.fn(), isCrashReportingAvailable: () => false,
}));
// The one log out both screens share: here only that Settings calls it, and when.
const mockLogOut = jest.fn();
jest.mock('@/lib/logOut', () => ({ logOut: (...a) => mockLogOut(...a) }));

import { router as mockRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import SettingsScreen from '../app/profile/settings';

let alertSpy;
const lastButtons = () => alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2];

beforeEach(() => {
  jest.clearAllMocks();
  mockLogOut.mockImplementation(async () => {});
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('Log Out in Settings', () => {
  it('asks first, and does nothing until it is confirmed', () => {
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Log Out'));
    expect(alertSpy).toHaveBeenCalledWith('Log Out', 'Are you sure you want to log out?', expect.any(Array));
    expect(mockLogOut).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('Cancel does nothing', () => {
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Log Out'));
    const cancel = lastButtons().find((b) => b.text === 'Cancel');
    expect(cancel.onPress).toBeUndefined();
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it('runs the shared log out once, and opens the login screen only after it has finished', async () => {
    let finished = false;
    let finishedWhenScreenChanged = null;
    mockLogOut.mockImplementation(async () => { await Promise.resolve(); await Promise.resolve(); finished = true; });
    mockRouter.replace.mockImplementation(() => { finishedWhenScreenChanged = finished; });
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Log Out'));
    await act(async () => { await lastButtons().find((b) => b.text === 'Log Out').onPress(); });
    expect(mockLogOut).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login');
    expect(finishedWhenScreenChanged).toBe(true);
  });

  it('leaves the signing out and the clearing to the shared log out, not to a copy of its own', async () => {
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Log Out'));
    await act(async () => { await lastButtons().find((b) => b.text === 'Log Out').onPress(); });
    expect(signOut).not.toHaveBeenCalled();
    expect(mockUserLogout).not.toHaveBeenCalled();
  });
});

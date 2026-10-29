// Settings and the restart for an update. An update downloaded in the background waits for the next launch (services/appUpdates.js).
// Settings used to restart the app by itself the moment an update was waiting, so the first time a tester opened Settings the app
// would have restarted under them. Now it restarts only when the person taps "Check for Updates".
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
  useUserStore: () => ({ user: { uid: 'u1' }, logout: jest.fn() }),
}));
jest.mock('@/store/spotifyStore', () => ({ useSpotifyStore: () => ({ isConnected: false, disconnectSpotify: jest.fn() }) }));
jest.mock('@/store/appleMusicStore', () => ({
  useAppleMusicStore: () => ({ isConnected: false, connectAppleMusic: jest.fn(), disconnectAppleMusic: jest.fn() }),
}));
jest.mock('@/services/spotifyService', () => ({ spotifyService: {} }));
jest.mock('@/services/leaderboardVisibility', () => ({ setShowInLeaderboards: jest.fn() }));
jest.mock('@/services/socialAuth', () => ({ requestAppleAuthorizationCode: jest.fn() }));
jest.mock('../src/config/firebase', () => ({ auth: { currentUser: { uid: 'u1', email: 'cj@example.com', providerData: [] } }, functions: { fake: true } }));
jest.mock('firebase/functions', () => ({ sendPasswordResetEmail: jest.fn(), signOut: jest.fn(), httpsCallable: jest.fn() }), { virtual: true });
jest.mock('firebase/auth', () => ({ sendPasswordResetEmail: jest.fn(), signOut: jest.fn(), httpsCallable: jest.fn() }), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { clear: jest.fn(), getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: { clearDiskCache: jest.fn(), clearMemoryCache: jest.fn() } }), { virtual: true });
jest.mock('@/lib/meshCache', () => ({ meshCache: { clear: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }), { virtual: true });
jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'standalone', expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-updates', () => ({
  useUpdates: () => ({ isUpdatePending: global.__updatePending }),
  isEnabled: true,
  reloadAsync: (...a) => global.__reload(...a),
  checkForUpdateAsync: (...a) => global.__check(...a),
  fetchUpdateAsync: (...a) => global.__fetch(...a),
  updateId: 'abc',
  channel: 'production',
  runtimeVersion: '1.0.0',
}), { virtual: true });
jest.mock('@/lib/crashReporting', () => ({
  sendTestReport: jest.fn(), forceTestCrash: jest.fn(), isCrashReportingAvailable: () => false,
}));

import SettingsScreen from '../app/profile/settings';

const settle = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });

beforeEach(() => {
  global.__updatePending = false;
  global.__reload = jest.fn(async () => {});
  global.__check = jest.fn(async () => ({ isAvailable: false }));
  global.__fetch = jest.fn(async () => ({ isNew: true }));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  ['__updatePending', '__reload', '__check', '__fetch'].forEach((k) => { delete global[k]; });
});

describe('Settings and a downloaded update', () => {
  it('does not restart the app when Settings opens with an update already waiting', async () => {
    global.__updatePending = true;
    render(<SettingsScreen />);
    await settle();
    expect(global.__reload).not.toHaveBeenCalled();
  });

  it('does not restart the app when an update finishes downloading while Settings is open', async () => {
    const utils = render(<SettingsScreen />);
    global.__updatePending = true;
    utils.rerender(<SettingsScreen />);
    await settle();
    expect(global.__reload).not.toHaveBeenCalled();
  });

  it('restarts once, straight away, when the person taps Check for Updates with an update already downloaded', async () => {
    global.__updatePending = true;
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Check for Updates'));
    await settle();
    expect(global.__reload).toHaveBeenCalledTimes(1);
    expect(global.__check).not.toHaveBeenCalled();
  });

  it('restarts once when the person taps Check for Updates, an update is found and it finishes downloading', async () => {
    global.__check = jest.fn(async () => ({ isAvailable: true }));
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Check for Updates'));
    await settle();
    expect(global.__fetch).toHaveBeenCalledTimes(1);
    expect(global.__reload).not.toHaveBeenCalled(); // not until it is downloaded
    global.__updatePending = true;
    utils.rerender(<SettingsScreen />);
    await settle();
    expect(global.__reload).toHaveBeenCalledTimes(1);
  });

  it('says it is up to date, and restarts nothing, when the person checks and there is no update', async () => {
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText('Check for Updates'));
    await settle();
    expect(utils.getByText('Up to date')).toBeTruthy();
    expect(global.__reload).not.toHaveBeenCalled();
  });
});

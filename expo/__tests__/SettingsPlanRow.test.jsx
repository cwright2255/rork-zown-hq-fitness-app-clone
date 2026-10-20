// The "Your plan" row in Settings (app/profile/settings.jsx): says which plan the person has, and opens the plans.
import React from 'react';
import { Alert, Switch } from 'react-native';
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
jest.mock('firebase/firestore', () => ({}));
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
import { useEntitlementStore } from '../store/entitlementStore';

const { router } = require('expo-router');

const plan = (tier, over = {}) => ({ tier, status: 'active', expiresAt: null, source: 'manual', ...over });
const as = (state) => act(() => { useEntitlementStore.setState({ plan: null, isLoaded: true, ...state }); });

beforeEach(() => {
  global.__logout = jest.fn();
  global.__httpsCallable = jest.fn();
  global.__signOut = jest.fn();
  global.__reload = jest.fn();
  global.__clearDisk = jest.fn();
  global.__clearMemory = jest.fn();
  global.__clearMesh = jest.fn();
  router.push.mockClear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('Settings: Your plan', () => {
  it('is in the Account section, and says Free for a person with no plan', () => {
    as({});
    const utils = render(<SettingsScreen />);
    expect(utils.getByText('Your plan')).toBeTruthy();
    expect(utils.getByText('Free. See what each plan includes')).toBeTruthy();
  });

  it('says Pro, or Legend, for a person who has that plan', () => {
    as({ plan: plan('pro') });
    expect(render(<SettingsScreen />).getByText('Pro. See what each plan includes')).toBeTruthy();
    as({ plan: plan('legend') });
    expect(render(<SettingsScreen />).getByText('Legend. See what each plan includes')).toBeTruthy();
  });

  it('says Free once a plan has ended', () => {
    as({ plan: plan('pro', { status: 'expired' }) });
    expect(render(<SettingsScreen />).getByText('Free. See what each plan includes')).toBeTruthy();
  });

  it('opens the plans', () => {
    as({});
    fireEvent.press(render(<SettingsScreen />).getByText('Your plan'));
    expect(router.push).toHaveBeenCalledWith('/paywall');
  });
});

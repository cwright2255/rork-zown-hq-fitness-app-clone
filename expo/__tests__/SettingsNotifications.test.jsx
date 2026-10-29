// Settings > Notifications, Privacy and Units: one real Notifications switch, and none of the rows that were saved and read by nothing.
// Before this build the screen had Workout Reminders, Achievement Alerts, Social Activity, Weekly Summary, Profile Visibility, Activity
// Sharing, Allow Friend Requests, Temperature and Start of Week. Each changed a saved value no part of the app looked at, so they looked
// like they worked and did nothing. The one Notifications switch is read: lib/remindersAllowed.js.
import React from 'react';
import { Switch } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }), { virtual: true });
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'zownhq://spotify-callback', useAuthRequest: () => [null, null, jest.fn()], ResponseType: {} }), { virtual: true });
jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: ({ name }) => mockReact.createElement(mockRn.Text, null, `icon:${name}`) };
}, { virtual: true });
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: () => global.__settings() }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' }, logout: jest.fn() }) }));
jest.mock('@/store/spotifyStore', () => ({ useSpotifyStore: () => ({ isConnected: false, disconnectSpotify: jest.fn() }) }));
jest.mock('@/store/appleMusicStore', () => ({
  useAppleMusicStore: () => ({ isConnected: false, connectAppleMusic: jest.fn(), disconnectAppleMusic: jest.fn() }),
}));
jest.mock('@/services/spotifyService', () => ({ spotifyService: {} }));
jest.mock('@/services/leaderboardVisibility', () => ({ setShowInLeaderboards: jest.fn() }));
jest.mock('../src/config/firebase', () => ({ auth: { currentUser: { uid: 'u1', email: 'cj@example.com' } }, functions: { fake: true } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn(), signOut: jest.fn() }), { virtual: true });
jest.mock('firebase/auth', () => ({ sendPasswordResetEmail: jest.fn(), signOut: jest.fn(), httpsCallable: jest.fn() }), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { clear: jest.fn(), getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: { clearDiskCache: jest.fn(), clearMemoryCache: jest.fn() } }), { virtual: true });
jest.mock('@/lib/meshCache', () => ({ meshCache: { clear: jest.fn() } }));
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

let updateSetting;
let updatePrivacy;
beforeEach(() => {
  updateSetting = jest.fn();
  updatePrivacy = jest.fn();
  global.__settings = () => ({
    units: 'metric', weightUnits: 'kg', privacy: { profilePublic: true, activitySharing: true }, showInLeaderboards: true,
    notifications: true, coachCanAddToCalendar: true, updateSetting, updatePrivacy,
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

const allText = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Text').map((n) => n.props.children).filter((c) => typeof c === 'string' && !/^icon:/.test(c));
const notificationsSwitch = (utils) => utils.getByLabelText('Notifications');

describe('Settings > Notifications', () => {
  it('has the one Notifications switch, saying what it covers', () => {
    const utils = render(<SettingsScreen />);
    expect(utils.UNSAFE_getAllByType(Switch).filter((sw) => sw.props.accessibilityLabel === 'Notifications')).toHaveLength(1);
    expect(utils.getByText('Calendar reminders, fasting goal alerts and cooking timers')).toBeTruthy();
  });

  it('is the only row in the Notifications section', () => {
    const texts = allText(render(<SettingsScreen />));
    const from = texts.findIndex((t) => t === 'Notifications');
    const to = texts.findIndex((t, i) => i > from && /^privacy$/i.test(t));
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(texts.slice(from + 1, to)).toEqual(['Notifications', 'Calendar reminders, fasting goal alerts and cooking timers']);
  });

  it('shows the switch on when the setting is on', () => {
    expect(notificationsSwitch(render(<SettingsScreen />)).props.value).toBe(true);
  });

  it('shows the switch off when the setting is off', () => {
    const base = global.__settings;
    global.__settings = () => ({ ...base(), notifications: false });
    expect(notificationsSwitch(render(<SettingsScreen />)).props.value).toBe(false);
  });

  it('shows the switch on when the setting has never been set, the way the reminders themselves read it', () => {
    const base = global.__settings;
    global.__settings = () => ({ ...base(), notifications: undefined });
    expect(notificationsSwitch(render(<SettingsScreen />)).props.value).toBe(true);
  });

  it('saves "off" to the account when it is turned off, and changes nothing else', () => {
    const utils = render(<SettingsScreen />);
    fireEvent(notificationsSwitch(utils), 'valueChange', false);
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith('notifications', false, 'u1');
    expect(updatePrivacy).not.toHaveBeenCalled();
  });

  it('saves "on" when it is turned on', () => {
    const base = global.__settings;
    global.__settings = () => ({ ...base(), notifications: false });
    const utils = render(<SettingsScreen />);
    fireEvent(notificationsSwitch(utils), 'valueChange', true);
    expect(updateSetting).toHaveBeenCalledWith('notifications', true, 'u1');
  });
});

describe('Settings: the rows that did nothing are gone', () => {
  const GONE = [
    'Push Notifications', 'Workout Reminders', 'Achievement Alerts', 'Social Activity', 'Weekly Summary',
    'Profile Visibility', 'Activity Sharing', 'Allow Friend Requests', 'Temperature', 'Start of Week',
  ];

  it.each(GONE)('has no "%s" row', (label) => {
    const utils = render(<SettingsScreen />);
    expect(utils.queryByText(label)).toBeNull();
    expect(utils.queryByLabelText(label)).toBeNull();
  });

  it('shows no temperature or week-start choices, and none of the garbled degree labels that went with them', () => {
    const texts = allText(render(<SettingsScreen />));
    for (const gone of ['°F', '°C', 'Mon', 'Sun', 'Â°F', 'Â°C']) expect(texts).not.toContain(gone);
    expect(texts.some((t) => /Â/.test(t))).toBe(false);
  });

  it('has no Quiet Hours', () => {
    expect(render(<SettingsScreen />).queryByText(/quiet hours|do not disturb/i)).toBeNull();
  });

  it('keeps the rows that work: distance and weight units, and Show in Leaderboards', () => {
    const utils = render(<SettingsScreen />);
    expect(utils.getByText('Distance Units')).toBeTruthy();
    expect(utils.getByText('Weight Units')).toBeTruthy();
    expect(utils.getByText('Show in Leaderboards')).toBeTruthy();
  });
});

// Settings > AI Coach > "Let the coach add to my calendar": where the switch is, what it shows, and what turning it does.
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

const LABEL = 'Let the coach add to my calendar';
let updateSetting;
beforeEach(() => {
  updateSetting = jest.fn();
  global.__settings = () => ({
    units: 'metric', privacy: {}, showInLeaderboards: true, notifications: true, coachCanAddToCalendar: true,
    updateSetting, updatePrivacy: jest.fn(),
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

const coachSwitch = (utils) => utils.getByLabelText(LABEL);

describe('Settings > AI Coach', () => {
  it('has an AI Coach section with the switch, its calendar icon and what it does', () => {
    const utils = render(<SettingsScreen />);
    expect(utils.getByText('AI Coach')).toBeTruthy();
    expect(utils.getByText(LABEL)).toBeTruthy();
    // Another row also uses the calendar icon, so look for it in this row: the nearest parent of the label that holds an icon.
    let row = utils.getByText(LABEL).parent;
    while (row && row.findAll((n) => n.props && n.props.children === 'icon:calendar-outline').length === 0) row = row.parent;
    expect(row).toBeTruthy();
    expect(row.findAll((n) => n.props && n.props.children === LABEL).length).toBeGreaterThan(0);
    const icons = row.findAll((n) => n.type === 'Text' && typeof n.props.children === 'string' && /^icon:/.test(n.props.children));
    expect(icons.map((n) => n.props.children)).toEqual(['icon:calendar-outline']);
    expect(utils.getByText('When this is off, the coach will not put workouts, runs or meals on your calendar')).toBeTruthy();
    expect(utils.UNSAFE_getAllByType(Switch).filter((sw) => sw.props.accessibilityLabel === LABEL)).toHaveLength(1);
  });

  it('puts the AI Coach section just before Connected Services', () => {
    const utils = render(<SettingsScreen />);
    const texts = utils.UNSAFE_root.findAll((n) => n.type === 'Text').map((n) => n.props.children).filter((c) => typeof c === 'string');
    const coach = texts.findIndex((t) => /^ai coach$/i.test(t));
    const services = texts.findIndex((t) => /^connected services$/i.test(t));
    expect(coach).toBeGreaterThan(-1);
    expect(services).toBe(coach + 1 + texts.slice(coach + 1).findIndex((t) => /^connected services$/i.test(t)));
    expect(texts.slice(coach + 1, services).some((t) => t === LABEL)).toBe(true);
  });

  it('shows the switch on when the setting is on', () => {
    expect(coachSwitch(render(<SettingsScreen />)).props.value).toBe(true);
  });

  it('shows the switch off when the setting is off', () => {
    const base = global.__settings;
    global.__settings = () => ({ ...base(), coachCanAddToCalendar: false });
    expect(coachSwitch(render(<SettingsScreen />)).props.value).toBe(false);
  });

  it('shows the switch on when the setting has never been set', () => {
    const base = global.__settings;
    global.__settings = () => ({ ...base(), coachCanAddToCalendar: undefined });
    expect(coachSwitch(render(<SettingsScreen />)).props.value).toBe(true);
  });

  it('saves "off" to the account when it is turned off', () => {
    const utils = render(<SettingsScreen />);
    fireEvent(coachSwitch(utils), 'valueChange', false);
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith('coachCanAddToCalendar', false, 'u1');
  });

  it('saves "on" to the account when it is turned on', () => {
    const base = global.__settings;
    global.__settings = () => ({ ...base(), coachCanAddToCalendar: false });
    const utils = render(<SettingsScreen />);
    fireEvent(coachSwitch(utils), 'valueChange', true);
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith('coachCanAddToCalendar', true, 'u1');
  });

  it('changes nothing else when it is used', () => {
    const utils = render(<SettingsScreen />);
    fireEvent(coachSwitch(utils), 'valueChange', false);
    expect(updateSetting.mock.calls.map((c) => c[0])).toEqual(['coachCanAddToCalendar']);
  });
});

describe('Settings > AI Coach > What your Coach remembers', () => {
  const ROW = 'What your Coach remembers';

  it('is in the AI Coach section, with the notes icon and what it opens', () => {
    const utils = render(<SettingsScreen />);
    const texts = utils.UNSAFE_root.findAll((n) => n.type === 'Text').map((n) => n.props.children).filter((c) => typeof c === 'string');
    const coach = texts.findIndex((t) => /^ai coach$/i.test(t));
    const services = coach + 1 + texts.slice(coach + 1).findIndex((t) => /^connected services$/i.test(t));
    expect(texts.slice(coach + 1, services)).toContain(ROW);
    expect(texts.slice(coach + 1, services)).toContain('See, remove or forget the notes your coach keeps about you');
    let row = utils.getByText(ROW).parent;
    while (row && row.findAll((n) => n.props && n.props.children === 'icon:bulb-outline').length === 0) row = row.parent;
    expect(row).toBeTruthy();
  });

  it('opens the screen where the notes can be seen, removed and forgotten', () => {
    const { router } = require('expo-router');
    const utils = render(<SettingsScreen />);
    fireEvent.press(utils.getByText(ROW));
    expect(router.push).toHaveBeenCalledWith('/profile/coach-memory');
  });
});

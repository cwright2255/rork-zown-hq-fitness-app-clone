// Profile > Notifications (app/profile/notifications.jsx). It had five toggles (workout, achievement, social, nutrition and weekly
// summary) and a Quiet Hours card, and none of them did anything: the toggles saved values nothing read, and Quiet Hours was a card
// that opened nothing. It now has the one switch the app's reminders actually follow (lib/remindersAllowed.js).
import React from 'react';
import { Switch } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
const mockSettings = { current: {} };
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: (sel) => (sel ? sel(mockSettings.current) : mockSettings.current) }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));

import { router as mockRouter } from 'expo-router';
import NotificationsSettingsScreen from '../app/profile/notifications';

let updateSetting;
beforeEach(() => {
  jest.clearAllMocks();
  updateSetting = jest.fn();
  mockSettings.current = { notifications: true, updateSetting };
});

describe('Profile > Notifications', () => {
  it('has one switch, and says what it covers', () => {
    const utils = render(<NotificationsSettingsScreen />);
    expect(utils.UNSAFE_getAllByType(Switch)).toHaveLength(1);
    expect(utils.getByLabelText('Notifications')).toBeTruthy();
    expect(utils.getByText(/calendar reminders, the alert when a fast reaches its goal, and cooking timers/)).toBeTruthy();
  });

  it('says that the phone\'s own Settings also have to allow notifications', () => {
    expect(render(<NotificationsSettingsScreen />).getByText(/also need notifications allowed for Zown HQ in your phone's Settings/)).toBeTruthy();
  });

  it('is on when the setting is on, and says so', () => {
    const utils = render(<NotificationsSettingsScreen />);
    expect(utils.getByLabelText('Notifications').props.value).toBe(true);
    expect(utils.getByText('On. Zown HQ will set the alerts above.')).toBeTruthy();
  });

  it('is off when the setting is off, and says the ones already set are cleared', () => {
    mockSettings.current = { notifications: false, updateSetting };
    const utils = render(<NotificationsSettingsScreen />);
    expect(utils.getByLabelText('Notifications').props.value).toBe(false);
    expect(utils.getByText(/^Off\. Zown HQ will not set any of them/)).toBeTruthy();
  });

  it('is on when the setting has never been set, the way the reminders themselves read it', () => {
    mockSettings.current = { updateSetting };
    expect(render(<NotificationsSettingsScreen />).getByLabelText('Notifications').props.value).toBe(true);
  });

  it('saves "off" to the account when it is turned off', () => {
    const utils = render(<NotificationsSettingsScreen />);
    fireEvent(utils.getByLabelText('Notifications'), 'valueChange', false);
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith('notifications', false, 'u1');
  });

  it('saves "on" when it is turned on', () => {
    mockSettings.current = { notifications: false, updateSetting };
    const utils = render(<NotificationsSettingsScreen />);
    fireEvent(utils.getByLabelText('Notifications'), 'valueChange', true);
    expect(updateSetting).toHaveBeenCalledWith('notifications', true, 'u1');
  });

  it('goes back with the arrow', () => {
    const utils = render(<NotificationsSettingsScreen />);
    fireEvent.press(utils.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it.each([
    'Workout Reminders', 'Achievement Alerts', 'Social Activity', 'Nutrition Reminders', 'Weekly Summary', 'Quiet Hours', 'Do Not Disturb',
  ])('no longer has "%s"', (label) => {
    expect(render(<NotificationsSettingsScreen />).queryByText(label)).toBeNull();
  });

  it('shows no time range that the app does not keep', () => {
    expect(render(<NotificationsSettingsScreen />).queryByText(/10:00 PM|7:00 AM/)).toBeNull();
  });
});

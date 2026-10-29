// The Notifications switch (Settings, and the Notifications screen) is the `notifications` setting. It used to change a saved value
// that nothing read, so turning it off changed nothing. The three things that set a reminder on the phone now ask it first
// (lib/remindersAllowed.js): the calendar's reminders, the alert when a fast reaches its goal, and the cooking timer.
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}), { virtual: true });
jest.mock('../services/notificationService', () => ({
  notificationService: {
    cancelNotificationsByType: jest.fn(async () => undefined),
    hasPermission: jest.fn(async () => true),
    scheduleCalendarReminder: jest.fn(async () => 'n-id'),
    requestPermissions: jest.fn(async () => true),
  },
}));

import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationService';
import { remindersAllowed } from '../lib/remindersAllowed';
import { scheduleFastAlert } from '../services/fastingAlert';
import { scheduleTimerAlert } from '../services/cookTimerAlert';
import { reconcileReminders } from '../services/calendarReminders';
import { useScheduleStore } from '../store/scheduleStore';
import { useSettingsStore } from '../store/settingsStore';

const H = 3600000;
const NOW = new Date(2026, 9, 19, 8, 0);
const turn = (on) => useSettingsStore.setState({ notifications: on });
const event = {
  id: 'e1', title: 'Leg day', kind: 'workout', start: new Date(2026, 9, 20, 7, 0).toISOString(), notes: '', workoutId: null, repeat: null,
  remindMinutes: 30, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z',
};

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.scheduleNotificationAsync.mockResolvedValue('alert-1');
  Notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  notificationService.hasPermission.mockResolvedValue(true);
  notificationService.scheduleCalendarReminder.mockResolvedValue('n-id');
  notificationService.cancelNotificationsByType.mockResolvedValue(undefined);
  useScheduleStore.setState({ events: [event] });
  turn(true);
});
afterEach(() => warn.mockRestore());

describe('remindersAllowed', () => {
  it('is yes when the switch is on', () => {
    turn(true);
    expect(remindersAllowed()).toBe(true);
  });

  it('is no only when the switch has been turned off', () => {
    turn(false);
    expect(remindersAllowed()).toBe(false);
  });

  it('is yes when nothing has been saved yet, so a new install gets its reminders', () => {
    turn(undefined);
    expect(remindersAllowed()).toBe(true);
  });

  it('follows the switch as it is turned off and on again', () => {
    turn(false);
    expect(remindersAllowed()).toBe(false);
    useSettingsStore.getState().updateSetting('notifications', true);
    expect(remindersAllowed()).toBe(true);
  });
});

describe('the fasting goal alert', () => {
  const fast = { startedAt: new Date(NOW.getTime() - 6 * H), targetHours: 16 };

  it('is set while the switch is on', async () => {
    expect(await scheduleFastAlert(fast, { now: NOW })).toBe('scheduled');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('is not set with the switch off, and says so; the phone is not even asked for permission', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    turn(false);
    expect(await scheduleFastAlert(fast, { now: NOW, ask: true })).toBe('turned-off');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('clears the one set earlier when it is asked again with the switch off', async () => {
    turn(false);
    await scheduleFastAlert(fast, { now: NOW });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('zown-fasting-goal');
  });
});

describe('the cooking timer alert', () => {
  it('is set while the switch is on', async () => {
    expect(await scheduleTimerAlert(600, { title: 'Timer done', body: 'Chili' })).toBe('alert-1');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('is not set with the switch off', async () => {
    turn(false);
    expect(await scheduleTimerAlert(600, { title: 'Timer done', body: 'Chili' })).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('the calendar reminders', () => {
  it('are set while the switch is on', async () => {
    expect(await reconcileReminders(NOW)).toEqual({ scheduled: 1, blocked: false });
    expect(notificationService.scheduleCalendarReminder).toHaveBeenCalledTimes(1);
  });

  it('are cleared and none are set with the switch off, and it is not reported as blocked', async () => {
    turn(false);
    expect(await reconcileReminders(NOW)).toEqual({ scheduled: 0, blocked: false });
    expect(notificationService.cancelNotificationsByType).toHaveBeenCalledWith('schedule-event');
    expect(notificationService.hasPermission).not.toHaveBeenCalled();
    expect(notificationService.scheduleCalendarReminder).not.toHaveBeenCalled();
  });

  it('are set again once the switch is back on', async () => {
    turn(false);
    await reconcileReminders(NOW);
    turn(true);
    expect(await reconcileReminders(NOW)).toEqual({ scheduled: 1, blocked: false });
  });
});

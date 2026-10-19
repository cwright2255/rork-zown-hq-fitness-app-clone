// The two notification calls the calendar's reminders use (services/notificationService.js).
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'scheduled-id'),
}));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationService';

const FUTURE = () => new Date(Date.now() + 3600 * 1000);
const realOS = Platform.OS;
let warn;
beforeEach(() => {
  jest.clearAllMocks();
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.scheduleNotificationAsync.mockResolvedValue('scheduled-id');
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  Platform.OS = 'ios';
});
afterEach(() => { Platform.OS = realOS; warn.mockRestore(); });

describe('hasPermission', () => {
  it('is true when notifications are allowed, and false when they are not or have not been asked for', async () => {
    expect(await notificationService.hasPermission()).toBe(true);
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await notificationService.hasPermission()).toBe(false);
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    expect(await notificationService.hasPermission()).toBe(false);
  });

  it('is false on the web, and when the phone can not say', async () => {
    Platform.OS = 'web';
    expect(await notificationService.hasPermission()).toBe(false);
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    Platform.OS = 'ios';
    Notifications.getPermissionsAsync.mockRejectedValue(new Error('boom'));
    expect(await notificationService.hasPermission()).toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});

describe('scheduleCalendarReminder', () => {
  it('sets one reminder at the time given, marked as a calendar reminder for that event', async () => {
    const when = FUTURE();
    const id = await notificationService.scheduleCalendarReminder({ title: 'In 30 min', body: 'Leg day at 7:00 AM' }, when, 'e1');
    expect(id).toBe('scheduled-id');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'In 30 min', body: 'Leg day at 7:00 AM', data: { type: 'schedule-event', eventId: 'e1' } },
      trigger: { type: 'date', date: when },
    });
  });

  it('sets nothing for a time that has passed or is not a time', async () => {
    expect(await notificationService.scheduleCalendarReminder({ title: 'a', body: 'b' }, new Date(Date.now() - 1000), 'e1')).toBeNull();
    expect(await notificationService.scheduleCalendarReminder({ title: 'a', body: 'b' }, new Date('x'), 'e1')).toBeNull();
    expect(await notificationService.scheduleCalendarReminder({ title: 'a', body: 'b' }, '2030-01-01', 'e1')).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('sets nothing on the web', async () => {
    Platform.OS = 'web';
    expect(await notificationService.scheduleCalendarReminder({ title: 'a', body: 'b' }, FUTURE(), 'e1')).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('says nothing was set when the phone refuses', async () => {
    Notifications.scheduleNotificationAsync.mockRejectedValue(new Error('limit'));
    expect(await notificationService.scheduleCalendarReminder({ title: 'a', body: 'b' }, FUTURE(), 'e1')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[notificationService] scheduleCalendarReminder failed:', 'limit');
  });
});

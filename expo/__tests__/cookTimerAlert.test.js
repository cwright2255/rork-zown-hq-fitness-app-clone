jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}), { virtual: true });
// The Notifications switch is looked at in remindersSwitch.test.js; here it is on.
jest.mock('../lib/remindersAllowed', () => ({ remindersAllowed: () => true }));

import * as Notifications from 'expo-notifications';
import { cancelTimerAlert, scheduleTimerAlert } from '../services/cookTimerAlert';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  Notifications.getPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  Notifications.scheduleNotificationAsync.mockReset().mockResolvedValue('alert-1');
  Notifications.cancelScheduledNotificationAsync.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('scheduleTimerAlert', () => {
  it('rings after the time is up', async () => {
    const id = await scheduleTimerAlert(600, { title: 'Timer done', body: 'Chili, step 3' });
    expect(id).toBe('alert-1');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Timer done', body: 'Chili, step 3', sound: true, data: { type: 'cooking-timer' } },
      trigger: { type: 'timeInterval', seconds: 600, repeats: false },
    });
  });

  it('rounds to whole seconds, and never to less than one', async () => {
    await scheduleTimerAlert(90.4, {});
    expect(Notifications.scheduleNotificationAsync.mock.calls[0][0].trigger.seconds).toBe(90);
    await scheduleTimerAlert(90.6, {});
    expect(Notifications.scheduleNotificationAsync.mock.calls[1][0].trigger.seconds).toBe(91);
    await scheduleTimerAlert(0.2, {});
    expect(Notifications.scheduleNotificationAsync.mock.calls[2][0].trigger.seconds).toBe(1);
    await scheduleTimerAlert(0, {});
    expect(Notifications.scheduleNotificationAsync.mock.calls[3][0].trigger.seconds).toBe(1);
  });

  it('works without a title or body', async () => {
    expect(await scheduleTimerAlert(30)).toBe('alert-1');
    expect(Notifications.scheduleNotificationAsync.mock.calls[0][0].content.title).toBeUndefined();
  });

  it.each([['denied'], ['undetermined']])('does not ask for permission, and does nothing if it is %s', async (status) => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status });
    expect(await scheduleTimerAlert(600, { title: 't', body: 'b' })).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('gives up quietly when it can not check or schedule', async () => {
    Notifications.getPermissionsAsync.mockRejectedValue(new Error('no'));
    expect(await scheduleTimerAlert(600, {})).toBeNull();
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Notifications.scheduleNotificationAsync.mockRejectedValue(new Error('no'));
    expect(await scheduleTimerAlert(600, {})).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});

describe('cancelTimerAlert', () => {
  it('cancels the alert', async () => {
    await cancelTimerAlert('alert-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('alert-1');
  });

  it('does nothing for an alert that was never scheduled', async () => {
    await cancelTimerAlert(null);
    await cancelTimerAlert(undefined);
    await cancelTimerAlert('');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('carries on if the phone will not cancel', async () => {
    Notifications.cancelScheduledNotificationAsync.mockRejectedValue(new Error('no'));
    await expect(cancelTimerAlert('alert-1')).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

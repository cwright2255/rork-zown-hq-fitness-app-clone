jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}), { virtual: true });
// The Notifications switch is looked at in remindersSwitch.test.js; here it is on.
jest.mock('../lib/remindersAllowed', () => ({ remindersAllowed: () => true }));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { FAST_ALERT_ID, scheduleFastAlert, cancelFastAlert } from '../services/fastingAlert';

const H = 3600000;
const NOW = new Date(2026, 9, 12, 14, 0, 0);
const started = (hoursAgo) => new Date(NOW.getTime() - hoursAgo * H);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  Notifications.getPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted', canAskAgain: true });
  Notifications.requestPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  Notifications.scheduleNotificationAsync.mockReset().mockResolvedValue(FAST_ALERT_ID);
  Notifications.cancelScheduledNotificationAsync.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('scheduleFastAlert', () => {
  it('rings once, at the moment the goal is reached, under a fixed id', async () => {
    const status = await scheduleFastAlert({ startedAt: started(6), targetHours: 16 }, { now: NOW });
    expect(status).toBe('scheduled');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'zown-fasting-goal',
      content: {
        title: 'You hit your fasting goal',
        body: "You've fasted 16h. Open Zown HQ to end your fast.",
        sound: true,
        data: { type: 'fasting-goal' },
      },
      trigger: { type: 'date', date: new Date(NOW.getTime() + 10 * H) },
    });
  });

  it('names the plan hours in the message', async () => {
    await scheduleFastAlert({ startedAt: started(1), targetHours: 23 }, { now: NOW });
    expect(Notifications.scheduleNotificationAsync.mock.calls[0][0].content.body).toBe("You've fasted 23h. Open Zown HQ to end your fast.");
  });

  it('clears any earlier alert first, so a moved start time does not ring twice', async () => {
    const order = [];
    Notifications.cancelScheduledNotificationAsync.mockImplementation(async () => { order.push('cancel'); });
    Notifications.scheduleNotificationAsync.mockImplementation(async () => { order.push('schedule'); });
    await scheduleFastAlert({ startedAt: started(6), targetHours: 16 }, { now: NOW });
    expect(order).toEqual(['cancel', 'schedule']);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('zown-fasting-goal');
  });

  it('schedules nothing, and clears the old alert, when the goal time has already passed', async () => {
    expect(await scheduleFastAlert({ startedAt: started(20), targetHours: 16 }, { now: NOW })).toBe('already-reached');
    expect(await scheduleFastAlert({ startedAt: started(16), targetHours: 16 }, { now: NOW })).toBe('already-reached');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('does not ask for permission unless told to, and does nothing without it', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    expect(await scheduleFastAlert({ startedAt: started(1), targetHours: 16 }, { now: NOW })).toBe('not-allowed');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('asks when told to, and rings if the person says yes', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    expect(await scheduleFastAlert({ startedAt: started(1), targetHours: 16 }, { ask: true, now: NOW })).toBe('scheduled');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('does nothing if the person says no', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await scheduleFastAlert({ startedAt: started(1), targetHours: 16 }, { ask: true, now: NOW })).toBe('not-allowed');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not ask again when the phone says it will not show the prompt', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    expect(await scheduleFastAlert({ startedAt: started(1), targetHours: 16 }, { ask: true, now: NOW })).toBe('blocked');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('gives up quietly when the phone will not schedule it', async () => {
    Notifications.scheduleNotificationAsync.mockRejectedValue(new Error('no'));
    expect(await scheduleFastAlert({ startedAt: started(1), targetHours: 16 }, { now: NOW })).toBe('unavailable');
    Notifications.getPermissionsAsync.mockRejectedValue(new Error('no'));
    expect(await scheduleFastAlert({ startedAt: started(1), targetHours: 16 }, { now: NOW })).toBe('unavailable');
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  describe('on the web', () => {
    const original = Platform.OS;
    beforeEach(() => { Platform.OS = 'web'; });
    afterEach(() => { Platform.OS = original; });

    it('does nothing', async () => {
      expect(await scheduleFastAlert({ startedAt: started(1), targetHours: 16 }, { ask: true, now: NOW })).toBe('unavailable');
      await cancelFastAlert();
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });
});

describe('cancelFastAlert', () => {
  it('cancels the one alert by its id', async () => {
    await cancelFastAlert();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('zown-fasting-goal');
  });

  it('carries on if the phone will not cancel', async () => {
    Notifications.cancelScheduledNotificationAsync.mockRejectedValue(new Error('no'));
    await expect(cancelFastAlert()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

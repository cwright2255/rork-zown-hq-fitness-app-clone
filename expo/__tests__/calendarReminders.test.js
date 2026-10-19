// Keeping the phone's reminders in step with the calendar (services/calendarReminders.js).
// jest.global-setup.js pins the time zone to America/New_York.
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/notificationService', () => ({
  notificationService: {
    cancelNotificationsByType: jest.fn(async () => undefined),
    hasPermission: jest.fn(async () => true),
    scheduleCalendarReminder: jest.fn(async () => 'n-id'),
    requestPermissions: jest.fn(async () => true),
  },
}));

import { notificationService } from '../services/notificationService';
import { reconcileReminders, askForReminderPermission } from '../services/calendarReminders';
import { useScheduleStore } from '../store/scheduleStore';

const NOW = new Date(2026, 9, 19, 8, 0);
const event = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: new Date(2026, 9, 20, 7, 0).toISOString(), notes: '', workoutId: null, repeat: null,
  remindMinutes: 30, doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  notificationService.hasPermission.mockResolvedValue(true);
  notificationService.scheduleCalendarReminder.mockResolvedValue('n-id');
  notificationService.cancelNotificationsByType.mockResolvedValue(undefined);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  useScheduleStore.setState({ events: [] });
});
afterEach(() => warn.mockRestore());

describe('reconcileReminders', () => {
  it('clears the calendar\'s reminders, then sets the next ones with their words and time', async () => {
    useScheduleStore.setState({ events: [event(), event({ id: 'e2', title: 'Easy run', kind: 'run', start: new Date(2026, 9, 21, 6, 0).toISOString(), remindMinutes: 0 })] });
    const result = await reconcileReminders(NOW);
    expect(result).toEqual({ scheduled: 2, blocked: false });
    expect(notificationService.cancelNotificationsByType).toHaveBeenCalledWith('schedule-event');
    const calls = notificationService.scheduleCalendarReminder.mock.calls;
    expect(calls[0][0]).toEqual({ title: 'In 30 min', body: 'Leg day at 7:00 AM' });
    expect(calls[0][1]).toEqual(new Date(2026, 9, 20, 6, 30));
    expect(calls[0][2]).toBe('e1');
    expect(calls[1][0]).toEqual({ title: 'Run time', body: 'Easy run' });
    expect(calls[1][2]).toBe('e2');
    // Cleared before anything was set.
    expect(notificationService.cancelNotificationsByType.mock.invocationCallOrder[0])
      .toBeLessThan(notificationService.scheduleCalendarReminder.mock.invocationCallOrder[0]);
  });

  it('sets one reminder for each day of a repeat', async () => {
    useScheduleStore.setState({ events: [event({ repeat: { every: 'day', until: '2026-10-22' } })] });
    expect((await reconcileReminders(NOW)).scheduled).toBe(3);
  });

  it('clears the reminders of an event that was removed, and sets none', async () => {
    const result = await reconcileReminders(NOW);
    expect(result).toEqual({ scheduled: 0, blocked: false });
    expect(notificationService.cancelNotificationsByType).toHaveBeenCalledTimes(1);
    expect(notificationService.hasPermission).not.toHaveBeenCalled();
    expect(notificationService.scheduleCalendarReminder).not.toHaveBeenCalled();
  });

  it('sets none for events with no reminder, ticked off days, or a reminder time already past', async () => {
    useScheduleStore.setState({ events: [
      event({ id: 'none', remindMinutes: null }),
      event({ id: 'done', doneDates: ['2026-10-20'] }),
      event({ id: 'past', start: new Date(2026, 9, 19, 8, 10).toISOString(), remindMinutes: 30 }),
    ] });
    expect(await reconcileReminders(NOW)).toEqual({ scheduled: 0, blocked: false });
  });

  it('says so, and sets nothing, when notifications are off', async () => {
    notificationService.hasPermission.mockResolvedValue(false);
    useScheduleStore.setState({ events: [event()] });
    expect(await reconcileReminders(NOW)).toEqual({ scheduled: 0, blocked: true });
    expect(notificationService.scheduleCalendarReminder).not.toHaveBeenCalled();
  });

  it('counts only the reminders the phone accepted', async () => {
    notificationService.scheduleCalendarReminder.mockResolvedValueOnce(null).mockResolvedValue('n-id');
    useScheduleStore.setState({ events: [event({ repeat: { every: 'day', until: '2026-10-22' } })] });
    expect((await reconcileReminders(NOW)).scheduled).toBe(2);
  });

  it('never throws, and the next run still works', async () => {
    useScheduleStore.setState({ events: [event()] });
    notificationService.cancelNotificationsByType.mockRejectedValueOnce(new Error('denied'));
    expect(await reconcileReminders(NOW)).toEqual({ scheduled: 0, blocked: false });
    expect(warn).toHaveBeenCalledWith('[calendarReminders] could not set reminders:', 'denied');
    expect((await reconcileReminders(NOW)).scheduled).toBe(1);
  });

  it('runs one at a time, in order, and the last run sets what the calendar holds', async () => {
    useScheduleStore.setState({ events: [event()] });
    let release;
    notificationService.cancelNotificationsByType.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const first = reconcileReminders(NOW);
    useScheduleStore.setState({ events: [event({ title: 'Changed' })] });
    const second = reconcileReminders(NOW);
    await Promise.resolve();
    expect(notificationService.cancelNotificationsByType).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(notificationService.cancelNotificationsByType).toHaveBeenCalledTimes(2);
    const bodies = notificationService.scheduleCalendarReminder.mock.calls.map(([c]) => c.body);
    expect(bodies[bodies.length - 1]).toBe('Changed at 7:00 AM');
  });
});

describe('askForReminderPermission', () => {
  it('asks the phone, and says whether it was allowed', async () => {
    expect(await askForReminderPermission()).toBe(true);
    notificationService.requestPermissions.mockResolvedValueOnce(false);
    expect(await askForReminderPermission()).toBe(false);
  });

  it('says no when asking fails', async () => {
    notificationService.requestPermissions.mockRejectedValueOnce(new Error('x'));
    expect(await askForReminderPermission()).toBe(false);
  });
});

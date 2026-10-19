// What happens on the calendar when the person says yes to the coach's plan (services/coachActionService.js).
// jest.global-setup.js pins the time zone to America/New_York.
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/calendarReminders', () => ({
  askForReminderPermission: jest.fn(async () => true),
  reconcileReminders: jest.fn(async () => ({ scheduled: 0, blocked: false })),
}));
jest.mock('../store/workoutStore', () => ({ useWorkoutStore: { getState: () => ({ addWorkout: global.__addWorkout }) } }));
jest.mock('../store/nutritionStore', () => ({ useNutritionStore: { getState: () => ({ updateDailyGoals: jest.fn() }), setState: jest.fn() } }));
jest.mock('../store/goalsStore', () => ({ useGoalsStore: { getState: () => ({ addGoal: jest.fn() }) } }));

import { askForReminderPermission, reconcileReminders } from '../services/calendarReminders';
import { executeCoachActions } from '../services/coachActionService';
import { useScheduleStore } from '../store/scheduleStore';

const iso = (d, h, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const user = { uid: 'u1' };

let warn;
beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 19, 8, 0), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.clearAllMocks();
  askForReminderPermission.mockResolvedValue(true);
  reconcileReminders.mockResolvedValue({ scheduled: 2, blocked: false });
  global.__addWorkout = jest.fn(async (w) => ({ id: w.id }));
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  useScheduleStore.setState({ events: [] });
});
afterEach(() => { jest.useRealTimers(); warn.mockRestore(); });

const schedule = (events) => ({ type: 'schedule', events });
const run = { title: 'Easy run', kind: 'run', start: iso(21, 6, 30), notes: '', workoutName: '' };
const lift = { title: 'Leg day', kind: 'workout', start: iso(22, 7, 0), notes: 'Heavy', workoutName: 'Legs' };

describe('a schedule the person said yes to', () => {
  it('puts each event on the calendar, as the coach\'s, with a reminder at its time, then sets the phone\'s reminders', async () => {
    const result = await executeCoachActions([schedule([run, lift])], user);
    expect(result.message).toBe('Done - I added 2 events to your calendar.');
    expect(result.links).toEqual([{ label: 'Open Calendar', route: '/calendar' }]);
    expect(useScheduleStore.getState().events.map((e) => [e.title, e.source, e.remindMinutes, e.repeat])).toEqual([
      ['Easy run', 'coach', 0, null],
      ['Leg day', 'coach', 0, null],
    ]);
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
    expect(reconcileReminders.mock.invocationCallOrder[0]).toBeGreaterThan(askForReminderPermission.mock.invocationCallOrder[0]);
  });

  it('counts only the events that were kept, when some are too old to keep', async () => {
    const result = await executeCoachActions([schedule([run, { ...lift, start: new Date(2026, 5, 1, 7, 0).toISOString() }])], user);
    expect(result.message).toBe('Done - I added 1 event to your calendar.');
    expect(useScheduleStore.getState().events).toHaveLength(1);
  });

  it('asks for permission to send reminders before setting them, once', async () => {
    await executeCoachActions([schedule([run, lift])], user);
    expect(askForReminderPermission).toHaveBeenCalledTimes(1);
  });

  it('does not ask when no reminder is coming (events that are all in the past)', async () => {
    await executeCoachActions([schedule([{ ...run, start: iso(18, 6, 30) }])], user);
    expect(askForReminderPermission).not.toHaveBeenCalled();
    expect(useScheduleStore.getState().events).toHaveLength(1);
  });

  it('links a workout to the workout the same plan saved under that name', async () => {
    await executeCoachActions([
      { type: 'workout_plan', workouts: [{ name: 'Legs', exercises: [] }] },
      schedule([lift]),
    ], user);
    const saved = global.__addWorkout.mock.calls[0][0];
    expect(useScheduleStore.getState().events[0].workoutId).toBe(saved.id);
  });

  it('tells the person when notifications are off for ZOWN, since they will get no reminder', async () => {
    reconcileReminders.mockResolvedValue({ scheduled: 0, blocked: true });
    const { message } = await executeCoachActions([schedule([run])], user);
    expect(message).toContain('Notifications are off for ZOWN');
  });

  it('does not say that for a plan with nothing to remind about, even when notifications are off', async () => {
    reconcileReminders.mockResolvedValue({ scheduled: 0, blocked: true });
    const { message } = await executeCoachActions([schedule([{ ...run, start: iso(18, 6, 30) }])], user);
    expect(message).not.toContain('Notifications are off');
  });

  it('reports a failure when nothing could be added, and does not say it was added', async () => {
    useScheduleStore.setState({ events: [] });
    const result = await executeCoachActions([schedule([{ ...run, start: new Date(2026, 5, 1, 6, 0).toISOString() }])], user);
    expect(result.failures).toEqual(['schedule']);
    expect(result.message).toMatch(/couldn't save that/);
    expect(useScheduleStore.getState().events).toEqual([]);
  });
});

describe('meals from a nutrition plan', () => {
  const meal = (d, h, title) => ({ title, kind: 'nutrition', start: iso(d, h), notes: '', workoutName: '' });

  it('go on the calendar with no reminder, so a plan of meals does not fill the phone\'s reminders', async () => {
    const result = await executeCoachActions([{ type: 'nutrition_plan', dailyGoals: {}, meals: [meal(21, 8, 'Oats'), meal(21, 12, 'Salad')] }], user);
    expect(result.message).toBe('Done - I added 2 meals to your calendar.');
    expect(useScheduleStore.getState().events.map((e) => [e.title, e.kind, e.remindMinutes])).toEqual([['Oats', 'nutrition', null], ['Salad', 'nutrition', null]]);
    expect(askForReminderPermission).not.toHaveBeenCalled();
    expect(result.links).toEqual([{ label: 'Open Calendar', route: '/calendar' }]);
  });
});

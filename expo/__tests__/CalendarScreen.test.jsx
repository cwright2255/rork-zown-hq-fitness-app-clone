// The calendar screen (app/calendar.jsx): the month grid, the selected day, the week, goals and what is coming up, and adding,
// changing, ticking off and removing events. jest.global-setup.js pins the time zone to America/New_York.
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 5, left: 0, right: 0 }),
}), { virtual: true });
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params || {},
  router: {
    back: (...a) => global.__router.back(...a),
    replace: (...a) => global.__router.replace(...a),
    push: (...a) => global.__router.push(...a),
    canGoBack: () => true,
  },
}), { virtual: true });
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, rightAction }) =>
      mockReact.createElement(mockRn.View, null, mockReact.createElement(mockRn.Text, { testID: 'header-title' }, title), rightAction),
  };
});
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(async () => undefined) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/services/calendarReminders', () => ({
  askForReminderPermission: jest.fn(async () => true),
  reconcileReminders: jest.fn(async () => ({ scheduled: 1, blocked: false })),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: (sel) => sel({ user: global.__user }) }));
jest.mock('@/store/goalsStore', () => {
  const hook = (sel) => sel(global.__goals);
  hook.getState = () => global.__goals;
  return { useGoalsStore: hook };
});
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: (sel) => sel({ workouts: global.__workouts }) }));
jest.mock('@/services/streakService', () => ({ useActivityDays: () => global.__activeDays }));

import CalendarScreen from '../app/calendar';
import { useScheduleStore } from '../store/scheduleStore';
import { useMealPlanStore } from '../store/mealPlanStore';
import { askForReminderPermission, reconcileReminders } from '../services/calendarReminders';

// Mon 19 Oct 2026, noon in New York.
const NOON = new Date(2026, 9, 19, 12, 0);
const at = (d, h = 7, mi = 0) => new Date(2026, 9, d, h, mi).toISOString();
const event = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: at(20), notes: '', workoutId: null, repeat: null, remindMinutes: 30,
  doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});
const planEntry = (o = {}) => ({ id: 'p1', date: '2026-10-22', slot: 'lunch', kind: 'recipe', refId: 'r1', name: 'Chili', servings: 1, per: {}, hasNutrition: true, updatedAt: '', ...o });

let alert;
const open = (events = [], extra = {}) => {
  // A screen from an earlier render in the same test is still on show, so the stores are changed inside act.
  act(() => {
    useScheduleStore.setState({ events, startSync: jest.fn(async () => undefined) });
    if (extra.entries) useMealPlanStore.setState({ entries: extra.entries });
  });
  return render(<CalendarScreen />);
};
const flush = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }); };
const events = () => useScheduleStore.getState().events;
const pressAlert = async (label, callIndex = 0) => {
  const buttons = alert.mock.calls[callIndex][2];
  await act(async () => { buttons.find((b) => b.text === label).onPress(); });
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.clearAllMocks();
  askForReminderPermission.mockResolvedValue(true);
  reconcileReminders.mockResolvedValue({ scheduled: 1, blocked: false });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  global.__router = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
  global.__params = {};
  global.__user = { uid: 'u1' };
  global.__goals = { goals: [], loadGoals: jest.fn(async () => undefined) };
  global.__workouts = [];
  global.__activeDays = [];
  useMealPlanStore.setState({ entries: [], startSync: jest.fn(async () => undefined) });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('the month and the selected day', () => {
  it('opens on today, with the month and the day named', () => {
    const { getByTestId, getByText } = open();
    expect(getByTestId('header-title').props.children).toBe('Calendar');
    expect(getByTestId('month-label').props.children.join('')).toBe('October 2026');
    expect(getByText('October 19, 2026')).toBeTruthy();
    expect(getByTestId('day-2026-10-19').props.accessibilityState.selected).toBe(true);
  });

  it('opens on the day it is asked for, and on today when that is not a day', () => {
    global.__params = { date: '2026-11-05' };
    expect(open().getByText('November 5, 2026')).toBeTruthy();
    global.__params = { date: 'soon' };
    expect(open().getAllByText('October 19, 2026').length).toBeGreaterThan(0);
  });

  it('goes to the next and the previous month, starting on the 1st, and back to today', () => {
    const { getByTestId, getByText, queryByTestId } = open();
    expect(queryByTestId('calendar-today')).toBeNull();
    fireEvent.press(getByTestId('month-next'));
    expect(getByTestId('month-label').props.children.join('')).toBe('November 2026');
    expect(getByText('November 1, 2026')).toBeTruthy();
    fireEvent.press(getByTestId('month-prev'));
    fireEvent.press(getByTestId('month-prev'));
    expect(getByText('September 1, 2026')).toBeTruthy();
    fireEvent.press(getByTestId('calendar-today'));
    expect(getByText('October 19, 2026')).toBeTruthy();
  });

  it('goes across the year', () => {
    global.__params = { date: '2026-12-10' };
    const { getByTestId, getByText } = open();
    fireEvent.press(getByTestId('month-next'));
    expect(getByText('January 1, 2027')).toBeTruthy();
  });

  it('marks the days with a workout, a meal, a goal or anything else, and every day of a repeat', () => {
    global.__goals = { goals: [{ id: 'g1', title: 'Run 50 km', deadline: '2026-10-25', current: 10, target: 50, unit: 'km' }], loadGoals: jest.fn() };
    const { queryByTestId } = open(
      [event(), event({ id: 'e2', kind: 'other', title: 'Dentist', start: at(27, 9) }), event({ id: 'e3', title: 'Daily', start: at(28), repeat: { every: 'day', until: '2026-10-29' } })],
      { entries: [planEntry()] }
    );
    expect(queryByTestId('dot-2026-10-20-workout')).toBeTruthy();
    expect(queryByTestId('dot-2026-10-22-meal')).toBeTruthy();
    expect(queryByTestId('dot-2026-10-25-goal')).toBeTruthy();
    expect(queryByTestId('dot-2026-10-27-other')).toBeTruthy();
    expect(queryByTestId('dot-2026-10-28-workout')).toBeTruthy();
    expect(queryByTestId('dot-2026-10-29-workout')).toBeTruthy();
    expect(queryByTestId('dot-2026-10-30-workout')).toBeNull();
    expect(queryByTestId('dot-2026-10-21-workout')).toBeNull();
  });

  it('shows what is on a day when it is tapped: events, the meal plan, and goals due', () => {
    global.__goals = { goals: [{ id: 'g1', title: 'Run 50 km', deadline: '2026-10-22', current: 10, target: 50 }], loadGoals: jest.fn() };
    const { getByTestId, queryByTestId, getByText, queryByText } = open(
      [event({ start: at(22, 7), repeat: { every: 'day', until: null }, remindMinutes: 10, notes: 'Heavy' })],
      { entries: [planEntry(), planEntry({ id: 'p2', slot: 'breakfast', name: 'Oats' })] }
    );
    expect(queryByTestId('occ-e1@2026-10-22')).toBeNull();
    expect(queryByText('Lunch · Chili')).toBeNull();
    fireEvent.press(getByTestId('day-2026-10-22'));
    expect(getByTestId('occ-e1@2026-10-22')).toBeTruthy();
    expect(getByText('7:00 AM · Workout')).toBeTruthy();
    expect(getByText('Every day · 10 min before')).toBeTruthy();
    expect(getByText('Heavy')).toBeTruthy();
    expect(getByText('Breakfast · Oats')).toBeTruthy();
    expect(getByText('Lunch · Chili')).toBeTruthy();
    expect(getByText('Goal due: Run 50 km (20%)')).toBeTruthy();
    expect(queryByText('Nothing scheduled')).toBeNull();
  });

  it('lays the month out in weeks that start on Sunday, with the 1st under its own weekday', () => {
    // Thu 1 Oct 2026: four blank cells before it, and 31 days fill five rows of seven exactly.
    const { getByTestId, queryByTestId } = open();
    const row0 = getByTestId('week-row-0');
    expect(row0.children).toHaveLength(7);
    expect(within(row0).queryAllByTestId(/^day-/).map((n) => n.props.testID)).toEqual(['day-2026-10-01', 'day-2026-10-02', 'day-2026-10-03']);
    expect(within(getByTestId('week-row-4')).queryAllByTestId(/^day-/).map((n) => n.props.testID)).toEqual(['day-2026-10-25', 'day-2026-10-26', 'day-2026-10-27', 'day-2026-10-28', 'day-2026-10-29', 'day-2026-10-30', 'day-2026-10-31']);
    expect(queryByTestId('week-row-5')).toBeNull();
    // Sun 1 Nov 2026 starts the next month's first row, and 30 days leave the last row short, so it is filled with blanks.
    fireEvent.press(getByTestId('month-next'));
    expect(within(getByTestId('week-row-0')).queryAllByTestId(/^day-/)).toHaveLength(7);
    expect(within(getByTestId('week-row-4')).queryAllByTestId(/^day-/).map((n) => n.props.testID)).toEqual(['day-2026-11-29', 'day-2026-11-30']);
    expect(getByTestId('week-row-4').children).toHaveLength(7);
  });

  it('draws the marks in white on the selected day', () => {
    const { getByTestId } = open([event({ start: at(19, 18) })]);
    expect(StyleSheet.flatten(getByTestId('dot-2026-10-19-workout').props.style).backgroundColor).toBe('#FFFFFF');
    fireEvent.press(getByTestId('day-2026-10-20'));
    expect(StyleSheet.flatten(getByTestId('dot-2026-10-19-workout').props.style).backgroundColor).toBe('#000000');
  });

  it('lists the day\'s meals in meal order, and a goal due only on its own day', () => {
    global.__goals = { goals: [{ id: 'g1', title: 'Run 50 km', deadline: '2026-10-25', current: 10, target: 50 }], loadGoals: jest.fn() };
    const { getByTestId, queryByText, getAllByText } = open([], {
      entries: [planEntry({ date: '2026-10-19', slot: 'dinner', name: 'Stew', id: 'a' }), planEntry({ date: '2026-10-19', slot: 'breakfast', name: 'Oats', id: 'b' }), planEntry({ date: '2026-10-19', slot: 'snack', name: 'Nuts', id: 'c' })],
    });
    expect(getByTestId('day-meals').props.children).toBeTruthy();
    const lines = getAllByText(/^(Breakfast|Dinner|Snack) · /).map((n) => n.props.children.join(''));
    expect(lines).toEqual(['Breakfast · Oats', 'Dinner · Stew', 'Snack · Nuts']);
    expect(queryByText(/Goal due/)).toBeNull();
  });

  it('says so for a day with nothing on it', () => {
    expect(open().getByText('Nothing scheduled')).toBeTruthy();
  });

  it('opens the meal plan on that day from the meals on it', () => {
    const { getByTestId } = open([], { entries: [planEntry({ date: '2026-10-19' })] });
    fireEvent.press(getByTestId('day-meals'));
    expect(global.__router.push).toHaveBeenCalledWith({ pathname: '/nutrition/plan', params: { date: '2026-10-19' } });
  });
});

describe('adding an event', () => {
  const addVia = async (utils, testID, title = 'Easy run') => {
    fireEvent.press(utils.getByTestId(testID));
    fireEvent.changeText(utils.getByTestId('event-title'), title);
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    await flush();
  };

  it('adds it from the plus button, closes the sheet, and shows the event\'s day', async () => {
    const utils = open();
    expect(utils.queryByTestId('event-sheet')).toBeNull();
    await addVia(utils, 'calendar-add');
    expect(utils.queryByTestId('event-sheet')).toBeNull();
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ title: 'Easy run', source: 'user', remindMinutes: 0 });
    expect(utils.getByText('Easy run')).toBeTruthy();
  });

  it('starts a new event on the day that is selected, from the add button under the day', async () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('day-2026-10-22'));
    fireEvent.press(utils.getByTestId('day-add'));
    expect(utils.getByTestId('event-date-label').props.children).toBe('Thu, Oct 22');
    fireEvent.changeText(utils.getByTestId('event-title'), 'Lift');
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    await flush();
    expect(new Date(events()[0].start).getDate()).toBe(22);
    expect(utils.getByText('October 22, 2026')).toBeTruthy();
  });

  it('jumps to the day of an event added for another day', async () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('calendar-add'));
    fireEvent.press(utils.getByTestId('event-date-next-week'));
    fireEvent.changeText(utils.getByTestId('event-title'), 'Next week');
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    await flush();
    expect(utils.getByText('October 26, 2026')).toBeTruthy();
  });

  it('keeps the sheet open and says what is wrong when the form is not right', async () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('calendar-add'));
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    expect(utils.getByTestId('event-error').props.children).toBe('Give it a title.');
    expect(utils.getByTestId('event-sheet')).toBeTruthy();
    expect(events()).toEqual([]);
    expect(reconcileReminders).not.toHaveBeenCalled();
  });

  it('closes the sheet without adding anything on cancel', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('calendar-add'));
    fireEvent.press(utils.getByTestId('event-cancel'));
    expect(utils.queryByTestId('event-sheet')).toBeNull();
    expect(events()).toEqual([]);
  });

  it('asks to send reminders and then sets them, once the event is saved', async () => {
    const utils = open();
    await addVia(utils, 'calendar-add');
    expect(askForReminderPermission).toHaveBeenCalledTimes(1);
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
    expect(askForReminderPermission.mock.invocationCallOrder[0]).toBeLessThan(reconcileReminders.mock.invocationCallOrder[0]);
    expect(alert).not.toHaveBeenCalled();
  });

  it('does not ask when the event has no reminder, but still sets the phone\'s reminders in step', async () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('calendar-add'));
    fireEvent.press(utils.getByTestId('event-remind-none'));
    fireEvent.changeText(utils.getByTestId('event-title'), 'Quiet');
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    await flush();
    expect(askForReminderPermission).not.toHaveBeenCalled();
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
  });

  it('says reminders are off when the person wanted one and notifications are turned off', async () => {
    reconcileReminders.mockResolvedValue({ scheduled: 0, blocked: true });
    const utils = open();
    await addVia(utils, 'calendar-add');
    expect(alert).toHaveBeenCalledWith('Reminders are off', expect.stringContaining('Settings'));
  });

  it('says nothing about reminders being off when the person did not ask for one', async () => {
    reconcileReminders.mockResolvedValue({ scheduled: 0, blocked: true });
    const utils = open();
    fireEvent.press(utils.getByTestId('calendar-add'));
    fireEvent.press(utils.getByTestId('event-remind-none'));
    fireEvent.changeText(utils.getByTestId('event-title'), 'Quiet');
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    await flush();
    expect(alert).not.toHaveBeenCalled();
  });

  it('adds a repeating event once, with a mark on each of its days', async () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('calendar-add'));
    fireEvent.press(utils.getByTestId('event-repeat-day'));
    fireEvent.press(utils.getByTestId('event-ends-4'));
    fireEvent.changeText(utils.getByTestId('event-title'), 'Daily mobility');
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    await flush();
    expect(events()).toHaveLength(1);
    expect(events()[0].repeat).toEqual({ every: 'day', until: '2026-11-15' });
    expect(utils.queryByTestId('dot-2026-10-19-workout')).toBeTruthy();
    expect(utils.queryByTestId('dot-2026-10-31-workout')).toBeTruthy();
    expect(utils.queryByTestId('dot-2026-11-02-workout')).toBeNull();
  });
});

describe('changing an event', () => {
  it('opens it in the sheet with what it holds, and saves the changes to the same event', async () => {
    const utils = open([event({ start: at(19, 18, 30) })]);
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    expect(utils.getByTestId('event-title').props.value).toBe('Leg day');
    expect(utils.getByTestId('event-time-label').props.children).toBe('6:30 PM');
    fireEvent.changeText(utils.getByTestId('event-title'), 'Leg day (heavy)');
    await act(async () => { fireEvent.press(utils.getByTestId('event-save')); });
    await flush();
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ id: 'e1', title: 'Leg day (heavy)' });
  });

  it('opens the linked workout, and puts the sheet away', () => {
    global.__workouts = [{ id: 'w1', name: 'Push Day' }];
    const utils = open([event({ start: at(19, 18), workoutId: 'w1' })]);
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    fireEvent.press(utils.getByTestId('event-open-workout'));
    expect(global.__router.push).toHaveBeenCalledWith('/workout/w1');
    expect(utils.queryByTestId('event-sheet')).toBeNull();
  });

  it('opens a repeating event on its first day whichever day was tapped, and keeps its days', async () => {
    const utils = open([event({ start: at(19), repeat: { every: 'day', until: null } })]);
    fireEvent.press(utils.getByTestId('day-2026-10-23'));
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-23'));
    expect(utils.getByTestId('event-date-label').props.children).toBe('Mon, Oct 19');
    expect(utils.queryByTestId('event-date-next-day')).toBeNull();
  });
});

describe('ticking off', () => {
  it('ticks a day off, and takes the tick back, setting the reminders in step each time', async () => {
    const utils = open([event({ start: at(19, 18), repeat: { every: 'day', until: null } })]);
    const check = () => utils.getByTestId('occ-check-e1@2026-10-19');
    expect(check().props.accessibilityState.checked).toBe(false);
    await act(async () => { fireEvent.press(check()); });
    expect(events()[0].doneDates).toEqual(['2026-10-19']);
    expect(check().props.accessibilityState.checked).toBe(true);
    // Only that day.
    fireEvent.press(utils.getByTestId('day-2026-10-20'));
    expect(utils.getByTestId('occ-check-e1@2026-10-20').props.accessibilityState.checked).toBe(false);
    fireEvent.press(utils.getByTestId('day-2026-10-19'));
    await act(async () => { fireEvent.press(check()); });
    expect(events()[0].doneDates).toEqual([]);
    expect(reconcileReminders).toHaveBeenCalledTimes(2);
  });

  it('counts a workout that was logged that day as done, and leaves it that way', async () => {
    global.__activeDays = ['2026-10-19'];
    const utils = open([event({ start: at(19, 18) })]);
    const check = () => utils.getByTestId('occ-check-e1@2026-10-19');
    expect(check().props.accessibilityState.checked).toBe(true);
    expect(utils.getByText('6:00 PM · Workout · Logged')).toBeTruthy();
    await act(async () => { fireEvent.press(check()); });
    expect(events()[0].doneDates).toEqual([]);
    expect(check().props.accessibilityState.checked).toBe(true);
  });

  it('says a workout was missed once its day is past with nothing logged, but not a meal', () => {
    const utils = open([event({ start: at(17), remindMinutes: null }), event({ id: 'e2', kind: 'nutrition', title: 'Lunch', start: at(17, 12) })]);
    fireEvent.press(utils.getByTestId('day-2026-10-17'));
    expect(utils.getByText('7:00 AM · Workout · Missed')).toBeTruthy();
    expect(utils.getByText('12:00 PM · Meal')).toBeTruthy();
  });
});

describe('removing', () => {
  it('asks before removing an event, and removes it when told to', async () => {
    const utils = open([event({ start: at(19, 18) })]);
    fireEvent.press(utils.getByTestId('occ-remove-e1@2026-10-19'));
    expect(alert).toHaveBeenCalledWith('Remove from calendar?', 'Leg day', expect.any(Array));
    expect(events()).toHaveLength(1);
    await pressAlert('Remove');
    expect(events()).toEqual([]);
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
  });

  it('keeps it when told to keep it', () => {
    const utils = open([event({ start: at(19, 18) })]);
    fireEvent.press(utils.getByTestId('occ-remove-e1@2026-10-19'));
    expect(alert.mock.calls[0][2].find((b) => b.text === 'Keep').style).toBe('cancel');
    expect(events()).toHaveLength(1);
  });

  it('offers just the one day for a repeat, and removes only that day', async () => {
    const utils = open([event({ start: at(19, 18), repeat: { every: 'day', until: null } })]);
    fireEvent.press(utils.getByTestId('occ-remove-e1@2026-10-19'));
    expect(alert.mock.calls[0][0]).toBe('Remove a repeating event?');
    expect(alert.mock.calls[0][1]).toBe('Leg day · Every day');
    await pressAlert('Just this day');
    expect(events()).toHaveLength(1);
    expect(events()[0].skipDates).toEqual(['2026-10-19']);
    expect(utils.queryByTestId('occ-e1@2026-10-19')).toBeNull();
    fireEvent.press(utils.getByTestId('day-2026-10-20'));
    expect(utils.queryByTestId('occ-e1@2026-10-20')).toBeTruthy();
  });

  it('removes every day of a repeat when told to', async () => {
    const utils = open([event({ start: at(19, 18), repeat: { every: 'day', until: null } })]);
    fireEvent.press(utils.getByTestId('occ-remove-e1@2026-10-19'));
    await pressAlert('All days');
    expect(events()).toEqual([]);
  });
});

describe('the week', () => {
  it('counts the week\'s workouts as done, missed and to come', () => {
    global.__activeDays = ['2026-10-19'];
    const utils = open([
      event({ id: 'a', start: at(19, 7), remindMinutes: null }),
      event({ id: 'b', start: at(21, 7), remindMinutes: null }),
      event({ id: 'c', kind: 'run', title: 'Run', start: at(17, 7), remindMinutes: null }),
      event({ id: 'm', kind: 'nutrition', title: 'Lunch', start: at(22, 12), remindMinutes: null }),
    ]);
    expect(utils.getByText('Week of Oct 19 – 25')).toBeTruthy();
    expect(utils.getByText('1 of 2 workouts done')).toBeTruthy();
    expect(utils.getByText(/1 to go · 1 meal planned/)).toBeTruthy();
  });

  it('suggests scheduling a workout, or asking the Coach, for a week with none', () => {
    const utils = open();
    expect(utils.getByText('No workouts planned this week.')).toBeTruthy();
    fireEvent.press(utils.getByTestId('week-ask-coach'));
    expect(global.__router.push).toHaveBeenCalledWith('/coach');
    fireEvent.press(utils.getByTestId('week-add-workout'));
    expect(utils.getByTestId('event-sheet')).toBeTruthy();
  });
});

describe('goals', () => {
  it('lists the goals that have a deadline, soonest first, and marks one that is overdue', () => {
    global.__goals = {
      goals: [
        { id: 'g2', title: 'Squat 100 kg', deadline: '2026-12-01', current: 60, target: 100 },
        { id: 'g1', title: 'Run 5 km', deadline: '2026-10-10', current: 3, target: 5 },
        { id: 'g3', title: 'No date', current: 1, target: 2 },
      ],
      loadGoals: jest.fn(),
    };
    const utils = open();
    expect(utils.getByText('Overdue · Oct 10')).toBeTruthy();
    expect(utils.getByText('Due Dec 1')).toBeTruthy();
    expect(utils.queryByText('No date')).toBeNull();
    fireEvent.press(utils.getByTestId('goal-g1'));
    expect(global.__router.push).toHaveBeenCalledWith('/progress');
  });

  it('points to the Progress tab when there are none, and loads them for the signed-in person', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('goals-empty'));
    expect(global.__router.push).toHaveBeenCalledWith('/progress');
    expect(global.__goals.loadGoals).toHaveBeenCalledWith('u1');
  });

  it('does not load goals that are already loaded, or with nobody signed in', () => {
    global.__goals = { goals: [{ id: 'g1', title: 'x', current: 0, target: 1 }], loadGoals: jest.fn() };
    open();
    expect(global.__goals.loadGoals).not.toHaveBeenCalled();
    global.__goals = { goals: [], loadGoals: jest.fn() };
    global.__user = null;
    open();
    expect(global.__goals.loadGoals).not.toHaveBeenCalled();
  });
});

describe('what is coming up', () => {
  it('lists the next events, repeats included, and goes to the day of one that is tapped', () => {
    const utils = open([
      event({ id: 'a', title: 'Run', kind: 'run', start: at(21, 6, 30), remindMinutes: null }),
      event({ id: 'b', title: 'Stretch', kind: 'other', start: at(20, 21), repeat: { every: 'day', until: null }, remindMinutes: null }),
    ]);
    expect(utils.getByTestId('upcoming-b@2026-10-20')).toBeTruthy();
    expect(utils.getByTestId('upcoming-b@2026-10-21')).toBeTruthy();
    fireEvent.press(utils.getByTestId('upcoming-a@2026-10-21'));
    expect(utils.getByText('October 21, 2026')).toBeTruthy();
  });

  it('points to the Coach when nothing is coming up', () => {
    const utils = open();
    fireEvent.press(utils.getByTestId('upcoming-empty'));
    expect(global.__router.push).toHaveBeenCalledWith('/coach');
  });
});

describe('quick log', () => {
  it('opens each place to log something', () => {
    const utils = open();
    ['/workouts', '/running/program', '/nutrition', '/health'].forEach((route) => {
      fireEvent.press(utils.getByTestId(`quick-${route}`));
      expect(global.__router.push).toHaveBeenCalledWith(route);
    });
  });
});

describe('the calendar in the cloud', () => {
  it('merges the meal plan for the signed-in person, and merges the calendar again when pulled down', async () => {
    const schedule = jest.fn(async () => undefined);
    useScheduleStore.setState({ events: [], startSync: schedule });
    const plan = useMealPlanStore.getState().startSync;
    const utils = render(<CalendarScreen />);
    expect(plan).toHaveBeenCalledWith('u1');
    expect(schedule).not.toHaveBeenCalled();
    const scroll = utils.UNSAFE_getByProps({ showsVerticalScrollIndicator: false });
    await act(async () => { await scroll.props.refreshControl.props.onRefresh(); });
    expect(schedule).toHaveBeenCalledWith('u1');
    expect(global.__goals.loadGoals).toHaveBeenCalledWith('u1');
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
  });
});

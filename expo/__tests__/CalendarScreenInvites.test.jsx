// The calendar screen (app/calendar.jsx) and invitations from friends: the Invitations card, accepting one onto the calendar, the
// "Invited by" line, and inviting a friend to, or taking an invite back from, an event of the person's own.
// jest.global-setup.js pins the time zone to America/New_York.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
}));
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

import { addDoc, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import CalendarScreen from '../app/calendar';
import { useScheduleStore } from '../store/scheduleStore';
import { useMealPlanStore } from '../store/mealPlanStore';
import { useCalendarInviteStore } from '../store/calendarInviteStore';
import { useSocialGraphStore } from '../store/socialGraphStore';
import { askForReminderPermission, reconcileReminders } from '../services/calendarReminders';

// Mon 19 Oct 2026, noon in New York.
const NOON = new Date(2026, 9, 19, 12, 0);
const at = (d, h = 7, mi = 0) => new Date(2026, 9, d, h, mi).toISOString();
const event = (o = {}) => ({
  id: 'e1', title: 'Leg day', kind: 'workout', start: at(20), notes: '', workoutId: null, repeat: null, remindMinutes: 30,
  doneDates: [], skipDates: [], source: 'user', inviteId: null, host: null, updatedAt: '2026-10-01T00:00:00.000Z', ...o,
});
// An invitation from Amy to the signed-in person (u1).
const incoming = (o = {}) => ({
  id: 'i9', fromUid: 'amy', toUid: 'u1', fromName: 'Amy', toName: 'Cj', status: 'pending', eventId: 'amy-evt', title: 'Park run',
  kind: 'run', start: at(22, 7), notes: 'Easy pace', repeat: null, createdAt: at(19, 9), respondedAt: null, ...o,
});
// An invitation from the signed-in person to Bo, for e1.
const outgoing = (o = {}) => ({
  id: 'o1', fromUid: 'u1', toUid: 'bo', fromName: 'Cj', toName: 'Bo', status: 'pending', eventId: 'e1', title: 'Leg day',
  kind: 'workout', start: at(20), notes: '', repeat: null, createdAt: at(19, 9), respondedAt: null, ...o,
});

let alert;
const open = ({ events = [], invites = [] } = {}) => {
  act(() => {
    useScheduleStore.setState({ events, startSync: jest.fn(async () => undefined) });
    useMealPlanStore.setState({ entries: [], startSync: jest.fn(async () => undefined) });
    useCalendarInviteStore.setState({ uid: 'u1', invites, error: null });
    useSocialGraphStore.setState({
      following: [{ uid: 'bo', name: 'Bo', close: false }, { uid: 'cat', name: 'Cat', close: true }],
      isLoaded: true,
      isLoading: false,
    });
  });
  return render(<CalendarScreen />);
};
const flush = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }); };
const events = () => useScheduleStore.getState().events;
const withStatus = (id, status) => act(() => {
  useCalendarInviteStore.setState((s) => ({ invites: s.invites.map((i) => (i.id === id ? { ...i, status } : i)) }));
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.clearAllMocks();
  askForReminderPermission.mockResolvedValue(true);
  reconcileReminders.mockResolvedValue({ scheduled: 1, blocked: false });
  setDoc.mockResolvedValue(undefined);
  doc.mockImplementation((_db, _collection, id) => ({ id }));
  collection.mockImplementation((_db, name) => ({ name }));
  addDoc.mockResolvedValue({ id: 'new1' });
  // What the live listener does once a write goes through: the invite shows its new answer.
  updateDoc.mockImplementation(async (ref, data) => { withStatus(ref.id, data.status); });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  global.__router = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
  global.__params = {};
  global.__user = { uid: 'u1', name: 'Cj' };
  global.__goals = { goals: [], loadGoals: jest.fn(async () => undefined) };
  global.__workouts = [];
  global.__activeDays = [];
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('the Invitations card', () => {
  it('is not there when nobody has invited the person', () => {
    expect(open().queryByTestId('calendar-invites')).toBeNull();
  });

  it('is not there for invites the person sent, or answered ones', () => {
    const utils = open({ invites: [outgoing(), incoming({ id: 'x', status: 'declined' })] });
    expect(utils.queryByTestId('calendar-invites')).toBeNull();
  });

  it('shows who invited the person, to what and when', () => {
    const utils = open({ invites: [incoming()] });
    expect(utils.getByText('Invitations (1)')).toBeTruthy();
    expect(utils.getByText('Amy invited you')).toBeTruthy();
    expect(utils.getByText('Park run')).toBeTruthy();
    expect(utils.getByText('Run, Thu, Oct 22 at 7:00 AM')).toBeTruthy();
    expect(utils.getByText('Easy pace')).toBeTruthy();
  });
});

describe('accepting', () => {
  it('puts the event on the calendar as an invitation from that friend, and tells the sender', async () => {
    const utils = open({ invites: [incoming()] });
    await act(async () => { fireEvent.press(utils.getByTestId('invite-accept-i9')); });
    await flush();
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      id: 'invite-i9', title: 'Park run', kind: 'run', start: at(22, 7), source: 'invite', inviteId: 'i9',
      host: { uid: 'amy', name: 'Amy' }, remindMinutes: 0,
    });
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc.mock.calls[0][1]).toMatchObject({ status: 'accepted' });
  });

  it('shows the day it is on, with an Invited by line, and the card goes away', async () => {
    const utils = open({ invites: [incoming()] });
    await act(async () => { fireEvent.press(utils.getByTestId('invite-accept-i9')); });
    await flush();
    expect(utils.getByText('October 22, 2026')).toBeTruthy();
    expect(utils.getByTestId('day-2026-10-22').props.accessibilityState.selected).toBe(true);
    expect(utils.getByTestId('occ-host-invite-i9@2026-10-22').props.children).toEqual(['Invited by ', 'Amy']);
    expect(utils.queryByTestId('calendar-invites')).toBeNull();
  });

  it('asks to buzz the phone at the time, and sets the reminders from the calendar', async () => {
    const utils = open({ invites: [incoming()] });
    await act(async () => { fireEvent.press(utils.getByTestId('invite-accept-i9')); });
    await flush();
    expect(askForReminderPermission).toHaveBeenCalledTimes(1);
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
  });

  it('says reminders are off when notifications are turned off', async () => {
    reconcileReminders.mockResolvedValue({ scheduled: 0, blocked: true });
    const utils = open({ invites: [incoming()] });
    await act(async () => { fireEvent.press(utils.getByTestId('invite-accept-i9')); });
    await flush();
    expect(alert).toHaveBeenCalledWith('Reminders are off', expect.stringContaining('Notifications are turned off for ZOWN'));
  });

  it('asks for no permission for a meal, which only shows', async () => {
    const utils = open({ invites: [incoming({ kind: 'nutrition', title: 'Lunch together' })] });
    await act(async () => { fireEvent.press(utils.getByTestId('invite-accept-i9')); });
    await flush();
    expect(events()[0]).toMatchObject({ kind: 'nutrition', remindMinutes: null });
    expect(askForReminderPermission).not.toHaveBeenCalled();
    expect(reconcileReminders).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('leaves the calendar alone, and says why, when telling the sender fails', async () => {
    updateDoc.mockRejectedValue(new Error('offline'));
    const utils = open({ invites: [incoming()] });
    await act(async () => { fireEvent.press(utils.getByTestId('invite-accept-i9')); });
    await flush();
    expect(events()).toHaveLength(0);
    expect(utils.getByTestId('invite-error-i9').props.children).toBe('That did not go through. Check your connection and try again.');
    expect(utils.getByTestId('invite-i9')).toBeTruthy();
    expect(askForReminderPermission).not.toHaveBeenCalled();
  });
});

describe('declining', () => {
  it('tells the sender and adds nothing to the calendar', async () => {
    const utils = open({ invites: [incoming()] });
    await act(async () => { fireEvent.press(utils.getByTestId('invite-decline-i9')); });
    await flush();
    expect(events()).toHaveLength(0);
    expect(updateDoc.mock.calls[0][1]).toMatchObject({ status: 'declined' });
    expect(utils.queryByTestId('calendar-invites')).toBeNull();
    expect(askForReminderPermission).not.toHaveBeenCalled();
  });
});

describe('an invitation that was accepted', () => {
  const accepted = (o = {}) => event({ id: 'invite-i9', title: 'Park run', kind: 'run', start: at(19, 18), source: 'invite', inviteId: 'i9', host: { uid: 'amy', name: 'Amy' }, remindMinutes: 0, ...o });

  it('says who invited the person in the sheet, and offers no Invite a friend', () => {
    const utils = open({ events: [accepted()] });
    fireEvent.press(utils.getByTestId('occ-invite-i9@2026-10-19'));
    expect(utils.getByTestId('event-host').props.children).toEqual(['Invited by ', 'Amy']);
    expect(utils.queryByTestId('event-invite-friend')).toBeNull();
  });

  it('shows no Invited by line on an event the person made, even if it somehow has a host', () => {
    const utils = open({ events: [event({ start: at(19, 18) }), event({ id: 'e2', start: at(19, 19), host: { uid: 'amy', name: 'Amy' } })] });
    expect(utils.getByTestId('occ-e1@2026-10-19')).toBeTruthy();
    expect(utils.getByTestId('occ-e2@2026-10-19')).toBeTruthy();
    expect(utils.queryByTestId('occ-host-e1@2026-10-19')).toBeNull();
    expect(utils.queryByTestId('occ-host-e2@2026-10-19')).toBeNull();
  });

  it('says "a friend" when the name is missing, and shows no line when the invitation has no host at all', () => {
    const utils = open({
      events: [
        accepted({ id: 'invite-a', start: at(19, 18), host: { uid: 'amy', name: '' } }),
        accepted({ id: 'invite-b', start: at(19, 19), host: null }),
      ],
    });
    expect(utils.getByTestId('occ-host-invite-a@2026-10-19').props.children).toEqual(['Invited by ', 'a friend']);
    expect(utils.getByTestId('occ-invite-b@2026-10-19')).toBeTruthy();
    expect(utils.queryByTestId('occ-host-invite-b@2026-10-19')).toBeNull();
  });
});

describe('inviting a friend', () => {
  it('is offered in the sheet of an event the person made, and not on a new one', () => {
    const utils = open({ events: [event({ start: at(19, 18) })] });
    fireEvent.press(utils.getByTestId('day-add'));
    expect(utils.queryByTestId('event-invite-friend')).toBeNull();
    fireEvent.press(utils.getByText('Cancel'));
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    expect(utils.getByTestId('event-invite-friend')).toBeTruthy();
  });

  it('puts the event sheet away and opens the list of people followed, close friends first', () => {
    const utils = open({ events: [event({ start: at(19, 18) })] });
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    fireEvent.press(utils.getByTestId('event-invite-friend'));
    expect(utils.queryByTestId('event-sheet')).toBeNull();
    expect(utils.getByTestId('invite-sheet')).toBeTruthy();
    expect(utils.getByText('Invite someone to Leg day')).toBeTruthy();
    expect(utils.getAllByTestId(/^invite-person-/).map((n) => n.props.testID)).toEqual(['invite-person-cat', 'invite-person-bo']);
  });

  it('sends the invite for that event, and shows Waiting', async () => {
    const utils = open({ events: [event({ start: at(19, 18) })] });
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    fireEvent.press(utils.getByTestId('event-invite-friend'));
    await act(async () => { fireEvent.press(utils.getByTestId('invite-send-bo')); });
    await flush();
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc.mock.calls[0][1]).toMatchObject({
      fromUid: 'u1', toUid: 'bo', toName: 'Bo', participantIds: ['bo', 'u1'], status: 'pending', eventId: 'e1', title: 'Leg day', kind: 'workout',
    });
    expect(utils.getByTestId('invite-status-bo').props.children).toBe('Waiting');
  });

  it('closes the list with Done, and does not change the calendar', () => {
    const utils = open({ events: [event({ start: at(19, 18) })] });
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    fireEvent.press(utils.getByTestId('event-invite-friend'));
    fireEvent.press(utils.getByTestId('invite-done'));
    expect(utils.queryByTestId('invite-sheet')).toBeNull();
    expect(events()).toHaveLength(1);
    expect(events()[0].title).toBe('Leg day');
  });

  it('goes to Find friends from the list when the person follows nobody', () => {
    const utils = open({ events: [event({ start: at(19, 18) })] });
    act(() => { useSocialGraphStore.setState({ following: [] }); });
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    fireEvent.press(utils.getByTestId('event-invite-friend'));
    fireEvent.press(utils.getByTestId('invite-find-friends'));
    expect(utils.queryByTestId('invite-sheet')).toBeNull();
    expect(global.__router.push).toHaveBeenCalledWith('/friends');
  });
});

describe('the invites sent for an event', () => {
  it('shows who was asked and what they said, in the event sheet, for that event only', () => {
    const utils = open({
      events: [event({ start: at(19, 18) })],
      invites: [outgoing(), outgoing({ id: 'o2', toUid: 'cat', toName: 'Cat', status: 'accepted' }), outgoing({ id: 'o3', eventId: 'other', toName: 'Zed' })],
    });
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    expect(utils.getByTestId('event-invite-o1')).toBeTruthy();
    expect(utils.getByTestId('event-invite-o2')).toBeTruthy();
    expect(utils.queryByTestId('event-invite-o3')).toBeNull();
    expect(utils.getByText('Going')).toBeTruthy();
  });

  it('takes back an invite nobody has answered', async () => {
    const utils = open({ events: [event({ start: at(19, 18) })], invites: [outgoing({ start: at(19, 18) })] });
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    await act(async () => { fireEvent.press(utils.getByTestId('event-invite-cancel-o1')); });
    await flush();
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc.mock.calls[0][1]).toMatchObject({ status: 'cancelled' });
    expect(alert).not.toHaveBeenCalled();
    expect(utils.queryByTestId('event-invite-o1')).toBeNull();
  });

  it('says so when the invite could not be taken back', async () => {
    updateDoc.mockRejectedValue(new Error('offline'));
    const utils = open({ events: [event({ start: at(19, 18) })], invites: [outgoing({ start: at(19, 18) })] });
    fireEvent.press(utils.getByTestId('occ-e1@2026-10-19'));
    await act(async () => { fireEvent.press(utils.getByTestId('event-invite-cancel-o1')); });
    await flush();
    expect(alert).toHaveBeenCalledWith('Could not cancel the invite', 'That did not go through. Check your connection and try again.');
    expect(utils.getByTestId('event-invite-o1')).toBeTruthy();
  });
});

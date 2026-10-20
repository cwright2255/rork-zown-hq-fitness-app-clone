// The Invitations card on the Calendar (components/CalendarInvites.jsx): what is waiting for the person, and Accept and Decline.
// jest.global-setup.js pins the time zone to America/New_York.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import CalendarInvites from '../components/CalendarInvites';
import { useCalendarInviteStore } from '../store/calendarInviteStore';

// Tue 20 Oct 2026, 10:00 AM in New Jersey
const NOW = new Date(2026, 9, 20, 10, 0);
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const invite = (over = {}) => ({
  id: 'i1', fromUid: 'alice', toUid: 'bob', fromName: 'Alice', toName: 'Bob', status: 'pending', eventId: 'evt-1', title: 'Leg day',
  kind: 'workout', start: at(22, 7), notes: '', repeat: null, createdAt: at(20, 9), respondedAt: null, ...over,
});
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });

let acceptInvite;
let declineInvite;
let onAccepted;
const show = (invites) => {
  act(() => { useCalendarInviteStore.setState({ uid: 'bob', invites, acceptInvite, declineInvite }); });
  return render(<CalendarInvites onAccepted={onAccepted} />);
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  acceptInvite = jest.fn(async () => ({ ok: true, event: { id: 'invite-i1', start: at(22, 7), remindMinutes: 0 } }));
  declineInvite = jest.fn(async () => ({ ok: true }));
  onAccepted = jest.fn();
});
afterEach(() => { jest.useRealTimers(); });

describe('what is shown', () => {
  it('is nothing at all when no invitation is waiting', () => {
    expect(show([]).toJSON()).toBeNull();
  });

  it('is nothing for invitations the person sent, ones sent to someone else, answered ones and ones for events that are over', () => {
    const utils = show([
      invite({ id: 'mine', fromUid: 'bob', toUid: 'alice' }),
      invite({ id: 'carol', toUid: 'carol' }),
      invite({ id: 'yes', status: 'accepted' }),
      invite({ id: 'no', status: 'declined' }),
      invite({ id: 'off', status: 'cancelled' }),
      invite({ id: 'old', start: at(10, 7) }),
    ]);
    expect(utils.toJSON()).toBeNull();
  });

  it('is nothing when nobody is signed in', () => {
    act(() => { useCalendarInviteStore.setState({ uid: null, invites: [invite()] }); });
    expect(render(<CalendarInvites />).toJSON()).toBeNull();
  });

  it('says who invited the person, to what, and when', () => {
    const utils = show([invite()]);
    expect(utils.getByText('Invitations (1)')).toBeTruthy();
    expect(utils.getByText('Alice invited you')).toBeTruthy();
    expect(utils.getByText('Leg day')).toBeTruthy();
    expect(utils.getByText('Workout, Thu, Oct 22 at 7:00 AM')).toBeTruthy();
    expect(utils.queryByTestId('invite-error-i1')).toBeNull();
  });

  it('shows no empty line for the notes when there are none', () => {
    const texts = (utils) => utils.getByTestId('invite-i1').findAll((n) => n.type === 'Text').map((n) => n.props.children);
    expect(texts(show([invite()]))).toHaveLength(5);
    expect(texts(show([invite({ notes: 'Bring a belt' })]))).toHaveLength(6);
  });

  it('shows the notes when there are some, and how often a repeat repeats', () => {
    const utils = show([invite({ notes: 'Bring a belt', repeat: { every: 'week', days: [4], until: null } })]);
    expect(utils.getByText('Bring a belt')).toBeTruthy();
    expect(utils.getByText('Workout, Thu, Oct 22 at 7:00 AM. Every week on Thu')).toBeTruthy();
  });

  it('lists several, soonest first, with the count', () => {
    const utils = show([
      invite({ id: 'late', title: 'Long run', kind: 'run', start: at(30, 7) }),
      invite({ id: 'soon', title: 'Breakfast', kind: 'nutrition', start: at(21, 8) }),
    ]);
    expect(utils.getByText('Invitations (2)')).toBeTruthy();
    const order = utils.getAllByTestId(/^invite-(late|soon)$/).map((n) => n.props.testID);
    expect(order).toEqual(['invite-soon', 'invite-late']);
    expect(utils.getByText('Meal, Wed, Oct 21 at 8:00 AM')).toBeTruthy();
    expect(utils.getByText('Run, Fri, Oct 30 at 7:00 AM')).toBeTruthy();
  });

  it('has buttons a screen reader can tell apart', () => {
    const utils = show([invite()]);
    expect(utils.getByLabelText('Accept Leg day from Alice')).toBeTruthy();
    expect(utils.getByLabelText('Decline Leg day from Alice')).toBeTruthy();
  });

  it('goes away when the invitation is answered, and shows the next', () => {
    const utils = show([invite(), invite({ id: 'i2', title: 'Easy run', kind: 'run', start: at(23, 6) })]);
    act(() => { useCalendarInviteStore.setState({ invites: [invite({ status: 'accepted' }), invite({ id: 'i2', title: 'Easy run', kind: 'run', start: at(23, 6) })] }); });
    expect(utils.queryByTestId('invite-i1')).toBeNull();
    expect(utils.getByTestId('invite-i2')).toBeTruthy();
    expect(utils.getByText('Invitations (1)')).toBeTruthy();
  });
});

describe('Accept', () => {
  it('accepts that invitation and hands the new event to the screen', async () => {
    const utils = show([invite(), invite({ id: 'i2', title: 'Easy run' })]);
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    await settle();
    expect(acceptInvite).toHaveBeenCalledTimes(1);
    expect(acceptInvite).toHaveBeenCalledWith('i1');
    expect(declineInvite).not.toHaveBeenCalled();
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(onAccepted).toHaveBeenCalledWith({ id: 'invite-i1', start: at(22, 7), remindMinutes: 0 });
  });

  it('waits while it is working: the buttons are off, and a second tap does nothing', async () => {
    let finish;
    acceptInvite.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const utils = show([invite(), invite({ id: 'i2', title: 'Easy run' })]);
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    fireEvent.press(utils.getByTestId('invite-decline-i1'));
    fireEvent.press(utils.getByTestId('invite-accept-i2'));
    expect(acceptInvite).toHaveBeenCalledTimes(1);
    expect(declineInvite).not.toHaveBeenCalled();
    expect(utils.getByText('One moment...')).toBeTruthy();
    expect(utils.getByTestId('invite-accept-i1').props.accessibilityState.disabled).toBe(true);
    expect(utils.getByTestId('invite-decline-i2').props.accessibilityState.disabled).toBe(true);
    await act(async () => { finish({ ok: true, event: { id: 'invite-i1', start: at(22, 7), remindMinutes: 0 } }); });
    expect(utils.getByTestId('invite-accept-i1').props.accessibilityState.disabled).toBe(false);
    expect(utils.queryByText('One moment...')).toBeNull();
  });

  it('says what went wrong under that invitation, keeps it, and does not tell the screen', async () => {
    acceptInvite.mockResolvedValue({ ok: false, error: 'Your calendar is full. Remove some events to add more.' });
    const utils = show([invite(), invite({ id: 'i2', title: 'Easy run' })]);
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    await settle();
    expect(utils.getByTestId('invite-error-i1').props.children).toBe('Your calendar is full. Remove some events to add more.');
    expect(utils.queryByTestId('invite-error-i2')).toBeNull();
    expect(onAccepted).not.toHaveBeenCalled();
    expect(utils.getByTestId('invite-i1')).toBeTruthy();
    expect(utils.getByTestId('invite-accept-i1').props.accessibilityState.disabled).toBe(false);
  });

  it('clears the message on the next try, and works then', async () => {
    acceptInvite.mockResolvedValueOnce({ ok: false, error: 'That did not go through. Check your connection and try again.' });
    const utils = show([invite()]);
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    await settle();
    expect(utils.getByTestId('invite-error-i1')).toBeTruthy();
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    await settle();
    expect(utils.queryByTestId('invite-error-i1')).toBeNull();
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it('gives a plain message when the store gives no reason', async () => {
    acceptInvite.mockResolvedValue({ ok: false });
    const utils = show([invite()]);
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    await settle();
    expect(utils.getByTestId('invite-error-i1').props.children).toBe('That did not go through.');
  });

  it('works without a screen listening', async () => {
    act(() => { useCalendarInviteStore.setState({ uid: 'bob', invites: [invite()], acceptInvite, declineInvite }); });
    const utils = render(<CalendarInvites />);
    fireEvent.press(utils.getByTestId('invite-accept-i1'));
    await settle();
    expect(acceptInvite).toHaveBeenCalledTimes(1);
  });
});

describe('Decline', () => {
  it('declines that invitation, and adds nothing to the calendar', async () => {
    const utils = show([invite(), invite({ id: 'i2', title: 'Easy run' })]);
    fireEvent.press(utils.getByTestId('invite-decline-i2'));
    await settle();
    expect(declineInvite).toHaveBeenCalledTimes(1);
    expect(declineInvite).toHaveBeenCalledWith('i2');
    expect(acceptInvite).not.toHaveBeenCalled();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('says what went wrong under that invitation', async () => {
    declineInvite.mockResolvedValue({ ok: false, error: 'That invitation is not open any more. It may have been cancelled.' });
    const utils = show([invite()]);
    fireEvent.press(utils.getByTestId('invite-decline-i1'));
    await settle();
    expect(utils.getByTestId('invite-error-i1').props.children).toBe('That invitation is not open any more. It may have been cancelled.');
  });
});
